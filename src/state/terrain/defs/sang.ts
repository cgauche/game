import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'sang',
  label: 'Sol ensanglanté',
  walkable: true,
  priority: 2,
  gradient: 'g_sang',
  swatch: '#5e1f1f',
  stops: [{ off: '0%', color: '#6e1f1f' }, { off: '100%', color: '#3a1010' }],
  // Matériaux v2 : éclaboussures vives et caillots presque noirs.
  detail: {
    seedScope: 'tile',
    tintVar: 0.06,
    speckle: { perM2: 0.5, rM: [0.04, 0.11], colors: ['#8a2a24', '#2a0c0a'] },
  },
};
