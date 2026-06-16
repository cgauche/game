import type { AppearanceElement } from '../types';

// Doigts trop longs couleur chair, ANCRÉS dans la paume (ils partent de l'intérieur du poing,
// pas en dessous) — chair étirée, pas des serres.
const DOIGTS = '<g data-mut="doigts-distendus">'
  + '<path d="M-1.6 1.2 Q-2.6 2.4 -2.6 4 L-2.5 5 M1.6 1.2 Q2.6 2.4 2.6 4 L2.5 5" stroke="@peau" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
  + '<path d="M-2.5 4.4 q-0.7 3.6 -0.4 7.2 M-0.85 2 q-0.2 5 0 9 M0.85 2 q0.2 5 0 9 M2.5 4.4 q0.7 3.6 0.4 7.2" stroke="@peau" stroke-width="1.25" fill="none" stroke-linecap="round"/>'
  + '<path d="M-2.9 10.2 q-0.1 1.2 0.1 2 M-0.85 10.6 q0 1 0.1 1.8 M0.85 10.6 q0 1 -0.1 1.8 M2.9 10.2 q0.1 1.2 -0.1 2" stroke="@peauO" stroke-width="1.05" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'doigts-distendus', label: 'Doigts distendus', category: 'mutation',
  overlays: [{ bone: 'mainG', svg: DOIGTS }, { bone: 'mainD', svg: DOIGTS }],
};
