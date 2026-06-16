import type { AppearanceElement } from '../types';

// Grande corne charnue à droite + moignon tordu à gauche : l'asymétrie EST la mutation (et reste le
// « tell » de silhouette du mutant). Le moignon monte à −16 pour dépasser des cheveux (calque DERRIÈRE
// la part de tête).
const CORNES = '<g data-mut="cornes-asymetriques">'
  + '<path d="M4 -1.6 Q12 -7 12 -16 Q11.6 -23 6 -26 Q9.4 -21 8 -15.4 Q6.2 -8.6 -1 -4 Z" fill="#c8a880" stroke="#4a3826" stroke-width="0.8"/>'
  + '<path d="M6 -8 q2.4 -1 3.4 -2.8 M8.4 -13.6 q2 -0.8 2.6 -2.4 M9 -19 q1.6 -0.6 2 -2" fill="none" stroke="#7a5a3a" stroke-width="0.6"/>'
  + '<path d="M-5 -2 Q-9 -8 -6.6 -16 Q-9.6 -12 -8.6 -6 Q-7.6 -1.6 -3 -0.6 Z" fill="#c8a880" stroke="#4a3826" stroke-width="0.7"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'cornes-asymetriques', label: 'Cornes asymétriques', category: 'mutation',
  overlays: [{ bone: 'tete', svg: CORNES, behind: true }],
};
