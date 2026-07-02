import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'eau',
  label: 'Eau',
  walkable: false,
  priority: 0,
  gradient: 'g_eau',
  swatch: '#2f5a8a',
  stops: [{ off: '0%', color: '#2f5a8a' }, { off: '100%', color: '#234a74' }],
  // Matériaux v2 : miroitement par TUILE + quelques REFLETS clairs épars (le vocabulaire actuel n'a pas
  // de vaguelettes animées — les glints du mouchetis en tiennent lieu, subtils).
  detail: {
    seedScope: 'tile',
    tintVar: 0.03,
    speckle: { perM2: 0.25, rM: [0.04, 0.09], colors: ['#7ba7d4', '#5a8fc0'] },
  },
};
