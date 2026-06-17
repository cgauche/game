import type { MerchantArchetypeDef } from '../types';

export const merchantArchetype: MerchantArchetypeDef = {
  name: 'herboriste',
  label: 'Herboriste',
  category: { subTypes: ['herbes-et-potions', 'drogues-et-poisons'] }, // ids de Groupe
  settlement: 'village',
  resaleRate: 0.5, // base ½ du prix listé (LDB 60 l.22) ; Marchandage la module ¼–½
  bargainSkill: 40,
};
