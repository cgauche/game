import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "bolas",
  label: "Bolas",
  type: "ranged",
  group: "Lancer",
  target: "3 lanières reliées, lestées de boules aux extrémités",
  art: "<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M-7 -4 C-13 -2 -9 -12 -16 -13 C-21 -14 -16 -23 -17 -28\" stroke=\"#33240f\" stroke-width=\"2.9\"/><path d=\"M-7 -4 C-13 -2 -9 -12 -16 -13 C-21 -14 -16 -23 -17 -28\" stroke=\"@cuirO\" stroke-width=\"1.6\"/><path d=\"M-7 -4 C-13 -2 -9 -12 -16 -13 C-21 -14 -16 -23 -17 -28\" stroke=\"@cuir\" stroke-width=\"0.55\" stroke-dasharray=\"2 2.6\" opacity=\"0.85\"/><path d=\"M-7 -4 C0 -13 -6 -24 4 -31 C12 -36 8 -45 16 -47 C20 -48 19 -42 15 -41\" stroke=\"#33240f\" stroke-width=\"2.7\"/><path d=\"M-7 -4 C0 -13 -6 -24 4 -31 C12 -36 8 -45 16 -47 C20 -48 19 -42 15 -41\" stroke=\"@cuirO\" stroke-width=\"1.5\"/><path d=\"M-7 -4 C0 -13 -6 -24 4 -31 C12 -36 8 -45 16 -47 C20 -48 19 -42 15 -41\" stroke=\"@cuir\" stroke-width=\"0.5\" stroke-dasharray=\"2 2.6\" opacity=\"0.85\"/><path d=\"M-7 -4 C-4 2 -10 5 -6 10\" stroke=\"#33240f\" stroke-width=\"3\"/><path d=\"M-7 -4 C-4 2 -10 5 -6 10\" stroke=\"@cuirO\" stroke-width=\"1.7\"/><path d=\"M-7 -4 C-4 2 -10 5 -6 10\" stroke=\"@cuir\" stroke-width=\"0.55\" stroke-dasharray=\"2 2.6\" opacity=\"0.85\"/></g><circle cx=\"-7\" cy=\"-4\" r=\"2.4\" fill=\"@cuirO\" stroke=\"#33240f\" stroke-width=\"0.8\"/><circle cx=\"-7.7\" cy=\"-4.7\" r=\"0.9\" fill=\"@accent\"/><g stroke=\"@metalO\" stroke-width=\"0.75\"><circle cx=\"-17.6\" cy=\"-30\" r=\"4.4\" fill=\"@metal\"/><circle cx=\"14.4\" cy=\"-40\" r=\"5.4\" fill=\"@metal\"/><circle cx=\"-5.6\" cy=\"11.4\" r=\"4.8\" fill=\"@metal\"/></g><g fill=\"@metalH\" opacity=\"0.5\"><circle cx=\"-19\" cy=\"-31.4\" r=\"1.4\"/><circle cx=\"12.7\" cy=\"-41.6\" r=\"1.7\"/><circle cx=\"-7.1\" cy=\"9.9\" r=\"1.5\"/></g>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#676f80","cuirO":"#6a4a2a","cuir":"#8a6840","accent":"#caa64a"},
};
