import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "filet_leste",
  label: "Filet lesté",
  type: "ranged",
  group: "Parade",
  target: "filet à mailles déployé, petits plombs ronds tout autour du bord",
  art: "<!-- Filet leste : maillage de corde tendu en eventail au-dessus de la main (origine), borde de petits plombs ronds. Tenu par un brin qui descend a la main. --><!-- brin de tenue vers la main --><path d=\"M0 9 C -1 2 -2 -4 -1 -10\" fill=\"none\" stroke=\"@cuir\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><!-- contour exterieur du filet (poche ovale ouverte vers le haut) --><path d=\"M-1 -10 C -16 -14 -20 -34 -10 -47 C -2 -55 6 -55 14 -47 C 24 -34 18 -16 4 -11\" fill=\"none\" stroke=\"@cuir\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><!-- MAILLES : lignes croisees fines (diagonales dans les deux sens) --><g fill=\"none\" stroke=\"@cuir\" stroke-width=\"0.7\" opacity=\"0.85\"><path d=\"M-12 -16 L-2 -49\"/><path d=\"M-6 -13 L6 -52\"/><path d=\"M2 -13 L13 -49\"/><path d=\"M9 -16 L16 -41\"/><path d=\"M-16 -26 L18 -36\"/><path d=\"M-18 -32 L17 -42\"/><path d=\"M-16 -38 L13 -48\"/><path d=\"M-11 -44 L7 -52\"/></g><!-- PLOMBS ronds repartis sur le bord (signature filet leste) --><g fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"><circle cx=\"-10\" cy=\"-47\" r=\"1.8\"/><circle cx=\"-2\" cy=\"-53\" r=\"1.8\"/><circle cx=\"6\" cy=\"-53\" r=\"1.8\"/><circle cx=\"14\" cy=\"-47\" r=\"1.8\"/><circle cx=\"18\" cy=\"-37\" r=\"1.8\"/><circle cx=\"-18\" cy=\"-33\" r=\"1.8\"/><circle cx=\"-15\" cy=\"-21\" r=\"1.8\"/><circle cx=\"19\" cy=\"-27\" r=\"1.8\"/></g><g fill=\"@metalH\" opacity=\"0.6\"><circle cx=\"-10.5\" cy=\"-47.6\" r=\"0.6\"/><circle cx=\"5.5\" cy=\"-53.6\" r=\"0.6\"/><circle cx=\"13.5\" cy=\"-47.6\" r=\"0.6\"/></g>",
  palette: {"cuir":"#7e5a2e","metalO":"#2a3038","metal":"#676f80","metalH":"#9aa6b8"},
};
