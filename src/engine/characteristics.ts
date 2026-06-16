/**
 * Calculs dérivés des Caractéristiques — Livre de base, chapitre Personnage.
 */
import { CharKey, Characteristics, Combatant } from './types';
import { traumaCharPenalties, passiveCharSum } from './trauma';
import { traitCharMods } from './traits/dispatch';
import { SizeCategory, woundsForSize, effectiveSize } from './size';

/** Bonus de Caractéristique = chiffre des dizaines (ex. 37 → 3). */
export function bonus(value: number): number {
  return Math.floor(value / 10);
}

export function charBonus(chars: Characteristics, key: CharKey): number {
  return bonus(chars[key]);
}

/**
 * Caractéristique de BASE + modificateurs de PROFIL des traits `liveTraits` (Élite/Coriace/Brutal…), SANS les
 * effets volatils (mutations/traumas/maladies/buffs). Reproduit EXACTEMENT l'ancienne valeur cuite au spawn
 * (`characteristics` incluait les charMods de trait, mais pas les mutations) — pour les rares lecteurs BRUTS
 * qui lisaient `c.characteristics[key]` et attendaient « base + traits » (roll d'Initiative, capacité
 * d'Encombrement, polymorphe, affichage). Les lecteurs qui veulent l'effectif TOTAL prennent `effectiveChar`.
 */
export function baseWithTraits(c: Combatant, key: CharKey): number {
  return c.characteristics[key] + (traitCharMods(c.liveTraits)[key] ?? 0);
}

/**
 * Valeur effective d'une Caractéristique, modifiée par les effets magiques
 * actifs. Les bonus/pénalités ne se cumulent pas : seuls le MEILLEUR bonus et la
 * PIRE pénalité s'appliquent, et tous deux sont sommés (Livre de base l.168 /
 * p.220). Ex. +20, +10 et -10 sur la même Caractéristique → +20 - 10 = +10 net.
 */
export function effectiveChar(c: Combatant, key: CharKey): number {
  let base = c.characteristics[key];
  // Mutations de Corruption (LDB 19) : modifs PERMANENTES de la caractéristique (« +5 Force », « -10
  // Sociabilité »…) — s'ajoutent à la BASE (hors pool non-cumul : un corps transformé n'est pas un bonus
  // magique), désormais via le collecteur passif unifié (kind `intrinsèque`, sommé).
  base += passiveCharSum(c, key);
  const mods = (c.activeEffects ?? []).filter((e) => e.char === key).map((e) => e.bonus);
  // Pénalités PASSIVES non-cumul (pool « pire pénalité », LDB l.168) du collecteur unifié : traumatisme
  // (LDB 18), maladie (LDB 20 : fièvre −10 Physique/Social) et faim (LDB 18 l.422 : −10 F/E puis −10 ailleurs)
  // — toutes en charMod non-`intrinsèque`, gating (Détermination…) déjà appliqué par le collecteur.
  mods.push(...traumaCharPenalties(c, key));
  if (mods.length === 0) return base;
  const bestBonus = Math.max(0, ...mods.filter((m) => m > 0));
  const worstPenalty = Math.min(0, ...mods.filter((m) => m < 0));
  return base + bestBonus + worstPenalty;
}

/**
 * Points d'Armure EFFECTIFS à une localisation : armure portée/naturelle (`c.armour`,
 * mutations comprises via recomputeLoadout) + PA TEMPORISÉS des effets magiques actifs
 * (Armure Aethyrique « +1 PA à toutes les Localisations » — additifs, LDB 47).
 */
export function effectiveArmourAt(c: Combatant, location: keyof Combatant['armour']): number {
  let ap = c.armour[location] ?? 0;
  for (const e of c.activeEffects ?? []) ap += e.apAll ?? 0;
  return ap;
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
  // Référence = base + traits de profil (`baseWithTraits`) : `wounds.base` a été calculé AU SPAWN sur ce profil
  // (Coriace/Élite inclus) → le delta ne porte que les effets volatils (mutations/buffs/traumas), sans recompter
  // les traits déjà dans `base`.
  const raw = woundsForSize(bonus(baseWithTraits(c, 'F')), bonus(baseWithTraits(c, 'E')), bonus(baseWithTraits(c, 'FM')), size);
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
