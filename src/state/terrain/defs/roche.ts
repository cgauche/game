import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'roche',
  label: 'Roche',
  walkable: true,
  priority: 2,
  gradient: 'g_roche',
  swatch: '#5c5850',
  stops: [{ off: '0%', color: '#6e6a62' }, { off: '100%', color: '#4a463e' }],
  // Matériaux v2 : roche nue — éclats clairs et fissures sombres épars.
  detail: {
    seedScope: 'tile',
    tintVar: 0.05,
    speckle: { perM2: 0.4, rM: [0.04, 0.09], colors: ['#7d786e', '#3a362e'] },
  },
};
