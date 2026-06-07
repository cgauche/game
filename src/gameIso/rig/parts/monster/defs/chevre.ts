import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'jambe',
  key: 'chevre',
  label: "Pattes de chèvre",
  order: 1,
  art: `<g>
  <path d="M-4 0 Q-6 16 -3 26 L3 26 Q6 16 4 0 Z" fill="@peau"/>
  <path d="M-3 6 l1 14 M2 6 l-1 14" stroke="@peauO" stroke-width="0.8" opacity="0.5"/>
  <path d="M-2.4 26 L-3.2 44 L3.2 44 L2.4 26 Z" fill="@peauO"/>
  <path d="M-4 44 L4 44 L5 51 L0 49 L-5 51 Z" fill="@cuir"/>
  <line x1="0" y1="45" x2="0" y2="50" stroke="#0e0805" stroke-width="1"/>
</g>`,
};
