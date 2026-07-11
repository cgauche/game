/**
 * Flux de VOYAGE (#T2) — résolution jour par jour d'un trajet sur la carte du monde.
 *
 * RAW (section « Voyage » du LDB, fichier source `51 - Magie du Chaos.md`) :
 *  - vitesse = Déplacement en km/h, le plus lent du groupe à pied (l.222) ; diligence M6 / barge M8
 *    (l.210-219, prix par km par passager — débités AVANT le départ) ;
 *  - 6 h de voyage par jour sans Test ; au-delà (marche forcée), Test de Résistance ou Exténué,
 *    +1 si Encombré (l.224) — à pied seulement (les passagers d'un transport ne marchent pas) ;
 *  - fatigue d'Encombrement par journée de voyage (LDB p.295, `travelFatigue`) — à pied ;
 *  - péripéties (l.237) : d10 quotidien, événement sur `perilDie` (défaut 8, paramétrable, 0 = off)
 *    → tirage sur la table VERBATIM (`data/peripeties.ts`) ; en PLUS, péripéties d'AUTEUR par route
 *    (probabilité par jour + Effects d'éditeur).
 *
 * Chaque nuit en route : HALTE — la modale de Repos s'ouvre (campement, ou auberge de relais si la
 * route en a — `MapRoute.inns`) et le voyage se SUSPEND ; le « Continuer » du bilan reprend la
 * route au matin (`continueTravelAfterNight`). Le RAPPORT DU JOUR (km, jets, péripéties) s'affiche
 * DANS la halte du soir (`pendingRest.travelDay`) — chaque journée se lit le soir même, avec ses
 * conséquences ; le recap final ne couvre que le DERNIER segment (plus de déroulé intégral).
 *
 * Une péripétie qui déclenche un combat/une transition INTERROMPT le voyage : `travelPlan` mémorise
 * la progression (`kmDone`) et la carte propose « Reprendre le voyage » (`resumeTravel`).
 */
import { battleRng } from './battleRng';
import { bus, EVT } from './bus';
import { applyEffectsLoot } from './combatFlow';
import { openRest, placesOfKind } from './restFlow';
import { placeById, placeOfScene, otherEnd, type MapRoute, type WorldMap } from './worldMap';
import {
  TravelMode, TRAVEL_DEFAULTS, TRAVEL_MODE_LABEL, travelSpeed, transportCost, forcedMarchTest, applyTravelFatigue,
  vehicleTravel,
} from '../engine/travel';
import {
  type Allure, ALLURE_KMH_PER_M, ALLURE_LABEL, mountProfileById, partyMounts, partyFullyMounted, resolveMountedDay,
} from '../engine/mountTravel';
import { vehicleCombatant, applyVehicleProblem } from '../engine/vehicle';
import { rollVehicleProblem } from '../engine/travelTables';
import { applyOps } from '../engine/ops';
import { applyFall } from './combatEffects';
import { findVehicleById } from '../data';
import { PERIPETIES } from '../data/peripeties';
import { rollTest, testDetail } from '../engine/tests';
import { partyAssisted } from '../engine/skills';
import { addCondition, removeCondition, stacks } from '../engine/conditions';
import { subtract as moneySub, canAfford, formatMoney } from '../engine/money';
import { d10, d100 } from '../engine/dice';
import { rule } from '../engine/policy';
import { toDate } from '../engine/clock';
import { seasonOfMonth, rollStageWeather, WEATHER_LABEL, type Season } from '../engine/travelStages';
import { stageAssignmentFromRoles, type StagePosting } from '../engine/activities';
import { buildStageSteps, type StageContext } from './travelPostes';
import { startCascade, registerCascadeApplier } from './cascade';
import { freeCons } from './rollSeam';
import type { CascadeStep } from './pendings';
import { buildSeaPlan, runSeaDay, startFastVoyage, syncHullWoundsFromVessel } from './seaVoyageFlow';
import { buildRiverPlan, runRiverDays } from './riverVoyageFlow';
import { humanControlled } from './netOwnership';
import { DIFFICULTY_MODIFIERS, type Combatant } from '../engine/types';

import type { Get, Set } from './flowTypes';

/** Une journée du récapitulatif de voyage (audit M4) : progression + ce qui s'y est passé. */
export interface TravelRecapDay {
  kmFrom: number;
  kmTo: number;
  hours: number;
  /** Fatigue, péripéties narratives, entretien… (les mêmes lignes que le journal). */
  lines: string[];
  /** Les JETS du jour (marche forcée, Survie, Perception…) en lignes de jet structurées —
   *  même brique multijet que le bilan de nuit (MultiRollList), pas du texte. */
  entries?: import('./restFlow').NightEntry[];
  /** MER (route COMMANDÉE) : instantané du jour pour l'écran de traversée (rose des vents + jauges +
   *  distance restante) — rendu par `SeaVoyageScreen` à la place du corps de recap terrestre. */
  sea?: import('./seaVoyageFlow').SeaRecapChrome;
}

/** Suite DIFFÉRÉE derrière le récit du voyage (embuscade d'auteur ou « Attaqués ! » de la table
 *  d10) : le combat ne démarre qu'à l'ACQUITTEMENT du recap — d'abord comprendre ce qui arrive,
 *  ensuite se battre. Fermer la modale (bouton/Échap) DÉCLENCHE la suite : pas d'évitement. */
export type TravelThen =
  | { kind: 'effects'; effects: import('./scene').Effect[] }
  | { kind: 'ambush'; scene: string; entry?: string; encounter: string; noSurprise: boolean };

/** Récapitulatif d'un segment de voyage — la résolution étant SYNCHRONE (l'horloge saute en
 *  bloc), le joueur n'en voyait rien hors journal (audit M4) : modale à l'arrivée, à
 *  l'interruption (péripétie) et à l'arrêt (surcharge). */
export interface TravelRecap {
  fromLabel: string;
  toLabel: string;
  mode: TravelMode;
  status: 'arrived' | 'interrupted' | 'stalled';
  km: number;
  kmDone: number;
  days: TravelRecapDay[];
  /** Embuscade en attente : déclenchée par `dismissTravelRecap` (le récit passe AVANT le combat). */
  then?: TravelThen;
}

/** Voyage en cours / interrompu (persiste pour « Reprendre le voyage »). */
export interface TravelPlan {
  routeId: string;
  fromPlaceId: string;
  toPlaceId: string;
  mode: TravelMode;
  /** Classe du transport payant (interieur/exterieur, cabine/pont). */
  classKey?: string;
  /** Allure choisie (heures de route par jour ; > heures RAW = marche forcée). */
  hoursPerDay: number;
  /** Allure EDOC (règle `travel-allures`) : en selle = pas/trot/galop (EDOC 07 l.140-144) ; sur un
   *  attelage, `'galop'` = allure forcée (EDOC 07 l.229). Absent = cadence de base. */
  allure?: Allure;
  /** Attelage « Endommagé » (Problème de véhicule) : au pas jusqu'à réparation (EDOC 07 l.272-280). */
  vehicleLame?: boolean;
  km: number;
  kmDone: number;
  /** Interrompu par une péripétie (combat/transition) — reprise via `resumeTravel`. */
  interrupted: boolean;
  /** ORDRES permanents de la traversée (couche `voyageCadence`) : cadence COMMANDÉE (routine auto-résolue,
   *  PV du jour) ou JOUR-PAR-JOUR (modale par jet). Consommé par la mer ET le fluvial. */
  orders?: import('./voyageCadence').VoyageOrders;
  /** Postes d'Activité de l'Étape : un héros → ≤1 Activité (EDOC ch.5). Initialisé depuis les rôles
   *  PERSISTANTS (`travelRole`) au départ, réutilisé chaque Étape (0 ré-assignation par jour). */
  postes?: Record<string, StagePosting>;
  /** Cumul du Test ÉTENDU de cartographie (Établir des cartes, EDOC l.161) — cf. `extendedTestStep`. */
  extendedProgress?: number;
  /** Coque transitoire du véhicule du trajet (`Combatant`, depuis `vehicles.json` hull) — encaisse les
   *  incidents (`vehicleWounds`). Présente seulement si le trajet utilise un véhicule à coque.
   *  Route MARITIME : la coque du NAVIRE DE CAMPAGNE (Blessures persistées sur `vessel.wounds`, #30). */
  vehicle?: Combatant;
  /** État NAVAL du trajet (route `sea` — MDG ch.13/15) : météo/vent, événements, crises, étape du jour.
   *  Présent = la résolution du jour est déléguée à `seaVoyageFlow.runSeaDays`. */
  sea?: import('./seaVoyageFlow').SeaVoyageState;
  /** État FLUVIAL du trajet (route `river`, mode barge — T2C ch.5) : vent, dérive/chavirage, jours à flot.
   *  Présent = la résolution du jour est déléguée à `riverVoyageFlow.runRiverDays`. */
  river?: import('./riverVoyageFlow').RiverVoyageState;
  /** CONTEXTE TRANSITOIRE de l'Étape EDOC en cours (météo/saison/postes accumulés) — posé par
   *  `buildStageSteps`, lu par les appliers de poste/exposition, effacé à la clôture du jour. Jamais
   *  persisté au-delà d'une journée. */
  stage?: StageContext;
  /** CONTEXTE TRANSITOIRE du JOUR terrestre EN COURS (posé par `buildTravelDayCascade`, lu et effacé par
   *  `continueTravelDayAfterCascade`) : ce que la clôture de la cascade `travelDay` relit pour enchaîner
   *  la halte de nuit / l'arrivée. Recopie de variables du jour, aucune règle neuve. Jamais persisté. */
  land?: LandDayContext;
  /** Récapitulatif du SEGMENT en cours (audit M4), stocké sur le plan quand la journée SUSPEND sur la
   *  cascade `travelDay` : `continueTravelDayAfterCascade` le relit et le finalise (le `recap` local du
   *  `while` de `runTravelDays` ne survit pas à la suspension). Transitoire — effacé à la finalisation. */
  recap?: TravelRecap;
}

/** Entrées d'une journée de route terrestre, figées au build de la cascade `travelDay` : l'horloge/les
 *  km avancent AVANT la cascade (marche terrestre déterministe — heures × vitesse, comportement
 *  conservé ; seuls les JETS d'Étape/péripétie sont influençables), donc la clôture n'a plus qu'à
 *  enchaîner. Porte la destination, les héros en marche forcée (→ cascade de NUIT), le résultat
 *  d'INTERRUPTION d'une péripétie (combat/embuscade différé), et `arrived`. Jamais persisté au-delà d'une
 *  journée. La ligne de récap du jour vit dans `plan.recap.days[dernier]` (le `while` la relit). */
export interface LandDayContext {
  toScene: string;
  toEntry?: string;
  toLabel: string;
  destLabel: string;
  marchHeroes: string[];
  /** Longueur du journal au DÉBUT de la cascade du jour : le récap du jour (`recapDay.lines`, affiché
   *  dans la halte de nuit / au recap d'arrivée) reçoit la tranche écrite depuis là (jets d'Étape,
   *  Exposition, péripéties) — les lignes de la cascade n'y vont pas d'elles-mêmes. */
  journalMark: number;
  /** INTERRUPTION posée par une péripétie (le voyage s'arrête, le combat/l'embuscade attend le recap). */
  interrupt?: TravelThen;
  /** Attelage FORCÉ (#270) : progression/conséquences du jour ACCUMULÉES par la chaîne de jets
   *  `landForcedPace`/`landForcedPaceControl`, relues à la clôture pour poser `kmDone`/`gameTime`
   *  (DIFFÉRÉS depuis le build, comme la vitesse fluviale `RiverDayContext`). Absent = conducteur non
   *  humain (chemin synchrone `forcedPaceDay`, kmDone/gameTime déjà posés au build). */
  forcedPaceResult?: { km: number; hours: number; vehicleOut: boolean; vehicleLame: boolean };
}

const log = (get: Get, set: Set, lines: string[]) => {
  if (lines.length) set({ journal: [...get().journal.slice(-40), ...lines] });
};

/** Heures de voyage/jour SANS Test (RAW l.224, défaut 6) — paramétrable au niveau carte. */
export function baseHoursPerDay(map: WorldMap | null): number {
  return map?.params?.hoursPerDay ?? TRAVEL_DEFAULTS.hoursPerDay;
}

/** Plafond de marche forcée (heures/jour) — LDB 51 l.195 : silence, valeur maison (défaut 10),
 *  paramétrable au niveau carte. */
export function maxHoursPerDay(map: WorldMap | null): number {
  return map?.params?.forcedMaxHours ?? TRAVEL_DEFAULTS.forcedMaxHours;
}

/** Démarre un voyage depuis le lieu courant le long d'une route de la carte. */
export function startTravel(
  get: Get, set: Set,
  routeId: string,
  mode: TravelMode,
  opts: { classKey?: string; hoursPerDay?: number; allure?: Allure; seaPace?: number; fast?: boolean; cadence?: import('./voyageCadence').VoyageCadence } = {},
): void {
  const { worldMap, scene, battle, party } = get();
  if (battle || !worldMap || !scene) return;
  const from = placeOfScene(worldMap, scene.id);
  const route = worldMap.routes.find((r) => r.id === routeId);
  if (!from || !route || (route.a !== from.id && route.b !== from.id)) return;
  if (route.from != null && route.from !== from.id) return; // route à sens unique : pas dans ce sens
  // « En selle » suit les mêmes chemins qu'à pied (mode IMPLICITE des routes `pied`) — règle
  // `travel-allures` (EDOC ch.4) et chaque héros vivant en selle (EDOC 07 l.140).
  if (mode === 'monture' && (!rule('travel-allures') || !partyFullyMounted(party))) return;
  if (!route.modes.includes(mode === 'monture' ? 'pied' : mode)) return;
  const to = placeById(worldMap, otherEnd(route, from.id));
  if (!to) return;

  // Route MARITIME (MDG ch.13-15) : se voyage sur le NAVIRE DE CAMPAGNE — mode 'mer', distance en
  // MILLES, résolution du jour déléguée à `seaVoyageFlow` (météo/vent, Tests d'équipage, événements).
  if (mode === 'mer') {
    if (!route.sea) return;
    // Traversée RAPIDE (MDG 15 l.21-37) : un seul Test de Rude épreuve résout tout le trajet.
    if (opts.fast) {
      if (!startFastVoyage(get, set, routeId, from.id, to.id, route, { pace: opts.seaPace, cadence: opts.cadence })) {
        log(get, set, ['Aucun navire de campagne en état de prendre la mer — pas de traversée.']);
      }
      return;
    }
    const seaPlan = buildSeaPlan(get, routeId, from.id, to.id, route, { pace: opts.seaPace, cadence: opts.cadence });
    if (!seaPlan) {
      log(get, set, ['Aucun navire de campagne en état de prendre la mer — pas de traversée.']);
      return;
    }
    set({ travelPlan: seaPlan, worldMapOpen: false, travelRecap: null });
    log(get, set, [`— ${seaPlan.vehicle!.name} appareille vers ${to.label} (${route.km} milles) —`]);
    runSeaDay(get, set);
    return;
  }
  if (route.sea) return; // une route maritime ne s'emprunte qu'en mode 'mer'

  // Route FLUVIALE JOUÉE (T2C ch.5 « Navigation fluviale ») : sur une embarcation (barge…), la descente
  // se JOUE jour par jour (Test de Navigation, table des vents, périls, chavirage) au lieu d'un transport
  // payant. Repli sur le transport payant (« on paie un passeur ») si aucun batelier/embarcation.
  if (route.river && mode !== 'pied' && mode !== 'monture' && findVehicleById(mode)?.ship) {
    const riverPlan = buildRiverPlan(get, routeId, from.id, to.id, route, { cadence: opts.cadence });
    if (riverPlan) {
      set({ travelPlan: riverPlan, worldMapOpen: false, travelRecap: null });
      log(get, set, [`— ${riverPlan.vehicle!.name} descend le fleuve vers ${to.label} (${route.km} km, navigation fluviale) —`]);
      runRiverDays(get, set);
      return;
    }
    // Pas de batelier/embarcation : on retombe sur le transport payant (passeur).
  }

  // Transport payant : prix par km PAR PASSAGER (l.207), débité au départ — refus si bourse insuffisante.
  if (mode !== 'pied' && mode !== 'monture') {
    const passengers = party.filter((h) => !h.dead && !h.outOfRencontre).length;
    const cost = transportCost(route.km, mode, opts.classKey ?? '', passengers, route.prices?.[mode]);
    if (!cost) return; // mode sans facette `travel` (id de véhicule invalide) — rien à débiter, rien à jouer
    const purse = get().money;
    if (!canAfford(purse, cost)) {
      log(get, set, [`Le passage (${TRAVEL_MODE_LABEL[mode].toLowerCase()}, ${formatMoney(cost)}) dépasse les moyens du groupe.`]);
      return;
    }
    set({ money: moneySub(purse, cost)! });
    log(get, set, [`Le groupe paie son passage : ${formatMoney(cost)} (${TRAVEL_MODE_LABEL[mode].toLowerCase()}).`]);
  }

  // Allure EDOC (règle `travel-allures`) : en selle, pas/trot/galop (EDOC 07 l.140) ; sur un attelage,
  // « pas de course » forcé (EDOC 07 l.229) — seulement si le véhicule a un attelage (`travel.draft`).
  const allure: Allure | undefined = mode === 'monture'
    ? (opts.allure ?? 'pas')
    : opts.allure === 'galop' && rule('travel-allures') && vehicleTravel(mode)?.draft ? 'galop' : undefined;

  const base = baseHoursPerDay(worldMap);
  const hours = mode === 'pied'
    ? Math.min(Math.max(opts.hoursPerDay ?? base, 1), maxHoursPerDay(worldMap))
    : mode === 'monture'
      ? Math.min(Math.max(opts.hoursPerDay ?? base, 1), 12) // « au pas jusqu'à 12 heures sans repos » (EDOC 07 l.142)
      : base; // transport : cadence quotidienne du véhicule — LDB 51 silence, valeur maison (heures de route standard)
  // Coque transitoire du véhicule du trajet (`Combatant` à PV depuis `vehicles.json` hull) — encaisse les
  // Dégâts des Problèmes de véhicule (`applyVehicleProblem`). Créée sous les Étapes EDOC, ou dès que
  // l'allure est FORCÉE (EDOC 07 l.253 : Échec Stupéfiant de Conduite d'attelage → Problème de véhicule).
  const vehicle = mode !== 'pied' && mode !== 'monture' && (rule('travel-etapes') || allure === 'galop')
    ? (() => { const v = findVehicleById(mode); return v ? vehicleCombatant(v) : undefined; })()
    : undefined;
  const plan: TravelPlan = {
    routeId, fromPlaceId: from.id, toPlaceId: to.id, mode,
    classKey: opts.classKey, hoursPerDay: hours, km: route.km, kmDone: 0, interrupted: false,
    ...(allure ? { allure } : {}),
    // Postes initialisés depuis les rôles PERSISTANTS (`travelRole`) — réutilisés chaque Étape (EDOC ch.5).
    postes: rule('travel-etapes') ? stageAssignmentFromRoles(party) : undefined,
    ...(vehicle ? { vehicle } : {}),
  };
  set({ travelPlan: plan, worldMapOpen: false, travelRecap: null });
  const allureLabel = allure ? `, ${ALLURE_LABEL[allure].toLowerCase()}` : '';
  log(get, set, [`— En route vers ${to.label} (${route.km} km, ${TRAVEL_MODE_LABEL[mode].toLowerCase()}${allureLabel}) —`]);
  runTravelDays(get, set);
}

/** Reprend un voyage interrompu (après une embuscade, par exemple). */
export function resumeTravel(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan || get().battle) return;
  if (get().travelRecap?.then) return; // une embuscade ATTEND son acquittement — pas d'esquive
  // #296 — RECHARGE la coque de trajet depuis `vessel.wounds` (SOURCE UNIQUE) avant de reprendre : un
  // combat naval interrompant le voyage écrit sa fin sur `vessel` (`finalizeBattle`), jamais sur cette
  // copie de travail restée en mémoire — sans ce rechargement, le prochain Dégât/soin de coque du voyage
  // écraserait la valeur fraîche avec l'ancienne (persistance au coup par coup, `damageVesselHull`).
  let vehicle = plan.vehicle;
  const vessel = get().vessel;
  if (vehicle && vessel && vehicle.creatureId === vessel.vehicleId) {
    vehicle = { ...vehicle };
    syncHullWoundsFromVessel(vehicle, vessel);
  }
  set({ travelPlan: { ...plan, interrupted: false, ...(vehicle ? { vehicle } : {}) }, worldMapOpen: false, travelRecap: null });
  log(get, set, ['— Le voyage reprend —']);
  // Mer (#275 Ronde 2 cran 3, Décision c) : `runSeaDay` ne ré-entre PLUS de FSM — si une cascade de
  // voyage vit ENCORE (suspendue derrière le combat qui vient de finir), son garde de tête est un no-op
  // (l'arbitre la remontre) ; sinon elle enchaîne le jour suivant (`buildSeaDayCascade`).
  if (plan.sea) { runSeaDay(get, set); return; }
  if (plan.river) { runRiverDays(get, set); return; } // descente fluviale : résolution fluviale
  runTravelDays(get, set);
}

/** Boucle jour par jour jusqu'à l'arrivée (ou l'interruption par une péripétie). */
function runTravelDays(get: Get, set: Set): void {
  const worldMap = get().worldMap!;
  const base = baseHoursPerDay(worldMap);
  // Récapitulatif du SEGMENT (audit M4) — depuis le départ, ou depuis la reprise.
  const plan0 = get().travelPlan;
  const recap: TravelRecap | null = plan0 ? {
    fromLabel: placeById(worldMap, plan0.fromPlaceId)?.label ?? '?',
    toLabel: placeById(worldMap, plan0.toPlaceId)?.label ?? '?',
    mode: plan0.mode, status: 'arrived', km: plan0.km, kmDone: plan0.kmDone,
    days: [], // SEGMENT courant seulement — les journées passées ont été lues à leur halte du soir
  } : null;
  const finishRecap = (status: TravelRecap['status'], then?: TravelThen) => {
    if (!recap) return;
    recap.status = status;
    recap.kmDone = get().travelPlan?.kmDone ?? recap.km;
    set({ travelRecap: { ...recap, days: [...recap.days], then } });
  };
  let guard = 0;
  while (true) {
    guard += 1;
    if (guard > 400) break; // garde-fou (durée d'année) — un trajet ne dure jamais autant
    const plan = get().travelPlan;
    if (!plan || plan.interrupted) return;
    const route = worldMap.routes.find((r) => r.id === plan.routeId);
    const to = placeById(worldMap, plan.toPlaceId);
    if (!route || !to) { set({ travelPlan: null }); return; }
    const party = get().party;

    // Vitesse du jour (à pied, l'Encombrement/les États du moment comptent ; en selle, l'allure et les
    // Incidents de monte de la veille — recalculée chaque jour). Attelage Endommagé → cadence de base.
    const kmh = travelSpeed(party, plan.mode, route.speed?.[plan.mode], plan.vehicleLame ? undefined : plan.allure);
    if (kmh <= 0) {
      set({ travelPlan: { ...plan, interrupted: true } });
      log(get, set, ['Le groupe est trop chargé pour avancer — le voyage s’arrête là (alléger les sacs, puis reprendre).']);
      finishRecap('stalled');
      return;
    }

    // Déjà à destination (reprise d'un voyage interrompu sur le dernier kilomètre) : on arrive
    // sans rejouer une journée (ni fatigue ni péripéties — elles ont déjà été tirées ce jour-là).
    if (plan.km - plan.kmDone < 1e-9) {
      set({ travelPlan: null });
      log(get, set, [`— Arrivée à ${to.label} —`, ...travelArrivalCare(get, set)]);
      finishRecap('arrived');
      get().transitionTo(to.scene, to.entry);
      return;
    }

    // Marche du jour : on avance l'horloge d'un bloc (PAS minute par minute, cf. en-tête).
    // Attelage FORCÉ au pas de course (EDOC 07 l.229) : la progression du jour se joue km par km
    // (Tests de Conduite d'attelage) — sinon, progression linéaire à la vitesse du mode.
    const kmLeft = plan.km - plan.kmDone;
    const forcedEligible = plan.allure === 'galop' && plan.mode !== 'monture' && !plan.vehicleLame && !!vehicleTravel(plan.mode)?.draft;
    const forcedDriver = forcedEligible ? partyAssisted(party, 'conduite-d-attelage') : null;
    // Conducteur JOUEUR (#270) : chaque Test de Conduite d'attelage au km devient une ÉTAPE de la
    // cascade `travelDay` (Chance/Pacte/Résilience possibles), chaînée par insertions successives
    // jusqu'au premier échec (`buildForcedPaceDaySteps`) — gameTime/kmDone sont alors DIFFÉRÉS à la
    // clôture (`continueTravelDayAfterCascade`), comme la progression fluviale (`riverVoyageFlow`).
    // Repli : pas de conducteur / conducteur IA-piloté → chemin SYNCHRONE historique (`forcedPaceDay`).
    if (forcedEligible && forcedDriver && humanControlled(get(), forcedDriver.actor)) {
      const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: plan.kmDone, hours: 0, lines: [], entries: [] };
      recap?.days.push(recapDay);
      if (recap) set({ travelPlan: { ...get().travelPlan!, recap } });
      const daySteps = buildTravelDayCascade(get, set, route, recapDay, [], { toScene: to.scene, toEntry: to.entry, toLabel: to.label, destLabel: to.label });
      const first = buildForcedPaceStep(forcedDriver, kmLeft);
      startCascade(get, set, { title: 'Journée de route — allure forcée', icon: 'travel/cart', purpose: 'travelDay', steps: [first, ...daySteps] });
      return; // la clôture de la cascade (continueTravelDayAfterCascade) finalise le jour
    }
    const forced = forcedEligible ? forcedPaceDay(get, set, kmLeft) : null;
    const hoursToday = forced ? forced.hours : Math.min(plan.hoursPerDay, kmLeft / kmh);
    set({ gameTime: get().gameTime + Math.round(hoursToday * 60) });
    bus.emit(EVT.TIME_ADVANCED, { minutes: Math.round(hoursToday * 60) });
    // L'ENTRETIEN du jour (rations/faim, maladies, convalescence) n'est PAS roulé ici : il se résout
    // dans la cascade de la halte de nuit (`buildNightCascade`), APRÈS le repas — sinon la Faim
    // s'installerait avant que le groupe ne mange. À l'ARRIVÉE (pas de nuit), le prochain
    // `runDailyUpkeep` (repos/advanceTime) le rattrape via la garde `lastUpkeepDay`.
    const kmDone = Math.min(plan.km, plan.kmDone + (forced ? forced.km : hoursToday * kmh));
    set({ travelPlan: { ...get().travelPlan!, kmDone } });
    const recapDay: TravelRecapDay = {
      kmFrom: plan.kmDone, kmTo: kmDone, hours: hoursToday,
      lines: [...(forced?.lines ?? [])], entries: [...(forced?.entries ?? [])],
    };
    recap?.days.push(recapDay);
    if (forced) {
      log(get, set, forced.lines);
      // Conséquences d'attelage : Endommagé → au pas jusqu'à réparation (l.272-280) ; Cassé/Accident ou
      // coque à 0 Blessure → véhicule hors d'usage, la route continue à pied.
      if (forced.vehicleLame) set({ travelPlan: { ...get().travelPlan!, vehicleLame: true } });
      if (forced.vehicleOut) {
        set({ travelPlan: { ...get().travelPlan!, mode: 'pied', allure: undefined } });
        log(get, set, ['Le véhicule est hors d’usage — la route continue à pied.']);
        recapDay.lines.push('Le véhicule est hors d’usage — la route continue à pied.');
      }
    }

    // Fin de journée de route À PIED : fatigue d'Encombrement (p.295, non-jetée) + recensement des
    // héros en MARCHE FORCÉE (l.224). Le JET de marche forcée est DIFFÉRÉ : s'il y a une halte de
    // nuit, il ouvre la cascade influençable de la nuit ; sinon (arrivée/interruption) il est roulé
    // d'office ici (pas de halte où le présenter).
    const dayLines: string[] = [];
    const marchHeroes: string[] = [];
    if (plan.mode === 'pied' && hoursToday >= base - 1e-9) {
      for (const h of party) {
        if (h.dead || h.outOfRencontre) continue;
        const fatigue = applyTravelFatigue(h);
        dayLines.push(...fatigue);
        recapDay.lines.push(...fatigue);
        if (plan.hoursPerDay > base) marchHeroes.push(h.id);
      }
      if (dayLines.length) set({ party: [...party] });
    }
    log(get, set, dayLines);

    // Journée EN SELLE (EDOC 07 l.142-146) : endurance de l'allure des bêtes, Incidents de monte
    // (EDOC 07 l.148-174), chute du cavalier, bête perdue — puis dégradation à pied si le groupe
    // n'est plus monté au complet (les cavaliers ne marchent pas : ni fatigue ni marche forcée).
    if (plan.mode === 'monture') resolveMountedTravelDay(get, set, hoursToday, plan.allure ?? 'pas', recapDay);

    // Sous-système OPTIONNEL « Voyage par Étapes » (EDOC ch.5, parent `travel-etapes`) + PÉRIPÉTIES du
    // jour (d'auteur puis table d10 RAW). TOUS les JETS du jour (Activités d'Étape, Exposition de fin
    // d'Étape, Survie/Perception des péripéties) sont désormais des ÉTAPES d'une CASCADE influençable
    // (`purpose:'travelDay'`, Chance/Pacte/Résilience) — plus d'auto-résolution inline. Ordre RAW (l.10)
    // : Météo (tirée ici, ambiance) → activités → péripéties. Quand aucun jet n'est produit (règle
    // Étapes éteinte ET pas de péripétie testable), la cascade est VIDE → on finalise directement (le
    // chemin jour-par-jour du LdB reste BYTE-IDENTIQUE).
    const daySteps = buildTravelDayCascade(get, set, route, recapDay, marchHeroes, {
      toScene: to.scene, toEntry: to.entry, toLabel: to.label, destLabel: to.label,
    });
    // Récap du SEGMENT posé sur le plan : la cascade suspend le `while`, donc son `recap`/`recapDay`
    // locaux ne survivent pas — `continueTravelDayAfterCascade` les relit depuis `plan.recap`.
    if (recap) set({ travelPlan: { ...get().travelPlan!, recap } });
    if (daySteps.length) {
      startCascade(get, set, { title: 'Journée de route', icon: 'travel/compass', purpose: 'travelDay', steps: daySteps });
      return; // la clôture de la cascade (continueTravelDayAfterCascade) finalise le jour
    }
    // Aucun jet influençable : finalisation immédiate (arrivée / halte de nuit) — comme la cascade le
    // ferait à sa clôture. Chaque journée finalise le segment (halte/arrivée) → une seule itération.
    continueTravelDayAfterCascade(get, set);
    return;
  }
}

/** Reprise au MATIN après la halte de nuit (« Continuer » du bilan de la modale de Repos). */
export function continueTravelAfterNight(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan || plan.interrupted || get().battle) return;
  if (plan.sea) { runSeaDay(get, set); return; } // traversée maritime : la journée suivante est navale
  if (plan.river) { runRiverDays(get, set); return; } // descente fluviale : la journée suivante est fluviale
  runTravelDays(get, set);
}

/** Saison courante (table de Météo EDOC ch.5 l.44) depuis l'horloge du jeu. */
function currentSeason(get: Get): Season {
  return seasonOfMonth(toDate(get().gameTime).month);
}

/**
 * Construit les ÉTAPES influençables du JOUR terrestre (cascade `purpose:'travelDay'`) — la MISE EN
 * SCÈNE des jets du jour, dans l'ORDRE de résolution RAW (l.10) : (Étape EDOC) Météo tirée ici
 * (ambiance, 1 tirage), puis les postes d'Activité (l.131) + l'agrégation qui INSÈRE l'Exposition de
 * fin d'Étape (l.73) ; enfin les PÉRIPÉTIES (l.237) — un pas `landPeril` qui, à sa validation, tire les
 * péripéties d'auteur (d100) puis la table d10 et INSÈRE le jet influençable (Survie/Perception) quand
 * la péripétie en demande un. Zéro RNG consommé au build hormis la Météo (les jets vivent dans les
 * étapes / appliers) → parité RNG avec l'ancien chemin inline. Renvoie `[]` s'il n'y a AUCUN jet
 * (règle Étapes éteinte ET pas de péripétie testable) : l'appelant finalise alors directement.
 */
function buildTravelDayCascade(
  get: Get, set: Set, route: MapRoute, recapDay: TravelRecapDay, marchHeroes: string[],
  dest: { toScene: string; toEntry?: string; toLabel: string; destLabel: string },
): CascadeStep[] {
  const steps: CascadeStep[] = [];
  // Repère de journal : le récap du jour (recapDay.lines) = la tranche écrite pendant la cascade.
  const journalMark = get().journal.length;

  // Étape EDOC (l.10) : jet de Météo « au début de chaque étape » (l.42) — ambiance, posée ici (1
  // tirage), puis les postes + l'agrégation (fourrage/camp/carte/Rencontre) qui insère l'Exposition.
  if (rule('travel-etapes')) {
    const season = currentSeason(get);
    const w = rollStageWeather(battleRng(), season);
    log(get, set, [`Météo de l'Étape (${w.roll}) : ${WEATHER_LABEL[w.weather]}.`]);
    steps.push(...buildStageSteps(get, set, w.weather, season));
  }

  // PÉRIPÉTIES du jour (l.237) : un pas de VÉRIFICATION dont l'applier tire les péripéties d'auteur
  // (d100) puis la table d10 (MÊME ordre RNG qu'inline — APRÈS les jets d'Étape) et, si la péripétie
  // propose un Test (Survie/Perception), INSÈRE le jet influençable juste après. N'est ajouté que s'il
  // y a des péripéties À TIRER (auteur ou table d10) — sinon le jour n'a pas de pas de péripétie (le
  // chemin de base sans péripétie reste sans cascade quand la règle Étapes est éteinte).
  const perilDie = route.perilDie ?? get().worldMap?.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie;
  if ((route.perils ?? []).length > 0 || perilDie >= 1) {
    steps.push({ id: 'land-peril', kind: 'landPeril', icon: 'ui/warning', label: 'Péripéties de la route', interactive: true,
      meta: { destLabel: dest.destLabel } });
  }

  // Contexte du jour relu par la clôture (arrivée/halte, recalculée depuis `plan.kmDone` — posé avant
  // le build sur le chemin synchrone, ou par la chaîne `landForcedPace` sur le chemin différé).
  // L'interruption d'une péripétie s'y posera.
  set({ travelPlan: { ...get().travelPlan!, land: {
    toScene: dest.toScene, toEntry: dest.toEntry, toLabel: dest.toLabel,
    destLabel: dest.destLabel, marchHeroes: [...marchHeroes], journalMark,
  } } });
  void recapDay; // le récap du jour (plan.recap.days[dernier]) reçoit la tranche de journal à la clôture
  return steps;
}

/**
 * Clôture de la cascade du jour terrestre (`purpose:'travelDay'`, appelée par le store) : le jour est
 * fini de se JOUER (postes/exposition/péripéties validés) — reste à enchaîner. Roule la marche forcée
 * EAGER si le jour n'aboutit PAS sur une halte de nuit (arrivée/interruption : pas de nuit où la
 * présenter), sinon la DIFFÈRE à la cascade de nuit (`travelMarch`). Puis : interruption (péripétie) →
 * recap `interrupted` + suite différée ; arrivée → transition ; sinon → halte de nuit (`openRest`).
 * Efface le contexte transitoire du jour. Renvoie `true` (le segment est toujours clos ici).
 */
export function continueTravelDayAfterCascade(get: Get, set: Set): boolean {
  const plan = get().travelPlan;
  if (!plan) return true;
  const worldMap = get().worldMap;
  const route = worldMap?.routes.find((r) => r.id === plan.routeId);
  const ctx = plan.land;
  const recap = plan.recap;
  const recapDay = recap?.days[recap.days.length - 1];
  // Récap du jour : la tranche de journal écrite pendant la cascade (météo, postes, Exposition,
  // péripéties) — les lignes de la cascade ne vont pas d'elles-mêmes dans `recapDay.lines`.
  if (recapDay && ctx) recapDay.lines.push(...get().journal.slice(ctx.journalMark));
  // Attelage FORCÉ conducteur JOUEUR (#270) : gameTime/kmDone étaient DIFFÉRÉS depuis le build (la
  // chaîne `landForcedPace` n'a résolu km/heures qu'au fil des jets) — on les pose maintenant, comme
  // le chemin synchrone les pose avant le build. Absent (conducteur IA / pas d'attelage forcé) : rien
  // à faire ici, `plan.kmDone`/`gameTime` sont déjà à jour.
  const fp = ctx?.forcedPaceResult;
  if (fp) {
    set({ gameTime: get().gameTime + Math.round(fp.hours * 60) });
    bus.emit(EVT.TIME_ADVANCED, { minutes: Math.round(fp.hours * 60) });
    const kmDone = Math.min(plan.km, plan.kmDone + fp.km);
    set({ travelPlan: { ...get().travelPlan!, kmDone } });
    if (fp.vehicleLame) set({ travelPlan: { ...get().travelPlan!, vehicleLame: true } });
    if (fp.vehicleOut) {
      set({ travelPlan: { ...get().travelPlan!, mode: 'pied', allure: undefined } });
      log(get, set, ['Le véhicule est hors d’usage — la route continue à pied.']);
      recapDay?.lines.push('Le véhicule est hors d’usage — la route continue à pied.');
    }
    if (recapDay) { recapDay.kmTo = get().travelPlan?.kmDone ?? recapDay.kmTo; recapDay.hours = fp.hours; }
  }
  // Arrivée recalculée depuis `plan.kmDone` À JOUR (posé au build sur le chemin synchrone, ci-dessus
  // sur le chemin différé) — source UNIQUE, plus de champ `LandDayContext.arrived` figé au build.
  const arrived = (get().travelPlan?.km ?? 0) - (get().travelPlan?.kmDone ?? 0) < 1e-9;

  // Efface les contextes transitoires du jour (jamais persistés au-delà de la journée).
  set({ travelPlan: { ...get().travelPlan!, land: undefined, stage: undefined, recap: undefined } });

  const finishRecap = (status: TravelRecap['status'], then?: TravelThen) => {
    if (!recap) return;
    recap.status = status;
    recap.kmDone = get().travelPlan?.kmDone ?? recap.km;
    set({ travelRecap: { ...recap, days: [...recap.days], then } });
  };
  // Marche forcée du jour (l.224) : DIFFÉRÉE à la nuit si halte ; sinon roulée EAGER (arrivée/interruption).
  const rollMarchEager = () => {
    for (const id of ctx?.marchHeroes ?? []) {
      const h = get().party.find((x) => x.id === id);
      if (!h) continue;
      const r = forcedMarchTest(h, battleRng());
      if (r) { log(get, set, [r.line]); recapDay?.entries?.push({ actorId: id, icon: 'travel/foot', label: 'Marche forcée', d: r.d, text: r.gained ? `+${r.gained} Exténué` : 'tient l’allure', tone: r.gained ? 'bad' : 'ok' }); }
    }
    set({ party: [...get().party] });
  };

  // INTERRUPTION par une péripétie (combat/embuscade différé) : le voyage s'arrête sur le récit.
  if (ctx?.interrupt) {
    rollMarchEager();
    set({ travelPlan: { ...get().travelPlan!, interrupted: true } });
    finishRecap('interrupted', ctx.interrupt);
    return true;
  }
  if (!route || !ctx) { set({ travelPlan: null }); return true; }

  if (arrived) {
    rollMarchEager();
    set({ travelPlan: null });
    const care = travelArrivalCare(get, set);
    if (recapDay) recapDay.lines.push(...care);
    log(get, set, [`— Arrivée à ${ctx.toLabel} —`, ...care]);
    finishRecap('arrived');
    get().transitionTo(ctx.toScene, ctx.toEntry);
    return true;
  }
  // Nuit en route : HALTE — modale de Repos (auberge de relais si la route en a, sinon campement). Le
  // voyage se suspend ; « Continuer » du bilan reprend la route au matin. La MARCHE FORCÉE du jour
  // ouvre la cascade de la nuit (influençable) via `travelMarch` — pas de roulé eager ici.
  const travelDay: TravelRecapDay | undefined = recapDay ? { ...recapDay, lines: [...recapDay.lines], entries: [...(recapDay.entries ?? [])] } : undefined;
  openRest(get, set, { places: placesOfKind(route.inns ? 'auberge' : 'camp'), travelHalt: true, travelMarch: ctx.marchHeroes, travelDay });
  return true;
}

// ── APPLIER des PÉRIPÉTIES du jour terrestre (cascade `travelDay`) : tire les péripéties d'auteur
//    (d100) puis la table d10 RAW, résout les kinds sans jet joueur inline, et INSÈRE le jet
//    influençable (Survie « éreintant » / Perception « attaque ») quand la péripétie en demande un —
//    l'ORDRE RNG (d100 auteur → d10 seuil → d10 table → jet) est IDENTIQUE à l'ancien `resolvePerils`.

/** Pose l'INTERRUPTION du jour sur le contexte terrestre (relue par `continueTravelDayAfterCascade`). */
function markLandInterrupt(get: Get, set: Set, then: TravelThen, destLabel: string): string[] {
  const plan = get().travelPlan;
  if (plan?.land) set({ travelPlan: { ...plan, land: { ...plan.land, interrupt: then } } });
  return [`(Voyage vers ${destLabel} interrompu — il pourra reprendre depuis la carte.)`];
}

registerCascadeApplier('landPeril', (get, set, step) => {
  const worldMap = get().worldMap;
  const route = worldMap?.routes.find((r) => r.id === get().travelPlan?.routeId);
  if (!route) return;
  const destLabel = String(step.meta?.destLabel ?? '');
  const j: string[] = [];
  const before = { sceneId: get().scene?.id };
  const interrupted = () => get().scene?.id !== before.sceneId;

  // 1. Péripéties d'AUTEUR (probabilité par jour, effets d'éditeur). startCombat/transition → DIFFÉRÉ.
  for (const peril of route.perils ?? []) {
    if (d100(battleRng()) > Math.max(0, Math.min(100, peril.chancePct))) continue;
    j.push(`Péripétie : ${peril.label}`);
    if ((peril.effects ?? []).some((e) => e.type === 'startCombat' || e.type === 'transition')) {
      j.push(...markLandInterrupt(get, set, { kind: 'effects', effects: peril.effects }, destLabel));
      return { consequences: freeCons(j) };
    }
    applyEffectsLoot(get, set, peril.effects, peril.label); // trouvaille d'auteur → fenêtre d'attribution
    if (interrupted()) { j.push(...markLandInterrupt(get, set, { kind: 'effects', effects: peril.effects }, destLabel)); return { consequences: freeCons(j) }; }
  }

  // 2. Table d10 RAW (l.237). L'entrée à Test (éreintant/attaque) INSÈRE un jet influençable ; les kinds
  //    sans jet (reposant/narratif) sont résolus inline (mêmes sous-jets, même ordre).
  const die = route.perilDie ?? get().worldMap?.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie;
  if (die >= 1 && d10(battleRng()) === die) {
    const entry = PERIPETIES[d10(battleRng()) - 1];
    j.push(`Péripétie de voyage (${entry.roll}) — ${entry.label} : ${entry.text}`);
    const party = get().party;
    if (entry.kind === 'reposant') {
      for (const h of party) {
        if (h.dead) continue;
        if (h.wounds.current < h.wounds.max) { h.wounds.current = h.wounds.max; j.push(`${h.name} récupère toutes ses Blessures.`); }
        const n = stacks(h, 'extenue');
        if (n > 0) { removeCondition(h, 'extenue', n); j.push(`${h.name} n’est plus Exténué.`); }
      }
      set({ party: [...party] });
    } else if (entry.kind === 'ereintant') {
      // Survie en extérieur Accessible (+20) INFLUENÇABLE → étape-jet insérée (échec = retard + Exténué).
      const best = partyAssisted(party, 'survie-en-exterieur'); // Soutien (LDB 12)
      if (best) return { consequences: freeCons(j), insert: [{
        id: 'peril-survie', kind: 'landPerilSurvie', actorId: best.actor.id, icon: 'travel/compass', label: 'Survie en extérieur',
        rollLabel: 'Survie en extérieur', base: best.value, target: Math.max(1, Math.min(99, best.value + DIFFICULTY_MODIFIERS.accessible)), result: null, interactive: true,
      }] };
      j.push(...applyEreintant(get, set)); // personne pour tester : retard direct
    } else if (entry.kind === 'attaque') {
      // Perception Accessible (+20) INFLUENÇABLE → étape-jet insérée ; son applier pose l'embuscade
      // différée (le `noSurprise` suit le jet). Sans tester (aucun héros vivant) : interruption directe.
      const configured = !!(route.ambush?.scene && route.ambush.encounter);
      const best = partyAssisted(party, 'perception'); // Soutien (LDB 12)
      if (best) return { consequences: freeCons(j), insert: [{
        id: 'peril-perception', kind: 'landPerilPerception', actorId: best.actor.id, icon: 'ui/eye', label: 'Perception',
        rollLabel: 'Perception', base: best.value, target: Math.max(1, Math.min(99, best.value + DIFFICULTY_MODIFIERS.accessible)), result: null, interactive: true,
        meta: { destLabel, configured, ambushScene: route.ambush?.scene ?? '', ambushEntry: route.ambush?.entry ?? '', ambushEnc: route.ambush?.encounter ?? '' } }] };
      if (configured) { j.push(...markLandInterrupt(get, set, { kind: 'ambush', scene: route.ambush!.scene, entry: route.ambush!.entry, encounter: route.ambush!.encounter, noSurprise: false }, destLabel)); return { consequences: freeCons(j) }; }
      j.push('(Aucune rencontre d’embuscade n’est configurée sur cette route — l’alerte reste sans suite.)');
    }
    // narratif (default) : le texte au journal suffit.
  }
  return { consequences: freeCons(j) };
});

/** « Voyage éreintant » (l.237) : Survie en extérieur (+20) INFLUENÇABLE ; échec → +1 jour de retard et
 *  +1 Exténué chacun (`applyEreintant`). */
registerCascadeApplier('landPerilSurvie', (get, set, step, hero) => {
  if (!step.result) return;
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5) ;
  // succès sans effet (rien à ajouter) → aucune conséquence, l'échec parle par son effet (`applyEreintant`).
  if (step.result.success) return { consequences: freeCons([`${hero?.name ?? 'Le groupe'} — Survie en extérieur (+20) : un itinéraire de substitution est trouvé.`]) };
  return { consequences: freeCons(applyEreintant(get, set)) };
});

/** « Attaqués ! » (l.237) : Perception (+20) INFLUENÇABLE ; réussie → le groupe les voit venir (sans
 *  surprise) ; l'embuscade configurée est DIFFÉRÉE derrière le récit (le `noSurprise` suit le jet). */
registerCascadeApplier('landPerilPerception', (get, set, step, hero) => {
  if (!step.result) return;
  const configured = !!step.meta?.configured;
  const destLabel = String(step.meta?.destLabel ?? '');
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5) ;
  // échec sans embuscade configurée (rien à ajouter) → aucune conséquence.
  const j = step.result.success
    ? [`${hero?.name ?? 'Le groupe'} — Perception (+20) : le groupe les voit venir !`]
    : configured ? [`${hero?.name ?? 'Le groupe'} — Perception (+20) : embuscade !`] : [];
  if (configured) j.push(...markLandInterrupt(get, set, {
    kind: 'ambush', scene: String(step.meta?.ambushScene ?? ''), entry: String(step.meta?.ambushEntry ?? '') || undefined,
    encounter: String(step.meta?.ambushEnc ?? ''), noSurprise: step.result.success,
  }, destLabel));
  return { consequences: freeCons(j) };
});

/**
 * Applique la journée EN SELLE (EDOC 07 l.142-146) : le moteur PUR `resolveMountedDay` rend la fatigue
 * des bêtes et les Incidents de monte ; ici on APPLIQUE — chute du cavalier (Dégâts de Chute, brique
 * `applyFall`), état persistant sur l'instance (`mountInjury`), bête morte/condamnée retirée de
 * l'inventaire — et on dégrade la route à pied si le groupe n'est plus monté au complet.
 */
function resolveMountedTravelDay(get: Get, set: Set, hoursToday: number, allure: Allure, day: TravelRecapDay): void {
  const outcomes = resolveMountedDay(partyMounts(get().party), hoursToday, allure, battleRng());
  const lines: string[] = [];
  for (const o of outcomes) {
    lines.push(...o.lines);
    for (const t of o.tests) {
      day.entries!.push({ actorId: o.mount.hero.id, icon: 'travel/mount', label: t.label, d: t, text: t.success ? 'tient l’allure' : 'flanche', tone: t.success ? 'ok' : 'bad' });
    }
    for (const inc of o.incidents) {
      if (inc.riderTest) {
        day.entries!.push({
          actorId: o.mount.hero.id, icon: 'travel/mount', label: `${inc.entry.label} — Chevaucher`, d: inc.riderTest,
          text: inc.riderTest.success ? 'se maintient en selle' : 'chute (2 m)', tone: inc.riderTest.success ? 'ok' : 'bad',
        });
      }
      // Chute de selle (2 mètres, EDOC 07 l.166/l.171) — Dégâts de Chute (LDB 15) via la brique partagée.
      if (inc.riderFallM) applyFall(o.mount.hero, inc.riderFallM, battleRng());
      if (inc.injury) o.mount.item.mountInjury = inc.injury;
    }
    // Bête morte (poussée jusqu'à la mort, l.146) ou Patte brisée (« peu d'espoir qu'elle y survive »,
    // l.163) : retirée de l'inventaire du propriétaire.
    if (o.dead || o.mount.item.mountInjury === 'patte-brisee') {
      const h = o.mount.hero;
      h.items = (h.items ?? []).filter((i) => i.uid !== o.mount.item.uid);
      lines.push(`${h.name} abandonne ${o.mount.item.name} sur la route.`);
    }
  }
  set({ party: [...get().party] });
  log(get, set, lines);
  day.lines.push(...lines);
  if (!partyFullyMounted(get().party)) {
    set({ travelPlan: { ...get().travelPlan!, mode: 'pied', allure: undefined } });
    const l = 'Le groupe n’est plus monté au complet — la route continue à pied.';
    log(get, set, [l]);
    day.lines.push(l);
  }
}

/** Issue d'une journée d'attelage FORCÉ (collectée puis journalisée par l'appelant). */
interface ForcedPaceDayResult {
  km: number;
  hours: number;
  lines: string[];
  entries: NonNullable<TravelRecapDay['entries']>;
  /** Cassé/Accident ou coque à 0 Blessure : véhicule hors d'usage. */
  vehicleOut: boolean;
  /** Endommagé : au pas jusqu'à réparation (EDOC 07 l.272-280). */
  vehicleLame: boolean;
}

/**
 * Journée d'attelage FORCÉ au pas de course (EDOC 07 l.229) : « Le conducteur doit effectuer un Test de
 * Conduite d'attelage Intermédiaire (+0) tous les kilomètres, avec une pénalité de -10 par kilomètre déjà
 * parcouru au pas de course. En cas d'échec, les animaux repasseront au pas, et chacun doit réussir un
 * Test de Résistance Intermédiaire (+0) ou acquérir un État Exténué. » Un Échec Stupéfiant (-6 DR) du
 * conducteur exige un jet sur le Tableau des Problèmes de véhicule (EDOC 07 l.253). Le conducteur = le
 * meilleur héros en Conduite d'attelage, soutenu (LDB 12). Après un échec, le reste de la journée se fait
 * à la cadence de base du transport (les bêtes soufflent — le galop ne reprend pas le même jour).
 */
function forcedPaceDay(get: Get, set: Set, kmLeft: number): ForcedPaceDayResult {
  const plan = get().travelPlan!;
  const t = vehicleTravel(plan.mode)!;
  const draft = mountProfileById(t.draft!.montureId)!;
  const gallopKmh = draft.m * ALLURE_KMH_PER_M.galop; // vitesse au pas de course = M de l'attelage × 3 (l.140)
  const walkKmh = t.movement;
  const out: ForcedPaceDayResult = { km: 0, hours: 0, lines: [], entries: [], vehicleOut: false, vehicleLame: false };
  const driver = partyAssisted(get().party, 'conduite-d-attelage');
  let galloped = 0;
  while (out.hours < plan.hoursPerDay - 1e-9 && out.km < kmLeft - 1e-9) {
    const base = Math.max(0, (driver?.value ?? 0) - 10 * galloped); // -10 par km déjà au pas de course (l.229)
    const roll = rollTest(base, 'intermediaire', battleRng());
    if (roll.success) {
      out.km += 1;
      galloped += 1;
      out.hours += 1 / gallopKmh;
      continue;
    }
    const stupefiant = roll.sl <= -6; // Échec Stupéfiant (EDOC 07 l.253)
    out.entries.push({
      actorId: driver?.actor.id ?? '', icon: 'travel/cart', label: 'Conduite d’attelage (allure forcée)',
      d: testDetail('Conduite d’attelage', base, roll),
      text: stupefiant ? 'Échec Stupéfiant — Problème de véhicule !' : 'les bêtes repassent au pas', tone: 'bad',
    });
    // Le jet est DÉJÀ affiché par la rangée `day.entries` (MultiRollList) du même recap — pas de
    // re-print du roll/target (#295 Lot 5) ; le verdict reste pour le journal général (surface SANS rangée).
    out.lines.push(`${driver?.actor.name ?? 'Le conducteur'} — Conduite d'attelage (allure forcée) : ÉCHEC${stupefiant ? ' STUPÉFIANT' : ''}, l'attelage repasse au pas.`);
    // « chacun doit réussir un Test de Résistance Intermédiaire (+0) ou acquérir un État Exténué » (l.229)
    // — les bêtes de l'attelage (transport, sans rangée dédiée) : le journal PORTE seul leur jet.
    for (let i = 0; i < t.draft!.count; i++) {
      const rt = rollTest(draft.e, 'intermediaire', battleRng());
      if (!rt.success) out.lines.push(`Une bête de l'attelage est Exténuée (Résistance ${rt.roll}/${rt.target}).`);
    }
    if (stupefiant) {
      const pb = applyVehicleProblemToTravel(get, set, out);
      out.vehicleOut = pb.vehicleOut;
      out.vehicleLame = pb.vehicleLame;
    }
    // Reste de la journée à la cadence de base du transport (au pas si Endommagé — même vitesse LDB).
    if (!out.vehicleOut) {
      const remaining = Math.min(plan.hoursPerDay - out.hours, Math.max(0, kmLeft - out.km) / walkKmh);
      out.km += remaining * walkKmh;
      out.hours += remaining;
    }
    break; // plus de galop aujourd'hui
  }
  out.km = Math.min(out.km, kmLeft);
  return out;
}

/**
 * Tire et APPLIQUE un Problème de véhicule au trajet (déclenché AU PAS DE COURSE, EDOC 07 l.253) :
 * `applyVehicleProblem` (Dégâts à la coque) + Dégâts aux OCCUPANTS en `GameOp` (`occupantOps`). Le
 * véhicule allant plus vite que la marche : « Incontrôlable » non maîtrisé → Accident (l.284) et
 * « Cassé » se traite comme un Accident (l.276) — le remap se fait AVANT d'appliquer les Dégâts.
 */
function applyVehicleProblemToTravel(get: Get, set: Set, out: Pick<ForcedPaceDayResult, 'lines' | 'entries'>): { vehicleOut: boolean; vehicleLame: boolean } {
  const vehicle = get().travelPlan?.vehicle;
  if (!vehicle) return { vehicleOut: false, vehicleLame: false }; // garde : coque toujours créée en allure forcée
  const roll = d100(battleRng());
  let entry = rollVehicleProblem(roll);
  if (entry.id === 'incontrolable') {
    // « S'il ne prend pas des mesures pour l'arrêter, le véhicule peut entrer en collision ! … S'il se
    // déplaçait plus vite que la vitesse de marche, il subit un Accident à la place » (l.284) — la
    // maîtrise = Test de Conduite d'attelage Intermédiaire (+0) du conducteur.
    const driver = partyAssisted(get().party, 'conduite-d-attelage');
    const rt = rollTest(driver?.value ?? 0, 'intermediaire', battleRng());
    // Repli IA/synchrone (`forcedPaceDay`) : aucune rangée nulle part pour ce jet — le journal est
    // la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
    out.lines.push(`Problème de véhicule — ${entry.label}.`, `${driver?.actor.name ?? 'Le conducteur'} tente de reprendre le contrôle : ${rt.roll}/${rt.target} → ${rt.success ? 'l’attelage est maîtrisé.' : 'ACCIDENT !'}`);
    if (rt.success) return { vehicleOut: false, vehicleLame: false };
    entry = rollVehicleProblem(96); // 96-00 = Accident (table verbatim)
  } else if (entry.id === 'casse') {
    // « Si le véhicule se déplaçait plus vite que la marche, traitez ce résultat comme un Accident » (l.276).
    out.lines.push(`Problème de véhicule — ${entry.label}, à pleine allure : ACCIDENT !`);
    entry = rollVehicleProblem(96);
  }
  return applyVehicleProblemEffects(get, set, entry, out.lines);
}

/** Dégâts d'un Problème de véhicule DÉJÀ tranché (Cassé/Accident remappés le cas échéant) — coque
 *  (`applyVehicleProblem`) + occupants (`occupantOps`). Partagé par le chemin synchrone
 *  (`applyVehicleProblemToTravel`, conducteur IA) et la chaîne cascade `landForcedPace`/
 *  `landForcedPaceControl` (conducteur JOUEUR, #270) — SOURCE UNIQUE des Dégâts. */
function applyVehicleProblemEffects(get: Get, set: Set, entry: ReturnType<typeof rollVehicleProblem>, lines: string[]): { vehicleOut: boolean; vehicleLame: boolean } {
  const vehicle = get().travelPlan?.vehicle;
  if (!vehicle) return { vehicleOut: false, vehicleLame: false };
  const r = applyVehicleProblem(vehicle, entry.min, battleRng());
  lines.push(...r.lines);
  // Dégâts aux occupants (Cassé : 1 Blessure ignorant BE et PA ; Accident : 2d10 − BE − PA, min 1) —
  // langue unique GameOp, portée par la table (`occupantOps`).
  if (r.entry.occupantOps?.length) {
    const opLines: string[] = [];
    for (const h of get().party) {
      if (h.dead || h.outOfRencontre) continue;
      opLines.push(...applyOps(h, r.entry.occupantOps, { rng: battleRng() }));
    }
    set({ party: [...get().party] });
    lines.push(...opLines);
  }
  if (r.entry.id === 'endommage') return { vehicleOut: false, vehicleLame: true };
  return { vehicleOut: r.entry.id === 'accident' || vehicle.wounds.current <= 0, vehicleLame: false };
}

/** Construit l'ÉTAPE-JET de Conduite d'attelage au kilomètre COURANT (#270, conducteur JOUEUR) — pénalité
 *  −10/km déjà galopé (l.229). `meta` porte l'accumulateur (km/heures déjà acquis) relu par l'applier
 *  pour chaîner le km SUIVANT (`insert`) ou finaliser la journée (`finalizeForcedPace`). */
function buildForcedPaceStep(driver: { actor: Combatant; value: number }, kmLeft: number, galloped = 0, km = 0, hours = 0): CascadeStep {
  const base = Math.max(0, driver.value - 10 * galloped); // −10 par km déjà au pas de course (l.229)
  return {
    id: `land-forced-${galloped}`, kind: 'landForcedPace', actorId: driver.actor.id, icon: 'travel/cart',
    label: `${driver.actor.name} — Conduite d'attelage (allure forcée)`, rollLabel: 'Conduite d’attelage',
    base, target: Math.max(1, Math.min(99, base)), result: null, interactive: true,
    meta: { kmLeft, galloped, km, hours, driverBase: driver.value },
  };
}

/** Pose l'aggrégat FINAL de l'attelage forcé sur `travelPlan.land` (relu par `continueTravelDayAfterCascade`
 *  pour poser `kmDone`/`gameTime`, DIFFÉRÉS depuis le build — cf. `LandDayContext.forcedPaceResult`). */
function finalizeForcedPace(get: Get, set: Set, result: { km: number; hours: number; vehicleOut: boolean; vehicleLame: boolean }): void {
  const land = get().travelPlan?.land;
  if (!land) return;
  set({ travelPlan: { ...get().travelPlan!, land: { ...land, forcedPaceResult: result } } });
}

/** ÉTAPE-JET de Conduite d'attelage au km (#270) : succès → chaîne le km SUIVANT (`insert`, tant que le
 *  budget du jour reste) ; échec → les bêtes repassent au pas (résistance des bêtes de l'attelage, sans
 *  jet joueur — non-héros) puis, sur un Échec Stupéfiant (−6 DR, l.253), un Problème de véhicule (d100,
 *  donnée d'auteur) — « Incontrôlable » INSÈRE la reprise de contrôle INFLUENÇABLE (`landForcedPaceControl`) ;
 *  les autres résultats s'appliquent inline (`applyVehicleProblemEffects`, pas de jet joueur supplémentaire). */
registerCascadeApplier('landForcedPace', (get, set, step, hero) => {
  if (!step.result) return;
  const m = step.meta!;
  const kmLeft = Number(m.kmLeft), galloped = Number(m.galloped), driverBase = Number(m.driverBase);
  let km = Number(m.km), hours = Number(m.hours);
  const name = hero?.name ?? 'Le conducteur';
  const plan = get().travelPlan!;
  const t = vehicleTravel(plan.mode)!;
  const draft = mountProfileById(t.draft!.montureId)!;
  const gallopKmh = draft.m * ALLURE_KMH_PER_M.galop;
  const walkKmh = t.movement;
  if (step.result.success) {
    km += 1; hours += 1 / gallopKmh;
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
    const j = [`${name} — Conduite d'attelage (allure forcée) : l'attelage tient l'allure de course.`];
    if (hours < plan.hoursPerDay - 1e-9 && km < kmLeft - 1e-9 && step.actorId && hero) {
      return { consequences: freeCons(j), insert: [buildForcedPaceStep({ actor: hero, value: driverBase }, kmLeft, galloped + 1, km, hours)] };
    }
    finalizeForcedPace(get, set, { km: Math.min(km, kmLeft), hours, vehicleOut: false, vehicleLame: false });
    return { consequences: freeCons(j) };
  }
  const stupefiant = step.result.sl <= -6; // Échec Stupéfiant (EDOC 07 l.253)
  // Le jet du conducteur est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print
  // (#295 Lot 5) ; les bêtes de l'attelage n'ont AUCUNE rangée dédiée — le journal les porte seul.
  const j = [`${name} — Conduite d'attelage (allure forcée) : ÉCHEC${stupefiant ? ' STUPÉFIANT' : ''}, l'attelage repasse au pas.`];
  for (let i = 0; i < t.draft!.count; i++) {
    const rt = rollTest(draft.e, 'intermediaire', battleRng());
    if (!rt.success) j.push(`Une bête de l'attelage est Exténuée (Résistance ${rt.roll}/${rt.target}).`);
  }
  // Reste de la JOURNÉE (pas de l'ensemble du trajet) à la cadence de base — plafonné par le budget
  // d'heures RESTANT du jour (`plan.hoursPerDay - hours`), EXACTEMENT `forcedPaceDay` (l.795).
  const remaining = Math.max(0, kmLeft - km);
  const restHours = walkKmh > 0 ? Math.min(plan.hoursPerDay - hours, remaining / walkKmh) : 0;
  const finalKm = Math.min(kmLeft, km + restHours * walkKmh), finalHours = hours + restHours;
  if (!stupefiant) {
    finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, vehicleOut: false, vehicleLame: false });
    return { consequences: freeCons(j) };
  }
  const roll = d100(battleRng());
  let entry = rollVehicleProblem(roll);
  if (entry.id === 'incontrolable') {
    j.push(`Problème de véhicule — ${entry.label}.`);
    if (step.actorId && hero) {
      return { consequences: freeCons(j), insert: [{
        id: `${step.id}-control`, kind: 'landForcedPaceControl', actorId: step.actorId, icon: 'travel/cart',
        label: `${name} — reprendre le contrôle`, rollLabel: 'Conduite d’attelage',
        base: driverBase, target: Math.max(1, Math.min(99, driverBase)), result: null, interactive: true,
        meta: { finalKm, finalHours },
      }] };
    }
    // Repli SANS acteur joueur (pas d'étape insérée ci-dessus) : aucune rangée nulle part pour ce jet
    // — le journal est la SEULE surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
    const rt = rollTest(driverBase, 'intermediaire', battleRng());
    j.push(`${name} tente de reprendre le contrôle : ${rt.roll}/${rt.target} → ${rt.success ? 'l’attelage est maîtrisé.' : 'ACCIDENT !'}`);
    if (rt.success) { finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, vehicleOut: false, vehicleLame: false }); return { consequences: freeCons(j) }; }
    entry = rollVehicleProblem(96);
  } else if (entry.id === 'casse') {
    j.push(`Problème de véhicule — ${entry.label}, à pleine allure : ACCIDENT !`);
    entry = rollVehicleProblem(96);
  }
  const outcome = applyVehicleProblemEffects(get, set, entry, j);
  finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, ...outcome });
  return { consequences: freeCons(j) };
});

/** Reprise de contrôle INFLUENÇABLE d'un attelage « Incontrôlable » (#270, EDOC 07 l.284) : succès →
 *  l'attelage est maîtrisé (pas d'Accident) ; échec → Accident (96-00 de la table, verbatim). */
registerCascadeApplier('landForcedPaceControl', (get, set, step, hero) => {
  if (!step.result) return;
  const m = step.meta!;
  const finalKm = Number(m.finalKm), finalHours = Number(m.finalHours);
  const name = hero?.name ?? 'Le conducteur';
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
  const j = [`${name} tente de reprendre le contrôle : ${step.result.success ? 'l’attelage est maîtrisé.' : 'ACCIDENT !'}`];
  if (step.result.success) { finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, vehicleOut: false, vehicleLame: false }); return { consequences: freeCons(j) }; }
  const entry = rollVehicleProblem(96); // 96-00 = Accident (table verbatim)
  const outcome = applyVehicleProblemEffects(get, set, entry, j);
  finalizeForcedPace(get, set, { km: finalKm, hours: finalHours, ...outcome });
  return { consequences: freeCons(j) };
});

/**
 * Soins de l'ARRIVÉE au relais : le maréchal-ferrant remplace le fer (EDOC 07 l.166), la sellerie est
 * réparée (l.174), la bête boiteuse est laissée aux bons soins de l'étape. EDOC 07 l.166/174 — silence
 * sur coût/durée, valeur maison : on les résout gratuitement à l'arrivée (Patte brisée, elle, a coûté
 * la bête en route).
 */
function travelArrivalCare(get: Get, set: Set): string[] {
  const lines: string[] = [];
  for (const h of get().party) {
    for (const i of h.items ?? []) {
      if (!i.mountInjury || i.mountInjury === 'patte-brisee') continue;
      lines.push(`${i.name} (${h.name}) est ${i.mountInjury === 'boiteux' ? 'soignée' : 'remise en état'} à l'étape.`);
      delete i.mountInjury;
    }
  }
  if (lines.length) set({ party: [...get().party] });
  return lines;
}

/** « Voyage éreintant » raté : +1 jour de retard (le groupe erre) et +1 Exténué chacun.
 *  Renvoie les lignes journalisées (reprises par le récapitulatif de voyage). */
function applyEreintant(get: Get, set: Set): string[] {
  const party = get().party;
  const lines: string[] = [];
  for (const h of party) {
    if (h.dead) continue;
    addCondition(h, 'extenue', 1);
    lines.push(`${h.name} : +1 Exténué (détour épuisant).`);
  }
  set({ party: [...party], gameTime: get().gameTime + 24 * 60 }); // un jour de plus sur la route
  bus.emit(EVT.TIME_ADVANCED, { minutes: 24 * 60 });
  // Le jour de retard NE roule PAS l'entretien en eager (sinon Faim avant le repas de la halte) :
  // ce franchissement supplémentaire est décompté dans la cascade de nuit (`buildNightCascade`), qui
  // couvre tous les jours écoulés depuis `lastUpkeepDay` — donc ce détour aussi (non nourri : pas de repas ce jour-là).
  lines.push('Le détour coûte une journée entière au groupe.');
  log(get, set, lines);
  return lines;
}
