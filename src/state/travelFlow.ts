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
} from '../engine/travel';
import { vehicleCombatant } from '../engine/vehicle';
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
   *  incidents (`vehicleWounds`). Présente seulement si le trajet utilise un véhicule à coque. */
  vehicle?: Combatant;
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
  opts: { classKey?: string; hoursPerDay?: number } = {},
): void {
  const { worldMap, scene, battle, party } = get();
  if (battle || !worldMap || !scene) return;
  const from = placeOfScene(worldMap, scene.id);
  const route = worldMap.routes.find((r) => r.id === routeId);
  if (!from || !route || (route.a !== from.id && route.b !== from.id)) return;
  if (!route.modes.includes(mode)) return;
  const to = placeById(worldMap, otherEnd(route, from.id));
  if (!to) return;

  // Transport payant : prix par km PAR PASSAGER (l.207), débité au départ — refus si bourse insuffisante.
  if (mode !== 'pied') {
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

  const base = baseHoursPerDay(worldMap);
  const hours = mode === 'pied'
    ? Math.min(Math.max(opts.hoursPerDay ?? base, 1), maxHoursPerDay(worldMap))
    : base; // transport : cadence du véhicule (RAW muet) = heures de route standard
  // Coque transitoire du véhicule du trajet (`Combatant` à PV depuis `vehicles.json` hull) — encaisse les
  // incidents (`vehicleWounds`) via `applyVehicleProblem` (engine/vehicle). Présente seulement sous les
  // Étapes EDOC et si le véhicule a un profil de coque. NB : le DÉCLENCHEUR RAW (Échec Stupéfiant à un Test
  // de Conduite d'attelage en allure forcée) n'est pas encore modélisé — la cadence d'un transport est fixée
  // (l.159). L'entité + l'application des Dégâts (le keystone) sont prêtes et testées ; le câblage du
  // déclencheur attend le mécanisme d'allure forcée en véhicule (dalle fluviale/maritime).
  const vehicle = mode !== 'pied' && rule('travel-etapes')
    ? (() => { const v = findVehicleById(mode); return v ? vehicleCombatant(v) : undefined; })()
    : undefined;
  const plan: TravelPlan = {
    routeId, fromPlaceId: from.id, toPlaceId: to.id, mode,
    classKey: opts.classKey, hoursPerDay: hours, km: route.km, kmDone: 0, interrupted: false,
    // Postes initialisés depuis les rôles PERSISTANTS (`travelRole`) — réutilisés chaque Étape (EDOC ch.5).
    postes: rule('travel-etapes') ? stageAssignmentFromRoles(party) : undefined,
    ...(vehicle ? { vehicle } : {}),
  };
  set({ travelPlan: plan, worldMapOpen: false, travelRecap: null });
  log(get, set, [`— En route vers ${to.label} (${route.km} km, ${TRAVEL_MODE_LABEL[mode].toLowerCase()}) —`]);
  runTravelDays(get, set);
}

/** Reprend un voyage interrompu (après une embuscade, par exemple). */
export function resumeTravel(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan || get().battle) return;
  if (get().travelRecap?.then) return; // une embuscade ATTEND son acquittement — pas d'esquive
  set({ travelPlan: { ...plan, interrupted: false }, worldMapOpen: false, travelRecap: null });
  log(get, set, ['— Le voyage reprend —']);
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

    // Vitesse du jour (à pied, l'Encombrement/les États du moment comptent — recalculée chaque jour).
    const kmh = travelSpeed(party, plan.mode, route.speed?.[plan.mode]);
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
      log(get, set, [`— Arrivée à ${to.label} —`]);
      finishRecap('arrived');
      get().transitionTo(to.scene, to.entry);
      return;
    }

    // Marche du jour : on avance l'horloge d'un bloc (PAS minute par minute, cf. en-tête).
    const hoursLeft = (plan.km - plan.kmDone) / kmh;
    const hoursToday = Math.min(plan.hoursPerDay, hoursLeft);
    set({ gameTime: get().gameTime + Math.round(hoursToday * 60) });
    bus.emit(EVT.TIME_ADVANCED, { minutes: Math.round(hoursToday * 60) });
    const upkeepLines = runDailyUpkeep(get, set); // au cas où la marche franchit minuit
    const kmDone = Math.min(plan.km, plan.kmDone + hoursToday * kmh);
    set({ travelPlan: { ...get().travelPlan!, kmDone } });
    const arrived = plan.km - kmDone < 1e-9;
    // L'entretien quotidien (rations/faim, maladies, convalescence) fait partie du RÉCIT du jour.
    const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: kmDone, hours: hoursToday, lines: [...upkeepLines], entries: [] };
    recap?.days.push(recapDay);

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
      log(get, set, [`— Arrivée à ${to.label} —`]);
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
