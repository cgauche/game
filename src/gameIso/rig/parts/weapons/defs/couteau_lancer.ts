import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "couteau_lancer",
  label: "Couteau de lancer",
  type: "ranged",
  group: "Lancer",
  target: "couteau de jet fin et équilibré, sans garde",
  art: "<path d=\"M0 -2 L2.6 -22 L0 -34 L-2.6 -22 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><line x1=\"0\" y1=\"-3\" x2=\"0\" y2=\"-32\" stroke=\"@metalH\" stroke-width=\"0.6\" opacity=\"0.7\"/><rect x=\"-1.6\" y=\"-3\" width=\"3.2\" height=\"11\" rx=\"1\" fill=\"@cuirO\"/><rect x=\"-1.9\" y=\"-2\" width=\"3.8\" height=\"1.3\" rx=\"0.5\" fill=\"@cuir\"/><rect x=\"-1.9\" y=\"1\" width=\"3.8\" height=\"1.3\" rx=\"0.5\" fill=\"@cuir\"/><rect x=\"-1.9\" y=\"4\" width=\"3.8\" height=\"1.3\" rx=\"0.5\" fill=\"@cuir\"/><circle cx=\"0\" cy=\"7.4\" r=\"1.5\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.5\"/><circle cx=\"0\" cy=\"7.4\" r=\"0.6\" fill=\"@metalO\"/>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b8","cuirO":"#4a3320","cuir":"#6a5238"},
};
