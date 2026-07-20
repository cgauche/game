import type { TenueDef } from '../types';

// Archétype de classe Citadins : habit de ville beige. SERT AUSSI DE FALLBACK PAR DÉFAUT
// (careerTenue renvoie Citadins si la classe est inconnue) — ne pas renommer/supprimer.
export const tenue: TenueDef = {
  label: 'Citadins',
  set: {
    torse: `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="@vet1"/>`,
    jambes: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="@vet2"/>`,
  },
  palette: { vet1: '#8a7048', vet2: '#4c3a26' },
};
