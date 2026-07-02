import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'marbre',
  label: 'Marbre',
  walkable: true,
  priority: 2,
  gradient: 'g_marbre',
  swatch: '#b9b4aa',
  stops: [{ off: '0%', color: '#cbc6bd' }, { off: '100%', color: '#a49e92' }],
  // Matériaux v2 : très grandes dalles polies, joints à peine marqués, presque aucune variance
  // (pas de `tintVar` : continuité de l'appareillage).
  detail: {
    seedScope: 'tile',
    courses: { hM: 0.8, joint: '#8f897c', jointW: 0.025, stagger: 0.5, blockWM: [1.4, 2.1], paletteVar: 0.03 },
  },
};
