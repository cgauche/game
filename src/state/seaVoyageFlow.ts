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
 * ÉQUIPAGE hors combat : ABSTRAIT, tenu par les PJ (MDG 14 l.39) ; aucun PJ apte à un poste = sous
 * l'effectif minimal → Manque de bras (MDG 14 l.55). En combat, l'équipage est réel
 * (`battle.combatants`) et le Manque de bras s'applique aussi (`shipCrew.ts`).
 */
import { battleRng } from './battleRng';
import { bus, EVT } from './bus';
import { openRest, placesOfKind } from './restFlow';
import { dayIndex } from './upkeep';
import { placeById, type WorldMap, type MapPlace, type MapRoute } from './worldMap';
import type { TravelPlan, TravelRecapDay } from './travelFlow';
import { toRecapLines, type RecapEvent } from './recapLine';
import type { BatchParticipant } from './pendings';
import { crewTestContributors, shipMoraleScore, applyShipMoraleDelta, shipSaboteurDR, applyVesselCrewLoss, resolveShoreLeaveDesertion, shipboardSouls } from './shipCrew';
import { applyEffects, applyEffectsLoot } from './combatEffects';
import type { Effect, Scene } from './scene';
import { buildScene } from './mapSpec';
import type { AuthoredEnemy } from './encounterAuthoring';
import { registerScene } from './store';
import { openEmbrigadementRecovery } from './embrigadementFlow';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById, findCrewRoleById, findCrewTestTypeById, findNavalTrait, type CrewTestTypeData } from '../data';
import { installCost, rollSteamBreakdown, steamBreakdownTriggered, shipSizeOfLength, type SteamBreakdownEntry } from '../engine/shipBuild';
import { d10, d100, roll as rollDice, type RNG } from '../engine/dice';
import { rollTest, isDoubleRoll, extendedTestStep, difficultyFromModifier } from '../engine/tests';
import { testValue, partyAssisted, partyBest } from '../engine/skills';
import { buildWeapon } from '../engine/items';
import { QUALITY_IDS } from '../engine/qualities/ids';
import { applyOps, type PairedSense } from '../engine/ops';
import { damageHull, healHull } from './shipDamage';
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
import { findWhirlpool, pickSeaHazard, rollStranding, strandingPenalty, rollDebrisEntangle } from '../engine/seaPerils';
import {
  rollBoardEvent, rollPortEvent, rollDaysToNextEvent, addManann, MANANN_BASE, seaBoardEventById,
  removeCargo, spoilCargoByEnc, spoilCargoByPct, cargoTotalEnc, cargoOverload, resolveFastVoyage, FAST_VOYAGE_PALIERS,
  type SeaEventDef, type ManannMood, type PortProfile,
} from '../engine/seaVoyage';
import { navalMoveMod, navalTestTypeDR, navalNavTestDR, shipHasNavalTrait } from '../engine/navalTraits';
import { rule } from '../engine/policy';
import { seaAutoResolves, voyageDayEntry, type VoyageOrders, type VoyageCadence } from './voyageCadence';
import { crewRoleValue, moraleBand, crewTalentDR, UNDERCREW_DR, capToSuccesMinime } from '../engine/crewMorale';
import { beginShipwreck } from './shipwreck';
import type { NightEntry } from './restFlow';
import { subtract, toMoney, type Money } from '../engine/money';
import { rollShipCritical } from '../engine/shipCritical';
import type { ShipCritKey } from '../data/shipCriticals';
import { contractDisease } from '../engine/disease';
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../engine/types';
import type { PendingSteamSave, CascadeStep } from './pendings';
import type { Get, Set } from './flowTypes';
import type { CampaignVessel } from './store';
import { openPartyTest, openWorldTest, composeRollLabel, effectiveTarget, resolveSurface, freeCons, type RollRequest, type Consequence } from './rollSeam';
import { registerCascadeApplier, startCascade, runCascadeImmediate } from './cascade';

/** Navire hostile de l'événement en cours (MDG ch.15 « Cogue pirate » / « Langskip skaeling ») — porté
 *  sur l'état NAVAL le temps de la confrontation, il DÉRIVE l'abordage GÉNÉRIQUE (`startChaseBoarding`)
 *  quel que soit le chemin (combat direct, poursuite rattrapée, tribut refusé) et quelle que soit la
 *  route : `shipRef`/`crewRef`/`chefRef` = ids de `vehicles.json`/`creatures.json` de l'événement. */
export interface SeaBoarding {
  shipRef: string;
  crewRef: string;
  chefRef?: string;
  label: string;
}

/** Crise NAVALE en cours (un Test d'équipage par manche jusqu'à l'issue). */
export type SeaCrisis =
  | { kind: 'poursuite'; label: string; distance: number; escapeAt: number; foeM: number; foeSkill: number; desc: string }
  | { kind: 'tourbillon'; label: string; whirlpoolId: string; need: number; progress: number };

/** État NAVAL d'un TravelPlan (route `sea`) — persiste dans la save avec le plan. Un jour de voyage
 *  (`runSeaDay`) est désormais UNE cascade `purpose:'travelDay'` (#275 Ronde 2 cran 3) — plus de FSM
 *  `step` persisté : le point de reprise EST `pendingCascade`/`suspendedCascades` (state/cascade.ts). */
export interface SeaVoyageState {
  /** Cap dominant du trajet (aspect du vent) — d'auteur (`MapRoute.seaHeading`), requis (#416). */
  heading: WindDirection;
  weather: SeaWeather;
  windFrom: WindDirection;
  /** Jours en mer avant le prochain événement de bord (1d10, ch.15 l.89 — suspendu au port, l.19). */
  daysToEvent: number;
  /** Jours passés en mer (scorbut : Test par mois sans nourriture correcte, MDG 14 l.230). */
  daysAtSea: number;
  /** Lignes du jour (recap de la halte de nuit). */
  lines: string[];
  /** Événements de bord RACONTÉS aujourd'hui (#371 LOT 4) — rendus en `ParchmentCard`, distincts des
   *  lignes de routine (`lines`) : un événement PORTE UN RÉCIT (titre + texte d'auteur/de table). */
  events?: RecapEvent[];
  /** PROCÈS-VERBAL structuré du jour (couche `voyageCadence`) : une ligne de JET par Test d'équipage de
   *  ROUTINE auto-résolu en route COMMANDÉE — « aucun jet silencieux » (rendu par `MultiRollList`). */
  entries?: NightEntry[];
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
  /** ÉCHOUÉ sur un péril (Rocher/Bas-fonds, MDG ch.13 l.471-473/497/499, #444) : le navire s'arrête net,
   *  aucune Progression tant qu'un Test de Force (pénalité = `strandingPenalty`) ne l'a pas dégagé. */
  stranded?: { hazardId: string; label: string; difficulty: Difficulty };
  /** EMPÊTRÉ dans des Débris marins (MDG ch.13 l.485-491, #444) : pénalité de Man/M tant que le Test
   *  étendu de Force (`hazard.freeTest`) n'a pas dégagé le navire — n'arrête PAS la Progression. */
  entangled?: { hazardId: string; label: string; need: number; progress: number; manDR: number; mMod: number; difficulty: Difficulty };
  crisis?: SeaCrisis;
  /** Navire hostile en présence (événement `navire-hostile`/`nemesis`) — source de l'abordage dérivé. */
  boarding?: SeaBoarding;
  /** Embuscade authorée déjà ouverte sur CETTE traversée (#212) — anti-double-feu entre l'ancrage
   *  déterministe (`MapRoute.ambush.at`) et l'abordage de fin de Poursuite (`startChaseBoarding`). */
  ambushFired?: boolean;
  /** FORCER LE RYTHME (MDG 13 l.95-107) : bonus de M demandé au départ (+1 voile/avirons, +2 avirons). */
  forcePace?: number;
  /** Issue du Test de Voile/Ramer du JOUR (l.97) : 'won' → le +M s'applique aux milles du jour. Présent
   *  (won OU lost) = le rythme a été forcé → Test d'Épuisement Complexe (−10) au soir (l.111). */
  paceToday?: 'won' | 'lost';
  /** LONGS VOYAGES TRÈS RAPIDES (MDG 15 l.21-37) : présent = traversée RAPIDE (résolue en UN Test de
   *  Rude épreuve, JAMAIS la boucle jour par jour). `palierId`/`roll`/`result`/`crewDR`/`manannTens` : cran du
   *  d10 calculé (persisté pour narrer au moment RÉEL de l'application, jamais avant) ; `pendingFinalize` =
   *  le palier reste à appliquer (après un abordage ancré éventuel — `finalizeFastVoyage` est ré-entrant). */
  fast?: {
    days: number; weeks: number; palierId?: string; roll?: number; result?: number; crewDR?: number;
    manannTens?: number; pendingFinalize?: boolean;
  };
  /** RECETTE (#332) : événement de bord NOMMÉ forcé au PROCHAIN jour (`__wfrp.forceEncounter`) — court-
   *  circuite le timer 1d10 et le tirage d100/Manann de `resolveSeaDayEvent`, sans autre effet de setup. */
  forcedEventId?: string;
}

/** Instantané d'un jour de mer pour l'ÉCRAN DE TRAVERSÉE (`SeaVoyageScreen`) : rose des vents + jauges
 *  compactes + distance restante. Self-contained (le plan est parfois déjà annulé au moment du rendu). */
export interface SeaRecapChrome {
  weatherLabel: string;
  windForce: SeaWeather['vent'];
  windFrom: WindDirection;
  heading: WindDirection;
  hull: { current: number; max: number };
  morale: number;
  manann: number;
  waterLitres?: number;
  /** Milles restants à parcourir et estimation de jours de mer restants (à la vitesse de croisière). */
  milesLeft: number;
  daysLeft: number;
}

/** Semaine impériale (8 jours, MDG 15 l.268) — cadence de la pénalité « −1 par semaine en mer » du
 *  voyage rapide (l.28) et des Activités en mer (`daysAtSea % 8`, `continueSeaDayAfterCascade`). */
const SEA_WEEK_DAYS = 8;

/** Malus d'ENVIRONNEMENT (Précipitations, MDG 13 l.187-201) sur le Test de compétence `skillId` en
 *  cours, quand un voyage en mer est ACTIF — POINT UNIQUE consommé par `openSkillTest` (aucun écran
 *  ne relit `sea.weather` pour son propre Test : la modale générique porte le malus). `undefined` =
 *  rien à afficher (mod nul, hors voyage maritime, ou Test de Caractéristique sans `skillId`). */
export function seaWeatherTestMod(sea: SeaVoyageState | undefined, skillId?: string, spec?: string): { mod: number; label: string } | undefined {
  if (!sea || !skillId) return undefined;
  const mod = precipitationSkillMod(sea.weather.precipitations, skillId, spec);
  return mod ? { mod, label: precipitationDef(sea.weather.precipitations).label } : undefined;
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().log(lines);
};

/** Écrit au journal ET au recap du jour (mêmes lignes — patron travelFlow). */
function tell(get: Get, set: Set, lines: string[]): void {
  if (!lines.length) return;
  log(get, set, lines);
  const plan = get().travelPlan;
  if (plan?.sea) set({ travelPlan: { ...plan, sea: { ...plan.sea, lines: [...plan.sea.lines, ...lines] } } });
}

/** Écrit un ÉVÉNEMENT RACONTÉ (#371 LOT 4) — au JOURNAL (résumé texte, même patron que `tell`) ET au
 *  recap du jour EN CARTE (`sea.events`, distinct de `sea.lines`) : le titre + texte verbatim de
 *  l'événement se rendent en `ParchmentCard` (`SeaVoyageBody`), pas en ligne de routine. */
function tellEvent(get: Get, set: Set, event: RecapEvent): void {
  log(get, set, [`${event.title} — ${event.text}`]);
  const plan = get().travelPlan;
  if (plan?.sea) set({ travelPlan: { ...plan, sea: { ...plan.sea, events: [...(plan.sea.events ?? []), event] } } });
}

/** Écrit SEULEMENT au recap du jour (`sea.lines`) — le JOURNAL des appliers de cascade migrés (#295
 *  Lot 1) est désormais écrit par `commitStep` depuis les `consequences` retournées (`freeCons`), pas
 *  par un second canal direct. `tell()` reste le canal des sites HORS applier (narration d'événement de
 *  jour, entretien-survie). */
export function noteSeaLine(get: Get, set: Set, lines: string[]): void {
  if (!lines.length) return;
  const plan = get().travelPlan;
  if (plan?.sea) set({ travelPlan: { ...plan, sea: { ...plan.sea, lines: [...plan.sea.lines, ...lines] } } });
}

export function patchSea(get: Get, set: Set, patch: Partial<SeaVoyageState>): void {
  const plan = get().travelPlan!;
  set({ travelPlan: { ...plan, sea: { ...plan.sea!, ...patch } } });
}

/** Humeur de Manann du navire de campagne (défaut : registre neuf). */
export function vesselManann(vessel: CampaignVessel | null): ManannMood {
  return vessel?.manann ?? { ...MANANN_BASE, applied: [...MANANN_BASE.applied] };
}

/** Facteur de Moral de disette (MDG 14 l.171). */
const FOOD_SHORTAGE_FACTOR = 'nourriture-insuffisante';

/**
 * VIVRES de l'équipage PNJ sur `days` jour(s) (MDG 14 l.238 : « rations de mer de la cale ») : l'effectif
 * nominal (`shipboardSouls().crew`) consomme une ration/jour de `vessel.provisions`. À court → le facteur
 * de Moral `nourriture-insuffisante` (−2d10, l.171) est ACTIVÉ pour le prochain recalcul hebdomadaire ;
 * couvert → il est retiré (réapprovisionné). `provisions` absent = ravitaillement d'équipage réputé assuré
 * (décision de périmètre de `waterLitres`) → aucune consommation, aucun facteur. Mute `vessel`. #245. */
function consumeCrewProvisions(get: Get, set: Set, days: number): string[] {
  const vessel = get().vessel;
  if (!vessel) return [];
  const crew = shipboardSouls(get).crew;
  const need = crew * Math.max(0, days);
  if (vessel.provisions == null || need <= 0) return []; // ravitaillement réputé assuré / pas d'équipage PNJ
  const left = Math.max(0, vessel.provisions - need);
  const short = vessel.provisions < need;
  const factors = short
    ? (vessel.morale.factors.includes(FOOD_SHORTAGE_FACTOR) ? vessel.morale.factors : [...vessel.morale.factors, FOOD_SHORTAGE_FACTOR])
    : vessel.morale.factors.filter((f) => f !== FOOD_SHORTAGE_FACTOR);
  set({ vessel: { ...vessel, provisions: left, morale: { ...vessel.morale, factors } } });
  return [short
    ? `Vivres d'équipage ÉPUISÉS — la ration de base n'est plus assurée (Moral : la disette pèsera au conseil de bord, MDG 14 l.171).`
    : `Vivres d'équipage : −${need} (reste ${left} jour${left > 1 ? 's' : ''}-homme).`];
}

/** RECHARGE les Blessures du Combattant-coque de trajet depuis `vessel.wounds` — SOURCE UNIQUE (#296).
 *  Réutilisée au build du plan (`voyageShip`/`riverHull`, coque de trajet REPART de l'état sauvegardé)
 *  et à la reprise d'un voyage interrompu (`resumeTravel`, ex. combat naval : le writeback de
 *  `finalizeBattle` sur `vessel.wounds` doit se propager à la coque de trajet, sinon le prochain
 *  `persistHullWounds` l'écraserait avec sa valeur PRÉ-combat périmée — c'est le bug caché du #296). */
export function syncHullWoundsFromVessel(hull: Combatant, vessel: Pick<CampaignVessel, 'wounds'>): void {
  if (vessel.wounds) hull.wounds = { ...hull.wounds, current: Math.min(vessel.wounds.current, hull.wounds.max) };
}

/** Le navire de campagne, ses données de type et sa COQUE de trajet (Blessures PERSISTÉES, #30). */
function voyageShip(get: Get): { vessel: CampaignVessel; hull: Combatant } | null {
  const vessel = get().vessel;
  if (!vessel) return null;
  const v = findVehicleById(vessel.vehicleId);
  if (!v?.ship) return null;
  const hull = vehicleCombatant(v);
  if (!hull) return null;
  if (vessel.name) hull.name = vessel.name; // #230 — nom d'instance (affichage ; le rendu reste keyé par creatureId)
  syncHullWoundsFromVessel(hull, vessel);
  hull.upgrades = vessel.upgrades ? [...vessel.upgrades] : undefined;
  hull.saboteurDR = vessel.saboteurDR;
  hull.cargoEnc = cargoTotalEnc(vessel.cargo ?? []); // #243 — surcharge (cargoOverload) sur la manœuvre de trajet
  return { vessel, hull };
}

/** PERSISTE les Blessures de la coque de trajet sur le navire de campagne (#30) — l'UNIQUE écriture
 *  `vessel.wounds` (#296). No-op si la coque de trajet n'est pas le navire de campagne (bateau de route
 *  fluviale sans navire de campagne). */
export function persistHullWounds(get: Get, set: Set): void {
  const plan = get().travelPlan;
  const vessel = get().vessel;
  if (!plan?.vehicle || !vessel || plan.vehicle.creatureId !== vessel.vehicleId) return;
  set({ vessel: { ...vessel, wounds: { current: plan.vehicle.wounds.current, max: plan.vehicle.wounds.max } } });
}

/** Fixe ABSOLUMENT les Blessures de coque du navire de campagne (effet d'auteur `adjustVessel`, #308) —
 *  écrit `vessel.wounds` PUIS resynchronise la copie de travail `travelPlan.vehicle` si un voyage est
 *  actif dessus (sinon la prochaine `persistHullWounds` l'écraserait avec la valeur pré-effet périmée,
 *  même trou que #296 côté delta). */
export function setVesselHull(get: Get, set: Set, current: number, max: number): void {
  const vessel = get().vessel;
  if (!vessel) return;
  const wounds = { current: Math.max(0, Math.min(current, max)), max };
  set({ vessel: { ...vessel, wounds } });
  const plan = get().travelPlan;
  if (plan?.vehicle && plan.vehicle.creatureId === vessel.vehicleId) {
    set({ travelPlan: { ...plan, vehicle: { ...plan.vehicle, wounds: { ...wounds } } } });
  }
}

/** Inflige `amount` Dégâts à la coque de TRAJET (`hull`, `travelPlan.vehicle`) et PERSISTE aussitôt sur
 *  `vessel.wounds` (#296) — UNE écriture, jamais un `damageHull` orphelin de sa persistance (c'était le
 *  double chemin : certains sites persistaient au coup par coup, d'autres seulement en fin de jour, la
 *  fenêtre entre les deux pouvait écraser une valeur plus fraîche écrite ailleurs, ex. fin de combat naval). */
export function damageVesselHull(get: Get, set: Set, hull: Combatant, amount: number): string[] {
  const j = damageHull(hull, amount);
  const plan = get().travelPlan;
  if (plan) set({ travelPlan: { ...plan } }); // bump de référence : la mutation en place de `hull` doit se voir
  persistHullWounds(get, set);
  return j;
}

/** Restaure `amount` Blessures à la coque de TRAJET et PERSISTE aussitôt sur `vessel.wounds` — pendant
 *  de `damageVesselHull` pour les soins. */
export function healVesselHull(get: Get, set: Set, hull: Combatant, amount: number): string[] {
  const j = healHull(hull, amount);
  const plan = get().travelPlan;
  if (plan) set({ travelPlan: { ...plan } });
  persistHullWounds(get, set);
  return j;
}

/** VOIE D'EAU (lot D #327) : une coque percée/heurtée « gâte 1d10 Enc » de cargaison (T2C ch.5 l.101 /
 *  MDG, cf. `engine/cargo.ts`). Route sur la SOURCE UNIQUE `vessel.cargo` via le tronc `spoilCargoByEnc`.
 *  Renvoie le journal (vide si rien à gâter). Câblé sur les avaries de coque EXISTANTES (collision maritime,
 *  coque percée fluviale) — jamais un mécanisme neuf. */
export function spoilVesselCargoOnLeak(get: Get, set: Set): string[] {
  const vessel = get().vessel;
  if (!vessel?.cargo?.length) return [];
  const enc = rollDice(1, 10, battleRng());
  const r = spoilCargoByEnc(vessel.cargo, enc);
  if (!r.removed) return [];
  set({ vessel: { ...vessel, cargo: r.lots } });
  return [`La voie d'eau gâte ${r.removed} Enc de cargaison (T2C ch.5 l.101 / MDG).`];
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
  // Surcharge de la cale (MDG 12 l.72-74) : −1/−2/−3 M par palier d'Encombrement supplémentaire.
  const overloadM = cargoOverload(cargoTotalEnc(vessel?.cargo ?? []), vd?.capacity ?? 0).mMod;
  // Empêtré dans des Débris marins (MDG ch.13 l.487-489, #444) : pénalité de M tant que non dégagé.
  const entangleM = sea.entangled?.mMod ?? 0;
  const baseM = (sail ? vd!.sail!.m : vd?.oars?.m ?? 0) + navalMoveMod(traits) + fouling.mMod + (sea.eventMMod ?? 0) + (vessel?.crabs ? -1 : 0) + pace + overloadM + entangleM;
  const aspect = windAspect(sea.heading, sea.windFrom);
  // Gréement de course (T2C ch.10 l.137) « inclut un clinfoc … les avantages des deux ne sont pas cumulables »
  // → il PRIME sur le Clinfoc quand les deux sont présents.
  const rigging = shipHasNavalTrait(traits, 'greement-de-course') ? 'greement' : shipHasNavalTrait(traits, 'clinfoc') ? 'clinfoc' : 'none';
  const cell = windEffect(sea.weather.vent, aspect, rigging);
  const m = windAdjustedM(Math.max(0, baseM), cell, sail);
  const label = cell.encalmine && sail ? 'Encalminé' : cell.affaler && sail ? 'Affaler les voiles !' : `vent ${aspect}`;
  return { m, sail, label };
}

// ── Test d'équipage de VOYAGE (hors combat — l'équipage = les PJ) ────────────────────────────────

/** Étape À PARTICIPANTS (batch, seam de jet #275 Décision 4 cran 1/2) d'un Test d'équipage de VOYAGE
 *  (MDG ch.14, hors combat — l'équipage = les PJ, l.39) — construit les contributeurs
 *  (`crewTestContributors`) et pose Moral/sabotage/traits navals en `meta` (agrégés à la validation par
 *  `cascade.aggregateBatchStep`, MÊME formule que `maneuverCrewTotal`). `null` = aucun PJ n'a de rôle
 *  utile (aucun jet à jouer ce Test-là, l'appelant applique son chemin sans-jet). `kind` = la clé du
 *  registre `registerCascadeApplier` (#275 Ronde 2 cran 2/3) — les 10 Tests canoniques partagent leur
 *  `testTypeId`, un ÉVÉNEMENT peut réutiliser un `testTypeId` sous un AUTRE `kind` (Ouragan → Affaler,
 *  cf. `sea-ouragan-affaler`) pour ne jamais retomber dans la routine auto-résolue (`SEA_ROUTINE_KINDS`
 *  est indexée par `kind`, pas `testTypeId`). */
/** ENJEU surfaçable (#331) d'un Test d'équipage de voyage : l'échec de CE Test précis coûte quelque
 *  chose de DÉJÀ implémenté dans l'applier — on l'ÉNONCE (verbatim MDG ch.14, porté par
 *  `crew-test-types.json`). Un ÉVÉNEMENT peut réutiliser un `testTypeId` sous un autre `kind` (Ouragan →
 *  Affaler) : l'enjeu reste celui du TYPE de Test. `undefined` = aucun enjeu documenté (rien à afficher). */
function crewTestStake(testType: CrewTestTypeData | undefined, _kind: string): string | undefined {
  return testType?.enjeu;
}

function buildVoyageCrewStep(get: Get, testTypeId: string, kind: string, opts: { sense?: PairedSense; extraDR?: number; icon?: string } = {}): CascadeStep | null {
  const plan = get().travelPlan;
  const ship = plan?.vehicle;
  if (!ship) return null;
  const party = get().party.filter((h) => !h.dead && !h.outOfRencontre);
  if (!party.length) return null;
  ship.crewIds = party.map((h) => h.id); // les PJ tiennent les rôles (MDG 14 l.39)
  const contributors = crewTestContributors(ship, party, testTypeId, new Set(party.map((h) => h.id)), opts.sense);
  if (!contributors.length) return null;
  const testType = findCrewTestTypeById(testTypeId);
  const essentialRoleId = testType?.essential;
  // Le flux propriétaire (naval) RÉSOUT la présentation (label/base) et la cible EFFECTIVE de chaque
  // participant À LA CONSTRUCTION — le séquenceur/modale génériques n'y liront QUE des champs neutres
  // (`BatchParticipant`). `bonusSlOnSuccess` = +DR de Talent baké (Commandant émérite, MDG 09 l.54).
  const participants: BatchParticipant[] = contributors.map((a) => {
    const role = findCrewRoleById(a.roleId);
    const base = role ? crewRoleValue(a.crew, role, opts.sense).value : 0;
    return {
      id: a.crew.id,
      label: role?.label ?? a.roleId,
      interactive: true,
      essential: a.roleId === essentialRoleId,
      base,
      target: effectiveTarget(a.crew, {}, 'intermediaire', base),
      bonusSlOnSuccess: role ? crewTalentDR(a.crew, role) : 0,
      result: null,
    };
  });
  const saboteur = shipSaboteurDR(ship); // MDG ch.14 l.45-47 : −1..−5 DR plats, aussi en voyage (#214)
  // #221 : Traits/Améliorations navals ciblant CE type de Test d'équipage (op `skillDRBonus` à `testType`,
  // ex. Proue-idole de Stromfels → Poursuite) — agnostique de la compétence tenue par le représentant.
  const traitDR = navalTestTypeDR(hullTraits(ship), testTypeId);
  // « Bouteur »/« Gréement de course » modifient le Test de Navigation POUR DIRIGER (T2C ch.10 l.66/137) —
  // seul le Test d'équipage de manœuvre (steering) le reçoit, converti en DR (`navalNavTestDR`, ÷10).
  const navDirDR = testTypeId === 'manoeuvre' ? navalNavTestDR(hullTraits(ship)) : 0;
  // Le naval verse ses paramètres de formule DÉJÀ chiffrés en `meta` NEUTRE (bande de Moral + sabotage +
  // traits) — l'agrégat générique (`cascade.aggregateBatchStep`) ne lit QUE `aggregateFlatDR`.
  const flatDR = moraleBand(shipMoraleScore(get, ship)).crewTestDR + saboteur + traitDR + navDirDR + (opts.extraDR ?? 0);
  const stake = crewTestStake(testType, kind); // ENJEU surfaçable (#331) : ce que l'échec du Test coûte
  return {
    id: kind, kind, label: testType?.label ?? testTypeId, icon: opts.icon ?? 'travel/anchor',
    participants, aggregate: 'summed-dr', interactive: true,
    ...(stake ? { stake } : {}),
    ...(flatDR ? { meta: { aggregateFlatDR: flatDR } } : {}),
  };
}

/** Étape MONO « Forcer le rythme » (MDG 13 l.95-107, `sea-force-pace`, applier ci-dessous) : le meilleur
 *  PJ soutenu (LDB 12) tente le Test de Voile/Ramer du jour. `null` = pas demandé, déjà tranché
 *  aujourd'hui, vapeur (ni voiles ni avirons à forcer), ou aucun PJ éligible. */
function buildForcePaceStep(get: Get): CascadeStep | null {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  if (!sea.forcePace || sea.paceToday != null) return null;
  const hull = plan.vehicle!;
  const vd = findVehicleById(hull.creatureId ?? '')?.ship;
  if (shipHasNavalTrait(hullTraits(hull), 'propulsion-a-vapeur') || !(vd?.sail || vd?.oars)) return null;
  const rig: 'voile' | 'avirons' = vd?.sail ? 'voile' : 'avirons';
  const diff = forcePaceDifficulty(sea.forcePace, rig);
  if (!diff) return null;
  const skillId = rig === 'voile' ? 'voile' : 'ramer';
  const best = partyAssisted(get().party, skillId);
  if (!best) return null;
  const test = { skill: skillId, label: 'Forcer le rythme' };
  return {
    id: 'sea-force-pace', kind: 'sea-force-pace', actorId: best.actor.id, icon: 'travel/sail-ship',
    label: composeRollLabel(best.actor, 'Forcer le rythme', test, diff), rollLabel: skillId === 'voile' ? 'Voile' : 'Ramer',
    base: best.value, target: effectiveTarget(best.actor, test, diff), result: null, interactive: true,
    meta: { forcePace: sea.forcePace },
  };
}

/** Étape MONO « Dégagement » (Test de Force, #444) — partagée par l'Échouage (`sea-degagement`, MDG
 *  ch.13 l.471-473 : « N'importe quel nombre de Personnages… peut aider ») et l'empêtrement dans des
 *  Débris marins (`sea-degagement-debris`, l.491, Test étendu). `null` = aucun PJ éligible à la Force. */
function buildStrandedOrEntangledStep(get: Get, label: string, difficulty: Difficulty, kind: string): CascadeStep | null {
  const force = partyAssisted(get().party, undefined, 'force');
  if (!force) return null;
  const test = { char: 'force' as const };
  return {
    id: kind, kind, actorId: force.actor.id, icon: 'travel/repair',
    label: composeRollLabel(force.actor, `Dégagement — ${label}`, test, difficulty), rollLabel: 'Force',
    base: force.value, target: effectiveTarget(force.actor, test, difficulty), result: null, interactive: true,
  };
}

/**
 * Étapes POST-PROGRESSION du jour (crise → embuscade ancrée → phare → orientation → extermination →
 * entretien), calculées APRÈS que `applySeaProgress` ait posé `sea.milesToday` du jour (dépendance de
 * l'embuscade/du phare, #275 Ronde 2 cran 3 Décision 2) — appelée par l'applier `'progression'`
 * (`insert`) ET par `buildSeaDayCascade` quand AUCUN Test de Progression n'a pu s'ouvrir (aucun PJ apte,
 * miroir de l'ancien chemin `'none'`). L'embuscade SANS équipage (aucun jet de Perception possible)
 * ouvre directement l'abordage EN SURPRISE ici (comme l'ancien FSM, pas d'étape sans jet).
 */
function buildPostProgressionSteps(get: Get, set: Set): CascadeStep[] {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  const worldMap = get().worldMap as WorldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const out: CascadeStep[] = [];
  // 6. CRISE en cours (Poursuite ch.13 l.354 / Tourbillon l.514) : un Test d'équipage par JOUR. Aucun PJ
  // apte au poste = sous l'effectif minimal (MDG 14 l.55) → la manche se joue quand même au plancher de
  // Manque de bras (miroir de la Progression sans équipage `buildSeaDayCascade`) : une CRISE ne se drop
  // JAMAIS faute de titulaire, sinon elle reste posée sans jamais resurgir (soft-lock #383).
  if (sea.crisis) {
    const kind = sea.crisis.kind === 'poursuite' ? 'poursuite' : 'tourbillon';
    const testTypeId = sea.crisis.kind === 'poursuite' ? 'progression-poursuite' : 'manoeuvre';
    // Empêtré dans des Débris marins (MDG ch.13 l.487-489, #444) : pénalité de Man sur le Test de
    // Manœuvre tant que non dégagé.
    const entangleDR = testTypeId === 'manoeuvre' ? (sea.entangled?.manDR ?? 0) : 0;
    const st = buildVoyageCrewStep(get, testTypeId, kind, entangleDR ? { extraDR: entangleDR } : {});
    if (st) out.push(st);
    else resolveSeaCrisisRound(get, set, capToSuccesMinime(UNDERCREW_DR));
  }
  // EMPÊTRÉ dans des Débris marins (MDG ch.13 l.491, #444) : Test étendu de Force pour se dégager —
  // n'arrête PAS la Progression (contrairement à l'Échouage, `sea.stranded`).
  if (sea.entangled) {
    const st = buildStrandedOrEntangledStep(get, sea.entangled.label, sea.entangled.difficulty, 'sea-degagement-debris');
    if (st) out.push(st);
  }
  // #212. Embuscade AUTHORÉE à ancrage déterministe : franchissement de l'ancrage ce jour → Test de
  // Perception PUIS abordage (applier `embuscade`, déjà enregistré).
  if (route?.ambush?.scene && route.ambush.encounter && !sea.ambushFired) {
    const anchor = Math.max(0, Math.min(1, route.ambush.at ?? 0.5)) * plan.km;
    if (plan.kmDone + sea.milesToday >= anchor) {
      const st = buildVoyageCrewStep(get, 'perception', 'embuscade');
      if (st) out.push(st);
      else openAuthoredSeaAmbush(get, set, route, false); // aucun équipage pour tester → surpris directement
    }
  }
  // 4. Phare du port d'arrivée en vue (dernier jour de mer) → Test de Perception VISUEL (MDG ch.13 l.337).
  const dest = worldMap ? placeById(worldMap, plan.toPlaceId) : undefined;
  const lighthouse = dest?.port?.lighthouse;
  const milesLeft = plan.km - plan.kmDone - sea.milesToday;
  if (lighthouse && milesLeft <= 15 && lighthouseSpotDifficulty(Math.max(1, Math.round(milesLeft))) != null) {
    const st = buildVoyageCrewStep(get, 'perception', 'phare', { sense: 'vue' });
    if (st) out.push(st);
  }
  // 5. Orientation quotidienne (« un Test par jour de voyage », ch.13 l.311), + Carte marine (+DR, MDG 15 l.290).
  const chartDR = get().party.some((h) => h.items?.some((it) => it.trappingId === 'carte-marine'))
    ? Number(rule('sea-chart-orientation-dr')) : 0;
  const orientStep = buildVoyageCrewStep(get, 'orientation', 'orientation', chartDR ? { extraDR: chartDR } : {});
  if (orientStep) out.push(orientStep);
  // 7. Infestation active : Test étendu d'EXTERMINATION (1d10 h/Test, MDG 14 l.98-104).
  if (sea.infestation) {
    const st = buildVoyageCrewStep(get, 'extermination-nuisibles', 'extermination');
    if (st) out.push(st);
  }
  // 9a. Coque endommagée → Test d'équipage d'ENTRETIEN (remplace le Métier à −2 DR, MDG 14 l.116-124).
  const hull = plan.vehicle!;
  if (hull.wounds.current < hull.wounds.max) {
    const st = buildVoyageCrewStep(get, 'entretien', 'entretien');
    if (st) out.push(st);
  }
  return out;
}

/**
 * Construit la CASCADE du jour (#275 Ronde 2 cran 3) : tronc = Forcer le rythme (si demandé) → Affaler
 * (si vents violents) → Progression — l'applier `'progression'` (déjà enregistré, cran 2a) INSÈRE les
 * étapes post-progression (`buildPostProgressionSteps`) une fois `sea.milesToday` connu. Aucun PJ apte
 * pour la Progression → applique la progression au plancher de Manque de bras (MDG 14 l.55) et bâtit
 * quand même les étapes qui n'en dépendent pas (miroir de l'ancien chemin `'none'`).
 */
function buildSeaDayCascade(get: Get, set: Set): { steps: CascadeStep[]; log: string[] } {
  const steps: CascadeStep[] = [];
  // ÉCHOUÉ (MDG ch.13 l.471-473, #444) : « il s'arrête net… ne peut plus bouger jusqu'à ce qu'il soit
  // dégagé » — AUCUNE Progression tant que le Test de Force n'a pas réussi ; le reste de la journée
  // (crise/embuscade/entretien…) continue quand même (miroir Encalminé/Affaler ci-dessous).
  const strandedSea = get().travelPlan!.sea!;
  if (strandedSea.stranded) {
    tell(get, set, [`Le navire reste ÉCHOUÉ sur ${strandedSea.stranded.label} — impossible de progresser tant qu'il n'est pas dégagé (MDG ch.13 l.473).`]);
    patchSea(get, set, { milesToday: 0 });
    const st = buildStrandedOrEntangledStep(get, strandedSea.stranded.label, strandedSea.stranded.difficulty, 'sea-degagement');
    if (st) steps.push(st);
    steps.push(...buildPostProgressionSteps(get, set));
    return { steps, log: [] };
  }
  // 2. Vents « Affaler les voiles » (ch.13 l.288) : posé AVANT le jet (le d100 ne décide QUE d'un
  // Critique au gréement, jamais du fait que les voiles soient affalées ce jour — RAW).
  const eff = effectiveSeaM(get);
  if (eff.sail && eff.m === null && eff.label.startsWith('Affaler')) {
    patchSea(get, set, { sailsDown: true });
    const st = buildVoyageCrewStep(get, 'affaler', 'affaler');
    if (st) steps.push(st);
  }
  // 3. Progression du jour (MDG 14 l.61-65 ; ±10 %/DR ch.15 l.78) — Encalminé (l.296) ou voiles
  // affalées (l.294) : AUCUN Test de Progression (rien à naviguer), ancre si le navire en a une,
  // sinon dérive à 25 % — le reste de la journée continue quand même (crise/embuscade/…).
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  const effAfterAffaler = effectiveSeaM(get);
  if (sea.sailsDown || effAfterAffaler.m === null) {
    const anchored = shipHasNavalTrait(hullTraits(plan.vehicle!), 'ancre');
    const drift = anchored ? 0 : Math.round(seaMilesPerDay(4, true) * (AFFALER_RULES.driftPctOfSpeed / 100));
    tell(get, set, [!sea.sailsDown
      ? `Encalminé — le bateau ne peut pas se déplacer grâce à ses voiles (MDG ch.13 l.296).${anchored ? ' L\'ancre est jetée.' : ` Le courant l'entraîne (${drift} milles).`}`
      : `Voiles affalées — ${anchored ? 'ancre jetée en attendant l\'accalmie.' : `le vent pousse le navire (${drift} milles, 25 % de la vitesse — l.294).`}`]);
    patchSea(get, set, { milesToday: 0 });
    steps.push(...buildPostProgressionSteps(get, set));
    return { steps, log: [] };
  }
  // FORCER LE RYTHME (MDG 13 l.95-107) : AVANT la Progression — « pour bénéficier du bonus de
  // Mouvement, un Test de Voile ou de Ramer doit être réussi ».
  const paceStep = buildForcePaceStep(get);
  if (paceStep) steps.push(paceStep);
  // L'applier `'progression'` insère le reste de la journée une fois la Progression posée.
  const progStep = buildVoyageCrewStep(get, 'progression', 'progression');
  if (progStep) steps.push(progStep);
  else {
    // aucun PJ apte = sous l'effectif minimal (MDG 14 l.55) : Progression au plancher de Manque de bras.
    tell(get, set, applySeaProgress(get, set, capToSuccesMinime(UNDERCREW_DR)));
    steps.push(...buildPostProgressionSteps(get, set));
  }
  return { steps, log: [] };
}

/** Un jour de voyage maritime est-il de PURE ROUTINE (aucune décision susceptible de survenir) ? Une
 *  crise en cours, une infestation active, ou une route à embuscade NON ENCORE déclenchée forcent
 *  l'INTERACTIF pour la journée ENTIÈRE (simplification #275 Ronde 2 cran 3 assumée : l'ancre exacte
 *  n'est connue qu'après la Progression du jour — on ne peut pas savoir en amont si CE jour précis la
 *  franchira ; plutôt que risquer de résoudre une décision en silence, toute route à embuscade non
 *  déclenchée bascule la traversée entière en cascade interactive jusqu'à l'ancrage). */
function seaDayAllRoutine(get: Get): boolean {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  if (sea.crisis || sea.infestation) return false;
  const route = (get().worldMap as WorldMap | undefined)?.routes.find((r) => r.id === plan.routeId);
  if (route?.ambush?.scene && route.ambush.encounter && !sea.ambushFired) return false;
  return true;
}

/** PV structuré (couche `voyageCadence` — « aucun jet silencieux ») : une entrée de JET par contributeur
 *  d'une étape À PARTICIPANTS déjà résolue (`runCascadeImmediate`, route COMMANDÉE) — rendue par
 *  `MultiRollList` sur l'écran de traversée. Étapes MONO (Forcer le rythme…) : `[]` (leur ligne va au
 *  journal via `tell()`, comme avant). */
function dayEntriesFromStep(get: Get, step: CascadeStep): NightEntry[] {
  if (!step.participants) return [];
  const pool = get().party;
  return step.participants.flatMap((part, i) => {
    const actor = pool.find((c) => c.id === part.id);
    const res = part.result;
    if (!actor || !res) return [];
    return [voyageDayEntry({
      id: `sea-${step.kind}-${get().travelPlan?.sea?.daysAtSea ?? 0}-${part.id}-${i}`,
      actorId: part.id, icon: 'travel/anchor', label: `${step.label}${part.essential ? ' ★' : ''}`,
      d: { label: part.label ?? actor.name, base: part.base, modifier: res.target - part.base, target: res.target, roll: res.roll, success: res.success, sl: res.sl },
      tone: res.success ? 'ok' : 'bad',
    })];
  });
}

/** Pousse les entrées de PV des étapes RÉSOLUES (route COMMANDÉE, `runCascadeImmediate`) dans
 *  `sea.entries` (accumulateur du jour, vidé par `continueSeaDayAfterCascade`). */
function pushDayEntries(get: Get, set: Set, resolved: CascadeStep[]): void {
  const entries = resolved.flatMap((s) => dayEntriesFromStep(get, s));
  if (entries.length) patchSea(get, set, { entries: [...(get().travelPlan?.sea?.entries ?? []), ...entries] });
  // « Aucun jet silencieux » (voyageCadence.ts) : un RÉSUMÉ DR par Test d'équipage AUTO-RÉSOLU, au
  // journal du jour.
  for (const s of resolved) {
    if (!s.participants || !s.result) continue;
    const total = s.result.sl;
    tell(get, set, [`${s.label} : DR ${total >= 0 ? `+${total}` : total} → ${total >= 1 ? 'succès' : 'échec'} (MDG 14 l.13).`]);
  }
}

/** Construit le TravelPlan d'une TRAVERSÉE (route `sea`) sur le navire de campagne — `null` si aucun
 *  navire (ou coque coulée). La coque de trajet repart des Blessures PERSISTÉES (#30). */
export function buildSeaPlan(
  get: Get, routeId: string, fromPlaceId: string, toPlaceId: string,
  route: { km: number; seaHeading?: WindDirection },
  opts: { pace?: number; cadence?: VoyageCadence } = {},
): TravelPlan | null {
  const ship = voyageShip(get);
  if (!ship || ship.hull.wounds.current <= 0) return null;
  const heading = route.seaHeading;
  if (!heading) throw new Error(`buildSeaPlan: route mer sans seaHeading — cap requis, jamais de défaut silencieux (#416, pit #408)`);
  const rng = battleRng();
  const season = seasonOfMonth(toDate(get().gameTime).month);
  // ORDRES permanents (couche `voyageCadence`) : l'API par défaut reste JOUR-PAR-JOUR (rétro-compat) ;
  // l'écran de départ passe COMMANDÉE (son défaut d'affichage).
  const orders: VoyageOrders = { cadence: opts.cadence ?? 'jour-par-jour' };
  return {
    routeId, fromPlaceId, toPlaceId, mode: 'mer', hoursPerDay: 24, km: route.km, kmDone: 0, interrupted: false,
    orders,
    vehicle: ship.hull,
    sea: {
      heading,
      weather: rollSeaWeather(season, rng), // graine du 1ᵉʳ jour (le cran de vent quotidien s'y accroche)
      windFrom: rollWindDirection(rng),
      daysToEvent: rollDaysToNextEvent(rng), // « Tous les 1d10 jours » (ch.15 l.89)
      daysAtSea: 0, lines: [], milesToday: 0,
      ...(opts.pace ? { forcePace: opts.pace } : {}), // Forcer le rythme (MDG 13 l.95-107)
    },
  };
}

// ── LONGS VOYAGES TRÈS RAPIDES (MDG 15 l.21-37) ──────────────────────────────────────────────────

/** M de CROISIÈRE (hors vent/événement) pour estimer la durée du voyage rapide (l.25) — mêmes milles
 *  que le détaillé (18 × M) : voiles/avirons du gréement, ou M 4 constant à la vapeur (ch.12 l.311). */
function cruiseM(hull: Combatant): number {
  if (shipHasNavalTrait(hullTraits(hull), 'propulsion-a-vapeur')) return 4;
  const vd = findVehicleById(hull.creatureId ?? '')?.ship;
  return Math.max(1, vd?.sail?.m ?? vd?.oars?.m ?? 1);
}

/** Appareille en TRAVERSÉE RAPIDE (l.21-37) : construit un plan `sea.fast` (jamais la boucle jour par
 *  jour), estime la durée (distance / vitesse moyenne, l.25) puis ouvre l'UNIQUE Test d'équipage de
 *  Rude épreuve (modale existante). Sans équipage apte : palier au DR 0, résolution immédiate. `false`
 *  = aucun navire en état (l'appelant journalise). */
export function startFastVoyage(
  get: Get, set: Set, routeId: string, fromPlaceId: string, toPlaceId: string,
  route: { km: number; seaHeading?: WindDirection }, opts: { pace?: number; cadence?: VoyageCadence } = {},
): boolean {
  const plan = buildSeaPlan(get, routeId, fromPlaceId, toPlaceId, route, opts);
  if (!plan) return false;
  const days = Math.max(1, Math.ceil(plan.km / seaMilesPerDay(cruiseM(plan.vehicle!), true)));
  const weeks = Math.floor(days / SEA_WEEK_DAYS); // « par semaine passée en mer » (l.28)
  set({ travelPlan: { ...plan, sea: { ...plan.sea!, fast: { days, weeks } } }, worldMapOpen: false, travelRecap: null });
  const to = get().worldMap ? placeById(get().worldMap!, toPlaceId) : undefined;
  log(get, set, [`— ${plan.vehicle!.name} appareille vers ${to?.label ?? '?'} (traversée rapide, ~${days} jour(s), ${plan.km} milles) —`]);
  const st = buildVoyageCrewStep(get, 'rude-epreuve', 'voyage-rapide');
  if (st) { startCascade(get, set, { title: 'Voyage rapide — Rude épreuve', icon: 'travel/wave', purpose: 'test', steps: [st] }); return true; }
  computeFastPalier(get, set, 0); // aucun équipage apte au Test → DR 0
  finalizeFastVoyage(get, set);
  return true;
}

/** Calcule le palier du voyage rapide (`resolveFastVoyage`) depuis le DR de Rude épreuve + l'Humeur de
 *  Manann + les semaines en mer et le PERSISTE sur `sea.fast` — jamais raconté ici : une embuscade ANCRÉE
 *  peut interrompre AVANT que le palier ne s'applique (#212), et narrer « Voyage désastreux » pendant que
 *  l'écran de combat dément les pertes ment au joueur sur le timing. La narration part avec l'application
 *  réelle, dans `finalizeFastVoyage`. */
function computeFastPalier(get: Get, set: Set, crewDR: number): void {
  const fast = get().travelPlan?.sea?.fast;
  if (!fast) return;
  const mood = vesselManann(get().vessel);
  const { roll, manannTens, result, palier } = resolveFastVoyage(crewDR, mood.score, fast.weeks, battleRng());
  patchSea(get, set, { fast: { ...fast, palierId: palier.id, roll, result, crewDR, manannTens, pendingFinalize: true } });
}

/** Applique les conséquences d'un palier de voyage rapide (l.33-37) : équipage PNJ manquant (couture
 *  partagée `applyVesselCrewLoss`, plafonnée au nominal), cargaison gâtée/volée (% par lot), Blessures
 *  de coque perdues (% du max, PERSISTÉ #30) et Coups Critiques (localisation aléatoire, notés — l.49 :
 *  les Dégâts d'équipage d'un Critique sont ignorés, déjà couverts par les pertes du voyage). */
function applyFastPalier(get: Get, set: Set, palierId?: string): void {
  const palier = FAST_VOYAGE_PALIERS.find((p) => p.id === palierId);
  if (!palier) return;
  const rng = battleRng();
  const vessel0 = get().vessel;
  if (palier.crewLostPct > 0 && vessel0) {
    const nominal = findVehicleById(vessel0.vehicleId)?.ship?.crew ?? 0;
    const present = Math.max(0, nominal - (vessel0.crewLost ?? 0));
    const lost = Math.round(present * palier.crewLostPct / 100);
    if (lost > 0) for (const l of applyVesselCrewLoss(get, set, lost)) tell(get, set, [l]);
  }
  const vessel1 = get().vessel;
  if (palier.cargoLostPct > 0 && vessel1?.cargo?.length) {
    const cargo = vessel1.cargo
      .map((l) => ({ ...l, enc: Math.floor(l.enc * (1 - palier.cargoLostPct / 100)) }))
      .filter((l) => l.enc > 0);
    set({ vessel: { ...vessel1, cargo } });
    tell(get, set, [`${palier.cargoLostPct} % de la cargaison s'est gâtée ou a été volée.`]);
  }
  const vessel2 = get().vessel;
  const hull2 = get().travelPlan?.vehicle;
  if (palier.hullLostPct > 0 && vessel2 && hull2) {
    const max = hull2.wounds.max;
    const cur = hull2.wounds.current;
    const lost = Math.round(max * palier.hullLostPct / 100);
    if (max > 0 && lost > 0) {
      damageVesselHull(get, set, hull2, lost);
      tell(get, set, [`${vessel2.name ?? 'La coque'} perd ${Math.min(lost, cur)} Blessure(s) (${palier.hullLostPct} %).`]);
    }
  }
  const locs: ShipCritKey[] = ['greement', 'coque', 'avirons', 'equipements', 'cargaison'];
  for (let i = 0; i < palier.criticals; i++) {
    const crit = rollShipCritical(locs[rng.int(0, locs.length - 1)], rng);
    applyVesselCritical(get, set, crit.log, crit.note);
  }
}

/** Achève une traversée rapide (RÉ-ENTRANT) : une embuscade ANCRÉE (#212) non déclenchée INTERROMPT
 *  d'abord (le reste s'achève en rapide APRÈS le combat, la cascade `'voyage-rapide'` s'étant SUSPENDUE
 *  — resumée au teardown de combat, `resumeSuspendedCascade`) ; sinon
 *  RACONTE puis applique le palier (MÊME geste — jamais avant, cf. `computeFastPalier`), avance de N
 *  jours (couture unique `advanceTime` → faim/soif/maladies/paie d'équipage), consomme l'eau des
 *  tonneaux (comme le détaillé) et accoste (`openPortAt`). */
function finalizeFastVoyage(get: Get, set: Set): void {
  const plan = get().travelPlan;
  const fast = plan?.sea?.fast;
  if (!plan?.sea || !fast?.pendingFinalize) return;
  // Embuscade ANCRÉE non déclenchée : le rythme forcé du voyage rapide court-circuite la vigie —
  // l'abordage surgit à son ancrage et SURPREND le navire (pas de Test de Perception jour par jour).
  const route = (get().worldMap as WorldMap | undefined)?.routes.find((r) => r.id === plan.routeId);
  if (!plan.sea.ambushFired && route?.ambush?.scene && route.ambush.encounter) {
    tell(get, set, ['La traversée rapide est rompue : une voile hostile surgit sans que la vigie l\'ait vue venir (Surprise) !']);
    openAuthoredSeaAmbush(get, set, route, false); // reprise post-combat → ce finalize s'exécute à nouveau (ambushFired le saute)
    return;
  }
  const palier = FAST_VOYAGE_PALIERS.find((p) => p.id === fast.palierId);
  if (palier) {
    const crewDR = fast.crewDR ?? 0;
    const manannTens = fast.manannTens ?? 0;
    tell(get, set, [
      `Voyage rapide — d10 ${fast.roll} − ${fast.weeks} semaine(s) ${crewDR >= 0 ? '+' : ''}${crewDR} DR (Rude épreuve) ${manannTens >= 0 ? '+' : ''}${manannTens} (dizaine d'Humeur de Manann) = ${fast.result} → ${palier.label}.`,
      palier.desc,
    ]);
  }
  applyFastPalier(get, set, fast.palierId);
  // NAUFRAGE (MDG 13 l.674) : un palier de voyage rapide a pu couler la coque → survie, jamais l'accostage.
  const sunk = get().vessel;
  if (sunk && (sunk.wounds?.current ?? 1) <= 0) { beginShipwreck(get, set); return; }
  patchSea(get, set, { fast: { ...fast, pendingFinalize: false } });
  // Eau douce des tonneaux (MDG 14 l.242) : POPULATION EMBARQUÉE (héros + effectif PNJ, `shipboardSouls`)
  // × régime médian × jours — MÊME couture que le détaillé (`continueSeaDayAfterCascade`), le voyage
  // rapide ne tirant pas la Température jour par jour.
  const vessel = get().vessel;
  const patch: Partial<CampaignVessel> = { lastVoyageMilles: plan.km };
  if (vessel?.waterLitres != null) {
    const souls = shipboardSouls(get).total;
    patch.waterLitres = Math.max(0, vessel.waterLitres - souls * dailyWaterLitres('mediane') * fast.days);
  }
  if (vessel) set({ vessel: { ...vessel, ...patch } });
  // Vivres de l'équipage PNJ sur toute la traversée rapide (MÊME couture que le détaillé).
  log(get, set, consumeCrewProvisions(get, set, fast.days));
  const to = get().worldMap ? placeById(get().worldMap!, plan.toPlaceId) : undefined;
  set({ travelPlan: null });
  // Jours écoulés : franchissement par la couture UNIQUE `advanceTime` (entretien quotidien : faim/soif,
  // maladies, convalescence, paie hebdomadaire de l'équipage) — l'eau vient d'être décrémentée.
  get().advanceTime(fast.days * MINUTES_PER_DAY);
  log(get, set, [`— Accostage à ${to?.label ?? '?'} (traversée rapide, ${fast.days} jour(s)) —`]);
  if (to) openPortAt(get, set, to);
}

// ── Boucle jour par jour (#275 Ronde 2 cran 3 — pipeline cascade) ───────────────────────────────

/** Périls d'AUTEUR de la route (`route.perils`) lus JOUR PAR JOUR — MÊME patron que le terrestre
 *  (travelFlow) : tirage à `chancePct` %, effets appliqués (butin attribué hors combat) ; un effet
 *  `startCombat`/`transition` INTERROMPT la traversée (reprise via `resumeTravel`). Renvoie `true` si
 *  la traversée s'est arrêtée là (combat/transition d'auteur). */
function resolveSeaDayPerils(get: Get, set: Set, rng: RNG): boolean {
  const plan = get().travelPlan!;
  const route = (get().worldMap as WorldMap | undefined)?.routes.find((r) => r.id === plan.routeId);
  for (const peril of route?.perils ?? []) {
    if (d100(rng) > Math.max(0, Math.min(100, peril.chancePct))) continue;
    tell(get, set, [`Péripétie : ${peril.label}`]);
    const interrupts = (peril.effects ?? []).some((e: Effect) => e.type === 'startCombat' || e.type === 'transition');
    if (interrupts) {
      set({ travelPlan: { ...get().travelPlan!, interrupted: true } });
      applyEffects(get, set, peril.effects); // combat/transition d'auteur → la traversée s'arrête là
      return true;
    }
    applyEffectsLoot(get, set, peril.effects, peril.label); // trouvaille d'auteur → fenêtre d'attribution
  }
  return false;
}

/** Événement de bord tous les 1d10 jours (ch.15 l.89) — résolu AVANT la cascade du jour (ne dépend
 *  d'aucune Progression). La Prière d'un Présage (`sea-priere`) et l'Ouragan (`sea-ouragan-affaler`,
 *  applier ci-dessous) peuvent SURFACER leur propre mini-cascade (`purpose:'test'`) — renvoie `true` si
 *  c'est le cas ; sa clôture reprend `runSeaDay` par la couture canonique `dispatchCascadeDone`. */
function resolveSeaDayEvent(get: Get, set: Set, rng: RNG): boolean {
  const plan = get().travelPlan!;
  const sea = plan.sea!;
  // Recette (#332) : événement NOMMÉ forcé (`forceEncounter`) — court-circuite le timer + le tirage.
  if (sea.forcedEventId) {
    const forced = seaBoardEventById(sea.forcedEventId);
    patchSea(get, set, { forcedEventId: undefined });
    if (forced) {
      resolveBoardEvent(get, set, forced, rng);
      return !!get().pendingCascade;
    }
  }
  let days = sea.daysToEvent - 1;
  let firing: { event: SeaEventDef; roll: number; mood: ManannMood } | null = null;
  if (days <= 0) {
    const mood = vesselManann(get().vessel);
    const { roll, event } = rollBoardEvent(mood.score, rng);
    firing = { event, roll, mood };
    days = rollDaysToNextEvent(rng);
  }
  // `daysToEvent` avance AVANT `resolveBoardEvent` (peut surfacer une mini-cascade) : sans quoi une
  // reprise re-déclencherait CE même tirage (le garde `days <= 0` retomberait sur la même valeur).
  patchSea(get, set, { daysToEvent: days });
  if (!firing) return false;
  resolveBoardEvent(get, set, firing.event, rng, firing.roll);
  return !!get().pendingCascade;
}

/**
 * Boucle maritime — appelée par `runTravelDays`/`resumeTravel` (plan `sea`) et la reprise de nuit.
 * UN JOUR = périls d'auteur (inline) → événement de bord (inline, peut surfacer) → la CASCADE du jour
 * (`buildSeaDayCascade`, purpose `travelDay`) → `continueSeaDayAfterCascade` à sa clôture (dénouement
 * du jour + halte/arrivée). La cascade EST le point de reprise (`pendingCascade`/`suspendedCascades`,
 * state/cascade.ts).
 */
export function runSeaDay(get: Get, set: Set): void {
  const plan = get().travelPlan;
  // Une cascade est déjà active (ou suspendue derrière un combat) : l'arbitre la montre, rien à faire —
  // `resumeTravel` (couture d'événement) ne ré-entre PLUS de FSM (#275 Ronde 2 cran 3, Décision c).
  if (!plan?.sea || plan.interrupted || get().pendingCrewTest || get().pendingSteamSave || get().pendingCascade) return;
  // NAUFRAGE (MDG 13 l.674) : coque à 0 (Tourbillon/Collision/usure) → séquence de survie, jamais la
  // suite de la traversée sur une épave.
  if (plan.vehicle && plan.vehicle.wounds.current <= 0) { beginShipwreck(get, set); return; }
  const sea = plan.sea;
  const rng = battleRng();
  // VOYAGE RAPIDE (MDG 15 l.21-37) : ce plan ne déroule JAMAIS la journée par étape — le palier
  // calculé s'applique en un bloc (`finalizeFastVoyage`, ré-entrant après un abordage ancré).
  if (sea.fast) { if (sea.fast.pendingFinalize) finalizeFastVoyage(get, set); return; }
  // Météo du jour (ch.13 l.164) : déjà TIRÉE (à l'ouverture pour le 1ᵉʳ jour, `buildSeaPlan` — sinon à
  // la CLÔTURE du jour précédent, `continueSeaDayAfterCascade` — décision 1 #275 Ronde 2 cran 3, aligné
  // sur le fluvial `tickRiverWindDay`/`finishRiverDay`) — cette ligne l'ANNONCE seulement.
  tell(get, set, [`Météo du jour : ${seaWeatherLabel(sea.weather)} — vent de ${sea.windFrom} (cap ${sea.heading}).`]);
  if (resolveSeaDayPerils(get, set, rng)) return;
  if (resolveSeaDayEvent(get, set, rng)) return;
  const { steps, log: lines } = buildSeaDayCascade(get, set);
  for (const l of lines) log(get, set, [l]);
  // La construction du jour a pu ouvrir un ABORDAGE en plein vol (crise « caught » / embuscade ancrée
  // sans équipage à tester → `startChaseBoarding`/`openAuthoredSeaAmbush` posent `interrupted` + combat) :
  // la traversée s'arrête là (reprise par `resumeTravel` après le combat), jamais de fin-de-jour en plein combat.
  if (get().battle || get().travelPlan?.interrupted) return;
  if (!steps.length) { continueSeaDayAfterCascade(get, set); return; }
  // Route COMMANDÉE + journée de PURE routine (#275 Ronde 2 cran 3) : l'auto-pilote local résout la
  // cascade d'un bloc (mêmes appliers, mêmes conséquences), sans modale — lignes au journal. En coop,
  // la conduite reste manuelle. Un combat ouvert EN PLEIN VOL (rarissime : le build ne pouvait pas
  // prévoir un franchissement d'ancrage exact) suspend le fragment restant (`runCascadeImmediate` `ctx`).
  if (get().net.mode === 'local' && seaAutoResolves(plan.orders, 'progression') && seaDayAllRoutine(get)) {
    const resolved = runCascadeImmediate(get, set, steps, { title: 'Journée en mer', purpose: 'travelDay' });
    if (get().battle || get().pendingCascade) return; // combat en plein vol OU choix sans défaut : surfacé, jamais résolu en silence
    pushDayEntries(get, set, resolved);
    continueSeaDayAfterCascade(get, set);
    return;
  }
  startCascade(get, set, { title: 'Journée en mer', icon: 'travel/wave', purpose: 'travelDay', steps });
}

// ── Seam de jet (#275 Ronde 1) — appliers des sites migrés vers `openRoll` ───────────────────────

/** Forcer le rythme (MDG 13 l.95-107) : pose `paceToday`, le +M du jour se lit ensuite par
 *  `effectiveSeaM`. Étape du TRONC de la cascade du jour (`buildForcePaceStep`, avant Progression) —
 *  `tell()` (pas `{journal}`) : la ligne rejoint le RECAP du jour (`sea.lines` → `TravelRecapDay.lines`). */
registerCascadeApplier('sea-force-pace', (get, set, step) => {
  if (!step.result) return;
  const won = step.result.success;
  const forcePace = Number(step.meta?.forcePace ?? 0);
  patchSea(get, set, { paceToday: won ? 'won' : 'lost' });
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
  const j = [`${step.label} : ${won ? `+${forcePace} M aujourd'hui.` : 'le navire garde son allure.'}`];
  noteSeaLine(get, set, j);
  return { consequences: freeCons(j) };
});

/** Prière d'un Présage (ch.15 l.236, `klass:'hero-test'`) : bon présage → il faut RÉUSSIR pour
 *  l'appliquer ; mauvais présage → RÉUSSIR l'évite (`manannD >= 0 ? success : !success`, logique
 *  inchangée). `tell()` pour la même raison recap que `sea-force-pace` ci-dessus. La reprise du jour à
 *  la fermeture est portée par `dispatchCascadeDone` (purpose `test` en mer → `runSeaDay`), pas ici. */
registerCascadeApplier('sea-priere', (get, set, step) => {
  if (!step.result) return;
  const manannD = Number(step.meta?.manannD ?? 0);
  const moraleD = Number(step.meta?.moraleD ?? 0);
  const success = step.result.success;
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
  const j = [`${step.label} : ${success ? 'Manann est apaisé/honoré.' : 'la prière se perd dans les embruns.'}`];
  const apply = manannD >= 0 ? success : !success;
  if (apply) {
    if (manannD) tellManann(get, set, manannD);
    const ship = get().travelPlan?.vehicle;
    if (moraleD && ship) {
      const delta = Math.sign(moraleD) * rollDice(Math.abs(moraleD), 10, battleRng());
      for (const l of applyShipMoraleDelta(get, set, ship, delta)) tell(get, set, [l]);
    }
  }
  noteSeaLine(get, set, j);
  return { consequences: freeCons(j) };
});

/** Scorbut (MDG 14 l.230, `klass:'subi'`) : conséquence + texte IDENTIQUES à l'ancien inline — seule la
 *  RÉSOLUTION du jet change de couture (cascade au lieu de `rollTest` direct). `hero` = l'acteur de
 *  l'étape (résolu par `commitStep` via `step.actorId`, `cascade.ts:109`). */
registerCascadeApplier('sea-scorbut', (get, set, step, hero) => {
  if (!step.result || !hero) return;
  const soup = !!step.meta?.soup;
  const success = step.result.success;
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
  // Succès sans effet (l'exposition « pour cette fois » n'a rien à ajouter) → aucune conséquence.
  if (success) { set({ party: [...get().party] }); return { consequences: freeCons([]) }; }
  const d = contractDisease('scorbut', battleRng());
  if (d) hero.diseases = [...(hero.diseases ?? []), d];
  set({ party: [...get().party] });
  return { consequences: freeCons([{ text: `${hero.name} — scorbut (un mois en mer${soup ? ', soupe de chou' : ''}) : contracté.`, tone: 'bad' }]) };
});

/** Épuisement (MDG 13 l.109-111, `klass:'subi'`) : même patron que Scorbut ci-dessus. */
registerCascadeApplier('sea-epuisement', (get, set, step, hero) => {
  if (!step.result || !hero) return;
  const success = step.result.success;
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
  // Succès sans effet (rien à ajouter) → aucune conséquence.
  if (success) { set({ party: [...get().party] }); return { consequences: freeCons([]) }; }
  addCondition(hero, 'extenue');
  set({ party: [...get().party] });
  return { consequences: freeCons([{ text: `${hero.name} — Épuisement (rythme forcé, Résistance ${DIFFICULTY_LABELS[exhaustionDifficulty(true)]}) : +1 Exténué.`, tone: 'bad' }]) };
});

/** Applique les MILLES du jour depuis le total du Test de Progression (±10 %/DR, ch.15 l.78). Renvoie
 *  la ligne d'annonce (le call-site décide du canal — `tell()` build-time ou `consequences` d'applier). */
function applySeaProgress(get: Get, set: Set, progressionDR: number): string[] {
  const plan = get().travelPlan!;
  const eff = effectiveSeaM(get);
  if (eff.m == null || plan.sea!.sailsDown) { patchSea(get, set, { milesToday: 0 }); return []; }
  // Voguer de nuit exige équipage + installations, sinon ÷2 (MDG 15 l.76) — l'équipage du navire de
  // campagne étant abstrait (MDG 14 l.39), la capacité nocturne est portée par la règle maison éditable
  // `sea-night-sailing` (défaut ON = navire équipé, distance pleine ; OFF = ÷2). #340.
  const nightSailing = rule('sea-night-sailing') === true;
  const miles = Math.round(seaMilesPerDay(eff.m, nightSailing, progressionDR));
  patchSea(get, set, { milesToday: miles, eventMMod: undefined }); // « Vents favorables » : +1 M consommé sur UNE journée de route
  return [`Progression du jour : ${miles} milles (DR d'équipage ${progressionDR >= 0 ? '+' : ''}${progressionDR}).`];
}

/**
 * Clôture de la CASCADE du jour (#275 Ronde 2 cran 3, appelée par le store — `dispatchCascadeDone`
 * `purpose:'travelDay'`) — PHASE 1/3 de l'entretien-survie (#272 résiduel, seam #275 Décision 3) : eau &
 * rats, puis Scorbut (ch.14). Le lot de Tests `subi` du Scorbut passe par `resolveSurface` : un siège MJ
 * présent (`gmSeat`) → cascade SURFACÉE (`purpose:'seaScorbut'`, visible/lançable, jamais silencieuse —
 * la clôture enchaîne `continueSeaDayAfterScorbut` via `dispatchCascadeDone`, `combatSlice.ts`) ; sinon
 * résolu INLINE comme avant (#275 Ronde 1) et la phase 2 s'enchaîne directement. Toute ligne générée ICI
 * passe par `tell()` (journal + `sea.lines`, durable) plutôt qu'un tableau local — une cascade surfacée
 * PAUSE l'exécution (reprise asynchrone par un clic MJ), un accumulateur JS ne survivrait pas la pause.
 */
export function continueSeaDayAfterCascade(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan?.sea) return;
  const rng = battleRng();
  const sea = plan.sea;

  // Nuit : l'infestation gâte la cargaison (ch.15, événements Infestation).
  if (sea.infestation) {
    const vessel = get().vessel;
    if (vessel?.cargo?.length) {
      const spoil = rollDice(1, 10, rng) * (sea.infestation.spoilPerNight.startsWith('3') ? 3 : 1);
      const first = vessel.cargo[0];
      const r = removeCargo(vessel.cargo, first.cargoId, spoil);
      set({ vessel: { ...vessel, cargo: r.lots } });
      if (r.removed) tell(get, set, [`Les rats gâtent ${r.removed} Enc de cargaison pendant la nuit.`]);
    } else tell(get, set, ['Les rats rôdent dans la cale (rien à gâter — pour l\'instant).']);
  }

  // Eau douce (ch.13 l.209-213 + ch.14 l.242) : consommation par bande de Température × POPULATION EMBARQUÉE
  // (héros + effectif PNJ nominal, `shipboardSouls` — MDG 14 l.238 : « l'équipage … a besoin de beaucoup
  // d'eau »), si le navire suit ses tonneaux (`vessel.waterLitres`). La Soif elle-même suit la décision de
  // périmètre de `provisions.ts` (volet Soif non simulé) : à sec, on AVERTIT.
  const vessel0 = get().vessel;
  if (vessel0?.waterLitres != null) {
    const souls = shipboardSouls(get).total;
    const need = souls * dailyWaterLitres(sea.weather.temperature);
    const left = Math.max(0, vessel0.waterLitres - need);
    set({ vessel: { ...vessel0, waterLitres: left } });
    tell(get, set, [left > 0 ? `Eau douce : −${need} L (${souls} à bord, reste ${left} L).` : 'Les tonneaux d\'eau douce sont À SEC — trouvez de l\'eau (MDG ch.14).']);
  }
  // Vivres de l'équipage PNJ (MDG 14 l.238/250) : l'effectif nominal mange sur les rations de mer de la cale.
  tell(get, set, consumeCrewProvisions(get, set, 1));

  // Scorbut (MDG 14 l.230) : « pour chaque mois passé sans nourriture correcte » — Test de Résistance
  // Intermédiaire (+0), Facile (+40) avec la soupe de chou fermenté. Les rations de bord ne sont pas
  // de la nourriture fraîche → le mois EN MER compte. UNE cascade à N étapes `subi` (patron `shipwreck.ts`
  // 22c74b5d) — policy de la PORTE (`resolveSurface`), jamais un `if gmSeat` local (#272 résiduel).
  const daysAtSea = sea.daysAtSea + 1;
  if (daysAtSea % 30 === 0) {
    const patients = get().party.filter((h) => !h.dead && !(h.diseases ?? []).some((d) => d.name === 'scorbut'));
    if (patients.length) {
      const test: RollRequest['test'] = { skill: 'resistance', char: 'endurance' };
      const steps: CascadeStep[] = patients.map((h) => {
        const soup = (h.items ?? []).some((it) => itemCapability(it, 'scurvyGuard'));
        const diff: Difficulty = soup ? 'facile' : 'intermediaire';
        return {
          id: `sea-scorbut-${h.id}`, kind: 'sea-scorbut', actorId: h.id,
          label: composeRollLabel(h, 'Scorbut', test, diff), rollLabel: 'Scorbut',
          base: testValue(h, 'resistance', 'endurance'), target: effectiveTarget(h, test, diff),
          result: null, interactive: true, meta: { soup },
        };
      });
      const subiReq: RollRequest = { side: { worldSide: 'world', ownerId: get().vessel!.vehicleId }, actionLabel: 'Scorbut', test: {}, difficulty: 'intermediaire', klass: 'subi' };
      if (resolveSurface(get, subiReq, 'sea-scorbut') === 'I') {
        const resolved = runCascadeImmediate(get, set, steps);
        tell(get, set, resolved.flatMap((s) => (s.outcome ?? []).map((l) => l.text)));
      } else {
        startCascade(get, set, { title: 'Entretien — Scorbut', icon: 'medical/infection', purpose: 'seaScorbut', steps });
        return; // clôture reprise par `dispatchCascadeDone` (`combatSlice.ts`) → `continueSeaDayAfterScorbut`
      }
    }
  }
  continueSeaDayAfterScorbut(get, set);
}

/**
 * PHASE 2/3 (#272 résiduel) : Salissures hebdo (ch.13 l.148), horloge +24 h, Exposition (ch.13 l.203-225),
 * puis Épuisement (ch.13 l.109-111) — même patron MJ-surfaçable que Scorbut (Phase 1). `doneSteps` : la
 * cascade Scorbut VIENT de se clôturer côté MJ (`dispatchCascadeDone`) → ses lignes de résultat (déjà
 * journalisées par `commitStep`) sont reversées dans `sea.lines` pour que le recap de la halte les porte
 * (parité avec le chemin inline, qui les `tell()` lui-même avant d'enchaîner). Absent en chaînage direct
 * (Scorbut résolu I) : déjà `tell()`'ées par `continueSeaDayAfterCascade`.
 */
export function continueSeaDayAfterScorbut(get: Get, set: Set, doneSteps?: CascadeStep[]): void {
  const plan = get().travelPlan;
  if (!plan?.sea) return;
  if (doneSteps) tell(get, set, doneSteps.flatMap((s) => (s.outcome ?? []).map((l) => l.text)));
  const rng = battleRng();
  const sea = plan.sea;
  const daysAtSea = sea.daysAtSea + 1;

  // Salissures hebdomadaires (ch.13 l.148) : « chaque semaine qu'un navire passe en mer sans
  // l'entretien approprié » — Test de Résistance du vaisseau, raté → +1 niveau.
  const week = Math.floor(dayIndex(get().gameTime) / 7);
  const vessel1 = get().vessel;
  if (vessel1 && week > (vessel1.fouling?.lastWeek ?? -1) && daysAtSea >= 7) {
    const hullE = findVehicleById(vessel1.vehicleId)?.hull?.char.endurance ?? 40;
    const r = rollWeeklyFouling(hullE, vessel1.fouling?.level ?? 0, rng);
    set({ vessel: { ...get().vessel!, fouling: { level: r.level, lastWeek: week } } });
    if (r.gained) tell(get, set, [`Salissures : la coque s'encrasse (niveau ${r.level} — ${foulingEffects(r.level).desc})`]);
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
      const r = exposureNight(h, expCount, testValue(h, 'resistance', 'endurance'), rng, { kind: tdef.exposure, difficulty: tdef.difficulty });
      // Résolution SYNCHRONE (N Tests/nuit par héros, hors cascade) : aucune rangée nulle part — le
      // journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
      tell(get, set, [`${h.name} — Exposition (${tdef.label}, ${expCount} Test${expCount > 1 ? 's' : ''} de Résistance ${DIFFICULTY_LABELS[tdef.difficulty ?? 'intermediaire']}) : ${r.rolls.map((x) => `${x.roll}/${x.target}`).join(' · ')}${r.failures ? '' : ' — tient le coup.'}`, ...r.log]);
      expireExposureEffects(h, get().gameTime + MINUTES_PER_DAY); // dissipation après 24 h (purge #T3)
    }
    set({ party: [...get().party] });
  }

  // ÉPUISEMENT (MDG 13 l.109-111) : le rythme a été FORCÉ aujourd'hui (réussi OU non) → chaque PJ
  // (l'équipage = les PJ, MDG 14 l.39) teste Résistance Complexe (−10) sous peine d'Exténué. Le Test
  // de base des Périodes de travail (Accessible +20) est absorbé par l'abstraction d'équipage PNJ —
  // il n'est joué que quand le joueur CHOISIT de forcer (décision documentée). Même patron
  // MJ-surfaçable que Scorbut (Phase 1) — policy de la PORTE, jamais un `if gmSeat` local.
  if (sea.paceToday) {
    const diff = exhaustionDifficulty(true);
    const patients = get().party.filter((h) => !h.dead);
    if (patients.length) {
      const test: RollRequest['test'] = { skill: 'resistance', char: 'endurance' };
      const steps: CascadeStep[] = patients.map((h) => ({
        id: `sea-epuisement-${h.id}`, kind: 'sea-epuisement', actorId: h.id,
        label: composeRollLabel(h, 'Épuisement', test, diff), rollLabel: 'Épuisement',
        base: testValue(h, 'resistance', 'endurance'), target: effectiveTarget(h, test, diff),
        result: null, interactive: true,
      }));
      const subiReq: RollRequest = { side: { worldSide: 'world', ownerId: get().vessel!.vehicleId }, actionLabel: 'Épuisement', test: {}, difficulty: 'intermediaire', klass: 'subi' };
      if (resolveSurface(get, subiReq, 'sea-epuisement') === 'I') {
        const resolved = runCascadeImmediate(get, set, steps);
        tell(get, set, resolved.flatMap((s) => (s.outcome ?? []).map((l) => l.text)));
      } else {
        startCascade(get, set, { title: 'Entretien — Épuisement', icon: 'medical/infection', purpose: 'seaExhaustion', steps });
        return; // clôture reprise par `dispatchCascadeDone` (`combatSlice.ts`) → `continueSeaDayAfterExhaustion`
      }
    }
  }
  continueSeaDayAfterExhaustion(get, set);
}

/**
 * PHASE 3/3 (#272 résiduel) : recap du jour, arrivée (port) ou halte de nuit — même fin qu'avant la
 * scission. Lit `sea.lines` FRAIS (les phases 1/2 ont `tell()` toute leur journalisation, inline OU
 * surfacée MJ) au lieu d'un tableau local reconstitué — la SEULE source, plus de double comptage par
 * chemin. `doneSteps` : mêmes rôle/parité que `continueSeaDayAfterScorbut` ci-dessus, pour l'Épuisement.
 */
export function continueSeaDayAfterExhaustion(get: Get, set: Set, doneSteps?: CascadeStep[]): void {
  const plan = get().travelPlan;
  if (!plan?.sea) return;
  if (doneSteps) tell(get, set, doneSteps.flatMap((s) => (s.outcome ?? []).map((l) => l.text)));
  const rng = battleRng();
  const sea = plan.sea;
  const daysAtSea = sea.daysAtSea + 1;
  const todayLines = sea.lines;
  const todayEvents = sea.events ?? [];

  const miles = sea.milesToday;
  const kmDone = Math.min(plan.km, plan.kmDone + miles);
  // PV DU JOUR (couche `voyageCadence`) : les jets de ROUTINE auto-résolus s'y sont accumulés (`sea.entries`) —
  // on les EMPORTE dans le recap du jour avant de rincer l'accumulateur pour le lendemain.
  const dayEntries = [...(sea.entries ?? [])];
  const hull = plan.vehicle!;
  const chrome: SeaRecapChrome = {
    weatherLabel: seaWeatherLabel(sea.weather), windForce: sea.weather.vent, windFrom: sea.windFrom, heading: sea.heading,
    hull: { current: hull.wounds.current, max: hull.wounds.max },
    morale: shipMoraleScore(get, hull), manann: vesselManann(get().vessel).score,
    waterLitres: get().vessel?.waterLitres,
    milesLeft: Math.max(0, Math.round(plan.km - kmDone)),
    daysLeft: Math.max(0, Math.ceil(Math.max(0, plan.km - kmDone) / seaMilesPerDay(cruiseM(hull), true))),
  };
  // Météo du LENDEMAIN (ch.13 l.164) + direction du vent (rose, l.250) — force du vent : celle du jour
  // qui s'achève, mise à jour (l.272, résumée en un cran par jour à l'échelle voyage).
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
  patchSea(get, set, {
    daysAtSea, lines: [], entries: [], events: [],
    weather, windFrom, weatherLock: lock, reversedWinds: reversed,
    milesToday: 0, sailsDown: false, lighthouseDR: 0, eventMMod: sea.eventMMod, paceToday: undefined,
  });
  set({ travelPlan: { ...get().travelPlan!, kmDone } });

  const worldMap = get().worldMap as WorldMap;
  const to = placeById(worldMap, plan.toPlaceId);
  const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: kmDone, hours: 24, lines: toRecapLines(todayLines), entries: dayEntries, events: todayEvents, sea: chrome };

  if (plan.km - kmDone < 1e-9 && to) {
    // ARRIVÉE : la distance de la traversée est NOTÉE sur le navire (vente à un port producteur :
    // « plus de 100 milles », l.366). Le CHOIX « relâche à terre » (MDG 15 l.245) se tranche AVANT
    // le tirage de l'événement de port (`resolveShoreLeave` enchaîne `resolvePortArrival`).
    set({ travelPlan: null, ...(get().vessel ? { vessel: { ...get().vessel!, lastVoyageMilles: plan.km } } : {}) });
    log(get, set, [`— Accostage à ${to.label} —`]);
    openPortAt(get, set, to);
    return;
  }
  // ACTIVITÉS EN MER (MDG 15 l.266-272) : « Pour chaque semaine (8 jours) de voyage en mer, chaque
  // Personnage a l'occasion d'effectuer une Activité » — la 8ᵉ journée révolue ouvre le choix (modale),
  // la halte de nuit suit à la confirmation (le recap du jour lui est transmis).
  if (daysAtSea > 0 && daysAtSea % 8 === 0) {
    set({ pendingSeaActivities: { picks: {}, day: recapDay } });
    return;
  }
  // Halte de nuit (machinerie de repos EXISTANTE — le recap du jour s'y lit, patron travelFlow). EN MER,
  // on dort À BORD (hamacs, MDG 03 l.71) : couchage unique et abrité — pas de tente sur l'eau.
  openRest(get, set, { places: get().vessel ? { bord: true } : placesOfKind('camp'), travelHalt: true, travelDay: recapDay });
}

// ── Registre `cascadeAppliers` des Tests d'équipage de VOYAGE (#275 Ronde 2 cran 3 — PILOTE RÉEL,
//    câblé par `buildSeaDayCascade`/`buildPostProgressionSteps`/`runSeaDay`) ────────────────────

/** Progression du jour (MDG 14 l.61-65 ; ±10 %/DR ch.15 l.78) + PANNE DE VAPEUR (MDG ch.12 l.313) sur un
 *  navire à Propulsion à vapeur (Test de Métier lu sur les jets INDIVIDUELS des contributeurs). INSÈRE
 *  le reste de la journée (crise/embuscade/phare/orientation/extermination/entretien) une fois
 *  `sea.milesToday` connu (`buildPostProgressionSteps`, #275 Ronde 2 cran 3 Décision 2). */
registerCascadeApplier('progression', (get, set, step) => {
  if (!step.result) return;
  const total = step.result.sl;
  const j = applySeaProgress(get, set, total);
  const plan = get().travelPlan;
  const hull = plan?.vehicle;
  const rng = battleRng();
  if (hull && shipHasNavalTrait(hullTraits(hull), 'propulsion-a-vapeur')) {
    const triggered = (step.participants ?? []).some((x) => x.result
      && steamBreakdownTriggered({ success: x.result.roll <= x.result.target, sl: x.result.sl, isDouble: isDoubleRoll(x.result.roll) }));
    if (triggered) {
      const b = rollSteamBreakdown(rng);
      j.push(`PANNE DE VAPEUR — ${b.label} (MDG ch.12 l.313).`, b.desc);
      applySteamBreakdown(get, set, b, rng); // « Fuite de vapeur » → `pendingSteamSave` (sauvegarde d'Initiative) suspend AVANT le reste du jour
    }
  }
  noteSeaLine(get, set, j);
  if (get().pendingSteamSave) return { consequences: freeCons(j) }; // le reste de la journée reprendra APRÈS la sauvegarde (`resolveSteamSave` → `runSeaDay`)
  const insert = buildPostProgressionSteps(get, set);
  return { consequences: freeCons(j), insert: insert.length ? insert : undefined };
});

/** Conséquence PARTAGÉE d'Affaler (ch.13 l.288-294) : échec → Critique au Gréement (MDG 14 l.92-96).
 *  Appelée par l'applier de la CASCADE DU JOUR (`'affaler'`, routine) ET par l'événement Ouragan
 *  (`'sea-ouragan-affaler'`, jamais routine, extraDR −2) — MÊME conséquence RAW, deux déclencheurs. */
function affalerConsequence(get: Get, set: Set, step: CascadeStep): Consequence[] {
  if (!step.result) return [];
  if (step.result.success) { const j = ['Les voiles sont affalées à temps (MDG ch.13 l.292).']; noteSeaLine(get, set, j); return freeCons(j); }
  const rng = battleRng();
  const crit = rollShipCritical(AFFALER_RULES.failCritLocation as ShipCritKey, rng);
  applyVesselCritical(get, set, crit.log, crit.note);
  return [];
}
registerCascadeApplier('affaler', (get, set, step) => ({ consequences: affalerConsequence(get, set, step) }));
// Ouragan : cascade AUTONOME (`purpose:'test'`) ouverte AVANT la construction du jour
// (`resolveSeaDayEvent`) — sa clôture reprend `runSeaDay` par la couture canonique `dispatchCascadeDone`.
registerCascadeApplier('sea-ouragan-affaler', (get, set, step) => ({ consequences: affalerConsequence(get, set, step) }));

/** Orientation quotidienne (« un Test par jour de voyage », ch.13 l.311) → Repères / Changement de cap. */
registerCascadeApplier('orientation', (get, set, step) => {
  if (!step.result) return;
  const sea = get().travelPlan?.sea;
  if (!sea) return;
  const rng = battleRng();
  const total = step.result.sl;
  const dr = total + (sea.lighthouseDR ?? 0);
  const out = orientationOutcome(dr, !!sea.minorDrift);
  const j = [`Orientation (DR ${dr >= 0 ? '+' : ''}${dr}${sea.lighthouseDR ? `, phare +${sea.lighthouseDR}` : ''}) : ${out.desc}`];
  if (out.outcome === 'drift-minor') patchSea(get, set, { minorDrift: true });
  if (out.rollCourseChange) {
    const cc = rollCourseChange(rng, out.courseChangeBonus);
    j.push(`Changement de cap (d10 ${cc.roll}, dérive ${cc.side}) : ${cc.desc}`);
    const plan2 = get().travelPlan!;
    const remaining = plan2.km - plan2.kmDone;
    if (cc.effect === 'retard') set({ travelPlan: { ...plan2, km: plan2.km + remaining * (cc.delayPct / 100) } });
    if (cc.effect === 'demi-tour') set({ travelPlan: { ...plan2, kmDone: Math.max(0, plan2.kmDone - (plan2.sea?.milesToday ?? 0)) } });
    if (cc.effect === 'quart-de-tour') {
      const turn: Record<WindDirection, WindDirection> = { nord: cc.side === 'tribord' ? 'est' : 'ouest', sud: cc.side === 'tribord' ? 'ouest' : 'est', est: cc.side === 'tribord' ? 'sud' : 'nord', ouest: cc.side === 'tribord' ? 'nord' : 'sud' };
      patchSea(get, set, { heading: turn[sea.heading] });
    }
  }
  noteSeaLine(get, set, j);
  return { consequences: freeCons(j) };
});

/** Phare du port d'arrivée (ch.13 l.337) : réussite → bonus d'Orientation (Savoir Océans/manuel). */
registerCascadeApplier('phare', (get, set, step) => {
  if (!step.result) return;
  const success = step.result.success;
  const best = partyAssisted(get().party, 'orientation');
  const dr = success && best ? Math.max(1, lighthouseOrientationDR(best.actor, false), savoirOceansBonus(best.actor)) : 0;
  patchSea(get, set, { lighthouseDR: dr });
  const j = [success ? `La lumière du phare est en vue — l'atterrage se précise (+${dr} DR d'Orientation, MDG ch.13 l.335).` : 'Aucune lumière à l\'horizon — brume ou distance.'];
  noteSeaLine(get, set, j);
  return { consequences: freeCons(j) };
});

/** Embuscade authorée à ancrage déterministe (#212) : réussite = préparés (pas de Surprise). */
registerCascadeApplier('embuscade', (get, set, step) => {
  if (!step.result) return;
  const plan = get().travelPlan;
  const route = (get().worldMap as WorldMap | undefined)?.routes.find((r) => r.id === plan?.routeId);
  const success = step.result.success;
  const j = [success
    ? 'La vigie a vu venir l\'abordage : le navire s\'y prépare (pas de Surprise).'
    : 'Trop tard — le navire hostile fond sur vous avant que l\'équipage ne réagisse (Surprise) !'];
  noteSeaLine(get, set, j);
  openAuthoredSeaAmbush(get, set, route, success);
  return { consequences: freeCons(j) };
});

/**
 * Cœur d'UNE manche de CRISE (Poursuite ch.13 l.354-370 / Tourbillon ch.13 l.514-528) : dispatche sur
 * `sea.crisis.kind`, applique l'issue et journalise (recap). `total` = DR net de l'équipage —
 * `step.result.sl` quand un Test d'équipage a pu s'ouvrir, le plancher de Manque de bras (MDG 14 l.55,
 * `capToSuccesMinime(UNDERCREW_DR)`) quand AUCUN PJ n'est apte au poste : la manche se joue quand même,
 * comme la Progression sans équipage apte (`buildSeaDayCascade`). Peut ouvrir l'abordage (Poursuite « caught »,
 * `startChaseBoarding` → `interrupted`). SOURCE UNIQUE partagée par les appliers `poursuite`/`tourbillon`
 * ET le repli sans équipage de `buildPostProgressionSteps` — une crise ne se DROP jamais faute de titulaire.
 */
function resolveSeaCrisisRound(get: Get, set: Set, total: number): string[] {
  const plan = get().travelPlan;
  const sea = plan?.sea;
  if (!sea?.crisis) return [];
  const rng = battleRng();
  if (sea.crisis.kind === 'poursuite') {
    const c = sea.crisis;
    const eff = effectiveSeaM(get);
    const myM = eff.m ?? 1;
    const foe = rollTest(c.foeSkill, 'intermediaire', rng);
    const gain = pursuitDistanceGain(myM, total + pursuitLowMPenalty(myM)) - pursuitDistanceGain(c.foeM, foe.sl + pursuitLowMPenalty(c.foeM));
    const distance = c.distance + gain;
    const j = [`Poursuite — ${c.label} : ${gain >= 0 ? 'le navire creuse l\'écart' : 'le poursuivant gagne du terrain'} (${gain >= 0 ? '+' : ''}${gain} → Distance ${distance}/${c.escapeAt}).`];
    const outcome = pursuitOutcome(distance, c.escapeAt);
    if (outcome === 'escaped') {
      patchSea(get, set, { crisis: undefined, boarding: undefined });
      j.push('Le poursuivant abandonne : le navire s\'est échappé (MDG ch.13 l.362).');
    } else if (outcome === 'caught') {
      patchSea(get, set, { crisis: undefined });
      j.push('Rattrapés ! « une collision, suivie d\'un abordage déterminé, est malheureusement inévitable » (MDG ch.13 l.420).');
      startChaseBoarding(get, set);
    } else {
      patchSea(get, set, { crisis: { ...c, distance } });
    }
    noteSeaLine(get, set, j);
    return j;
  }
  const c = sea.crisis;
  const w = findWhirlpool(c.whirlpoolId)!;
  const progress = c.progress + Math.max(0, total + w.manDR);
  const hull = plan!.vehicle!;
  const dmg = Math.max(0, w.ic - Math.floor((hull.characteristics?.endurance ?? 0) / 10));
  damageVesselHull(get, set, hull, dmg);
  const j = [`${w.label} : l'eau tournoyante broie la coque (${dmg} Blessures) — évasion ${progress}/${c.need} DR.`];
  if (progress >= c.need) {
    patchSea(get, set, { crisis: undefined });
    j.push('Le navire s\'arrache du Tourbillon (Test étendu d\'Évasion accompli, MDG ch.13 l.528).');
  } else patchSea(get, set, { crisis: { ...c, progress } });
  noteSeaLine(get, set, j);
  return j;
}

/** Manche de Poursuite (ch.13 l.354-370) — issue partagée avec la poursuite terrestre (`engine/pursuit`). */
registerCascadeApplier('poursuite', (get, set, step) => {
  if (!step.result) return;
  return { consequences: freeCons(resolveSeaCrisisRound(get, set, step.result.sl)) };
});

/** Manche d'Évasion du Tourbillon (ch.13 l.514-528) : chaque manche coûte des Dégâts de collision. */
registerCascadeApplier('tourbillon', (get, set, step) => {
  if (!step.result) return;
  return { consequences: freeCons(resolveSeaCrisisRound(get, set, step.result.sl)) };
});

/** Extermination des nuisibles (MDG 14 l.98-104) : Test étendu, 1d10 h par Test — cumul mutualisé
 *  (`extendedTestStep`, #273 Étape 1 : consolidation arithmétique, cadence INCHANGÉE — un jet par jour). */
registerCascadeApplier('extermination', (get, set, step) => {
  if (!step.result) return;
  const sea = get().travelPlan?.sea;
  if (!sea?.infestation) return;
  const inf = sea.infestation;
  const rng = battleRng();
  const { total: progress, done } = extendedTestStep(inf.progress, step.result, inf.need, !!rule('test-extended-min-sl'));
  set({ gameTime: get().gameTime + rollDice(1, 10, rng) * 60 }); // « Chaque Test nécessite … 1d10 heures » (MDG 14 l.100)
  let j: string[];
  if (done) {
    patchSea(get, set, { infestation: undefined });
    j = [`${inf.label} : la vermine est exterminée (${progress}/${inf.need} DR).`];
  } else {
    patchSea(get, set, { infestation: { ...inf, progress } });
    j = [`${inf.label} : la purge avance (${progress}/${inf.need} DR).`];
  }
  noteSeaLine(get, set, j);
  return { consequences: freeCons(j) };
});

/** Renflouage d'un ÉCHOUAGE (MDG ch.13 l.471-473, #444) : Test de Force UNIQUE (pas étendu — RAW muet
 *  sur une répétition formelle) ; échec → le navire reste échoué, retenté le lendemain (même construction). */
registerCascadeApplier('sea-degagement', (get, set, step) => {
  if (!step.result) return;
  const sea = get().travelPlan?.sea;
  if (!sea?.stranded) return;
  const label = sea.stranded.label;
  const j = step.result.success
    ? [`Le navire est dégagé de ${label} (Test de Force réussi, MDG ch.13 l.473).`]
    : [`Le navire reste échoué sur ${label} — il faudra retenter (MDG ch.13 l.473).`];
  if (step.result.success) patchSea(get, set, { stranded: undefined });
  noteSeaLine(get, set, j);
  return { consequences: freeCons(j) };
});

/** Dégagement des Débris marins (MDG ch.13 l.491, #444) : Test ÉTENDU de Force (`hazard.freeTest`, total
 *  DR posé à la collision) — même cumul mutualisé que l'Extermination (`extendedTestStep`) ci-dessus. */
registerCascadeApplier('sea-degagement-debris', (get, set, step) => {
  if (!step.result) return;
  const sea = get().travelPlan?.sea;
  if (!sea?.entangled) return;
  const ent = sea.entangled;
  const { total: progress, done } = extendedTestStep(ent.progress, step.result, ent.need, !!rule('test-extended-min-sl'));
  let j: string[];
  if (done) {
    patchSea(get, set, { entangled: undefined });
    j = [`${ent.label} : le navire se dégage (${progress}/${ent.need} DR, MDG ch.13 l.491).`];
  } else {
    patchSea(get, set, { entangled: { ...ent, progress } });
    j = [`${ent.label} : le dégagement progresse (${progress}/${ent.need} DR).`];
  }
  noteSeaLine(get, set, j);
  return { consequences: freeCons(j) };
});

/** Voyage rapide (MDG 15 l.28) : le DR alimente le palier — calculé/persisté PUIS appliqué (embuscade
 *  ancrée éventuelle d'abord, jamais raconté avant — `finalizeFastVoyage` est RÉ-ENTRANT). */
registerCascadeApplier('voyage-rapide', (get, set, step) => {
  if (!step.result) return;
  computeFastPalier(get, set, step.result.sl);
  finalizeFastVoyage(get, set);
});

/** Entretien du soir (remplace le Métier à −2 DR, MDG 14 l.116-124 ; réparation TEMPORAIRE ch.13 l.647). */
registerCascadeApplier('entretien', (get, set, step) => {
  if (!step.result) return;
  const total = step.result.sl;
  const rng = battleRng();
  const adj = total + REPARATION.entretienCrewTestDR;
  let j: string[];
  if (adj >= 1) {
    const hull = get().travelPlan!.vehicle!;
    const healed = Math.min(hull.wounds.max - hull.wounds.current, rollDice(1, 10, rng));
    healVesselHull(get, set, hull, healed);
    j = [`Réparations de fortune : +${healed} Blessures de coque (Entretien ${adj >= 0 ? '+' : ''}${adj} DR après −2, MDG 14 l.122).`];
  } else j = [`Les réparations n'aboutissent pas cette nuit (Entretien ${adj} DR après −2).`];
  noteSeaLine(get, set, j);
  return { consequences: freeCons(j) };
});

// ── PANNE DE VAPEUR (MDG ch.12 l.313-352) — résolution first-class au voyage ─────────────────────

/** La personne qui « s'occupe du moteur » (MDG 12 l.326) à l'échelle voyage (équipage = les PJ, MDG 14
 *  l.39) : le meilleur au Métier (Ingénieur), sinon le premier PJ en état. */
function engineerOf(party: Combatant[]): Combatant | undefined {
  const apt = party.filter((h) => !h.dead && !h.outOfRencontre);
  return partyBest(apt, 'metier', undefined, undefined, 'Ingénieur')?.actor ?? apt[0];
}

/** Total d'une expression de dés « C+AdB » / « AdB » / « AdB-C » (params de la table Panne de Vapeur —
 *  « 1d10 », « 20+1d10 », « 1d10-5 »). PUR (RNG injecté). */
function rollDiceExpr(expr: string, rng: RNG): number {
  const m = /^(?:(\d+)\+)?(\d+)d(\d+)([+-]\d+)?$/.exec(expr.replace(/\s/g, ''));
  if (!m) { const n = parseInt(expr, 10); return isNaN(n) ? 0 : n; }
  return (m[1] ? parseInt(m[1], 10) : 0) + rollDice(parseInt(m[2], 10), parseInt(m[3], 10), rng) + (m[4] ? parseInt(m[4], 10) : 0);
}

/** Exécute les Tests de REDÉMARRAGE d'une panne (MDG 12 l.329-348) via la personne au moteur — Test
 *  étendu de Force (`extendedDR`) puis Test(s) de Métier (Ingénieur). Retourne le DR du DERNIER Test de
 *  redémarrage (« 5 − DR Rounds » de mise en pression, l.333). Tests d'AMBIANCE de voyage (« jusqu'à ce
 *  que quelqu'un réussisse », l.331 → retry borné) — équipage abstrait, hors modale (≠ la sauvegarde
 *  d'Initiative PERSO, seul jet influençable de la panne, cf. `openSteamSave`). */
function runRestart(get: Get, set: Set, eng: Combatant, restart: NonNullable<SteamBreakdownEntry['restart']>, rng: RNG): number {
  let lastDR = 0;
  for (const step of restart) {
    const value = testValue(eng, step.skillId, undefined, step.spec);
    const label = step.spec ? `${step.skillId} (${step.spec})` : step.skillId;
    if (step.extendedDR != null) {
      let total = 0;
      for (let i = 0; total < step.extendedDR && i < 20; i++) total += Math.max(0, rollTest(value, step.difficulty, rng).sl);
      tell(get, set, [`${eng.name} — ${label} ${DIFFICULTY_LABELS[step.difficulty]} (Test étendu ${step.extendedDR} DR) : ${total >= step.extendedDR ? 'obstacle dégagé.' : 'à la peine.'}`]);
    } else {
      let t = rollTest(value, step.difficulty, rng);
      for (let i = 0; !t.success && i < 20; i++) t = rollTest(value, step.difficulty, rng);
      lastDR = Math.max(0, t.sl);
      // Aucune rangée nulle part (équipage abstrait, hors modale) — le journal PORTE le jet (#295 Lot 5, gardé nominativement).
      tell(get, set, [`${eng.name} — ${label} ${DIFFICULTY_LABELS[step.difficulty]} : ${t.roll}/${t.target} → moteur relancé (DR ${lastDR}).`]);
    }
  }
  return lastDR;
}

/** Applique une PANNE DE VAPEUR (MDG ch.12 l.313-352) au voyage — CHAQUE champ first-class consommé :
 *  « Fuite de vapeur » (`failDamage`) ouvre la sauvegarde d'Initiative INFLUENÇABLE ; l'« Explosion »
 *  (`compartmentDamage`) frappe la personne au moteur (Perforante) ; le moteur détruit (`engineDestroyed`)
 *  ôte la propulsion à vapeur du navire ; le Coup Critique à la Coque (`hullCritical`) est roulé. Les
 *  effets de VITESSE (`mSet`/`mMod`, pendant `durationRounds`/`coolMinutes` + le redémarrage `restart`)
 *  IMMOBILISENT le moteur : la journée perd la fraction de milles correspondante (durée convertie en
 *  minutes via la règle maison `combat-round-seconds`, LDB 13 l.13). */
export function applySteamBreakdown(get: Get, set: Set, b: SteamBreakdownEntry, rng: RNG): void {
  // « Fuite de vapeur » (l.326-328) : un jet de vapeur ébouillante la personne au moteur → sauvegarde
  // d'Initiative INFLUENÇABLE (modale) ; échec = dégâts ignorant l'Armure. Suspend la boucle maritime.
  if (b.failDamage) { openSteamSave(get, set, b.failDamage, rng); return; }

  const eng = engineerOf(get().party);

  // « Explosion » (l.351-352) : quiconque dans le compartiment du moteur (la personne au moteur, équipage
  // abstrait) subit `compartmentDamage` Dégâts avec l'Atout Perforante.
  if (b.compartmentDamage != null && eng) {
    const boiler = buildWeapon({ name: 'Explosion de chaudière', damage: { plusBF: false, flat: 0 }, qualities: [{ id: QUALITY_IDS.Perforante }] }); // Dégâts passés directement (weaponHit) → la spec ne sert qu'aux qualités

    const lines = applyOps(eng, [{ op: 'wounds', amount: b.compartmentDamage, weaponHit: true }], { rng, weapon: boiler, location: 'corps' });
    set({ party: [...get().party] });
    tell(get, set, [`${eng.name} — souffle de l'explosion (${b.compartmentDamage} Dégâts, Perforante) :`, ...lines]);
  }

  // Moteur détruit : l'Amélioration Propulsion à vapeur saute (à ré-installer au chantier) → le navire
  // retombe sur ses voiles/avirons ou dérive pour le reste de la traversée.
  if (b.engineDestroyed && get().vessel) {
    set({ vessel: { ...get().vessel!, upgrades: (get().vessel!.upgrades ?? []).filter((u) => u.id !== 'propulsion-a-vapeur') } });
  }
  if (b.hullCritical) { const c = rollShipCritical('coque', rng); applyVesselCritical(get, set, c.log, c.note); }

  // IMMOBILISATION du moteur : fenêtre à vitesse réduite (`mMod`) ou nulle (`mSet:0`) → fraction perdue.
  const secPerRound = Number(rule('combat-round-seconds')); // LDB 13 l.13 (MJ décide, valeur maison)
  let windowMin = 0;
  if (b.durationRounds) windowMin += rollDiceExpr(b.durationRounds, rng) * secPerRound / 60; // « les 1d10 prochains Rounds »
  if (b.coolMinutes) windowMin += rollDiceExpr(b.coolMinutes, rng); // « attendre 20+1d10 minutes »
  if (b.restart && eng) windowMin += Math.max(0, 5 - runRestart(get, set, eng, b.restart, rng)) * secPerRound / 60; // « 5 − DR Rounds » de mise en pression
  if (windowMin > 0) {
    const miles0 = get().travelPlan?.sea?.milesToday ?? 0;
    const baseM = effectiveSeaM(get).m ?? 4;
    const speedFactor = b.mSet === 0 ? 0 : b.mMod ? Math.max(0, (baseM + b.mMod) / baseM) : 1; // vitesse pendant la fenêtre
    const miles = Math.max(0, Math.round(miles0 - miles0 * Math.min(1, windowMin / MINUTES_PER_DAY) * (1 - speedFactor)));
    if (miles !== miles0) {
      patchSea(get, set, { milesToday: miles });
      tell(get, set, [`Moteur immobilisé ~${Math.round(windowMin)} min — ${miles0 - miles} mille(s) perdu(s).`]);
    }
  }
}

/** Ouvre la sauvegarde d'Initiative INFLUENÇABLE d'une « Fuite de vapeur » (MDG 12 l.326-328) sur la
 *  personne au moteur — dégâts d'ébouillantage roulés d'avance (« 1d10–5 Dégâts (1 minimum) », ignorent
 *  l'Armure). Aucun équipage → rien à ébouillanter (la boucle reprend normalement). */
function openSteamSave(get: Get, set: Set, failDamage: string, rng: RNG): void {
  const eng = engineerOf(get().party);
  if (!eng) return;
  const dmg = Math.max(1, rollDiceExpr(failDamage, rng)); // « (1 minimum) » sur les Dégâts
  const value = testValue(eng, undefined, 'initiative'); // Test d'INITIATIVE (Difficulté par défaut : Intermédiaire +0)
  set({
    pendingSteamSave: {
      actorId: eng.id, actorName: eng.name, skillValue: value, difficulty: 'intermediaire',
      target: value + DIFFICULTY_MODIFIERS.intermediaire,
      scaldOps: [{ op: 'wounds', amount: dmg, ignoreTB: false, ignoreAP: true }], // « qui ignorent l'Armure » (le BE reste déduit)
      roll: null, success: false, sl: 0,
    } satisfies PendingSteamSave,
  });
}

/** Résout la sauvegarde d'Initiative d'une « Fuite de vapeur » (appelée par `steamSaveConfirm`) : ÉCHEC →
 *  ébouillanté (`scaldOps` déjà roulés), puis le RESTE de la journée reprend (la cascade `'progression'`
 *  s'était fermée SANS insérer la suite du jour, cf. son applier — `pendingSteamSave` suspendait). */
export function resolveSteamSave(get: Get, set: Set, p: PendingSteamSave): void {
  const eng = get().party.find((h) => h.id === p.actorId);
  // Le jet est DÉJÀ affiché par la rangée de `SteamSaveModal` (`p.roll`/`p.target`) — pas de re-print (#295 Lot 5).
  if (eng && !p.success) {
    const lines = applyOps(eng, p.scaldOps, { rng: battleRng(), now: get().gameTime });
    set({ party: [...get().party] });
    tell(get, set, [`${eng.name} — ébouillanté par le jet de vapeur !`, ...lines]);
  } else if (eng) {
    tell(get, set, [`${eng.name} — esquive le jet de vapeur.`]);
  }
  if (get().travelPlan?.sea) continueSeaDayFromPostProgression(get, set);
}

/** Reprend le RESTE du jour (crise/embuscade/phare/orientation/extermination/entretien,
 *  `buildPostProgressionSteps`) — utilisé par `resolveSteamSave` quand la cascade `'progression'` s'est
 *  fermée SANS insérer la suite (Fuite de vapeur suspendue entre-temps). Même décision immédiat/interactif
 *  que `runSeaDay`. */
function continueSeaDayFromPostProgression(get: Get, set: Set): void {
  const insert = buildPostProgressionSteps(get, set);
  if (!insert.length) { continueSeaDayAfterCascade(get, set); return; }
  if (get().net.mode === 'local' && seaAutoResolves(get().travelPlan?.orders, 'progression') && seaDayAllRoutine(get)) {
    const resolved = runCascadeImmediate(get, set, insert, { title: 'Journée en mer', purpose: 'travelDay' });
    if (get().battle || get().pendingCascade) return; // combat en plein vol OU choix sans défaut : surfacé, jamais résolu en silence
    pushDayEntries(get, set, resolved);
    continueSeaDayAfterCascade(get, set);
    return;
  }
  startCascade(get, set, { title: 'Journée en mer', icon: 'travel/wave', purpose: 'travelDay', steps: insert });
}

/** Ouvre l'embuscade AUTHORÉE d'une route de mer (couture UNIQUE, #212) — même pipeline que l'embuscade
 *  terrestre (« Attaqués ! », travelFlow) : interruption + scène + rencontre AUTHORÉES. `noSurprise` :
 *  la Poursuite (`startChaseBoarding`) a prévenu (défaut `true`) ; l'ancrage déterministe le fait dépendre
 *  du Test de Perception. Anti-double-feu par `sea.ambushFired`. Retourne `false` si rien à ouvrir. */
function openAuthoredSeaAmbush(get: Get, set: Set, route: MapRoute | undefined, noSurprise = true): boolean {
  const plan = get().travelPlan;
  if (plan?.sea?.ambushFired || !(route?.ambush?.scene && route.ambush.encounter)) return false;
  set({ travelPlan: { ...plan!, interrupted: true, sea: { ...plan!.sea!, ambushFired: true } } });
  get().transitionTo(route.ambush.scene, route.ambush.entry);
  get().startCombat(route.ambush.encounter, undefined, { noSurprise });
  return true;
}

/** Id de la Scène d'abordage GÉNÉRIQUE (construite à la volée, re-enregistrée à chaque abordage dérivé). */
const BOARDING_SCENE_ID = 'sea-boarding-generic';

/** Construit la Scène d'abordage GÉNÉRIQUE (ponts bord à bord) à partir du navire hostile de l'événement
 *  et de la coque de campagne — MÊME machinerie navale que les scènes authorées (`buildScene` + `enemies`
 *  terse : coque à PV + équipage exposé `crewIds`, cf. `16-embuscade-fluviale`/`ls-abordage-cogue`). La
 *  coque ennemie porte sa vague d'abordage (`boardingWaveSize` × `crewRef` + `chefRef`) comme équipage
 *  exposé (MDG ch.14) ; la coque de campagne est le camp allié (le groupe y EMBARQUE au `startCombat`). */
function buildBoardingScene(playerHullRef: string, playerHullName: string, b: SeaBoarding): Scene {
  const wave = Math.max(1, Math.round(Number(rule('boardingWaveSize'))));
  const chef = b.chefRef ? 1 : 0;
  // Équipage EXPOSÉ de la coque ennemie = la vague (crew + chef) : ids déterministes `enemy-enc-abordage-<i>`
  // (buildEncounter, index 0 = la coque elle-même → l'équipage commence à 1).
  const crewIds = Array.from({ length: wave + chef }, (_, i) => `enemy-enc-abordage-${i + 1}`);
  const enemies: AuthoredEnemy[] = [
    { ref: b.shipRef, pos: { x: 14, y: 6 }, label: b.label, crewIds },
    ...Array.from({ length: wave }, (_, i) => ({ ref: b.crewRef, pos: { x: 12, y: 3 + (i % 6) } })),
    ...(b.chefRef ? [{ ref: b.chefRef, pos: { x: 16, y: 6 } }] : []),
    { ref: playerHullRef, pos: { x: 3, y: 6 }, side: 'ally' as const, label: playerHullName },
  ];
  return buildScene({
    id: BOARDING_SCENE_ID,
    nom: `Abordage — ${b.label}`,
    size: [18, 12],
    terrain: 'planches',
    ambiance: 'exterieur',
    heroStart: [3, 7],
    startMessage: `${b.label} accoste bord à bord — repoussez l’abordage !`,
    encounters: [{ id: 'enc-abordage', enemies }],
  });
}

/** Ouvre l'abordage GÉNÉRIQUE dérivé de l'événement (`SeaBoarding`) : construit la Scène bord à bord,
 *  l'enregistre, INTERROMPT la traversée et lance le combat — MÊME couture de suspension/reprise que
 *  l'embuscade authorée (`openAuthoredSeaAmbush` : `interrupted` + `startCombat` suspend la cascade en
 *  cours, le teardown de victoire la reprend). Requiert une coque de campagne (le groupe est EN MER).
 *  Renvoie `false` si aucune coque de campagne n'est connue (impossibilité réelle, non simulable). */
function openGenericBoarding(get: Get, set: Set, b: SeaBoarding, noSurprise = true): boolean {
  const plan = get().travelPlan;
  if (!plan?.sea) return false;
  const playerHullRef = get().vessel?.vehicleId ?? plan.vehicle?.creatureId;
  if (!playerHullRef) return false;
  const playerHullName = get().vessel?.name ?? plan.vehicle?.name ?? 'Notre navire';
  registerScene(buildBoardingScene(playerHullRef, playerHullName, b));
  set({ travelPlan: { ...plan, interrupted: true, sea: { ...plan.sea, boarding: undefined } } });
  get().transitionTo(BOARDING_SCENE_ID, undefined);
  get().startCombat('enc-abordage', undefined, { noSurprise });
  return true;
}

/** Rattrapé par un navire hostile → ABORDAGE (MDG ch.13 l.420). Priorité : embuscade AUTHORÉE de la route
 *  (SURCHARGE d'auteur, jamais une condition d'existence) ; à défaut, l'abordage se DÉRIVE de l'événement
 *  lui-même (le navire hostile `sea.boarding` engendre la rencontre GÉNÉRIQUE bord à bord). En dernier
 *  recours SEULEMENT — événement sans navire nommé (Némésis authorée manquante) ou coque de campagne
 *  inconnue — l'impossibilité est journalisée HONNÊTEMENT (rien d'inventé, pas de pseudo-récit). */
function startChaseBoarding(get: Get, set: Set): void {
  const plan = get().travelPlan;
  const route = (get().worldMap as WorldMap | undefined)?.routes.find((r) => r.id === plan?.routeId);
  if (openAuthoredSeaAmbush(get, set, route)) return;
  const boarding = plan?.sea?.boarding;
  if (boarding && openGenericBoarding(get, set, boarding)) return;
  tell(get, set, ['Le navire hostile rompt le contact — aucune donnée d’abordage (coque/équipage) disponible pour cet événement.']);
}

/** Fuite = COURSE-POURSUITE (ch.13 l.354) : le seuil d'évasion suit la visibilité du jour (l.364-370).
 *  PARTAGÉE par la Némésis et par la fuite choisie face à la Cogue pirate. */
function startSeaPursuit(get: Get, set: Set, info: { label: string; desc: string }, foeM: number): void {
  const sea = get().travelPlan!.sea!;
  const escapeAt = sea.weather.visibilite === 'degage' ? 100 : sea.weather.visibilite === 'brume' ? 50 : 10;
  patchSea(get, set, {
    crisis: { kind: 'poursuite', label: info.label, distance: Math.floor(escapeAt / 2), escapeAt, foeM, foeSkill: 50, desc: info.desc },
  });
  tell(get, set, [`Le navire prend la fuite — Poursuite (Distance de départ ${Math.floor(escapeAt / 2)}, évasion à ${escapeAt} — MDG ch.13 l.362-370).`]);
}

/** Interpellation de la Cogue pirate (A5.3 #327) : cascade AUTONOME (patron Ouragan `resolveSeaDayEvent`)
 *  d'une SEULE étape de CHOIX — fuir / combattre / se soumettre. L'applier `sea-pirate-hail` reprend
 *  `runSeaDay` à la fermeture. Le pillage (`piratePillagePct`) et le tribut à Stromfels sont RAW-mués
 *  (MDG ch.15 p.131 décrit l'extorsion sans la chiffrer) → paramètre maison + choix joueur. */
/** Descripteur d'abordage DÉRIVÉ d'un événement de navire hostile — `undefined` si l'événement ne nomme
 *  ni coque (`ship`) ni équipage type (`crewRef`) : la Némésis (bateau fétiche d'un boss) est authorée,
 *  pas simulable (retour `undefined` = repli honnête de `startChaseBoarding`). */
function seaBoardingFromEvent(event: SeaEventDef): SeaBoarding | undefined {
  const p = event.params ?? {};
  const shipRef = typeof p.ship === 'string' ? p.ship : undefined;
  const crewRef = typeof p.crewRef === 'string' ? p.crewRef : undefined;
  if (!shipRef || !crewRef) return undefined;
  return { shipRef, crewRef, chefRef: typeof p.chefRef === 'string' ? p.chefRef : undefined, label: event.label };
}

function openPirateHail(get: Get, set: Set, event: SeaEventDef): void {
  const pillage = Number(rule('piratePillagePct'));
  patchSea(get, set, { boarding: seaBoardingFromEvent(event) });
  startCascade(get, set, {
    title: 'Cogue pirate', icon: 'nautical/wind', purpose: 'test',
    steps: [{
      id: 'sea-pirate-hail', kind: 'sea-pirate-hail', icon: 'nautical/wind', label: event.label,
      interactive: true, defaultChoice: 'fuir', meta: { crisisLabel: event.label, crisisDesc: event.desc },
      options: [
        { key: 'fuir', label: 'Prendre la fuite', detail: 'Course-poursuite : distancer la cogue (MDG ch.13 l.362-370).' },
        { key: 'combattre', label: 'Combattre', detail: 'Refuser l’abordage et se défendre — abordage immédiat.' },
        { key: 'soumettre', label: 'Se soumettre', detail: `Laisser fouiller la cale (${pillage} % de la cargaison pillée) puis livrer un tribut à Stromfels.` },
      ],
    }],
  });
}

/** CHOIX face à la Cogue pirate (A5.3 #327). fuir → Poursuite ; combattre → abordage immédiat ;
 *  se soumettre → pillage `piratePillagePct` de la cale + CHOIX du tribut (étape insérée). */
registerCascadeApplier('sea-pirate-hail', (get, set, step) => {
  const j: string[] = [];
  if (step.chosen === 'combattre') {
    startChaseBoarding(get, set); // abordage immédiat (rencontre AUTHORÉE de la route)
  } else if (step.chosen === 'soumettre') {
    const pct = Number(rule('piratePillagePct'));
    const vessel = get().vessel;
    if (vessel?.cargo?.length) {
      const r = spoilCargoByPct(vessel.cargo, pct);
      if (r.removed) set({ vessel: { ...get().vessel!, cargo: r.lots } });
      j.push(`Les forbans fouillent la cale et emportent ${r.removed} Enc de cargaison (${pct} %, MDG ch.15 p.131).`);
    } else j.push('Les forbans fouillent une cale vide — rien à prendre.');
    return { consequences: freeCons(j), insert: [{
      id: 'sea-pirate-tribute', kind: 'sea-pirate-tribute', icon: 'nautical/wind',
      label: 'Un prisonnier à sacrifier à Stromfels', interactive: true, defaultChoice: 'livrer',
      options: [
        { key: 'livrer', label: 'Livrer un membre d’équipage', detail: 'Un marin est emmené — perte réelle d’équipage, l’équipage est ébranlé.' },
        { key: 'refuser', label: 'Refuser', detail: 'Les forbans passent à l’abordage.' },
      ],
    }] };
  } else {
    startSeaPursuit(get, set, { label: String(step.meta?.crisisLabel ?? 'Cogue pirate'), desc: String(step.meta?.crisisDesc ?? '') }, 5);
  }
  // La reprise du jour à la fermeture de cette cascade (`purpose:'test'` en mer) est portée par
  // `dispatchCascadeDone` → `runSeaDay` (couture canonique de clôture, jamais un `setTimeout` ad hoc).
  return { consequences: freeCons(j) };
});

/** TRIBUT à Stromfels (A5.3 #327) : livrer un marin = perte réelle d'équipage (`applyVesselCrewLoss`) +
 *  déplaisir de Manann (facteur de Moral RAW −2d10, MDG ch.14 : sacrifier une âme à Stromfels, ennemi de
 *  Manann) ; refuser = abordage immédiat. AUCUNE perte silencieuse (tout dénoué au journal/à l'écran). */
registerCascadeApplier('sea-pirate-tribute', (get, set, step) => {
  const j: string[] = [];
  if (step.chosen === 'refuser') {
    j.push('Le tribut est refusé — les forbans passent à l’abordage.');
    startChaseBoarding(get, set);
  } else {
    for (const l of applyVesselCrewLoss(get, set, 1)) j.push(l);
    j.push('Un marin est livré aux pirates, sacrifié à Stromfels.');
    const ship = get().travelPlan?.vehicle;
    if (ship) for (const l of applyShipMoraleDelta(get, set, ship, -rollDice(2, 10, battleRng()))) j.push(l); // déplaisir de Manann (MDG ch.14)
  }
  return { consequences: freeCons(j) };
});

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

function resolveBoardEvent(get: Get, set: Set, event: SeaEventDef, rng: RNG, roll?: number): void {
  const num = (k: string, dflt = 0): number => eventParam(event, k, rng, dflt);
  tellEvent(get, set, { title: event.label, text: event.desc, roll });
  const vessel = get().vessel;
  const ship = get().travelPlan?.vehicle;
  switch (event.kind) {
    case 'usure': {
      if (!ship) break;
      const w = num('wounds', rollDice(1, 10, rng)) || rollDice(1, 10, rng);
      damageVesselHull(get, set, ship, w);
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
      // Test d'équipage d'Affaler Difficile (−20 → −2 DR plats) sinon 3 Critiques au Gréement. Kind
      // DISTINCT `sea-ouragan-affaler` (jamais `SEA_ROUTINE_KINDS` — une URGENCE interrompt TOUJOURS,
      // `voyageCadence.ts`), toujours en cascade INTERACTIVE (jamais l'auto-pilote).
      const st = buildVoyageCrewStep(get, 'affaler', 'sea-ouragan-affaler', { extraDR: -2, icon: 'nautical/wind' });
      if (st) startCascade(get, set, { title: 'Ouragan — Affaler !', icon: 'nautical/wind', purpose: 'test', steps: [st] });
      else for (let i = 0; i < 3; i++) { const c = rollShipCritical('greement', rng); applyVesselCritical(get, set, c.log, c.note); }
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
      // Garde IDENTIQUE à l'ancienne (« un prêtre existe-t-il ? ») — la porte résoudra ELLE-MÊME
      // l'acteur/la valeur soutenue via `partyBest` ; ce simple test d'existence ne duplique pas ce
      // calcul (mandat coordinateur : le call-site ne calcule plus la VALEUR, juste la CONDITION RAW).
      if (pd && partyAssisted(get().party, 'priere')) {
        // seam de jet (#275 Ronde 1) : `klass:'hero-test'` (le prêtre agit). La logique de présage
        // (bon/mauvais présage, `tellManann`/`applyShipMoraleDelta`) migre dans l'applier `sea-priere`
        // via `meta` SÉRIALISABLE (coop) — TOUJOURS `return` : surfacé → suspend ; inline → l'applier a
        // déjà tout appliqué (rien à refaire ici).
        openPartyTest(get, set, {
          skill: 'priere',
          actionLabel: 'Prière',
          difficulty: pd,
        }, 'sea-priere', { manannD, moraleD });
        return;
      }
      // Pas de Test de Prière requis, ou aucun prêtre : bon/mauvais présage s'applique d'office (RAW l.236).
      if (manannD) tellManann(get, set, manannD);
      if (moraleD && ship) {
        const delta = Math.sign(moraleD) * rollDice(Math.abs(moraleD), 10, rng);
        for (const l of applyShipMoraleDelta(get, set, ship, delta)) tell(get, set, [l]);
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
      // « Sans prévenir, le bateau se heurte à… » — le péril RENCONTRÉ (Iceberg/Débris marins/Rocher/
      // Bas-fonds, ch.13 l.475-499, #444) est TIRÉ (`pickSeaHazard`, pondération MAISON) : Dégâts =
      // IC du péril + M du navire, − BE de coque (formule inchangée, seul l'IC était en dur avant).
      if (!ship) break;
      const hazard = pickSeaHazard(rng);
      const eff = effectiveSeaM(get);
      const dmg = Math.max(0, hazard.ic + (eff.m ?? 1) - Math.floor((ship.characteristics?.endurance ?? 0) / 10));
      damageVesselHull(get, set, ship, dmg);
      tell(get, set, [`Collision : la coque encaisse ${dmg} Blessures (${hazard.label} IC ${hazard.ic}, MDG ch.13 l.446/475-499).`]);
      tell(get, set, spoilVesselCargoOnLeak(get, set)); // avarie de coque → voie d'eau (lot D #327)
      if (hazard.id === 'debris-marins') {
        // Empêtrement (l.485-491) : pénalité de Man/M par Taille du bateau, Test étendu de Force pour se dégager.
        const lengthM = findVehicleById(get().vessel?.vehicleId ?? '')?.ship?.lengthM ?? 0;
        const ent = rollDebrisEntangle(hazard, shipSizeOfLength(lengthM), rng);
        if (ent.entangled) {
          patchSea(get, set, {
            entangled: {
              hazardId: hazard.id, label: hazard.label,
              need: hazard.freeTest?.totalDR ?? 10, progress: 0,
              manDR: ent.manDR, mMod: ent.mMod,
              difficulty: hazard.freeTest?.difficulty ?? 'accessible',
            },
          });
          tell(get, set, [`Le navire s'empêtre dans les ${hazard.label} — Test étendu de Force pour se dégager (MDG ch.13 l.485-491).`]);
        }
      } else if (hazard.strandChancePct != null && rollStranding(hazard, rng)) {
        // Échouage (l.471-473/497/499) : Test de Force, pénalité = Encombrement navire + cargaison.
        const vessel = get().vessel;
        const shipEnc = findVehicleById(vessel?.vehicleId ?? '')?.enc ?? 0;
        const cargoEnc = (vessel?.cargo ?? []).reduce((s, c) => s + (c.enc ?? 0), 0);
        const difficulty = difficultyFromModifier(strandingPenalty(shipEnc, cargoEnc));
        patchSea(get, set, { stranded: { hazardId: hazard.id, label: hazard.label, difficulty } });
        tell(get, set, [`Le navire s'ÉCHOUE sur ${hazard.label} — Test de Force pour se dégager (MDG ch.13 l.473).`]);
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
    case 'nemesis':
      // Némésis : fuite forcée = COURSE-POURSUITE (ch.13 l.354), pas d'extorsion à négocier. Bateau fétiche
      // d'un boss (Wulfrik…) = rencontre AUTHORÉE : pas de descripteur dérivable (clear anti-report périmé).
      patchSea(get, set, { boarding: undefined });
      startSeaPursuit(get, set, event, 6);
      break;
    case 'navire-hostile':
      // Cogue pirate (MDG ch.15 p.131) : les forbans exigent de fouiller la cale — CHOIX joueur
      // fuir / combattre / se soumettre (A5.3 #327), en cascade interactive avant la journée.
      openPirateHail(get, set, event);
      break;
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

/** Permission de faire RELÂCHE À TERRE en attente de CHOIX joueur (MDG 15 l.245), posée à l'accostage
 *  AVANT le tirage de l'événement de port — `resolveShoreLeave` tranche puis enchaîne `resolvePortArrival`
 *  et la transition de scène (le lieu d'arrivée `to` porte la scène/l'entrée à rejoindre). */
export interface PendingShoreLeave {
  to: MapPlace;
}

/** Ouvre le PORT d'un lieu (arrivée en mer OU Effet scripté `openPort`) — SOURCE UNIQUE : avec profil de
 *  port (`to.port`) → relâche à terre en attente de décision (`pendingShoreLeave`, MDG 15 l.245) ; sans
 *  profil (destination sans port) → résout directement (rien à jouer) et transitionne à la scène du lieu.
 *  Appelée par `continueSeaDayAfterCascade` (accostage) et le handler `openPort` (state/combatEffects) —
 *  jamais un doublon de cette décision. */
export function openPortAt(get: Get, set: Set, to: MapPlace): void {
  if (to.port) {
    set({ pendingShoreLeave: { to } });
    return;
  }
  resolvePortArrival(get, set, to.port, battleRng(), true);
  get().transitionTo(to.scene, to.entry);
}

/** ÉVÉNEMENT DE PORT (2d10 ± Humeur, ch.15 l.127-129 + Tableau l.239-263). `shoreLeave` = permission de
 *  faire relâche à terre accordée par le capitaine (`resolveShoreLeave`, MDG 15 l.245) : gate DEUX entrées
 *  de la table qui la référencent nommément — Embrigadement (l.245, « cet événement n'a pas lieu » si
 *  refusée) et Fête de Manann (l.260, le bonus d'Humeur suppose « le capitaine autorise… à faire relâche »).
 *  Les 19 autres entrées (Prêtre de Manann, Contrôle à quai, Tempête, Port désert, Gangs des quais, La
 *  tache noire, Pénuries, Pas d'événement, Constructeur itinérant, Trop beau pour être vrai, Beau temps,
 *  Passager clandestin, Rumeurs commerciales, Offre de mission, Bonne pêche, Saturation de produits…) ne
 *  mentionnent pas la relâche à terre — vérifié entrée par entrée (MDG 15 l.243-263) — donc non gatées. */
export function resolvePortArrival(get: Get, set: Set, port: PortProfile | undefined, rng: RNG, shoreLeave = true): void {
  const vessel = get().vessel;
  const mood = vesselManann(vessel);
  const { roll, hours, event } = rollPortEvent(mood.score, rng);
  log(get, set, [`Événement de port (2d10 ${roll}) — ${event.label} (dans les ${hours} heures)`, event.desc]);
  // #150 : `travelPlan` est déjà remis à `null` par `continueSeaDayAfterCascade` avant cet appel (l'arrivée l'annule) —
  // le lire ici renverrait TOUJOURS `undefined`. La coque se reconstruit depuis l'état PERSISTANT
  // (`get().vessel`, comme `buildSeaPlan`/`effectiveSeaM` le font via `voyageShip`).
  const ship = voyageShip(get)?.hull;
  switch (event.kind) {
    case 'fete-manann':
      // MDG 15 l.260 : le bonus d'Humeur suppose la relâche autorisée ET l'équipage sincèrement
      // joint aux festivités — modélisé par la même permission que l'Embrigadement (l.245).
      if (!shoreLeave) { log(get, set, ['Relâche refusée : l\'équipage ne se joint pas aux festivités de Manann.']); break; }
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
      // « Si vous avez refusé la permission de faire relâche à terre à votre équipage, cet événement
      // n'a pas lieu » (MDG 15 l.245) — gate sur la décision `resolveShoreLeave`.
      if (!shoreLeave) { log(get, set, ['Relâche refusée : l\'Embrigadement n\'a pas lieu (l\'équipage reste à bord).']); break; }
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

/** Résout le choix « Relâche à terre » (MDG 15 l.245) posé à l'accostage, AVANT le tirage de
 *  l'événement de port : `allow` accordé → Embrigadement/Fête de Manann peuvent se produire
 *  normalement ; refusé → l'Embrigadement « n'a pas lieu » et la Fête de Manann perd son bonus
 *  d'Humeur (gate porté par `resolvePortArrival`). Enchaîne le tirage puis la transition de scène. */
export function resolveShoreLeave(get: Get, set: Set, allow: boolean): void {
  const p = get().pendingShoreLeave;
  if (!p) return;
  set({ pendingShoreLeave: null });
  log(get, set, [allow
    ? 'Vous autorisez l\'équipage à faire relâche à terre.'
    : 'Vous refusez à l\'équipage la permission de faire relâche à terre.']);
  // Désertion à la relâche ACCORDÉE (MDG 14 l.192-202) — retour de permission = moment du tirage. Seam
  // de jet (#275 Ronde 1, delta « désertion ») : `klass:'subi'`, côté `worldSide` (aucun `actorId` — un
  // marin PNJ n'est pas un `Combatant`) ; `meta.baseValue` = le SEUIL d100 posé par la bande de Moral
  // (obligation `rollSeam.ts` : un côté sans acteur DOIT le fournir, sinon `buildMonoStep` poserait
  // `base=0`). Le RÉSULTAT MÉCANIQUE (nombre de déserteurs) reste la boucle d100/marin INCHANGÉE,
  // exécutée dans l'applier `sea-desertion` — même patron que `rollShipCritical` dans les appliers
  // d'Affaler/Ouragan (une conséquence peut tirer SES PROPRES dés, indépendants du jet d'étape qui l'a
  // déclenchée) : l'étape n'est que le VECTEUR de visibilité MJ (owner MJ, delta 1), pas la source des
  // départs — sans quoi UN d100 représentatif ne pourrait jamais rejouer N tirages indépendants.
  const vessel = get().vessel;
  const threshold = allow && vessel ? moraleBand(vessel.morale.score).desertionRoll : 0;
  if (threshold) {
    openWorldTest(get, set, {
      ownerId: vessel!.vehicleId,
      actionLabel: 'Désertion',
      difficulty: 'intermediaire',
    }, 'sea-desertion', { baseValue: threshold });
    const casc = get().pendingCascade;
    if (casc) { set({ pendingCascade: { ...casc, portArrival: { toPlaceId: p.to.id, allow: true } } }); return; } // surfacé (V) → la clôture finalise l'accostage (`dispatchCascadeDone` → `finalizePortArrival`)
    finalizePortArrivalTo(get, set, p.to, true); // inline : le test s'est auto-résolu (l'applier a joué la désertion) → accoster maintenant
    return;
  }
  finalizePortArrivalTo(get, set, p.to, allow);
}

/** Finalise un ACCOSTAGE (MDG 15 l.245) : événement de port (`resolvePortArrival`, qui peut ouvrir SA
 *  propre cascade) puis transition vers la scène du lieu. SOURCE UNIQUE des deux gestes enchaînés,
 *  partagée par `resolveShoreLeave` (inline) et la clôture de cascade surfacée (`dispatchCascadeDone`). */
export function finalizePortArrivalTo(get: Get, set: Set, to: MapPlace, allow: boolean): void {
  resolvePortArrival(get, set, to.port, battleRng(), allow);
  get().transitionTo(to.scene, to.entry);
}

/** Clôture d'une cascade `portArrival` (désertion à la relâche surfacée, #387) : résout le lieu par id
 *  puis finalise l'accostage. Appelée par `dispatchCascadeDone` — `pendingCascade` est DÉJÀ null. */
export function finalizePortArrival(get: Get, set: Set, arrival: { toPlaceId: string; allow: boolean }): void {
  const to = placeById(get().worldMap as WorldMap, arrival.toPlaceId);
  if (to) finalizePortArrivalTo(get, set, to, arrival.allow);
}

/** Désertion (MDG 14 l.192-202, `klass:'subi'`) : la boucle d100/marin réelle (INCHANGÉE, même seuil,
 *  mêmes tirages via `battleRng()`) vit ICI — l'étape `sea-desertion` n'est que le vecteur de visibilité
 *  MJ. La FINALISATION de l'accostage (`finalizePortArrival`) est portée par le champ `portArrival` de la
 *  cascade et jouée à sa clôture par `dispatchCascadeDone` (#387) — plus de `setTimeout` de reprise. */
registerCascadeApplier('sea-desertion', (get, set, step) => {
  if (!step.result) return;
  const journal = resolveShoreLeaveDesertion(get, set, battleRng());
  return { consequences: freeCons(journal) };
});
