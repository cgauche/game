import type { MerchantArchetypeDef } from '../types';

export const merchantArchetype: MerchantArchetypeDef = {
  name: 'armurier',
  label: 'Armurier',
  category: { types: ['melee', 'ranged', 'armor', 'ammunition'] },
  settlement: 'ville',
  resaleRate: 0.10,
};
