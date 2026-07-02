import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'plancher',
  label: 'Plancher',
  walkable: true,
  priority: 4,
  gradient: 'g_plancher',
  swatch: '#7a5a30',
  stops: [{ off: '0%', color: '#8a6638' }, { off: '100%', color: '#6a4d28' }],
  // Matériaux v2 : plancher intérieur — lattes plus larges et plus régulières que les planches brutes
  // (pas de `tintVar` : continuité des lattes entre tuiles).
  detail: {
    seedScope: 'tile',
    courses: { hM: 0.3, joint: '#503a22', jointW: 0.028, stagger: 0.5, blockWM: [1.6, 2.6], paletteVar: 0.06 },
  },
};
