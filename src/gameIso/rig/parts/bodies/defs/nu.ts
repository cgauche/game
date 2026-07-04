import type { BodyDef } from '../types';

// Corps NU (@peau) — silhouettes du def Nu, pour composer les tenues de monstres.
export const body: BodyDef = {
  id: 'nu',
  label: 'Corps nu',
  torseFront: '<path d="M-13 -28 Q0 -32 13 -28 L12 4 L11 34 Q0 38 -11 34 L-12 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>',
  torseBack:
    '<path d="M-8.5 -27 Q0 -30 8.5 -27 L9 4 Q8 16 5 33 Q0 36 -5 33 Q-8 16 -9 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
    + '<path d="M0 -27 L0 33" stroke="@peauO" stroke-width="0.7" opacity="0.55"/>'
    + '<path d="M-8.5 -24 Q0 -27 8.5 -24 L8.5 -19 Q0 -22 -8.5 -19 Z" fill="@peauH" opacity="0.4"/>',
  torseProfile:
    '<path d="M-5 -28 Q3 -31 7 -26 Q8.5 -10 6 4 L5 33 Q-1 37 -6 33 L-5 4 Q-7 -13 -5 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
    + '<path d="M3 -27 Q6 -10 4.6 4 L4 30" fill="none" stroke="@peauH" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M-5 -2 Q-7 -13 -5 -28 Q-3 -30 -1 -29 L-1 4 Z" fill="@peauO" opacity="0.5"/>',
  jambe: '<path d="M-4.5 0 Q-5 26 -3 50 L4 50 Q5 26 4.5 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>',
};
