import type { MerchantArchetypeDef } from '../types';

export const merchantArchetype: MerchantArchetypeDef = {
  id: 'armurier',
  label: 'Armurier',
  category: { types: ['melee', 'ranged', 'armor', 'ammunition'] },
  settlement: 'ville',
  resaleRate: 0.5, // LDB 59 l.54
  bargainSkill: 45,
  boniment: 'Acier trempé, fil qui ne rend jamais — regardez-moi cette allonge avant de partir vous battre à mains nues.',
};
