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
import { PERIPETIES } from '../data/peripeties';
import { rollTest, testDetail } from '../engine/tests';
import { partyBest } from '../engine/skills';
import { addCondition, removeCondition, stacks } from '../engine/conditions';
import { subtract as moneySub, canAfford, formatMoney } from '../engine/money';
import { d10, d100 } from '../engine/dice';

type Get = () => GameState;
type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

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
  const plan: TravelPlan = {
    routeId, fromPlaceId: from.id, toPlaceId: to.id, mode,
    classKey: opts.classKey, hoursPerDay: hours, km: route.km, kmDone: 0, interrupted: false,
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
    if (guard++ > 400) break; // garde-fou (durée d'année) — un trajet ne dure jamais autant
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

    // Fin de journée de route À PIED : fatigue d'Encombrement (p.295) + marche forcée (l.224).
    const dayLines: string[] = [];
    if (plan.mode === 'pied' && hoursToday >= base - 1e-9) {
      for (const h of party) {
        if (h.dead || h.outOfRencontre) continue;
        const fatigue = applyTravelFatigue(h);
        dayLines.push(...fatigue);
        recapDay.lines.push(...fatigue);
        if (plan.hoursPerDay > base) {
          const r = forcedMarchTest(h, battleRng());
          if (r) {
            // Journal en texte ; recap en LIGNE DE JET (multijet, comme le bilan de nuit).
            dayLines.push(r.line);
            recapDay.entries!.push({ actorId: h.id, icon: '🥾', label: 'Marche forcée', d: r.d, text: r.gained ? `+${r.gained} Exténué` : 'tient l’allure', tone: r.gained ? 'bad' : 'ok' });
          }
        }
      }
      if (dayLines.length) set({ party: [...party] });
    }
    log(get, set, dayLines);

    // Péripéties du jour (d'auteur puis table d10 RAW). Peut interrompre le voyage — une
    // EMBUSCADE est alors DIFFÉRÉE derrière le récit (`recap.then`) : le joueur lit d'abord
    // ce qui lui arrive, le combat démarre à l'acquittement du recap.
    const out: { then?: TravelThen } = {};
    if (resolvePerils(get, set, route, to.label, recapDay, out)) { finishRecap('interrupted', out.then); return; }

    if (arrived) {
      set({ travelPlan: null });
      log(get, set, [`— Arrivée à ${to.label} —`]);
      finishRecap('arrived');
      get().transitionTo(to.scene, to.entry);
      return;
    }
    // Nuit en route : HALTE — modale de Repos (auberge de relais si la route en a, sinon
    // campement). Le voyage se suspend ; « Continuer » du bilan reprend la route au matin.
    // Le RAPPORT DU JOUR s'affiche dans la halte (le soir même, avec ses conséquences).
    openRest(get, set, { places: placesOfKind(route.inns ? 'auberge' : 'camp'), travelHalt: true, travelDay: { ...recapDay, lines: [...recapDay.lines], entries: [...(recapDay.entries ?? [])] } });
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
          const n = stacks(h, 'Exténué');
          if (n > 0) { removeCondition(h, 'Exténué', n); lines.push(`${h.name} n’est plus Exténué.`); }
        }
        set({ party: [...party] });
        tell(lines);
        break;
      }
      case 'ereintant': {
        // Test de Survie en extérieur Accessible (+20), sinon +1 jour de retard et +1 Exténué chacun.
        const best = partyBest(party, 'Survie en extérieur');
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
        const best = partyBest(party, 'Perception');
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

/** « Voyage éreintant » raté : +1 jour de retard (le groupe erre) et +1 Exténué chacun.
 *  Renvoie les lignes journalisées (reprises par le récapitulatif de voyage). */
function applyEreintant(get: Get, set: Set): string[] {
  const party = get().party;
  const lines: string[] = [];
  for (const h of party) {
    if (h.dead) continue;
    addCondition(h, 'Exténué', 1);
    lines.push(`${h.name} : +1 Exténué (détour épuisant).`);
  }
  set({ party: [...party], gameTime: get().gameTime + 24 * 60 }); // un jour de plus sur la route
  bus.emit(EVT.TIME_ADVANCED, { minutes: 24 * 60 });
  lines.push(...runDailyUpkeep(get, set)); // l'entretien du jour perdu se RACONTE aussi
  lines.push('Le détour coûte une journée entière au groupe.');
  log(get, set, lines);
  return lines;
}
