import type { WeaponDef } from '../types';

export const weapon: WeaponDef = {
  slug: "fustibale",
  label: "Fustibale",
  type: "ranged",
  group: "Fronde",
  target: "fronde à bâton : poche au bout d'une lanière fixée à un manche",
  art: "<rect x=\"-2\" y=\"-2\" width=\"4\" height=\"9\" rx=\"1.8\" fill=\"@cuir\"/><rect x=\"-2\" y=\"-46\" width=\"4\" height=\"50\" rx=\"1.8\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.5\"/><rect x=\"-2\" y=\"-30\" width=\"1.3\" height=\"34\" fill=\"@cuirH\" opacity=\"0.55\"/><path d=\"M-3.4 -46 L0 -52 L3.4 -46 Q0 -43 -3.4 -46 Z\" fill=\"@cuir\" stroke=\"@cuirO\" stroke-width=\"0.5\"/><circle cx=\"0\" cy=\"-47\" r=\"1.5\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.4\"/><path d=\"M0 -47 Q12 -45 15 -32 Q16 -27 13 -23\" fill=\"none\" stroke=\"@cuirH\" stroke-width=\"1.4\" stroke-linecap=\"round\"/><path d=\"M0 -47 Q9 -41 11 -31 Q12 -27 10 -23\" fill=\"none\" stroke=\"@cuirH\" stroke-width=\"1.2\" stroke-linecap=\"round\"/><path d=\"M9 -23 Q8 -13 12.5 -10 Q17 -13 15 -23 Q12 -25.5 9 -23 Z\" fill=\"@cuirH\" stroke=\"@cuir\" stroke-width=\"0.7\"/><path d=\"M9.5 -22 Q9 -14 12.5 -11.5\" fill=\"none\" stroke=\"@cuir\" stroke-width=\"0.6\" opacity=\"0.7\"/><circle cx=\"12\" cy=\"-17\" r=\"3.6\" fill=\"@metal\" stroke=\"@metalO\" stroke-width=\"0.6\"/><ellipse cx=\"10.8\" cy=\"-18.4\" rx=\"1.3\" ry=\"0.9\" fill=\"@metalH\" opacity=\"0.85\"/>",
  palette: {"metalO":"#2a3038","metalH":"#aeb6c2","metal":"#676f80","cuir":"#4a3320","cuirO":"#3a2a18","cuirH":"#7a5a3a"},
};
