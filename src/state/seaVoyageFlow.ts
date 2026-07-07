/**
 * VOYAGE MARITIME jour par jour (MDG ch.13 « Navigation maritime » + ch.15 « Longs voyages ») —
 * EXTENSION de la machinerie de voyage (`travelFlow`) : mêmes briques (TravelPlan, halte de nuit
 * `openRest`, entretien quotidien `runDailyUpkeep`, recap), la RÉSOLUTION du jour est navale.
 *
 * Une route MARITIME (`MapRoute.sea`) se voyage sur le NAVIRE DE CAMPAGNE (`state.vessel`) ; sa
 * distance `km` est en MILLES (les tables RAW sont en milles — ch.15 l.57-78). La journée en mer :
 *  1. MÉTÉO du jour (ch.13 l.164) + direction du vent (rose, l.250) — témoin, au recap ;
 *  2. vent « Affaler les voiles » (l.288) → Test d'équipage d'AFFALER (modale, #65) — échec :
 *     Critique au Gréement ; tant que ça souffle, ancre ou dérive à 25 % ;
 *  3. Test d'équipage de PROGRESSION (modale, #65) : milles du jour = 18 × M effectif (vent ch.13
 *     l.276, Salissures l.152, Clinfoc ch.12 l.256), ±10 %/DR (ch.15 l.78) ;
 *  4. arrivée en vue du port À PHARE (`MapPlace.port.lighthouse`) → Test d'équipage de PERCEPTION
 *     (modale, #65 — « voir la lumière d'un phare », l.337) : réussite → bonus d'Orientation (l.335) ;
 *  5. Test d'équipage d'ORIENTATION quotidien (modale, #65 — « un Test par jour de voyage », l.311)
 *     → Repères / Changement de cap (retard %, quart de tour, demi-tour) ;
 *  6. CRISE en cours (Poursuite ch.13 l.354 / Tourbillon l.514) : un Test d'équipage par manche
 *     (modales POURSUITE / MANŒUVRE, #65) jusqu'à l'issue ;
 *  7. infestation de rats (événement) : Test d'équipage étendu d'EXTERMINATION DES NUISIBLES
 *     (modale, #65 — 1d10 h par Test, MDG 14 l.98-104) + cargaison gâtée chaque nuit ;
 *  8. ÉVÉNEMENT DE BORD tous les 1d10 jours (ch.15 l.89, d100 + Humeur de Manann) ;
 *  9. nuit : coque endommagée → Test d'équipage d'ENTRETIEN (modale, #65 — remplace le Test de
 *     Métier à −2 DR, MDG 14 l.116-124, réparation TEMPORAIRE ch.13 l.647) ; Salissures
 *     hebdomadaires (l.148) ; eau/scorbut (ch.14 l.224-242) ; halte de repos (machinerie existante).
 *  À l'accostage : ÉVÉNEMENT DE PORT (2d10 ± Humeur, ch.15 l.127).
 *
 * ÉQUIPAGE hors combat : ABSTRAIT, tenu par les PJ (MDG 14 l.39) — pas de Manque de bras (l.53-55).
 * En combat, l'équipage est réel (`battle.combatants`) et le Manque de bras s'applique (`shipCrew.ts`).
 */
import { battleRng } from './battleRng';
import { bus, EVT } from './bus';
import { openRest, placesOfKind } from './restFlow';
import { dayIndex } from './upkeep';
import { placeById, type WorldMap } from './worldMap';
import type { TravelPlan, TravelRecapDay } from './travelFlow';
import type { PendingCrewTest, ShipManeuverParticipant } from './pendings';
import { crewTestContributors, shipMoraleScore, applyShipMoraleDelta } from './shipCrew';
import { openEmbrigadementRecovery } from './embrigadementFlow';
import { maneuverCrewTotal } from './shipManeuver';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById, findCrewRoleById, findCrewTestTypeById, findNavalTrait } from '../data';
import { installCost, rollSteamBreakdown, steamBreakdownTriggered } from '../engine/shipBuild';
import { d10, d100, roll as rollDice, type RNG } from '../engine/dice';
import { rollTest, isDoubleRoll } from '../engine/tests';
import { testValue, partyAssisted } from '../engine/skills';
import { applyOps } from '../engine/ops';
import { itemCapability } from '../engine/capabilities';
import { isRation } from '../engine/provisions';
import { toDate, MINUTES_PER_DAY, minutesUntilNext, DUSK_MINUTE } from '../engine/clock';
import { seasonOfMonth } from '../engine/travelStages';
import {
  rollSeaWeather, rollWindDirection, windAspect, tickWindForce, windEffect, windAdjustedM,
  seaWeatherLabel, dailyWaterLitres, temperatureDef, seaExposureTestsPerDay, AFFALER_RULES,
  precipitationSkillMod, precipitationDef,
  type SeaWeather, type WindDirection,
} from '../engine/seaWeather';
import {
  seaMilesPerDay, orientationOutcome, rollCourseChange, foulingEffects, rollWeeklyFouling,
  lighthouseSpotDifficulty, lighthouseOrientationDR, savoirOceansBonus, pursuitDistanceGain,
  pursuitLowMPenalty, forcePaceDifficulty, exhaustionDifficulty, REPARATION,
} from '../engine/seaNavigation';
import { exposureNight, expireExposureEffects } from '../engine/exposure';
import { pursuitOutcome } from '../engine/pursuit';
import { addCondition } from '../engine/conditions';
import { findWhirlpool } from '../engine/seaPerils';
import {
  rollBoardEvent, rollPortEvent, rollDaysToNextEvent, applyManannFactor, addManann, MANANN_BASE,
  removeCargo, cargoTotalEnc, type SeaEventDef, type ManannMood, type PortProfile,
} from '../engine/seaVoyage';
import { navalMoveMod, shipHasNavalTrait } from '../engine/navalTraits';
import { rule } from '../engine/policy';
import { subtract, toMoney, type Money } from '../engine/money';
import { rollShipCritical } from '../engine/shipCritical';
import type { ShipCritKey } from '../data/shipCriticals';
import { contractDisease } from '../engine/disease';
import { DIFFICULTY_LABELS, type Combatant, type Difficulty } from '../engine/types';
import type { Get, Set } from './flowTypes';
import type { CampaignVessel } from './store';

/** Crise NAVALE en cours (un Test d'équipage par manche jusqu'à l'issue). */
export type SeaCrisis =
  | { kind: 'poursuite'; label: string; distance: number; escapeAt: number; foeM: number; foeSkill: number; desc: string }
  | { kind: 'tourbillon'; label: string; whirlpoolId: string; need: number; progress: number };

/** Étape de la journée maritime — la boucle se SUSPEND sur chaque modale et reprend à l'étape suivante. */
export type SeaStep = 'meteo' | 'affaler' | 'progression' | 'crise' | 'perception' | 'orientation' | 'extermination' | 'events' | 'entretien' | 'nuit';

/** État NAVAL d'un TravelPlan (route `sea`) — persiste dans la save avec le plan. */
export interface SeaVoyageState {
  /** Cap dominant du trajet (aspect du vent) — d'auteur (`MapRoute.seaHeading`), défaut est→ouest. */
  heading: WindDirection;
  weather: SeaWeather;
  windFrom: WindDirection;
  /** Jours en mer avant le prochain événement de bord (1d10, ch.15 l.89 — suspendu au port, l.19). */
  daysToEvent: number;
  /** Jours passés en mer (scorbut : Test par mois sans nourriture correcte, MDG 14 l.230). */
  daysAtSea: number;
  step: SeaStep;
  /** Lignes du jour (recap de la halte de nuit). */
  lines: string[];
  /** Milles parcourus AUJOURD'HUI (fixés par la Progression). */
  milesToday: number;
  /** Dérive mineure déjà vue (Repères : « sans effet la première fois », ch.13 l.318). */
  minorDrift?: boolean;
  /** Phare aperçu aujourd'hui → bonus d'Orientation (ch.13 l.335/351). */
  lighthouseDR?: number;
  /** Voiles affalées aujourd'hui (vents trop forts) : ancre jetée ou dérive à 25 % (ch.13 l.294). */
  sailsDown?: boolean;
  /** Verrou météo d'événement (Bruine / Beau temps / Ciel dégagé / Calme plat — ch.15). */
  weatherLock?: { days: number; weather: Partial<SeaWeather> };
  /** Vents inhabituels (ch.15) : le vent souffle à l'OPPOSÉ des dominants pendant N jours. */
  reversedWinds?: number;
  /** M modifié par événement (Vents favorables +1 — appliqué au jour). */
  eventMMod?: number;
  /** Infestation de rats ACTIVE (Test étendu d'Extermination, MDG 14 l.98 + événements ch.15). */
  infestation?: { label: string; difficulty: Difficulty; need: number; progress: number; spoilPerNight: string };
  crisis?: SeaCrisis;
  /** FORCER LE RYTHME (MDG 13 l.95-107) : bonus de M demandé au départ (+1 voile/avirons, +2 avirons). */
  forcePace?: number;
  /** Issue du Test de Voile/Ramer du JOUR (l.97) : 'won' → le +M s'applique aux milles du jour. Présent
   *  (won OU lost) = le rythme a été forcé → Test d'Épuisement Complexe (−10) au soir (l.111). */
  paceToday?: 'won' | 'lost';
}

/** Malus d'ENVIRONNEMENT (Précipitations, MDG 13 l.187-201) sur le Test de compétence `skillId` en
 *  cours, quand un voyage en mer est ACTIF — POINT UNIQUE consommé par `openSkillTest` (aucun écran
 *  ne relit `sea.weather` pour son propre Test : la modale générique porte le malus). `undefined` =
 *  rien à afficher (mod nul, hors voyage maritime, ou Test de Caractéristique sans `skillId`). */
export function seaWeatherTestMod(sea: SeaVoyageState | undefined, skillId?: string, spec?: string): { mod: number; label: string } | undefined {
  if (!sea || !skillId) return undefined;
  const mod = precipitationSkillMod(sea.weather.precipitations, skillId, spec);
  return mod ? { mod, label: precipitationDef(sea.weather.precipitations).label } : undefined;
}

const log = (get: Get, set: Set, lines: string[]) => {
  if (lines.length) set({ journal: [...get().journal.slice(-40), ...lines] });
};

/** Écrit au journal ET au recap du jour (mêmes lignes — patron travelFlow). */
function tell(get: Get, set: Set, lines: string[]): void {
  if (!lines.length) return;
  log(get, set, lines);
  const plan = get().travelPlan;
  if (plan?.sea) set({ travelPlan: { ...plan, sea: { ...plan.sea, lines: [...plan.sea.lines, ...lines] } } });
}

function patchSea(get: Get, set: Set, patch: Partial<SeaVoyageState>): void {
  const plan = get().travelPlan!;
  set({ travelPlan: { ...plan, sea: { ...plan.sea!, ...patch } } });
}

/** Humeur de Manann du navire de campagne (défaut : registre neuf). */
export function vesselManann(vessel: CampaignVessel | null): ManannMood {
  return vessel?.manann ?? { ...MANANN_BASE, applied: [...MANANN_BASE.applied] };
}

/** Le navire de campagne, ses données de type et sa COQUE de trajet (Blessures PERSISTÉES, #30). */
function voyageShip(get: Get): { vessel: CampaignVessel; hull: Combatant } | null {
  const vessel = get().vessel;
  if (!vessel) return null;
  const v = findVehicleById(vessel.vehicleId);
  if (!v?.ship) return null;
  const hull = vehicleCombatant(v);
  if (!hull) return null;
  // #30 : Blessures de coque persistantes — la coque de trajet REPART de l'état sauvegardé.
  if (vessel.wounds) hull.wounds = { ...hull.wounds, current: Math.min(vessel.wounds.current, hull.wounds.max) };
  hull.upgrades = vessel.upgrades ? [...vessel.upgrades] : undefined;
  return { vessel, hull };
}

/** PERSISTE les Blessures de la coque de trajet sur le navire de campagne (#30). */
export function persistHullWounds(get: Get, set: Set): void {
  const plan = get().travelPlan;
  const vessel = get().vessel;
  if (!plan?.vehicle || !vessel || plan.vehicle.creatureId !== vessel.vehicleId) return;
  set({ vessel: { ...vessel, wounds: { current: plan.vehicle.wounds.current, max: plan.vehicle.wounds.max } } });
}

/** Traits navals EFFECTIFS de la coque (type + Améliorations d'instance). */
function hullTraits(hull: Combatant) {
  const vd = findVehicleById(hull.creatureId ?? '')?.ship;
  return [...(vd?.traits ?? []), ...(hull.upgrades ?? [])];
}

/** M de VOYAGE du jour (ch.13/15) : M du gréement + Lissage (`navalMoveMod`) + Salissures + événement,
 *  puis EFFET DU VENT (%, Clinfoc — ch.13 l.274/ch.12 l.254). `null` = les voiles n'avancent pas
 *  (Encalminé / Affaler) — Propulsion à vapeur : M 4 constant, insensible au vent (ch.12 l.311). */
function effectiveSeaM(get: Get): { m: number | null; sail: boolean; label: string } {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  const hull = plan.vehicle!;
  const vd = findVehicleById(hull.creatureId ?? '')?.ship;
  const traits = hullTraits(hull);
  const vessel = get().vessel;
  if (shipHasNavalTrait(traits, 'propulsion-a-vapeur')) {
    return { m: 4, sail: false, label: 'vapeur (M 4, insensible au vent)' }; // MDG ch.12 l.311
  }
  const sail = !!vd?.sail;
  const fouling = foulingEffects(vessel?.fouling?.level ?? 0);
  // Forcer le rythme (MDG 13 l.95-107) : le bonus de M du jour n'est acquis que si le Test de
  // Voile/Ramer du jour a été RÉUSSI ('won' — posé par la boucle à l'étape Progression).
  const pace = sea.paceToday === 'won' ? sea.forcePace ?? 0 : 0;
  const baseM = (sail ? vd!.sail!.m : vd?.oars?.m ?? 0) + navalMoveMod(traits) + fouling.mMod + (sea.eventMMod ?? 0) + (vessel?.crabs ? -1 : 0) + pace;
  const aspect = windAspect(sea.heading, sea.windFrom);
  const cell = windEffect(sea.weather.vent, aspect, shipHasNavalTrait(traits, 'clinfoc'));
  const m = windAdjustedM(Math.max(0, baseM), cell, sail);
  const label = cell.encalmine && sail ? 'Encalminé' : cell.affaler && sail ? 'Affaler les voiles !' : `vent ${aspect}`;
  return { m, sail, label };
}

// ── Ouverture d'un Test d'équipage de VOYAGE (hors combat — l'équipage = les PJ) ────────────────

function openVoyageCrewTest(get: Get, set: Set, testTypeId: string, kind: string): boolean {
  const plan = get().travelPlan;
  const ship = plan?.vehicle;
  if (!ship) return false;
  const party = get().party.filter((h) => !h.dead && !h.outOfRencontre);
  if (!party.length) return false;
  ship.crewIds = party.map((h) => h.id); // les PJ tiennent les rôles (MDG 14 l.39)
  // Phare du port d'arrivée (kind 'phare') : « voir la lumière d'un phare » (MDG ch.13 l.337) est un Test
  // de Perception VISUEL — sens narratif posé ICI (ce call site précis, pas la donnée `perception` partagée
  // avec d'autres Tests d'équipage aussi remplaçables, MDG 14 l.82 : péril/terre/phare, pas tous visuels).
  // Le sens gate aussi le RANKING du marin représentant (#158), pas seulement la valeur de chaque participant.
  const sense = kind === 'phare' ? 'vue' : undefined;
  const contributors = crewTestContributors(ship, party, testTypeId, new Set(party.map((h) => h.id)), sense);
  if (!contributors.length) return false;
  const essentialRoleId = findCrewTestTypeById(testTypeId)?.essential;
  const participants: ShipManeuverParticipant[] = contributors.map((a) => ({
    id: a.crew.id,
    label: `${findCrewRoleById(a.roleId)?.label ?? a.roleId} — ${a.crew.name}`,
    interactive: true,
    roleId: a.roleId,
    essential: a.roleId === essentialRoleId,
    ...(sense ? { sense } : {}),
    result: null,
  }));
  set({
    pendingCrewTest: {
      shipId: ship.id, testTypeId, participants, essentialRoleId,
      moraleScore: shipMoraleScore(get, ship),
      voyage: { kind, shipName: ship.name },
    } satisfies PendingCrewTest,
  });
  return true;
}

/** Construit le TravelPlan d'une TRAVERSÉE (route `sea`) sur le navire de campagne — `null` si aucun
 *  navire (ou coque coulée). La coque de trajet repart des Blessures PERSISTÉES (#30). */
export function buildSeaPlan(
  get: Get, routeId: string, fromPlaceId: string, toPlaceId: string,
  route: { km: number; seaHeading?: WindDirection },
  opts: { pace?: number } = {},
): TravelPlan | null {
  const ship = voyageShip(get);
  if (!ship || ship.hull.wounds.current <= 0) return null;
  const rng = battleRng();
  const season = seasonOfMonth(toDate(get().gameTime).month);
  return {
    routeId, fromPlaceId, toPlaceId, mode: 'mer', hoursPerDay: 24, km: route.km, kmDone: 0, interrupted: false,
    vehicle: ship.hull,
    sea: {
      heading: route.seaHeading ?? 'ouest',
      weather: rollSeaWeather(season, rng), // graine du 1ᵉʳ jour (le cran de vent quotidien s'y accroche)
      windFrom: rollWindDirection(rng),
      daysToEvent: rollDaysToNextEvent(rng), // « Tous les 1d10 jours » (ch.15 l.89)
      daysAtSea: 0, step: 'meteo', lines: [], milesToday: 0,
      ...(opts.pace ? { forcePace: opts.pace } : {}), // Forcer le rythme (MDG 13 l.95-107)
    },
  };
}

// ── Boucle jour par jour ─────────────────────────────────────────────────────────────────────────

/** Boucle maritime — appelée par `runTravelDays` (plan `sea`), la reprise de nuit et la résolution des
 *  modales. AVANCE d'étape en étape ; se SUSPEND sur chaque Test d'équipage (modale) et sur la halte. */
export function runSeaDays(get: Get, set: Set): void {
  let guard = 0;
  while (guard++ < 200) {
    const plan = get().travelPlan;
    if (!plan?.sea || plan.interrupted || get().pendingCrewTest) return;
    const sea = plan.sea;
    const rng = battleRng();
    switch (sea.step) {
      case 'meteo': {
        // 1. Météo du jour (ch.13 l.164) + direction du vent (rose, l.250) — force du vent : celle de la
        // veille mise à jour (l.272, résumée en un cran par jour à l'échelle voyage) sinon tirage du jour.
        const season = seasonOfMonth(toDate(get().gameTime).month);
        let weather = rollSeaWeather(season, rng);
        weather = { ...weather, vent: tickWindForce(sea.weather?.vent ?? weather.vent, rng) };
        let windFrom = rollWindDirection(rng);
        // Verrous d'événement (Bruine / Beau temps / Ciel dégagé / Calme plat, ch.15).
        let lock = sea.weatherLock;
        if (lock && lock.days > 0) { weather = { ...weather, ...lock.weather }; lock = { ...lock, days: lock.days - 1 }; }
        if (lock && lock.days <= 0) lock = undefined;
        let reversed = sea.reversedWinds;
        if (reversed && reversed > 0) { windFrom = 'est'; reversed -= 1; } // dominants d'ouest inversés (ch.15)
        patchSea(get, set, { weather, windFrom, weatherLock: lock, reversedWinds: reversed, milesToday: 0, sailsDown: false, lighthouseDR: 0, eventMMod: sea.eventMMod, paceToday: undefined, step: 'affaler' });
        tell(get, set, [`Météo du jour : ${seaWeatherLabel(weather)} — vent de ${windFrom} (cap ${sea.heading}).`]);
        break;
      }
      case 'affaler': {
        // 2. Vents « Affaler les voiles » (ch.13 l.288) → Test d'équipage d'AFFALER (MDG 14 l.92-96, #65).
        const eff = effectiveSeaM(get);
        if (eff.sail && eff.m === null && eff.label.startsWith('Affaler')) {
          patchSea(get, set, { step: 'progression', sailsDown: true });
          tell(get, set, ['Les vents forcissent dangereusement : il faut affaler les voiles (MDG ch.13) !']);
          if (openVoyageCrewTest(get, set, 'affaler', 'affaler')) return; // suspension modale
          break;
        }
        patchSea(get, set, { step: 'progression' });
        break;
      }
      case 'progression': {
        // 3. Progression du jour (Test d'équipage, MDG 14 l.61-65 ; ±10 %/DR ch.15 l.78).
        let eff = effectiveSeaM(get);
        if (sea.sailsDown || eff.m === null) {
          // Encalminé (l.296) ou voiles affalées (l.294) : ancre si le navire en a une, sinon dérive à 25 %.
          const anchored = shipHasNavalTrait(hullTraits(plan.vehicle!), 'ancre');
          const drift = anchored ? 0 : Math.round(seaMilesPerDay(4, true) * (AFFALER_RULES.driftPctOfSpeed / 100));
          tell(get, set, [!sea.sailsDown
            ? `Encalminé — le bateau ne peut pas se déplacer grâce à ses voiles (MDG ch.13 l.296).${anchored ? ' L\'ancre est jetée.' : ` Le courant l'entraîne (${drift} milles).`}`
            : `Voiles affalées — ${anchored ? 'ancre jetée en attendant l\'accalmie.' : `le vent pousse le navire (${drift} milles, 25 % de la vitesse — l.294).`}`]);
          patchSea(get, set, { milesToday: 0, step: 'crise' });
          break;
        }
        // FORCER LE RYTHME (MDG 13 l.95-107) : Test de Voile/Ramer du jour AVANT la Progression —
        // « pour bénéficier du bonus de Mouvement, un Test de Voile ou de Ramer doit être réussi ».
        // Au niveau JOUR, UN Test représente la journée (même abstraction que la Progression) ; « ce
        // Test n'est pas un Test de Navigation » (l.97) → jet direct du meilleur PJ, soutenu (LDB 12).
        const vd = findVehicleById(plan.vehicle!.creatureId ?? '')?.ship;
        // Vapeur : M 4 constant, ni voiles ni avirons à forcer (MDG ch.12 l.311).
        if (sea.forcePace && sea.paceToday == null && (vd?.sail || vd?.oars) && !shipHasNavalTrait(hullTraits(plan.vehicle!), 'propulsion-a-vapeur')) {
          const rig: 'voile' | 'avirons' = vd?.sail ? 'voile' : 'avirons';
          const diff = forcePaceDifficulty(sea.forcePace, rig);
          const best = diff ? partyAssisted(get().party, rig === 'voile' ? 'voile' : 'ramer') : null;
          if (diff && best) {
            const t = rollTest(best.value, diff, rng);
            patchSea(get, set, { paceToday: t.success ? 'won' : 'lost' });
            tell(get, set, [`${best.actor.name} — Forcer le rythme (${rig === 'voile' ? 'Voile' : 'Ramer'} ${DIFFICULTY_LABELS[diff]}) : ${t.roll}/${t.target} → ${t.success ? `+${sea.forcePace} M aujourd'hui.` : 'le navire garde son allure.'}`]);
            eff = effectiveSeaM(get); // le +M du jour entre dans le M effectif
          }
        }
        patchSea(get, set, { step: 'crise' });
        tell(get, set, [`${plan.vehicle!.name} fait route (${eff.label}, M effectif ${eff.m}).`]);
        if (openVoyageCrewTest(get, set, 'progression', 'progression')) return;
        // Sans équipage apte au Test : progression sans DR.
        applySeaProgress(get, set, 0);
        break;
      }
      case 'crise': {
        // 6. Crise en cours : une manche par jour... non — une manche par MODALE, la boucle y reste
        // jusqu'à l'issue (Poursuite ch.13 l.354 : Tests tous les 10 Rounds ×10 ; Tourbillon l.514).
        if (!sea.crisis) { patchSea(get, set, { step: 'perception' }); break; }
        if (sea.crisis.kind === 'poursuite') {
          if (openVoyageCrewTest(get, set, 'progression-poursuite', 'poursuite')) return;
        } else if (openVoyageCrewTest(get, set, 'manoeuvre', 'tourbillon')) return;
        patchSea(get, set, { step: 'perception', crisis: undefined }); // pas d'équipage → la crise se dénoue au récit
        break;
      }
      case 'perception': {
        // 4. Phare du port d'arrivée en vue (dernier jour de mer) → Test d'équipage de PERCEPTION (#65).
        const milesLeft = plan.km - plan.kmDone - sea.milesToday;
        const dest = get().worldMap ? placeById(get().worldMap!, plan.toPlaceId) : undefined;
        const lighthouse = dest?.port?.lighthouse;
        patchSea(get, set, { step: 'orientation' });
        if (lighthouse && milesLeft <= 15 && lighthouseSpotDifficulty(Math.max(1, Math.round(milesLeft))) != null) {
          tell(get, set, [`${dest!.label} : un phare veille sur l'approche — la vigie scrute l'horizon (MDG ch.13 l.337).`]);
          if (openVoyageCrewTest(get, set, 'perception', 'phare')) return;
        }
        break;
      }
      case 'orientation': {
        // 5. Orientation quotidienne (« un Test par jour de voyage », ch.13 l.311) → Repères (#65).
        // Carte marine (MDG 15 l.290) : +2 DR si un héros la porte — règle éditable `sea-chart-orientation-dr`
        // (simplification maison « toute route », faute d'un graphe de ports pour les 2 ports désignés).
        patchSea(get, set, { step: 'extermination' });
        const chartDR = get().party.some((h) => h.items?.some((it) => it.trappingId === 'carte-marine'))
          ? Number(rule('sea-chart-orientation-dr')) : 0;
        const opened = chartDR > 0
          ? openVoyageCrewTestWithExtra(get, set, 'orientation', 'orientation', chartDR)
          : openVoyageCrewTest(get, set, 'orientation', 'orientation');
        if (opened) return;
        break;
      }
      case 'extermination': {
        // 7. Infestation active : un Test étendu d'EXTERMINATION par jour (1d10 h, MDG 14 l.100 ; #65).
        patchSea(get, set, { step: 'events' });
        if (sea.infestation && openVoyageCrewTest(get, set, 'extermination-nuisibles', 'extermination')) return;
        break;
      }
      case 'events': {
        // 8. Événement de bord tous les 1d10 jours (ch.15 l.89).
        let days = sea.daysToEvent - 1;
        if (days <= 0) {
          const mood = vesselManann(get().vessel);
          const { roll, event } = rollBoardEvent(mood.score, rng);
          tell(get, set, [`Événement de bord (d100 ${roll} · Humeur de Manann ${mood.score >= 0 ? '+' : ''}${mood.score}) — ${event.label}`]);
          resolveBoardEvent(get, set, event, rng);
          days = rollDaysToNextEvent(rng);
        }
        patchSea(get, set, { daysToEvent: days, step: 'entretien' });
        break;
      }
      case 'entretien': {
        // 9a. Coque endommagée → Test d'équipage d'ENTRETIEN (remplace le Métier à −2 DR, MDG 14
        // l.116-124 ; réparation TEMPORAIRE en mer : 1 h, 1d10 Blessures — ch.13 l.647). #65.
        patchSea(get, set, { step: 'nuit' });
        const hull = plan.vehicle!;
        if (hull.wounds.current < hull.wounds.max) {
          tell(get, set, [`${hull.name} accuse ${hull.wounds.max - hull.wounds.current} Blessure(s) — l'équipage s'affaire aux réparations du soir (MDG 14 l.116).`]);
          if (openVoyageCrewTest(get, set, 'entretien', 'entretien')) return;
        }
        break;
      }
      case 'nuit': {
        finishSeaDay(get, set, rng);
        return; // halte de nuit (openRest) ou arrivée : la boucle reprend au matin / s'arrête
      }
    }
  }
}

/** Applique les MILLES du jour depuis le total du Test de Progression (±10 %/DR, ch.15 l.78). */
function applySeaProgress(get: Get, set: Set, progressionDR: number): void {
  const plan = get().travelPlan!;
  const eff = effectiveSeaM(get);
  if (eff.m == null || plan.sea!.sailsDown) { patchSea(get, set, { milesToday: 0 }); return; }
  // Nuit : équipage nominal requis, sinon ÷2 (MDG 15 l.76) — équipage abstrait (MDG 14 l.39, cf. l.27).
  const miles = Math.round(seaMilesPerDay(eff.m, true, progressionDR));
  patchSea(get, set, { milesToday: miles, eventMMod: undefined }); // « Vents favorables » : +1 M consommé sur UNE journée de route
  tell(get, set, [`Progression du jour : ${miles} milles (DR d'équipage ${progressionDR >= 0 ? '+' : ''}${progressionDR}).`]);
}

/** Fin de journée : eau & scorbut (ch.14), Salissures hebdo (ch.13 l.148), horloge +24 h, entretien
 *  quotidien, arrivée (événement de port) ou halte de nuit. */
function finishSeaDay(get: Get, set: Set, rng: RNG): void {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  const lines: string[] = [];

  // Nuit : l'infestation gâte la cargaison (ch.15, événements Infestation).
  if (sea.infestation) {
    const vessel = get().vessel;
    if (vessel?.cargo?.length) {
      const spoil = rollDice(1, 10, rng) * (sea.infestation.spoilPerNight.startsWith('3') ? 3 : 1);
      const first = vessel.cargo[0];
      const r = removeCargo(vessel.cargo, first.cargoId, spoil);
      set({ vessel: { ...vessel, cargo: r.lots } });
      if (r.removed) lines.push(`Les rats gâtent ${r.removed} Enc de cargaison pendant la nuit.`);
    } else lines.push('Les rats rôdent dans la cale (rien à gâter — pour l\'instant).');
  }

  // Eau douce (ch.13 l.209-213 + ch.14 l.242) : consommation par bande de Température, si le navire
  // suit ses tonneaux (`vessel.waterLitres`). La Soif elle-même suit la décision de périmètre de
  // `provisions.ts` (volet Soif non simulé) : à sec, on AVERTIT.
  const vessel0 = get().vessel;
  if (vessel0?.waterLitres != null) {
    const crew = get().party.filter((h) => !h.dead).length;
    const need = crew * dailyWaterLitres(sea.weather.temperature);
    const left = Math.max(0, vessel0.waterLitres - need);
    set({ vessel: { ...vessel0, waterLitres: left } });
    lines.push(left > 0 ? `Eau douce : −${need} L (reste ${left} L).` : 'Les tonneaux d\'eau douce sont À SEC — trouvez de l\'eau (MDG ch.14).');
  }

  // Scorbut (MDG 14 l.230) : « pour chaque mois passé sans nourriture correcte » — Test de Résistance
  // Intermédiaire (+0), Facile (+40) avec la soupe de chou fermenté. Les rations de bord ne sont pas
  // de la nourriture fraîche → le mois EN MER compte.
  const daysAtSea = sea.daysAtSea + 1;
  if (daysAtSea % 30 === 0) {
    for (const h of get().party) {
      if (h.dead || (h.diseases ?? []).some((d) => d.name === 'scorbut')) continue;
      const soup = (h.items ?? []).some((it) => itemCapability(it, 'scurvyGuard'));
      const t = rollTest(testValue(h, 'resistance', 'E'), soup ? 'facile' : 'intermediaire', rng);
      lines.push(`${h.name} — scorbut (un mois en mer${soup ? ', soupe de chou' : ''}) : ${t.roll}/${t.target} → ${t.success ? 'tient bon.' : 'CONTRACTÉ.'}`);
      if (!t.success) {
        const d = contractDisease('scorbut', rng); // maladies.json — cycle/symptômes par la machinerie EXISTANTE
        if (d) h.diseases = [...(h.diseases ?? []), d];
      }
    }
    set({ party: [...get().party] });
  }

  // Salissures hebdomadaires (ch.13 l.148) : « chaque semaine qu'un navire passe en mer sans
  // l'entretien approprié » — Test de Résistance du vaisseau, raté → +1 niveau.
  const week = Math.floor(dayIndex(get().gameTime) / 7);
  const vessel1 = get().vessel;
  if (vessel1 && week > (vessel1.fouling?.lastWeek ?? -1) && daysAtSea >= 7) {
    const hullE = findVehicleById(vessel1.vehicleId)?.hull?.char.E ?? 40;
    const r = rollWeeklyFouling(hullE, vessel1.fouling?.level ?? 0, rng);
    set({ vessel: { ...get().vessel!, fouling: { level: r.level, lastWeek: week } } });
    if (r.gained) lines.push(`Salissures : la coque s'encrasse (niveau ${r.level} — ${foulingEffects(r.level).desc})`);
  }

  // Horloge : à l'ARRIVÉE au port, la journée entière passe (+24 h) — l'entretien du jour est rattrapé
  // par le prochain `runDailyUpkeep` (garde `lastUpkeepDay`). Sinon (HALTE de nuit / activités en mer)
  // la traversée s'arrête au crépuscule et la nuit de sommeil enjambe minuit : UN SEUL franchissement de
  // jour par cycle jour+nuit (comme le voyage terrestre). L'ENTRETIEN (rations/faim, maladies,
  // convalescence) n'est jamais roulé ici (sinon la Faim s'installe avant le repas) : il se résout dans
  // la cascade de nuit (`buildNightCascade`), APRÈS `feedFromMeal`.
  const arrived = plan.km - Math.min(plan.km, plan.kmDone + sea.milesToday) < 1e-9;
  const dayMinutes = arrived ? 24 * 60 : minutesUntilNext(get().gameTime, DUSK_MINUTE);
  set({ gameTime: get().gameTime + dayMinutes });
  bus.emit(EVT.TIME_ADVANCED, { minutes: dayMinutes });
  const evening: string[] = [];

  // TEMPÉRATURE (MDG 13 l.203-225) : Tests d'Exposition du jour à la cadence de la bande. Le jour de
  // voyage ne se simule pas heure par heure — la période EXPOSÉE = une Période de travail sur le pont
  // (8 h, l.107) → `seaExposureTestsPerDay` (bandes 4 h → 2 Tests, 2 h → 4), Résistance à la
  // Difficulté RAW de la bande. Froid : cascade UNIQUE d'`engine/exposure` (manteau −10, peau de
  // phoque +1 DR — MDG 14 l.277) ; chaleur : cascade LDB 18 l.330. Appliqué APRÈS l'entretien (les
  // pénalités de la veille, échues à 24 h, viennent d'être purgées — pas de double-empilement).
  const tdef = temperatureDef(sea.weather.temperature);
  const expCount = seaExposureTestsPerDay(sea.weather.temperature);
  if (tdef.exposure && expCount > 0) {
    for (const h of get().party) {
      if (h.dead) continue;
      const r = exposureNight(h, expCount, testValue(h, 'resistance', 'E'), rng, { kind: tdef.exposure, difficulty: tdef.difficulty });
      evening.push(`${h.name} — Exposition (${tdef.label}, ${expCount} Test${expCount > 1 ? 's' : ''} de Résistance ${DIFFICULTY_LABELS[tdef.difficulty ?? 'intermediaire']}) : ${r.rolls.map((x) => `${x.roll}/${x.target}`).join(' · ')}${r.failures ? '' : ' — tient le coup.'}`);
      evening.push(...r.log);
      expireExposureEffects(h, get().gameTime + MINUTES_PER_DAY); // dissipation après 24 h (purge #T3)
    }
    set({ party: [...get().party] });
  }

  // ÉPUISEMENT (MDG 13 l.109-111) : le rythme a été FORCÉ aujourd'hui (réussi OU non) → chaque PJ
  // (l'équipage = les PJ, MDG 14 l.39) teste Résistance Complexe (−10) sous peine d'Exténué. Le Test
  // de base des Périodes de travail (Accessible +20) est absorbé par l'abstraction d'équipage PNJ —
  // il n'est joué que quand le joueur CHOISIT de forcer (décision documentée).
  if (sea.paceToday) {
    const diff = exhaustionDifficulty(true);
    for (const h of get().party) {
      if (h.dead) continue;
      const t = rollTest(testValue(h, 'resistance', 'E'), diff, rng);
      evening.push(`${h.name} — Épuisement (rythme forcé, Résistance ${DIFFICULTY_LABELS[diff]}) : ${t.roll}/${t.target} → ${t.success ? 'tient bon.' : '+1 Exténué.'}`);
      if (!t.success) addCondition(h, 'extenue');
    }
    set({ party: [...get().party] });
  }

  const miles = sea.milesToday;
  const kmDone = Math.min(plan.km, plan.kmDone + miles);
  patchSea(get, set, { daysAtSea, step: 'meteo', lines: [] });
  set({ travelPlan: { ...get().travelPlan!, kmDone } });
  persistHullWounds(get, set);
  tell(get, set, [...lines, ...evening]);

  const worldMap = get().worldMap as WorldMap;
  const to = placeById(worldMap, plan.toPlaceId);
  const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: kmDone, hours: 24, lines: [...sea.lines, ...lines, ...evening] };

  if (plan.km - kmDone < 1e-9 && to) {
    // ARRIVÉE : événement de port (2d10 ± Humeur, ch.15 l.127-129) puis transition. La distance de la
    // traversée est NOTÉE sur le navire (vente à un port producteur : « plus de 100 milles », l.366).
    set({ travelPlan: null, ...(get().vessel ? { vessel: { ...get().vessel!, lastVoyageMilles: plan.km } } : {}) });
    log(get, set, [`— Accostage à ${to.label} —`]);
    resolvePortArrival(get, set, to.port, battleRng());
    get().transitionTo(to.scene, to.entry);
    return;
  }
  // ACTIVITÉS EN MER (MDG 15 l.266-272) : « Pour chaque semaine (8 jours) de voyage en mer, chaque
  // Personnage a l'occasion d'effectuer une Activité » — la 8ᵉ journée révolue ouvre le choix (modale),
  // la halte de nuit suit à la confirmation (le recap du jour lui est transmis).
  if (daysAtSea > 0 && daysAtSea % 8 === 0) {
    set({ pendingSeaActivities: { picks: {}, day: recapDay } });
    return;
  }
  // Halte de nuit (machinerie de repos EXISTANTE — le recap du jour s'y lit, patron travelFlow).
  openRest(get, set, { places: placesOfKind('camp'), travelHalt: true, travelDay: recapDay });
}

// ── Résolution des Tests d'équipage de VOYAGE (appelée par crewTestConfirm) ──────────────────────

/** Issue d'un Test d'équipage de voyage : dispatch par `voyage.kind`, puis la boucle reprend. */
export function resolveVoyageCrewTest(get: Get, set: Set, p: PendingCrewTest, total: number): void {
  const plan = get().travelPlan;
  if (!plan?.sea) return;
  const sea = plan.sea;
  const rng = battleRng();
  const kind = p.voyage!.kind;
  const success = total >= 1; // « Si le total est de 1 DR ou plus, le résultat global est un succès » (MDG 14 l.13)

  switch (kind) {
    case 'progression': {
      applySeaProgress(get, set, total);
      // PANNE DE VAPEUR (MDG ch.12 l.313) : sur un navire à Propulsion à vapeur, les Tests du bord
      // sont des Tests de Métier (Ingénieur) — « un double sur un Test … raté » ou un Échec Stupéfiant
      // déclenche le tableau. On lit les JETS INDIVIDUELS du Test d'équipage (chaque marin a lancé).
      const hull = plan.vehicle;
      if (hull && shipHasNavalTrait(hullTraits(hull), 'propulsion-a-vapeur')) {
        const triggered = p.participants.some((x) => x.result
          && steamBreakdownTriggered({ success: x.result.roll <= x.result.target, sl: x.result.sl, isDouble: isDoubleRoll(x.result.roll) }));
        if (triggered) {
          const b = rollSteamBreakdown(rng);
          tell(get, set, [`PANNE DE VAPEUR — ${b.label} (MDG ch.12 l.313).`, b.desc]);
          if (b.mSet != null || b.mMod) patchSea(get, set, { milesToday: b.mSet === 0 ? 0 : Math.max(0, Math.round((get().travelPlan?.sea?.milesToday ?? 0) * (1 + (b.mMod ?? 0) / 4))) });
          if (b.hullCritical) { const c = rollShipCritical('coque', rng); applyVesselCritical(get, set, c.log, c.note); }
          if (b.engineDestroyed && get().vessel) {
            // Moteur détruit : l'Amélioration saute (elle devra être ré-installée au chantier).
            set({ vessel: { ...get().vessel!, upgrades: (get().vessel!.upgrades ?? []).filter((u) => u.id !== 'propulsion-a-vapeur') } });
          }
        }
      }
      break;
    }
    case 'affaler': {
      if (success) tell(get, set, ['Les voiles sont affalées à temps (MDG ch.13 l.292).']);
      else {
        // « En cas d'échec, le bateau subit immédiatement un Critique sur ses voiles » (l.292).
        const crit = rollShipCritical(AFFALER_RULES.failCritLocation as ShipCritKey, rng);
        applyVesselCritical(get, set, crit.log, crit.note);
      }
      break;
    }
    case 'orientation': {
      const dr = total + (sea.lighthouseDR ?? 0);
      const out = orientationOutcome(dr, !!sea.minorDrift);
      tell(get, set, [`Orientation (DR ${dr >= 0 ? '+' : ''}${dr}${sea.lighthouseDR ? `, phare +${sea.lighthouseDR}` : ''}) : ${out.desc}`]);
      if (out.outcome === 'drift-minor') patchSea(get, set, { minorDrift: true });
      if (out.rollCourseChange) {
        const cc = rollCourseChange(rng, out.courseChangeBonus);
        tell(get, set, [`Changement de cap (d10 ${cc.roll}, dérive ${cc.side}) : ${cc.desc}`]);
        const plan2 = get().travelPlan!;
        const remaining = plan2.km - plan2.kmDone;
        if (cc.effect === 'retard') set({ travelPlan: { ...plan2, km: plan2.km + remaining * (cc.delayPct / 100) } });
        if (cc.effect === 'demi-tour') set({ travelPlan: { ...plan2, kmDone: Math.max(0, plan2.kmDone - (plan2.sea?.milesToday ?? 0)) } });
        // quart-de-tour : cap perpendiculaire — le vent de demain se lira sur le nouveau cap.
        if (cc.effect === 'quart-de-tour') {
          const turn: Record<WindDirection, WindDirection> = { nord: cc.side === 'tribord' ? 'est' : 'ouest', sud: cc.side === 'tribord' ? 'ouest' : 'est', est: cc.side === 'tribord' ? 'sud' : 'nord', ouest: cc.side === 'tribord' ? 'nord' : 'sud' };
          patchSea(get, set, { heading: turn[sea.heading] });
        }
      }
      break;
    }
    case 'phare': {
      // Réussite → bonus d'Orientation : Savoir (Océans) du meilleur navigateur (l.335).
      const best = partyAssisted(get().party, 'orientation');
      const dr = success && best ? Math.max(1, lighthouseOrientationDR(best.actor, false), savoirOceansBonus(best.actor)) : 0;
      patchSea(get, set, { lighthouseDR: dr });
      tell(get, set, [success ? `La lumière du phare est en vue — l'atterrage se précise (+${dr} DR d'Orientation, MDG ch.13 l.335).` : 'Aucune lumière à l\'horizon — brume ou distance.']);
      break;
    }
    case 'poursuite': {
      if (sea.crisis?.kind !== 'poursuite') break;
      const c = sea.crisis;
      const eff = effectiveSeaM(get);
      const myM = eff.m ?? 1;
      const foe = rollTest(c.foeSkill, 'intermediaire', rng);
      const gain = pursuitDistanceGain(myM, total + pursuitLowMPenalty(myM)) - pursuitDistanceGain(c.foeM, foe.sl + pursuitLowMPenalty(c.foeM));
      const distance = c.distance + gain;
      tell(get, set, [`Poursuite — ${c.label} : ${gain >= 0 ? 'le navire creuse l\'écart' : 'le poursuivant gagne du terrain'} (${gain >= 0 ? '+' : ''}${gain} → Distance ${distance}/${c.escapeAt}).`]);
      // Issue = primitive PARTAGÉE avec la poursuite terrestre (engine/pursuit) : seuils identiques, calcul de gain propre au naval (mètres, MDG ch.13).
      const outcome = pursuitOutcome(distance, c.escapeAt);
      if (outcome === 'escaped') {
        patchSea(get, set, { crisis: undefined });
        tell(get, set, ['Le poursuivant abandonne : le navire s\'est échappé (MDG ch.13 l.362).']);
      } else if (outcome === 'caught') {
        patchSea(get, set, { crisis: undefined });
        tell(get, set, ['Rattrapés ! « une collision, suivie d\'un abordage déterminé, est malheureusement inévitable » (MDG ch.13 l.420).']);
        startChaseBoarding(get, set);
      } else {
        patchSea(get, set, { crisis: { ...c, distance } });
      }
      break;
    }
    case 'tourbillon': {
      if (sea.crisis?.kind !== 'tourbillon') break;
      const c = sea.crisis;
      const w = findWhirlpool(c.whirlpoolId)!;
      const progress = c.progress + Math.max(0, total + w.manDR);
      // Chaque manche au centre coûte des Dégâts de collision (IC du Tourbillon, l.526).
      const hull = get().travelPlan!.vehicle!;
      const dmg = Math.max(0, w.ic - Math.floor((hull.characteristics?.E ?? 0) / 10));
      hull.wounds.current = Math.max(0, hull.wounds.current - dmg);
      persistHullWounds(get, set);
      tell(get, set, [`${w.label} : l'eau tournoyante broie la coque (${dmg} Blessures) — évasion ${progress}/${c.need} DR.`]);
      if (progress >= c.need) {
        patchSea(get, set, { crisis: undefined });
        tell(get, set, ['Le navire s\'arrache du Tourbillon (Test étendu d\'Évasion accompli, MDG ch.13 l.528).']);
      } else patchSea(get, set, { crisis: { ...c, progress } });
      break;
    }
    case 'extermination': {
      if (!sea.infestation) break;
      const inf = sea.infestation;
      const progress = inf.progress + Math.max(0, total);
      set({ gameTime: get().gameTime + rollDice(1, 10, rng) * 60 }); // « Chaque Test nécessite … 1d10 heures » (MDG 14 l.100)
      if (progress >= inf.need) {
        patchSea(get, set, { infestation: undefined });
        tell(get, set, [`${inf.label} : la vermine est exterminée (${progress}/${inf.need} DR).`]);
      } else {
        patchSea(get, set, { infestation: { ...inf, progress } });
        tell(get, set, [`${inf.label} : la purge avance (${progress}/${inf.need} DR).`]);
      }
      break;
    }
    case 'entretien': {
      // Le Test d'équipage REMPLACE le Métier à −2 DR (MDG 14 l.122) → réparation temporaire (ch.13 l.647).
      const adj = total + REPARATION.entretienCrewTestDR;
      if (adj >= 1) {
        const hull = get().travelPlan!.vehicle!;
        const healed = Math.min(hull.wounds.max - hull.wounds.current, rollDice(1, 10, rng));
        hull.wounds.current += healed;
        persistHullWounds(get, set);
        tell(get, set, [`Réparations de fortune : +${healed} Blessures de coque (Entretien ${adj >= 0 ? '+' : ''}${adj} DR après −2, MDG 14 l.122).`]);
      } else tell(get, set, [`Les réparations n'aboutissent pas cette nuit (Entretien ${adj} DR après −2).`]);
      break;
    }
  }
  runSeaDays(get, set); // la boucle reprend à l'étape suivante
}

/** Rattrapé par un navire hostile : combat si la route porte une embuscade AUTHORÉE (patron travelFlow) —
 *  sinon l'issue reste au récit (rien d'inventé). */
function startChaseBoarding(get: Get, set: Set): void {
  const plan = get().travelPlan;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan?.routeId);
  if (route?.ambush?.scene && route.ambush.encounter) {
    // Même pipeline que l'embuscade terrestre (« Attaqués ! ») : interruption + scène + rencontre AUTHORÉES.
    set({ travelPlan: { ...plan!, interrupted: true } });
    get().transitionTo(route.ambush.scene, route.ambush.entry);
    get().startCombat(route.ambush.encounter, undefined, { noSurprise: true }); // la Poursuite a prévenu : pas de Surprise
  } else {
    tell(get, set, ['(Aucune rencontre d\'abordage n\'est configurée sur cette route — l\'issue reste au récit.)']);
  }
}

/** Critique de navire au VOYAGE : Blessures non chiffrées par la table (les effets sont l'entrée) →
 *  l'entrée est PERSISTÉE sur le navire (`vessel.criticals`) et racontée ; ses effets mécaniques fins
 *  s'appliquent quand la coque redevient un combattant (combat naval). */
function applyVesselCritical(get: Get, set: Set, logLine: string, note: string): void {
  const vessel = get().vessel;
  if (vessel) set({ vessel: { ...vessel, criticals: [...(vessel.criticals ?? []), note] } });
  tell(get, set, [`${logLine}`, `→ ${note}`]);
}

// ── Événements de bord (ch.15 l.132-236) — application MÉCANIQUE par `kind` ─────────────────────

/** Lit un paramètre de `SeaEventDef.params` : nombre direct, ou dé « NdM » roulé (ex. "2d10") — PARTAGÉ
 *  par les événements de BORD (`resolveBoardEvent`) et de PORT (`resolvePortArrival`), même format de
 *  donnée (`sea-events.json`). PUR (hors le jet lui-même, via `rng` injecté). */
function eventParam(event: SeaEventDef, k: string, rng: RNG, dflt = 0): number {
  const v = (event.params ?? {})[k];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const d = /(\d+)d10/.exec(v); if (d) return rollDice(parseInt(d[1], 10), 10, rng); const n = parseInt(v, 10); if (!isNaN(n)) return n; }
  return dflt;
}

function resolveBoardEvent(get: Get, set: Set, event: SeaEventDef, rng: RNG): void {
  const num = (k: string, dflt = 0): number => eventParam(event, k, rng, dflt);
  tell(get, set, [event.desc]);
  const vessel = get().vessel;
  const ship = get().travelPlan?.vehicle;
  switch (event.kind) {
    case 'usure': {
      if (!ship) break;
      const w = num('wounds', rollDice(1, 10, rng)) || rollDice(1, 10, rng);
      ship.wounds.current = Math.max(0, ship.wounds.current - w);
      persistHullWounds(get, set);
      tell(get, set, [`${ship.name} perd ${w} Blessures (usure).`]);
      break;
    }
    case 'coup-critique': {
      const locs: ShipCritKey[] = ['greement', 'coque', 'avirons', 'equipements', 'cargaison'];
      const crit = rollShipCritical(locs[rng.int(0, locs.length - 1)] as ShipCritKey, rng);
      applyVesselCritical(get, set, crit.log, crit.note);
      break;
    }
    case 'ouragan': {
      // Test d'équipage d'Affaler Difficile (−20) sinon 3 Critiques au Gréement — l'échec du Test
      // d'équipage se joue en MODALE (le −20 RAW est porté par extraDR).
      const pend = openVoyageCrewTestWithExtra(get, set, 'affaler', 'ouragan', -2);
      if (!pend) for (let i = 0; i < 3; i++) { const c = rollShipCritical('greement', rng); applyVesselCritical(get, set, c.log, c.note); }
      break;
    }
    case 'infestation': {
      const need = num('totalDR', 10);
      patchSea(get, set, {
        infestation: {
          label: event.label, difficulty: 'intermediaire', need, progress: 0,
          spoilPerNight: String((event.params as Record<string, unknown> | undefined)?.spoilEncPerNight ?? '1d10'),
        },
      });
      break;
    }
    case 'penurie-nourriture': {
      // « La moitié des provisions à bord sont gâtées. »
      let spoiled = 0;
      for (const h of get().party) {
        const rations = (h.items ?? []).filter(isRation);
        const toSpoil = Math.floor(rations.length / 2);
        for (let i = 0; i < toSpoil; i++) { const idx = h.items!.findIndex(isRation); if (idx >= 0) { h.items!.splice(idx, 1); spoiled++; } }
      }
      set({ party: [...get().party] });
      tell(get, set, [`${spoiled} ration(s) moisie(s) jetée(s) par-dessus bord.`]);
      break;
    }
    case 'presage': {
      // params : `manannD10` / `moraleD10` = compte SIGNÉ de d10 à rouler (ch.15 : Figure de proue
      // prophétique −1d10 Moral ; Présages divins ±2d10 Humeur ±1d10 Moral, gatés par un Test de Prière).
      const manannD = typeof (event.params?.manannD10) === 'number' ? (event.params!.manannD10 as number) : 0;
      const moraleD = typeof (event.params?.moraleD10) === 'number' ? (event.params!.moraleD10 as number) : 0;
      const pd = event.params?.prayerDifficulty as Difficulty | undefined;
      let apply = true;
      if (pd) {
        const priest = partyAssisted(get().party, 'priere');
        if (priest) {
          const t = rollTest(priest.value, pd, rng);
          tell(get, set, [`${priest.actor.name} — Prière : ${t.roll}/${t.target} → ${t.success ? 'Manann est apaisé/honoré.' : 'la prière se perd dans les embruns.'}`]);
          apply = manannD >= 0 ? t.success : !t.success; // bon présage : il faut réussir ; mauvais : réussir l'évite
        }
      }
      if (apply) {
        if (manannD) tellManann(get, set, manannD);
        if (moraleD && ship) {
          const delta = Math.sign(moraleD) * rollDice(Math.abs(moraleD), 10, rng);
          for (const l of applyShipMoraleDelta(get, set, ship, delta)) tell(get, set, [l]);
        }
      }
      break;
    }
    case 'bonne-humeur': {
      if (ship) for (const l of applyShipMoraleDelta(get, set, ship, rollDice(2, 10, rng))) tell(get, set, [l]);
      break;
    }
    case 'calme-plat':
      patchSea(get, set, { weatherLock: { days: num('days', d10(rng)), weather: { vent: 'calme-plat' } } });
      break;
    case 'bruine':
      patchSea(get, set, { weatherLock: { days: num('days', d10(rng)), weather: { visibilite: 'brume', precipitations: 'legeres' } } });
      break;
    case 'beau-temps':
      patchSea(get, set, { weatherLock: { days: num('days', d10(rng)), weather: { temperature: 'mediane' } } });
      break;
    case 'ciel-degage':
      patchSea(get, set, { weatherLock: { days: num('days', d10(rng)), weather: { visibilite: 'degage', precipitations: 'aucune' } } });
      break;
    case 'vents-inhabituels':
      patchSea(get, set, { reversedWinds: num('days', d10(rng)) });
      break;
    case 'vents-favorables':
      patchSea(get, set, { eventMMod: (get().travelPlan?.sea?.eventMMod ?? 0) + 1 });
      break;
    case 'crabes-boxeurs':
      if (vessel) set({ vessel: { ...vessel, crabs: true } });
      break;
    case 'collision': {
      // « le bateau se heurte à un rocher » (Rocher IC 47, ch.13 l.497) : Dégâts = IC + M, − BE de coque.
      if (!ship) break;
      const eff = effectiveSeaM(get);
      const dmg = Math.max(0, 47 + (eff.m ?? 1) - Math.floor((ship.characteristics?.E ?? 0) / 10));
      ship.wounds.current = Math.max(0, ship.wounds.current - dmg);
      persistHullWounds(get, set);
      tell(get, set, [`Collision : la coque encaisse ${dmg} Blessures (Rocher IC 47, MDG ch.13 l.446/497).`]);
      if (d100(rng) <= 20) { // 20 % d'Échouage (l.497)
        const plan2 = get().travelPlan!;
        set({ travelPlan: { ...plan2, km: plan2.km + 0 }, gameTime: get().gameTime + 24 * 60 });
        tell(get, set, ['Le navire s\'ÉCHOUE sur le rocher — une journée de manœuvres pour le dégager (Test de Force, ch.13 l.473).']);
      }
      break;
    }
    case 'maelstrom':
    case 'vortex': {
      const w = findWhirlpool(event.kind === 'maelstrom' ? 'maelstrom' : 'puissant-vortex')!;
      patchSea(get, set, { crisis: { kind: 'tourbillon', label: event.label, whirlpoolId: w.id, need: w.evasion.totalDR, progress: 0 } });
      tell(get, set, [`${w.label} : Évasion = Test étendu de Manœuvre pour ${w.evasion.totalDR} DR (MDG ch.13 l.528).`]);
      break;
    }
    case 'navire-hostile':
    case 'nemesis': {
      // Fuite = COURSE-POURSUITE (ch.13 l.354) : le seuil d'évasion suit la visibilité du jour (l.364-370).
      const sea = get().travelPlan!.sea!;
      const escapeAt = sea.weather.visibilite === 'degage' ? 100 : sea.weather.visibilite === 'brume' ? 50 : 10;
      const foeM = event.kind === 'nemesis' ? 6 : 5;
      patchSea(get, set, {
        crisis: { kind: 'poursuite', label: event.label, distance: Math.floor(escapeAt / 2), escapeAt, foeM, foeSkill: 50, desc: event.desc },
      });
      tell(get, set, [`Le navire prend la fuite — Poursuite (Distance de départ ${Math.floor(escapeAt / 2)}, évasion à ${escapeAt} — MDG ch.13 l.362-370).`]);
      break;
    }
    case 'debris-cargaison':
    case 'epave-cargaison': {
      if (!vessel) break;
      const enc = rollDice(event.kind === 'epave-cargaison' ? 2 : 1, 100, rng);
      set({ vessel: { ...vessel, cargo: [...(vessel.cargo ?? []), { cargoId: 'bois', enc, basePriceGold: 0 }] } });
      tell(get, set, [`${enc} Enc de cargaison repêchée (à faire évaluer au port).`]);
      break;
    }
    case 'chance-navigateur': {
      // « Le capitaine gagne 1 niveau du Talent Chanceux pour les 1d10 prochains jours. »
      const captain = partyAssisted(get().party, 'commandement');
      if (captain) {
        const until = get().gameTime + num('days', d10(rng)) * 24 * 60;
        for (const l of applyOps(captain.actor, [{ op: 'grantTalent', talentId: 'chanceux' }], { label: event.label, rng, defaultUntilTime: until })) tell(get, set, [l]);
        set({ party: [...get().party] });
      }
      break;
    }
    case 'rafale-ghyran': {
      const until = get().gameTime + num('days', d10(rng)) * 24 * 60;
      for (const h of get().party) {
        if (h.dead) continue;
        applyOps(h, [
          { op: 'skillDRBonus', skill: 'focalisation', bonus: 2 },
          { op: 'skillDRBonus', skill: 'guerison', bonus: 2 },
          { op: 'skillDRBonus', skill: 'resistance', bonus: 2 },
        ], { label: event.label, rng, defaultUntilTime: until });
      }
      set({ party: [...get().party] });
      tell(get, set, ['+2 DR aux Tests de Focalisation (Ghyran), Guérison et Résistance (1d10 jours).']);
      break;
    }
    default:
      break; // narratif : le desc verbatim au journal suffit — rien d'inventé
  }
}

function tellManann(get: Get, set: Set, deltaD10: number): void {
  const rng = battleRng();
  const vessel = get().vessel;
  if (!vessel) return;
  const delta = Math.sign(deltaD10) * rollDice(Math.abs(deltaD10), 10, rng);
  set({ vessel: { ...vessel, manann: addManann(vesselManann(vessel), delta) } });
  tell(get, set, [`Humeur de Manann : ${delta >= 0 ? '+' : ''}${delta} (→ ${vesselManann(get().vessel).score}).`]);
}

/** Variante d'ouverture avec un extraDR RAW (Ouragan : Affaler Difficile −20 → −2 DR plats). */
function openVoyageCrewTestWithExtra(get: Get, set: Set, testTypeId: string, kind: string, extraDR: number): boolean {
  if (!openVoyageCrewTest(get, set, testTypeId, kind)) return false;
  const p = get().pendingCrewTest!;
  set({ pendingCrewTest: { ...p, extraDR: (p.extraDR ?? 0) + extraDR } });
  return true;
}

// ── Services PORTUAIRES (#30 — réparation, carénage, Améliorations, construction) ────────────────
// Flux MINIMAL data-driven, consommé par la recette `__wfrp` (DEV) et les tests — l'écran de chantier
// (UI) viendra dessus. La CONSTRUCTION (ch.12 l.108-164) est un DEVIS pur (`engine/shipBuild.buildShip`) :
// posséder le navire construit = créer son entrée `vehicles.json` au Codex (donnée app-owned) puis
// pointer `vessel.vehicleId` dessus.

/** RÉPARATION au port (ch.13 l.643) : le constructeur naval local restaure TOUT pour « 1 CO par
 *  Blessure restaurée » (+50 % si la coque est Lissée, ch.12 l.295) ; « Chaque Test réussi prend 1d10
 *  heures … et restaure 1d10 Blessures » → le temps passe d'autant. Purge aussi les Critiques notés
 *  en voyage (remise en état). Refus si la bourse ne suit pas. */
export function portRepairVessel(get: Get, set: Set): string[] {
  const vessel = get().vessel;
  const v = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  if (!vessel || !v?.hull) return ['Aucun navire de campagne à réparer.'];
  const max = vessel.wounds?.max ?? v.hull.char.B;
  const missing = max - (vessel.wounds?.current ?? max);
  if (missing <= 0 && !(vessel.criticals?.length)) return ['La coque est intacte.'];
  const lissage = shipHasNavalTrait([...(v.ship?.traits ?? []), ...(vessel.upgrades ?? [])], 'lissage');
  const cost = Math.ceil(missing * (lissage ? 1.5 : 1));
  const rest = subtract(get().money, toMoney({ gold: cost }));
  if (!rest) return [`Le chantier demande ${cost} CO — la bourse ne suit pas.`];
  const rng = battleRng();
  let hours = 0;
  for (let healed = 0; healed < missing; healed += rollDice(1, 10, rng)) hours += rollDice(1, 10, rng); // 1d10 h / 1d10 B (l.643)
  set({
    money: rest,
    vessel: { ...get().vessel!, wounds: { current: max, max }, criticals: [] },
    gameTime: get().gameTime + Math.max(1, hours) * 60,
  });
  return [`${v.label} remis à neuf : ${missing} Blessure(s), ${cost} CO${lissage ? ' (coque lissée : +50 %)' : ''}, ${Math.max(1, hours)} h de chantier.`];
}

/** CARÉNAGE en cale sèche (Salissures, ch.13 l.150-159) : « pour récurer un bateau de Taille Moyenne ou
 *  plus, il doit être emmené dans une cale sèche » — coût = % du coût de base par NIVEAU (colonne
 *  Réparation du tableau). Racle aussi les crabes boxeurs (événement ch.15 : « jusqu'à ce que la coque
 *  soit raclée »). */
export function portCareenVessel(get: Get, set: Set): string[] {
  const vessel = get().vessel;
  const v = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  if (!vessel || !v) return ['Aucun navire de campagne à caréner.'];
  const level = vessel.fouling?.level ?? 0;
  if (level <= 0 && !vessel.crabs) return ['La coque est propre.'];
  const baseGold = v.purchase?.price?.gold ?? 0;
  const pct = foulingEffects(level).repairPctOfBase;
  const cost = Math.ceil(baseGold * (pct / 100));
  const rest = cost > 0 ? subtract(get().money, toMoney({ gold: cost })) : get().money;
  if (!rest) return [`Le carénage coûte ${cost} CO (${pct} % du coût de base) — la bourse ne suit pas.`];
  set({ money: rest, vessel: { ...vessel, fouling: { level: 0, lastWeek: vessel.fouling?.lastWeek ?? 0 }, crabs: undefined } });
  return [`Coque raclée en cale sèche${cost ? ` (${cost} CO — ${pct} % du coût de base, ch.13 l.152)` : ''}.`];
}

/** POSE d'une Amélioration navale (MDG ch.12 l.195-364) : coût par bande de Taille (`installCost` —
 *  `per '5m'`/`unite` inclus), payé au chantier ; la réf rejoint `vessel.upgrades` (recopiée sur la
 *  coque à chaque départ). `units` = cabines multiples, etc. */
export function portInstallUpgrade(get: Get, set: Set, traitId: string, units = 1): string[] {
  const vessel = get().vessel;
  const v = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  const entry = findNavalTrait(traitId);
  if (!vessel || !v?.ship || !entry) return ['Amélioration ou navire introuvable.'];
  if (entry.kind !== 'amelioration') return [`${entry.label} est un Trait de construction — il ne se pose pas après coup (MDG ch.12 l.169).`];
  if (!entry.install) return [`${entry.label} : pas de tarif d'installation connu.`];
  const { gold, enc } = installCost(entry.install, v.ship.lengthM, units);
  if (gold == null) return [`${entry.label} : coût « du modèle embarqué » — passez par l'achat du bateau embarqué (ch.12 l.268).`];
  const rest = subtract(get().money, toMoney({ gold }));
  if (!rest) return [`${entry.label} coûte ${gold} CO — la bourse ne suit pas.`];
  set({ money: rest, vessel: { ...vessel, upgrades: [...(vessel.upgrades ?? []), { id: traitId, ...(units > 1 ? { value: units } : {}) }] } });
  return [`${entry.label} installé (${gold} CO${enc ? `, ${enc} Enc` : ''}, MDG ch.12).`];
}

// ── Événements de PORT (ch.15 l.127-129 + l.239-263) ─────────────────────────────────────────────

/** Prêtre de Manann en attente de CHOIX joueur (MDG 15 l.246) : payer la bénédiction (coût déjà
 *  tiré) OU réduire l'Humeur de Manann de 4d10 — tranché par `resolveManannPriest`. */
export interface PendingManannPriest {
  cost: Money;
}

export function resolvePortArrival(get: Get, set: Set, port: PortProfile | undefined, rng: RNG): void {
  const vessel = get().vessel;
  const mood = vesselManann(vessel);
  const { roll, hours, event } = rollPortEvent(mood.score, rng);
  log(get, set, [`Événement de port (2d10 ${roll}) — ${event.label} (dans les ${hours} heures)`, event.desc]);
  // #150 : `travelPlan` est déjà remis à `null` par `finishSeaDay` avant cet appel (l'arrivée l'annule) —
  // le lire ici renverrait TOUJOURS `undefined`. La coque se reconstruit depuis l'état PERSISTANT
  // (`get().vessel`, comme `buildSeaPlan`/`effectiveSeaM` le font via `voyageShip`).
  const ship = voyageShip(get)?.hull;
  switch (event.kind) {
    case 'fete-manann':
      if (vessel) set({ vessel: { ...vessel, manann: addManann(mood, rollDice(2, 10, rng)) } });
      break;
    case 'pretre-manann': {
      // MDG 15 l.246 : choix du joueur entre payer et réduire l'Humeur — `resolveManannPriest`.
      if (vessel) {
        const lengthM = findVehicleById(vessel.vehicleId)?.ship?.lengthM ?? 0;
        const cost = toMoney({ gold: rollDice(1, 10, rng), silver: lengthM });
        set({ pendingManannPriest: { cost } });
      }
      break;
    }
    case 'port-desert':
      if (ship) for (const l of applyShipMoraleDelta(get, set, ship, -rollDice(1, 10, rng))) log(get, set, [l]);
      break;
    case 'embrigadement': {
      // « Vous perdez 2d10 membres d'équipage » (MDG 15 l.245) : perte PERSISTÉE puis SÉQUENCE de
      // recouvrement (Ragot Intermédiaire → rançon 2d10 CO OU Discrétion Complexe ; échec → 1d10 de
      // plus) — cascade influençable dans `embrigadementFlow`. Difficultés en donnée (`sea-events.json`).
      openEmbrigadementRecovery(get, set, {
        lost: eventParam(event, 'lostCrew', rng, 0),
        ransomCO: eventParam(event, 'ransomCO', rng, 0),
        extraLoss: eventParam(event, 'failExtraLostCrew', rng, 0),
        gossipDiff: (event.params?.gossipDifficulty as Difficulty | undefined) ?? 'intermediaire',
        stealthDiff: (event.params?.stealthDifficulty as Difficulty | undefined) ?? 'complexe',
      });
      break;
    }
    case 'controle-a-quai': {
      // « Les droits de douane sont évalués à 10 % de la valeur de toute la cargaison … Si vous ne payez
      // pas, votre cargaison est saisie. »
      const cargo = vessel?.cargo ?? [];
      const tax = Math.ceil(cargo.reduce((s, l) => s + l.enc * l.basePriceGold, 0) * 0.1);
      const rest = tax > 0 ? subtract(get().money, toMoney({ gold: tax })) : null;
      if (tax > 0 && rest) {
        set({ money: rest });
        log(get, set, [`Droits de douane payés : ${tax} CO (10 % de la cargaison).`]);
      } else if (tax > 0 && vessel) {
        set({ vessel: { ...vessel, cargo: [] } });
        log(get, set, ['Cargaison SAISIE par la douane (droits impayés).']);
      }
      break;
    }
    default:
      break; // narratif / à jouer en scène — le verbatim au journal
  }
  void port;
}

/** Résout le choix « Prêtre de Manann » (MDG 15 l.246) : `pay` payé → débite le coût déjà tiré ;
 *  refusé → réduit l'Humeur de Manann de 4d10 (`tellManann`, réutilise le facteur libre existant). */
export function resolveManannPriest(get: Get, set: Set, pay: boolean): void {
  const p = get().pendingManannPriest;
  if (!p) return;
  set({ pendingManannPriest: null });
  if (pay) {
    const rest = subtract(get().money, p.cost);
    if (!rest) return; // garde défensive — l'UI désactive « Payer » si la bourse ne suit pas
    set({ money: rest });
    log(get, set, [`La purification est payée (${p.cost.gold} CO ${p.cost.silver}/–).`]);
    return;
  }
  tellManann(get, set, -4);
}
