import type { CombatFeature } from '../types';

// LDB 10 : « Vous ne subissez pas d'Incantation Imparfaite si vous obtenez un double à un Test de Focalisation réussi. »
export const feature: CombatFeature = { key: 'Harmonisation aethyrique', kind: 'talent', focusNoMiscastOnDouble: true };
