// Ancre de page folioée et ancre de page VIDE : la page qu'elle ouvre n'a aucun texte au `.md`
// (planche, intercalaire, page dont le texte est ailleurs). SOURCE UNIQUE du motif `data-folio` et du
// prédicat `ancreVide`. Lecteurs : la découpe (`decoupe.ts`, motif et prédicat) et les ancres de
// `scripts/guards/lib/folioLineAlign.mjs` (motif).
//
// Module FEUILLE (zéro import), PUR, chargé tel quel par Node nu et par vitest.

const ATTR = 'data-folio="(-?\\d+)"';

/** Attribut de folio `data-folio="N"` (N signé : `-1` existe) : `m[1]` = le folio. */
export const FOLIO_ATTR = new RegExp(ATTR, 'g');

/** Ancre de page folioée `<span … data-folio="N" …></span>` : `m[1]` = le folio. */
export const ANCRE_FOLIO = new RegExp(`<span[^>]*${ATTR}[^>]*>\\s*</span>`, 'g');

const ANCRE_SUIVANTE = new RegExp(`<span[^>]*${ATTR}`);
const SPAN_VIDE = /<span[^>]*>\s*<\/span>/g;
// `\s` couvre insécables et BOM en JS ; la largeur nulle U+200B, non.
const BLANCS = /[\s\u200B]+/g;

/**
 * L'ancre qui finit à l'index `fin` de `texte` est-elle VIDE ? Rien d'autre que des blancs et des
 * `<span>` vides entre elle et l'ancre folioée suivante, ou la FIN du texte. PURE.
 */
export function ancreVide(texte: string, fin: number): boolean {
  const reste = texte.slice(fin);
  const suivante = ANCRE_SUIVANTE.exec(reste);
  const entre = suivante ? reste.slice(0, suivante.index) : reste;
  return entre.replace(SPAN_VIDE, '').replace(BLANCS, '') === '';
}
