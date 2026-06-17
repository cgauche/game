import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "pistolet_griffon",
  label: "Pistolet patte de griffon",
  type: "ranged",
  group: "Poudre noire",
  target: "pistolet à crosse recourbée ouvragée en patte/serre de griffon",
  art: "<path d=\"M-3 -2 Q-6 6 -9 14 Q-12 22 -7 25 Q-13 23 -12.5 28 Q-9 31 -5 27 Q-9 18 -8 -3 Z\" fill=\"@cuir\" stroke=\"#221610\" stroke-width=\"0.6\"/><path d=\"M-7 25 Q-9 30 -13 29\" fill=\"none\" stroke=\"@accent\" stroke-width=\"1.4\" stroke-linecap=\"round\"/><path d=\"M-7 25 Q-6 31 -10 32\" fill=\"none\" stroke=\"@accent\" stroke-width=\"1.4\" stroke-linecap=\"round\"/><path d=\"M-7 25 Q-4 30 -7 34\" fill=\"none\" stroke=\"@accent\" stroke-width=\"1.4\" stroke-linecap=\"round\"/><circle cx=\"-7\" cy=\"24.5\" r=\"1.8\" fill=\"@accent\" stroke=\"#221610\" stroke-width=\"0.5\"/><path d=\"M-4.5 -4 Q-5 3 -4 10 L4.5 10 Q5.5 2 4 -5 Z\" fill=\"@cuirH\" stroke=\"@cuir\" stroke-width=\"0.6\"/><path d=\"M-3.3 -27 L-3.3 -4 Q-3.3 -1 0 -1 Q3.3 -1 3.3 -4 L3.3 -27 L1.6 -32 L-1.6 -32 Z\" fill=\"@metalH\" stroke=\"#2a2018\" stroke-width=\"0.6\"/><line x1=\"0\" y1=\"-31\" x2=\"0\" y2=\"-3\" stroke=\"@metalH\" stroke-width=\"0.7\" opacity=\"0.55\"/><circle cx=\"0\" cy=\"-31\" r=\"3.1\" fill=\"#15151b\" stroke=\"@metalO\" stroke-width=\"0.5\"/><circle cx=\"0\" cy=\"-31\" r=\"1.5\" fill=\"@metal\"/><path d=\"M3.4 -3 q5 -1 5.5 4 q0.4 4.6 -4.6 4.8 q3 -4 -0.9 -8.8 z\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.6\"/><circle cx=\"7\" cy=\"1\" r=\"1.1\" fill=\"@accent\"/><path d=\"M5 -5 q4 -3 6.5 0 q-2.5 -0.5 -2 2 q-3.5 -1 -4.5 -2 z\" fill=\"@metalH\" stroke=\"@metal\" stroke-width=\"0.5\"/><path d=\"M3.2 -7 q5 -3 6 -9 q2 4 -1 8 q3 0 4 3 q-5 1 -9 -2 z\" fill=\"@metal\" stroke=\"#15191e\" stroke-width=\"0.6\"/><path d=\"M-0.5 10 q1.6 4 -0.4 7\" stroke=\"#1c1c22\" stroke-width=\"1.6\" fill=\"none\"/>",
  palette: {"metalH":"#cfd6e0","metalO":"#2a2a32","metal":"#34343e","cuir":"#3a2a1a","cuirH":"#5a3d24","accent":"#caa64a"},
};
