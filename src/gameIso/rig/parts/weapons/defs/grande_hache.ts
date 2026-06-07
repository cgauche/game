import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "grande_hache",
  label: "Grande hache",
  type: "melee",
  group: "Deux-mains",
  target: "grande hache à deux mains, fer large",
  art: "<rect x=\"-1.9\" y=\"-43\" width=\"3.8\" height=\"53\" rx=\"1.6\" fill=\"@cuirO\" stroke=\"#2c1b0e\" stroke-width=\"0.5\"/><rect x=\"-2.1\" y=\"4\" width=\"4.2\" height=\"4\" rx=\"1\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.4\"/><path d=\"M-1.4 -42 Q-7.5 -41 -6 -33 Q-2 -34 -1.4 -34 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\" opacity=\"0.95\"/><path d=\"M1.4 -45 L13 -45 Q14.5 -39 14 -33 L15 -19 Q9 -22 1.4 -23 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.7\"/><path d=\"M13 -45 Q14.5 -39 14 -33 L15 -19\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.8\" opacity=\"0.6\"/><path d=\"M3 -42 L3 -26\" stroke=\"@metalO\" stroke-width=\"0.5\" opacity=\"0.4\"/><rect x=\"-1.9\" y=\"-49\" width=\"3.8\" height=\"7\" rx=\"1.4\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/>",
  palette: {"metalO":"#2a3038","metalH":"#eef3f8","metal":"#a4acb9","cuirO":"#4a2f17","cuir":"#7a5a18","accent":"#caa64a"},
};
