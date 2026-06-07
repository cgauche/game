// Yeux réutilisables des têtes monstrueuses (helpers d'interpolation SVG, repère os `tete`).
// Partagés par les têtes peaux-vertes / hommes-bêtes / gros (orc, gobelin, caprin, taureau,
// ogre, démon) et la tête de rat. Garder DRY : un seul endroit pour le regard prédateur.

/** Œil de prédateur : iris jaune-orangé luisant, pupille ronde sombre (orc/gobelin/bête). */
export const beastEye = (x: number, cy = 5, rx = 1.7, ry = 1.9) =>
  `<ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f2a81e"/><circle cx="${x}" cy="${cy}" r="${rx * 0.5}" fill="#160a04"/><circle cx="${x + 0.4}" cy="${cy - 0.5}" r="0.35" fill="#fff" opacity="0.6"/>`;

/** Œil de skaven MAUVAIS : petit, jaune luisant à pupille fendue verticale (canon WHFB). */
export const ratEye = (x: number) =>
  `<ellipse cx="${x}" cy="5" rx="1.7" ry="1.5" fill="#e6a017"/><ellipse cx="${x}" cy="5" rx="0.55" ry="1.5" fill="#180a04"/><circle cx="${x + 0.5}" cy="4.4" r="0.35" fill="#fff" opacity="0.6"/>`;
