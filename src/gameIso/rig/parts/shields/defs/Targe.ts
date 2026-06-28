import type { ShieldDef } from '../types';

// Petite targe ronde bombée à umbo — acier poli (buckler tenu au poing).
export const shield: ShieldDef = {
  slug: 'targe',
  label: 'Bouclier (Targe)',
  target: 'petite targe ronde bombée à umbo, acier',
  art: `<circle cx="0" cy="6" r="9.5" fill="url(#g_steel)" stroke="#3a2a18" stroke-width="1.4"/><circle cx="0" cy="6" r="9.5" fill="none" stroke="#cfd8e6" stroke-width="0.5" opacity="0.7"/><circle cx="0" cy="6" r="3.2" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`,
};
