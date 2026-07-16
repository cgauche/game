// Garde de graphie des citations RAW (#487 lot 3) — verrouille à ZÉRO la classe « chapitre-relative »
// `NN-Nom l.X` (ex. `18-Traumatisme l.417-422`) : cette forme est INVISIBLE de `ldbRe`/`otherRe`
// (_lib.mjs — les deux exigent le livre AVANT le numéro de chapitre, jamais un nom de chapitre
// collé au numéro), donc jamais comptée par `reconcile.mjs`, jamais ré-ancrée. Forme canonique :
// `LDB NN l.X` (ou `<ABRÉV> NN l.X` pour les 14 autres livres) — sans nom de chapitre.
// Zéro tolérance, PAS de baseline (le stock doit être à 0 après le lot #487) : toute occurrence
// nouvelle ou survivante fait échouer le test avec la liste `fichier:ligne`.
// Re-run : node scripts/raw/citation-graphy-guard.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SRC_DIR = 'src'
export const EXTS = ['.ts', '.tsx', '.json']

// `\b\d{1,2}-[A-Za-zÀ-ÿ]+ l\.\d+` : un numéro de chapitre (1-2 chiffres) collé par un tiret à un
// nom (lettres accentuées comprises — `\w` seul EXCLUT les accents hors mode Unicode, d'où la classe
// explicite), suivi d'une réf `l.<ligne>` — ex. `15-Déplacement l.79`, `18-Traumatisme l.417`,
// `15-Dépl l.87`. Les dates (`2026-07-15`) et ids (`ticket-42`) ne matchent pas : `\d{1,2}-` exige
// 1-2 chiffres puis un TIRET puis une LETTRE (jamais un second groupe de chiffres, jamais un id nu
// sans " l.<n>" collé juste après le nom).
export const GRAPHY_RE = () => /\b\d{1,2}-[A-Za-zÀ-ÿ]+ l\.\d+/g

function walk(dir, exts, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    let s
    try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) { if (e !== 'node_modules') walk(p, exts, acc) }
    else if (exts.some((x) => e.endsWith(x))) acc.push(p)
  }
  return acc
}

/** Scanne `srcDir` (défaut `src/`) pour la graphie chapitre-relative. Retourne
 *  `{ file, row, text }[]` — `text` = la ligne tronquée (160c) pour le diagnostic. Pur (aucune écriture). */
export function scanGraphyViolations(srcDir = SRC_DIR, exts = EXTS) {
  const violations = []
  for (const f of walk(srcDir, exts)) {
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      const re = GRAPHY_RE()
      if (re.test(ln)) violations.push({ file: f.replace(/\\/g, '/'), row: i + 1, text: ln.trim().slice(0, 160) })
    })
  }
  return violations
}

function main() {
  const v = scanGraphyViolations()
  if (v.length) {
    console.log(`citation-graphy-guard : ${v.length} graphie(s) chapitre-relative(s) trouvée(s) :`)
    for (const { file, row, text } of v) console.log(`  ${file}:${row}  ${text}`)
    process.exitCode = 1
  } else {
    console.log('citation-graphy-guard : 0 graphie chapitre-relative — classe verrouillée à zéro.')
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
