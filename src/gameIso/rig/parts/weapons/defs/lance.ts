import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "lance",
  label: "Lance",
  type: "melee",
  group: "Armes d'hast",
  target: "hampe + fer de lance foliacé",
  art: "<rect x=\"-1.7\" y=\"-30\" width=\"3.4\" height=\"40\" rx=\"1.6\" fill=\"@cuirH\" stroke=\"@cuir\" stroke-width=\"0.4\"/><rect x=\"-1.7\" y=\"-2\" width=\"3.4\" height=\"1.6\" fill=\"@cuir\"/><path d=\"M0 9 q3.2 0 3.2 -3 l-6.4 0 q0 3 3.2 3 z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-3 -27 L3 -27 L3.2 -31 L-3.2 -31 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M0 -50 Q6 -42 5 -34 Q3 -31 0 -30.5 Q-3 -31 -5 -34 Q-6 -42 0 -50 Z\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.6\"/><path d=\"M0 -49 L0 -31\" stroke=\"@metal\" stroke-width=\"0.7\" opacity=\"0.8\"/><path d=\"M0 -49 Q3.4 -42 2.6 -35\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.6\" opacity=\"0.85\"/>",
  palette: {"metalO":"#2a3038","metal":"#5a6376","metalH":"#eef2f8","cuirH":"#6a4a2a","cuir":"#3a2a18"},
};
