import type { TenueDef } from '../types';

// Archétype de classe Citadins : habit de ville beige. SERT AUSSI DE FALLBACK PAR DÉFAUT
// (careerTenue renvoie Citadins si la classe est inconnue) — ne pas renommer/supprimer.
export const tenue: TenueDef = {
  name: 'Citadins',
  set: {
    torse: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="#8a7048"/>`,
    jambes: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#4c3a26"/>`,
  },
};
