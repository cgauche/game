import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "fleau_armes",
  label: "Fléau d'armes",
  type: "melee",
  group: "Fléau",
  target: "fléau militaire : manche + chaîne + boule à pointes",
  art: "<rect x=\"-2\" y=\"-19\" width=\"4\" height=\"25\" rx=\"1.5\" fill=\"@cuir\" stroke=\"#2a1a0c\" stroke-width=\"0.4\"/><g stroke=\"@cuir\" stroke-width=\"0.6\"><line x1=\"-2\" y1=\"-12\" x2=\"2\" y2=\"-13\"/><line x1=\"-2\" y1=\"-7\" x2=\"2\" y2=\"-8\"/><line x1=\"-2\" y1=\"-2\" x2=\"2\" y2=\"-3\"/></g><rect x=\"-3.2\" y=\"4\" width=\"6.4\" height=\"2.8\" rx=\"1\" fill=\"@accent\"/><rect x=\"-3\" y=\"-23\" width=\"6\" height=\"5\" rx=\"1.2\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.5\"/><g fill=\"none\" stroke=\"@metal\" stroke-width=\"2\"><ellipse cx=\"0\" cy=\"-26.5\" rx=\"1.6\" ry=\"2.6\"/><ellipse cx=\"2.4\" cy=\"-30.6\" rx=\"2.6\" ry=\"1.6\" transform=\"rotate(40 2.4 -30.6)\"/><ellipse cx=\"5.2\" cy=\"-34.2\" rx=\"1.6\" ry=\"2.6\" transform=\"rotate(40 5.2 -34.2)\"/><ellipse cx=\"8.4\" cy=\"-37.4\" rx=\"2.6\" ry=\"1.6\" transform=\"rotate(40 8.4 -37.4)\"/></g><g fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.35\"><path d=\"M11 -42 l5.5 0 -2.8 3.4 z\"/><path d=\"M11 -42 l2.7 -4.9 2.8 2.1 z\"/><path d=\"M11 -42 l-2.1 -5.1 4.8 0 z\"/><path d=\"M11 -42 l-4.9 -2.5 2.7 -4 z\"/><path d=\"M11 -42 l-5.5 0.4 2.6 -3.5 z\"/><path d=\"M11 -42 l-2.7 4.9 -2.8 -2.1 z\"/><path d=\"M11 -42 l2.1 5.1 -4.8 0 z\"/><path d=\"M11 -42 l4.9 2.5 -2.7 4 z\"/></g><circle cx=\"11\" cy=\"-42\" r=\"5\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.6\"/><ellipse cx=\"9\" cy=\"-44\" rx=\"2\" ry=\"1.4\" fill=\"@metalH\" opacity=\"0.6\"/>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b8","cuir":"#4a2f17","accent":"#caa64a"},
};
