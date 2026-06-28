import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: 'massue',
  label: 'Massue',
  type: 'melee',
  group: 'Base',
  target: 'massue : manche droit + TETE ronde bulbeuse cloutee de fer au bout (≠ trique brute)',
  art: '<!-- Massue : repere os arme, poignee (0,0), tete ronde au bout -y --><!-- prise gainee de cuir --><rect x="-2.1" y="0" width="4.2" height="7" rx="1.3" fill="@cuirO" stroke="#2a1a0c" stroke-width="0.4"/><line x1="-2.1" y1="2" x2="2.1" y2="2.6" stroke="@cuirH" stroke-width="0.5" opacity="0.7"/><line x1="-2.1" y1="4.4" x2="2.1" y2="5" stroke="@cuirH" stroke-width="0.5" opacity="0.7"/><!-- manche droit de bois --><rect x="-2" y="-21" width="4" height="29" rx="1.6" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/><rect x="-0.7" y="-20" width="1.2" height="27" fill="@cuirH" opacity="0.5"/><!-- frette de fer au collet --><rect x="-3.1" y="-25" width="6.2" height="4.2" rx="1" fill="@metalO" stroke="@metalO" stroke-width="0.4"/><rect x="-3.1" y="-24.4" width="6.2" height="1.1" rx="0.5" fill="@metalH" opacity="0.7"/><!-- TETE ronde bulbeuse de bois --><ellipse cx="0" cy="-33" rx="8.6" ry="11" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/><ellipse cx="-2.6" cy="-36.5" rx="3" ry="5" fill="@cuirH" opacity="0.5"/><!-- clous de fer (tete d arme deliberee, ≠ gourdin) --><g fill="@metal" stroke="@metalO" stroke-width="0.3"><circle cx="0" cy="-41.5" r="1.5"/><circle cx="-5.6" cy="-37.5" r="1.4"/><circle cx="5.6" cy="-37.5" r="1.4"/><circle cx="0" cy="-33" r="1.6"/><circle cx="-6.4" cy="-30" r="1.4"/><circle cx="6.4" cy="-30" r="1.4"/><circle cx="0" cy="-25.5" r="1.4"/></g><g fill="@metalH" opacity="0.7"><circle cx="-0.4" cy="-42" r="0.5"/><circle cx="-0.4" cy="-33.5" r="0.5"/><circle cx="-6" cy="-38" r="0.5"/><circle cx="5.2" cy="-38" r="0.5"/></g>',
  palette: { cuir: '#6a4626', cuirO: '#3f2a16', cuirH: '#8c6238', metalO: '#2a3038', metal: '#8a96a8', metalH: '#dfe6ef' },
};
