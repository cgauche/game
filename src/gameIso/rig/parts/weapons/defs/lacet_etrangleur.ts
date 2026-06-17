import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "lacet_etrangleur",
  label: "Lacet étrangleur",
  type: "melee",
  group: "Bagarre",
  target: "fil/cordelette tendue entre deux petites poignées de bois (garrot)",
  art: "<!-- Lacet etrangleur (garrot) : fin fil metallique TENDU droit vers le haut (-y), termine a CHAQUE bout par une courte poignee de bois cylindrique. Poignee du bas a l'origine (0,0). Le fil est fin et raide (=tendu), pas ondulant (=fouet). --><!-- poignee BASSE (cote main, origine) : cylindre de bois, virole metal en haut --><rect x=\"-2.4\" y=\"-2\" width=\"4.8\" height=\"11\" rx=\"2.2\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.6\"/><rect x=\"-2.6\" y=\"-4.4\" width=\"5.2\" height=\"2.8\" rx=\"1.1\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.5\"/><rect x=\"-0.9\" y=\"0\" width=\"1.3\" height=\"7\" rx=\"0.6\" fill=\"@cuirH\" opacity=\"0.7\"/><!-- FIL tendu : double trait fin et droit du haut de la poignee basse au bas de la poignee haute --><line x1=\"-0.5\" y1=\"-4.4\" x2=\"-0.5\" y2=\"-45.6\" stroke=\"@metalO\" stroke-width=\"0.8\"/><line x1=\"0.5\" y1=\"-4.4\" x2=\"0.5\" y2=\"-45.6\" stroke=\"@metal\" stroke-width=\"0.8\"/><line x1=\"0\" y1=\"-4.4\" x2=\"0\" y2=\"-45.6\" stroke=\"@metalH\" stroke-width=\"0.4\" opacity=\"0.7\"/><!-- ligature du fil au bout de chaque poignee --><line x1=\"-1.4\" y1=\"-2.8\" x2=\"1.4\" y2=\"-2.8\" stroke=\"@cuirO\" stroke-width=\"0.7\"/><line x1=\"-1.4\" y1=\"-47\" x2=\"1.4\" y2=\"-47\" stroke=\"@cuirO\" stroke-width=\"0.7\"/><!-- poignee HAUTE (cote cible) : cylindre de bois, virole metal en bas --><rect x=\"-2.6\" y=\"-48.4\" width=\"5.2\" height=\"2.8\" rx=\"1.1\" fill=\"@metalH\" stroke=\"@metalO\" stroke-width=\"0.5\"/><rect x=\"-2.4\" y=\"-59\" width=\"4.8\" height=\"11\" rx=\"2.2\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.6\"/><rect x=\"-0.9\" y=\"-57\" width=\"1.3\" height=\"7\" rx=\"0.6\" fill=\"@cuirH\" opacity=\"0.7\"/>",
  palette: {"metalO":"#2a3038","metal":"#9aa6b8","metalH":"#dfe6ef","cuir":"#5a3a1f","cuirO":"#3a2a1a","cuirH":"#9a7a4a"},
};
