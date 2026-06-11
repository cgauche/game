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
    // Canon LDB 79 (l.15-16) : « créatures reptiliennes » solitaires, venimeuses, au regard
    // pétrifiant, avec Attaque caudale +8 (l.22) → silhouette de GRAND LÉZARD bas sur pattes :
    // corps allongé, membres courts, tête portée en avant, queue massive (tailLen). Le plan
    // quadruped ne rend que 4 des 8 pattes canon — la lisibilité « reptile » prime.
    sl: 1.1, build: 'draconic', girth: 1.0, bodyLen: 1.42, neckLen: 0.52, neckAngle: -6,
    legLen: 0.42, head: 'dragon', headScale: 1.12, tail: 'reptile', tailLen: 1.55,
    ears: 'courtes', foot: 'patte', ridge: 'epines',
    stored: { corps: '#7a8430', corpsO: '#454c1c', corpsH: '#a8b452', cheveux: '#3a3e16', cheveuxO: '#23260e', cuir: '#6b6e28' },
  },
};
