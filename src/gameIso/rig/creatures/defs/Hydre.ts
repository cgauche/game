import type { CreatureDef } from '../types';

// Hydre : grand reptile à PLUSIEURS têtes. Quadrupède `draconic` + tête `hydre` (cluster de 3
// cous serpentins en éventail, chacun coiffé d'une tête reptilienne, dessiné dans l'os encolure
// → ondule d'un bloc, sans os supplémentaire) + queue `reptile`. Robe vert sombre des marais
// (≠ olive du Basilic, ≠ vert forêt du Dragon). Sortie du monolithique : rendu via AnimatedQuadToken.
export const creature: CreatureDef = {
  name: 'Hydre',
  plan: 'quadruped',
  quad: {
    // Canon LDB 79 l.96-98 : « corps massif » (girth↑, pattes courtes), « entrelacs de cous »
    // (neckLen↑), Constricteur (tailLen↑), Furtif des marais (robe tachetée), Armure 3.
    sl: 1.2, build: 'draconic', girth: 1.2, bodyLen: 1.14, neckLen: 1.55, neckAngle: -12,
    legLen: 0.66, head: 'hydre', tail: 'reptile', mane: 'sans', ears: 'pointues', foot: 'patte',
    tailLen: 1.35, markings: 'taches',
    stored: { corps: '#3e5a44', corpsO: '#1f3325', corpsH: '#647f60', cheveux: '#1e2e22', cheveuxO: '#121c15', cuir: '#6e6243' },
  },
};
