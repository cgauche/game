/**
 * Échelle VISUELLE d'un token selon la catégorie de Taille (LDB 85 : 7 catégories Minuscule →
 * Monstrueuse). PUREMENT du rendu — aucune table canon de « pixels par Taille » n'existe (DESIGN),
 * ancrée sur Moyenne = 1 (standard des espèces jouables). Multiplie l'échelle d'art (speciesScale) :
 * un Troll (Grande) ou un Dragon (Monstrueuse) dépasse alors franchement sa tuile, façon Baldur's Gate,
 * là où un Gobelin (Moyenne) la remplit. Découplé de l'EMPREINTE de grille (T6, à part).
 */
import { effectiveSize, type SizeCategory } from '../engine/size';

// Ancré pour ~REMPLIR l'empreinte N×N (cf. state/footprint : Grande 2×2, Énorme 3×3, Monstrueuse 4×4) :
// l'échelle large suit ≈ N (un peu en deçà pour garder une marge), le bas de gamme reste esthétique.
const SIZE_TOKEN_SCALE: Record<SizeCategory, number> = {
  minuscule: 0.45,
  tresPetite: 0.6,
  petite: 0.78,
  moyenne: 1,
  grande: 1.8, // empreinte 2×2
  enorme: 2.6, // empreinte 3×3
  monstrueuse: 3.4, // empreinte 4×4
};

/** Facteur d'échelle visuelle du token pour une catégorie de Taille (défaut Moyenne = 1). */
export function sizeTokenScale(size?: SizeCategory): number {
  return SIZE_TOKEN_SCALE[effectiveSize(size)];
}
