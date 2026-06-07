import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "lasso",
  label: "Lasso",
  type: "ranged",
  group: "Entraves",
  target: "grande boucle de corde ouverte (nœud coulant)",
  art: "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M0 -16 Q-19 -20 -16 -36 Q-12 -49 0 -49 Q12 -49 16 -36 Q19 -20 0 -16 Z\" stroke=\"@cuirO\" stroke-width=\"5.4\"/><path d=\"M0 -16 Q-19 -20 -16 -36 Q-12 -49 0 -49 Q12 -49 16 -36 Q19 -20 0 -16 Z\" stroke=\"@cuirH\" stroke-width=\"3.4\"/><path d=\"M0 -16 Q-19 -20 -16 -36 Q-12 -49 0 -49 Q12 -49 16 -36 Q19 -20 0 -16 Z\" stroke=\"@cuirH\" stroke-width=\"1.1\" stroke-dasharray=\"2.2 2.6\" opacity=\"0.85\"/></g><g fill=\"none\" stroke-linecap=\"round\"><rect x=\"-6.2\" y=\"-17\" width=\"12.4\" height=\"9\" rx=\"3.4\" stroke=\"#33240f\" stroke-width=\"5.2\"/><rect x=\"-6.2\" y=\"-17\" width=\"12.4\" height=\"9\" rx=\"3.4\" stroke=\"@cuir\" stroke-width=\"3.1\"/><path d=\"M-3.6 -16.4 L3.6 -8.6 M3.6 -16.4 L-3.6 -8.6\" stroke=\"#2e2113\" stroke-width=\"1\" opacity=\"0.6\"/></g><g fill=\"none\" stroke-linecap=\"round\"><path d=\"M0 -8 Q3 -2 -2 4 Q-7 9 -1 11\" stroke=\"@cuirO\" stroke-width=\"5.2\"/><path d=\"M0 -8 Q3 -2 -2 4 Q-7 9 -1 11\" stroke=\"@cuirH\" stroke-width=\"3.1\"/></g><g fill=\"none\" stroke-linecap=\"round\"><ellipse cx=\"1\" cy=\"7\" rx=\"7.5\" ry=\"4.4\" stroke=\"#33240f\" stroke-width=\"5\"/><ellipse cx=\"1\" cy=\"7\" rx=\"7.5\" ry=\"4.4\" stroke=\"@cuir\" stroke-width=\"3\"/><ellipse cx=\"1\" cy=\"7\" rx=\"7.5\" ry=\"4.4\" stroke=\"@cuirO\" stroke-width=\"0.8\" stroke-dasharray=\"2 2\" opacity=\"0.7\"/></g><ellipse cx=\"7.8\" cy=\"10\" rx=\"2.4\" ry=\"1.5\" fill=\"@cuir\"/>",
  palette: {"cuirO":"#3a2a17","cuirH":"#9a6f3c","cuir":"#7e5a2e"},
};
