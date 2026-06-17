import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "hache_armes",
  label: "Hache d'armes",
  type: "melee",
  group: "Armes d'hast",
  target: "poleaxe : fer de hache + marteau-pic opposé + pointe sommitale",
  art: "<rect x=\"-1.9\" y=\"-43\" width=\"3.8\" height=\"53\" rx=\"1.6\" fill=\"@cuirO\" stroke=\"#2c1b0e\" stroke-width=\"0.5\"/><rect x=\"-2.1\" y=\"4\" width=\"4.2\" height=\"4\" rx=\"1\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.4\"/><rect x=\"-2.4\" y=\"-44\" width=\"4.8\" height=\"11\" rx=\"1\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-2.2 -43 L-12 -45 Q-14 -39 -13 -34 L-2.2 -34 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><path d=\"M-12 -45 Q-14 -39 -13 -34\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.7\" opacity=\"0.6\"/><path d=\"M2.2 -43 L9 -42 L11 -39 L9 -36 L2.2 -35 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><rect x=\"9\" y=\"-41.5\" width=\"2\" height=\"5\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M3 -42 L8 -39\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.55\"/><path d=\"M0 -55 L2.4 -45 L-2.4 -45 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><line x1=\"0\" y1=\"-54\" x2=\"0\" y2=\"-45.5\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.6\"/>",
  palette: {"metalO":"#2a3038","metalH":"#eef3f8","metal":"#a4acb9","cuirO":"#4a2f17","cuir":"#7a5a18","accent":"#caa64a"},
};
