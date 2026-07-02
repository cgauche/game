import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'planches',
  label: 'Planches',
  walkable: true,
  priority: 3,
  gradient: 'g_planches',
  swatch: '#8a6a3c',
  stops: [{ off: '0%', color: '#96743f' }, { off: '100%', color: '#6a4d28' }],
  // Matériaux v2 : lattes étroites — planches LONGUES à abouts décalés, veinage porté par la nuance
  // par planche (pas de `tintVar` : continuité des lattes entre tuiles).
  detail: {
    seedScope: 'tile',
    courses: { hM: 0.28, joint: '#4a3820', jointW: 0.03, stagger: 0.5, blockWM: [1.3, 2.3], edgeWobble: 0.008, paletteVar: 0.07 },
  },
};
