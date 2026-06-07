import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "arbalete",
  label: "Arbalète",
  type: "ranged",
  group: "Arbalète",
  target: "arbalète : arc transversal + fût + étrier",
  art: "<rect x=\"-1.6\" y=\"-30\" width=\"3.2\" height=\"34\" rx=\"1\" fill=\"@cuirO\"/><path d=\"M-13 -23 Q0 -19 13 -23\" stroke=\"@cuirO\" stroke-width=\"2.6\" fill=\"none\"/><line x1=\"-13\" y1=\"-23\" x2=\"13\" y2=\"-23\" stroke=\"@cuirH\" stroke-width=\"0.8\"/><rect x=\"-1\" y=\"-32\" width=\"2\" height=\"11\" fill=\"@cuir\"/><path d=\"M0 -34 l1.6 4 -3.2 0 z\" fill=\"@cuir\"/>",
  palette: {"cuirO":"#5a3f24","cuirH":"#d8d0c0","cuir":"#caa882"},
};
