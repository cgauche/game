import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'ossuaire',
  label: 'Ossuaire',
  walkable: true,
  priority: 2,
  gradient: 'g_ossuaire',
  swatch: '#afa27e',
  stops: [{ off: '0%', color: '#c4b896' }, { off: '100%', color: '#9a8c66' }],
  // Matériaux v2 : éclats d'os clairs et creux sombres.
  detail: {
    seedScope: 'tile',
    tintVar: 0.05,
    speckle: { perM2: 0.6, rM: [0.04, 0.1], colors: ['#e0d4ac', '#7a6c48'] },
  },
};
