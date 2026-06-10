import type { CombatFeature } from '../types';

// LDB 10 : « Ajoutez un DR égal à votre niveau d'Artilleur à n'importe quel Test étendu pour recharger une arme à Poudre noire. »
export const feature: CombatFeature = { key: 'Artilleur', kind: 'talent', reloadDR: 'blackpowder' };
