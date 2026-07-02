import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'pierre',
  label: 'Pierre',
  walkable: true,
  priority: 2,
  gradient: 'g_pierre',
  swatch: '#4c505a',
  stops: [{ off: '0%', color: '#5c606a' }, { off: '100%', color: '#3c4049' }],
  // Matériaux v2 : sol de pierre appareillé (donjon/cour), blocs moyens un peu irréguliers (pas de
  // `tintVar` : continuité de l'appareillage).
  detail: {
    seedScope: 'tile',
    courses: { hM: 0.5, joint: '#2e323a', jointW: 0.035, stagger: 0.5, blockWM: [0.7, 1.1], edgeWobble: 0.02, paletteVar: 0.05 },
  },
};
