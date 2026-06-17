import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "pertuisane",
  label: "Pertuisane/Fauchard",
  type: "melee",
  group: "Armes d'hast",
  target: "hampe + large fer foliacé + deux ailerons à la base",
  art: "<rect x=\"-1.8\" y=\"-30\" width=\"3.6\" height=\"40\" rx=\"1.5\" fill=\"@cuir\"/><rect x=\"-1.4\" y=\"-30\" width=\"0.9\" height=\"40\" fill=\"@cuir\"/><rect x=\"-2.3\" y=\"-38\" width=\"4.6\" height=\"10\" rx=\"1\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-2.3 -37 Q-9 -37 -10.5 -41 Q-8 -39.5 -2.3 -39.5 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M2.3 -37 Q9 -37 10.5 -41 Q8 -39.5 2.3 -39.5 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M0 -58 Q6 -49 4.5 -41 Q2.5 -38 0 -37.5 Q-2.5 -38 -4.5 -41 Q-6 -49 0 -58 Z\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.6\"/><line x1=\"0\" y1=\"-57\" x2=\"0\" y2=\"-38\" stroke=\"@metal\" stroke-width=\"0.7\" opacity=\"0.8\"/><path d=\"M0 -57 Q3.4 -49 2.6 -42\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.6\" opacity=\"0.85\"/><rect x=\"-2.7\" y=\"-30.5\" width=\"5.4\" height=\"2.4\" rx=\"0.8\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.3\"/>",
  palette: {"metalO":"#2a3038","metal":"#a4acb9","metalH":"#eef3f8","cuir":"#6a4a2a"},
};
