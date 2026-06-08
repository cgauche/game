import type { MerchantArchetypeDef } from '../types';

export const merchantArchetype: MerchantArchetypeDef = {
  name: 'herboriste',
  label: 'Herboriste',
  category: { subTypes: ['Herbes et potions', 'Drogues et poisons'] },
  settlement: 'village',
  resaleRate: 0.5, // base ½ du prix listé (LDB 60 l.22) ; Marchandage la module ¼–½
  bargainSkill: 40,
};
