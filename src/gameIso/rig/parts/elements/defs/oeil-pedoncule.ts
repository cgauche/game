import type { AppearanceElement } from '../types';

// Œil pédonculé : tige charnue (façon escargot/crustacé) dressée au-dessus du crâne, légèrement
// arquée, terminée par un globe oculaire orientable. Posé DERRIÈRE la part de tête (layer -2) pour
// s'élever au-dessus du crâne, en vue de face.
const OEIL = '<g data-mut="oeil-pedoncule">'
  // pédoncule charnu (tube) montant du sommet du crâne et s'arquant
  + '<path d="M-1.3 -6 Q-2.4 -14 1.4 -19.5 Q2.6 -18.8 1.8 -16.8 Q-0.6 -12.4 0.8 -6.2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M-0.3 -7 Q-1 -13 1.6 -17.6" stroke="@peauO" stroke-width="0.45" fill="none" opacity="0.6"/>'
  // globe au bout
  + '<ellipse cx="2.2" cy="-20" rx="2.6" ry="2.4" fill="#f0ead4" stroke="#7a5a3a" stroke-width="0.5"/>'
  + '<circle cx="2.7" cy="-20" r="1.3" fill="#5a3a86" stroke="#2c1c44" stroke-width="0.35"/>'
  + '<circle cx="2.9" cy="-20" r="0.6" fill="#0c0810"/>'
  + '<circle cx="2.2" cy="-20.6" r="0.4" fill="#fff" opacity="0.8"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'oeil-pedoncule', label: 'Œil pédonculé', category: 'mutation',
  overlays: [{ bone: 'tete', svg: OEIL, layer: -2, view: 'front' }],
};
