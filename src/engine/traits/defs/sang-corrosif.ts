import type { TraitDef } from '../types';

// LDB 85 p.341 : « Chaque fois qu'elle subit des Blessures dont le sang éclabousse, tous ceux qui
// sont Engagés avec elle reçoivent 1d10 Points de Blessure modifiés par le BE et les PA, min 1. »
export const trait: TraitDef = { key: 'Sang corrosif', corrosiveBlood: true };
