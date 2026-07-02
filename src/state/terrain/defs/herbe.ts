import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'herbe',
  label: 'Herbe',
  walkable: true,
  priority: 1,
  gradient: 'g_grass',
  swatch: '#3d6630',
  // Dégradé par tuile ADOUCI (delta réduit) : le damier de losanges recule, la variance par tuile
  // et les touffes portent la vie du pré (matériaux v2).
  stops: [{ off: '0%', color: '#4a7536' }, { off: '100%', color: '#3a5c28' }],
  detail: {
    seedScope: 'tile',
    tintVar: 0.07,
    tufts: { perM2: 1.1, hM: [0.1, 0.22], colors: ['#5c8a40', '#3a5c28'] },
  },
};
