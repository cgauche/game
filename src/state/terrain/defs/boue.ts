import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'boue',
  label: 'Boue',
  walkable: true,
  priority: 2,
  gradient: 'g_boue',
  swatch: '#4a3d28',
  stops: [{ off: '0%', color: '#5a4a32' }, { off: '100%', color: '#332a1a' }],
  // Matériaux v2 : flaques sombres (humide) et croûtes plus claires (séché) par tuile.
  detail: {
    seedScope: 'tile',
    tintVar: 0.07,
    speckle: { perM2: 0.5, rM: [0.04, 0.1], colors: ['#2e2414', '#6a5638'] },
  },
};
