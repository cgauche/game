import type { TraitDef } from '../types';

// LDB 85 p.341 : « …tous ceux qui sont Engagés avec elle reçoivent 1d10 PB modifiés par le BE et les
// PA, min 1. » Effet migré en donnée éditable (`traits.json` → effects onWoundLoss/engaged, wounds
// 1d10 ignoreTB/AP:false min 1) ; def réduite à la clé canonique.
export const trait: TraitDef = { key: 'Sang corrosif' };
