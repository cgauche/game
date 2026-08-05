import type { QuadTailDef } from '../types';

export const quadTail: QuadTailDef = {
  key: 'leonine',
  label: 'Léonine (toupet)',
  art: {
    // queue de lion : fouet fin + GROS toupet terminal (tell de l'arrière félin)
    profile: `<path d="M0 0 Q13 7 17 18 Q19 28 14 33 Q16 24 10 15 Q3 8 0 5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M14 30 Q9 33 10 38 Q13 41 16 38 Q20 40 21 35 Q24 33 21 29 Q19 26 14 30 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>`,
    back: `<path d="M-2 0 Q-2 14 0 22 Q2 14 2 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><circle cx="0" cy="25" r="2.6" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`,
  },
};
