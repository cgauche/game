/**
 * PARALLAXE DE PROFIL — règle codifiée (2026-06-11, après la énième récidive : corne droite
 * et pointes d'épaule droite invisibles de flanc sur le Guerrier du Chaos).
 *
 * RÈGLE : tout élément LATÉRAL PAIR (cornes, épaulières, oreilles, pointes…) dessiné en vue
 * de face existe en DEUX exemplaires — de PROFIL, l'exemplaire LOINTAIN reste visible :
 * décalé vers l'avant (+x, parallaxe), assombri (tokens → variante O), légèrement transparent,
 * et peint AVANT l'exemplaire proche (qui le chevauche).
 *
 * `farSide(svgProche)` fabrique cet exemplaire lointain automatiquement — l'auteur d'art ne
 * dessine que le côté proche et appelle le helper, au lieu de se souvenir de la règle.
 * Checklist complète : docs/qc-reconnaissabilite-sprites.md (« parité de profil »).
 */

/** Tokens → variante SOMBRE (la profondeur se lit par la valeur, pas que par le décalage). */
const DARKEN: [RegExp, string][] = [
  [/@(corps|peau|vet1|vet2|cheveux|cuir|metal)H/g, '@$1'],
  [/@(corps|peau|vet1|vet2|cheveux|cuir|metal)(?![OH])/g, '@$1O'],
];

export interface FarSideOpts {
  /** décalage de parallaxe vers l'avant (+x), défaut 5. */
  dx?: number;
  /** décalage vertical, défaut 0. */
  dy?: number;
  /** opacité de l'exemplaire lointain, défaut 0.85. */
  opacity?: number;
  /** échelle (l'élément lointain paraît un peu plus petit), défaut 0.94. */
  scale?: number;
}

/** Exemplaire LOINTAIN d'un élément latéral pair, à peindre AVANT l'exemplaire proche. */
export function farSide(svgProche: string, opts: FarSideOpts = {}): string {
  const { dx = 5, dy = 0, opacity = 0.85, scale = 0.94 } = opts;
  let art = svgProche;
  for (const [re, sub] of DARKEN) art = art.replace(re, sub);
  return `<g transform="translate(${dx},${dy}) scale(${scale})" opacity="${opacity}">${art}</g>`;
}

/** Paire complète : lointain (auto) PUIS proche — l'appel d'une ligne qui évite l'oubli. */
export function lateralPair(svgProche: string, opts: FarSideOpts = {}): string {
  return farSide(svgProche, opts) + svgProche;
}
