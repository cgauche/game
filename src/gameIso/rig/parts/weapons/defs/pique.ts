import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "pique",
  label: "Pique",
  type: "melee",
  group: "Armes d'hast",
  target: "hampe TRÈS longue, petite pointe d'infanterie",
  art: "<rect x=\"-1.3\" y=\"-46\" width=\"2.6\" height=\"56\" rx=\"1.2\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.3\"/><rect x=\"-0.5\" y=\"-46\" width=\"0.7\" height=\"54\" fill=\"@cuirH\" opacity=\"0.6\"/><path d=\"M-1.3 -45 L-2.2 -47 L0 -50 L2.2 -47 L1.3 -45 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-1.6 -44.5 L1.6 -44.5 L1.2 -46 L-1.2 -46 Z\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.3\"/><rect x=\"-2\" y=\"8\" width=\"4\" height=\"2.4\" rx=\"0.8\" fill=\"@cuirO\"/>",
  palette: {"metalO":"#2a3038","metal":"#676f80","metalH":"#9aa6b8","cuir":"#6a4a2a","cuirO":"#3a2a18","cuirH":"#8a6238"},
};
