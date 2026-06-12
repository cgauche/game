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
 * route au matin (`continueTravelAfterNight`). Le récapitulatif traverse les nuits via
 * `travelPlan.recapDays`.
 *
 * Une péripétie qui déclenche un combat/une transition INTERROMPT le voyage : `travelPlan` mémorise
 * la progression (`kmDone`) et la carte propose « Reprendre le voyage » (`resumeTravel`).
 */
import type { GameState } from './store';
import { battleRng } from './battleRng';
import { bus, EVT } from './bus';
import { applyEffects } from './combatFlow';
import { openRest, placesOfKind } from './restFlow';
import { runDailyUpkeep } from './upkeep';
import { placeById, placeOfScene, otherEnd, type MapRoute, type WorldMap } from './worldMap';
import {
  TravelMode, TRAVEL_DEFAULTS, TRAVEL_MODE_LABEL, travelSpeed, transportCost, forcedMarchTest, applyTravelFatigue,
} from '../engine/travel';
import { PERIPETIES } from '../data/peripeties';
import { rollTest } from '../engine/tests';
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
  /** Fatigue, marche forcée, péripéties… (les mêmes lignes que le journal). */
  lines: string[];
}

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
  /** Journées du récapitulatif déjà jouées (le récap traverse les HALTES de nuit). */
  recapDays?: TravelRecapDay[];
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
    days: [...(plan0.recapDays ?? [])], // les journées d'avant la halte de nuit
  } : null;
  const finishRecap = (status: TravelRecap['status']) => {
    if (!recap) return;
    recap.status = status;
    recap.kmDone = get().travelPlan?.kmDone ?? recap.km;
    set({ travelRecap: { ...recap, days: [...recap.days] } });
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
    runDailyUpkeep(get, set); // au cas où la marche franchit minuit
    const kmDone = Math.min(plan.km, plan.kmDone + hoursToday * kmh);
    set({ travelPlan: { ...get().travelPlan!, kmDone } });
    const arrived = plan.km - kmDone < 1e-9;
    const recapDay: TravelRecapDay = { kmFrom: plan.kmDone, kmTo: kmDone, hours: hoursToday, lines: [] };
    recap?.days.push(recapDay);

    // Fin de journée de route À PIED : fatigue d'Encombrement (p.295) + marche forcée (l.224).
    const dayLines: string[] = [];
    if (plan.mode === 'pied' && hoursToday >= base - 1e-9) {
      for (const h of party) {
        if (h.dead || h.outOfRencontre) continue;
        dayLines.push(...applyTravelFatigue(h));
        if (plan.hoursPerDay > base) dayLines.push(...forcedMarchTest(h, battleRng()));
      }
      if (dayLines.length) set({ party: [...party] });
    }
    log(get, set, dayLines);
    recapDay.lines.push(...dayLines);

    // Péripéties du jour (d'auteur puis table d10 RAW). Peut interrompre le voyage.
    if (resolvePerils(get, set, route, to.label, recapDay.lines)) { finishRecap('interrupted'); return; }

    if (arrived) {
      set({ travelPlan: null });
      log(get, set, [`— Arrivée à ${to.label} —`]);
      finishRecap('arrived');
      get().transitionTo(to.scene, to.entry);
      return;
    }
    // Nuit en route : HALTE — modale de Repos (auberge de relais si la route en a, sinon
    // campement). Le voyage se suspend ; « Continuer » du bilan reprend la route au matin.
    set({ travelPlan: { ...get().travelPlan!, recapDays: recap ? [...recap.days] : undefined } });
    openRest(get, set, { places: placesOfKind(route.inns ? 'auberge' : 'camp'), travelHalt: true });
    return;
  }
}

/** Reprise au MATIN après la halte de nuit (« Continuer » du bilan de la modale de Repos). */
export function continueTravelAfterNight(get: Get, set: Set): void {
  const plan = get().travelPlan;
  if (!plan || plan.interrupted || get().battle) return;
  runTravelDays(get, set);
}

/** Tire et résout les péripéties du jour. Renvoie `true` si le voyage est INTERROMPU. */
function resolvePerils(get: Get, set: Set, route: MapRoute, destLabel: string, recapLines?: string[]): boolean {
  const before = { sceneId: get().scene?.id, inBattle: !!get().battle };
  const interrupted = () => !!get().battle || get().scene?.id !== before.sceneId;
  // Journal ET récapitulatif du jour (audit M4) : les mêmes lignes, une seule écriture.
  const tell = (lines: string[]) => { log(get, set, lines); recapLines?.push(...lines); };
  const markInterrupted = () => {
    const plan = get().travelPlan;
    if (plan) set({ travelPlan: { ...plan, interrupted: true } });
    tell([`(Voyage vers ${destLabel} interrompu — il pourra reprendre depuis la carte.)`]);
  };

  // 1. Péripéties d'AUTEUR (probabilité par jour, effets d'éditeur).
  for (const peril of route.perils ?? []) {
    if (d100(battleRng()) > Math.max(0, Math.min(100, peril.chancePct))) continue;
    tell([`Péripétie : ${peril.label}`]);
    applyEffects(get, set, peril.effects);
    if (interrupted()) { markInterrupted(); return true; }
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
        if (t && best) tell([`${best.actor.name} — Survie en extérieur (+20) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'un itinéraire de substitution est trouvé.' : 'ÉCHEC.'}`]);
        if (!t?.success) recapLines?.push(...applyEreintant(get, set));
        break;
      }
      case 'attaque': {
        // Test de Perception Accessible (+20) raté → EMBUSCADE (rencontre d'auteur sur la route).
        const best = partyBest(party, 'Perception');
        const t = best ? rollTest(best.value, 'accessible', battleRng()) : null;
        if (t && best) tell([`${best.actor.name} — Perception (+20) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'le groupe les voit venir !' : 'ÉCHEC — embuscade !'}`]);
        if (route.ambush?.scene && route.ambush.encounter) {
          get().transitionTo(route.ambush.scene, route.ambush.entry);
          get().startCombat(route.ambush.encounter, undefined, { noSurprise: !!t?.success });
          markInterrupted();
          return true;
        }
        break; // pas de rencontre configurée → narratif seul (rien d'inventé)
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
  runDailyUpkeep(get, set);
  lines.push('Le détour coûte une journée entière au groupe.');
  log(get, set, lines);
  return lines;
}
