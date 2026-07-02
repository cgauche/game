import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'route',
  label: 'Chemin',
  walkable: true,
  priority: 3,
  gradient: 'g_route',
  swatch: '#8a744c',
  stops: [{ off: '0%', color: '#9a8358' }, { off: '100%', color: '#7d6a45' }],
  // Matériaux v2 : chemin de terre — variance par tuile + cailloux épars.
  detail: {
    seedScope: 'tile',
    tintVar: 0.05,
    speckle: { perM2: 0.4, rM: [0.03, 0.07], colors: ['#b09a6c', '#6a5a3a'] },
  },
};
