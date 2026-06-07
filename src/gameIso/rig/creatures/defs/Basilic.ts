import type { CreatureDef } from '../types';

// Basilic : grand reptile bas sur pattes au regard mortel. Quadrupède reptilien — réutilise
// INTÉGRALEMENT le corps draconique + la tête `dragon` (écailleuse, cornue) + la queue `reptile`,
// SANS ailes (≠ Dragon). Sorti du monolithique : 1 fichier, rendu en jeu via AnimatedQuadToken.
// Robe olive-jaune venimeuse (≠ vert forêt du Dragon) pour le distinguer à l'écran.
export const creature: CreatureDef = {
  name: 'Basilic',
  plan: 'quadruped',
  aliases: ['basilisk', 'lezard geant', 'lézard géant'],
  quad: {
    sl: 1.32, build: 'draconic', girth: 1.06, bodyLen: 1.26, neckLen: 0.66, neckAngle: -18,
    legLen: 0.6, head: 'dragon', tail: 'reptile', ears: 'pointues', foot: 'patte',
    stored: { corps: '#6f7a30', corpsO: '#454c1c', corpsH: '#9aa552', cheveux: '#3a3e16', cheveuxO: '#23260e', cuir: '#c2a838' },
  },
};
