import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "fronde",
  label: "Fronde",
  type: "ranged",
  group: "Fronde",
  target: "2 lanières + poche de cuir + galet",
  art: "<path d=\"M-5 -28 Q-2 -12 0 -2\" stroke=\"@cuir\" stroke-width=\"1.3\" fill=\"none\"/><path d=\"M5 -28 Q2 -12 0 -2\" stroke=\"@cuir\" stroke-width=\"1.3\" fill=\"none\"/><path d=\"M-4 -3 Q0 5 4 -3 Q0 0 -4 -3 z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><circle cx=\"0\" cy=\"-2\" r=\"2.6\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/>",
  palette: {"metal":"#8a929c","metalO":"#3a4048","cuir":"#6a4a2a","cuirO":"#4a3525"},
};
