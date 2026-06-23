import type { AppearanceElement } from '../types';

// Pieds palmés (batracien) : pied élargi vers l'avant, orteils reliés par une membrane tendue
// translucide verdâtre, festonnée entre chaque doigt. Posé sur l'os pied (devant la botte).
const PALME = '<g data-mut="pieds-palmes">'
  // membrane palmée festonnée (éventail entre 4 orteils)
  + '<path d="M-3.6 0 Q-3 3.4 -1.2 3.6 Q0 2.6 1.2 3.8 Q3 3.4 3.8 0 Q1.2 1.4 0 1 Q-1.4 1.4 -3.6 0 Z" fill="#86a87a" stroke="#4e6a44" stroke-width="0.5"/>'
  // orteils griffus dépassant de la membrane
  + '<path d="M-3.6 0 l-0.6 1.4 M-1.2 1.2 l-0.2 2.4 M1.2 1.2 l0.2 2.4 M3.6 0 l0.6 1.4" stroke="#4e6a44" stroke-width="0.6" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'pieds-palmes', label: 'Pieds palmés', category: 'mutation',
  overlays: [
    { bone: 'piedG', svg: PALME, layer: 90 },
    { bone: 'piedD', svg: PALME, layer: 90 },
  ],
};
