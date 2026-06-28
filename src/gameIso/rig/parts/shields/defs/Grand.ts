import type { ShieldDef } from '../types';

// Grand écu (kite / heater) en acier, pointe vers le bas, nervure en croix + umbo doré.
export const shield: ShieldDef = {
  slug: 'grand',
  label: 'Bouclier (Grand)',
  target: 'grand écu (kite/heater) acier, pointe vers le bas',
  art: `<path d="M-11 -10 Q0 -13 11 -10 L11 8 Q11 20 0 28 Q-11 20 -11 8 Z" fill="url(#g_steelD)" stroke="#3a2a18" stroke-width="1.6"/><path d="M0 -12 L0 27" stroke="#6a4a2a" stroke-width="1.1"/><path d="M-11 1 Q0 4 11 1" fill="none" stroke="#6a4a2a" stroke-width="1.1"/><circle cx="0" cy="3" r="2.4" fill="#caa64a" stroke="#7a5a18" stroke-width="0.5"/>`,
};
