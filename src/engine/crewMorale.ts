/**
 * MORAL d'un équipage de navire — MDG ch.14 « Navigation à bord de grands vaisseaux ». CODE GÉNÉRIQUE
 * lisant la DONNÉE verbatim (`crew-morale.json`). Système PROPRE à la Mer des Griffes : ni le LDB ni
 * Aux Armes ne définissent de score de Moral numérique (AA n'a qu'une « Loyauté »/« Désertion »
 * narrative) — aucune mécanique parallèle à réutiliser ici.
 *
 * Réutilisation stricte là où le RAW recoupe l'existant :
 *  - les « Tests d'équipage » (total cumulé de Tests individuels, rôles essentiels comptant double) ne sont
 *    PAS un mécanisme à part : ils s'expriment via la primitive de **Soutien** (`partyAssisted`/`assistBonus`,
 *    LDB 12 l.214-225) et les **Tests étendus** (`extendedTestStep`) déjà en place ;
 *  - `rollExpr` évalue les modificateurs en dés signés (« +2d10 », « -3d10 ») ;
 *  - `findTableEntry` classe le score dans sa bande d'effet.
 *
 * Le Moral débute à 75 (nouveau capitaine / nouvel équipage) et est RECALCULÉ une fois par semaine :
 * chaque facteur ACTIF fait monter ou descendre le score. Sa bande détermine les bonus/malus de DR aux
 * Tests d'équipage et de Commandement, et le seuil de désertion en cas de relâche à terre.
 */
import crewMoraleJson from '../data/crew-morale.json';
import { findTableEntry } from './tables';
import { rollExpr, type RNG, defaultRNG } from './dice';

/** Facteur de Moral (MODIFICATEURS DE MORAL, MDG ch.14) — `effect` = dés signés (« +2d10 », « -3d10 »). */
export interface MoraleFactor {
  /** id STABLE (slug) — toute réf passe par lui, jamais le `label`. */
  id: string;
  label: string;
  effect: string;
}

/** Bande d'effet du Moral (EFFETS DU MORAL, MDG ch.14). */
export interface MoraleBand {
  min: number;
  max: number;
  id: string;
  /** ±DR aux Tests de Commandement du capitaine. */
  captainCmdDR: number;
  /** ±DR à TOUS les Tests d'équipage. */
  crewTestDR: number;
  /** Relâche à terre : 1d100 par membre ; ≤ ce seuil → il ne revient pas (absent si aucune désertion). */
  desertionRoll?: number;
  /** Texte d'effet verbatim. */
  desc: string;
}

/** Moral de départ d'un nouvel équipage / nouveau capitaine (MDG ch.14). */
export const MORALE_BASE: number = crewMoraleJson.base;
export const MORALE_FACTORS: MoraleFactor[] = crewMoraleJson.factors;
export const MORALE_BANDS: MoraleBand[] = crewMoraleJson.bands as MoraleBand[];

const FACTOR_BY_ID = new Map(MORALE_FACTORS.map((f) => [f.id, f]));

/** Bande d'effet du Moral courant (DR aux Tests, seuil de désertion). PUR. */
export function moraleBand(score: number): MoraleBand {
  return findTableEntry(MORALE_BANDS, score);
}

export interface MoraleRecalc {
  /** Variation totale appliquée ce recalcul (somme des dés signés des facteurs actifs). */
  delta: number;
  /** Nouveau score (`current + delta`). */
  score: number;
  /** Une ligne par facteur appliqué (journal du recalcul). */
  lines: string[];
}

/**
 * Recalcul HEBDOMADAIRE du Moral (MDG ch.14) : chaque facteur ACTIF (référencé par `id`) roule son
 * effet en dés signés et fait MONTER ou DESCENDRE le Moral courant. PUR (RNG injecté pour le déterminisme).
 */
export function recalcMorale(current: number, activeFactorIds: string[], rng: RNG = defaultRNG): MoraleRecalc {
  let delta = 0;
  const lines: string[] = [];
  for (const id of activeFactorIds) {
    const f = FACTOR_BY_ID.get(id);
    if (!f) continue;
    const rolled = rollExpr(f.effect, rng);
    delta += rolled;
    lines.push(`${f.label} : ${rolled >= 0 ? '+' : ''}${rolled} Moral.`);
  }
  return { delta, score: current + delta, lines };
}
