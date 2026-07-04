import type { EyeDef } from '../types';

// Œil perdu (sans prothèse) : orbite recouverte de chair, paupière cousue balafrée. (blessure)
export const eye: EyeDef = {
  id: 'perdu',
  label: 'Œil perdu',
  art:
    '<g data-injury="oeil-perdu"><ellipse rx="2.3" ry="1.6" fill="@peau"/>'
    + '<path d="M-1.7 0.1 Q0 0.9 1.7 0.1" stroke="@peauO" stroke-width="0.7" fill="none" stroke-linecap="round"/>'
    + '<path d="M-1.5 -1.8 L1.3 1.9 M1.2 -1.8 L-1.4 1.8" stroke="#8a4a3a" stroke-width="0.5" stroke-linecap="round"/></g>',
};
