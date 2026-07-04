import type { AppearanceElement } from '../types';

export const element: AppearanceElement = {
  key: 'cornes-demon', label: 'Cornes de démon', category: 'trait',
  // cornes de démon MULTI-VUES du registre UNIQUE (profil balayé inclus) — plus d'art par-vue inline.
  overlays: [{ bone: 'tete', appendage: 'cornes-demon', svg: '', scale: 'bone', layer: -2 }],
};
