import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "broyeur_os",
  label: "Broyeur d'os",
  type: "melee",
  group: "Deux-mains",
  target: "maillet/massue à deux mains en os brut, tête bulbeuse hérissée de pointes d'os",
  art: "<!-- manche long, lie de tendons --><rect x=\"-1.9\" y=\"-30\" width=\"3.8\" height=\"40\" rx=\"1.6\" fill=\"@cuirO\" stroke=\"#2c1b0e\" stroke-width=\"0.5\"/><path d=\"M-1.9 -22 q3.8 1.2 0 2.4 M-1.9 -16 q3.8 1.2 0 2.4 M-1.9 -10 q3.8 1.2 0 2.4\" stroke=\"@cuir\" stroke-width=\"0.6\" fill=\"none\"/><rect x=\"-2.1\" y=\"4\" width=\"4.2\" height=\"4\" rx=\"1\" fill=\"@accent\" stroke=\"@cuir\" stroke-width=\"0.4\"/><!-- tete d'os bulbeuse (epiphyse), pas de tranchant --><path d=\"M-2 -28 Q-12 -30 -12 -40 Q-12 -50 0 -50 Q12 -50 12 -40 Q12 -30 2 -28 Z\" fill=\"@os\" stroke=\"@osO\" stroke-width=\"0.7\"/><!-- protuberances d'os arrondies --><circle cx=\"-9\" cy=\"-44\" r=\"3.4\" fill=\"@os\" stroke=\"@osO\" stroke-width=\"0.5\"/><circle cx=\"9\" cy=\"-44\" r=\"3.4\" fill=\"@os\" stroke=\"@osO\" stroke-width=\"0.5\"/><circle cx=\"-6\" cy=\"-36\" r=\"2.6\" fill=\"@os\" stroke=\"@osO\" stroke-width=\"0.5\"/><circle cx=\"6\" cy=\"-36\" r=\"2.6\" fill=\"@os\" stroke=\"@osO\" stroke-width=\"0.5\"/><!-- pointes d'os acerees plantees dans la tete --><path d=\"M0 -50 L-2.2 -44 L2.2 -44 Z\" fill=\"@osH\" stroke=\"@osO\" stroke-width=\"0.4\"/><path d=\"M-12 -42 L-17 -41 L-12 -38 Z\" fill=\"@osH\" stroke=\"@osO\" stroke-width=\"0.4\"/><path d=\"M12 -42 L17 -41 L12 -38 Z\" fill=\"@osH\" stroke=\"@osO\" stroke-width=\"0.4\"/><path d=\"M-7 -49 L-9 -54 L-4 -50 Z\" fill=\"@osH\" stroke=\"@osO\" stroke-width=\"0.4\"/><path d=\"M7 -49 L9 -54 L4 -50 Z\" fill=\"@osH\" stroke=\"@osO\" stroke-width=\"0.4\"/><!-- ombres/craquelures d'os --><path d=\"M-3 -32 Q0 -34 3 -32\" fill=\"none\" stroke=\"@osO\" stroke-width=\"0.4\" opacity=\"0.6\"/><path d=\"M-4 -42 L-2 -38 M4 -42 L2 -38\" stroke=\"@osO\" stroke-width=\"0.4\" opacity=\"0.5\"/>",
  palette: {"osO":"#7d6f56","osH":"#f3ecd8","os":"#d8cdb0","cuirO":"#4a2f17","cuir":"#7a5a18","accent":"#caa64a"},
};
