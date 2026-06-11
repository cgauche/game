import type { CreatureDef } from '../types';

// Hydre : grand reptile à PLUSIEURS têtes. Quadrupède `draconic` + tête `hydre` (cluster de 3
// cous serpentins en éventail, chacun coiffé d'une tête reptilienne, dessiné dans l'os encolure
// → ondule d'un bloc, sans os supplémentaire) + queue `reptile`. Robe vert sombre des marais
// (≠ olive du Basilic, ≠ vert forêt du Dragon). Sortie du monolithique : rendu via AnimatedQuadToken.
export const creature: CreatureDef = {
  name: 'Hydre',
  plan: 'quadruped',
  aliases: ['hydra', 'hydre des marais'],
  quad: {
    sl: 1.2, build: 'draconic', girth: 1.12, bodyLen: 1.16, neckLen: 1.5, neckAngle: -12,
    legLen: 0.72, head: 'hydre', tail: 'reptile', ears: 'pointues', foot: 'patte',
    stored: { corps: '#3e5a44', corpsO: '#243a2a', corpsH: '#5e7c62', cheveux: '#1e2e22', cheveuxO: '#121c15', cuir: '#a89a36' },
  },
};
