/**
 * Catalogue de messages FR — SOURCE UNIQUE des textes traduisibles (seam i18n, cf. docs/i18n-seam.md).
 * Clés stables `domaine.cle` ; patrons à `{param}` interpolés par `t()`. Une 2ᵉ langue = un fichier frère
 * (mêmes clés) ; la logique ne change pas. Phase B : on y MIGRE les maps de labels jusqu'ici en dur.
 */
export const fr = {
  // Caractéristiques (LDB) — migré de engine/types.ts (CHAR_LABELS).
  'char.CC': 'Capacité de Combat',
  'char.CT': 'Capacité de Tir',
  'char.F': 'Force',
  'char.E': 'Endurance',
  'char.I': 'Initiative',
  'char.Ag': 'Agilité',
  'char.Dex': 'Dextérité',
  'char.Int': 'Intelligence',
  'char.FM': 'Force Mentale',
  'char.Soc': 'Sociabilité',
  // Difficultés de Test (LDB 12) — migré de engine/types.ts (DIFFICULTY_LABELS).
  'difficulty.tresFacile': 'Très facile (+60)',
  'difficulty.facile': 'Facile (+40)',
  'difficulty.accessible': 'Accessible (+20)',
  'difficulty.intermediaire': 'Intermédiaire (+0)',
  'difficulty.complexe': 'Complexe (−10)',
  'difficulty.difficile': 'Difficile (−20)',
  'difficulty.tresDifficile': 'Très difficile (−30)',
} as const;
