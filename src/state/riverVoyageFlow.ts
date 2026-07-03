/**
 * VOYAGE FLUVIAL jour par jour (**Mort sur le Reik — Compagnon, ch.5** « Navigation fluviale », cité
 * `T2C ch.5 l.<ligne>`) — la descente d'un fleuve en barge, JOUÉE au lieu d'être un simple transport payant.
 *
 * RÉUTILISATION (pas de duplication de la machinerie de voyage) : ce flux est le PENDANT FLUVIAL de
 * `seaVoyageFlow` (mer, MDG). Comme lui, il s'appuie sur la machinerie de voyage EXISTANTE — halte de nuit
 * (`openRest`), entretien quotidien (`runDailyUpkeep`), coque de trajet persistée (`persistHullWounds`),
 * récap du jour (`TravelRecapDay`) — et n'écrit QUE la résolution navale du jour. Il ne réimplémente ni la
 * boucle de nuit, ni l'entretien, ni la persistance.
 *
 * DISTINCT de la mer (choix de fidélité, pas de raccourci) : T2C ch.5 est un système PROPRE, plus simple que
 * MDG. Le Test de Navigation fluvial est le **barreur seul** (Voile) ou le **meilleur rameur** (Ramer), un par
 * étape (l.11-15) — PAS un Test d'équipage MDG (rôles multiples, Moral, rôle essentiel doublé, manque de bras :
 * rien de tout cela dans T2C). On le résout donc comme le sibling maritime résout SON test de barreur unique
 * (Forcer le rythme) : INLINE, meilleur pilote avec Soutien (LDB 12, `partyAssisted`), remonté dans le récap de
 * la halte de nuit — la même présentation que les jets de bord du voyage maritime. La table des vents, l'Agilité
 * de rame, le chavirage et les Critiques de bateau sont propres au fleuve (`engine/riverNavigation.ts`).
 *
 * EXPOSITION HYDRIQUE (T2C ch.14) : la descente EXERCE l'Effet EXISTANT `waterExposure` — un tirage d'auteur
 * par étape (`MapRoute.riverExposure`) qui, via `applyEffects`, ouvre la cascade de Test de Résistance →
 * maladie. RÉUTILISE le canal d'Effet (aucune mécanique neuve) : le moteur de tables hydriques et l'Effet
 * étaient déjà là (`engine/waterExposure.ts`), seule leur MISE EN SCÈNE dans le voyage manquait.
 */
import { battleRng } from './battleRng';
import { applyEffects } from './combatEffects';
import { openRest, placesOfKind } from './restFlow';
import { runDailyUpkeep } from './upkeep';
import { placeById, type MapRoute, type WorldMap } from './worldMap';
import { persistHullWounds } from './seaVoyageFlow';
import { baseHoursPerDay } from './travelFlow';
import type { TravelPlan, TravelRecapDay } from './travelFlow';
import { travelSpeed } from '../engine/travel';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import { partyAssisted } from '../engine/skills';
import { rollTest, type TestResult } from '../engine/tests';
import { testValue } from '../engine/skills';
import { addCondition } from '../engine/conditions';
import { d100, rollExpr, type RNG } from '../engine/dice';
import {
  rollRiverWind, tickRiverWindDay, riverWindEffect, riverPilotSkill, savoirVoiesFluvialesBonus,
  rowingAgilityFactor, ROWING_AGILITY_DIFFICULTY, riverDayKm, riverDriftKm, navDifficultyWithPenalty,
  riverControlKept, resolveCapsizeRighting, capsizeSinkTurns, holeSinkMinutes, riverCritical, findRiverPeril,
  resolveRiverImpact, rollBarrage, echouageDamage, NAV_BASE_DIFFICULTY, TACK_DIFFICULTY,
  DRIFT_NAV_PENALTY, OUT_OF_CONTROL, CAPSIZE, TEMPORARY_REPAIR, difficultyFromModifier,
  type RiverWindForceId, type RiverWindDirId,
} from '../engine/riverNavigation';
import { DIFFICULTY_LABELS, type Combatant, type Difficulty } from '../engine/types';
import type { Get, Set } from './flowTypes';

/** État FLUVIAL d'un TravelPlan (route `river`) — persiste avec le plan. */
export interface RiverVoyageState {
  /** Force du vent (ticke 4×/jour, l.21). */
  windForce: RiverWindForceId;
  /** Direction RELATIVE (fixée en début de voyage, l.21). */
  windDir: RiverWindDirId;
  daysAfloat: number;
  /** Bateau hors de contrôle (gréement en péril, note 5 l.41) : dérive + Nav −20 jusqu'à réparation. */
  outOfControl?: boolean;
  /** Gréement/avirons brisés (Critique `driftUntilRepair`, l.78-82) : dérive jusqu'à réparation. */
  broken?: boolean;
  /** Coque percée (« Y a un trou », l.101) — sink différé si non calfatée. */
  holed?: boolean;
  /** Le bateau a coulé (chavirage non redressé, ou coque percée non calfatée) : voyage perdu. */
  sunk?: boolean;
}

const log = (get: Get, set: Set, lines: string[]) => {
  if (lines.length) set({ journal: [...get().journal.slice(-40), ...lines] });
};

/** La COQUE de trajet fluviale : le navire de campagne si c'en est un, sinon le véhicule-bateau de la route
 *  (`vehicles.json`, facette `ship`+`hull`). Repart des Blessures persistées (#30) si c'est le navire de
 *  campagne. `null` si aucun bateau exploitable. */
function riverHull(get: Get, route: MapRoute): { coque: Combatant; hasSail: boolean } | null {
  const boatMode = route.modes.find((m) => findVehicleById(m)?.ship && findVehicleById(m)?.hull);
  const vessel = get().vessel;
  const vId = vessel && findVehicleById(vessel.vehicleId)?.ship ? vessel.vehicleId : boatMode;
  const v = vId ? findVehicleById(vId) : undefined;
  if (!v?.ship || !v.hull) return null;
  const coque = vehicleCombatant(v);
  if (!coque) return null;
  if (vessel && vessel.vehicleId === vId && vessel.wounds) {
    coque.wounds = { ...coque.wounds, current: Math.min(vessel.wounds.current, coque.wounds.max) };
  }
  return { coque, hasSail: !!v.ship.sail };
}

/** Un « batelier » : un PJ vivant AYANT des avances en Voile OU Ramer (l.11-17). Sans batelier, on paie un
 *  passeur (repli transport payant côté `startTravel`). */
export function hasBatelier(party: Combatant[]): boolean {
  return party.some((h) => !h.dead && (h.skills ?? []).some((s) => (s.skillId === 'voile' || s.skillId === 'ramer') && s.advances > 0));
}

/** Construit le TravelPlan d'une DESCENTE fluviale (route `river`, mode barge) — `null` si aucun bateau ou
 *  aucun batelier (→ repli transport payant). PUR de RNG hormis le tirage du vent de départ. */
export function buildRiverPlan(get: Get, routeId: string, fromPlaceId: string, toPlaceId: string, route: MapRoute): TravelPlan | null {
  const hull = riverHull(get, route);
  if (!hull || hull.coque.wounds.current <= 0) return null;
  if (!hasBatelier(get().party)) return null;
  const wind = rollRiverWind(battleRng());
  return {
    routeId, fromPlaceId, toPlaceId, mode: 'barge', hoursPerDay: 24, km: route.km, kmDone: 0, interrupted: false,
    vehicle: hull.coque,
    river: { windForce: wind.force, windDir: wind.dir, daysAfloat: 0 },
  };
}

// ── Boucle jour par jour ─────────────────────────────────────────────────────────────────────────

/** Résout UNE journée de descente puis suspend sur la halte de nuit (ou arrive). Reprise au matin par
 *  `continueTravelAfterNight`. */
export function runRiverDays(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan?.river || plan.interrupted || get().pendingRest) return;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const to = worldMap ? placeById(worldMap, plan.toPlaceId) : undefined;
  if (!route || !to) { set({ travelPlan: null }); return; }
  if (plan.km - plan.kmDone < 1e-9) { arriveRiver(get, set, to); return; }
  resolveRiverDay(get, set, route, to);
}

function arriveRiver(get: Get, set: Set, to: { scene: string; entry?: string; label: string }): void {
  set({ travelPlan: null });
  log(get, set, [`— ${to.label} : la barge accoste —`]);
  get().transitionTo(to.scene, to.entry);
}

/** Meilleur pilote (barreur/rameur) du groupe avec Soutien (LDB 12) pour la Compétence de Navigation. */
function riverPilot(get: Get, skillId: 'voile' | 'ramer') {
  return partyAssisted(get().party, skillId);
}

/** Un Test de Navigation du barreur, +1 DR Savoir (Voies fluviales) sur une réussite (l.13). */
function navTest(pilot: { actor: Combatant; value: number }, difficulty: Difficulty, rng: RNG): { t: TestResult; sl: number } {
  const t = rollTest(pilot.value, difficulty, rng);
  const savoir = t.success ? savoirVoiesFluvialesBonus(pilot.actor) : 0;
  return { t, sl: t.sl + savoir };
}

function resolveRiverDay(get: Get, set: Set, route: MapRoute, to: { scene: string; entry?: string; label: string }): void {
  const plan = get().travelPlan!;
  let river = plan.river!;
  const rng = battleRng();
  const worldMap = get().worldMap as WorldMap;
  const coque = plan.vehicle!;
  const lines: string[] = [];
  const tell = (l: string[]) => { if (l.length) { lines.push(...l); log(get, set, l); } };

  const eff = riverWindEffect(river.windForce, river.windDir);
  tell([`🌬️ Vent du jour : ${river.windForce === 'tres-fort' ? 'Très fort' : river.windForce[0].toUpperCase() + river.windForce.slice(1)}, ${river.windDir === 'arriere' ? 'vent arrière' : river.windDir === 'cote' ? 'vent de côté' : 'vent contraire'} (T2C ch.5 l.21).`]);

  const baseKm = travelSpeed(get().party, plan.mode, route.speed?.[plan.mode]) * baseHoursPerDay(worldMap);
  const skillId = riverPilotSkill(findVehicleById(coque.creatureId ?? '')?.ship?.sail != null);
  const pilot = riverPilot(get, skillId);

  // Réparation du gréement/avirons brisés d'une étape précédente (l.78-82 / note 5) : rend le contrôle si réussie.
  attemptControlRepair(get, set, river, tell, rng);
  river = get().travelPlan!.river!; // rafraîchir : la réparation a pu lever broken/outOfControl

  // Test d'AGILITÉ de rame en début de journée (l.17) : échec → −20 % ; Échec spectaculaire (−6 DR) → ÷2.
  let agilityFactor = 1;
  if (pilot) {
    const ag = rollTest(testValue(pilot.actor, undefined, 'Ag'), ROWING_AGILITY_DIFFICULTY, rng);
    agilityFactor = rowingAgilityFactor(ag.success, ag.sl);
    tell([`🚣 ${pilot.actor.name} — Agilité de rame (${DIFFICULTY_LABELS[ROWING_AGILITY_DIFFICULTY]}) : 🎲 ${ag.roll}/${ag.target} → ${ag.success ? 'cadence tenue.' : agilityFactor === 0.5 ? 'Échec spectaculaire — vitesse ÷2 aujourd\'hui.' : 'accroc — vitesse −20 % aujourd\'hui.'}`]);
  }

  // Malus de Navigation PLAT du jour (Dérive −10 note 2 ; hors de contrôle −20 note 5).
  const drifting = !!eff.drift || !!river.outOfControl || !!river.broken;
  let flatPenalty = 0;
  if (eff.drift || river.broken) flatPenalty += DRIFT_NAV_PENALTY;
  if (river.outOfControl) flatPenalty += OUT_OF_CONTROL.navPenalty;
  const navDiff = navDifficultyWithPenalty(flatPenalty);

  // Test de NAVIGATION de l'étape (l.15) : barreur seul (Voile) / meilleur rameur (Ramer), +Savoir (l.13).
  let controlKept = true;
  if (pilot) {
    const nav = navTest(pilot, navDiff, rng);
    const savoir = savoirVoiesFluvialesBonus(pilot.actor);
    controlKept = riverControlKept(nav.t.success, nav.t.sl, savoir);
    tell([`⛵ ${pilot.actor.name} — Navigation (${skillId === 'voile' ? 'Voile' : 'Ramer'} ${DIFFICULTY_LABELS[navDiff]}${savoir ? `, Savoir Voies fluviales +${savoir} DR` : ''}) : 🎲 ${nav.t.roll}/${nav.t.target} → ${controlLabel(controlKept, nav.t.success)}`]);
  } else {
    tell(['⛵ Aucun batelier à la barre — le fleuve emporte l\'embarcation à sa guise.']);
    controlKept = false;
  }

  // Cas particuliers du vent (l.37-41).
  let windPct = eff.pct ?? 0;
  let forceDrift = drifting;
  if (eff.tack && pilot) {
    // Louvoyer (note 3, l.39) : le +% n'est acquis qu'avec un Test de Navigation Accessible (+20) réussi.
    const louvoyer = navTest(pilot, TACK_DIFFICULTY, rng);
    tell([`↩️ Louvoyage pour capter le vent de côté (Navigation Accessible +20) : 🎲 ${louvoyer.t.roll}/${louvoyer.t.target} → ${louvoyer.t.success ? `bonus de +${eff.pct} % conservé.` : 'louvoyage manqué — pas de bonus de vitesse.'}`]);
    if (!louvoyer.t.success) windPct = 0;
  }
  if (eff.capsizeRisk) { forceDrift = resolveCapsize(get, set, plan, river, pilot, tell, rng) || forceDrift; }
  if (eff.riggingRisk) { forceDrift = resolveRiggingRisk(get, set, plan, river, coque, pilot, tell, rng) || forceDrift; }

  // Perte de contrôle (Test de Navigation raté) → dérive (note 2 : loss of control = dérive en aval).
  if (!controlKept) forceDrift = true;

  const sunk = () => !!get().travelPlan?.river?.sunk;
  const kmDay = sunk() ? 0 : forceDrift ? riverDriftKm(baseKm) : riverDayKm(baseKm, windPct, agilityFactor);
  if (!sunk()) tell([`📏 Progression du jour : ${Math.round(kmDay)} km${forceDrift ? ' (dérive — 25 % de la vitesse).' : windPct ? ` (vent ${windPct >= 0 ? '+' : ''}${windPct} %).` : '.'}`]);

  // PÉRILS de rivière (l.119-166) — d'auteur sur la route (data-driven, `MapRoute.riverPerils`).
  for (const spawn of route.riverPerils ?? []) {
    if (sunk()) break;
    if (d100(rng) > Math.max(0, Math.min(100, spawn.chancePct))) continue;
    resolveRiverPeril(get, set, plan, river, spawn.perilId, pilot, tell, rng);
  }

  // EXPOSITION HYDRIQUE de l'étape (T2C ch.14, l.5-13) : à flot, on boit/on est éclaboussé par l'eau du
  // fleuve → tirage d'auteur (`MapRoute.riverExposure`) qui déclenche l'Effet EXISTANT `waterExposure`
  // (Test de Résistance modifié → maladie contractée). RÉUTILISE le canal `applyEffects` (jamais une
  // nouvelle mécanique) ; la cascade s'affiche à l'arrêt (halte de nuit/arrivée) comme tout jet de bord.
  maybeRiverExposure(get, set, route, sunk);

  finishRiverDay(get, set, to, kmDay, lines);
}

/** EXPOSITION HYDRIQUE d'une étape (T2C ch.14, l.5-13) : tirage d'auteur (`MapRoute.riverExposure`) qui
 *  déclenche l'Effet EXISTANT `waterExposure` sur TOUT le groupe (`applyEffects`) — aucune mécanique neuve.
 *  Sauté si le bateau a coulé (plus de fleuve sous les pieds). L'Effet ouvre la cascade influençable. */
function maybeRiverExposure(get: Get, set: Set, route: MapRoute, sunk: () => boolean): void {
  const ex = route.riverExposure;
  if (!ex || sunk()) return;
  if (d100(battleRng()) > Math.max(0, Math.min(100, ex.chancePct))) return;
  applyEffects(get, set, [{ type: 'waterExposure', mode: ex.mode, source: ex.source, target: 'party' }]);
}

function controlLabel(kept: boolean, success: boolean): string {
  if (success) return 'le barreur garde le cap.';
  return kept ? 'le barreur rattrape la barre in extremis (Savoir Voies fluviales).' : 'le contrôle est perdu — le courant emporte le bateau.';
}

/** CHAVIRAGE (note 4, l.40) : Très fort de côté → retirer la voile (Navigation Accessible +20) sinon le bateau
 *  se renverse. Non redressé en BE Rounds → il coule. Renvoie `true` si le bateau ne fait que dériver ce jour. */
function resolveCapsize(get: Get, set: Set, plan: TravelPlan, river: RiverVoyageState, pilot: { actor: Combatant; value: number } | null, tell: (l: string[]) => void, rng: RNG): boolean {
  if (!pilot) { sinkBoat(get, set, tell, 'Sans barreur, le bateau se renverse sous le vent violent et coule.'); return true; }
  const remove = navTest(pilot, CAPSIZE.removeSailDifficulty, rng);
  tell([`💨 Vent très fort de côté — retirer la voile avant de chavirer (Navigation Accessible +20) : 🎲 ${remove.t.roll}/${remove.t.target} → ${remove.t.success ? 'voile affalée à temps.' : 'trop tard — le bateau chavire !'}`]);
  if (remove.t.success) return true; // voile retirée → dérive
  // Chavirage : 1 Test de Navigation Accessible (+20)/Round, −5 cumulatif, jusqu'à BE Rounds.
  const be = capsizeSinkTurns(plan.vehicle!.characteristics?.E ?? 0);
  const pilotValue = pilot.value + savoirVoiesFluvialesBonus(pilot.actor);
  const r = resolveCapsizeRighting(pilotValue, be, rng);
  tell([`🌀 Chavirage — redressement (${be} Round(s), Navigation Accessible +20, −5 cumulatif) : ${r.rounds.map((x) => `🎲 ${x.roll}/${x.target}${x.success ? '✓' : ''}`).join(' · ')}`]);
  if (r.sank) { sinkBoat(get, set, tell, `Le bateau n'est pas redressé et coule en ${be} tours (T2C ch.5 l.40).`); return true; }
  tell([`✅ Le bateau est redressé en ${r.rounds.length} Round(s) — il dérive le temps de reprendre le contrôle.`]);
  return true;
}

/** GRÉEMENT EN PÉRIL (note 5, l.41) : Très fort contraire → Navigation Accessible (+20) sinon Critique au
 *  gréement + dérive hors de contrôle (25 %, Nav −20 jusqu'à réparation). Renvoie `true` s'il dérive. */
function resolveRiggingRisk(get: Get, set: Set, plan: TravelPlan, river: RiverVoyageState, coque: Combatant, pilot: { actor: Combatant; value: number } | null, tell: (l: string[]) => void, rng: RNG): boolean {
  const t = pilot ? navTest(pilot, CAPSIZE.removeSailDifficulty, rng) : null; // même Accessible (+20) que note 4
  tell([`💨 Vent très fort contraire — préserver le gréement (Navigation Accessible +20) : ${t ? `🎲 ${t.t.roll}/${t.t.target} → ${t.t.success ? 'le gréement tient.' : 'Critique au gréement !'}` : 'aucun barreur — le gréement lâche.'}`]);
  if (t?.t.success) return false;
  applyBoatCritical(get, set, plan, river, coque, 'greement', tell, rng);
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, outOfControl: true } } });
  tell([`🧭 Le bateau part en dérive, hors de contrôle (25 % de la vitesse, Tests de Navigation −20 jusqu'à réparation — l.41).`]);
  return true;
}

/** Applique un Coup Critique de bateau (l.72-94) : Dégâts d'éclats à l'équipage, États, dérive, ou coque
 *  percée. */
function applyBoatCritical(get: Get, set: Set, plan: TravelPlan, river: RiverVoyageState, coque: Combatant, location: string, tell: (l: string[]) => void, rng: RNG): void {
  const crit = riverCritical(location);
  if (!crit) return;
  if (crit.splinterDamage) {
    // Éclats à un membre d'équipage exposé (l.78-94) : le barreur/premier héros vivant encaisse. Le RAW
    // gréement/superstructure OFFRE un Test d'Initiative pour ÉVITER les +5 Dégâts (et l'Empêtré, l.78).
    const victim = get().party.find((h) => !h.dead);
    if (victim) {
      const dodge = crit.initiativeTest ? rollTest(testValue(victim, undefined, 'I'), 'intermediaire', rng) : null;
      if (dodge?.success) {
        tell([`💥 Critique au ${location} — ${victim.name} esquive les éclats (Initiative 🎲 ${dodge.roll}/${dodge.target}).`]);
      } else {
        victim.wounds.current = Math.max(0, victim.wounds.current - crit.splinterDamage);
        if (crit.conditionId) addCondition(victim, crit.conditionId as Parameters<typeof addCondition>[1]);
        set({ party: [...get().party] });
        tell([`💥 Critique au ${location} — ${victim.name} subit ${crit.splinterDamage} Dégâts d'éclats${crit.conditionId ? ` et gagne l'État ${crit.conditionId}.` : '.'}${dodge ? ` (Initiative 🎲 ${dodge.roll}/${dodge.target} ratée)` : ''}`]);
      }
    }
  }
  if (crit.driftUntilRepair) set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, broken: true } } });
  if (crit.hole) holeBoat(get, set, plan, tell);
  void river;
}

/** Le meilleur réparateur de bateau (l.107-117) : Métier (Construction de bateaux), sinon Métier
 *  (Charpentier) à −10. Soutien LDB 12. `null` si personne. Source UNIQUE (calfatage + réparation du gréement). */
function bestShipwright(get: Get): { actor: Combatant; value: number } | null {
  return partyAssisted(get().party, 'metier', undefined, undefined, 'Construction de bateaux')
    ?? (() => { const c = partyAssisted(get().party, 'metier', undefined, undefined, 'Charpentier'); return c ? { actor: c.actor, value: c.value + TEMPORARY_REPAIR.charpentierPenalty } : null; })();
}

/** Réparation du gréement/des avirons brisés (Critique `driftUntilRepair`, l.78-82) et du bateau hors de
 *  contrôle (note 5, l.41) : un Test de Métier (réparation temporaire) réussi rend le contrôle. */
function attemptControlRepair(get: Get, set: Set, river: RiverVoyageState, tell: (l: string[]) => void, rng: RNG): void {
  if (!river.broken && !river.outOfControl) return;
  const repair = bestShipwright(get);
  if (!repair) { tell(['🔧 Gréement/avirons hors d\'usage — personne pour les réparer, le bateau dérive.']); return; }
  const t = rollTest(repair.value, TEMPORARY_REPAIR.difficulty, rng);
  tell([`🔧 ${repair.actor.name} — réparation du gréement (Métier ${DIFFICULTY_LABELS[TEMPORARY_REPAIR.difficulty]}) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'le contrôle est rétabli.' : 'le bateau dérive encore.'}`]);
  if (t.success) set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, broken: false, outOfControl: false } } });
}

/** Coque PERCÉE (« Y a un trou », l.101-105) : le bateau prend l'eau et coule en E minutes ; on tente une
 *  réparation temporaire (Métier Construction de bateaux/Charpentier, Complexe — l.113-117). */
function holeBoat(get: Get, set: Set, plan: TravelPlan, tell: (l: string[]) => void): void {
  const rng = battleRng();
  const minutes = holeSinkMinutes(plan.vehicle!.characteristics?.E ?? 0); // « coule en E minutes » (l.103)
  const repair = bestShipwright(get);
  if (repair) {
    const t = rollTest(repair.value, TEMPORARY_REPAIR.difficulty, rng);
    tell([`🔧 Coque percée (le bateau coule en ~${minutes} min, l.103) — calfatage d'urgence (Métier ${DIFFICULTY_LABELS[TEMPORARY_REPAIR.difficulty]}) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'la voie d\'eau est colmatée.' : 'le calfatage ne tient pas.'}`]);
    if (t.success) {
      // Réparation temporaire (l.116) : restaure 1d10 Blessures de coque.
      const healed = Math.min(plan.vehicle!.wounds.max - plan.vehicle!.wounds.current, rollExpr(TEMPORARY_REPAIR.woundsPerRepair, rng));
      plan.vehicle!.wounds.current += healed;
      set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, holed: false } } });
      tell([`✅ La coque tient — +${healed} Blessure(s) de coque restaurées (réparation temporaire, l.116).`]);
      return;
    }
  } else tell(['🔧 Coque percée et personne pour la calfater.']);
  sinkBoat(get, set, tell, 'La coque prend l\'eau plus vite qu\'on ne la vide — le bateau sombre (T2C ch.5 l.103).');
}

/** Le bateau COULE : voyage perdu (le groupe reste au point de départ). */
function sinkBoat(get: Get, set: Set, tell: (l: string[]) => void, reason: string): void {
  tell([`⚓️ ${reason}`]);
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, sunk: true } } });
}

/** PÉRIL de rivière (l.119-166), résolu selon le `kind` de sa définition (`river-perils.json`). */
function resolveRiverPeril(get: Get, set: Set, plan: TravelPlan, river: RiverVoyageState, perilId: string, pilot: { actor: Combatant; value: number } | null, tell: (l: string[]) => void, rng: RNG): void {
  const peril = findRiverPeril(perilId);
  if (!peril) return;
  const coque = plan.vehicle!;
  const damageHull = (dmg: number, note: string) => {
    coque.wounds.current = Math.max(0, coque.wounds.current - dmg);
    set({ travelPlan: { ...get().travelPlan! } });
    tell([`💥 ${peril.label} : la coque subit ${dmg} Dégâts${note} (reste ${coque.wounds.current}/${coque.wounds.max}).`]);
  };
  if (peril.kind === 'navTest' && peril.onFail) {
    // Débris (l.125) : Test de Navigation raté → `hullHits` coups à la coque.
    const t = pilot ? navTest(pilot, NAV_BASE_DIFFICULTY, rng) : null;
    tell([`🪵 ${peril.label} en aval — manœuvre d'évitement (Navigation) : ${t ? `🎲 ${t.t.roll}/${t.t.target} → ${t.t.success ? 'évités.' : 'collision !'}` : 'aucun barreur — collision.'}`]);
    if (!t?.t.success) for (let i = 0; i < peril.onFail.hullHits; i++) damageHull(peril.onFail.damagePerHit, ' (collision)');
  } else if (peril.kind === 'detect' && peril.onHit) {
    // Rochers / eaux peu profondes (l.136) : succès AUTO avec la Compétence Navigation ; sinon Agilité (+0).
    const skilled = pilot && (pilot.actor.skills ?? []).some((s) => (s.skillId === 'voile' || s.skillId === 'ramer') && s.advances > 0);
    const detect = skilled ? { success: true } : pilot ? rollTest(testValue(pilot.actor, undefined, 'Ag'), 'intermediaire', rng) : { success: false };
    tell([`🪨 ${peril.label} — ${skilled ? 'le barreur connaît le passage et l\'évite (Navigation, l.136).' : `détection (Agilité +0) : 🎲 ${'roll' in detect ? (detect as TestResult).roll : '—'} → ${detect.success ? 'évité.' : 'impact !'}`}`]);
    if (!detect.success) {
      const impact = resolveRiverImpact(peril.onHit, rng);
      damageHull(impact.hullDamage, '');
      if (impact.echoue) applyEchouage(get, set, tell);
      if (impact.holed) applyBoatCritical(get, set, plan, river, coque, 'coque', tell, rng); // Critique coque = percée (l.88)
    }
  } else if (peril.kind === 'obstacle' && peril.obstacle) {
    // Barrage de débris (l.128) : forcer le passage en bélier → +ramDamage à la coque (et au barrage).
    const b = rollBarrage(peril.obstacle, rng);
    damageHull(peril.obstacle.ramDamage, ` en enfonçant le barrage (Endurance ${b.endurance}, ${b.wounds} Blessures)`);
  }
  void river;
}

/** S'ÉCHOUER (l.97-99) : le bateau s'arrête, sa coque subit 12 Dégâts ; on le renfloue par un Test de Force
 *  « avec un malus égal au nombre total de Points d'Encombrement du bateau et de sa cargaison » (l.99). Le
 *  malus est l'Encombrement PROPRE du bateau (champ réel `VehicleData.enc`), converti en difficulté (chaque
 *  10 Enc ≈ un cran de −10 via `difficultyFromModifier`) ; degrade sur Intermédiaire si l'Enc du bateau est
 *  inconnu (barges LDB : `enc` null). L'Enc de la CARGAISON n'est pas suivie pendant la descente → résidu noté. */
function applyEchouage(get: Get, set: Set, tell: (l: string[]) => void): void {
  const coque = get().travelPlan!.vehicle!;
  coque.wounds.current = Math.max(0, coque.wounds.current - echouageDamage());
  const boatEnc = findVehicleById(coque.creatureId ?? '')?.enc ?? 0;
  const difficulty = boatEnc > 0 ? difficultyFromModifier(-boatEnc) : 'intermediaire';
  const force = partyAssisted(get().party, undefined, 'F');
  const t = force ? rollTest(force.value, difficulty, battleRng()) : null;
  set({ travelPlan: { ...get().travelPlan! } });
  const encTxt = boatEnc > 0 ? ` (malus −${boatEnc} Enc du bateau, l.99)` : '';
  tell([`⚓ Le bateau s'échoue (coque −${echouageDamage()} Dégâts, l.99)${t ? ` — renflouage (Force ${DIFFICULTY_LABELS[difficulty]}${encTxt}) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'remis à flot.' : 'il faudra s\'y reprendre.'}` : '.'}`]);
}

/** Fin de journée : coque persistée (#30), horloge +24 h, entretien quotidien, arrivée ou halte de nuit. */
function finishRiverDay(get: Get, set: Set, to: { scene: string; entry?: string; label: string }, kmDay: number, dayLines: string[]): void {
  const plan = get().travelPlan!;
  const river = plan.river!;

  // Naufrage : voyage perdu.
  if (river.sunk) {
    set({ gameTime: get().gameTime + 24 * 60, travelPlan: null });
    log(get, set, ['— Le voyage fluvial s\'achève dans le naufrage —']);
    return;
  }

  // Vent de demain : 4 tirages (aube/midi/crépuscule/minuit, l.21).
  const nextForce = tickRiverWindDay(river.windForce, battleRng());
  const kmDone = Math.min(plan.km, plan.kmDone + kmDay);
  set({ gameTime: get().gameTime + 24 * 60 });
  const upkeep = runDailyUpkeep(get, set);
  set({
    travelPlan: {
      ...get().travelPlan!, kmDone,
      river: { ...river, windForce: nextForce, daysAfloat: river.daysAfloat + 1 },
    },
  });
  persistHullWounds(get, set);

  const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: kmDone, hours: 24, lines: [...dayLines, ...upkeep] };

  if (plan.km - kmDone < 1e-9) { arriveRiver(get, set, to); return; }
  const route = (get().worldMap as WorldMap)?.routes.find((r) => r.id === plan.routeId);
  openRest(get, set, { places: placesOfKind(route?.inns ? 'auberge' : 'camp'), travelHalt: true, travelDay: recapDay });
}
