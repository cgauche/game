import type { ItemInstance } from './types';

/** Coût de réparation d'une armure, en sous de cuivre (PA). RAW LDB 63 « Réparer Une Armure » l.97-98 :
 *  10 % du prix de base PAR PA perdu ; 30 % du prix de base si la pièce est complètement brisée (PA nette ≤ 0). */
export function repairCostBrass(item: Pick<ItemInstance, 'pa' | 'damageTaken'>, basePriceBrass: number): number {
  const lost = item.damageTaken ?? 0;
  if (lost <= 0) return 0;
  const broken = (item.pa ?? 0) - lost <= 0;
  return Math.round(basePriceBrass * (broken ? 0.30 : 0.10 * lost));
}
