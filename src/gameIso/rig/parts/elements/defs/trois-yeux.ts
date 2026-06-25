import type { AppearanceElement } from '../types';

// Trois yeux : un troisième œil s'ouvre au milieu du front, au-dessus des deux yeux normaux
// (mutation Trois yeux, EDOC — Talent Sens aiguisé (Vue)). Os tête, face (détail de visage).
const TROIS_YEUX = '<g data-mut="trois-yeux">'
  // sclère du 3e œil, sur le front (entre l'arcade et la naissance des cheveux)
  + '<ellipse cx="0" cy="-3.2" rx="2.3" ry="1.9" fill="#f4efe0" stroke="#8a7a64" stroke-width="0.55"/>'
  // iris + pupille
  + '<circle cx="0" cy="-3.2" r="1.1" fill="#6a8a6a" stroke="#3a4a3a" stroke-width="0.35"/>'
  + '<circle cx="0" cy="-3.2" r="0.5" fill="#1a1410"/>'
  + '<circle cx="0.5" cy="-3.7" r="0.32" fill="#ffffff" opacity="0.85"/>'
  // arcade/paupière au-dessus
  + '<path d="M-2.4 -4.6 Q0 -5.6 2.4 -4.6" stroke="#7a6450" stroke-width="0.5" fill="none"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'trois-yeux', label: 'Trois yeux', category: 'mutation',
  overlays: [{ bone: 'tete', svg: TROIS_YEUX, view: 'front' }],
};
