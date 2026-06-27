import type { ItemInstance, Weapon, WeaponRangeSpec } from '../engine/types';
import { damageString } from '../engine/items';
import { effectiveWeaponDamage, effectiveRange } from '../engine/weaponDamage';

/**
 * Parts d'affichage CANONIQUES des stats MÉCANIQUES d'une arme (hors qualités, gérées par l'appelant) :
 * « Dégâts <spec> (<total>) » puis l'Allonge de mêlée OU la Portée de tir (mutuellement exclusives —
 * LDB 62 : Allonge = mêlée, Portée = distance en mètres). SOURCE UNIQUE consommée par le Sac
 * (`CharacterSheet`), l'encart « En main » et le popover d'arme (`EquipmentPanel`) — fin des trois copies
 * dont deux affichaient « [object Object] » (un `WeaponDamageSpec` / `reach` brut non routé par `damageString`).
 * Marche pour un `ItemInstance` (Sac/popover) comme pour un `Weapon` dérivé (armes EN MAIN). `strBonus` = BF
 * du porteur, injecté dans les Dégâts résolus ET la Portée (arme de jet `{bf}` → BF×N) ; « Spécial » → total 0.
 */
export function weaponStatParts(it: ItemInstance | Weapon, strBonus: number): string[] {
  const parts: string[] = [];
  if (it.damage) parts.push(`Dégâts ${damageString(it.damage)} (${effectiveWeaponDamage(it as Weapon, strBonus)})`);
  const rangeM = effectiveRange(it.range, strBonus); // SPEC → mètres (BF×N pour une arme de jet)
  if (rangeM != null) parts.push(`Portée ${rangeM} m`);
  else if (it.reach) parts.push(`Allonge ${it.reach}`);
  return parts;
}

/** Libellé d'AFFICHAGE d'une Portée NON résolue (catalogue : Codex/Marchand/Création, sans BF de porteur) :
 *  « 50 m » (mètres fixes) ou « BF×3 m » (formule de jet). null → pas de Portée. Pour les vues qui ne
 *  connaissent pas le porteur ; aux vues qui le connaissent (combat/fiche), résoudre via `effectiveRange`. */
export function rangeSpecLabel(range: WeaponRangeSpec | null | undefined): string | null {
  if (range == null) return null;
  return typeof range === 'number' ? `${range} m` : `BF×${range.bf} m`;
}
