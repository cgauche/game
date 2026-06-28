import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "gourdin",
  label: "Gourdin",
  type: "melee",
  group: "Base",
  target: "gourdin/trique de bois simple",
  art: "<path d=\"M-2.4 6 L-2.9 -22 Q-6.5 -24 -7 -31 Q-7.2 -38 -3 -40 Q0 -41 3 -40 Q7.2 -38 7 -31 Q6.5 -24 2.9 -22 L2.4 6 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.7\"/><path d=\"M-2.4 6 L-2.9 -22 Q-5 -23 -4.6 -31 Q-4.8 -38 -2 -39.6 L-2 6 Z\" fill=\"@cuirH\" opacity=\"0.55\"/><ellipse cx=\"-2.2\" cy=\"-32\" rx=\"1.4\" ry=\"2.4\" fill=\"@cuir\"/><ellipse cx=\"2.6\" cy=\"-27\" rx=\"1.2\" ry=\"2\" fill=\"@cuir\"/><path d=\"M-3 -16 q3 -1 6 0 M-3 -8 q3 -1 6 0 M-2.8 0 q3 -1 5.6 0\" stroke=\"@cuir\" stroke-width=\"0.6\" fill=\"none\" opacity=\"0.7\"/><rect x=\"-3\" y=\"-2\" width=\"6\" height=\"8\" rx=\"1.4\" fill=\"@cuir\"/><path d=\"M-3 0 L3 1 M-3 2.4 L3 3.4 M-3 4.6 L3 5.6\" stroke=\"#2e2014\" stroke-width=\"0.7\"/>",
  palette: {"cuir":"#5a3d22","cuirO":"#3a2614","cuirH":"#7c5a36"},
};
