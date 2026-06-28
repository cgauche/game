import type { MonsterPartDef } from '../types';

// Patte arrière DIGITIGRADE de LION (fauve) — repère de l'os `cuisse` (origine = hanche, +y descend),
// même convention que `chevre.ts` : la part couvre cuisse + jarret + PATTE jusqu'au sol. Le sabot de
// la chèvre est remplacé par un COUSSINET griffu (pelote + griffes sombres). Peinte en @peau (fauve
// tawny du Prédateur sanglant) → s'accorde au corps. Auto-injectée dans LEGS via gen.
export const part: MonsterPartDef = {
  slot: 'jambe',
  key: 'fauve',
  label: 'Pattes de lion (fauve)',
  order: 2,
  art: `<g>
  <path d="M-5 0 Q-7 13 -4 26 L4 26 Q7 13 5 0 Z" fill="@peau"/>
  <path d="M-3.4 5 q1 10 0.4 18 M3 6 q-1 9 -0.4 17 M0 4 q0 11 0 19" stroke="@peauO" stroke-width="0.7" fill="none" opacity="0.45"/>
  <path d="M-3 26 Q-3.6 36 -3.2 44 L3.2 44 Q3.6 36 3 26 Z" fill="@peauO"/>
  <path d="M-4.2 42.5 Q-4.8 50 0 51 Q4.8 50 4.2 42.5 Q0 47 -4.2 42.5 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-3.4 49 l-0.7 4.2 l1.1 -1 Z" fill="#241a12"/>
  <path d="M-1.1 50.6 l-0.4 4.4 l1 -1 Z" fill="#241a12"/>
  <path d="M1.1 50.6 l0.4 4.4 l-1 -1 Z" fill="#241a12"/>
  <path d="M3.4 49 l0.7 4.2 l-1.1 -1 Z" fill="#241a12"/>
</g>`,
};
