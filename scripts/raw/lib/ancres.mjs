// L'ANCRE D'UN TITRE DE L'ATLAS — définition UNIQUE (#1824).
//
// Une page de `docs/raw/` se lit en Markdown rendu : ses renvois internes (`](#un-titre)`,
// `](autre.md#un-titre)`) visent l'ancre que le RENDU pose sur un heading. Cette ancre se CALCULE
// ici, et nulle part ailleurs : l'assembleur des fiches l'ADRESSE pour écrire son Sommaire, la garde
// `check-ancres.mjs` l'ADRESSE pour juger un renvoi, l'outil `reparer-ancres.mjs` pour replier une
// cible citée. Une page, un cœur, une classe de page, un générateur de liens de plus : zéro ligne
// ici.
//
// SOURCE de la règle : le filtre TOC de html-pipeline (la grammaire d'ancre du Markdown rendu de
// GitHub) — texte RENDU du titre, minuscules, retrait de tout caractère hors
// `[\p{L}\p{M}\p{N}\p{Pc}\- ]` (le `_` et les accents RESTENT, `✅ — ’ → & /` partent), chaque espace
// devient `-` SANS fusion ni rognage, et les homonymes d'une même page reçoivent `-1`, `-2` dans
// l'ordre de la page.
// Le texte RENDU, et non la ligne brute : c'est le rendu qui résout `**gras**`, `_ital_`, un lien,
// un code span et une balise HTML — la règle de caractères, elle, ne connaît ni `*` ni `<`.
// Module PUR (aucun accès disque), chargé tel quel par Node nu comme par vitest.
import { sansBlocsDeCode } from '../../guards/lib/liensMarkdown.mjs'

/** Caractères que la règle RETIRE : tout ce qui n'est ni lettre, ni marque, ni chiffre, ni
 *  `_`-et-consorts (`\p{Pc}`), ni `-`, ni espace. */
const HORS_ANCRE = /[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu
/** Ligne de titre ATX (`# …` … `###### …`), le corps du titre capturé tel qu'il est écrit. */
const LIGNE_DE_TITRE = /^(#{1,6})\s+(.*)$/
/** Attribut `id="…"` d'une balise HTML — le SECOND espace d'ancres d'une page (les catalogues
 *  posent `<span id="page-N-0">` par folio). */
const ID_HTML = /\bid="([^"]+)"/g

/**
 * Le texte RENDU d'un titre : ce que le lecteur VOIT une fois le Markdown inline résolu.
 * @param {string} titre corps de la ligne de titre, `#` d'ouverture retiré
 * @returns {string}
 */
export function texteRenduDeTitre(titre) {
  return String(titre ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(^|\s)_{1,3}([^_]+)_{1,3}(?=\s|$)/g, '$1$2')
    .replace(/\s*#+\s*$/, '')
    .trim()
}

/**
 * L'ancre d'un titre, HORS doublon (c'est la page qui suffixe ses homonymes, cf. `ancresDePage`).
 * @param {string} titre corps de la ligne de titre
 * @returns {string}
 */
export const ancreDeTitre = (titre) =>
  texteRenduDeTitre(titre).toLowerCase().replace(HORS_ANCRE, '').replace(/ /g, '-')

/**
 * Les ancres de HEADING d'une page, dans l'ordre du document, homonymes suffixés (`-1`, `-2`…).
 * Les blocs de code sont retirés (un titre d'exemple n'ancre rien) en PRÉSERVANT le compte de
 * lignes — la `ligne` rendue est celle du document.
 * @param {string} markdown contenu de la page
 * @returns {Array<{ ancre: string, titre: string, niveau: number, ligne: number }>}
 */
export function ancresDePage(markdown) {
  const vus = new Map()
  const ancres = []
  sansBlocsDeCode(markdown).split('\n').forEach((ligne, i) => {
    const m = LIGNE_DE_TITRE.exec(ligne)
    if (!m) return
    const titre = m[2].trim()
    const base = ancreDeTitre(titre)
    const rang = (vus.get(base) ?? -1) + 1
    vus.set(base, rang)
    ancres.push({ ancre: rang === 0 ? base : `${base}-${rang}`, titre, niveau: m[1].length, ligne: i + 1 })
  })
  return ancres
}

/**
 * Les ancres HTML d'une page — tout `id="…"` posé hors bloc de code, dans l'ordre du document.
 * @param {string} markdown contenu de la page
 * @returns {Array<{ ancre: string, ligne: number }>}
 */
export function idsHtmlDePage(markdown) {
  const ids = []
  sansBlocsDeCode(markdown).split('\n').forEach((ligne, i) => {
    for (const m of ligne.matchAll(ID_HTML)) ids.push({ ancre: m[1], ligne: i + 1 })
  })
  return ids
}

/**
 * LA TABLE des ancres d'une page : ses headings ET ses `id=` HTML — l'ensemble qu'un renvoi doit
 * désigner. C'est cette table, jamais une des deux moitiés, que la garde adresse.
 * @param {string} markdown contenu de la page
 * @returns {Set<string>}
 */
export const tableDAncres = (markdown) =>
  new Set([...ancresDePage(markdown).map((a) => a.ancre), ...idsHtmlDePage(markdown).map((i) => i.ancre)])
