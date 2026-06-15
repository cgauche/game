import type { CombatFeature } from '../types';

// LDB 10 l.587 : « Vous mémorisez de façon permanente un nombre de Sorts de Magie mineure égal à
// votre Bonus de Force Mentale. » Famille d'incantation 'mineure' (apprentissage : grimoire.ts).
export const feature: CombatFeature = { key: 'Magie mineure', kind: 'talent', castingKind: 'mineure' };
