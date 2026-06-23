/**
 * Objets consommables (« Herbes et potions », LDB 307). L'effet est STRUCTURÉ en `GameOp[]`
 * (`ItemInstance.consumable`, copié du catalogue) — MÊME vocabulaire que les sorts/passifs : `heal`
 * (Bonus de carac ou littéral), `removeCondition` (`all` = tout l'État, sinon N pions),
 * `preventInfection` (pansement → pas d'Infection, LDB 18 l.382). Exécuté par `applyOps`. Plus aucun
 * parsing de `desc` au runtime (la prose→ops a été faite une fois par `migrate-consumables.mts`).
 */
import { Combatant, ItemInstance } from './types';
import { applyOps } from './ops';

/** L'objet est-il un consommable utilisable ? Présence d'au moins un `GameOp` d'effet. Sert l'icône
 *  (glyphe 🧪) et tout filtre « utilisable » sans Combatant sous la main. */
export function isConsumable(item: ItemInstance): boolean {
  return !!item.consumable?.length;
}

/** Boit/applique le consommable sur `target` (= le buveur : `ref`/`caster` = `target`, donc un soin
 *  « Bonus d'Endurance » résout le BE du buveur). Mutation + journal. RNG-free (ops sans dé). */
export function useConsumable(target: Combatant, item: ItemInstance): string[] {
  if (!item.consumable?.length) return [];
  return applyOps(target, item.consumable, { caster: target });
}
