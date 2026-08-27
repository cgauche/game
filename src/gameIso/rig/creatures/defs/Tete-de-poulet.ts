import type { CreatureDef } from '../types';

// Basse-cour du Carnaval (Compagnon T1 ch.12, cage 5) : hommes-bêtes à TÊTE DE POULET (deux)
// — crête rouge, bec, et crachat venimeux à 3 m (statbloc campagne → CustomStatblock).
// perso.head remplace la tête caprine de la race SANS perdre queue/fourrure.
export const creature: CreatureDef = {
  label: 'Homme-bête à tête de poulet',
  id: "homme-bete-a-tete-de-poulet",
  plan: 'biped',
  race: 'homme-bete',
  perso: {
    head: 'poulet',
    gabarit: 'elance-voute', // volaille efflanquée, pas la masse trapue du gor
    colors: { peau: '#b89a6a', cheveux: '#6e5638' }, // plumage fauve
  },
};
