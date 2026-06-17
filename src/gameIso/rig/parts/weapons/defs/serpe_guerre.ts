import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "serpe_guerre",
  label: "Serpe de guerre",
  type: "melee",
  group: "Armes d'hast",
  target: "hampe + lame de serpe recourbée vers l'intérieur",
  art: "<rect x=\"-1.7\" y=\"-30\" width=\"3.4\" height=\"40\" rx=\"1.4\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><rect x=\"-1.4\" y=\"-30\" width=\"0.9\" height=\"40\" fill=\"@cuir\"/><rect x=\"-2.6\" y=\"-42\" width=\"5.2\" height=\"14\" rx=\"1\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M0 -42 Q2 -55 -8 -56 Q-16 -56 -16 -47 Q-14 -52 -8 -51 Q-1 -50 -1.5 -42 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><path d=\"M-1 -50 Q-7 -51 -13.5 -47.5\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.65\"/><path d=\"M0 -55 L2.4 -44 L-2.4 -44 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><line x1=\"0\" y1=\"-54.5\" x2=\"0\" y2=\"-44.5\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.6\"/><rect x=\"-2.8\" y=\"-30.5\" width=\"5.6\" height=\"2.4\" rx=\"0.8\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.3\"/><rect x=\"-2.4\" y=\"8\" width=\"4.8\" height=\"2.8\" rx=\"1\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.3\"/>",
  palette: {"metalO":"#2a3038","metalH":"#eef2f6","metal":"#9aa6b8","cuir":"#6a4a2a","cuirO":"#3a2a18"},
};
