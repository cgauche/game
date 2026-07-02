import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'lave',
  label: 'Lave',
  walkable: false,
  priority: 8,
  gradient: 'g_lave',
  swatch: '#c43a10',
  stops: [{ off: '0%', color: '#ff7a1a' }, { off: '45%', color: '#c4300a' }, { off: '100%', color: '#4a0e04' }],
  // Matériaux v2 : étincelles vives et croûtes noires sur la coulée.
  detail: {
    seedScope: 'tile',
    tintVar: 0.06,
    speckle: { perM2: 0.3, rM: [0.03, 0.07], colors: ['#ffb43c', '#2a0a04'] },
  },
};
