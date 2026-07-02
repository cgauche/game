import type { TerrainDef } from '../types';

export const terrain: TerrainDef = {
  id: 'pave',
  label: 'Pavés',
  walkable: true,
  priority: 5,
  gradient: 'g_pave',
  swatch: '#7c7a82',
  stops: [{ off: '0%', color: '#8f8d96' }, { off: '100%', color: '#63616b' }],
  // Matériaux v2 : appareillage de pavés CONTINU au sol — joints + nuances par pierre cuites au motif.
  // Pas de `tintVar` : un damier par tuile casserait la continuité de l'appareillage (la variance
  // vit PAR PIERRE, dans le motif).
  detail: {
    seedScope: 'tile',
    courses: { hM: 0.42, joint: '#4f4d56', jointW: 0.03, stagger: 0.5, blockWM: [0.45, 0.75], edgeWobble: 0.015, paletteVar: 0.07 },
  },
};
