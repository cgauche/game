import type { CreatureDef } from '../types';

// Rassarak (Compagnon T1 ch.12, cage 2) : « skaven d'un blanc pur, rat de clan AVEUGLE
// depuis sa naissance » — fourrure blanche, yeux LAITEUX (features par-vue : les yeux de la
// tête de rat sont dans l'art, le remplacement d'yeux ne touche que les visages humains),
// captif en haillons (tenue Esclave skaven). Stats = campagne → CustomStatblock.
const OEIL_LAITEUX_FRONT =
  `<ellipse cx="-3.2" cy="5" rx="1.7" ry="1.5" fill="#e8e6de" stroke="#b0aca0" stroke-width="0.35"/>`
  + `<ellipse cx="3.2" cy="5" rx="1.7" ry="1.5" fill="#e8e6de" stroke="#b0aca0" stroke-width="0.35"/>`;
const OEIL_LAITEUX_PROFIL =
  `<ellipse cx="3" cy="2" rx="1.7" ry="1.4" fill="#e8e6de" stroke="#b0aca0" stroke-width="0.35"/>`;

export const creature: CreatureDef = {
  name: 'Rassarak',
  plan: 'biped',
  matchPriority: 9, // avant Rat ogre (10) et tous les skavens
  aliases: ['rassark'], // « rassarak » = le nom
  race: 'Skaven',
  perso: {
    tenue: 'Esclave skaven',
    colors: { peau: '#e8e2d4', cheveux: '#cfc8b8' }, // blanc pur
    features: [
      { bone: 'tete', svg: OEIL_LAITEUX_FRONT, layer: 55, view: 'front' },
      { bone: 'tete', svg: OEIL_LAITEUX_PROFIL, layer: 55, view: 'profile' },
    ],
  },
};
