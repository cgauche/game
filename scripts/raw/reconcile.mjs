// Réconciliation déterministe CODE ↔ ATLAS RAW.
// Sens A (code → Atlas) : toute réf de règle citée dans src/ (`LDB NN l.X`) dont le chapitre
//   n'est PAS couvert par l'Atlas (trou dur), ou dont la ligne n'est pinée par aucune citation
//   Atlas du même chapitre à ±TOL (trou fin) → l'app applique une règle absente de l'Atlas.
// Sens B (Atlas → code) : règles citées par l'Atlas marquées `(non implémenté)`, et chapitres
//   cités par l'Atlas mais jamais référencés dans le code → l'Atlas décrit une règle hors-code.
// Sortie : docs/raw/reconciliation.md  ·  Re-run : node scripts/raw/reconcile.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ldbRe, otherRe, span } from './_lib.mjs'

const TOL = 20 // tolérance en lignes : la synthèse Atlas pine un ancrage proche, pas la ligne exacte

function walk(dir, exts, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    let s; try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) { if (e !== 'node_modules') walk(p, exts, acc) }
    else if (exts.some((x) => e.endsWith(x))) acc.push(p)
  }
  return acc
}

const SRC = walk('src', ['.ts', '.tsx', '.json'])
const RAWDIR = 'docs/raw'
const DOCS = readdirSync(RAWDIR)
  .filter((f) => f.endsWith('.md') && !['coverage.md', 'reconciliation.md'].includes(f))
  .map((f) => join(RAWDIR, f))

// --- regex de réfs (source unique : _lib.mjs ; instances stateful /g locales) ---
const LDB_RE = ldbRe()
const OTHER_RE = otherRe()

// === collecte CODE ===
const codeLDB = new Map()   // ch -> [{line, file, text}]  (réfs ligne strictes)
const codeOther = new Map() // book -> Set(line)
const codeCh = new Set()    // tout chapitre mentionné (lâche : `LDB NN`, même sans `l.X` adjacent / page / titre intercalé)
for (const f of SRC) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/\bLDB (\d+)\b/g)) codeCh.add(m[1])
  const lines = text.split('\n')
  lines.forEach((ln, i) => {
    let m
    LDB_RE.lastIndex = 0
    while ((m = LDB_RE.exec(ln))) {
      const ch = m[1], start = Number(m[2])
      if (!codeLDB.has(ch)) codeLDB.set(ch, [])
      codeLDB.get(ch).push({ line: start, file: f.replace(/\\/g, '/'), row: i + 1, text: ln.trim().slice(0, 160) })
    }
    OTHER_RE.lastIndex = 0
    while ((m = OTHER_RE.exec(ln))) {
      const book = m[1].replace(/\s+/g, ' ').trim()
      if (!codeOther.has(book)) codeOther.set(book, new Set())
      codeOther.get(book).add(Number(m[3]))
    }
  })
}

// === collecte ATLAS ===
const atlasLDB = new Map()  // ch -> [[lo,hi], …]
const atlasOther = new Set()
const atlasCh = new Set()   // tout chapitre cité (lâche)
const catalogCh = new Set() // chapitres couverts par un catalogue (données verbatim, niveau chapitre)
const docOwnerOfCh = new Map() // ch -> doc (le + de réfs)
const ownerCount = new Map()
for (const d of DOCS) {
  const text = readFileSync(d, 'utf8')
  for (const mm of text.matchAll(/\bLDB (\d+)\b/g)) atlasCh.add(mm[1])
  if (/catalogue-/.test(d)) for (const mm of text.matchAll(/\bLDB (\d+)\b/g)) catalogCh.add(mm[1])
  let m
  LDB_RE.lastIndex = 0
  while ((m = LDB_RE.exec(text))) {
    const ch = m[1]
    if (!atlasLDB.has(ch)) atlasLDB.set(ch, [])
    atlasLDB.get(ch).push(span(m[2], m[3]))
    const key = ch + '|' + d
    ownerCount.set(key, (ownerCount.get(key) || 0) + 1)
    if (!docOwnerOfCh.has(ch) || ownerCount.get(key) > ownerCount.get(ch + '|' + docOwnerOfCh.get(ch)))
      docOwnerOfCh.set(ch, d)
  }
  OTHER_RE.lastIndex = 0
  while ((m = OTHER_RE.exec(text))) atlasOther.add(m[1].replace(/\s+/g, ' ').trim())
}

const covered = (ch, line) => (atlasLDB.get(ch) || []).some(([lo, hi]) => line >= lo - TOL && line <= hi + TOL)

// === SENS A : code → Atlas ===
const hardA = []  // chapitres dans le code, absents de l'Atlas
const softA = []  // chapitres couverts, lignes non pinées
for (const [ch, refs] of [...codeLDB].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const uniqLines = [...new Set(refs.map((r) => r.line))].sort((a, b) => a - b)
  if (!atlasCh.has(ch)) {
    hardA.push({ ch, count: refs.length, lines: uniqLines, sample: refs.slice(0, 4) })
  } else if (catalogCh.has(ch)) {
    // chapitre couvert par un catalogue (données verbatim au niveau chapitre) — pas un trou de ligne
  } else {
    const miss = uniqLines.filter((l) => !covered(ch, l))
    if (miss.length) {
      // un exemple de code par ligne manquante
      const ex = miss.map((l) => refs.find((r) => r.line === l)).filter(Boolean)
      softA.push({ ch, missCount: miss.length, totalLines: uniqLines.length, ex })
    }
  }
}

// === SENS B : Atlas → code ===
// (1) marqueurs (non implémenté)
const nonImpl = []
for (const d of DOCS) {
  const lines = readFileSync(d, 'utf8').split('\n')
  lines.forEach((ln, i) => {
    if (/non impl[ée]ment[ée]/i.test(ln)) nonImpl.push({ doc: d.split('/').pop(), row: i + 1, text: ln.trim().slice(0, 200) })
  })
}
// (2) chapitres LDB cités par l'Atlas mais jamais dans le code
const atlasOnly = [...atlasCh].filter((ch) => !codeCh.has(ch)).sort((a, b) => Number(a) - Number(b))

// === RAPPORT ===
const L = []
L.push('# Atlas RAW — Réconciliation CODE ↔ ATLAS', '')
L.push('> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l\'app applique', '> (réfs `LDB NN l.X` dans `src/`) absentes de l\'Atlas. **Sens B** = règles que l\'Atlas décrit', `> hors du code. Tolérance ligne = ±${TOL}.`, '')
L.push(`**Sens A — code → Atlas** : ${hardA.length} chapitre(s) cités par le code & absents de l'Atlas · ${softA.length} chapitre(s) couverts avec des lignes non pinées.`)
L.push(`**Sens B — Atlas → code** : ${nonImpl.length} marqueur(s) « (non implémenté) » · ${atlasOnly.length} chapitre(s) LDB cités par l'Atlas jamais référencés dans le code.`, '')

L.push('## A1 — Chapitres appelés par le CODE, ABSENTS de l\'Atlas (trous durs)', '')
if (!hardA.length) L.push('_Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche._', '')
else for (const h of hardA) {
  L.push(`### LDB ${h.ch} — ${h.count} réf(s) code, 0 dans l'Atlas`)
  for (const s of h.sample) L.push(`- \`${s.file}:${s.row}\` (l.${s.line}) — ${s.text}`)
  L.push('')
}

L.push('## A2 — Lignes appelées par le CODE non pinées par l\'Atlas (chapitre couvert, règle peut-être survolée)', '')
if (!softA.length) L.push('_Aucune._', '')
else for (const s of softA.sort((a, b) => b.missCount - a.missCount)) {
  const owner = (docOwnerOfCh.get(s.ch) || '').split('/').pop()
  L.push(`### LDB ${s.ch} — ${s.missCount}/${s.totalLines} ligne(s) code hors couverture (propriétaire : ${owner})`)
  for (const r of s.ex.slice(0, 12)) L.push(`- l.${r.line} — \`${r.file}:${r.row}\` — ${r.text}`)
  if (s.ex.length > 12) L.push(`- … +${s.ex.length - 12} autres`)
  L.push('')
}

L.push('## B1 — Règles décrites par l\'Atlas marquées « (non implémenté) »', '')
if (!nonImpl.length) L.push('_Aucun marqueur._', '')
else for (const n of nonImpl) L.push(`- **${n.doc}** L${n.row} — ${n.text}`)
L.push('')

L.push('## B2 — Chapitres LDB cités par l\'Atlas, jamais référencés dans le code', '')
if (!atlasOnly.length) L.push('_Aucun._', '')
else L.push(atlasOnly.map((c) => `LDB ${c}`).join(' · '), '')

L.push('## Autres livres', '')
L.push(`Code : ${[...codeOther.keys()].sort().join(', ') || '—'}`)
L.push(`Atlas : ${[...atlasOther].sort().join(', ') || '—'}`, '')

writeFileSync(join(RAWDIR, 'reconciliation.md'), L.join('\n'))
console.log(`Sens A : ${hardA.length} trous durs · ${softA.length} chapitres à lignes non pinées`)
console.log(`Sens B : ${nonImpl.length} (non implémenté) · ${atlasOnly.length} chapitres Atlas hors-code`)
console.log(`code LDB chapitres: ${codeLDB.size} · atlas LDB chapitres: ${atlasLDB.size} · autres livres code: ${[...codeOther.keys()].join('/')}`)
