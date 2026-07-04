import type { AppearanceElement } from '../types';

// Plaie de chair rouge exposée (zombie) — calque torse. Art PARTAGÉ (owner) : élément + monsterInjection (m.plaie).
export const PLAIE_ART = `<ellipse cx="-2" cy="-10" rx="3" ry="4" fill="#7a1010"/><ellipse cx="-2" cy="-10" rx="1.6" ry="2.6" fill="#b03a2e"/>`;

export const element: AppearanceElement = {
  key: 'plaie', label: 'Plaie ouverte', category: 'trait',
  overlays: [{ bone: 'torse', svg: PLAIE_ART, scale: 'bone', layer: 98 }],
};
