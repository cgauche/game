/** Carrure réutilisable : facteurs appliqués au squelette humain de référence (HUMAIN_M).
 *  Mêmes champs que la table de proportions de `skeletons.ts`. */
export interface GabaritDef {
  id: string;            // 'moyen', 'brute', 'courtaud'…
  sl: number;            // longueur globale
  st: number;            // épaisseur globale
  legs: number;          // facteur longueur de jambe
  arms?: number;         // facteur longueur de bras (défaut 1)
  head?: number;         // facteur taille de tête (défaut 1)
}
