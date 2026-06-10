import type { TraitDef } from '../types';

// LDB 85 p.343 : « Quand la créature se Déplace, elle peut voler jusqu'à Indice mètres. Elle
// ignore alors tous les terrains, obstacles et personnages qui s'interposent. »
export const trait: TraitDef = { key: 'Vol', fly: true };
