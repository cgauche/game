import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "demi_lance",
  label: "Demi-lance de cavalerie",
  type: "melee",
  group: "Cavalerie",
  target: "lance plus courte + garde-main conique (vamplate)",
  art: "<rect x=\"-1.8\" y=\"-34\" width=\"3.6\" height=\"44\" rx=\"1.6\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><rect x=\"-1.8\" y=\"-34\" width=\"1.4\" height=\"44\" fill=\"@cuir\" opacity=\"0.6\"/><path d=\"M-1.8 -4 Q-8 -4 -8 -12 Q-8 -16 -1.8 -16 L1.8 -16 Q8 -16 8 -12 Q8 -4 1.8 -4 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><path d=\"M-1.8 -16 L1.8 -16 Q6 -16 6.4 -12\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.6\" opacity=\"0.65\"/><path d=\"M0 -50 L3.4 -42 L1.4 -41 L1.4 -44 L-1.4 -44 L-1.4 -41 L-3.4 -42 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><line x1=\"0\" y1=\"-50\" x2=\"0\" y2=\"-42\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.7\"/>",
  palette: {"metalO":"#2a3038","metalH":"#eef2f6","metal":"#9aa6b8","cuir":"#6a4a2a","cuirO":"#3a2814"},
};
