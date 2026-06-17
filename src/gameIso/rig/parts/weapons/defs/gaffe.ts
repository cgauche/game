import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "gaffe",
  label: "Gaffe",
  type: "melee",
  group: "Bagarre",
  target: "longue hampe + croc métallique recourbé au bout (gaffe/croc de marinier)",
  art: "<rect x=\"-1.7\" y=\"-30\" width=\"3.4\" height=\"40\" rx=\"1.6\" fill=\"@cuirH\" stroke=\"@cuir\" stroke-width=\"0.4\"/><rect x=\"-1.7\" y=\"-2\" width=\"3.4\" height=\"1.6\" fill=\"@cuir\"/><path d=\"M0 9 q3.2 0 3.2 -3 l-6.4 0 q0 3 3.2 3 z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><rect x=\"-2.6\" y=\"-31\" width=\"5.2\" height=\"4\" rx=\"1.4\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><!-- CROC : courte pointe droite vers le haut puis crochet recourbe vers le bas-droite (=gaffe, pas une lame) --><path d=\"M-1.3 -30 L-1.3 -44 Q-1.3 -52 6 -51 Q12 -50 11 -43 Q10.4 -39.5 7 -39\" fill=\"none\" stroke=\"@metal\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M-1.3 -30 L-1.3 -44 Q-1.3 -52 6 -51 Q12 -50 11 -43 Q10.4 -39.5 7 -39\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"1\" stroke-linecap=\"round\" opacity=\"0.65\"/><!-- pointe effilee du croc --><path d=\"M7 -39 q-3.4 -0.2 -4.6 2.6 q2.2 0.4 4.6 -2.6 z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/>",
  palette: {"metalO":"#2a3038","metal":"#5a6376","metalH":"#eef2f8","cuirH":"#6a4a2a","cuir":"#3a2a18"},
};
