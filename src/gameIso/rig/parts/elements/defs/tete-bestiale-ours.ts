import type { AppearanceElement } from '../types';

// Tête d'ours brun trapue : petites oreilles RONDES en haut (l'indice « tête animale » de face),
// front large brun foncé, museau court et clair, grosse truffe noire, gueule entrouverte sur des
// crocs. Os tête, face.
const OURS = '<g data-mut="tete-bestiale-ours">'
  // petites oreilles rondes aux coins du crâne
  + '<circle cx="-6" cy="-6.5" r="2.6" fill="#5c4632" stroke="#3a2c1e" stroke-width="0.6"/>'
  + '<circle cx="6" cy="-6.5" r="2.6" fill="#5c4632" stroke="#3a2c1e" stroke-width="0.6"/>'
  + '<circle cx="-6" cy="-6.2" r="1.2" fill="#7a5c40"/>'
  + '<circle cx="6" cy="-6.2" r="1.2" fill="#7a5c40"/>'
  // crâne brun
  + '<path d="M-7.4 -3 Q-8 4 -4 9 L4 9 Q8 4 7.4 -3 Q5 -8 0 -8 Q-5 -8 -7.4 -3 Z" fill="#6b513a" stroke="#3a2c1e" stroke-width="0.7"/>'
  // yeux petits et noirs
  + '<circle cx="-3.2" cy="0.5" r="0.9" fill="#1e140e"/>'
  + '<circle cx="3.2" cy="0.5" r="0.9" fill="#1e140e"/>'
  // museau court et clair
  + '<path d="M-3.4 6 Q-4 11.6 0 12.8 Q4 11.6 3.4 6 Z" fill="#a78a64" stroke="#6a4f36" stroke-width="0.6"/>'
  // truffe noire
  + '<ellipse cx="0" cy="9.2" rx="2.1" ry="1.4" fill="#1e140e"/>'
  // gueule + crocs
  + '<path d="M-2.4 11.6 Q0 13.6 2.4 11.6" stroke="#2e1e14" stroke-width="0.6" fill="none" stroke-linecap="round"/>'
  + '<path d="M-1.4 11.8 l-0.3 1.4 M1.4 11.8 l0.3 1.4" stroke="#f0e8d4" stroke-width="0.6" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'tete-bestiale-ours', label: 'Tête bestiale (Ours)', category: 'mutation',
  overlays: [{ bone: 'tete', svg: OURS, view: 'front' }],
};
