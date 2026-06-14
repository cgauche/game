import type { AppearanceElement } from '../types';

// Panse de l'Ogre : MORPHOLOGIE (corps nu) — grosse bedaine @peau (la plaque-bedaine est dans la tenue).
const PANSE_OGRE = '<ellipse cx="0" cy="6" rx="15" ry="16" fill="@peau" stroke="@peauO" stroke-width="0.8"/>';

export const element: AppearanceElement = {
  key: 'panse', label: 'Panse', category: 'trait',
  overlays: [{ bone: 'torse', svg: PANSE_OGRE, scale: 'bone', layer: 50 }],
};
