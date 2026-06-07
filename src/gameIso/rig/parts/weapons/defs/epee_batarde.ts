import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "epee_batarde",
  label: "Épée bâtarde",
  type: "melee",
  group: "Deux-mains",
  target: "épée longue à une main et demie, longue poignée",
  art: "<rect x=\"-2.3\" y=\"-2.2\" width=\"4.6\" height=\"13\" rx=\"2\" fill=\"@cuirO\"/><rect x=\"-2.3\" y=\"-2.2\" width=\"4.6\" height=\"13\" rx=\"2\" fill=\"none\" stroke=\"@cuir\" stroke-width=\"0.5\"/><path d=\"M-2.3 0 q4.6 1.4 0 2.8 M-2.3 3.2 q4.6 1.4 0 2.8 M-2.3 6.4 q4.6 1.4 0 2.8\" stroke=\"@cuir\" stroke-width=\"0.8\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"0\" cy=\"13\" r=\"3.4\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.6\"/><circle cx=\"-1\" cy=\"12\" r=\"1\" fill=\"@metalH\" opacity=\"0.7\"/><path d=\"M-11 -3.4 Q-12.2 -4.4 -10.6 -4.6 L10.6 -4.6 Q12.2 -4.4 11 -3.4 L7.5 -1.6 Q0 -0.2 -7.5 -1.6 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><circle cx=\"-10.4\" cy=\"-3.7\" r=\"1.5\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.4\"/><circle cx=\"10.4\" cy=\"-3.7\" r=\"1.5\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.4\"/><path d=\"M-2.7 -4.6 L2.7 -4.6 L2.4 -42 L0 -49 L-2.4 -42 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><line x1=\"0\" y1=\"-7\" x2=\"0\" y2=\"-44\" stroke=\"@metalH\" stroke-width=\"0.7\" opacity=\"0.75\"/><line x1=\"-1.3\" y1=\"-7\" x2=\"-1.1\" y2=\"-41\" stroke=\"@metal\" stroke-width=\"0.4\" opacity=\"0.45\"/>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b4","cuirO":"#3a2814","cuir":"#7a5a18","accent":"#caa64a"},
};
