import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "gantelet_verrouille",
  label: "Gantelet verrouillé",
  type: "melee",
  group: "Bagarre",
  target: "poing ganté d'acier avec une petite lame brise-lame fixée sur le dos",
  art: "<g stroke=\"@metalO\" stroke-width=\"0.5\"><path d=\"M-8 4 Q-9 -8 -7 -14 Q-5 -19 1 -19 Q8 -19 10 -13 Q11 -5 10 3 Q9 9 2 10 Q-6 11 -8 4 Z\" fill=\"@metal\"/></g><!-- doigts gantes en plaques d'acier --><g fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"><path d=\"M-7 -13 q-1 -6 3 -6 q3 0 3 6 q0 4 -3 5 q-3 0 -3 -5 z\"/><path d=\"M-1.5 -15 q-1 -6 3 -6 q3 0 3 6 q0 4 -3 5 q-3 0 -3 -5 z\"/><path d=\"M4 -14 q-1 -6 3 -6 q3 0 3 5 q0 4 -3 5 q-3 0 -3 -4 z\"/></g><!-- rivets de jointures --><g fill=\"@metalH\" opacity=\"0.7\"><circle cx=\"-4\" cy=\"-13\" r=\"0.8\"/><circle cx=\"1.5\" cy=\"-15\" r=\"0.8\"/><circle cx=\"7\" cy=\"-14\" r=\"0.8\"/></g><!-- manchette poignet acier --><path d=\"M-11 -3 Q-13 -8 -10 -11 Q-7 -12 -6 -8 L-6 1 Q-9 3 -11 -3 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><rect x=\"-9\" y=\"2\" width=\"18\" height=\"4\" rx=\"1\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/><rect x=\"-9\" y=\"2.4\" width=\"18\" height=\"1.1\" rx=\"0.5\" fill=\"@metalH\" opacity=\"0.7\"/><!-- LAME brise-lame (signature 'verrouille') : courte lame plate dressee sur le dos du gantelet, avec un cran/encoche pour bloquer la lame adverse --><path d=\"M-3 -16 L-1 -16 L-0.4 -34 L-2 -38 L-3.6 -34 Z\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.5\"/><path d=\"M-2 -17 L-2 -33\" stroke=\"@metalO\" stroke-width=\"0.5\" opacity=\"0.5\"/><!-- cran/encoche (brise-lame) sur le tranchant --><path d=\"M-0.7 -25 l2.4 -1.2 -2.4 -1.2 z\" fill=\"@metalO\"/><path d=\"M-0.85 -29 l2.4 -1.2 -2.4 -1.2 z\" fill=\"@metalO\"/>",
  palette: {"metalO":"#2a3038","metalH":"#dfe6ef","metal":"#8a96a8"},
};
