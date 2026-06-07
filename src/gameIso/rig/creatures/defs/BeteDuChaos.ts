import type { CreatureDef } from '../types';

// Bêtes du Chaos NOMMÉES (bespoke, formes uniques) — restent monolithiques (sprite legacy par
// nom). Def de ROUTAGE (remplace EXOTIC_RE) regroupant les variantes par alias.
export const creature: CreatureDef = {
  name: 'Bête du Chaos',
  plan: 'monolithic',
  aliases: ['nurgle', 'tzeentch', 'mournbreath', 'whiptongue', 'slenderthigh', 'jabberslythe'],
};
