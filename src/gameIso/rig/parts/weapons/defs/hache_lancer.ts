import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "hache_lancer",
  label: "Hache de lancer",
  type: "ranged",
  group: "Lancer",
  target: "hachette de jet (francisque), manche court",
  art: "<rect x=\"-1.8\" y=\"-19\" width=\"3.6\" height=\"27\" rx=\"1.5\" fill=\"@cuir\" stroke=\"#33220f\" stroke-width=\"0.5\"/><path d=\"M-1.8 -7 L1.8 -7 M-1.8 -1 L1.8 -1 M-1.8 5 L1.8 5\" stroke=\"#33220f\" stroke-width=\"0.6\" opacity=\"0.6\"/><rect x=\"-2.4\" y=\"6\" width=\"4.8\" height=\"3\" rx=\"1\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.4\"/><rect x=\"-3\" y=\"-23\" width=\"6\" height=\"7\" rx=\"1.4\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.6\"/><path d=\"M2.6 -24 L7 -27 L13.5 -24 L15 -16 L13 -7 L6 -4 L2.6 -5 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.7\"/><path d=\"M15 -16 L13 -7\" stroke=\"@metalH\" stroke-width=\"1.4\" stroke-linecap=\"round\"/><path d=\"M7 -27 L13.5 -24 L15 -16\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.8\" opacity=\"0.55\"/><path d=\"M-2.6 -23 L-7.5 -22 L-9 -16 L-6 -13 L-2.6 -14 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.55\"/><path d=\"M-9 -16 L-6 -13\" stroke=\"@metalH\" stroke-width=\"0.9\" stroke-linecap=\"round\" opacity=\"0.8\"/><circle cx=\"0\" cy=\"-19.5\" r=\"1.5\" fill=\"@metalO\" stroke=\"#1a1e24\" stroke-width=\"0.3\"/>",
  palette: {"metalO":"#2a3038","metalH":"#eef3f8","metal":"#a4acb9","cuir":"#5a3a1e","accent":"#caa64a"},
};
