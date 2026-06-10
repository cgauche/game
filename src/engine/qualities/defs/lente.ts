import type { QualityDef } from '../types';

// LDB 63 l.25-26 : « Les Personnages utilisant des armes Lentes frappent toujours en dernier lors
// d'un Round, sans tenir compte de l'ordre d'Initiative. De plus, les adversaires gagnent un bonus
// de +1 DR à tout Test pour se défendre contre vos attaques. » (TOUT Test de défense — Parade ET
// Esquive, contrairement à À Enroulement qui ne vise que les Tests de Corps à corps.)
// « Une arme Rapide ne peut jamais être aussi Lente (Lente prend le dessus) » (LDB 62 l.321).
export const quality: QualityDef = { key: 'Lente', type: 'Défaut', subType: 'Arme', vsDefenseDR: 1, slowStrike: true, beats: ['Rapide'] };
