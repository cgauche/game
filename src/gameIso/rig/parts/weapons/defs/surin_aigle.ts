import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "surin_aigle",
  label: "Surin de l'aigle",
  type: "melee",
  group: "Base",
  target: "surin à pommeau en tête d'aigle, lame courte",
  art: "<!-- manche enrobe --><path d=\"M-1.7 6 L1.7 6 L1.9 -1 L-1.9 -1 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><rect x=\"-2.1\" y=\"1.2\" width=\"4.2\" height=\"1.4\" rx=\"0.6\" fill=\"@cuirO\"/><!-- pommeau : tete d'aigle en metal, bec crochu vers +y --><path d=\"M-2.4 4.5 Q-3 8 0 9 Q1.6 9.4 2.6 8.4 L2.6 6 Q2 4.5 0 4.5 Z\" fill=\"@accent\" stroke=\"@accentO\" stroke-width=\"0.5\"/><!-- bec crochu --><path d=\"M2.6 7.4 Q5 7.6 5.2 9.2 Q4 9.4 2.6 8.4 Z\" fill=\"@accentO\" stroke=\"@accentO\" stroke-width=\"0.4\"/><!-- oeil de l'aigle --><circle cx=\"0.4\" cy=\"6.4\" r=\"0.7\" fill=\"@metalO\"/><circle cx=\"0.55\" cy=\"6.25\" r=\"0.25\" fill=\"@metalH\"/><!-- ploume / crete arriere --><path d=\"M-2.4 5 Q-4.5 5.5 -5 7.5 Q-3.2 7 -2.4 6.5\" fill=\"@accent\" stroke=\"@accentO\" stroke-width=\"0.4\"/><!-- virole --><ellipse cx=\"0\" cy=\"-1.6\" rx=\"2.4\" ry=\"1.2\" fill=\"@accent\" stroke=\"@accentO\" stroke-width=\"0.4\"/><!-- lame courte effilee --><path d=\"M-1.9 -2 L1.9 -2 L1.9 -15 Q1.7 -19 -0.4 -20 Q-1.9 -16 -1.9 -11 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-0.7 -3 L-0.6 -17\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.55\"/>",
  palette: {"metalO":"#2a3038","metalH":"#cfd8e6","metal":"#9aa6b8","cuir":"#5a3f24","cuirO":"#3a2a1a","accentO":"#9a7a28","accent":"#d8b450"},
};
