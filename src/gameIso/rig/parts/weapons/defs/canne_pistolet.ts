import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "canne_pistolet",
  label: "Canne-pistolet",
  type: "ranged",
  group: "Poudre noire",
  target: "canne de marche dissimulant un pistolet : long tube fin droit + pommeau rond",
  art: "<path d=\"M-2.6 -2 Q-4 6 -4 14 Q-4 21 -2 24 Q-6 24 -6.5 17 Q-7 7 -5 -2 Z\" fill=\"@cuir\" stroke=\"#221610\" stroke-width=\"0.5\"/><circle cx=\"-2\" cy=\"23.5\" r=\"3.2\" fill=\"@cuirH\" stroke=\"#221610\" stroke-width=\"0.6\"/><circle cx=\"-3\" cy=\"22.5\" r=\"1\" fill=\"@accent\" stroke=\"none\" opacity=\"0.7\"/><rect x=\"-1.6\" y=\"-2\" width=\"3.4\" height=\"6\" rx=\"0.6\" fill=\"@metalO\" stroke=\"#221610\" stroke-width=\"0.4\"/><rect x=\"-1.4\" y=\"-50\" width=\"3\" height=\"48\" rx=\"1.4\" fill=\"@metalH\" stroke=\"#2a2018\" stroke-width=\"0.5\"/><line x1=\"-0.6\" y1=\"-49\" x2=\"-0.6\" y2=\"-3\" stroke=\"@metalH\" stroke-width=\"0.6\" opacity=\"0.55\"/><rect x=\"-1.8\" y=\"-22\" width=\"3.8\" height=\"2.4\" rx=\"0.5\" fill=\"@accent\" stroke=\"none\"/><circle cx=\"0.1\" cy=\"-50\" r=\"1.6\" fill=\"#15151b\" stroke=\"@metalO\" stroke-width=\"0.4\"/>",
  palette: {"metalH":"#cfd6e0","metalO":"#2a2a32","metal":"#34343e","cuir":"#3a2a1a","cuirH":"#5a3d24","accent":"#caa64a"},
};
