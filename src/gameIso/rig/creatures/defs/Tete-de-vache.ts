import type { CreatureDef } from '../types';

// Basse-cour du Carnaval (Compagnon T1 ch.12, cage 5) : homme-bête à TÊTE DE VACHE —
// « l'élément comique de la ménagerie », mais crachat venimeux à 3 m (Test de Résistance
// Intermédiaire ou Empoisonné — statbloc campagne → CustomStatblock). perso.head remplace
// la tête caprine de la race SANS perdre queue/fourrure.
export const creature: CreatureDef = {
  label: 'Homme-bête à tête de vache',
  plan: 'biped',
  race: 'Homme-bête',
  perso: {
    head: 'vache',
    colors: { peau: '#a89478', cheveux: '#5a4a34' }, // robe pie claire
  },
};
