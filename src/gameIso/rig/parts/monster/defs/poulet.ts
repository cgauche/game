import type { MonsterPartDef } from '../types';

// Tête de POULET (basse-cour du Carnaval, Compagnon T1 ch.12 — « l'élément comique de la
// ménagerie », crachat venimeux) : bec corné, crête rouge dentelée ANCRÉE au crâne,
// barbillons sous le bec, œil rond fixe de volaille.
const EYE = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="1.8" fill="#e8b820"/><circle cx="${x}" cy="${y}" r="0.85" fill="#160a04"/>`;
export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'poulet',
  label: 'Poulet (basse-cour)',
  order: 11,
  art: {
    front: `<g>
  <path d="M0 -8.5 L-2.6 -11 L-0.9 -11.4 L-2 -14 L0 -12.6 L2 -14 L0.9 -11.4 L2.6 -11 Z" fill="#c23028" stroke="#7a1812" stroke-width="0.5"/>
  <path d="M-6.5 0 Q-7.5 -8 0 -9 Q7.5 -8 6.5 0 Q6 7 3.5 10 L2 14 Q0 16 -2 14 L-3.5 10 Q-6 7 -6.5 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  ${EYE(-3, 1)}${EYE(3, 1)}
  <path d="M-1.8 7 L1.8 7 L0 12.4 Z" fill="#d8b14a" stroke="#8a6a1e" stroke-width="0.5"/>
  <path d="M-1.2 12.6 Q-2 15.6 -0.4 17 Q0.6 15 0.2 12.8 Z" fill="#c23028" stroke="#7a1812" stroke-width="0.4"/>
</g>`,
    back: `<g>
  <path d="M0 -8.5 L-2.6 -11 L-0.9 -11.4 L-2 -14 L0 -12.6 L2 -14 L0.9 -11.4 L2.6 -11 Z" fill="#c23028" stroke="#7a1812" stroke-width="0.5"/>
  <path d="M-6.5 0 Q-7.5 -8 0 -9 Q7.5 -8 6.5 0 Q6 7 3.5 10 L2 14 Q0 16 -2 14 L-3.5 10 Q-6 7 -6.5 0 Z" fill="@peauO"/>
  <path d="M0 -8 L0 13" stroke="@peau" stroke-width="0.5" opacity="0.4"/>
</g>`,
    profile: `<g>
  <path d="M-1 -8.2 L-3 -10.6 L-1.4 -11 L-2.2 -13.6 L-0.2 -12.2 L1.6 -13.8 L0.9 -11.2 L2.6 -10.8 Z" fill="#c23028" stroke="#7a1812" stroke-width="0.5"/>
  <path d="M-6 0 Q-7 -8 1 -9 Q7.5 -7.5 7.5 0 Q7.5 5 5.5 8 L3 12 Q0 14 -2 12 L-3 8 Q-5.5 6 -6 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  ${EYE(2.4, 0)}
  <path d="M6.5 4 L13.5 6.2 L6.5 8.6 Z" fill="#d8b14a" stroke="#8a6a1e" stroke-width="0.5"/>
  <path d="M9.5 6.4 L6.8 6.4" stroke="#8a6a1e" stroke-width="0.4"/>
  <path d="M5 9 Q4.6 12.4 6 13.8 Q7 11.6 6.4 9.2 Z" fill="#c23028" stroke="#7a1812" stroke-width="0.4"/>
</g>`,
  },
};
