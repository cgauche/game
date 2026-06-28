import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "masse",
  label: "Masse",
  type: "melee",
  group: "Base",
  target: "masse à une main, tête en étoile",
  art: `<rect x="-1.7" y="-26" width="3.4" height="32" rx="1.4" fill="#4a2f17"/><circle cx="0" cy="-28" r="6" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.5"/><path d="M0 -37 l2.6 3.5 -5.2 0 z M0 -19 l2.6 -3.5 -5.2 0 z M-9.5 -28 l3.5 2.6 0 -5.2 z M9.5 -28 l-3.5 2.6 0 -5.2 z" fill="#aab2bd" stroke="#2a3038" stroke-width="0.3"/>`,
};
