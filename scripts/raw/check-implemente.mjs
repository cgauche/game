// Détecteur de CONTRADICTION Atlas↔code (#434, cœur) : un topic dont le champ `**Implémente**`
// déclare une NON-implémentation alors qu'une des réfs RAW du topic est citée par un fichier de
// `src/`. Prémisse mesurée le 2026-07-16 (~40 marqueurs faux sur ~70 vérifiés) : le champ
// `Implémente` est écrit à la main et ment massivement — ce garde le RE-mesure en continu.
//
// Granularité CHAPITRE (miroir de check-refs.mjs/reconcile.mjs) : une réf de topic = `ABBR NN`
// (livre+chapitre), jamais la ligne — la précision fine (quelle phrase du chapitre) n'est pas
// mesurable ici et n'est pas le contrat (cf. tableau MDG 13/LDB 14/MDG 3/AA 1 du brief).
//
// TOPIC = un champ `**Implémente**` (toutes graphies : avec/sans accent, `Implémenté`, ponctuation
// `:`/`.`), header + ses puces `- ` immédiates. Ses réfs = l'UNION des réfs RAW (`LDB NN`/`<ABRÉV> NN`)
// vues depuis l'ouverture du `## ` (H2) anglobant jusqu'au champ inclus (accumulation par pile de
// frames de heading) — choix H2 délibéré : les fiches groupent parfois UN SEUL champ Implémente
// pour plusieurs sous-sections (`combat.md` « Deux armes… » couvre Mains nues + Empoignade +
// Dispersion sous UN James Implémente terminal) ; descendre au H3/H4 aurait perdu ces réfs. La
// contrepartie (mesurée acceptée) : à granularité chapitre déjà grossière, une contamination
// inter-sous-sujets du même H2 est un faux-positif résiduel possible, pas éliminé ici.
//
// PARTIEL vs DÉCLARATION (la difficulté centrale du ticket) : dans une ligne/puce du champ, le
// marqueur « non implémenté » (6+ graphies) ne vaut CONTRADICTION que s'il précède toute réf de
// code `` `src/…` ``/`` `scripts/…` `` sur la MÊME ligne (ou qu'aucune réf de code n'y figure).
// Si le code apparaît EN PREMIER puis le marqueur en aveu partiel entre parenthèses
// (`activites.md:578` : « `src/state/restFlow.ts` … n'est pas implémentée » sur un DÉTAIL), c'est
// une couverture partielle honnête — exclue par construction (mesuré : 39 déclarations franches
// contre 39 aveux partiels sur les lignes marqueur+code coexistant, cf. rendu final).
//
// Tableaux de BILAN (`## Implémente` en tableau `| Mécanique | Module | État |`) : EXCLUS par
// construction — ils ne portent aucune réf RAW propre (recense des topics déjà couverts par leur
// propre champ ailleurs dans la fiche) ; les compter doublonnerait le même topic.
//
// Art de rig (`src/gameIso/rig/parts/tenues/defs/**`) : EXCLU de la collecte « code cite » — ces
// fichiers citent un livre pour caler une TENUE sur une illustration (couverture artistique), pas
// pour appliquer une règle. Mesuré (2026-07-16) : 15 fichiers de rig citent AA, contre des
// centaines ailleurs pour les mêmes chapitres AA de règles — l'exclusion ne change AUCUN compte
// de contradiction (aucune ne reposait QUE sur du rig), gardée pour ne jamais en dépendre.
//
// Cliquet PAR FICHIER (miroir check-refs.mjs `assertAgainstBaseline`) : `implemente-contradiction-baseline.json`.
// Re-run : node scripts/raw/check-implemente.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ldbRe, otherRe, bookOf } from './_lib.mjs'

export const RAWDIR = 'docs/raw'
export const EXCLUDE_DOCS = new Set(['coverage.md', 'reconciliation.md', 'reanchor.md'])
export const SRC_DIR = 'src'
export const EXCLUDE_SRC_PREFIX = 'src/gameIso/rig/parts/tenues/defs/' // art de couverture, pas une règle
export const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'implemente-contradiction-baseline.json')

const FIELD_RE = /\*\*Impl[ée]ment[ée]?\s*[:.]?\*\*\s*[:.]?\s*(.*)$/
const HEADING_RE = /^(#{1,6})\s+/
const NONIMPL_RE = /non[- ]impl[ée]ment[ée]?s?\b|n['’]est pas impl[ée]ment[ée]?s?\b|non c[âa]bl[ée]?s?\b/i
const CODE_RE = /`(?:src|scripts)\//

/** Réfs `ABBR NN` (canonique, granularité chapitre) présentes sur une ligne. */
function refsInLine(ln) {
  const out = []
  const ldb = ldbRe()
  let m
  while ((m = ldb.exec(ln))) out.push(`LDB ${Number(m[1])}`)
  const other = otherRe()
  while ((m = other.exec(ln))) {
    if (m[2] == null) continue
    const book = bookOf(m[1].replace(/\s+/g, ' ').trim())
    if (book) out.push(`${book} ${Number(m[2])}`)
  }
  return out
}

/** Une ligne (header ou puce) du champ Implémente « déclare non implémenté » ssi le marqueur
 *  précède toute réf de code sur la MÊME ligne, ou qu'aucune réf de code n'y figure du tout. */
export function declaresNonImpl(text) {
  const mi = text.search(NONIMPL_RE)
  if (mi < 0) return false
  const ci = text.search(CODE_RE)
  return ci < 0 || mi < ci
}

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

/** Réfs `ABBR NN` citées par `src/**` (hors art de rig), avec 1 échantillon fichier:ligne chacune. */
export function collectCodeRefs(srcDir = SRC_DIR) {
  const refs = new Map() // 'ABBR NN' -> { file, row, text }
  const files = walk(srcDir, ['.ts', '.tsx', '.json'])
  for (const f of files) {
    const rel = f.replace(/\\/g, '/')
    if (rel.startsWith(EXCLUDE_SRC_PREFIX)) continue
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      for (const r of refsInLine(ln)) {
        if (!refs.has(r)) refs.set(r, { file: rel, row: i + 1, text: ln.trim().slice(0, 160) })
      }
    })
  }
  return refs
}

/** Occurrences « topic déclaré non implémenté » (marqueur avant tout code, sur sa ligne),
 *  avec les réfs du topic anglobant (pile de frames par heading, portée H2 — voir tête de fichier). */
export function scanDeclarations(rawDir = RAWDIR, exclude = EXCLUDE_DOCS) {
  const out = []
  const docs = readdirSync(rawDir).filter((f) => f.endsWith('.md') && !exclude.has(f))
  for (const doc of docs) {
    const lines = readFileSync(join(rawDir, doc), 'utf8').split('\n')
    const frames = [{ level: 0, refs: new Set() }]
    let h2Frame = null
    let i = 0
    while (i < lines.length) {
      const ln = lines[i]
      const h = HEADING_RE.exec(ln)
      if (h) {
        const level = h[1].length
        while (frames.length > 1 && frames[frames.length - 1].level >= level) frames.pop()
        const frame = { level, refs: new Set() }
        frames.push(frame)
        if (level === 2) h2Frame = frame
        i++
        continue
      }
      for (const r of refsInLine(ln)) for (const f of frames) f.refs.add(r)

      const fm = FIELD_RE.exec(ln)
      if (fm) {
        const items = []
        const head = fm[1].trim()
        if (head) items.push({ row: i + 1, text: head })
        let j = i + 1
        while (j < lines.length && /^\s*-\s/.test(lines[j])) {
          for (const r of refsInLine(lines[j])) for (const f of frames) f.refs.add(r)
          items.push({ row: j + 1, text: lines[j].trim() })
          j++
        }
        const refSet = h2Frame ? h2Frame.refs : frames[frames.length - 1].refs
        for (const item of items) {
          if (!declaresNonImpl(item.text)) continue
          out.push({ doc, row: item.row, text: item.text.slice(0, 220), refs: [...refSet] })
        }
        i = j
        continue
      }
      i++
    }
  }
  return out
}

/** Croise déclarations « non implémenté » × réfs citées par le code → contradictions. */
export function scanContradictions({ rawDir = RAWDIR, srcDir = SRC_DIR } = {}) {
  const codeRefs = collectCodeRefs(srcDir)
  const declarations = scanDeclarations(rawDir)
  const contradictions = []
  for (const d of declarations) {
    const hits = d.refs.filter((r) => codeRefs.has(r))
    if (!hits.length) continue
    contradictions.push({ ...d, hits: hits.map((r) => ({ ref: r, ...codeRefs.get(r) })) })
  }
  return contradictions
}

/** Compte de contradictions PAR FICHIER (unité du cliquet). */
export function countsByDoc(contradictions) {
  const counts = {}
  for (const c of contradictions) counts[c.doc] = (counts[c.doc] ?? 0) + 1
  return counts
}

/** Miroir de `check-refs.mjs` : hausse ET baseline périmée sont des anomalies. */
export function assertAgainstBaseline(counts, baseline) {
  const over = []
  for (const [k, n] of Object.entries(counts)) {
    const b = baseline[k] ?? 0
    if (n > b) over.push(`${k} : ${n} (baseline ${b})`)
  }
  const stale = []
  for (const [k, b] of Object.entries(baseline)) {
    const n = counts[k] ?? 0
    if (n < b) stale.push(`${k} : baseline ${b}, réel ${n}`)
  }
  return { over, stale }
}

function main() {
  const contradictions = scanContradictions()
  const counts = countsByDoc(contradictions)
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const { over, stale } = assertAgainstBaseline(counts, baseline)

  console.log(`contradictions Atlas↔code (« non implémenté » déclaré + réf citée par src/) : ${contradictions.length}`)
  for (const [doc, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${doc} : ${n}`)

  if (over.length) {
    console.log('RÉGRESSION — hausse de contradictions par fichier :')
    for (const o of over) console.log(`  ${o}`)
  }
  if (stale.length) {
    console.log('Baseline(s) PÉRIMÉE(s) (contradictions corrigées) — à ABAISSER dans implemente-contradiction-baseline.json :')
    for (const s of stale) console.log(`  ${s}`)
  }
  if (!over.length && !stale.length) {
    console.log('OK — cliquet aligné, aucune régression.')
  } else {
    console.log('Détail (doc:ligne — texte du champ — réf(s) citée(s) par le code) :')
    for (const c of contradictions)
      console.log(`docs/raw/${c.doc}:${c.row} — ${c.text} — ${c.hits.map((h) => `${h.ref} (${h.file}:${h.row})`).join(', ')}`)
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
