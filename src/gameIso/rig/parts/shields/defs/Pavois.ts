import type { ShieldDef } from '../types';

// Pavois : grand mantelet rectangulaire de bois cerclé de métal, arête centrale verticale (signature),
// rivets le long du cadre. Couvre presque tout le corps (arbalétriers). Cf. AA p.92.
export const shield: ShieldDef = {
  slug: 'pavois',
  label: 'Pavois',
  target: 'grand mantelet rectangulaire de bois, arête centrale + cerclage métal',
  art: `<path d="M-12 -20 Q-12 -25 0 -25 Q12 -25 12 -20 L12 26 Q12 30 7 30 L-7 30 Q-12 30 -12 26 Z" fill="#6a4a2a" stroke="#3a2818" stroke-width="1.4"/><g stroke="#3a2818" stroke-width="0.5" opacity="0.5"><line x1="-6" y1="-22" x2="-6" y2="29"/><line x1="6" y1="-22" x2="6" y2="29"/></g><path d="M-12 -20 Q-12 -25 0 -25 Q12 -25 12 -20 L12 26 Q12 30 7 30 L-7 30 Q-12 30 -12 26 Z" fill="none" stroke="#8a96a8" stroke-width="2"/><rect x="-2.2" y="-24" width="4.4" height="53" rx="1.4" fill="#8a96a8" stroke="#2a3038" stroke-width="0.5"/><rect x="-0.7" y="-22" width="1.4" height="49" rx="0.7" fill="#dfe6ef" opacity="0.85"/><g fill="#dfe6ef" stroke="#2a3038" stroke-width="0.3"><circle cx="-10" cy="-15" r="0.9"/><circle cx="10" cy="-15" r="0.9"/><circle cx="-10" cy="6" r="0.9"/><circle cx="10" cy="6" r="0.9"/><circle cx="-10" cy="25" r="0.9"/><circle cx="10" cy="25" r="0.9"/></g>`,
};
