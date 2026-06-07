import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "bolas",
  label: "Bolas",
  type: "ranged",
  group: "Lancer",
  target: "3 lanières reliées, lestées de boules aux extrémités",
  art: "<g fill=\"none\" stroke-linecap=\"round\"><g stroke=\"@cuirO\" stroke-width=\"2.8\"><path d=\"M0 -5 L-16 -42\"/><path d=\"M0 -5 L16 -40\"/><path d=\"M0 -5 L0 -45\"/></g><g stroke=\"@cuirH\" stroke-width=\"1.5\"><path d=\"M0 -5 L-16 -42\"/><path d=\"M0 -5 L16 -40\"/><path d=\"M0 -5 L0 -45\"/></g></g><circle cx=\"0\" cy=\"-4\" r=\"4\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.8\"/><circle cx=\"0\" cy=\"-4\" r=\"1.7\" fill=\"@accent\"/><g stroke=\"@metalO\" stroke-width=\"0.9\"><circle cx=\"-16\" cy=\"-44\" r=\"6.2\" fill=\"@metal\"/><circle cx=\"16\" cy=\"-42\" r=\"6.2\" fill=\"@metal\"/><circle cx=\"0\" cy=\"-47\" r=\"6.2\" fill=\"@metal\"/></g><g fill=\"none\" stroke=\"@cuirO\" stroke-width=\"1.5\" stroke-linecap=\"round\"><path d=\"M-22.2 -44 H-9.8\"/><path d=\"M9.8 -42 H22.2\"/><path d=\"M-6.2 -47 H6.2\"/></g><g fill=\"@metalH\" opacity=\"0.6\"><circle cx=\"-18\" cy=\"-46.4\" r=\"2\"/><circle cx=\"14\" cy=\"-44.4\" r=\"2\"/><circle cx=\"-2\" cy=\"-49.4\" r=\"2\"/></g>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#676f80","cuirO":"#3a2a18","cuirH":"#8a6840","cuir":"#6a4a2a","accent":"#caa64a"},
};
