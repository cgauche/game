import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "attrape_coquin",
  label: "Attrape-coquin",
  type: "melee",
  group: "Armes d'hast",
  target: "hampe + fourche à deux dents courbes (capteur d'homme)",
  art: "<rect x=\"-1.8\" y=\"-30\" width=\"3.6\" height=\"40\" rx=\"1.5\" fill=\"@cuir\"/><rect x=\"-1.4\" y=\"-30\" width=\"0.9\" height=\"40\" fill=\"@cuir\"/><rect x=\"-2.3\" y=\"-40\" width=\"4.6\" height=\"12\" rx=\"1\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M-2 -39 Q-12 -41 -13 -50 Q-13.5 -57 -9 -58 Q-11 -55 -10 -50 Q-9 -45 -2 -43 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><path d=\"M2 -39 Q12 -41 13 -50 Q13.5 -57 9 -58 Q11 -55 10 -50 Q9 -45 2 -43 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><path d=\"M-2 -39 Q-9 -41 -10 -49\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.6\"/><path d=\"M2 -39 Q9 -41 10 -49\" fill=\"none\" stroke=\"@metalH\" stroke-width=\"0.5\" opacity=\"0.6\"/><rect x=\"-2.7\" y=\"-30.5\" width=\"5.4\" height=\"2.4\" rx=\"0.8\" fill=\"@metalO\" stroke=\"@metalO\" stroke-width=\"0.3\"/>",
  palette: {"metalO":"#2a3038","metal":"#a4acb9","metalH":"#eef3f8","cuir":"#6a4a2a"},
};
