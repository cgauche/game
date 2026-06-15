import type { CombatFeature } from '../types';

// LDB 60 l.12 : « […] vous réduisez le prix de 20 % au lieu de 10 % si vous obtenez un Succès
// Stupéfiant ou si vous possédez le Talent Négociateur. » Marchandage gagné → −20 % même sans DR≥6.
export const feature: CombatFeature = { key: 'Négociateur', kind: 'talent', bargainBonus: true };
