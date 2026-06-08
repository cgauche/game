import type { MerchantArchetypeDef } from '../types';

export const merchantArchetype: MerchantArchetypeDef = {
  name: 'herboriste',
  label: 'Herboriste',
  category: { subTypes: ['Herbes et potions', 'Drogues et poisons'] },
  settlement: 'village',
  resaleRate: 0.10,
};
