/**
 * REPOS — source UNIQUE de la nuit de sommeil (remplace le POC restPartyOvernight de combatFlow).
 *
 * `sleepParty` est LE moteur de nuit : horloge jusqu'à l'aube (chaque journée de repos se termine
 * à l'aube — le « temps minimum entre deux repos » est le temps lui-même), entretien quotidien #T3
 * (anti-double-comptage), récupération + cauchemars par héros, contagion de promiscuité. Consommé
 * par : la MODALE de Repos (ci-dessous), la nuit de voyage (travelFlow), la clôture d'interlude et
 * la triche de recette (`restParty`).
 *
 * La MODALE (pendingRest) ajoute par-dessus : phase RÉGLAGES par héros (couchage + pitance, coût
 * RAW calculé), puis phase BILAN — UN écran globalisé de jets subis (brique multi-jets NightEntry,
 * réutilisable pour d'autres cascades), au lieu d'une pluie de modales.
 *
 * RAW :
 *  - Récupération (LDB 18 l.380) : Résistance +20 après « une bonne nuit de sommeil » → DR+BE PB,
 *    + BE/jour inconditionnel — le canon ne module PAS la récupération par la qualité du lit ;
 *  - Prix (LDB ch.66 p.304) : chambre commune 10 sc/pers · privée 10 pa pour 2 (la grande pour 4
 *    coûte le double → regrouper par paires est équivalent, coût auto) · repas 1 pa ; PIÈTRE = ½
 *    prix, et la nourriture piètre expose à la Courante galopante (10 %, ch.66 l.51) ;
 *  - Dehors : Exposition (LDB 18 l.408-415 — engine/exposure) selon la MÉTÉO de la scène ;
 *  - Faim (LDB 18 l.417-422) : un héros sans pitance ne récupère pas (engine/provisions).
 */
import type { Combatant } from '../engine/types';
import type { RollBreakdown } from '../engine/combat';
import { battleRng } from './battleRng';
import { rollTest } from '../engine/tests';
import { partyBest } from '../engine/skills';
import { hasHealSkill } from '../engine/healing';
import { isOutOfAction } from '../engine/conditions';
import { restRecovery, restResistVal, type RestRoll } from '../engine/rest';
import { rollContraction, DISEASE_DEFS, contagiousDiseases } from '../engine/disease';
import { weatherExposure, exposureTestCount, exposureNight, expireExposureEffects, partyHasTent, type ExposureSeverity } from '../engine/exposure';
import { isRation, feedFromMeal } from '../engine/provisions';
import { toBrass, fromBrass, canAfford, subtract as moneySub, formatMoney, type Money } from '../engine/money';
import { minutesUntilNext, DAWN_MINUTE, MINUTES_PER_DAY } from '../engine/clock';
import { runDailyUpkeep } from './upkeep';
import { continueTravelAfterNight } from './travelFlow';
import { bus, EVT } from './bus';
import type { GameState } from './store';

export type RestKind = 'auberge' | 'maison' | 'camp';
export type RestLodging = 'commune' | 'privee' | 'maison' | 'dehors';
export type RestFood = 'repas' | 'ration' | 'maison' | 'rien';

/** Lieux de repos OFFERTS par le contexte (scène, effet, halte de voyage) — combinables :
 *  un village peut offrir l'auberge ET le camp ; chaque héros choisit ENSUITE le sien. */
export interface RestPlaces {
  auberge?: boolean;
  maison?: boolean;
  camp?: boolean;
}

/** L'offre d'un contexte nommé (effet `rest` legacy / halte de voyage) — dormir dehors reste
 *  toujours possible (choix personnel : on peut manger à l'auberge et dormir à la belle étoile). */
export function placesOfKind(kind: RestKind): RestPlaces {
  return kind === 'auberge' ? { auberge: true, camp: true } : kind === 'maison' ? { maison: true, camp: true } : { camp: true };
}

/** Entrée du BILAN — modèle de la brique « multi-jets » (réutilisable : fins de Round, etc.). */
export interface NightEntry {
  actorId?: string;
  icon?: string;
  label: string;
  /** Jet affiché en RollLine (base + mods = cible · d100 · DR). */
  d?: RollBreakdown;
  /** Issue / note en clair (« +7 PB », « jour 4/6 »). */
  text?: string;
  tone?: 'ok' | 'bad' | 'info';
}

export interface PendingRest {
  places: RestPlaces;
  /** Piètre : ½ prix, nourriture à risque (Courante galopante 10 %) — LDB ch.66. */
  quality: 'normale' | 'pietre';
  days: number;
  perHero: Record<string, { lodging: RestLodging; food: RestFood }>;
  phase: 'setup' | 'bilan';
  /** Bilan de la nuit (multi-jets). */
  results?: NightEntry[];
  /** Horloge avant/après (le passage du temps est VISIBLE). */
  slept?: { from: number; to: number };
  /** COOP : ✓ par siège avant de dormir (l'hôte dort à l'unanimité). */
  readyBySeat?: Record<number, boolean>;
  /** Halte de NUIT d'un voyage (travelFlow) : « Continuer » du bilan REPREND la route. */
  travelHalt?: boolean;
}

type Get = () => GameState;
type Set = (partial: any) => void;

/**
 * LE moteur de nuit (sans modale) : avance l'horloge à l'aube (× days), entretien #T3, récupération
 * + cauchemars, contagion. `beforeRecovery` (modale) s'exécute la nuit tombée, AVANT la récupération
 * (Exposition d'un campement). Renvoie le bilan structuré ; écrit aussi le journal.
 * NB : on n'avance PAS l'horloge minute par minute (advanceTime rejouerait l'entretien de Round —
 * hémorragie/poison/feu tueraient le dormeur ; RAW 16 l.105 : le repos suppose des États stabilisés,
 * restRecovery refuse d'ailleurs un héros Hémorragique/En flammes/Empoisonné).
 */
export function sleepParty(
  get: Get,
  set: Set,
  days = 1,
  opts: { fedDaily?: boolean; beforeRecovery?: (entries: NightEntry[]) => void } = {},
): NightEntry[] {
  if (get().battle) return [];
  const n = Math.max(1, Math.floor(days));
  const rng = battleRng();
  const entries: NightEntry[] = [];
  const journal: string[] = [];

  // La nuit passe — chaque journée de repos se termine à l'AUBE.
  const from = get().gameTime;
  const toDawn = minutesUntilNext(from, DAWN_MINUTE);
  const firstNight = toDawn === 0 ? MINUTES_PER_DAY : toDawn;
  set({ gameTime: from + firstNight + (n - 1) * MINUTES_PER_DAY });
  bus.emit(EVT.TIME_ADVANCED, { minutes: get().gameTime - from });

  // Soins prolongés : un soignant valide (Guérison) veille les malades — Test supposé réussi sur la
  // durée (abstraction du repos, LDB 09 : −1 jour/jour de soins par maladie).
  const caredFor = get().party.some((h) => hasHealSkill(h) && !h.dead && !isOutOfAction(h));
  // Le bilan de nuit LISTE l'entretien quotidien (rations/faim, maladies, convalescence) — le
  // journal seul ne suffit pas. Portrait attribué par préfixe « Nom… » quand la ligne le porte.
  for (const text of runDailyUpkeep(get, set, { caredFor, fedDaily: opts.fedDaily })) {
    entries.push({ actorId: get().party.find((h) => text.startsWith(h.name))?.id, icon: '📆', label: 'Entretien quotidien', text, tone: 'info' });
  }

  // Campement (modale) : abri + Exposition AVANT la récupération.
  opts.beforeRecovery?.(entries);

  // Récupération + cauchemars, héros par héros (jets structurés pour le bilan).
  const party = get().party;
  for (const h of party) {
    if (h.dead) continue;
    const rolls: RestRoll[] = [];
    const log = restRecovery(h, rng, n, rolls);
    for (const r of rolls) {
      entries.push({
        actorId: h.id,
        icon: r.kind === 'recovery' ? '🛌' : '😱',
        label: r.kind === 'recovery' ? 'Récupération' : 'Cauchemars (Calme)',
        d: { label: r.kind === 'recovery' ? 'Résistance' : 'Calme', base: r.base, modifier: r.target - r.base, target: r.target, roll: r.roll, success: r.success, sl: r.sl },
        tone: r.success ? 'ok' : 'bad',
      });
    }
    for (const line of log) entries.push({ actorId: h.id, icon: '🛌', label: 'Nuit', text: line.replace(`${h.name} `, ''), tone: 'info' });
    journal.push(...log);
  }

  // Contagion de promiscuité (chambrée/campement — LDB 20 l.185, 1 Test de Contraction par jour).
  for (const sick of party) {
    for (const dz of contagiousDiseases(sick)) {
      for (const other of party) {
        if (other === sick || other.dead) continue;
        const def = DISEASE_DEFS[dz.name];
        for (let d = 0; d < n; d++) {
          const log = rollContraction(other, dz.name, restResistVal(other), def?.contractDifficulty ?? 'accessible', rng);
          if (log.length) {
            entries.push({ actorId: other.id, icon: '🤒', label: `Contagion (${dz.name})`, text: log.join(' '), tone: 'bad' });
            journal.push(...log);
          }
        }
      }
    }
  }

  const title = n > 1 ? `— Le groupe se repose ${n} jours —` : '— Le groupe dort jusqu’à l’aube —';
  set({ party: [...get().party], journal: [...get().journal.slice(-40), title, ...journal] });
  bus.emit(EVT.SCENE_DIRTY);
  return entries;
}

/** Prix RAW (LDB ch.66 p.304), en sous de cuivre — piètre = ½. */
const PRICE_BRASS = { commune: 10, privee: 10 * 12, repas: 12 } as const; // 1 pa = 12 sc

/** Couchages proposés par l'offre du lieu — PAR HÉROS ensuite (choix personnels). */
export function lodgingOptions(places: RestPlaces): RestLodging[] {
  const out: RestLodging[] = [];
  if (places.auberge) out.push('privee', 'commune');
  if (places.maison) out.push('maison');
  if (places.camp || places.auberge || places.maison) out.push('dehors'); // la belle étoile reste un choix
  return out;
}

/** Pitances proposées (orthogonales au couchage : manger à l'auberge et dormir dehors est permis).
 *  « ration » seulement si le héros en a une. */
export function foodOptions(places: RestPlaces, hero: Combatant): RestFood[] {
  const out: RestFood[] = [];
  if (places.auberge) out.push('repas');
  if (places.maison) out.push('maison');
  if ((hero.items ?? []).some(isRation)) out.push('ration');
  out.push('rien');
  return out;
}

/** Coût total du repos (chambres regroupées par 2, repas par convive), par nuit × days. */
export function restCost(p: PendingRest, party: Combatant[]): Money {
  const half = p.quality === 'pietre' ? 0.5 : 1;
  let brass = 0;
  const heroes = party.filter((h) => !h.dead && p.perHero[h.id]);
  const nPrivee = heroes.filter((h) => p.perHero[h.id].lodging === 'privee').length;
  const nCommune = heroes.filter((h) => p.perHero[h.id].lodging === 'commune').length;
  const nRepas = heroes.filter((h) => p.perHero[h.id].food === 'repas').length;
  brass += Math.ceil(nPrivee / 2) * PRICE_BRASS.privee; // chambre pour 2 (grande pour 4 = ×2, équivalent)
  brass += nCommune * PRICE_BRASS.commune;
  brass += nRepas * PRICE_BRASS.repas;
  return fromBrass(Math.ceil(brass * half) * Math.max(1, p.days));
}

/** Offre de repos À LA POSITION DU GROUPE : zone de repos (rect d'auteur) prioritaire, sinon
 *  réglage de scène, sinon camp (défaut). PARAMÉTRABLE SUR LA ZONE dans l'éditeur. */
export function restPlacesHere(st: GameState): { places: RestPlaces; quality: 'normale' | 'pietre' } | null {
  const sc = st.scene;
  if (!sc) return null;
  const pos = st.partyPos;
  const zone = pos ? [...(sc.restZones ?? [])].reverse().find((z) =>
    pos.x >= z.rect.x && pos.x < z.rect.x + z.rect.w && pos.y >= z.rect.y && pos.y < z.rect.y + z.rect.h) : undefined;
  const places = zone?.places ?? sc.rest ?? { camp: true };
  if (!places.auberge && !places.maison && !places.camp) return null; // repos interdit ici
  return { places, quality: zone?.quality ?? sc.rest?.quality ?? 'normale' };
}

/** Ouvre la modale de Repos avec une OFFRE de lieux (effet, halte de voyage, bouton 🌙). */
export function openRest(get: Get, set: Set, opts?: { places?: RestPlaces; quality?: 'normale' | 'pietre'; days?: number; travelHalt?: boolean }): void {
  const st = get();
  if (st.battle || st.pendingRest) return;
  const places = opts?.places ?? { maison: true, camp: true };
  const perHero: PendingRest['perHero'] = {};
  for (const h of st.party) {
    if (h.dead) continue;
    perHero[h.id] = { lodging: lodgingOptions(places)[0], food: foodOptions(places, h)[0] };
  }
  set({ pendingRest: { places, quality: opts?.quality ?? 'normale', days: Math.max(1, opts?.days ?? 1), perHero, phase: 'setup', travelHalt: opts?.travelHalt } });
}

export function restSet(get: Get, set: Set, heroId: string, patch: Partial<{ lodging: RestLodging; food: RestFood }>): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup' || !p.perHero[heroId]) return;
  const hero = get().party.find((h) => h.id === heroId);
  if (!hero) return;
  if (patch.lodging && !lodgingOptions(p.places).includes(patch.lodging)) return;
  if (patch.food && !foodOptions(p.places, hero).includes(patch.food)) return;
  set({ pendingRest: { ...p, perHero: { ...p.perHero, [heroId]: { ...p.perHero[heroId], ...patch } } } });
}

export function restReady(get: Get, set: Set, seat: number): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup') return;
  set({ pendingRest: { ...p, readyBySeat: { ...(p.readyBySeat ?? {}), [seat]: true } } });
}

export function restCancel(get: Get, set: Set): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup') return;
  set({ pendingRest: null });
}

/** « Continuer » du bilan — une halte de voyage REPREND la route au matin. */
export function restContinue(get: Get, set: Set): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'bilan') return;
  set({ pendingRest: null });
  if (p.travelHalt) continueTravelAfterNight(get, set);
}

/** 🌙 Dormir : paie (RAW ch.66), nourrit, dort (`sleepParty`) avec l'Exposition du campement,
 *  puis bascule la modale en BILAN (multi-jets + horloge avant/après). */
export function restSleep(get: Get, set: Set): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup' || get().battle) return;
  const party = get().party;
  const rng = battleRng();

  // 1. Le prix de la nuit — refus si insolvable.
  const cost = restCost(p, party);
  if (toBrass(cost) > 0) {
    if (!canAfford(get().money, cost)) { get().log(`Pas assez d'argent (${formatMoney(cost)}).`); return; }
    set((s: GameState) => ({ money: moneySub(s.money, cost)! }));
  }

  const pre: NightEntry[] = [];
  // 2. Pitance AVANT la nuit (un héros nourri n'est plus affamé pour la récupération).
  for (const h of party) {
    const cfg = p.perHero[h.id];
    if (!cfg || h.dead) continue;
    if (cfg.food === 'repas' || cfg.food === 'maison') {
      feedFromMeal(h);
      // Nourriture PIÈTRE (ch.66 l.51) : « 10 % d'exposition à la Courante galopante ».
      if (cfg.food === 'repas' && p.quality === 'pietre' && rng.int(1, 100) <= 10) {
        const log = rollContraction(h, 'Courante Galopante', restResistVal(h), DISEASE_DEFS['Courante Galopante']?.contractDifficulty ?? 'accessible', rng);
        pre.push({ actorId: h.id, icon: '🤢', label: 'Tambouille douteuse', text: log.join(' ') || 'Le repas passe mal…', tone: 'bad' });
      }
    }
    // 'ration' : consommée par l'entretien quotidien (#T3) ; 'rien' : la Faim suivra son cours.
  }

  const from = get().gameTime;
  // 3. La nuit (moteur unique) — avec l'Exposition du campement juste avant la récupération.
  const entries = sleepParty(get, set, p.days, {
    beforeRecovery: (out) => {
      const campers = party.filter((h) => !h.dead && p.perHero[h.id]?.lodging === 'dehors');
      if (!campers.length) return;
      const severity: ExposureSeverity = weatherExposure(get().scene?.weather);
      let sheltered = partyHasTent(party);
      if (sheltered) {
        out.push({ icon: '⛺', label: 'Campement', text: 'La tente est montée — le groupe dort à l’abri.', tone: 'info' });
      } else if (severity !== 'clement') {
        // Abri de fortune : Survie en extérieur (« construire un abri », ch.09 l.559).
        const best = partyBest(party.filter((h) => !h.dead), 'Survie en extérieur');
        if (best) {
          const res = rollTest(best.value, 'intermediaire', rng);
          sheltered = res.success;
          out.push({
            actorId: best.actor.id, icon: '⛺', label: 'Abri de fortune',
            d: { label: 'Survie en extérieur', base: best.value, modifier: res.target - best.value, target: res.target, roll: res.roll, success: res.success, sl: res.sl },
            text: res.success ? 'Un abri tient la nuit.' : 'Rien ne protège du temps.', tone: res.success ? 'ok' : 'bad',
          });
        }
      }
      const count = exposureTestCount(severity, sheltered);
      if (count <= 0) return;
      for (const h of campers) {
        const r = exposureNight(h, count, restResistVal(h), rng);
        for (const roll of r.rolls) {
          out.push({
            actorId: h.id, icon: '🥶', label: 'Exposition (froid)',
            d: { label: 'Résistance', base: roll.base, modifier: roll.target - roll.base, target: roll.target, roll: roll.roll, success: roll.success, sl: roll.sl },
            tone: roll.success ? 'ok' : 'bad',
          });
        }
        if (r.log.length) out.push({ actorId: h.id, icon: '🥶', label: 'Exposition', text: r.log.join(' '), tone: 'bad' });
        expireExposureEffects(h, get().gameTime + MINUTES_PER_DAY); // dissipation après 24 h au chaud
      }
    },
  });

  set({ pendingRest: { ...p, phase: 'bilan', results: [...pre, ...entries], slept: { from, to: get().gameTime } } });
}
