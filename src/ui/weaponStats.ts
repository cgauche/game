import type { ItemInstance, Weapon } from '../engine/types';
import { damageString } from '../engine/items';
import { effectiveWeaponDamage } from '../engine/weaponDamage';

/**
 * Parts d'affichage CANONIQUES des stats MÉCANIQUES d'une arme (hors qualités, gérées par l'appelant) :
 * « Dégâts <spec> (<total>) » puis l'Allonge de mêlée OU la Portée de tir (mutuellement exclusives —
 * LDB 62 : Allonge = mêlée, Portée = distance en mètres). SOURCE UNIQUE consommée par le Sac
 * (`CharacterSheet`), l'encart « En main » et le popover d'arme (`EquipmentPanel`) — fin des trois copies
 * dont deux affichaient « [object Object] » (un `WeaponDamageSpec` / `reach` brut non routé par `damageString`).
 * Marche pour un `ItemInstance` (Sac/popover) comme pour un `Weapon` dérivé (armes EN MAIN). `strBonus` = BF
 * du porteur, injecté dans les Dégâts résolus (comme au combat) ; « Spécial » (literal) → total 0.
 */
export function weaponStatParts(it: ItemInstance | Weapon, strBonus: number): string[] {
  const parts: string[] = [];
  if (it.damage) parts.push(`Dégâts ${damageString(it.damage)} (${effectiveWeaponDamage(it as Weapon, strBonus)})`);
  if (it.range != null) parts.push(`Portée ${it.range} m`);
  else if (it.reach) parts.push(`Allonge ${it.reach}`);
  return parts;
}
