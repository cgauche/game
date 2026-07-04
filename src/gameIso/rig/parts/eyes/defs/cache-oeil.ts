import type { EyeDef } from '../types';

// Cache-œil : coque de cuir bombée + UNE sangle fine filant vers les tempes. (blessure)
export const eye: EyeDef = {
  id: 'cache-oeil',
  label: 'Cache-œil',
  art:
    '<g data-injury="cache-oeil"><path d="M-6.6 -0.4 L-2.4 -1.1 M2.4 -1.1 L6.6 -1.9" stroke="#241a12" stroke-width="0.65"/>'
    + '<ellipse rx="2.5" ry="2.05" fill="#241a12" stroke="#0c0806" stroke-width="0.35"/>'
    + '<path d="M-1.5 -1.05 Q0 -1.75 1.5 -1.05" stroke="#4a3a2a" stroke-width="0.45" fill="none" opacity="0.85"/></g>',
};
