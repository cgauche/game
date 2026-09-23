// HUNKS d'un diff unifié à zéro contexte (`git diff -U0`) — le SEUL lecteur de l'en-tête
// `@@ -a,b +c,d @@` de l'outillage. Feuillet PUR, sans dépendance : hooks, gardes et outils de
// `scripts/raw` l'importent sans dépendance inverse.

const EN_TETE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** @typedef {{ a: number, b: number, c: number, d: number }} EnTete  `@@ -a,b +c,d @@`, compte absent = 1 */
/** @typedef {EnTete & { retirees: string[], ajoutees: string[] }} Hunk */

/** L'en-tête de hunk d'UNE ligne de diff, ou `null`. @param {string} ligne @returns {EnTete | null} */
export function enteteDeHunk(ligne) {
  const m = EN_TETE.exec(ligne)
  if (!m) return null
  return {
    a: Number(m[1]), b: m[2] === undefined ? 1 : Number(m[2]),
    c: Number(m[3]), d: m[4] === undefined ? 1 : Number(m[4]),
  }
}

/**
 * Les hunks d'un diff `-U0`, dans l'ordre, avec leurs lignes RETIRÉES (`-`) et AJOUTÉES (`+`) sans
 * leur signe. Les lignes `\ No newline at end of file` sont ignorées ; toute autre ligne ferme le
 * hunk courant (en-tête du fichier suivant).
 * @param {string} diffU0 @returns {Hunk[]}
 */
export function hunksDe(diffU0) {
  const out = []
  let h = null
  for (const brute of String(diffU0 ?? '').split('\n')) {
    const ligne = brute.replace(/\r$/, '')
    const e = enteteDeHunk(ligne)
    if (e) { h = { ...e, retirees: [], ajoutees: [] }; out.push(h); continue }
    if (!h || ligne.startsWith('\\')) continue
    if (ligne.startsWith('-') && h.retirees.length < h.b) h.retirees.push(ligne.slice(1))
    else if (ligne.startsWith('+') && h.ajoutees.length < h.d) h.ajoutees.push(ligne.slice(1))
    else h = null
  }
  return out
}
