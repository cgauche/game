import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "ahlspiess",
  label: "Ahlspiess",
  type: "melee",
  group: "Armes d'hast",
  target: "très longue pointe carrée + rondelle ronde près de la prise",
  art: "<rect x=\"-1.3\" y=\"-30\" width=\"2.6\" height=\"40\" rx=\"1.2\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.3\"/><rect x=\"-0.5\" y=\"-30\" width=\"0.7\" height=\"38\" fill=\"@cuirH\" opacity=\"0.6\"/><circle cx=\"0\" cy=\"-28\" r=\"4.6\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/><circle cx=\"0\" cy=\"-28\" r=\"3.4\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><circle cx=\"-1.1\" cy=\"-29\" r=\"1\" fill=\"@metalH\" opacity=\"0.7\"/><path d=\"M-1.1 -29 L1.1 -29 L1.5 -50 L0 -56 L-1.5 -50 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.45\"/><line x1=\"0\" y1=\"-30\" x2=\"0\" y2=\"-55\" stroke=\"@metalH\" stroke-width=\"0.6\" opacity=\"0.8\"/><path d=\"M0 -56 L1.5 -50 L0 -50 Z\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.3\"/><rect x=\"-2\" y=\"8\" width=\"4\" height=\"2.4\" rx=\"0.8\" fill=\"@cuirO\"/>",
  palette: {"metalO":"#2a3038","metal":"#676f80","metalH":"#9aa6b8","cuir":"#6a4a2a","cuirO":"#3a2a18","cuirH":"#8a6238"},
};
