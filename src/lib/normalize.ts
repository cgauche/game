/**
 * Normalisation d'un nom pour comparaison robuste : minuscules, accents (diacritiques) retirés,
 * espaces de bord ôtés. SOURCE UNIQUE — remplace les ~7 copies inline qui s'étaient éparpillées
 * (enemyProfile, creatures, equipment, weaponForms, weaponGroup, spawn…).
 */
export const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
