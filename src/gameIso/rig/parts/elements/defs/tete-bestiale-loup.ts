import type { AppearanceElement } from '../types';

// Tête de loup (Enfant d'Ulric hybride, Middenheim p.116) : grandes oreilles TRIANGULAIRES dressées (la
// silhouette « loup » de face), crâne gris fourré, museau LONG et étroit, truffe noire, gueule retroussée
// sur des crocs (grondement), yeux AMBRE fendus (prédateur). Os tête, face — par-dessus le corps humanoïde.
const LOUP = '<g data-mut="tete-bestiale-loup">'
  // oreilles pointues dressées (triangles), doublure rose
  + '<path d="M-7.6 -4.6 L-9.4 -13 L-3.8 -6.6 Z" fill="#6f6f74" stroke="#3a3a40" stroke-width="0.6"/>'
  + '<path d="M7.6 -4.6 L9.4 -13 L3.8 -6.6 Z" fill="#6f6f74" stroke="#3a3a40" stroke-width="0.6"/>'
  + '<path d="M-7 -6 L-8 -11 L-4.8 -7 Z" fill="#8a6b6b"/>'
  + '<path d="M7 -6 L8 -11 L4.8 -7 Z" fill="#8a6b6b"/>'
  // crâne gris fourré (léger fanon aux joues)
  + '<path d="M-7.6 -3 Q-8.4 4 -4.2 9 L4.2 9 Q8.4 4 7.6 -3 Q5.2 -7.6 0 -7.8 Q-5.2 -7.6 -7.6 -3 Z" fill="#77777d" stroke="#3d3d43" stroke-width="0.7"/>'
  + '<path d="M-7.4 1 L-9 2.4 M7.4 1 L9 2.4 M-7.2 4 L-8.6 5.6 M7.2 4 L8.6 5.6" stroke="#5a5a60" stroke-width="0.6" fill="none" stroke-linecap="round"/>'
  // yeux ambre fendus (prédateur)
  + '<path d="M-4.4 -0.2 Q-2.8 -1.4 -1.6 -0.2 Q-2.8 0.7 -4.4 -0.2 Z" fill="#e8a828"/>'
  + '<path d="M4.4 -0.2 Q2.8 -1.4 1.6 -0.2 Q2.8 0.7 4.4 -0.2 Z" fill="#e8a828"/>'
  + '<circle cx="-2.9" cy="-0.2" r="0.7" fill="#1e140e"/><circle cx="2.9" cy="-0.2" r="0.7" fill="#1e140e"/>'
  // museau long et étroit
  + '<path d="M-3 5.4 Q-3.4 13.6 0 15.4 Q3.4 13.6 3 5.4 Z" fill="#84848a" stroke="#4a4a50" stroke-width="0.6"/>'
  + '<path d="M0 6 L0 13.8" stroke="#5a5a60" stroke-width="0.5"/>'
  // truffe noire
  + '<ellipse cx="0" cy="12.4" rx="1.9" ry="1.3" fill="#17110d"/>'
  // gueule retroussée + crocs (grondement)
  + '<path d="M-2.6 13.4 Q0 15.4 2.6 13.4" stroke="#241812" stroke-width="0.7" fill="none" stroke-linecap="round"/>'
  + '<path d="M-1.7 13.7 l-0.35 1.7 M1.7 13.7 l0.35 1.7 M-0.7 14 l-0.15 1.3 M0.7 14 l0.15 1.3" stroke="#f2ecdc" stroke-width="0.55" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'tete-bestiale-loup', label: 'Tête bestiale (Loup)', category: 'mutation',
  overlays: [{ bone: 'tete', svg: LOUP, view: 'front' }],
};
