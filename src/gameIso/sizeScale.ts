/**
 * Échelle VISUELLE d'un token selon la catégorie de Taille (LDB 85 : 7 catégories Minuscule →
 * Monstrueuse). PUREMENT du rendu — aucune table canon de « pixels par Taille » n'existe (DESIGN),
 * ancrée sur Moyenne = 1 (standard des espèces jouables). Multiplie l'échelle d'art (speciesScale) :
 * un Troll (Grande) ou un Dragon (Monstrueuse) dépasse alors franchement sa tuile, façon Baldur's Gate,
 * là où un Gobelin (Moyenne) la remplit. Découplé de l'EMPREINTE de grille (T6, à part).
 *
 * CONVENTION (décision utilisateur 2026-06-11) : tout modèle est DESSINÉ à la baseline Moyenne —
 * son échelle d'art (sl / race.scale / perso.scale) n'exprime que la NUANCE intra-catégorie
 * (elfe > humain > nain ; cheval trapu vs pégase élancé), bande ~0.6-1.3. C'est CETTE table,
 * seule, qui agrandit par catégorie. Garde-fou : `toise.test.ts` + galerie `toise-gallery.html`.
 */
import { effectiveSize, type SizeCategory } from '../engine/size';

// Ancré sur les PROPORTIONS face à un humain (un cheval Grande ≈ ×1.3-1.5, un Géant Énorme ≈ ×2.4),
// PAS sur le remplissage de l'empreinte N×N (T6) — l'empreinte reste la vérité d'OCCUPATION,
// le visuel peut être plus petit qu'elle (un cheval bloque 2×2 sans mesurer 4 m au garrot).
const SIZE_TOKEN_SCALE: Record<SizeCategory, number> = {
  minuscule: 0.45,
  tresPetite: 0.6,
  petite: 0.78,
  moyenne: 1,
  grande: 1.45,
  enorme: 2.0,
  monstrueuse: 2.7,
};

/** Facteur d'échelle visuelle du token pour une catégorie de Taille (défaut Moyenne = 1). */
export function sizeTokenScale(size?: SizeCategory): number {
  return SIZE_TOKEN_SCALE[effectiveSize(size)];
}

/** Échelle visuelle d'un token à EMPREINTE propre (objet sans Taille créature — un NAVIRE) de côté `n` :
 *  miroir de `SIZE_TOKEN_SCALE` pour la Taille créature de même empreinte (1→1, 2→1.45, 3→2, 4→2.7),
 *  prolongée linéairement au-delà de 4×4. Découple le RENDU de la Taille créature, comme l'empreinte de grille. */
export function footprintTokenScale(n: number): number {
  const TABLE: Record<number, number> = { 1: 1, 2: 1.45, 3: 2.0, 4: 2.7 };
  const k = Math.max(1, Math.round(n));
  return TABLE[k] ?? 2.7 + (k - 4) * 0.6;
}
