import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "arquebuse_double",
  label: "Arquebuse à double canon",
  type: "ranged",
  group: "Poudre noire",
  target: "arquebuse à deux canons parallèles côte à côte + crosse en bois",
  art: "<g stroke=\"#2a2018\" stroke-width=\"0.5\"><path d=\"M-3 -8 L4 -8 L4 6 Q3 11 -2 10 Q-7 9 -8 3 L-5 -3 Z\" fill=\"@cuirO\"/><path d=\"M-3 -8 L4 -8 L3.4 -16 L-2.4 -16 Z\" fill=\"@cuir\"/><rect x=\"-4.4\" y=\"-46\" width=\"8.2\" height=\"31\" rx=\"1.6\" fill=\"@cuir\"/><rect x=\"-4.4\" y=\"-50\" width=\"3.7\" height=\"44\" rx=\"1.6\" fill=\"@metal\"/><rect x=\"0.6\" y=\"-50\" width=\"3.7\" height=\"44\" rx=\"1.6\" fill=\"@metal\"/><rect x=\"-3.8\" y=\"-50\" width=\"1.1\" height=\"44\" fill=\"@metalH\" opacity=\"0.75\" stroke=\"none\"/><rect x=\"1.2\" y=\"-50\" width=\"1.1\" height=\"44\" fill=\"@metalH\" opacity=\"0.75\" stroke=\"none\"/><ellipse cx=\"-2.6\" cy=\"-50\" rx=\"2\" ry=\"1.4\" fill=\"#1a1a20\"/><ellipse cx=\"2.4\" cy=\"-50\" rx=\"2\" ry=\"1.4\" fill=\"#1a1a20\"/></g><g stroke=\"#1a1a20\" stroke-width=\"0.4\"><rect x=\"3.8\" y=\"-15\" width=\"4.6\" height=\"3.4\" rx=\"0.6\" fill=\"@metalO\"/><path d=\"M6 -15 q6 -2 4.5 -8 q-1.3 -3.5 -4 -1.8\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"1.6\"/><path d=\"M-1 -4 q-1.4 4 1 5.4\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"1.3\"/></g><path d=\"M7 -22 q4.5 -1 3.3 -5.6\" fill=\"none\" stroke=\"@accent\" stroke-width=\"1.1\"/>",
  palette: {"metalH":"#aeb6c0","metalO":"#3a3a42","metal":"#676f80","cuirO":"#3a2a1a","cuir":"#5a3d24","accent":"#caa64a"},
};
