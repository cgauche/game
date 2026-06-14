import type { TraitDef } from '../types';

// LDB 85 : une Nuée (Essaim) est un AMAS de petites créatures traité comme un seul combattant —
// rendu par le gabarit « swarm » et doté de cinq fois plus de PB (+10 CC), cf. applySwarmBuild.
// SOURCE UNIQUE de la détection d'essaim (`isSwarm` lit ce flag, plus aucune regex sur « Nuée »).
export const trait: TraitDef = {
  key: 'Nuée',
  swarm: true,
  note: 'Amas de petites créatures : cinq fois plus de PB qu’une créature type, +10 aux Caractéristiques basées dessus.',
};
