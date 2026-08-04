/**
 * VOYAGE FLUVIAL jour par jour (**Mort sur le Reik — Compagnon, ch.5** « Navigation fluviale », cité
 * `MSRC 7 l.<ligne>`) — la descente d'un fleuve en barge, JOUÉE au lieu d'être un simple transport payant.
 *
 * RÉUTILISATION (pas de duplication de la machinerie de voyage) : ce flux est le PENDANT FLUVIAL de
 * `seaVoyageFlow` (mer, MDG). Comme lui, il s'appuie sur la machinerie de voyage EXISTANTE — halte de nuit
 * (`openRest`), entretien quotidien (`runDailyUpkeep`), coque de trajet PERSISTÉE au coup par coup
 * (`damageVesselHull`/`healVesselHull`, #296 — SOURCE UNIQUE `vessel.wounds`), récap du jour
 * (`TravelRecapDay`) — et n'écrit QUE la résolution navale du jour. Il ne réimplémente ni la boucle de
 * nuit, ni l'entretien, ni la persistance.
 *
 * DISTINCT de la mer (choix de fidélité, pas de raccourci) : MSRC 7 est un système PROPRE, plus simple que
 * MDG. Le Test de Navigation fluvial est le **barreur seul** (Voile) ou le **meilleur rameur** (Ramer), un par
 * étape (l.11-15) — PAS un Test d'équipage MDG (rôles multiples, Moral, rôle essentiel doublé, manque de bras :
 * rien de tout cela dans MSRC). On le résout donc comme le sibling maritime résout SON test de barreur unique
 * (Forcer le rythme) : INLINE, meilleur pilote avec Soutien (LDB 12, `partyAssisted`), remonté dans le récap de
 * la halte de nuit — la même présentation que les jets de bord du voyage maritime. La table des vents, l'Agilité
 * de rame, le chavirage et les Critiques de bateau sont propres au fleuve (`engine/riverNavigation.ts`).
 *
 * EXPOSITION HYDRIQUE (MSRC 16) : la descente EXERCE l'Effet EXISTANT `waterExposure` — un tirage d'auteur
 * par étape (`MapRoute.riverExposure`) qui, via `applyEffects`, ouvre la cascade de Test de Résistance →
 * maladie. RÉUTILISE le canal d'Effet (aucune mécanique neuve) : le moteur de tables hydriques et l'Effet
 * étaient déjà là (`engine/waterExposure.ts`), seule leur MISE EN SCÈNE dans le voyage manquait.
 */
import { battleRng } from './battleRng';
import { minutesUntilNext, DUSK_MINUTE } from '../engine/clock';
import { applyEffects } from './combatEffects';
import { openRest, placesOfKind } from './restFlow';
import { placeById, type MapRoute, type WorldMap } from './worldMap';
import { damageVesselHull, healVesselHull, syncHullWoundsFromVessel, spoilVesselCargoOnLeak } from './seaVoyageFlow';
import { applyOps } from '../engine/ops';
import { baseHoursPerDay } from './travelFlow';
import type { TravelPlan, TravelRecapDay } from './travelFlow';
import { toRecapLines } from './recapLine';
import { travelSpeed } from '../engine/travel';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import { partyCargoTotalEnc } from './carriers';
import { partyAssisted, type SupportDetail } from '../engine/skills';
import { rollTest, type TestResult } from '../engine/tests';
import { testValue } from '../engine/skills';
import { addCondition } from '../engine/conditions';
import { d100, rollExpr, type RNG } from '../engine/dice';
import { difficultyFromModifier } from '../engine/tests';
import {
  rollRiverWind, tickRiverWindDay, riverWindEffect, riverPilotSkill, savoirVoiesFluvialesBonus,
  rowingAgilityFactor, ROWING_AGILITY_DIFFICULTY, riverDayKm, riverDriftKm, navDifficultyWithPenalty,
  riverControlKept, resolveCapsizeRighting, capsizeSinkTurns, holeSinkMinutes, riverCritical, findRiverPeril,
  resolveRiverImpact, rollBarrage, rollBarrageClearing, echouageDamage, NAV_BASE_DIFFICULTY, TACK_DIFFICULTY,
  DRIFT_NAV_PENALTY, OUT_OF_CONTROL, CAPSIZE, TEMPORARY_REPAIR,
  type RiverWindForceId, type RiverWindDirId,
} from '../engine/riverNavigation';
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../engine/types';
import { startCascade, registerCascadeApplier, runCascadeImmediate } from './cascade';
import { freeCons, type Consequence } from './rollSeam';
import { humanControlled } from './netOwnership';
import { riverAutoResolves, DEFAULT_VOYAGE_ORDERS, type VoyageCadence, type VoyageOrders } from './voyageCadence';
import type { CascadeStep, CascadeStepMeta } from './pendings';
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
  /** CONTEXTE TRANSITOIRE du jour EN COURS (posé par `buildRiverDayCascade`, lu et effacé par
   *  `continueRiverDayAfterCascade`) : les entrées de vitesse de la journée que le calcul de km lit
   *  à la clôture de la cascade du jour. Aucune règle propre : les variables du jour
   *  (baseKm/windPct/drift) y sont mises de côté pour être relues après les jets
   *  influençables. Jamais persisté au-delà d'une journée. */
  day?: RiverDayContext;
  /** Facteur d'Agilité de rame du jour EN COURS (posé par l'applier `riverAgility`, lu à la clôture pour
   *  les km) — transitoire comme `day`. Défaut 1 (pas de barreur → pas d'étape → facteur neutre). */
  dayAgilityFactor?: number;
  /** Progression du jour FIGÉE pendant que la cascade d'Exposition hydrique (purpose `riverExposure`) est
   *  ouverte : la halte de nuit / l'arrivée sont DIFFÉRÉES à sa clôture (`continueRiverDayAfterExposure`,
   *  #344). Transitoire — jamais persisté au-delà d'une journée. */
  pendingFinish?: { kmDay: number; dayLines: string[] };
}

/** Entrées de VITESSE d'une journée fluviale, figées au build de la cascade du jour (vent) et
 *  complétées par les appliers (dérive de perte de contrôle, louvoyage manqué → windPct annulé).
 *  Le km final = `riverDayKm(baseKm, windPct, agilityFactor)` ou `riverDriftKm(baseKm)` si dérive —
 *  EXACTEMENT le calcul de l'ancien `resolveRiverDay`. */
export interface RiverDayContext {
  baseKm: number;
  /** % de vitesse du vent (Tableau des vents) — annulé par un louvoyage manqué (`riverTack`). */
  windPct: number;
  /** Dérive DÉJÀ certaine à l'ouverture (Calme/hors de contrôle/gréement brisé) — les appliers la
   *  forcent aussi (perte de contrôle, chavirage, gréement en péril). */
  forceDrift: boolean;
  /** Le vent impose un louvoyage (Modéré/Fort de côté) : le `windPct` n'est acquis qu'avec `riverTack` réussi. */
  tack?: boolean;
  /** Libellé de destination (repris à la clôture pour la halte/arrivée). */
  toScene: string;
  toEntry?: string;
  toLabel: string;
  /** Longueur du journal au DÉBUT du jour (repère) : le RÉCAP de la halte (`TravelRecapDay.lines`,
   *  affiché en tête de la modale de nuit) = la tranche de journal écrite depuis ce repère. */
  journalMark: number;
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().log(lines);
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
  if (vessel && vessel.vehicleId === vId) {
    if (vessel.label) coque.label = vessel.label; // #230 — nom d'instance (affichage)
    syncHullWoundsFromVessel(coque, vessel);
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
export function buildRiverPlan(get: Get, routeId: string, fromPlaceId: string, toPlaceId: string, route: MapRoute, opts: { cadence?: VoyageCadence } = {}): TravelPlan | null {
  const hull = riverHull(get, route);
  if (!hull || hull.coque.wounds.current <= 0) return null;
  if (!hasBatelier(get().party)) return null;
  const wind = rollRiverWind(battleRng());
  // ORDRES permanents (couche `voyageCadence`) : `DEFAULT_VOYAGE_ORDERS` faute de cadence passée. AUCUN
  // appelant ne renseigne `opts.cadence` en fluvial (l'écran de départ ne l'envoie qu'en mer) : la
  // descente joue donc toujours le défaut, `riverAutoResolves` ne rend jamais `true` sur ce chemin.
  const orders: VoyageOrders = { cadence: opts.cadence ?? DEFAULT_VOYAGE_ORDERS.cadence };
  return {
    routeId, fromPlaceId, toPlaceId, mode: 'barge', hoursPerDay: 24, km: route.km, kmDone: 0, interrupted: false,
    orders,
    vehicle: hull.coque,
    river: { windForce: wind.force, windDir: wind.dir, daysAfloat: 0 },
  };
}

// ── Boucle jour par jour ─────────────────────────────────────────────────────────────────────────

/** Résout UNE journée de descente puis suspend sur la halte de nuit (ou arrive). Reprise au matin par
 *  `continueTravelAfterNight`. */
export function runRiverDays(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan?.river || plan.interrupted || get().pendingRest || get().pendingCascade) return;
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

/**
 * Résout UNE journée de descente en la MISE EN SCÈNE d'une CASCADE influençable (purpose `travelDay`) :
 * TOUS les jets du jour (Agilité de rame, Navigation, Louvoyage, sauvegardes vitales, évitement des
 * périls) deviennent des ÉTAPES `CascadeStep` (Lancer → Chance/Pacte/Résilience → Valider) au lieu
 * d'être auto-résolus inline. La CONSÉQUENCE de chaque étape vit dans un `registerCascadeApplier`
 * fluvial (helpers PURS de `riverNavigation.ts`, zéro duplication de formule) qui mute le héros et/ou
 * la coque (`travelPlan.vehicle`) et/ou l'état fluvial. À la clôture de la cascade (`combatSlice`
 * → `continueRiverDayAfterCascade`), le store calcule les km du jour à partir des résultats d'étape
 * — SEUL endroit où ils se calculent — puis enchaîne la halte de nuit ou l'arrivée.
 */
function resolveRiverDay(get: Get, set: Set, route: MapRoute, to: { scene: string; entry?: string; label: string }): void {
  const { steps, log: lines } = buildRiverDayCascade(get, set, route, to);
  for (const l of lines) log(get, set, [l]);
  if (!steps.length) {
    // Aucun jet influençable (bateau coulé d'entrée, ou aucune entrée de vitesse à tester) : on
    // finalise directement, comme la cascade le ferait à la clôture.
    continueRiverDayAfterCascade(get, set);
    return;
  }
  // Route COMMANDÉE (couche `voyageCadence`, résidu #91) : la journée de descente est de la ROUTINE
  // influençable — l'auto-pilote pilote LE MÊME plan d'étapes via le pilote IMMÉDIAT de la cascade
  // (mêmes appliers, mêmes conséquences), SANS modale par jet ; les lignes tombent au PV du jour
  // (journal → recap de la halte). En coop, la conduite reste manuelle (modale).
  if (get().net.mode === 'local' && riverAutoResolves(get().travelPlan?.orders, steps)) {
    runCascadeImmediate(get, set, steps);
    if (get().battle || get().pendingCascade) return; // combat en plein vol OU choix sans défaut : surfacé, jamais résolu en silence
    continueRiverDayAfterCascade(get, set);
    return;
  }
  startCascade(get, set, { title: 'Journée de descente', icon: 'travel/wave', purpose: 'travelDay', steps });
}

/** Difficulté de Navigation du jour (base + malus PLAT RAW de dérive/hors-contrôle) — SOURCE UNIQUE,
 *  partagée par le build de l'étape Nav et l'évitement de péril `navTest`. */
function riverNavDifficulty(river: RiverVoyageState, eff: ReturnType<typeof riverWindEffect>): Difficulty {
  let flatPenalty = 0;
  if (eff.drift || river.broken) flatPenalty += DRIFT_NAV_PENALTY;
  if (river.outOfControl) flatPenalty += OUT_OF_CONTROL.navPenalty;
  return navDifficultyWithPenalty(flatPenalty);
}

/** Une étape-JET fluviale prête à influencer (Test « +0 » sur `target`, difficulté déjà appliquée). */
function riverStep(id: string, kind: string, actorId: string | undefined, label: string, icon: string, rollLabel: string, base: number, difficulty: Difficulty, meta?: CascadeStepMeta, support?: SupportDetail): CascadeStep {
  return { id, kind, actorId, icon, label, rollLabel, base, support, target: Math.max(1, Math.min(99, base + DIFFICULTY_MODIFIERS[difficulty])), result: null, interactive: true, meta };
}

/**
 * Construit les ÉTAPES influençables du JOUR (dans l'ORDRE de résolution RAW : réparation → Agilité →
 * Navigation → Louvoyage → sauvegardes de vent → périls). Pose le CONTEXTE de vitesse transitoire
 * (`river.day`) que la clôture relira pour les km. Renvoie aussi les lignes de journal d'ambiance
 * (vent du jour) déjà connues. Consomme ZÉRO RNG (les jets vivent dans les étapes / appliers).
 */
export function buildRiverDayCascade(get: Get, set: Set, route: MapRoute, to: { scene: string; entry?: string; label: string }): { steps: CascadeStep[]; log: string[] } {
  const plan = get().travelPlan!;
  const river = plan.river!;
  const worldMap = get().worldMap as WorldMap;
  const coque = plan.vehicle!;
  const steps: CascadeStep[] = [];
  const logs: string[] = [];

  const eff = riverWindEffect(river.windForce, river.windDir);
  logs.push(`Vent du jour : ${river.windForce === 'tres-fort' ? 'Très fort' : river.windForce[0].toUpperCase() + river.windForce.slice(1)}, ${river.windDir === 'arriere' ? 'vent arrière' : river.windDir === 'cote' ? 'vent de côté' : 'vent contraire'} (MSRC 7 l.21).`);

  const baseKm = travelSpeed(get().party, get().possessions, plan.mode, route.speed?.[plan.mode]) * baseHoursPerDay(worldMap);
  const skillId = riverPilotSkill(findVehicleById(coque.creatureId ?? '')?.ship?.sail != null);
  const pilot = riverPilot(get, skillId);

  // CONTEXTE DE VITESSE du jour (relu à la clôture) : dérive déjà certaine (Calme/hors-contrôle/brisé),
  // % de vent, louvoyage requis. Les appliers le complètent (perte de contrôle, chavirage → dérive).
  const dayCtx: RiverDayContext = {
    baseKm, windPct: eff.pct ?? 0, forceDrift: !!eff.drift || !!river.outOfControl || !!river.broken,
    tack: !!eff.tack, toScene: to.scene, toEntry: to.entry, toLabel: to.label, journalMark: get().journal.length,
  };
  set({ travelPlan: { ...get().travelPlan!, river: { ...river, day: dayCtx } } });

  // 1. Réparation du gréement/avirons brisés d'une étape précédente (l.78-82 / note 5) : rend le contrôle.
  if ((river.broken || river.outOfControl)) {
    const repair = bestShipwright(get);
    if (repair) steps.push(riverStep('river-repair', 'riverControlRepair', repair.actor.id, 'Réparation du gréement', 'travel/repair',
      'Métier', repair.value, TEMPORARY_REPAIR.difficulty, undefined, repair.support));
    else logs.push('Gréement/avirons hors d\'usage — personne pour les réparer, le bateau dérive.');
  }

  // 2. AGILITÉ de rame (l.17) : échec → −20 % ; Échec spectaculaire (−6 DR) → ÷2.
  if (pilot) steps.push(riverStep('river-agility', 'riverAgility', pilot.actor.id, 'Agilité de rame', 'travel/rowboat',
    'Agilité', testValue(pilot.actor, undefined, 'agilite'), ROWING_AGILITY_DIFFICULTY));

  // 3. NAVIGATION de l'étape (l.15) : barreur seul (Voile) / meilleur rameur (Ramer), +Savoir (l.13).
  //    La difficulté DÉPEND de l'état de dérive à ce moment — RÉÉVALUÉE dans l'applier après la réparation.
  if (pilot) {
    const savoir = savoirVoiesFluvialesBonus(pilot.actor);
    steps.push(riverStep('river-nav', 'riverNav', pilot.actor.id, `Navigation (${skillId === 'voile' ? 'Voile' : 'Ramer'})`, 'travel/sail-ship',
      skillId === 'voile' ? 'Voile' : 'Ramer', pilot.value, riverNavDifficulty(river, eff), { savoir }, pilot.support));
  } else {
    logs.push('Aucun batelier à la barre — le fleuve emporte l\'embarcation à sa guise.');
    dayCtx.forceDrift = true; // pas de barreur = contrôle perdu (note 2 : dérive)
    set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, day: { ...dayCtx } } } });
  }

  // 4. LOUVOYAGE (note 3, l.39) : le +% de vent de côté Modéré/Fort n'est acquis qu'avec un Test réussi.
  if (eff.tack && pilot) steps.push(riverStep('river-tack', 'riverTack', pilot.actor.id, 'Louvoyage', 'nautical/tack',
    skillId === 'voile' ? 'Voile' : 'Ramer', pilot.value, TACK_DIFFICULTY, { savoir: savoirVoiesFluvialesBonus(pilot.actor) }, pilot.support));

  // 5. Sauvegardes de VENT (l.40-41).
  if (eff.capsizeRisk) {
    if (pilot) steps.push(riverStep('river-capsize', 'riverCapsize', pilot.actor.id, 'Retirer la voile (chavirage)', 'nautical/wind',
      skillId === 'voile' ? 'Voile' : 'Ramer', pilot.value, CAPSIZE.removeSailDifficulty, { savoir: savoirVoiesFluvialesBonus(pilot.actor) }, pilot.support));
    else { sinkBoat(get, set, (l) => logs.push(...l), 'Sans barreur, le bateau se renverse sous le vent violent et coule.'); }
  }
  if (eff.riggingRisk) {
    if (pilot) steps.push(riverStep('river-rigging', 'riverRigging', pilot.actor.id, 'Préserver le gréement', 'nautical/wind',
      skillId === 'voile' ? 'Voile' : 'Ramer', pilot.value, CAPSIZE.removeSailDifficulty, { savoir: savoirVoiesFluvialesBonus(pilot.actor) }, pilot.support));
    else { steps.push(...applyBoatCriticalNoPilot(get, set, coque, (l) => logs.push(...l))); }
  }

  // 6. PÉRILS de rivière (l.119-166) — un pas de VÉRIFICATION d'occurrence par péril d'auteur (affichage
  //    muet). L'applier tire la chance (d100, MÊME position RNG qu'inline : un d100 par péril, AVANT le
  //    Test d'évitement), et — si le péril survient et propose un Test de Navigation (Débris) — INSÈRE une
  //    étape-jet d'évitement INFLUENÇABLE juste après (chance PUIS jet = ordre RNG identique à l'inline).
  //    Les kinds sans jet joueur (`detect`/`obstacle`) sont résolus inline dans l'applier de vérification.
  const perilNavBase = pilot ? pilot.value : undefined;
  const perilNavTarget = pilot ? Math.max(1, Math.min(99, pilot.value + DIFFICULTY_MODIFIERS[NAV_BASE_DIFFICULTY])) : undefined;
  for (const [i, spawn] of (route.riverPerils ?? []).entries()) {
    const peril = findRiverPeril(spawn.perilId);
    if (!peril) continue;
    steps.push({ id: `river-peril-${i}`, kind: 'riverPerilCheck', actorId: pilot?.actor.id, icon: 'ui/warning', label: peril.label,
      meta: { perilId: spawn.perilId, chancePct: spawn.chancePct, savoir: pilot ? savoirVoiesFluvialesBonus(pilot.actor) : 0,
        navBase: perilNavBase ?? 0, navTarget: perilNavTarget ?? 0, hasPilot: !!pilot } });
  }

  return { steps, log: logs };
}

/** Coup Critique au gréement SANS barreur (note 5) — Critique + dérive hors de contrôle. Le jet d'éclats
 *  reste possiblement INFLUENÇABLE (#270, `applyBoatCritical`) même sans barreur (l'esquive porte sur la
 *  victime exposée, pas sur le pilote). */
function applyBoatCriticalNoPilot(get: Get, set: Set, coque: Combatant, tell: (l: string[]) => void): CascadeStep[] {
  tell(['Vent très fort contraire — aucun barreur : le gréement lâche.']);
  const insert = applyBoatCritical(get, set, get().travelPlan!, get().travelPlan!.river!, coque, 'greement', tell, battleRng(), 'river-rigging-nopilot');
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, outOfControl: true } } });
  tell(['Le bateau part en dérive, hors de contrôle (25 % de la vitesse, Tests de Navigation −20 jusqu\'à réparation — l.41).']);
  return insert;
}

/**
 * Clôture de la CASCADE du jour (finalisation `purpose:'travelDay'`, appelée par le store) : recalcule
 * la PROGRESSION du jour à partir du contexte de vitesse (`river.day`, alimenté par les étapes/appliers)
 * par `riverDriftKm` / `riverDayKm` (helpers PURS, source unique) — puis résout l'exposition hydrique et
 * enchaîne halte de nuit / arrivée (`finishRiverDay`). Efface le contexte transitoire.
 */
export function continueRiverDayAfterCascade(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan?.river) return;
  const river = plan.river;
  const ctx = river.day;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const to = ctx
    ? { scene: ctx.toScene, entry: ctx.toEntry, label: ctx.toLabel }
    : (worldMap ? placeById(worldMap, plan.toPlaceId) : undefined);
  if (!route || !to) { set({ travelPlan: null }); return; }

  const sunk = !!river.sunk;
  const baseKm = ctx?.baseKm ?? 0;
  const kmDay = sunk ? 0
    : ctx?.forceDrift ? riverDriftKm(baseKm)
    : riverDayKm(baseKm, ctx?.windPct ?? 0, river.dayAgilityFactor ?? 1);
  if (!sunk) log(get, set, [`Progression du jour : ${Math.round(kmDay)} km${ctx?.forceDrift ? ' (dérive — 25 % de la vitesse).' : (ctx?.windPct ? ` (vent ${ctx.windPct >= 0 ? '+' : ''}${ctx.windPct} %).` : '.')}`]);

  // RÉCAP du jour (affiché en tête de la halte de nuit) = la tranche de journal écrite depuis le repère.
  const dayLines = ctx ? get().journal.slice(ctx.journalMark) : [];

  // Efface le contexte transitoire du jour (jamais persisté au-delà de la journée).
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, day: undefined, dayAgilityFactor: undefined } } });

  // Exposition hydrique du jour (MSRC 16) — ouvre l'Effet EXISTANT `waterExposure` (cascade influençable).
  // Si elle SURFACE, on DIFFÈRE la halte de nuit à sa clôture : sinon la cascade d'Exposition et la modale
  // de Repos coexistent, le Repos reprend la route AVANT la résolution de l'Exposition, et celle-ci
  // (purpose générique `test`) n'a plus de continuation → la journée suivante ne se ré-arme jamais (#344).
  // Patron du sibling maritime (`seaScorbut`/`seaExhaustion`) : un purpose DÉDIÉ (`riverExposure`) dont la
  // clôture (`dispatchCascadeDone`) reprend la fin du jour (`continueRiverDayAfterExposure`).
  if (maybeRiverExposure(get, set, route, () => sunk)) {
    const pc = get().pendingCascade!;
    set({
      pendingCascade: { ...pc, purpose: 'riverExposure' },
      travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, pendingFinish: { kmDay, dayLines } } },
    });
    return;
  }

  finishRiverDay(get, set, to, kmDay, dayLines);
}

/** Reprise de la FIN du jour fluvial après la cascade d'Exposition hydrique (purpose `riverExposure`,
 *  posée par `continueRiverDayAfterCascade`) : la halte de nuit / l'arrivée, DIFFÉRÉES le temps du Test de
 *  Résistance. Rejoue `finishRiverDay` avec la progression du jour FIGÉE (`river.pendingFinish`). */
export function continueRiverDayAfterExposure(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan?.river) return;
  const fin = plan.river.pendingFinish;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const to = worldMap ? placeById(worldMap, plan.toPlaceId) : undefined;
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, pendingFinish: undefined } } });
  if (!route || !to) { set({ travelPlan: null }); return; }
  finishRiverDay(get, set, to, fin?.kmDay ?? 0, fin?.dayLines ?? []);
}

/** EXPOSITION HYDRIQUE d'une étape (MSRC 16, l.5-13) : tirage d'auteur (`MapRoute.riverExposure`) qui
 *  déclenche l'Effet EXISTANT `waterExposure` sur TOUT le groupe (`applyEffects`) — aucune mécanique neuve.
 *  Sauté si le bateau a coulé (plus de fleuve sous les pieds). L'Effet ouvre la cascade influençable. */
function maybeRiverExposure(get: Get, set: Set, route: MapRoute, sunk: () => boolean): boolean {
  const ex = route.riverExposure;
  if (!ex || sunk()) return false;
  if (d100(battleRng()) > Math.max(0, Math.min(100, ex.chancePct))) return false;
  const before = get().pendingCascade;
  applyEffects(get, set, [{ type: 'waterExposure', mode: ex.mode, source: ex.source, target: 'party' }]);
  // `true` seulement si l'Effet a bel et bien OUVERT une cascade (héros exposés, `startCascade`) — sinon
  // (tout le groupe hors d'eau, aucune étape) la fin de jour enchaîne normalement.
  return !!get().pendingCascade && get().pendingCascade !== before;
}

function controlLabel(kept: boolean, success: boolean): string {
  if (success) return 'le barreur garde le cap.';
  return kept ? 'le barreur rattrape la barre in extremis (Savoir Voies fluviales).' : 'le contrôle est perdu — le courant emporte le bateau.';
}

/** Patche le contexte de vitesse du jour (`river.day`) — SOURCE UNIQUE des mutations d'entrée de km
 *  depuis un applier (perte de contrôle, louvoyage manqué, chavirage → dérive). */
function patchDay(get: Get, set: Set, patch: Partial<RiverDayContext>): void {
  const river = get().travelPlan?.river;
  if (!river?.day) return;
  set({ travelPlan: { ...get().travelPlan!, river: { ...river, day: { ...river.day, ...patch } } } });
}

// ── APPLIERS des étapes du JOUR fluvial (purpose `travelDay`) : conséquence RAW par `kind`, via les
//    helpers PURS de `riverNavigation.ts` (zéro duplication de formule). Chaque applier lit `step.result`
//    (jet influencé) et mute le héros / la coque (`travelPlan.vehicle`) / l'état fluvial / le contexte
//    de vitesse du jour. Ordre de résolution = ordre des étapes construites (parité RNG avec l'inline).

/** Réparation du gréement/avirons (l.78-82 / note 5) : Test de Métier réussi → rend le contrôle. */
registerCascadeApplier('riverControlRepair', (get, set, step, hero) => {
  if (!step.result) return;
  if (step.result.success) set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, broken: false, outOfControl: false } } });
  const name = hero?.label ?? 'Le charpentier';
  return { consequences: freeCons([step.result.success
    ? { text: `${name} rétablit le contrôle du gréement.`, tone: 'ok' }
    : { text: `${name} ne parvient pas — le bateau dérive encore.`, tone: 'bad' }]) };
});

/** Agilité de rame (l.17) : facteur de vitesse (1 / 0,8 / 0,5) posé sur `river.dayAgilityFactor`. */
registerCascadeApplier('riverAgility', (get, set, step, hero) => {
  if (!step.result) return;
  const factor = rowingAgilityFactor(step.result.success, step.result.sl);
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, dayAgilityFactor: factor } } });
  const name = hero?.label ?? 'Le rameur';
  const text = step.result.success ? `${name} tient la cadence de rame.` : factor === 0.5 ? `${name} peine énormément — vitesse ÷2 aujourd'hui.` : `${name} peine à la rame — vitesse −20 % aujourd'hui.`;
  return { consequences: freeCons([{ text, tone: step.result.success ? 'ok' : 'bad' }]) };
});

/** Navigation de l'étape (l.15) : perte de contrôle (échec non rattrapé par Savoir) → dérive. */
registerCascadeApplier('riverNav', (get, set, step, hero) => {
  if (!step.result) return;
  const savoir = Number(step.meta?.savoir ?? 0);
  const kept = riverControlKept(step.result.success, step.result.sl, savoir);
  if (!kept) patchDay(get, set, { forceDrift: true });
  const savoirNote = savoir > 0 ? ` (Savoir Voies fluviales +${savoir} DR)` : '';
  return { consequences: freeCons([{
    text: `${hero?.label ?? 'Le barreur'}${savoirNote} — ${controlLabel(kept, step.result.success)}`,
    tone: step.result.success ? 'ok' : kept ? 'info' : 'bad',
  }]) };
});

/** Louvoyage (note 3, l.39) : le +% de vent n'est acquis qu'avec un Test réussi. */
registerCascadeApplier('riverTack', (get, set, step) => {
  if (!step.result) return;
  const savoir = Number(step.meta?.savoir ?? 0);
  const ok = step.result.success || (savoir > 0 && step.result.sl + savoir >= 0);
  const windPct = get().travelPlan?.river?.day?.windPct ?? 0;
  if (!ok) patchDay(get, set, { windPct: 0 });
  return { consequences: freeCons([ok
    ? { text: `Vent de côté capté — bonus de +${windPct} % de vitesse conservé.`, tone: 'ok' }
    : { text: 'Louvoyage manqué — pas de bonus de vitesse.', tone: 'bad' }]) };
});

/** Chavirage (note 4, l.40) : voile retirée à temps → dérive ; sinon redressement (BE Rounds, −5 cumulatif)
 *  ou naufrage. Le bateau ne fait au mieux que DÉRIVER ce jour → `forceDrift`. */
registerCascadeApplier('riverCapsize', (get, set, step) => {
  if (!step.result) return;
  patchDay(get, set, { forceDrift: true });
  if (step.result.success) return { consequences: freeCons([{ text: 'Voile affalée à temps — le chavirage est évité.', tone: 'ok' }]) };
  const j: import('./rollSeam').FreeConsLine[] = [{ text: 'Trop tard — le bateau chavire !', tone: 'bad' }];
  const rng = battleRng();
  const be = capsizeSinkTurns(get().travelPlan!.vehicle!.characteristics?.endurance ?? 0);
  const pilotValue = Number(step.base ?? 0) + Number(step.meta?.savoir ?? 0);
  const r = resolveCapsizeRighting(pilotValue, be, rng);
  // Redressement multi-Round SYNCHRONE (sous-jets internes, hors cascade) : aucune rangée nulle part —
  // le journal est la SEULE surface, il PORTE les jets (#295 Lot 5, gardé nominativement).
  j.push(`Redressement (${be} Round(s), Navigation Accessible +20, −5 cumulatif) : ${r.rounds.map((x) => `${x.roll}/${x.target}${x.success ? '✓' : ''}`).join(' · ')}`);
  if (r.sank) { sinkBoat(get, set, (l) => j.push(...l), `Le bateau n'est pas redressé et coule en ${be} tours (MSRC 7 l.40).`); return { consequences: freeCons(j) }; }
  j.push(`Le bateau est redressé en ${r.rounds.length} Round(s) — il dérive le temps de reprendre le contrôle.`);
  return { consequences: freeCons(j) };
});

/** Gréement en péril (note 5, l.41) : Test raté → Critique au gréement + dérive hors de contrôle. */
registerCascadeApplier('riverRigging', (get, set, step) => {
  if (!step.result) return;
  if (step.result.success) return { consequences: freeCons([{ text: 'Le gréement tient.', tone: 'ok' }]) };
  const j: import('./rollSeam').FreeConsLine[] = [{ text: 'Critique au gréement !', tone: 'bad' }];
  const insert = applyBoatCritical(get, set, get().travelPlan!, get().travelPlan!.river!, get().travelPlan!.vehicle!, 'greement', (l) => j.push(...l), battleRng(), step.id);
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, outOfControl: true } } });
  patchDay(get, set, { forceDrift: true });
  j.push('Le bateau part en dérive, hors de contrôle (25 % de la vitesse, Tests de Navigation −20 jusqu\'à réparation — l.41).');
  return { consequences: freeCons(j), insert: insert.length ? insert : undefined };
});

/** VÉRIFICATION d'occurrence d'un péril (l.119-166) : tire la CHANCE (d100, MÊME position RNG qu'inline —
 *  un d100 par péril, AVANT le Test d'évitement). Péril survenu à Test de Navigation (Débris) → INSÈRE une
 *  étape-jet d'évitement INFLUENÇABLE (`riverPerilNav`) ; kinds sans jet joueur (`detect`/`obstacle`)
 *  résolus inline ici (mêmes sous-jets, même ordre). Coulé → sauté sans d100 (parité : inline `break`). */
registerCascadeApplier('riverPerilCheck', (get, set, step) => {
  const rng = battleRng();
  if (get().travelPlan?.river?.sunk) return; // coulé → péril sauté (parité : inline `break`, aucun d100)
  const perilId = String(step.meta?.perilId ?? '');
  const chancePct = Number(step.meta?.chancePct ?? 0);
  const peril = findRiverPeril(perilId);
  if (!peril) return;
  if (d100(rng) > Math.max(0, Math.min(100, chancePct))) return; // un d100 par péril (comme inline)
  if (peril.kind === 'navTest') {
    // Le Test d'évitement est INFLUENÇABLE → étape-jet insérée juste après (chance PUIS jet, ordre inline).
    const hasPilot = !!step.meta?.hasPilot;
    if (!hasPilot) return resolveRiverPerilConsequence(get, set, peril, { ...step, result: null } as CascadeStep, rng);
    const insert: CascadeStep[] = [{
      id: `${step.id}-nav`, kind: 'riverPerilNav', actorId: step.actorId, icon: 'nautical/snag', label: `${peril.label} — évitement`,
      rollLabel: step.rollLabel, base: Number(step.meta?.navBase ?? 0), target: Number(step.meta?.navTarget ?? 0), result: null, interactive: true,
      meta: { perilId, savoir: Number(step.meta?.savoir ?? 0) },
    }];
    return { insert };
  }
  if (peril.kind === 'obstacle' && peril.obstacle) {
    // Barrage (l.128) : CHOIX joueur — forcer au bélier (Dégâts à la coque) OU déblayer à la main (temps,
    // coque intacte). L'Endurance/les Blessures du barrage sont tirées ici pour la lisibilité du choix.
    const b = rollBarrage(peril.obstacle, rng);
    return { insert: [{
      id: `${step.id}-obstacle`, kind: 'riverObstacleChoice', actorId: step.actorId, icon: 'ui/warning',
      label: `${peril.label} (Endurance ${b.endurance}, ${b.wounds} Blessures) — forcer ou déblayer ?`,
      options: [
        { key: 'deblayer', label: 'Déblayer à la main', detail: 'Dégager les débris (3d10 objets) : du temps perdu, mais la coque est épargnée.' },
        { key: 'forcer', label: 'Forcer au bélier', detail: `Enfoncer le barrage : +${peril.obstacle.ramDamage} Dégâts à la coque.` },
      ],
      // Cadence commandée : défaut = le MOINS destructif (déblayer, coque intacte) — MSRC 7 l.128.
      defaultChoice: 'deblayer', interactive: true, meta: { perilId },
    }] };
  }
  // detect : jet de détection GATÉ (#270, conducteur JOUEUR → étape insérée `riverPerilDetect` ; sinon
  // résolution inline, sous-jets dans le même ordre qu'inline).
  return resolveRiverPerilConsequence(get, set, peril, { ...step, result: null } as CascadeStep, rng);
});

/** CHOIX au barrage (l.128) : forcer au bélier (+ramDamage à la coque) ou déblayer à la main (3d10 objets
 *  × 4d10 Enc, coque INTACTE, le halage ampute la progression du jour via `dayAgilityFactor`). */
registerCascadeApplier('riverObstacleChoice', (get, set, step) => {
  const peril = findRiverPeril(String(step.meta?.perilId ?? ''));
  if (!peril?.obstacle) return;
  const coque = get().travelPlan!.vehicle!;
  if (step.chosen === 'forcer') {
    damageVesselHull(get, set, coque, peril.obstacle.ramDamage);
    return { consequences: freeCons([`${peril.label} — forcé au bélier : la coque subit ${peril.obstacle.ramDamage} Dégâts (reste ${coque.wounds.current}/${coque.wounds.max}).`]) };
  }
  if (!peril.clear) return { consequences: freeCons([`${peril.label} — déblayé à la main : la coque est épargnée.`]) };
  const c = rollBarrageClearing(peril.clear, battleRng());
  const workDay = baseHoursPerDay(get().worldMap as WorldMap);
  const factor = workDay > 0 ? Math.max(0, 1 - c.hours / workDay) : 1;
  const prev = get().travelPlan?.river?.dayAgilityFactor ?? 1;
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, dayAgilityFactor: prev * factor } } });
  return { consequences: freeCons([`${peril.label} — déblayé à la main : ${c.objects} objets (${c.enc} Enc) dégagés en ~${c.hours} h, coque épargnée (progression du jour −${Math.round((1 - factor) * 100)} %).`]) };
});

/** Évitement INFLUENÇABLE d'un péril à Test de Navigation (Débris, l.125) : le jet (`step.result`) décide
 *  de la collision → Dégâts à la coque via la conséquence commune. */
registerCascadeApplier('riverPerilNav', (get, set, step) => {
  const peril = findRiverPeril(String(step.meta?.perilId ?? ''));
  if (!peril) return;
  return resolveRiverPerilConsequence(get, set, peril, step, battleRng());
});

/** Esquive INFLUENÇABLE des éclats d'un Critique de bateau (#270, Initiative) — la victime EXPOSÉE tente
 *  d'éviter les Dégâts (l.78-94) ; échec = Dégâts + État éventuel. */
registerCascadeApplier('riverSplinterDodge', (get, set, step, hero) => {
  if (!step.result || !hero) return;
  const dmg = Number(step.meta?.dmg ?? 0);
  const conditionId = String(step.meta?.conditionId ?? '') || undefined;
  const location = String(step.meta?.location ?? '');
  if (step.result.success) return { consequences: freeCons([{ text: `Critique au ${location} — ${hero.label} esquive les éclats.`, tone: 'ok' }]) };
  // HÉROS (pas la coque) : applyOps direct — les éclats sont un Dégât fixe RAW, sans mitigation BE/PA.
  applyOps(hero, [{ op: 'wounds', amount: dmg, ignoreTB: true, ignoreAP: true }]);
  if (conditionId) addCondition(hero, conditionId as Parameters<typeof addCondition>[1]);
  set({ party: [...get().party] });
  return { consequences: freeCons([{ text: `Critique au ${location} — ${hero.label} subit ${dmg} Dégâts d'éclats${conditionId ? ` et gagne l'État ${conditionId}.` : '.'}`, tone: 'bad' }]) };
});

/** Réparation d'urgence INFLUENÇABLE d'une coque PERCÉE (#270, Métier) — succès = voie d'eau colmatée
 *  (+1d10 Blessures de coque, l.116) ; échec = le bateau sombre (l.103). */
registerCascadeApplier('riverHoleRepair', (get, set, step, hero) => {
  if (!step.result) return;
  const plan = get().travelPlan!;
  const name = hero?.label ?? 'Le charpentier';
  if (step.result.success) {
    const healed = Math.min(plan.vehicle!.wounds.max - plan.vehicle!.wounds.current, rollExpr(TEMPORARY_REPAIR.woundsPerRepair, battleRng()));
    healVesselHull(get, set, plan.vehicle!, healed);
    set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, holed: false } } });
    return { consequences: freeCons([{ text: `${name} colmate la voie d'eau : +${healed} Blessure(s) de coque restaurées (réparation temporaire, l.116).`, tone: 'ok' }]) };
  }
  const j: import('./rollSeam').FreeConsLine[] = [{ text: `${name} — le calfatage d'urgence ne tient pas.`, tone: 'bad' }];
  sinkBoat(get, set, (l) => j.push(...l), 'La coque prend l\'eau plus vite qu\'on ne la vide — le bateau sombre (MSRC 7 l.103).');
  return { consequences: freeCons(j) };
});

/** Détection INFLUENÇABLE d'un péril « detect » (Rochers/eaux peu profondes, l.136, Agilité — #270) —
 *  sans la Compétence de Navigation (auto-succès résolu AVANT l'insertion, cf. `resolveRiverPerilConsequence`).
 *  Échec → impact (Dégâts fixes, chances de percée/échouage, MÊME conséquence que le chemin inline). */
registerCascadeApplier('riverPerilDetect', (get, set, step) => {
  const peril = findRiverPeril(String(step.meta?.perilId ?? ''));
  if (!step.result || !peril?.onHit) return;
  if (step.result.success) return { consequences: freeCons([{ text: `${peril.label} — évité.`, tone: 'ok' }]) };
  const j: import('./rollSeam').FreeConsLine[] = [{ text: `${peril.label} — impact !`, tone: 'bad' }];
  const rng = battleRng();
  const impact = resolveRiverImpact(peril.onHit, rng);
  const plan = get().travelPlan!;
  const coque = plan.vehicle!;
  damageVesselHull(get, set, coque, impact.hullDamage);
  j.push(`${peril.label} : la coque subit ${impact.hullDamage} Dégâts (reste ${coque.wounds.current}/${coque.wounds.max}).`);
  const insert: CascadeStep[] = [];
  if (impact.echoue) insert.push(...applyEchouageSteps(get, set, step.id, j));
  if (impact.holed) insert.push(...applyBoatCritical(get, set, plan, plan.river!, coque, 'coque', (l) => j.push(...l), rng, step.id));
  return { consequences: freeCons(j), insert: insert.length ? insert : undefined };
});

/** Applique un Coup Critique de bateau (l.72-94) : Dégâts d'éclats à l'équipage — esquive INFLUENÇABLE
 *  (#270, Initiative) si la victime exposée est pilotée par un humain, sinon inline — États, dérive, ou
 *  coque percée (réparation elle-même GATÉE, `holeBoat`). Renvoie les étapes-jet à INSÉRER, propagées par
 *  l'appelant (build-time `applyBoatCriticalNoPilot` ou applier `riverRigging`/`riverPerilDetect`). */
function applyBoatCritical(get: Get, set: Set, plan: TravelPlan, river: RiverVoyageState, _coque: Combatant, location: string, tell: (l: string[]) => void, rng: RNG, idPrefix: string): CascadeStep[] {
  const crit = riverCritical(location);
  if (!crit) return [];
  const insert: CascadeStep[] = [];
  if (crit.splinterDamage) {
    // Éclats à un membre d'équipage exposé (l.78-94) : le barreur/premier héros vivant encaisse. Le RAW
    // gréement/superstructure OFFRE un Test d'Initiative pour ÉVITER les +5 Dégâts (et l'Empêtré, l.78).
    const victim = get().party.find((h) => !h.dead);
    if (victim && crit.initiativeTest && humanControlled(get(), victim)) {
      const base = testValue(victim, undefined, 'initiative');
      insert.push({
        id: `${idPrefix}-splinter`, kind: 'riverSplinterDodge', actorId: victim.id, icon: 'ui/warning',
        label: `Critique au ${location} — éclats`, rollLabel: 'Initiative', base, target: Math.max(1, Math.min(99, base)),
        result: null, interactive: true, meta: { dmg: crit.splinterDamage, conditionId: crit.conditionId ?? '', location },
      });
    } else if (victim) {
      // Repli SANS pilote humain (pas d'étape insérée ci-dessus) : aucune rangée nulle part pour ce
      // jet — le journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
      const dodge = crit.initiativeTest ? rollTest(testValue(victim, undefined, 'initiative'), 'intermediaire', rng) : null;
      if (dodge?.success) {
        tell([`Critique au ${location} — ${victim.label} esquive les éclats (Initiative ${dodge.roll}/${dodge.target}).`]);
      } else {
        // HÉROS (pas la coque) : applyOps direct — Dégâts d'éclats fixes RAW, sans mitigation BE/PA.
        applyOps(victim, [{ op: 'wounds', amount: crit.splinterDamage, ignoreTB: true, ignoreAP: true }]);
        if (crit.conditionId) addCondition(victim, crit.conditionId as Parameters<typeof addCondition>[1]);
        set({ party: [...get().party] });
        tell([`Critique au ${location} — ${victim.label} subit ${crit.splinterDamage} Dégâts d'éclats${crit.conditionId ? ` et gagne l'État ${crit.conditionId}.` : '.'}${dodge ? ` (Initiative ${dodge.roll}/${dodge.target} ratée)` : ''}`]);
      }
    }
  }
  if (crit.driftUntilRepair) set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, broken: true } } });
  if (crit.hole) insert.push(...holeBoat(get, set, plan, tell, idPrefix));
  void river;
  return insert;
}

/** Le meilleur réparateur de bateau (l.107-117) : Métier (Construction de bateaux), sinon Métier
 *  (Charpentier) à −10. Soutien LDB 12. `null` si personne. Source UNIQUE (calfatage + réparation du gréement). */
function bestShipwright(get: Get): { actor: Combatant; value: number; support: SupportDetail } | null {
  return partyAssisted(get().party, 'metier', undefined, undefined, 'Construction de bateaux')
    ?? (() => { const c = partyAssisted(get().party, 'metier', undefined, undefined, 'Charpentier'); return c ? { actor: c.actor, value: c.value + TEMPORARY_REPAIR.charpentierPenalty, support: c.support } : null; })();
}

/** Coque PERCÉE (« Y a un trou », l.101-105) : le bateau prend l'eau et coule en E minutes ; on tente une
 *  réparation temporaire (Métier Construction de bateaux/Charpentier, Complexe — l.113-117), INFLUENÇABLE
 *  (#270, `riverHoleRepair`) si le réparateur est piloté par un humain — sinon inline. */
function holeBoat(get: Get, set: Set, plan: TravelPlan, tell: (l: string[]) => void, idPrefix: string): CascadeStep[] {
  tell(spoilVesselCargoOnLeak(get, set)); // la coque prend l'eau → voie d'eau gâte 1d10 Enc (lot D #327)
  const minutes = holeSinkMinutes(plan.vehicle!.characteristics?.endurance ?? 0); // « coule en E minutes » (l.103)
  const repair = bestShipwright(get);
  if (repair && humanControlled(get(), repair.actor)) {
    tell([`Coque percée (le bateau coule en ~${minutes} min, l.103) — calfatage d'urgence en cours…`]);
    return [{
      id: `${idPrefix}-hole`, kind: 'riverHoleRepair', actorId: repair.actor.id, icon: 'travel/repair',
      label: 'Calfatage d’urgence', rollLabel: 'Métier', base: repair.value, support: repair.support,
      target: Math.max(1, Math.min(99, repair.value + DIFFICULTY_MODIFIERS[TEMPORARY_REPAIR.difficulty])), result: null, interactive: true,
    }];
  }
  const rng = battleRng();
  if (repair) {
    // Repli SANS pilote humain (pas d'étape insérée ci-dessus) : aucune rangée nulle part pour ce
    // jet — le journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
    const t = rollTest(repair.value, TEMPORARY_REPAIR.difficulty, rng);
    tell([`Coque percée (le bateau coule en ~${minutes} min, l.103) — calfatage d'urgence (Métier ${DIFFICULTY_LABELS[TEMPORARY_REPAIR.difficulty]}) : ${t.roll}/${t.target} → ${t.success ? 'la voie d\'eau est colmatée.' : 'le calfatage ne tient pas.'}`]);
    if (t.success) {
      // Réparation temporaire (l.116) : restaure 1d10 Blessures de coque.
      const healed = Math.min(plan.vehicle!.wounds.max - plan.vehicle!.wounds.current, rollExpr(TEMPORARY_REPAIR.woundsPerRepair, rng));
      healVesselHull(get, set, plan.vehicle!, healed);
      set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, holed: false } } });
      tell([`La coque tient — +${healed} Blessure(s) de coque restaurées (réparation temporaire, l.116).`]);
      return [];
    }
  } else tell(['Coque percée et personne pour la calfater.']);
  sinkBoat(get, set, tell, 'La coque prend l\'eau plus vite qu\'on ne la vide — le bateau sombre (MSRC 7 l.103).');
  return [];
}

/** Le bateau COULE : voyage perdu (le groupe reste au point de départ). */
function sinkBoat(get: Get, set: Set, tell: (l: string[]) => void, reason: string): void {
  tell([reason]);
  set({ travelPlan: { ...get().travelPlan!, river: { ...get().travelPlan!.river!, sunk: true } } });
}

/** CONSÉQUENCE d'un PÉRIL de rivière (l.119-166) SURVENU, résolue selon le `kind` (`river-perils.json`).
 *  Pour `navTest` (Débris) le jet d'évitement est INFLUENÇABLE (lu dans `step.result`) ; `obstacle`
 *  (Barrage) passe par le CHOIX `riverObstacleChoice` ; `detect` GATE sa détection (#270, `riverPerilDetect`,
 *  cf. `registerCascadeApplier` ci-dessus) — sans barreur qualifié piloté par un humain, résolution inline. */
function resolveRiverPerilConsequence(get: Get, set: Set, peril: NonNullable<ReturnType<typeof findRiverPeril>>, step: CascadeStep, rng: RNG): { consequences: Consequence[]; insert?: CascadeStep[] } {
  const plan = get().travelPlan!;
  const river = plan.river!;
  const coque = plan.vehicle!;
  const j: string[] = [];
  const insert: CascadeStep[] = [];
  const damageHull = (dmg: number, note: string) => {
    damageVesselHull(get, set, coque, dmg);
    j.push(`${peril.label} : la coque subit ${dmg} Dégâts${note} (reste ${coque.wounds.current}/${coque.wounds.max}).`);
  };
  if (peril.kind === 'navTest' && peril.onFail) {
    // Débris (l.125) : Test de Navigation d'évitement INFLUENÇABLE (step.result), +Savoir (l.13) → contrôle gardé.
    const res = step.result;
    const savoir = Number(step.meta?.savoir ?? 0);
    const avoided = res ? riverControlKept(res.success, res.sl, savoir) : false;
    j.push(`${peril.label} en aval — manœuvre d'évitement (Navigation) : ${res ? (avoided ? 'évités.' : 'collision !') : 'aucun barreur — collision.'}`);
    if (!avoided) for (let i = 0; i < peril.onFail.hullHits; i++) damageHull(peril.onFail.damagePerHit, ' (collision)');
  } else if (peril.kind === 'detect' && peril.onHit) {
    // Rochers / eaux peu profondes (l.136) : succès AUTO avec la Compétence Navigation ; sinon Agilité (+0),
    // INFLUENÇABLE (#270) si le barreur est piloté par un humain (`riverPerilDetect`).
    const pilotId = step.actorId;
    const pilot = pilotId ? get().party.find((h) => h.id === pilotId) : undefined;
    const skilled = pilot && (pilot.skills ?? []).some((s) => (s.skillId === 'voile' || s.skillId === 'ramer') && s.advances > 0);
    if (skilled) {
      j.push(`${peril.label} — le barreur connaît le passage et l'évite (Navigation, l.136).`);
    } else if (pilot && humanControlled(get(), pilot)) {
      const base = testValue(pilot, undefined, 'agilite');
      insert.push({
        id: `${step.id}-detect`, kind: 'riverPerilDetect', actorId: pilot.id, icon: 'nautical/snag', label: `${peril.label} — détection`,
        rollLabel: 'Agilité', base, target: Math.max(1, Math.min(99, base)), result: null, interactive: true,
        meta: { perilId: peril.id },
      });
    } else {
      const detect = pilot ? rollTest(testValue(pilot, undefined, 'agilite'), 'intermediaire', rng) : { success: false };
      j.push(`${peril.label} — détection (Agilité +0) : ${'roll' in detect ? (detect as TestResult).roll : '—'} → ${detect.success ? 'évité.' : 'impact !'}`);
      if (!detect.success) {
        const impact = resolveRiverImpact(peril.onHit, rng);
        damageHull(impact.hullDamage, '');
        if (impact.echoue) insert.push(...applyEchouageSteps(get, set, step.id, j));
        if (impact.holed) insert.push(...applyBoatCritical(get, set, plan, river, coque, 'coque', (l) => j.push(...l), rng, step.id)); // Critique coque = percée (l.88)
      }
    }
  }
  return { consequences: freeCons(j), insert: insert.length ? insert : undefined };
}

/** S'ÉCHOUER (l.97-99) : le bateau s'arrête, sa coque subit 12 Dégâts ; on le renfloue par un Test de Force
 *  « avec un malus égal au nombre total de Points d'Encombrement du bateau et de sa cargaison » (l.99). Le
 *  malus = Enc PROPRE du bateau (`VehicleData.enc`) + Enc de la CARGAISON des porteurs réels du groupe
 *  (`partyCargoTotalEnc` : bêtes/véhicules/navire, la cale fluviale du commerce MSRC 13), converti en
 *  difficulté (chaque 10 Enc ≈ un cran de −10 via
 *  `difficultyFromModifier`) ; degrade sur Intermédiaire si aucun Enc n'est connu (barge LDB `enc` null +
 *  convoi vide). Le RAW ne prévoit AUCUN délestage pour se renflouer (l.97-105 muets) → non modélisé. */
export function applyEchouage(get: Get, set: Set, tell: (l: string[]) => void): void {
  const coque = get().travelPlan!.vehicle!;
  damageVesselHull(get, set, coque, echouageDamage());
  const { difficulty, encTxt } = echouageDifficulty(get);
  // Chemin IA/synchrone (`riverEchouageForce` gate l'acteur JOUEUR ci-dessus) : aucune rangée nulle
  // part pour ce jet — le journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
  const force = partyAssisted(get().party, undefined, 'force');
  const t = force ? rollTest(force.value, difficulty, battleRng()) : null;
  tell([`Le bateau s'échoue (coque −${echouageDamage()} Dégâts, l.99)${t ? ` — renflouage (Force ${DIFFICULTY_LABELS[difficulty]}${encTxt}) : ${t.roll}/${t.target} → ${t.success ? 'remis à flot.' : 'il faudra s\'y reprendre.'}` : '.'}`]);
}

/** Malus/difficulté du renflouage (l.99, Enc du bateau + de la cargaison) — SOURCE UNIQUE, partagée par
 *  le renflouage IA/synchrone (`applyEchouage`) et l'étape-jet JOUEUR (`riverEchouageForce`, #270). */
function echouageDifficulty(get: Get): { difficulty: Difficulty; encTxt: string } {
  const coque = get().travelPlan!.vehicle!;
  const boatEnc = findVehicleById(coque.creatureId ?? '')?.enc ?? 0;
  const cargoEnc = partyCargoTotalEnc(get());
  const totalEnc = boatEnc + cargoEnc;
  const difficulty = totalEnc > 0 ? difficultyFromModifier(-totalEnc) : 'intermediaire';
  const encTxt = totalEnc > 0 ? ` (malus −${totalEnc} Enc : ${boatEnc} bateau + ${cargoEnc} cargaison, l.99)` : '';
  return { difficulty, encTxt };
}

/** ÉCHOUAGE (#270) : Dégâts fixes appliqués immédiatement (non-jetés) ; le renflouage (Test de Force)
 *  devient une étape-jet INFLUENÇABLE (`riverEchouageForce`) si l'acteur est piloté par un humain —
 *  sinon délègue à `applyEchouage` (chemin IA/synchrone inchangé). */
function applyEchouageSteps(get: Get, set: Set, idPrefix: string, j: import('./rollSeam').FreeConsLine[]): CascadeStep[] {
  const force = partyAssisted(get().party, undefined, 'force');
  if (!force || !humanControlled(get(), force.actor)) {
    applyEchouage(get, set, (l) => j.push(...l));
    return [];
  }
  const coque = get().travelPlan!.vehicle!;
  damageVesselHull(get, set, coque, echouageDamage());
  const { difficulty, encTxt } = echouageDifficulty(get);
  j.push(`Le bateau s'échoue (coque −${echouageDamage()} Dégâts, l.99).`);
  return [{
    id: `${idPrefix}-echouage`, kind: 'riverEchouageForce', actorId: force.actor.id, icon: 'travel/repair',
    label: 'Renflouage', rollLabel: 'Force', base: force.value, support: force.support,
    target: Math.max(1, Math.min(99, force.value + DIFFICULTY_MODIFIERS[difficulty])), result: null, interactive: true,
    meta: { encTxt, difficultyLabel: DIFFICULTY_LABELS[difficulty] },
  }];
}

/** Renflouage INFLUENÇABLE (#270, Force) — MÊME issue que `applyEchouage`, jet différé. */
registerCascadeApplier('riverEchouageForce', (_get, _set, step, hero) => {
  if (!step.result) return;
  const name = hero?.label ?? 'Le groupe';
  return { consequences: freeCons([step.result.success
    ? { text: `${name} remet le bateau à flot.`, tone: 'ok' }
    : { text: `${name} n'y parvient pas — il faudra s'y reprendre.`, tone: 'bad' }]) };
});

/** Fin de journée : horloge avancée (arrivée = +24 h ; halte = jusqu'au crépuscule), puis arrivée ou
 *  halte de nuit (la coque est déjà PERSISTÉE au coup par coup, `damageVesselHull`/`healVesselHull`,
 *  #296). L'entretien du jour se résout dans la cascade de nuit. */
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
  const arrived = plan.km - kmDone < 1e-9;
  // Horloge : à l'ARRIVÉE, la journée entière passe (+24 h) — l'entretien du jour est rattrapé par le
  // prochain `runDailyUpkeep`. Sinon (HALTE de nuit) la navigation s'arrête au crépuscule : le canon MSRC
  // ne chiffre PAS la navigation fluviale de nuit (valeur maison, cadence gouvernée par la même porte
  // aube→crépuscule que le départ, `travel-departure-gate`, #340) et la nuit de sommeil enjambe minuit :
  // UN SEUL franchissement de jour par cycle jour+nuit (comme le voyage terrestre).
  // L'ENTRETIEN n'est jamais roulé ici (sinon la Faim s'installe avant le repas) : il se résout dans la
  // cascade de nuit (`buildNightCascade`), APRÈS `feedFromMeal`.
  set({ gameTime: get().gameTime + (arrived ? 24 * 60 : minutesUntilNext(get().gameTime, DUSK_MINUTE)) });
  set({
    travelPlan: {
      ...get().travelPlan!, kmDone,
      river: { ...river, windForce: nextForce, daysAfloat: river.daysAfloat + 1 },
    },
  });

  const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: kmDone, hours: 24, lines: toRecapLines(dayLines) };

  if (arrived) { arriveRiver(get, set, to); return; }
  const route = (get().worldMap as WorldMap)?.routes.find((r) => r.id === plan.routeId);
  // Sur la rivière on peut mouiller le long de la berge : coucher À BORD (hamacs, MDG 03 l.71) offert
  // en plus du campement/de l'auberge de la halte — la belle étoile sur la berge reste possible.
  const places = { ...placesOfKind(route?.inns ? 'auberge' : 'camp'), ...(get().vessel ? { bord: true } : {}) };
  openRest(get, set, { places, travelHalt: true, travelDay: recapDay });
}
