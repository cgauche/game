import type { MerchantArchetypeDef } from '../types';

/**
 * Tavernière (LDB 59 « Faire son marché » / p.302 prix d'auberge) : nourriture, boisson et
 * hébergement. Les RATIONS sont GARANTIES en stock (`curated`) — c'est l'avitaillement du
 * système de voyage (#T2) : sans rations, la Faim (LDB 18 l.337-343) frappe en route.
 */
export const merchantArchetype: MerchantArchetypeDef = {
  name: 'taverniere',
  label: 'Tavernière',
  category: { subTypes: ['nourriture-boisson-et-hebergement'] }, // id de Groupe
  settlement: 'village',
  resaleRate: 0.5, // LDB 59 l.54
  bargainSkill: 45,
  boniment: 'Un coin de table, une pinte qui mousse et de quoi caler l’estomac — installez-vous, la maison ne mord pas.',
  curated: ['ration', 'repas-auberge', 'biere-pinte', 'vin-bouteille', 'nourriture-courses-journee'],
};
