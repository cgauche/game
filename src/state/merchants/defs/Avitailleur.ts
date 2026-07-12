import type { MerchantArchetypeDef } from '../types';

/**
 * Avitailleur (chandlerie navale, quai de bourg portuaire, #220) : eau douce, rations de mer et
 * pièces détachées de navire (Mer des Griffes p.127/p.130) + munitions d'artillerie navale
 * (munition-de-siege, Mer des Griffes p.106). L'intendance essentielle est GARANTIE en stock
 * (`curated`) : un navire qui appareille doit toujours pouvoir refaire ses réserves.
 *
 * Limite de filtre (#220) : aucun subType ne regroupe la seule intendance navale — l'union réelle
 * (eau/rations = `nourriture-boisson-et-hebergement`, pièces de navire = `possessions-diverses`,
 * munitions = `munition-de-siege`) élargit le catalogue tiré à TOUT le contenu de ces 3 subTypes
 * (menu de taverne, objets divers, munitions de siège terrestres), pas seulement au naval — la
 * Disponibilité RAW s'applique normalement à ce surplus non curaté.
 */
export const merchantArchetype: MerchantArchetypeDef = {
  name: 'avitailleur',
  label: 'Avitailleur',
  category: { subTypes: ['nourriture-boisson-et-hebergement', 'possessions-diverses', 'munition-de-siege'] }, // ids de Groupe
  settlement: 'ville',
  resaleRate: 0.5, // LDB 59 l.54
  bargainSkill: 40,
  boniment: 'Eau douce, biscuits qui tiennent la traversée, cordages neufs — un navire mal avitaillé, c’est un navire qui coule.',
  curated: [
    'tonneau-d-eau-douce',
    'pieces-detachees-de-navire',
    'boulet-et-poudre',
    'mitraille-et-poudre',
    'ration-biscuits-de-mer',
    'ration-nourriture-preservee',
    'ration-soupe-chou-fermente',
  ],
};
