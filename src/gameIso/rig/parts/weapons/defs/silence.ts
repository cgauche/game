import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "silence",
  label: "Silence",
  type: "melee",
  group: "Base",
  target: "dague légendaire sombre et feutrée, lame noir-violacé, aura d'ombre",
  art: "<!-- aura d'ombre diffuse derriere la lame --><path d=\"M0 -2 L4 -20 L0 -27 L-4 -20 Z\" fill=\"@aura\" opacity=\"0.35\"/><path d=\"M-2 4 L2 4 L2.4 -3 L-2.4 -3 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.4\"/><path d=\"M-1.6 4 q-1 2 0 3.6 q1.6 2 0 3.4 q-1 0.6 0 1.4 M1.6 4 q1 2 0 3.6 q-1.6 2 0 3.4 q1 0.6 0 1.4\" stroke=\"@cuirO\" stroke-width=\"0.5\" fill=\"none\"/><circle cx=\"0\" cy=\"10\" r=\"2.6\" fill=\"@accent\" stroke=\"@metalO\" stroke-width=\"0.5\"/><circle cx=\"0\" cy=\"10\" r=\"1\" fill=\"@aura\"/><!-- garde sobre, sombre --><path d=\"M-9 -2 L9 -2 L9.5 -4 Q9.8 -5 8.6 -5 L-8.6 -5 Q-9.8 -5 -9.5 -4 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><circle cx=\"-8.6\" cy=\"-3.5\" r=\"1.5\" fill=\"@accent\" stroke=\"@aura\" stroke-width=\"0.3\"/><circle cx=\"8.6\" cy=\"-3.5\" r=\"1.5\" fill=\"@accent\" stroke=\"@aura\" stroke-width=\"0.3\"/><!-- lame noir-violace --><path d=\"M-3 -5 L3 -5 L2.4 -19 L0 -24 L-2.4 -19 Z\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.5\"/><!-- reflet violet sourd --><path d=\"M0 -7 L0 -22\" stroke=\"@accent\" stroke-width=\"0.6\" opacity=\"0.55\"/>",
  palette: {"metalO":"#0e0a14","metal":"#241a30","cuir":"#1a1420","cuirO":"#0c0810","accent":"#6a4a8a","aura":"#3a2a55"},
};
