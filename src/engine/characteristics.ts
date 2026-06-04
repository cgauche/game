/**
 * Calculs dérivés des Caractéristiques — Livre de base, chapitre Personnage.
 */
import { CharKey, Characteristics, Combatant } from './types';

/** Bonus de Caractéristique = chiffre des dizaines (ex. 37 → 3). */
export function bonus(value: number): number {
  return Math.floor(value / 10);
}

export function charBonus(chars: Characteristics, key: CharKey): number {
  return bonus(chars[key]);
}

/**
 * Valeur effective d'une Caractéristique, modifiée par les effets magiques
 * actifs. Les bonus/pénalités ne se cumulent pas : seuls le MEILLEUR bonus et la
 * PIRE pénalité s'appliquent, et tous deux sont sommés (Livre de base l.168 /
 * p.220). Ex. +20, +10 et -10 sur la même Caractéristique → +20 - 10 = +10 net.
 */
export function effectiveChar(c: Combatant, key: CharKey): number {
  const base = c.characteristics[key];
  const mods = (c.activeEffects ?? []).filter((e) => e.char === key).map((e) => e.bonus);
  if (mods.length === 0) return base;
  const bestBonus = Math.max(0, ...mods.filter((m) => m > 0));
  const worstPenalty = Math.min(0, ...mods.filter((m) => m < 0));
  return base + bestBonus + worstPenalty;
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
