/**
 * « Entre deux aventures » (LDB ch.22-23 — Jalon 5) : flux d'interlude.
 *
 * Séquence RAW (ch.22 l.12) : Événement d100 par héros → Activités (« un maximum d'une Activité
 * par semaine, et […] un maximum de trois Activités au total », ch.23 l.6) → « Argent à
 * gaspiller » (ch.23 l.14 : tout l'argent non sécurisé disparaît ; les Revenus sont remis
 * « seulement une fois que vous avez disposé de l'argent de votre dernière aventure », l.179).
 *
 * Arbitrages jeu-sans-MJ (spec 2026-06-11) : la bourse étant PARTY-LEVEL, les pertes d'argent
 * d'événements (`moneyPct`) s'appliquent UNE fois (le pire tirage du groupe) ; le « +1 Chance
 * max » est crédité directement ; la clôture passe par le flux de repos standard (récupération,
 * convalescence, horloge — weeks × 7 jours).
 */
import type { GameState } from './store';
import { battleRng } from './battleRng';
import { d100 } from '../engine/dice';
import { interludeEventFor, type InterludeEventFx } from '../data/interludeEvents';
import { fromBrass, toBrass, formatMoney } from '../engine/money';
import { itemFromTrapping, recomputeLoadout } from '../engine/items';
import { restPartyOvernight } from './combatFlow';
import type { PriceTier, Availability } from '../engine/activities';
import type { Difficulty } from '../engine/types';

type Get = () => GameState;
type Set = (s: Partial<GameState>) => void;

export interface InterludeHeroState {
  /** Jet d100 sur le Tableau des Événements (LDB 22). */
  eventRoll: number;
  /** Effets mécaniques de l'événement à consommer par les Activités (Revenus/banque). */
  fx?: InterludeEventFx;
  /** Activités restantes (min(3, semaines) − pertes d'événement/devoir elfique). */
  left: number;
  /** A entrepris Revenus — maintient les Niveaux 3-4 (« Avec le pouvoir », ch.23 l.30). */
  didRevenus?: boolean;
  /** Gains de Revenus, crédités APRÈS le gaspillage (ch.23 l.179) — en sous de cuivre. */
  revenueBrass: number;
  /** Artisanat en cours — « Tout travail inachevé peut être conservé » (ch.23 l.92). */
  craft?: { trapping: string; tier: PriceTier; avail: Availability; atouts: string[]; defauts: string[]; drDone: number; drTarget: number; difficulty: Difficulty };
  /** « +10 pour chaque tentative ratée » d'Apprentissage particulier (ch.23 l.63), par talent. */
  learnFails?: Record<string, number>;
}

export interface InterludeState {
  weeks: number;
  phase: 'activities' | 'closing';
  perHero: Record<string, InterludeHeroState>;
}

/** Dépôt bancaire (Opérations bancaires, ch.23 l.154-165) — survit aux interludes et aventures. */
export interface BankDeposit {
  heroId: string;
  kind: 'invest' | 'stash';
  /** Montant déposé, en sous de cuivre. */
  brass: number;
  /** Indice d'intérêts (1-10) — taux % ET risque de faillite (invest seulement). */
  rate: number;
}

/** Ouvre l'interlude : événements tirés et appliqués, commandes livrées, écran dédié. */
export function startInterlude(get: Get, set: Set, weeks = 1): void {
  if (get().battle) {
    get().log("Impossible d'ouvrir un interlude en plein combat.");
    return;
  }
  if (get().interlude) return; // déjà ouvert
  const party = get().party.filter((h) => !h.dead);
  if (!party.length) return;
  const w = Math.max(1, Math.floor(weeks));
  const lines: string[] = [`— Entre deux aventures : ${w} semaine${w > 1 ? 's' : ''} —`];
  // Passer commande (ch.23 l.170) : « L'objet sera achevé après votre prochaine aventure » —
  // les commandes du cycle précédent sont livrées à l'ouverture de CET interlude.
  for (const o of get().pendingOrders ?? []) {
    const hero = party.find((h) => h.id === o.heroId);
    const it = hero ? itemFromTrapping(o.trapping) : null;
    if (hero && it) {
      hero.items = [...(hero.items ?? []), it];
      recomputeLoadout(hero);
      lines.push(`${hero.name} reçoit sa commande : ${o.trapping}.`);
    }
  }
  const baseLeft = Math.min(3, w); // « 1/semaine, max 3 » (ch.23 l.6)
  const perHero: Record<string, InterludeHeroState> = {};
  let worstMoneyPct = 0;
  let bank = get().bank ?? [];
  for (const h of party) {
    const roll = d100(battleRng());
    const ev = interludeEventFor(roll);
    lines.push(`${h.name} — Événement (🎲 ${roll}) : ${ev.label}. ${ev.text}`);
    let left = baseLeft;
    if (ev.fx?.loseActivity) left -= 1;
    // « les elfes ne perdent une Activité que si la durée est d'au moins trois semaines » (ch.23 l.50).
    if (/elfe/i.test(h.species ?? '') && w >= 3) {
      left -= 1;
      lines.push(`${h.name} consacre une Activité au contact des siens (devoir elfique, LDB 23).`);
    }
    if (ev.fx?.moneyPct) worstMoneyPct = Math.min(worstMoneyPct, ev.fx.moneyPct);
    if (ev.fx?.fortuneMaxDelta) {
      h.fortune = (h.fortune ?? 0) + ev.fx.fortuneMaxDelta;
      lines.push(`${h.name} : +${ev.fx.fortuneMaxDelta} Point de Chance (présage — LDB 22).`);
    }
    if (ev.fx?.stashRaided && bank.some((b) => b.heroId === h.id && b.kind === 'stash')) {
      bank = bank.filter((b) => !(b.heroId === h.id && b.kind === 'stash'));
      lines.push(`${h.name} : sa planque a été dévalisée — tout l'argent caché a disparu (Mise à sac).`);
    }
    perHero[h.id] = { eventRoll: roll, fx: ev.fx, left: Math.max(0, left), revenueBrass: 0 };
  }
  if (worstMoneyPct < 0) {
    const total = toBrass(get().money);
    const lost = Math.floor((total * -worstMoneyPct) / 100);
    set({ money: fromBrass(Math.max(0, total - lost)) });
    lines.push(`La bourse du groupe perd ${-worstMoneyPct} % (${formatMoney(fromBrass(lost))}) — pire événement appliqué une fois (arbitrage bourse commune).`);
  }
  set({ interlude: { weeks: w, phase: 'activities', perHero }, bank, pendingOrders: [], screen: 'interlude' });
  for (const l of lines) get().log(l);
  set({ party: [...get().party] });
}

/** Clôture : « Avec le pouvoir » (Niveaux 3-4 sans Revenus → −1 Niveau, ch.23 l.30), Argent à
 *  gaspiller (l.14), crédit des Revenus (l.179), puis le temps passe (repos standard). */
export function interludeEnd(get: Get, set: Set): void {
  const itl = get().interlude;
  if (!itl) return;
  const lines: string[] = [];
  for (const h of get().party) {
    const st = itl.perHero[h.id];
    if (!st) continue;
    if ((h.careerLevel ?? 1) >= 3 && !st.didRevenus) {
      h.careerLevel = (h.careerLevel ?? 1) - 1;
      lines.push(`${h.name} a négligé ses responsabilités (pas de Revenus) : retour au Niveau ${h.careerLevel} de sa Carrière (« Avec le pouvoir », LDB 23).`);
    }
  }
  const wasted = toBrass(get().money);
  if (wasted > 0) {
    lines.push(`L'argent restant (${formatMoney(get().money)}) est dépensé, bu, parié ou donné — en totalité (Argent à gaspiller, LDB 23).`);
  }
  let revenue = 0;
  for (const h of get().party) revenue += itl.perHero[h.id]?.revenueBrass ?? 0;
  set({ money: fromBrass(revenue) });
  if (revenue > 0) lines.push(`Les Revenus de la période sont disponibles : ${formatMoney(fromBrass(revenue))}.`);
  set({ interlude: null, screen: 'campaign', party: [...get().party] });
  for (const l of lines) get().log(l);
  // Le temps de l'interlude s'écoule (récupération, convalescence, horloge — flux de repos standard).
  restPartyOvernight(get, set, itl.weeks * 7);
}
