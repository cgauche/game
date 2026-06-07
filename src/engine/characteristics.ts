/**
 * Calculs dérivés des Caractéristiques — Livre de base, chapitre Personnage.
 */
import { CharKey, Characteristics, Combatant } from './types';
import { traumaCharPenalties } from './trauma';
import { SizeCategory, woundsForSize, effectiveSize } from './size';

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
  // Pénalités de traumatisme (LDB 18) : injectées dans le pool « pire pénalité » (non-cumul l.168).
  mods.push(...traumaCharPenalties(c, key));
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
export function maxWounds(chars: Characteristics, size: SizeCategory = 'moyenne'): number {
  return woundsForSize(bonus(chars.F), bonus(chars.E), bonus(chars.FM), size);
}

/**
 * Blessures max DYNAMIQUES (LDB 85 — exigence : les sorts modifiant F/E/FM impactent les Blessures).
 * = base (Blessures à vide, snapshot ou surcharge au spawn) + le DELTA dû aux buffs F/E/FM, multiplié
 * par la Taille (via `woundsForSize`). À vide, le delta = 0 → on rend exactement `wounds.base` (préserve
 * les valeurs livre traitées : Coriace, mort-vivant…). La base elle-même n'est jamais recalculée.
 */
export function effectiveMaxWounds(c: Combatant): number {
  const size = effectiveSize(c.size);
  const base = c.wounds.base ?? c.wounds.max;
  const eff = woundsForSize(bonus(effectiveChar(c, 'F')), bonus(effectiveChar(c, 'E')), bonus(effectiveChar(c, 'FM')), size);
  const raw = woundsForSize(bonus(c.characteristics.F), bonus(c.characteristics.E), bonus(c.characteristics.FM), size);
  return base + (eff - raw);
}

/**
 * Recale `wounds.max` sur `effectiveMaxWounds` et ajuste `wounds.current` du même delta : on GAGNE des
 * Points de Blessure quand un buff F/E/FM monte le max, on en PERD à l'expiration (clamp ≥ 0). Appelé
 * à chaque changement d'`activeEffects` (application d'un buff, dissipation en fin de Round). Idempotent.
 */
export function refreshWounds(c: Combatant): void {
  const newMax = effectiveMaxWounds(c);
  const delta = newMax - c.wounds.max;
  if (delta === 0) return;
  c.wounds.max = newMax;
  if (delta > 0) c.wounds.current += delta;
  else c.wounds.current = Math.max(0, c.wounds.current + delta);
}
