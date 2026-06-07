import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "dague",
  label: "Dague",
  type: "melee",
  group: "Base",
  target: "dague à garde croisée",
  art: "<path d=\"M-2 4 L2 4 L2.4 -3 L-2.4 -3 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><path d=\"M-1.6 4 q-1 2 0 3.6 q1.6 2 0 3.4 q-1 0.6 0 1.4 M1.6 4 q1 2 0 3.6 q-1.6 2 0 3.4 q1 0.6 0 1.4\" stroke=\"@cuirO\" stroke-width=\"0.5\" fill=\"none\"/><circle cx=\"0\" cy=\"10\" r=\"2.6\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M-9 -2 L9 -2 L9.5 -4 Q9.8 -5 8.6 -5 L-8.6 -5 Q-9.8 -5 -9.5 -4 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><circle cx=\"-8.6\" cy=\"-3.5\" r=\"1.5\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.3\"/><circle cx=\"8.6\" cy=\"-3.5\" r=\"1.5\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.3\"/><path d=\"M-3 -5 L3 -5 L2.4 -19 L0 -24 L-2.4 -19 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M0 -7 L0 -22\" stroke=\"@metalH\" stroke-width=\"0.6\" opacity=\"0.7\"/>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b8","cuir":"#7a5a18","cuirO":"#33241a","accent":"#caa64a"},
};
