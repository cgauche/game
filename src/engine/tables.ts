/**
 * Lookup PARTAGÉ d'une entrée de table d100 par fourchette `[min, max]` — SOURCE UNIQUE des tirages
 * sur table (Critiques, Oups !, Imparfaites/Colère, Corruptions, péripéties d'interlude…). Repli sur
 * la DERNIÈRE entrée si le jet dépasse la table (ne devrait jamais arriver pour une table bien formée).
 *
 * Réutiliser ; ne JAMAIS réécrire `table.find((e) => roll >= e.min && roll <= e.max) ?? table.at(-1)`.
 */
export function findTableEntry<T extends { min: number; max: number }>(table: T[], roll: number): T {
  return table.find((e) => roll >= e.min && roll <= e.max) ?? table[table.length - 1];
}

/** Variante INDEX de `findTableEntry` — pour les appelants qui doivent ensuite décaler l'entrée
 *  trouvée dans la table (crans de bonus/malus). Repli à −1 si aucune entrée ne couvre `roll` (le
 *  repli, contrairement à `findTableEntry`, est laissé à l'appelant). */
export function findTableEntryIndex<T extends { min: number; max: number }>(table: T[], roll: number): number {
  return table.findIndex((e) => roll >= e.min && roll <= e.max);
}
