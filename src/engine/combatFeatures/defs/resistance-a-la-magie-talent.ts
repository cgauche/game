import type { CombatFeature } from '../types';

// LDB 10 : « Le DR de tout Sort vous affectant est réduit de 2 par point que vous possédez dans ce Talent. »
export const feature: CombatFeature = { key: 'Résistance à la Magie', kind: 'talent', magicResistance2: true };
