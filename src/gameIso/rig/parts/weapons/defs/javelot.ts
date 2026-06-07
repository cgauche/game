import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "javelot",
  label: "Javelot",
  type: "ranged",
  group: "Lancer",
  target: "javelot : lance légère et fine de jet",
  art: "<rect x=\"-1\" y=\"-38\" width=\"2\" height=\"48\" rx=\"1\" fill=\"@cuir\"/><rect x=\"-1\" y=\"-38\" width=\"1\" height=\"48\" fill=\"@cuir\" opacity=\"0.6\"/><path d=\"M0 -50 L3.2 -41 L1.4 -36 L0 -35 L-1.4 -36 L-3.2 -41 Z\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.5\"/><line x1=\"0\" y1=\"-49\" x2=\"0\" y2=\"-37\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.7\"/><g stroke=\"@accent\" stroke-width=\"1.4\"><line x1=\"-1.4\" y1=\"-3\" x2=\"1.4\" y2=\"-1\"/><line x1=\"-1.4\" y1=\"0\" x2=\"1.4\" y2=\"2\"/><line x1=\"-1.4\" y1=\"3\" x2=\"1.4\" y2=\"5\"/></g><path d=\"M0 10 L1.6 6 L-1.6 6 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#8a929c","cuir":"#6a4a2a","accent":"#caa64a"},
};
