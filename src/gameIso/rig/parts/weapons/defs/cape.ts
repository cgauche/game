import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "cape",
  label: "Cape",
  type: "melee",
  group: "Parade",
  target: "cape de tissu drapée enroulée sur le bras, plis souples (parade)",
  art: "<!-- Cape de parade : pan de tissu drape, tenu par le bord a la main (origine), s'evase vers le haut en plis souples. PAS de lame. --><!-- bord tenu / enroule sur l'avant-bras (a la main) --><rect x=\"-3\" y=\"-2\" width=\"6\" height=\"11\" rx=\"2\" fill=\"@cuirO\" stroke=\"#2a1a0c\" stroke-width=\"0.5\"/><g stroke=\"@cuir\" stroke-width=\"0.5\" opacity=\"0.7\"><line x1=\"-2.6\" y1=\"0\" x2=\"2.6\" y2=\"1\"/><line x1=\"-2.6\" y1=\"3\" x2=\"2.6\" y2=\"4\"/><line x1=\"-2.6\" y1=\"6\" x2=\"2.6\" y2=\"7\"/></g><!-- DRAPE principal : grand pan de tissu qui monte et s'evase, bord ondulant en bas --><path d=\"M-2.6 -3 C -14 -10 -18 -28 -10 -44 C -4 -55 8 -56 15 -45 C 21 -34 19 -16 9 -6 C 5 -2 2 1 -1 4 C 0 0 1 -4 0 -8 C -3 -7 -8 -4 -11 1 C -9 -3 -6 -6 -4 -9 C -4 -5 -4 -2 -6 2 C -8 -2 -7 -7 -2.6 -3 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.6\" stroke-linejoin=\"round\"/><!-- doublure interieure (plus claire) repliee sur un cote --><path d=\"M-2.6 -3 C -10 -10 -13 -26 -7 -40 C -3 -48 4 -50 8 -45 C 3 -47 -2 -42 -4 -32 C -6 -20 -5 -10 -2.6 -3 Z\" fill=\"@cuirH\" opacity=\"0.45\"/><!-- plis : lignes d'ombre suivant la chute du tissu --><g fill=\"none\" stroke=\"@cuirO\" stroke-width=\"0.7\" opacity=\"0.6\" stroke-linecap=\"round\"><path d=\"M-1 -6 C 3 -18 4 -32 2 -44\"/><path d=\"M3 -8 C 8 -20 10 -32 9 -42\"/><path d=\"M-5 -8 C -8 -20 -8 -32 -5 -42\"/></g>",
  palette: {"cuir":"#5a2f3a","cuirO":"#321820","cuirH":"#9a6a72"},
};
