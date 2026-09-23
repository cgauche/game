// TITRES SOUDÉS d'un livre extrait (#1739) : les formes que le `.md` seul trahit d'un titre d'entrée
// mal posé ou d'un paragraphe scindé. Feuillet PUR ; ses consommateurs partagent UNE définition — la
// famille `titre-soude` de la garde de format (`scripts/raw/check-source-format.mjs`), la sonde des
// titres (`scripts/raw/sonde-titres.mjs`, candidats de la forme P, prouvés au PDF) et la réparation
// (`scripts/raw/reparer-titres.mjs`, `recoller`).
//
// Règle utilisateur, verbatim (2026-09-20) : « Il est interdit de réécrire le texte. On peut réparer
// le texte s'il est tronqué/mélangé car l'extraction n'est pas parfaite. »

/** Caractère qui, après un gras de tête, dit une prose et non un titre : minuscule, ou `:-–—(|=`. */
const suiteDeProse = (c) => (c !== c.toUpperCase() && c === c.toLowerCase()) || ':-–—(|='.includes(c)

/** P5 : ligne ouverte par un gras (sans `:`, hors repère `A)`/`12)`) que suit un texte qui n'en est pas
 *  la prose — un titre soudé à une ligne, ou la suite d'un paragraphe scindé au milieu d'un gras. PURE. */
export function estP5(ligne) {
  const m = /^\*\*([^*:]+)\*\*\s+(\S)/.exec(ligne)
  return !!m && !/^[A-Z0-9]{1,2}\)$/.test(m[1]) && !suiteDeProse(m[2])
}

/** Ligne de titre à DEUX groupes gras — deux titres soudés sur une ligne. PURE. */
export const estTitreADeuxGras = (ligne) => /^#{1,6}\s+\*\*[^*]+\*\*\s*\*\*/.test(ligne)

/** Sites d'un texte : `{ ligne, classe: 'p5' | 'deux-gras', texte }`. PURE. */
export function sitesDeTitresSoudes(texte) {
  const out = []
  texte.split('\n').forEach((l, i) => {
    if (estP5(l)) out.push({ ligne: i + 1, classe: 'p5', texte: l })
    if (estTitreADeuxGras(l)) out.push({ ligne: i + 1, classe: 'deux-gras', texte: l })
  })
  return out
}

/** L'indice de la ligne de PROSE qui précède la ligne `i` à travers UNE ligne vide au plus, si elle
 *  s'arrête au milieu d'une phrase (dernier caractère hors `*` et blancs ni `.!?:;`), sinon -1. PURE. */
export function prosePrecedenteCoupee(lignes, i) {
  const j = lignes[i - 1] === '' ? i - 2 : i - 1
  const l = lignes[j] ?? ''
  if (!l.trim() || /^(#{1,6}\s|\||- |>)/.test(l)) return -1
  return /[.!?:;]$/.test(l.replace(/[\s*]+$/, '')) ? -1 : j
}

/** Deux morceaux d'un paragraphe recollés : une espace, et le gras que le saut coupait refait UN seul
 *  (`**A** ` + `**B** x` → `**A B** x`). PURE. */
export function recoller(avant, apres) {
  const a = avant.trimEnd()
  return a.endsWith('**') && apres.startsWith('**') ? `${a.slice(0, -2)} ${apres.slice(2)}` : `${a} ${apres}`
}
