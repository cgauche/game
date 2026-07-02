import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'cendre',
  label: 'Cendre',
  walkable: true,
  priority: 2,
  gradient: 'g_cendre',
  swatch: '#372c26',
  stops: [{ off: '0%', color: '#4a3c34' }, { off: '100%', color: '#241c18' }],
  // Matériaux v2 : scories et braises éteintes dans la couche de cendre.
  detail: {
    seedScope: 'tile',
    tintVar: 0.06,
    speckle: { perM2: 0.4, rM: [0.03, 0.08], colors: ['#5a4a3e', '#15100d'] },
  },
};
