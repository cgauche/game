import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'terre',
  label: 'Terre battue',
  walkable: true,
  priority: 2,
  gradient: 'g_terre',
  swatch: '#6b5436',
  stops: [{ off: '0%', color: '#7a5f3c' }, { off: '100%', color: '#57452b' }],
  // Matériaux v2 : variance de teinte par TUILE + cailloux/taches épars seedés.
  detail: {
    seedScope: 'tile',
    tintVar: 0.06,
    speckle: { perM2: 0.6, rM: [0.03, 0.08], colors: ['#8a7a5c', '#4a3c26'] },
  },
};
