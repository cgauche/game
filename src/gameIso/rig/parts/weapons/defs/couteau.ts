import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "couteau",
  label: "Couteau",
  type: "melee",
  group: "Base",
  target: "couteau à lame courte, rustique, sans vraie garde",
  art: "<path d=\"M-1.7 6 L1.7 6 L1.9 -1 L-1.9 -1 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><rect x=\"-2.1\" y=\"4\" width=\"4.2\" height=\"1.4\" rx=\"0.6\" fill=\"@cuirO\"/><rect x=\"-2.1\" y=\"1.2\" width=\"4.2\" height=\"1.4\" rx=\"0.6\" fill=\"@cuirO\"/><ellipse cx=\"0\" cy=\"-1.6\" rx=\"2.4\" ry=\"1.2\" fill=\"@cuirH\"/><path d=\"M-1.9 -2 L1.9 -2 L1.9 -15 Q1.7 -19 -0.4 -20 Q-1.9 -16 -1.9 -11 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-0.7 -3 L-0.6 -17\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.55\"/>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b8","cuir":"#5a3f24","cuirO":"#3a2a1a","cuirH":"#7a6450"},
};
