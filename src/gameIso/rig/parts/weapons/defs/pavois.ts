import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "pavois",
  label: "Pavois",
  type: "melee",
  group: "Base",
  target: "grand bouclier rectangulaire de fantassin, arête centrale verticale, cerclage métal",
  art: "<!-- Pavois : grand bouclier rectangulaire dresse (couvre tout le corps), poignee a la main (origine, +y). Face bois cerclee de metal, arete/nervure centrale verticale en relief. Bord vers -y (haut), legerement arrondi en tete. --><!-- corps en bois du pavois --><path d=\"M-13 8 L-13 -42 Q-13 -50 0 -50 Q13 -50 13 -42 L13 8 Q13 11 9 11 L-9 11 Q-13 11 -13 8 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.8\"/><!-- planches de bois verticales (texture) --><g stroke=\"@cuirO\" stroke-width=\"0.5\" opacity=\"0.5\"><line x1=\"-6.5\" y1=\"-46\" x2=\"-6.5\" y2=\"9\"/><line x1=\"6.5\" y1=\"-46\" x2=\"6.5\" y2=\"9\"/></g><!-- cerclage metallique du bord (cadre) --><path d=\"M-13 8 L-13 -42 Q-13 -50 0 -50 Q13 -50 13 -42 L13 8 Q13 11 9 11 L-9 11 Q-13 11 -13 8 Z\" fill=\"none\" stroke=\"@metal\" stroke-width=\"2.2\"/><path d=\"M-13 8 L-13 -42 Q-13 -50 0 -50 Q13 -50 13 -42 L13 8 Q13 11 9 11 L-9 11 Q-13 11 -13 8 Z\" fill=\"none\" stroke=\"@metalO\" stroke-width=\"0.6\"/><!-- ARETE CENTRALE verticale en relief (signature pavois) --><rect x=\"-2.4\" y=\"-49\" width=\"4.8\" height=\"59\" rx=\"1.6\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><rect x=\"-0.8\" y=\"-47\" width=\"1.6\" height=\"55\" rx=\"0.8\" fill=\"@metalH\" opacity=\"0.85\"/><!-- rivets le long du cadre --><g fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.3\"><circle cx=\"-11\" cy=\"-40\" r=\"1\"/><circle cx=\"11\" cy=\"-40\" r=\"1\"/><circle cx=\"-11\" cy=\"-20\" r=\"1\"/><circle cx=\"11\" cy=\"-20\" r=\"1\"/><circle cx=\"-11\" cy=\"0\" r=\"1\"/><circle cx=\"11\" cy=\"0\" r=\"1\"/><circle cx=\"0\" cy=\"-48\" r=\"1\"/></g>",
  palette: {"metalO":"#2a3038","metal":"#8a96a8","metalH":"#dfe6ef","cuir":"#6a4a2a","cuirO":"#3a2818"},
};
