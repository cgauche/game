import type { AppearanceElement } from '../types';

// Tête de chien : oreilles pointues dressées (l'indice « tête animale » lisible de face) + museau
// clair avancé avec petite truffe noire (mutation Tête bestiale (Chien), EDO Appendice 2). Os tête, face.
const TETE_CHIEN = '<g data-mut="museau-chien">'
  // oreilles dressées aux coins du crâne
  + '<path d="M-6 -3.5 L-8.8 -11 L-4 -6 Z" fill="#7a6c58" stroke="#54402f" stroke-width="0.6"/>'
  + '<path d="M6 -3.5 L8.8 -11 L4 -6 Z" fill="#7a6c58" stroke="#54402f" stroke-width="0.6"/>'
  // museau clair (bas du visage) + truffe noire au bout
  + '<path d="M-2.6 7 Q-3.2 11.6 0 12.8 Q3.2 11.6 2.6 7 Z" fill="#a89a86" stroke="#6a5a48" stroke-width="0.5"/>'
  + '<ellipse cx="0" cy="11.8" rx="1.3" ry="0.9" fill="#241b16"/>'
  + '<path d="M-1.6 12.6 Q0 13.4 1.6 12.6" stroke="#3a2820" stroke-width="0.4" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'museau-chien', label: 'Tête de chien', category: 'mutation',
  overlays: [{ bone: 'tete', svg: TETE_CHIEN, view: 'front' }],
};
