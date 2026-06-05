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
  "Elfe sylvain:F": { peau: "#d8c9a0", peauO: "#8a7a52", peauH: "#e2d2a8", cheveux: "#5a4a2c", cheveuxH: "#7a6642", cheveuxO: "#4a3c22" },
  "Skaven:M": { peau: "#6f6354", peauO: "#4c4338", peauH: "#8c7f6c", cheveux: "#2a2018", cheveuxO: "#161009", cheveuxH: "#3a2c1e" },
  "Skaven:F": { peau: "#6f6354", peauO: "#4c4338", peauH: "#8c7f6c", cheveux: "#2a2018", cheveuxO: "#161009", cheveuxH: "#3a2c1e" },

  // === Phase B — familles monstrueuses bipèdes ===
  // Peaux-vertes (pelage/peau verte ; cheveux sombres car peu visibles, tête couvre tout).
  "Orc:M": { peau: "#4f7a36", peauO: "#365526", peauH: "#6a9a48", cheveux: "#2a3818", cheveuxO: "#18240e", cheveuxH: "#3a4c24" },
  "Orc:F": { peau: "#4f7a36", peauO: "#365526", peauH: "#6a9a48", cheveux: "#2a3818", cheveuxO: "#18240e", cheveuxH: "#3a4c24" },
  "Gobelin:M": { peau: "#4f7a33", peauO: "#365524", peauH: "#6e9a46", cheveux: "#283614", cheveuxO: "#16220c", cheveuxH: "#384a22" },
  "Gobelin:F": { peau: "#4f7a33", peauO: "#365524", peauH: "#6e9a46", cheveux: "#283614", cheveuxO: "#16220c", cheveuxH: "#384a22" },
  "Snotling:M": { peau: "#4a7a3a", peauO: "#326028", peauH: "#669a4e", cheveux: "#283614", cheveuxO: "#16220c", cheveuxH: "#384a22" },
  "Snotling:F": { peau: "#4a7a3a", peauO: "#326028", peauH: "#669a4e", cheveux: "#283614", cheveuxO: "#16220c", cheveuxH: "#384a22" },
  // Hommes-bêtes (pelage brun couvrant tout le corps).
  "Homme-bête:M": { peau: "#6b4a32", peauO: "#4a3322", peauH: "#876040", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  "Homme-bête:F": { peau: "#6b4a32", peauO: "#4a3322", peauH: "#876040", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  "Minotaure:M": { peau: "#6e4a2c", peauO: "#4a3220", peauH: "#c89a6e", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  "Minotaure:F": { peau: "#6e4a2c", peauO: "#4a3220", peauH: "#c89a6e", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  // Morts-vivants.
  "Squelette:M": { peau: "#d8ccab", peauO: "#a89c80", peauH: "#ece2c6", cheveux: "#8a8f9e", cheveuxO: "#5a5e68", cheveuxH: "#aab0bc" },
  "Squelette:F": { peau: "#d8ccab", peauO: "#a89c80", peauH: "#ece2c6", cheveux: "#8a8f9e", cheveuxO: "#5a5e68", cheveuxH: "#aab0bc" },
  "Zombie:M": { peau: "#8e8a7a", peauO: "#605c4d", peauH: "#a8a390", cheveux: "#454c36", cheveuxO: "#2c3024", cheveuxH: "#5a6248" },
  "Zombie:F": { peau: "#8e8a7a", peauO: "#605c4d", peauH: "#a8a390", cheveux: "#454c36", cheveuxO: "#2c3024", cheveuxH: "#5a6248" },
  "Goule:M": { peau: "#9ca0a2", peauO: "#696d70", peauH: "#bcc0c2", cheveux: "#3a3e34", cheveuxO: "#22241e", cheveuxH: "#4e5246" },
  "Goule:F": { peau: "#9ca0a2", peauO: "#696d70", peauH: "#bcc0c2", cheveux: "#3a3e34", cheveuxO: "#22241e", cheveuxH: "#4e5246" },
  // Gros / démons.
  "Troll:M": { peau: "#4a6b34", peauO: "#324a22", peauH: "#658a48", cheveux: "#2a3818", cheveuxO: "#18240e", cheveuxH: "#3a4c24" },
  "Troll:F": { peau: "#4a6b34", peauO: "#324a22", peauH: "#658a48", cheveux: "#2a3818", cheveuxO: "#18240e", cheveuxH: "#3a4c24" },
  "Ogre:M": { peau: "#c9966a", peauO: "#9a6c48", peauH: "#e0b48a", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  "Ogre:F": { peau: "#c9966a", peauO: "#9a6c48", peauH: "#e0b48a", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  "Vampire:M": { peau: "#e8cdb6", peauO: "#c2a288", peauH: "#f4e2d0", cheveux: "#161214", cheveuxO: "#0a0808", cheveuxH: "#2c262a" },
  "Vampire:F": { peau: "#e8cdb6", peauO: "#c2a288", peauH: "#f4e2d0", cheveux: "#161214", cheveuxO: "#0a0808", cheveuxH: "#2c262a" },
  "Démon:M": { peau: "#9a201a", peauO: "#601010", peauH: "#c4382c", cheveux: "#1a1410", cheveuxO: "#0a0806", cheveuxH: "#2c2620" },
  "Démon:F": { peau: "#9a201a", peauO: "#601010", peauH: "#c4382c", cheveux: "#1a1410", cheveuxO: "#0a0806", cheveuxH: "#2c2620" }
};
