import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "fleuret",
  label: "Fleuret",
  type: "melee",
  group: "Escrime",
  target: "lame très fine et droite, garde simple en croix",
  art: "<rect x=\"-1.5\" y=\"-2\" width=\"3\" height=\"11\" rx=\"1.3\" fill=\"@cuir\"/><rect x=\"-1.5\" y=\"-2\" width=\"1.1\" height=\"11\" rx=\"0.6\" fill=\"@cuir\"/><circle cx=\"0\" cy=\"10\" r=\"2.4\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.5\"/><circle cx=\"0\" cy=\"10\" r=\"0.9\" fill=\"@accent\"/><rect x=\"-10\" y=\"-3.4\" width=\"20\" height=\"1.8\" rx=\"0.9\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><circle cx=\"-10\" cy=\"-2.5\" r=\"1.2\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.3\"/><circle cx=\"10\" cy=\"-2.5\" r=\"1.2\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.3\"/><path d=\"M-1 -3.4 L1 -3.4 L0.55 -45 L0 -48 L-0.55 -45 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.35\"/><line x1=\"0\" y1=\"-5\" x2=\"0\" y2=\"-45\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.75\"/><circle cx=\"0\" cy=\"-48\" r=\"1.1\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.3\"/>",
  palette: {"metalO":"#2a3038","metal":"#aab2bd","metalH":"#e6edf6","cuir":"#3a2a1a","accent":"#caa64a"},
};
