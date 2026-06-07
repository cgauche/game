import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "zweihander",
  label: "Zweihänder",
  type: "melee",
  group: "Deux-mains",
  target: "espadon géant, très longue lame, parierhaken (ergots)",
  art: "<circle cx=\"0\" cy=\"8\" r=\"3.2\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.6\"/><circle cx=\"0\" cy=\"8\" r=\"1.2\" fill=\"@accent\"/><rect x=\"-2.1\" y=\"-9\" width=\"4.2\" height=\"14\" rx=\"1.6\" fill=\"@cuirO\" stroke=\"#2a1c10\" stroke-width=\"0.4\"/><path d=\"M-2.1 -6 h4.2 M-2.1 -2 h4.2 M-2.1 2 h4.2\" stroke=\"@accent\" stroke-width=\"0.7\" opacity=\"0.6\"/><path d=\"M-13 -10 Q-5 -14 0 -11 Q5 -14 13 -10 Q5 -7 0 -9 Q-5 -7 -13 -10 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.7\"/><circle cx=\"-13\" cy=\"-10\" r=\"1.7\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/><circle cx=\"13\" cy=\"-10\" r=\"1.7\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/><circle cx=\"0\" cy=\"-10\" r=\"1.8\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.4\"/><rect x=\"-2.4\" y=\"-24\" width=\"4.8\" height=\"14\" rx=\"0.6\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.5\"/><path d=\"M-2.4 -20 h4.8 M-2.4 -16 h4.8\" stroke=\"@cuirO\" stroke-width=\"0.5\" opacity=\"0.7\"/><path d=\"M-2.4 -23 L-10 -25 L-11.5 -22 L-2.4 -20 Z\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M2.4 -23 L10 -25 L11.5 -22 L2.4 -20 Z\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M-2.9 -24 L2.9 -24 L2.6 -30 L3.0 -46 L0 -50 L-3.0 -46 L-2.6 -30 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><line x1=\"0\" y1=\"-26\" x2=\"0\" y2=\"-47\" stroke=\"@metalH\" stroke-width=\"0.8\" opacity=\"0.85\"/>",
  palette: {"metalO":"#2a3038","metalH":"#eef3fb","metal":"#9aa6b8","cuirO":"#3a2c1c","cuir":"#7a5a18","accent":"#caa64a"},
};
