import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "hache_arquebuse",
  label: "Hache-arquebuse",
  type: "ranged",
  group: "Poudre noire",
  target: "arquebuse + lame de hache montée à la bouche du canon",
  art: "<g stroke=\"#2a2018\" stroke-width=\"0.5\"><path d=\"M-3 -8 L4 -8 L4 6 Q3 11 -2 10 Q-7 9 -8 3 L-5 -3 Z\" fill=\"@cuirO\"/><path d=\"M-3 -8 L4 -8 L3.4 -16 L-2.4 -16 Z\" fill=\"@cuir\"/><rect x=\"-3\" y=\"-46\" width=\"5.4\" height=\"31\" rx=\"1.6\" fill=\"@cuir\"/><rect x=\"-2.6\" y=\"-50\" width=\"4.4\" height=\"44\" rx=\"1.8\" fill=\"@metal\"/><rect x=\"-1.7\" y=\"-50\" width=\"1.3\" height=\"44\" fill=\"@metalH\" opacity=\"0.75\" stroke=\"none\"/></g><g stroke=\"#1a1a20\" stroke-width=\"0.5\" stroke-linejoin=\"round\"><path d=\"M2 -50 Q11 -53 14 -62 Q15 -66 11 -65 Q6 -57 1.5 -57 Z\" fill=\"@metalH\"/><path d=\"M2 -50 Q9 -52 12 -59\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"0.7\" opacity=\"0.6\"/><rect x=\"-2.4\" y=\"-58\" width=\"4.8\" height=\"10\" rx=\"1\" fill=\"@metalO\"/></g><g stroke=\"#1a1a20\" stroke-width=\"0.4\"><rect x=\"3\" y=\"-15\" width=\"4.6\" height=\"3.4\" rx=\"0.6\" fill=\"@metalO\"/><path d=\"M5 -15 q6 -2 4.5 -8 q-1.3 -3.5 -4 -1.8\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"1.6\"/><path d=\"M-1 -4 q-1.4 4 1 5.4\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"1.3\"/></g><path d=\"M6 -22 q4.5 -1 3.3 -5.6\" fill=\"none\" stroke=\"@accent\" stroke-width=\"1.1\"/>",
  palette: {"metalH":"#aeb6c0","metalO":"#3a3a42","metal":"#676f80","cuirO":"#3a2a1a","cuir":"#5a3d24","accent":"#caa64a"},
};
