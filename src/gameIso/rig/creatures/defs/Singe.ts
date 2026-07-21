import type { CreatureDef } from '../types';

// Singe (LDB, Taille petite) — petit primate NU : corps agile voûté (gabarit gremlin),
// tête de primate (face claire, yeux frontaux, museau plat) + LONGUE queue recourbée custom
// (la queue-generique du registre est un moignon trop court pour lire « singe »).
// Queue = ruban effilé à crochet terminal, os `bassin`, derrière le corps (layer négatif) —
// par-vue : balayage latéral (front/back), traîne arrière (profil, -x).
const QUEUE_LATERALE = `<path d="M0 4 Q10 7 14 11 Q18 15 20.5 11.5 Q22.5 8 19 6 Q16.5 4.6 15.5 7.5" fill="none" stroke="@peauO" stroke-width="3.4" stroke-linecap="round"/><path d="M0 4 Q10 7 14 11 Q18 15 20.5 11.5 Q22.5 8 19 6 Q16.5 4.6 15.5 7.5" fill="none" stroke="@peau" stroke-width="2.2" stroke-linecap="round"/>`;
const QUEUE_PROFIL = `<path d="M0 3 Q-12 8 -17 3 Q-21 -2 -19 -8 Q-17.5 -12 -14 -11.5 Q-11.5 -11 -12.5 -8.5 Q-15 -9 -16 -6 Q-17 -2 -14 1 Q-10 4.5 0 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`;

export const creature: CreatureDef = {
  label: 'Singe',
  id: 'singe',
  plan: 'biped',
  perso: {
    tenue: 'nu',
    gabarit: 'gremlin',
    scale: 0.7,
    monster: { tete: 'singe' },
    colors: { peau: '#7a5636' }, // pelage brun
    features: [
      { bone: 'bassin', svg: QUEUE_LATERALE, layer: -2, view: 'front' },
      { bone: 'bassin', svg: QUEUE_LATERALE, layer: -2, view: 'back' },
      { bone: 'bassin', svg: QUEUE_PROFIL, layer: -2, view: 'profile' },
    ],
  },
};
