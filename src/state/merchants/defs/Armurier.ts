import type { MerchantArchetypeDef } from '../types';

export const merchantArchetype: MerchantArchetypeDef = {
  name: 'armurier',
  label: 'Armurier',
  category: { types: ['melee', 'ranged', 'armor', 'ammunition'] },
  settlement: 'ville',
  resaleRate: 0.5, // base ½ du prix listé (LDB 60 l.22) ; Marchandage la module ¼–½
  bargainSkill: 45,
};
