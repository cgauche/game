import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'sable',
  label: 'Sable',
  walkable: true,
  priority: 2,
  gradient: 'g_sable',
  swatch: '#bca264',
  stops: [{ off: '0%', color: '#cdb37a' }, { off: '100%', color: '#a88a4e' }],
  // Matériaux v2 : mouchetis TRÈS discret (grains/galets), variance de dune légère.
  detail: {
    seedScope: 'tile',
    tintVar: 0.04,
    speckle: { perM2: 0.3, rM: [0.02, 0.05], colors: ['#e0c68c', '#8f7440'] },
  },
};
