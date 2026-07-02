import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'sol',
  label: 'Sol nu',
  walkable: true,
  priority: 2,
  gradient: 'g_sol',
  swatch: '#5b4d40',
  stops: [{ off: '0%', color: '#6b5d4f' }, { off: '100%', color: '#52463a' }],
  // Matériaux v2 : sol battu générique — variance légère + rares gravillons.
  detail: {
    seedScope: 'tile',
    tintVar: 0.05,
    speckle: { perM2: 0.35, rM: [0.03, 0.07], colors: ['#7d6e5c', '#40362a'] },
  },
};
