/**
 * Calculs dérivés des Caractéristiques — Livre de base, chapitre Personnage.
 */
import { CharKey, Characteristics } from './types';

/** Bonus de Caractéristique = chiffre des dizaines (ex. 37 → 3). */
export function bonus(value: number): number {
  return Math.floor(value / 10);
}

export function charBonus(chars: Characteristics, key: CharKey): number {
  return bonus(chars[key]);
}

/**
 * Points de Blessure de départ.
 *
 * Livre de base, Tableau des Attributs : « Points de Blessure = BF+(2×BE)+BFM »
 * (et « (2×BE)+BFM » pour les Halflings, qui ont le talent Petit).
 */
export function maxWounds(chars: Characteristics, isSmall = false): number {
  const bf = bonus(chars.F);
  const be = bonus(chars.E);
  const bfm = bonus(chars.FM);
  return isSmall ? be * 2 + bfm : bf + be * 2 + bfm;
}
