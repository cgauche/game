import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'tourbe',
  label: 'Tourbe',
  walkable: true,
  priority: 2,
  gradient: 'g_tourbe',
  swatch: '#4f4226',
  stops: [{ off: '0%', color: '#5b4a2c' }, { off: '100%', color: '#332916' }],
  // Matériaux v2 : mottes claires et trous d'eau sombres du marais.
  detail: {
    seedScope: 'tile',
    tintVar: 0.06,
    speckle: { perM2: 0.5, rM: [0.03, 0.08], colors: ['#6a5732', '#241d0e'] },
  },
};
