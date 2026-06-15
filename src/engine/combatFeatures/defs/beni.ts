import type { CombatFeature } from '../types';

// LDB 41 l.14 : « un Personnage avec le Talent Béni reçoit les six Bénédictions de son culte. »
// Famille 'beni' (grimoire.ts) + octroi automatique des 6 Bénédictions à l'acquisition (talentEffects).
export const feature: CombatFeature = { key: 'Béni', kind: 'talent', castingKind: 'beni', grantsCultBlessings: true };
