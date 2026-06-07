import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "bolas",
  label: "Bolas",
  type: "ranged",
  group: "Lancer",
  target: "3 lanières reliées, lestées de boules aux extrémités",
  art: "<g fill=\"none\" stroke-linecap=\"round\"><g stroke=\"@cuirO\" stroke-width=\"1.7\"><path d=\"M0 -20 Q-11 -26 -14 -40\"/><path d=\"M0 -20 Q12 -23 17 -34\"/><path d=\"M0 -20 Q4 -7 2 7\"/></g><g stroke=\"@cuirH\" stroke-width=\"0.7\"><path d=\"M0 -20 Q-11 -26 -14 -40\"/><path d=\"M0 -20 Q12 -23 17 -34\"/><path d=\"M0 -20 Q4 -7 2 7\"/></g></g><circle cx=\"0\" cy=\"-20\" r=\"2.4\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.7\"/><circle cx=\"0\" cy=\"-20\" r=\"0.9\" fill=\"@accent\"/><g stroke=\"@metalO\" stroke-width=\"0.8\"><circle cx=\"-15\" cy=\"-42\" r=\"5\" fill=\"@metal\"/><circle cx=\"18\" cy=\"-36\" r=\"5\" fill=\"@metal\"/><circle cx=\"2\" cy=\"9\" r=\"5\" fill=\"@metal\"/></g><g fill=\"@metalH\" opacity=\"0.6\"><circle cx=\"-16.6\" cy=\"-43.6\" r=\"1.7\"/><circle cx=\"16.4\" cy=\"-37.6\" r=\"1.7\"/><circle cx=\"0.4\" cy=\"7.4\" r=\"1.7\"/></g>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#676f80","cuirO":"#3a2a18","cuirH":"#8a6840","cuir":"#6a4a2a","accent":"#caa64a"},
};
