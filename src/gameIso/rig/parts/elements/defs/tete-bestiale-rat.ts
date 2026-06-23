import type { AppearanceElement } from '../types';

// Tête de rat (Tête bestiale, sous-table EDOC) : grandes oreilles rondes nues, museau pointu gris,
// truffe rose, longues moustaches, deux incisives jaunes proéminentes, petits yeux noirs. Os tête, face.
const TETE_RAT = '<g data-mut="tete-bestiale-rat">'
  // grandes oreilles rondes nues (tell de face) — pavillon clair rosé
  + '<path d="M-6 -4 Q-11 -8 -9.5 -2 Q-8.5 1 -5 -0.5 Z" fill="#8a7a72" stroke="#5a4a44" stroke-width="0.6"/>'
  + '<path d="M6 -4 Q11 -8 9.5 -2 Q8.5 1 5 -0.5 Z" fill="#8a7a72" stroke="#5a4a44" stroke-width="0.6"/>'
  + '<ellipse cx="-8.2" cy="-3.4" rx="1.6" ry="2.2" fill="#c89a92"/><ellipse cx="8.2" cy="-3.4" rx="1.6" ry="2.2" fill="#c89a92"/>'
  // crâne/joues gris
  + '<path d="M-5 -2 Q0 -5 5 -2 Q5.5 5 2.4 8.5 L-2.4 8.5 Q-5.5 5 -5 -2 Z" fill="#9a8e84" stroke="#5e524a" stroke-width="0.5"/>'
  // petits yeux noirs
  + '<ellipse cx="-3" cy="1" rx="1.1" ry="1.3" fill="#1a1410"/><ellipse cx="3" cy="1" rx="1.1" ry="1.3" fill="#1a1410"/>'
  // museau pointu avancé, truffe rose
  + '<path d="M-2.4 6.5 Q-2 11.5 0 13 Q2 11.5 2.4 6.5 Z" fill="#b0a299" stroke="#5e524a" stroke-width="0.5"/>'
  + '<ellipse cx="0" cy="12.4" rx="1.2" ry="0.9" fill="#c87f78" stroke="#7a4640" stroke-width="0.3"/>'
  // deux incisives jaunes proéminentes
  + '<path d="M-1.1 13 L-1.1 15 L-0.2 14.6 Z" fill="#e8d27a" stroke="#a89030" stroke-width="0.3"/>'
  + '<path d="M1.1 13 L1.1 15 L0.2 14.6 Z" fill="#e8d27a" stroke="#a89030" stroke-width="0.3"/>'
  // longues moustaches
  + '<path d="M-2 11 Q-7 10.5 -10 9 M-2 12 Q-7 12.5 -10 13 M2 11 Q7 10.5 10 9 M2 12 Q7 12.5 10 13" stroke="#3a2e26" stroke-width="0.35" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'tete-bestiale-rat', label: 'Tête bestiale (Rat)', category: 'mutation',
  overlays: [{ bone: 'tete', svg: TETE_RAT, view: 'front' }],
};
