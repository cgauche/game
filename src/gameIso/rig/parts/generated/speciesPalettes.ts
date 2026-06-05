/**
 * Palettes par DÉFAUT de PEAU et CHEVEUX par espèce:sexe — GÉNÉRÉ par scripts/_tokenize-heads.mjs.
 * NE PAS éditer à la main. Fusionné SOUS la carrière et les surcharges dans composeRig →
 * carnation/cheveux justes par espèce au défaut (elfe blond, etc.), recolor cohérent.
 */
import type { StoredPalette } from '../../palette';

export const SPECIES_PALETTES: Record<string, StoredPalette> = {
  "Humain:M": { cheveux: "#5a4427", peauH: "#e2b48c", peau: "#cf9d72", peauO: "#b07a52", cheveuxO: "#4a3520", cheveuxH: "#6e5430" },
  "Humain:F": { cheveux: "#7a5234", peauH: "#e2b48c", peau: "#d9a87e", peauO: "#b07a52", cheveuxO: "#5a3415", cheveuxH: "#9a6a2a" },
  "Nain:M": { cheveux: "#5a3a1e", peauO: "#d98e6a", peau: "#e0b48a", peauH: "#e9c39c", cheveuxO: "#54341a", cheveuxH: "#6a4423" },
  "Nain:F": { cheveux: "#7a5230", peau: "#e0b48a", peauO: "#d6a87c", cheveuxO: "#5e3412", cheveuxH: "#9a5a22" },
  "Halfling:M": { peau: "#e2b48c", peauO: "#cf9a72", peauH: "#e89a86", cheveux: "#9c7048", cheveuxO: "#7a3e1c", cheveuxH: "#9c5828" },
  "Halfling:F": { peau: "#e2b48c", peauO: "#d49a72", cheveux: "#8a5a36", cheveuxO: "#5f2f15", cheveuxH: "#b06a32" },
  "Haut-Elfe:M": { peau: "#c69a72", peauO: "#b98a64", cheveux: "#6b4a30", peauH: "#d9a87e", cheveuxH: "#e6cf86", cheveuxO: "#a98521" },
  "Haut-Elfe:F": { peau: "#ecc6a0", peauO: "#c79b75", cheveux: "#b88c38", cheveuxH: "#e6cd7e" },
  "Elfe sylvain:M": { peau: "#cdbd92", peauO: "#a89464", peauH: "#d8c9a0", cheveux: "#3c2e1a", cheveuxH: "#6b7a3a", cheveuxO: "#4a3a22" },
  "Elfe sylvain:F": { peau: "#d8c9a0", peauO: "#8a7a52", peauH: "#e2d2a8", cheveux: "#5a4a2c", cheveuxH: "#7a6642", cheveuxO: "#4a3c22" }
};
