import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "fouet",
  label: "Fouet",
  type: "ranged",
  group: "Entraves",
  target: "manche court + longue lanière de cuir qui ondule",
  art: "<rect x=\"-1.6\" y=\"-3\" width=\"3.2\" height=\"11\" rx=\"1.3\" fill=\"@cuirO\"/><path d=\"M0 -3 q11 -5 7 -16 q-3 -8 -11 -5 q-6 2 -3 8\" stroke=\"@cuir\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\"/>",
  palette: {"cuirO":"#3a2a1a","cuir":"#6a4a2a"},
};
