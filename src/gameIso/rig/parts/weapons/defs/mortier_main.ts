import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "mortier_main",
  label: "Mortier à main",
  type: "ranged",
  group: "Poudre noire",
  target: "mortier de poing trapu : corps très court + gueule énorme et très évasée",
  art: "<g stroke=\"#241a10\" stroke-width=\"0.6\" stroke-linejoin=\"round\"><path d=\"M-6 11 Q-10 11 -9.5 5 Q-8.8 -1 -4 -3 L2 -3 L3 1 L1 9 Q0 12 -6 11 Z\" fill=\"@cuirO\"/><path d=\"M-7.6 4 Q-3.5 1 1 -1.4\" fill=\"none\" stroke=\"@cuir\" stroke-width=\"0.9\"/><path d=\"M-3.4 -3 L3.4 -3 L2.6 -9 L-2.6 -9 Z\" fill=\"@cuir\"/><path d=\"M2.6 -4 L6.4 -4 L6.8 2 L2.6 2.5 Z\" fill=\"@metal\"/><path d=\"M6 -4 Q10.5 -7 8 -11 Q12 -8 9 -1 Z\" fill=\"@metalO\" stroke=\"#15151a\"/><circle cx=\"5.8\" cy=\"-4\" r=\"1.5\" fill=\"@accent\" stroke=\"none\"/><path d=\"M-1 1 Q-3.6 1 -3.6 5 Q-3.6 8.5 -0.4 8.5 L2.4 8.5 L2.4 6.4 L-0.2 6.4 Q-1.4 6.4 -1.4 3.8 Q-1.4 2.6 -0.2 2.6 Z\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.4\"/><path d=\"M-2.6 -9 L2.6 -9 L3.4 -15 Q5 -20 11 -24 Q17 -28 22 -30 L22 -34 Q5 -28 0 -28 Q-5 -28 -22 -34 L-22 -30 Q-17 -28 -11 -24 Q-5 -20 -3.4 -15 Z\" fill=\"@metalH\"/><path d=\"M-2.4 -9 Q-3.2 -15 -5.6 -20 Q-9 -25 -16 -29\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"1.2\" opacity=\"0.55\"/><path d=\"M-3.4 -15 Q0 -13 3.4 -15\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"1.4\"/><ellipse cx=\"0\" cy=\"-31.5\" rx=\"22\" ry=\"4.6\" fill=\"#1a1a20\" stroke=\"@metal\" stroke-width=\"1.1\"/><ellipse cx=\"0\" cy=\"-31.5\" rx=\"15\" ry=\"2.8\" fill=\"#0c0c10\" stroke=\"none\"/></g><g fill=\"@metalH\" stroke=\"none\"><circle cx=\"-3.5\" cy=\"-36\" r=\"4.6\" opacity=\"0.4\"/><circle cx=\"3.5\" cy=\"-38.5\" r=\"3.2\" opacity=\"0.28\"/></g>",
  palette: {"metalO":"#3a3a40","metalH":"#e8edf5","metal":"#5a6376","cuirO":"#3a2a1a","cuir":"#5a3d24","accent":"#caa64a"},
};
