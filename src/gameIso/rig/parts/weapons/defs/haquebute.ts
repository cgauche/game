import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "haquebute",
  label: "Haquebute",
  type: "ranged",
  group: "Poudre noire",
  target: "arquebuse lourde à canon long + crochet d'appui sous le canon",
  art: "<g stroke=\"#2a2018\" stroke-width=\"0.5\"><path d=\"M-3 -8 L4 -8 L4 6 Q3 11 -2 10 Q-7 9 -8 3 L-5 -3 Z\" fill=\"@cuirO\"/><path d=\"M-3 -8 L4 -8 L3.4 -16 L-2.4 -16 Z\" fill=\"@cuir\"/><rect x=\"-3.4\" y=\"-50\" width=\"6.2\" height=\"35\" rx=\"1.6\" fill=\"@cuir\"/><rect x=\"-3.2\" y=\"-58\" width=\"5.8\" height=\"50\" rx=\"2\" fill=\"@metal\"/><rect x=\"-2.2\" y=\"-58\" width=\"1.6\" height=\"50\" fill=\"@metalH\" opacity=\"0.75\" stroke=\"none\"/><ellipse cx=\"-0.3\" cy=\"-58\" rx=\"3\" ry=\"1.7\" fill=\"#1a1a20\"/></g><g stroke=\"#1a1a20\" stroke-width=\"0.5\" stroke-linejoin=\"round\"><path d=\"M-3.2 -34 L-9 -34 L-9 -29 L-5 -29 L-5 -32 L-3.2 -32 Z\" fill=\"@metalO\"/><path d=\"M-3.2 -34 L-9 -34\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.6\" opacity=\"0.5\"/></g><g stroke=\"#1a1a20\" stroke-width=\"0.4\"><rect x=\"3.2\" y=\"-17\" width=\"4.6\" height=\"3.4\" rx=\"0.6\" fill=\"@metalO\"/><path d=\"M5.2 -17 q6 -2 4.5 -8 q-1.3 -3.5 -4 -1.8\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"1.6\"/><path d=\"M-1 -4 q-1.4 4 1 5.4\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"1.3\"/></g><path d=\"M6.2 -24 q4.5 -1 3.3 -5.6\" fill=\"none\" stroke=\"@accent\" stroke-width=\"1.1\"/>",
  palette: {"metalH":"#aeb6c0","metalO":"#3a3a42","metal":"#676f80","cuirO":"#3a2a1a","cuir":"#5a3d24","accent":"#caa64a"},
};
