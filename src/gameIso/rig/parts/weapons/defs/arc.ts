import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "arc",
  label: "Arc",
  type: "ranged",
  group: "Arc",
  target: "arc simple en D, corde tendue",
  art: "<path d=\"M3 -28 Q-13 0 3 28\" stroke=\"@cuirO\" stroke-width=\"3\" fill=\"none\"/><line x1=\"3\" y1=\"-28\" x2=\"3\" y2=\"28\" stroke=\"@accent\" stroke-width=\"1\"/><line x1=\"3\" y1=\"0\" x2=\"-15\" y2=\"0\" stroke=\"@cuir\" stroke-width=\"1.6\"/><path d=\"M-15 0 l5 -2.5 v5 z\" fill=\"@cuir\"/>",
  palette: {"cuirO":"#6a4a2a","cuir":"#caa882","accent":"#e8e0d0"},
};
