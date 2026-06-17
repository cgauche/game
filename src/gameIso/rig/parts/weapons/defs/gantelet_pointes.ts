import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "gantelet_pointes",
  label: "Gantelet à pointes",
  type: "melee",
  group: "Bagarre",
  target: "poing ganté d'acier avec pointes saillantes sur les jointures",
  art: "<g stroke=\"@metalO\" stroke-width=\"0.5\"><path d=\"M-8 4 Q-9 -8 -7 -14 Q-5 -19 1 -19 Q8 -19 10 -13 Q11 -5 10 3 Q9 9 2 10 Q-6 11 -8 4 Z\" fill=\"@metal\"/></g><!-- doigts gantes en plaques d'acier (au lieu de chair) --><g fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"><path d=\"M-7 -13 q-1 -6 3 -6 q3 0 3 6 q0 4 -3 5 q-3 0 -3 -5 z\"/><path d=\"M-1.5 -15 q-1 -6 3 -6 q3 0 3 6 q0 4 -3 5 q-3 0 -3 -5 z\"/><path d=\"M4 -14 q-1 -6 3 -6 q3 0 3 5 q0 4 -3 5 q-3 0 -3 -4 z\"/></g><!-- rivets/jointures de plaques --><g fill=\"@metalH\" opacity=\"0.7\"><circle cx=\"-4\" cy=\"-13\" r=\"0.8\"/><circle cx=\"1.5\" cy=\"-15\" r=\"0.8\"/><circle cx=\"7\" cy=\"-14\" r=\"0.8\"/></g><!-- POINTES sur les jointures (signature) : 3 pointes acerees vers le haut --><g fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.45\"><path d=\"M-5.6 -18 l1.6 -7 1.6 7 z\"/><path d=\"M0 -20 l1.6 -7.5 1.6 7.5 z\"/><path d=\"M5.4 -19 l1.6 -7 1.6 7 z\"/></g><!-- bande de manchette / poignet en acier --><path d=\"M-11 -3 Q-13 -8 -10 -11 Q-7 -12 -6 -8 L-6 1 Q-9 3 -11 -3 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><rect x=\"-9\" y=\"2\" width=\"18\" height=\"4\" rx=\"1\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/><rect x=\"-9\" y=\"2.4\" width=\"18\" height=\"1.1\" rx=\"0.5\" fill=\"@metalH\" opacity=\"0.7\"/>",
  palette: {"metalO":"#2a3038","metalH":"#dfe6ef","metal":"#8a96a8"},
};
