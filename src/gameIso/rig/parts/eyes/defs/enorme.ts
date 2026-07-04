import type { EyeDef } from '../types';

// Œil énorme (mutation LDB 19) : globe disproportionné qui ÉVINCE l'œil — veiné, injecté.
export const eye: EyeDef = {
  id: 'enorme',
  label: 'Œil énorme',
  catalogOrder: 7, // difformité posable en apparence pure (sans le trait Mutation)
  art:
    '<g data-mut="oeil-enorme"><ellipse rx="3.1" ry="2.5" fill="#e0d8b0" stroke="#3a2820" stroke-width="0.55"/>'
    + '<path d="M-2.6 -1.2 q1 0.7 1.5 1.4 M-2.4 1.5 q0.9 -0.5 1.4 -1 M2.6 -1.4 q-0.9 0.8 -1.4 1.4 M2.5 1.4 q-1 -0.4 -1.5 -1" stroke="#b03a2e" stroke-width="0.3" fill="none" opacity="0.8"/>'
    + '<circle r="1.5" fill="#7a1010"/><circle r="0.7" fill="#0a0808"/><circle cx="0.5" cy="-0.55" r="0.32" fill="#fff" opacity="0.6"/>'
    + '<path d="M-3 -1.9 Q0 -3 3 -1.9" stroke="@peauO" stroke-width="0.7" fill="none"/></g>',
};
