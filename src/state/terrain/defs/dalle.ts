import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'dalle',
  label: 'Dallage',
  walkable: true,
  priority: 4,
  built: true,
  gradient: 'g_dalle',
  swatch: '#8d8a86',
  stops: [{ off: '0%', color: '#a7a39d' }, { off: '100%', color: '#7c7872' }],
  // Matériaux v2 : grandes dalles appareillées, joints fins, nuance discrète par dalle (pas de
  // `tintVar` : la continuité de l'appareillage prime sur le damier par tuile).
  detail: {
    seedScope: 'tile',
    courses: { hM: 0.6, joint: '#6e6a63', jointW: 0.035, stagger: 0.5, blockWM: [0.9, 1.4], edgeWobble: 0.01, paletteVar: 0.05 },
  },
};
