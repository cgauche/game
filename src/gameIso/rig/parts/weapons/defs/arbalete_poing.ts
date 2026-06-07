import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "arbalete_poing",
  label: "Arbalète de poing",
  type: "ranged",
  group: "Arbalète",
  target: "petite arbalète tenue à une main",
  art: "<path d=\"M-3 8 Q-5.5 1 -3.4 -6 L3 -6 Q4.2 1 3 8 Q0 10 -3 8 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.5\"/><path d=\"M-2.6 8 Q-4.6 2 -2.8 -4 L-1 -4 Q-2.4 2 -0.6 8 Z\" fill=\"@cuirO\" opacity=\"0.7\"/><path d=\"M3 6 Q9 6 9 0 Q9 -3 6 -3\" fill=\"none\" stroke=\"@cuir\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><rect x=\"-3.4\" y=\"-22\" width=\"6.8\" height=\"17\" rx=\"2\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.6\"/><rect x=\"-1.5\" y=\"-22\" width=\"3\" height=\"17\" rx=\"1\" fill=\"@cuir\"/><rect x=\"-3.4\" y=\"-7\" width=\"6.8\" height=\"3\" rx=\"0.8\" fill=\"@cuirO\"/><path d=\"M-15 -16 Q-9 -23 -2 -20 L2 -20 Q9 -23 15 -16\" fill=\"none\" stroke=\"@cuirO\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M-15 -16 Q-9 -22 -2 -19.4 L2 -19.4 Q9 -22 15 -16\" fill=\"none\" stroke=\"@cuirH\" stroke-width=\"1.1\" stroke-linecap=\"round\"/><line x1=\"-15\" y1=\"-16\" x2=\"15\" y2=\"-16\" stroke=\"@accent\" stroke-width=\"1\"/><rect x=\"-0.85\" y=\"-34\" width=\"1.7\" height=\"18\" fill=\"@cuirH\"/><path d=\"M0 -36 l2 4.5 -4 0 z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-0.85 -19 l-3.4 2 0 -3.2 z M0.85 -19 l3.4 2 0 -3.2 z\" fill=\"@cuirH\" stroke=\"@cuir\" stroke-width=\"0.3\"/>",
  palette: {"metalO":"#2a3038","metal":"#9aa6b8","cuir":"#4a3320","cuirO":"#3a2a18","cuirH":"#7a5630","accent":"#e2dac8"},
};
