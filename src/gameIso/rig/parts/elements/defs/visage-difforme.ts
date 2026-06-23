import type { AppearanceElement } from '../types';

// Visage difforme : traits fondus et tordus, asymétriques — un œil plus haut et plus gros que
// l'autre, bouche de travers, chair boursouflée (mutation Visage difforme, EDOC). Os tête, face.
const VISAGE_DIFFORME = '<g data-mut="visage-difforme">'
  // boursouflure de chair (joue gauche gonflée)
  + '<path d="M-6.5 1 Q-9 5 -6 9 Q-3 8 -4 3 Z" fill="#c9a07a" stroke="#9a6a52" stroke-width="0.5" opacity="0.9"/>'
  // œil gauche haut et gros
  + '<ellipse cx="-3.2" cy="-2.5" rx="2.3" ry="1.7" fill="#efe7d4" stroke="#7a6450" stroke-width="0.5"/>'
  + '<circle cx="-3" cy="-2.3" r="0.9" fill="#3a2c1e"/>'
  // œil droit bas et petit, presque fermé
  + '<ellipse cx="3.4" cy="2" rx="1.5" ry="0.9" fill="#efe7d4" stroke="#7a6450" stroke-width="0.5"/>'
  + '<circle cx="3.4" cy="2" r="0.6" fill="#3a2c1e"/>'
  // nez tordu de travers
  + '<path d="M-0.4 1 Q1.4 5 -0.6 8" stroke="#9a6a52" stroke-width="0.7" fill="none" stroke-linecap="round"/>'
  // bouche de travers (oblique)
  + '<path d="M-3.4 11.5 Q0 9.5 4 12.5" stroke="#6a3a2e" stroke-width="0.8" fill="none" stroke-linecap="round"/>'
  // plis/sillons de chair fondue
  + '<path d="M-2 5 Q-1 7 -2.5 9 M5 -1 Q6.5 1 5.5 4" stroke="#9a6a52" stroke-width="0.4" fill="none" opacity="0.6"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'visage-difforme', label: 'Visage difforme', category: 'mutation',
  overlays: [{ bone: 'tete', svg: VISAGE_DIFFORME, view: 'front' }],
};
