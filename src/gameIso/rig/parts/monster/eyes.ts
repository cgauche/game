// Yeux réutilisables des têtes monstrueuses (helpers d'interpolation SVG, repère os `tete`).
// Partagés par les têtes peaux-vertes / hommes-bêtes / gros (orc, gobelin, caprin, taureau,
// ogre, démon) et la tête de rat. Garder DRY : un seul endroit pour le regard prédateur.

/** Œil de prédateur : iris jaune-orangé luisant, pupille ronde sombre (orc/gobelin/bête). */
export const beastEye = (x: number, cy = 5, rx = 1.7, ry = 1.9) =>
  `<ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#f2a81e"/><circle cx="${x}" cy="${cy}" r="${rx * 0.5}" fill="#160a04"/><circle cx="${x + 0.4}" cy="${cy - 0.5}" r="0.35" fill="#fff" opacity="0.6"/>`;

/** Œil de skaven MAUVAIS : petit, jaune luisant à pupille fendue verticale (canon WHFB). */
export const ratEye = (x: number) =>
  `<ellipse cx="${x}" cy="5" rx="1.7" ry="1.5" fill="#e6a017"/><ellipse cx="${x}" cy="5" rx="0.55" ry="1.5" fill="#180a04"/><circle cx="${x + 0.5}" cy="4.4" r="0.35" fill="#fff" opacity="0.6"/>`;

/** Œil CAPRIN : pupille HORIZONTALE en barre (chèvre/taureau) — fini le regard globuleux. */
export const goatEye = (x: number, cy = 5, rx = 1.7, ry = 1.4) =>
  `<ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#d8a226"/><rect x="${(x - rx * 0.72).toFixed(2)}" y="${(cy - ry * 0.32).toFixed(2)}" width="${(rx * 1.44).toFixed(2)}" height="${(ry * 0.64).toFixed(2)}" rx="${(ry * 0.3).toFixed(2)}" fill="#160a04"/>`;

/** Œil de BRAISE (démon) : fente orange incandescente sous une arcade furieuse (sourcil
 *  abaissé côté nez), sans blanc. `x` signé : le sourcil se miroite selon le côté. */
export const emberEye = (x: number, cy = 4, rx = 1.8) => {
  const inner = x < 0 ? x + rx : x - rx;   // côté nez
  const outer = x < 0 ? x - rx : x + rx;   // côté tempe
  return `<path d="M${(x - rx).toFixed(2)} ${cy} Q${x} ${(cy - rx * 0.9).toFixed(2)} ${(x + rx).toFixed(2)} ${cy} Q${x} ${(cy + rx * 0.7).toFixed(2)} ${(x - rx).toFixed(2)} ${cy} Z" fill="#ff7a18"/>`
    + `<circle cx="${x}" cy="${cy}" r="${(rx * 0.32).toFixed(2)}" fill="#fff2ae" opacity="0.9"/>`
    + `<path d="M${outer.toFixed(2)} ${(cy - rx * 1.4).toFixed(2)} L${inner.toFixed(2)} ${(cy - rx * 0.55).toFixed(2)}" stroke="#160a04" stroke-width="1" stroke-linecap="round"/>`;
};
