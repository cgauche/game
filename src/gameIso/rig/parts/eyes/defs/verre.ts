import type { EyeDef } from '../types';

// Œil de verre (LDB 73) : sclère vitreuse, iris pâle, reflet FIXE — un regard mort.
export const eye: EyeDef = {
  id: 'verre',
  label: 'Œil de verre',
  catalogOrder: 6,
  art:
    '<g data-injury="oeil-de-verre"><ellipse rx="2.05" ry="1.3" fill="#eef2f4"/><ellipse rx="2.05" ry="1.3" fill="none" stroke="#8a98a4" stroke-width="0.35"/>'
    + '<circle r="1.05" fill="#9ab4c2"/><circle r="0.45" fill="#5a7484"/><circle cx="0.45" cy="-0.4" r="0.3" fill="#fff"/></g>',
};
