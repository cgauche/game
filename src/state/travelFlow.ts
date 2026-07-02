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
import type { GameState } from './store';
import { battleRng } from './battleRng';
import { bus, EVT } from './bus';
import { applyEffectsLoot } from './combatFlow';
import { openRest, placesOfKind } from './restFlow';
import { runDailyUpkeep } from './upkeep';
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
import { testValue } from '../engine/skills';
import {
  seasonOfMonth, rollStageWeather, stageExposureDifficulty, isColdSeason,
  pleinAirModifier, forageWeatherModifier, forageYield, WEATHER_LABEL, type Weather, type Season,
} from '../engine/travelStages';
import { hasCoat, partyHasTent, applyExposureFailure, isWeatherWarded } from '../engine/exposure';
import { rationCount } from '../engine/provisions';
import { itemFromGive } from '../engine/items';
import { stageAssignmentFromRoles, type StagePosting } from '../engine/activities';
import { resolveStagePostes } from './travelPostes';
import { buildSeaPlan, runSeaDays } from './seaVoyageFlow';
import type { Combatant } from '../engine/types';

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
}

const log = (get: Get, set: Set, lines: string[]) => {
  if (lines.length) set({ journal: [...get().journal.slice(-40), ...lines] });
};

/** Heures de voyage/jour SANS Test (RAW l.224, défaut 6) — paramétrable au niveau carte. */
export function baseHoursPerDay(map: WorldMap | null): number {
  return map?.params?.hoursPerDay ?? TRAVEL_DEFAULTS.hoursPerDay;
}

/** Plafond de marche forcée (heures/jour, canon muet — défaut 10) — paramétrable au niveau carte. */
export function maxHoursPerDay(map: WorldMap | null): number {
  return map?.params?.forcedMaxHours ?? TRAVEL_DEFAULTS.forcedMaxHours;
}

/** Démarre un voyage depuis le lieu courant le long d'une route de la carte. */
export function startTravel(
  get: Get, set: Set,
  routeId: string,
  mode: TravelMode,
  opts: { classKey?: string; hoursPerDay?: number; allure?: Allure; seaPace?: number } = {},
): void {
  const { worldMap, scene, battle, party } = get();
  if (battle || !worldMap || !scene) return;
  const from = placeOfScene(worldMap, scene.id);
  const route = worldMap.routes.find((r) => r.id === routeId);
  if (!from || !route || (route.a !== from.id && route.b !== from.id)) return;
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
    const seaPlan = buildSeaPlan(get, routeId, from.id, to.id, route, { pace: opts.seaPace });
    if (!seaPlan) {
      log(get, set, ['Aucun navire de campagne en état de prendre la mer — pas de traversée.']);
      return;
    }
    set({ travelPlan: seaPlan, worldMapOpen: false, travelRecap: null });
    log(get, set, [`— ${seaPlan.vehicle!.name} appareille vers ${to.label} (${route.km} milles) —`]);
    runSeaDays(get, set);
    return;
  }
  if (route.sea) return; // une route maritime ne s'emprunte qu'en mode 'mer'

  // Transport payant : prix par km PAR PASSAGER (l.207), débité au départ — refus si bourse insuffisante.
  if (mode !== 'pied' && mode !== 'monture') {
    const passengers = party.filter((h) => !h.dead && !h.outOfRencontre).length;
    const cost = transportCost(route.km, mode, opts.classKey ?? '', passengers, route.prices?.[mode]);
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
      : base; // transport : cadence du véhicule (RAW muet) = heures de route standard
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
  set({ travelPlan: { ...plan, interrupted: false }, worldMapOpen: false, travelRecap: null });
  log(get, set, ['— Le voyage reprend —']);
  if (plan.sea) { runSeaDays(get, set); return; } // traversée maritime : résolution navale
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
    const forced = plan.allure === 'galop' && plan.mode !== 'monture' && !plan.vehicleLame && vehicleTravel(plan.mode)?.draft
      ? forcedPaceDay(get, set, kmLeft)
      : null;
    const hoursToday = forced ? forced.hours : Math.min(plan.hoursPerDay, kmLeft / kmh);
    set({ gameTime: get().gameTime + Math.round(hoursToday * 60) });
    bus.emit(EVT.TIME_ADVANCED, { minutes: Math.round(hoursToday * 60) });
    const upkeepLines = runDailyUpkeep(get, set); // au cas où la marche franchit minuit
    const kmDone = Math.min(plan.km, plan.kmDone + (forced ? forced.km : hoursToday * kmh));
    set({ travelPlan: { ...get().travelPlan!, kmDone } });
    const arrived = plan.km - kmDone < 1e-9;
    // L'entretien quotidien (rations/faim, maladies, convalescence) fait partie du RÉCIT du jour.
    const recapDay: TravelRecapDay = {
      kmFrom: plan.kmDone, kmTo: kmDone, hours: hoursToday,
      lines: [...(forced?.lines ?? []), ...upkeepLines], entries: [...(forced?.entries ?? [])],
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
    const rollMarchEager = () => {
      if (!marchHeroes.length) return;
      const lines: string[] = [];
      for (const id of marchHeroes) {
        const h = get().party.find((x) => x.id === id);
        if (!h) continue;
        const r = forcedMarchTest(h, battleRng());
        if (r) { lines.push(r.line); recapDay.entries!.push({ actorId: id, icon: '🥾', label: 'Marche forcée', d: r.d, text: r.gained ? `+${r.gained} Exténué` : 'tient l’allure', tone: r.gained ? 'bad' : 'ok' }); }
      }
      set({ party: [...get().party] });
      log(get, set, lines);
    };

    // Sous-système OPTIONNEL « Voyage par Étapes » (EDOC ch.5, parent `travel-etapes`). Quand il est
    // ÉTEINT (défaut), ce bloc est entièrement court-circuité → le chemin jour-par-jour du LdB reste
    // BYTE-IDENTIQUE. Quand il est allumé, chaque journée de route EST une Étape : jet de Météo (l.42),
    // puis les POSTES d'Activité (l.131, dont l'Approvisionnement) et l'Exposition de fin d'Étape
    // (l.73, si `travel-attraper-froid` et hors « Plein air »). Ordre RAW (l.10) : Météo → activités → péripéties.
    if (rule('travel-etapes')) resolveStage(get, set, recapDay);

    // Péripéties du jour (d'auteur puis table d10 RAW). Peut interrompre le voyage — une
    // EMBUSCADE est alors DIFFÉRÉE derrière le récit (`recap.then`) : le joueur lit d'abord
    // ce qui lui arrive, le combat démarre à l'acquittement du recap.
    const out: { then?: TravelThen } = {};
    if (resolvePerils(get, set, route, to.label, recapDay, out)) { rollMarchEager(); finishRecap('interrupted', out.then); return; }

    if (arrived) {
      rollMarchEager();
      set({ travelPlan: null });
      const care = travelArrivalCare(get, set);
      recapDay.lines.push(...care);
      log(get, set, [`— Arrivée à ${to.label} —`, ...care]);
      finishRecap('arrived');
      get().transitionTo(to.scene, to.entry);
      return;
    }
    // Nuit en route : HALTE — modale de Repos (auberge de relais si la route en a, sinon
    // campement). Le voyage se suspend ; « Continuer » du bilan reprend la route au matin.
    // La MARCHE FORCÉE du jour ouvre la cascade de la nuit (influençable) via `travelMarch`.
    openRest(get, set, { places: placesOfKind(route.inns ? 'auberge' : 'camp'), travelHalt: true, travelMarch: marchHeroes, travelDay: { ...recapDay, lines: [...recapDay.lines], entries: [...(recapDay.entries ?? [])] } });
    return; // au matin, runTravelDays repart sur un recap NEUF (segment suivant)
  }
}

/** Reprise au MATIN après la halte de nuit (« Continuer » du bilan de la modale de Repos). */
export function continueTravelAfterNight(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan || plan.interrupted || get().battle) return;
  if (plan.sea) { runSeaDays(get, set); return; } // traversée maritime : la journée suivante est navale
  runTravelDays(get, set);
}

/** Tire et résout les péripéties du jour. Renvoie `true` si le voyage est INTERROMPU.
 *  `out.then` : suite DIFFÉRÉE (embuscade) — le combat ne démarre qu'à l'acquittement du recap. */
function resolvePerils(get: Get, set: Set, route: MapRoute, destLabel: string, day: TravelRecapDay | undefined, out: { then?: TravelThen }): boolean {
  const before = { sceneId: get().scene?.id, inBattle: !!get().battle };
  const interrupted = () => !!get().battle || get().scene?.id !== before.sceneId;
  // Journal ET récapitulatif du jour (audit M4) : les mêmes lignes, une seule écriture.
  const tell = (lines: string[]) => { log(get, set, lines); day?.lines.push(...lines); };
  const markInterrupted = () => {
    const plan = get().travelPlan;
    if (plan) set({ travelPlan: { ...plan, interrupted: true } });
    tell([`(Voyage vers ${destLabel} interrompu — il pourra reprendre depuis la carte.)`]);
  };

  // 1. Péripéties d'AUTEUR (probabilité par jour, effets d'éditeur). Une péripétie qui DÉCLENCHE
  // un combat/une transition est DIFFÉRÉE derrière le récit (recap d'abord, combat ensuite —
  // sinon le joueur se retrouve en combat sans savoir pourquoi).
  for (const peril of route.perils ?? []) {
    if (d100(battleRng()) > Math.max(0, Math.min(100, peril.chancePct))) continue;
    tell([`Péripétie : ${peril.label}`]);
    if ((peril.effects ?? []).some((e) => e.type === 'startCombat' || e.type === 'transition')) {
      out.then = { kind: 'effects', effects: peril.effects };
      markInterrupted();
      return true;
    }
    applyEffectsLoot(get, set, peril.effects, peril.label); // trouvaille d'auteur en route → fenêtre d'attribution
    if (interrupted()) { markInterrupted(); return true; } // repli : un effet a surpris (dialogue…)
  }

  // 2. Table d10 RAW (l.237 : « 1d10 par jour … événement sur un résultat de 8 », seuil paramétrable).
  const die = route.perilDie ?? get().worldMap?.params?.perilDie ?? TRAVEL_DEFAULTS.perilDie;
  if (die >= 1 && d10(battleRng()) === die) {
    const entry = PERIPETIES[d10(battleRng()) - 1];
    tell([`Péripétie de voyage (🎲 ${entry.roll}) — ${entry.label} : ${entry.text}`]);
    const party = get().party;
    switch (entry.kind) {
      case 'reposant': {
        // Texte explicite : soin de TOUTES les Blessures + retrait de TOUS les Exténué.
        const lines: string[] = [];
        for (const h of party) {
          if (h.dead) continue;
          if (h.wounds.current < h.wounds.max) { h.wounds.current = h.wounds.max; lines.push(`${h.name} récupère toutes ses Blessures.`); }
          const n = stacks(h, 'extenue');
          if (n > 0) { removeCondition(h, 'extenue', n); lines.push(`${h.name} n’est plus Exténué.`); }
        }
        set({ party: [...party] });
        tell(lines);
        break;
      }
      case 'ereintant': {
        // Test de Survie en extérieur Accessible (+20), sinon +1 jour de retard et +1 Exténué chacun.
        const best = partyAssisted(party, 'survie-en-exterieur'); // Soutien (LDB 12) : le groupe œuvre de concert
        const t = best ? rollTest(best.value, 'accessible', battleRng()) : null;
        if (t && best) {
          log(get, set, [`${best.actor.name} — Survie en extérieur (+20) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'un itinéraire de substitution est trouvé.' : 'ÉCHEC.'}`]);
          // Recap : LIGNE DE JET structurée (multijet), pas du texte.
          day?.entries?.push({ actorId: best.actor.id, icon: '🧭', label: 'Survie en extérieur', d: testDetail('Survie en extérieur', best.value, t), text: t.success ? 'itinéraire de substitution trouvé' : 'le groupe erre un jour de plus', tone: t.success ? 'ok' : 'bad' });
        }
        if (!t?.success) day?.lines.push(...applyEreintant(get, set));
        break;
      }
      case 'attaque': {
        // Test de Perception Accessible (+20) raté → EMBUSCADE (rencontre d'auteur sur la route) ;
        // réussi → le combat a quand même lieu, mais SANS surprise (« le groupe les voit venir »).
        const configured = !!(route.ambush?.scene && route.ambush.encounter);
        const best = partyAssisted(party, 'perception'); // Soutien (LDB 12) : le groupe guette de concert
        const t = best ? rollTest(best.value, 'accessible', battleRng()) : null;
        if (t && best) {
          log(get, set, [`${best.actor.name} — Perception (+20) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'le groupe les voit venir !' : configured ? 'ÉCHEC — embuscade !' : 'ÉCHEC.'}`]);
          day?.entries?.push({ actorId: best.actor.id, icon: '👁️', label: 'Perception', d: testDetail('Perception', best.value, t), text: t.success ? 'le groupe les voit venir !' : configured ? 'embuscade !' : 'ÉCHEC', tone: t.success ? 'ok' : 'bad' });
        }
        if (configured) {
          // DIFFÉRÉ derrière le récit : le recap s'affiche d'abord, le combat démarre à
          // son acquittement (dismissTravelRecap) — on comprend ce qui arrive AVANT de se battre.
          out.then = { kind: 'ambush', scene: route.ambush!.scene, entry: route.ambush!.entry, encounter: route.ambush!.encounter, noSurprise: !!t?.success };
          markInterrupted();
          return true;
        }
        // Pas de rencontre configurée sur la route : rien d'inventé — on le DIT (sinon le texte
        // promet une embuscade qui n'arrive jamais).
        tell(['(Aucune rencontre d’embuscade n’est configurée sur cette route — l’alerte reste sans suite.)']);
        break;
      }
      default:
        break; // narratif : le texte au journal suffit
    }
  }
  return false;
}

/** Saison courante (table de Météo EDOC ch.5 l.44) depuis l'horloge du jeu. */
function currentSeason(get: Get): Season {
  return seasonOfMonth(toDate(get().gameTime).month);
}

/**
 * Résout UNE Étape de voyage (EDOC ch.5) — appelée par jour de route quand `travel-etapes` est on.
 * Ordre RAW (l.10) : jet de Météo → activités (Approvisionnement, l.108) → Exposition de fin
 * d'Étape (option « Attraper Froid », l.73). Écrit dans le journal ET le recap du jour (mêmes lignes).
 * Mute le groupe (rations gagnées par l'Approvisionnement, pénalités/Blessures d'Exposition).
 */
function resolveStage(get: Get, set: Set, day: TravelRecapDay): void {
  const season = currentSeason(get);
  const tell = (lines: string[]) => { log(get, set, lines); day.lines.push(...lines); };

  // 1. Jet de Météo de l'Étape (l.42 : « au début de chaque étape »).
  const w = rollStageWeather(battleRng(), season);
  const weather: Weather = w.weather;
  tell([`Météo de l'Étape (🎲 ${w.roll}) : ${WEATHER_LABEL[weather]}.`]);

  const party = get().party;
  const livingHeroes = party.filter((h) => !h.dead && !h.outOfRencontre);

  // 2. POSTES d'Activité de l'Étape (EDOC ch.5 l.131) — résolus et appliqués par le module feuille
  //    `travelPostes`. L'Approvisionnement est désormais un POSTE (plus un flag) : un héros par poste,
  //    son Test, son Exténué ; agrégation porte/cumul/individuel. La porte « Plein air »
  //    (`suppressExposure`, l.141) dispense le groupe du Test d'Exposition ci-dessous.
  const postes = resolveStagePostes(get, set, weather);
  if (postes.entries.length) day.entries?.push(...postes.entries);
  if (postes.lines.length) tell(postes.lines);

  // 3. Exposition de fin d'Étape — option « Attraper Froid » (l.73, règle optionnelle RAW), SAUTÉE si
  // un héros a réussi « Plein air » (porte `suppressExposure`, l.141). Réutilise le mécanisme de FROID
  // EXISTANT (`applyExposureFailure`, engine/exposure.ts — escalade cumulative l.415 : 1ᵉʳ échec −10
  // CT/Ag/Dex, 2ᵉ −10 le reste, 3ᵉ+ Blessures). Un SEUL Test de Résistance par Étape (l.73), difficulté
  // (Complexe −10 / Difficile −20 selon manteau/tente) via `stageExposureDifficulty`. Test roulé ICI
  // (pas via `exposureNight`) pour ne PAS cumuler le malus de manteau LdB avec celui d'EDOC.
  if (rule('travel-attraper-froid') && !postes.suppressExposure && livingHeroes.length) {
    const tent = partyHasTent(party);
    const lines: string[] = [];
    let anyExposed = false;
    for (const h of livingHeroes) {
      const diff = stageExposureDifficulty(weather, hasCoat(h), tent);
      if (!diff) continue; // bien équipé sous pluie/neige normale, ou beau temps → aucun Test
      if (isWeatherWarded(h)) { lines.push(`${h.name} ignore le froid et les intempéries (protection magique).`); anyExposed = true; continue; }
      const resVal = testValue(h, 'resistance', 'E');
      const t = rollTest(resVal, diff, battleRng()); // Test de Résistance de fin d'Étape (l.73)
      anyExposed = true;
      lines.push(`${h.name} — Exposition de fin d'Étape (${WEATHER_LABEL[weather]}) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'tient le coup.' : 'transi par le froid.'}`);
      if (!t.success) {
        // Escalade cumulative (l.415) : le rang d'échec = nombre de paliers de froid déjà subis + 1.
        const prior = (h.activeEffects ?? []).filter((e) => e.effectId === 'exposition-froid').length;
        // Distinct des deux paliers d'effet : 0 effet = 1ᵉʳ échec ; 3 effets (CT/Ag/Dex) = 2ᵉ ; 10 = 3ᵉ+.
        const rank = prior >= 10 ? 3 : prior >= 3 ? 2 : 1;
        lines.push(...applyExposureFailure(h, rank, battleRng()).log);
        // Saison froide (l.75) : « tout Personnage ayant souffert de cette exposition … contracte un
        // rhume ». Aucune maladie « rhume » n'existe dans `maladies.json` (LDB 20 ne la liste pas) → on
        // n'INVENTE pas de maladie : on le RACONTE (le froid mécanique est déjà appliqué ci-dessus).
        if (isColdSeason(season)) lines.push(`${h.name} grelotte et tousse — un rhume couve (saison froide).`);
      }
      day.entries?.push({ actorId: h.id, icon: '🥶', label: 'Exposition', d: testDetail('Résistance', resVal, t), text: t.success ? 'tient' : 'froid', tone: t.success ? 'ok' : 'bad' });
    }
    if (anyExposed) { set({ party: [...get().party] }); tell(lines); }
  }
}

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
      day.entries!.push({ actorId: o.mount.hero.id, icon: '🐎', label: t.label, d: t, text: t.success ? 'tient l’allure' : 'flanche', tone: t.success ? 'ok' : 'bad' });
    }
    for (const inc of o.incidents) {
      if (inc.riderTest) {
        day.entries!.push({
          actorId: o.mount.hero.id, icon: '🐎', label: `${inc.entry.label} — Chevaucher`, d: inc.riderTest,
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
      actorId: driver?.actor.id ?? '', icon: '🐎', label: 'Conduite d’attelage (allure forcée)',
      d: testDetail('Conduite d’attelage', base, roll),
      text: stupefiant ? 'Échec Stupéfiant — Problème de véhicule !' : 'les bêtes repassent au pas', tone: 'bad',
    });
    out.lines.push(`${driver?.actor.name ?? 'Le conducteur'} — Conduite d'attelage (allure forcée) : 🎲 ${roll.roll}/${roll.target} → ÉCHEC${stupefiant ? ' STUPÉFIANT' : ''}, l'attelage repasse au pas.`);
    // « chacun doit réussir un Test de Résistance Intermédiaire (+0) ou acquérir un État Exténué » (l.229)
    // — les bêtes de l'attelage (transport), leur fatigue est journalisée.
    for (let i = 0; i < t.draft!.count; i++) {
      const rt = rollTest(draft.e, 'intermediaire', battleRng());
      if (!rt.success) out.lines.push(`Une bête de l'attelage est Exténuée (Résistance 🎲 ${rt.roll}/${rt.target}).`);
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
    out.lines.push(`Problème de véhicule — ${entry.label}.`, `${driver?.actor.name ?? 'Le conducteur'} tente de reprendre le contrôle : 🎲 ${rt.roll}/${rt.target} → ${rt.success ? 'l’attelage est maîtrisé.' : 'ACCIDENT !'}`);
    if (rt.success) return { vehicleOut: false, vehicleLame: false };
    entry = rollVehicleProblem(96); // 96-00 = Accident (table verbatim)
  } else if (entry.id === 'casse') {
    // « Si le véhicule se déplaçait plus vite que la marche, traitez ce résultat comme un Accident » (l.276).
    out.lines.push(`Problème de véhicule — ${entry.label}, à pleine allure : ACCIDENT !`);
    entry = rollVehicleProblem(96);
  }
  const r = applyVehicleProblem(vehicle, entry.min, battleRng());
  out.lines.push(...r.lines);
  // Dégâts aux occupants (Cassé : 1 Blessure ignorant BE et PA ; Accident : 2d10 − BE − PA, min 1) —
  // langue unique GameOp, portée par la table (`occupantOps`).
  if (r.entry.occupantOps?.length) {
    const lines: string[] = [];
    for (const h of get().party) {
      if (h.dead || h.outOfRencontre) continue;
      lines.push(...applyOps(h, r.entry.occupantOps, { rng: battleRng() }));
    }
    set({ party: [...get().party] });
    out.lines.push(...lines);
  }
  if (r.entry.id === 'endommage') return { vehicleOut: false, vehicleLame: true };
  return { vehicleOut: r.entry.id === 'accident' || vehicle.wounds.current <= 0, vehicleLame: false };
}

/**
 * Soins de l'ARRIVÉE au relais : le maréchal-ferrant remplace le fer (EDOC 07 l.166), la sellerie est
 * réparée (l.174), la bête boiteuse est laissée aux bons soins de l'étape. Choix documenté : le RAW ne
 * chiffre ni coût ni durée pour ces remises en état — on les résout à l'arrivée (Patte brisée, elle,
 * a coûté la bête en route).
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
  lines.push(...runDailyUpkeep(get, set)); // l'entretien du jour perdu se RACONTE aussi
  lines.push('Le détour coûte une journée entière au groupe.');
  log(get, set, lines);
  return lines;
}
