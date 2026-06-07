import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "fronde",
  label: "Fronde",
  type: "ranged",
  group: "Fronde",
  target: "2 lanières + poche de cuir + galet",
  art: "<g fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.5\" stroke-linejoin=\"round\"><path d=\"M-2 -2 Q-10 -16 -10 -30 Q-10 -38 -12.5 -43 Q-14.5 -40 -12.5 -32 Q-12 -18 -5.5 -5 Q-3.5 -2 -2 -2 Z\"/><path d=\"M3 -2 Q9 -17 12 -31 Q13.5 -38 11.5 -43 Q9 -41 9.5 -33 Q8 -18 1 -5 Q-0.5 -2 3 -2 Z\"/></g><g fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.45\" stroke-linejoin=\"round\"><path d=\"M-6.5 -5 Q-8.5 8 0 9.5 Q8.5 8 6.5 -5 Q5 -1 2.5 0.5 Q4.5 -6 0 -6 Q-4.5 -6 -2.5 0.5 Q-5 -1 -6.5 -5 Z\"/></g><path d=\"M-3.5 -2.5 Q0 4 3.5 -2.5\" fill=\"none\" stroke=\"@cuirH\" stroke-width=\"0.5\" opacity=\"0.65\"/><circle cx=\"0\" cy=\"-0.5\" r=\"3.4\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><ellipse cx=\"-1.3\" cy=\"-2\" rx=\"1.5\" ry=\"1.05\" fill=\"@metalH\" opacity=\"0.9\"/><circle cx=\"-12.5\" cy=\"-44\" r=\"1.7\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><path d=\"M11.5 -44 l3.2 -1.4 -1.2 3.6 z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/>",
  palette: {"metal":"#8a929c","metalO":"#3a4048","metalH":"#b6bec8","cuir":"#5a4028","cuirO":"#4a3525","cuirH":"#caa882"},
};
