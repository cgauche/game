import type { AppearanceElement } from '../types';

// Crocs de vampire (calque sur la tête, par-dessus le visage humain). Art PARTAGÉ (owner) : cet
// élément + monsterInjection (m.cape → crocs, vue de face).
export const CROCS_ART = `<path d="M-2 11 l-0.5 2.4 l1 0 z M2 11 l0.5 2.4 l-1 0 z" fill="#f4ecd8" stroke="#b8a888" stroke-width="0.3"/>`;

export const element: AppearanceElement = {
  key: 'crocs', label: 'Crocs', category: 'trait',
  overlays: [{ bone: 'tete', svg: CROCS_ART, scale: 'bone', layer: 98, view: 'front' }],
};
