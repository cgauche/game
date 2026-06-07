import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "hache_lancer",
  label: "Hache de lancer",
  type: "ranged",
  group: "Lancer",
  target: "hachette de jet (francisque), manche court",
  art: "<rect x=\"-1.7\" y=\"-21\" width=\"3.4\" height=\"29\" rx=\"1.5\" fill=\"@cuir\" stroke=\"#33220f\" stroke-width=\"0.5\"/><rect x=\"-2\" y=\"-2\" width=\"4\" height=\"8\" rx=\"1.2\" fill=\"@cuirO\" stroke=\"#241608\" stroke-width=\"0.4\"/><rect x=\"-2.4\" y=\"6\" width=\"4.8\" height=\"2.6\" rx=\"1\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.4\"/><path d=\"M-1 -23 L1.5 -23 L3 -25 Q12 -24 14 -13 Q13.5 -4 1.5 -6 L0 -8 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><path d=\"M3 -25 Q12 -24 14 -13 Q13.5 -4 1.5 -6\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"1.1\" opacity=\"0.9\"/><path d=\"M-1 -22 Q-7 -22 -8 -16 Q-8 -12 -1 -12 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><circle cx=\"0\" cy=\"-17\" r=\"1.6\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/>",
  palette: {"metalO":"#2a3038","metalH":"#eef3f8","metal":"#a4acb9","cuir":"#5a3a1e","cuirO":"#3a2614","accent":"#caa64a"},
};
