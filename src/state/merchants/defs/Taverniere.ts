import type { MerchantArchetypeDef } from '../types';

/**
 * Tavernière (LDB 59 « Faire son marché » / p.302 prix d'auberge) : nourriture, boisson et
 * hébergement. Les RATIONS sont GARANTIES en stock (`curated`) — c'est l'avitaillement du
 * système de voyage (#T2) : sans rations, la Faim (LDB 18 l.417-422) frappe en route.
 */
export const merchantArchetype: MerchantArchetypeDef = {
  name: 'taverniere',
  label: 'Tavernière',
  category: { subTypes: ['Nourriture, Boisson et Hébergement'] },
  settlement: 'village',
  resaleRate: 0.5, // base ½ du prix listé (LDB 60 l.22)
  bargainSkill: 45,
  curated: ['Ration', 'Repas, auberge', 'Bière, pinte', 'Vin, bouteille', 'Nourriture, courses/journée'],
};
