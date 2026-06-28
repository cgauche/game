import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: 'dague_ballock',
  label: 'Dague ballock',
  type: 'melee',
  group: 'Base',
  target: 'dague courte a lame etroite, garde a DEUX LOBES arrondis a la base (ballock)',
  art: '<!-- Dague ballock : repere os arme, poignee (0,0), lame courte/etroite vers -y --><!-- pommeau plat --><ellipse cx="0" cy="10.6" rx="2.7" ry="1.9" fill="@metalO" stroke="@metalO" stroke-width="0.4"/><!-- poignee qui s evase vers les lobes --><path d="M-1.7 0 L1.7 0 L2.5 9.4 L-2.5 9.4 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/><line x1="-2" y1="3" x2="2" y2="3" stroke="@cuirO" stroke-width="0.4" opacity="0.7"/><line x1="-2.2" y1="6" x2="2.2" y2="6" stroke="@cuirO" stroke-width="0.4" opacity="0.7"/><!-- DEUX LOBES arrondis (signature ballock) a la base de la poignee --><circle cx="-3" cy="-0.4" r="2.9" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/><circle cx="3" cy="-0.4" r="2.9" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/><ellipse cx="-3.7" cy="-1.4" rx="1" ry="1.4" fill="@cuirH" opacity="0.55"/><ellipse cx="2.3" cy="-1.4" rx="1" ry="1.4" fill="@cuirH" opacity="0.55"/><!-- ferrule entre lobes et lame --><rect x="-1.5" y="-4.5" width="3" height="2.6" rx="0.6" fill="@metalO"/><!-- LAME courte, etroite, effilee a la pointe --><path d="M-1.3 -3.5 L1.3 -3.5 L0.95 -27 L0 -31 L-0.95 -27 Z" fill="@metal" stroke="@metalO" stroke-width="0.4"/><line x1="0" y1="-5.5" x2="0" y2="-29" stroke="@metalH" stroke-width="0.5" opacity="0.75"/>',
  palette: { metalO: '#2a3038', metalH: '#cfd8e6', metal: '#9aa6b8', cuir: '#6a4a26', cuirO: '#33241a', cuirH: '#9a7440' },
};
