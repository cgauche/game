import type { MerchantArchetypeDef } from '../types';

export const merchantArchetype: MerchantArchetypeDef = {
  id: 'herboriste',
  label: 'Herboriste',
  category: { subTypes: ['herbes-et-potions', 'drogues-et-poisons'] }, // ids de Groupe
  settlement: 'village',
  resaleRate: 0.5, // LDB 59 l.54
  bargainSkill: 40,
  boniment: 'Racines fraîches, décoctions bien dosées — la forêt donne, il suffit de savoir cueillir.',
};
