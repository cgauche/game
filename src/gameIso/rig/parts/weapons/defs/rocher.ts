import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "rocher",
  label: "Rocher",
  type: "ranged",
  group: "Lancer",
  target: "grosse pierre / rocher irrégulier à jeter",
  art: "<g stroke=\"#2b2520\" stroke-width=\"1.2\" stroke-linejoin=\"round\"><path d=\"M-16 -8 L-17 -19 L-12 -28 L-2 -33 L5 -34 L13 -30 L17 -21 L16 -10 L11 -2 L1 3 L-9 2 Z\" fill=\"@metalH\"/></g><path d=\"M-12 -28 L-2 -33 L5 -34 L13 -30 L4 -24 L-6 -22 Z\" fill=\"@metalH\" stroke=\"none\"/><path d=\"M-6 -22 L4 -24 L8 -14 L-3 -11 L-13 -16 L-12 -28 Z\" fill=\"@metal\" stroke=\"none\"/><path d=\"M4 -24 L13 -30 L17 -21 L16 -10 L8 -14 Z\" fill=\"@metal\" stroke=\"none\"/><path d=\"M-13 -16 L-3 -11 L1 3 L-9 2 L-16 -8 L-17 -19 Z\" fill=\"@metalO\" stroke=\"none\"/><path d=\"M-3 -11 L8 -14 L16 -10 L11 -2 L1 3 Z\" fill=\"@metal\" stroke=\"none\"/><path d=\"M-6 -22 L-13 -16 M-3 -11 L1 3 M8 -14 L11 -2 M4 -24 L8 -14\" stroke=\"#2b2520\" stroke-width=\"0.9\" fill=\"none\" opacity=\"0.85\"/><path d=\"M-9 -27 L-3 -30 L1 -27\" stroke=\"@metalH\" stroke-width=\"0.9\" fill=\"none\" opacity=\"0.6\"/><path d=\"M11 -22 L6 -18\" stroke=\"@metalO\" stroke-width=\"0.7\" fill=\"none\" opacity=\"0.7\"/><path d=\"M-11 -12 L-5 -7\" stroke=\"@metalO\" stroke-width=\"0.7\" fill=\"none\" opacity=\"0.6\"/>",
  palette: {"metalH":"#9c917e","metal":"#73685a","metalO":"#3c352f"},
};
