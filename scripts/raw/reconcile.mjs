// Réconciliation déterministe CODE ↔ ATLAS RAW.
// Sens A (code → Atlas) : toute réf de règle citée dans src/ (`LDB NN l.X`, et pour les 14 autres
//   livres `<ABRÉV> NN l.X`) dont le chapitre n'est PAS couvert par l'Atlas (trou dur), ou dont la
//   ligne n'est pinée par aucune citation Atlas du même chapitre à ±TOL (trou fin) → l'app applique
//   une règle absente de l'Atlas. Étendu aux 14 livres hors LDB (#434 défaut 9) : `codeOther`/
//   `atlasOther` indexent désormais PAR CHAPITRE (miroir de `codeLDB`/`atlasLDB`), plus une loose
//   scan `atlasOtherChLoose` (miroir de `atlasCh`) faute d'export d'une alternation tolérante par
//   `_lib.mjs` (otherRe() couvre les graphies tronquées — Midd\w*, ADE ?[12]… — non ré-exposées ;
//   `atlasOtherChLoose` ne teste que l'abréviation CANONIQUE de BOOKS, pas ces graphies).
// Sens B (Atlas → code) : règles citées par l'Atlas marquées `(non implémenté)`, et chapitres
//   cités par l'Atlas mais jamais référencés dans le code → l'Atlas décrit une règle hors-code.
//   (Sens B reste borné au LDB — hors périmètre #434 défaut 9.)
// Sortie : docs/raw/reconciliation.md  ·  Re-run : node scripts/raw/reconcile.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ldbRe, otherRe, span, BOOKS, esc, bookOf } from './_lib.mjs'

export const TOL = 20 // tolérance en lignes : la synthèse Atlas pine un ancrage proche, pas la ligne exacte
export const RAWDIR = 'docs/raw'

function walk(dir, exts, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    let s; try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) { if (e !== 'node_modules') walk(p, exts, acc) }
    else if (exts.some((x) => e.endsWith(x))) acc.push(p)
  }
  return acc
}

// Regex loose « BOOK NN » par livre CANONIQUE (miroir de `/\bLDB (\d+)\b/g`) — construite depuis
// `BOOKS` (export `_lib.mjs`), abréviation canonique seule (voir note de tête sur la couverture partielle).
const OTHER_LOOSE_RE = new Map(
  BOOKS.filter(([abbr]) => abbr !== 'LDB').map(([abbr]) => [abbr, new RegExp(`\\b${esc(abbr)} (?:ch\\.)?(\\d+)\\b`, 'g')])
)

// Clé de chapitre canonique pour le Sens A « autres livres » (#434 défaut 9 suite) : le code écrit
// le numéro zéro-préfixé (`AA 02`, `ADE II ch.03`), l'Atlas écrit les titres sans préfixe (`## [AA 2]`,
// `## [ADE II 3]`) — comparaison textuelle brute = faux trou. Normalise aux DEUX collectes (code ET
// Atlas), miroir de `String(Number(nn))` déjà appliqué par `chapterFile` (_lib.mjs) pour résoudre le
// fichier. Le LDB (codeLDB/atlasLDB) n'en a pas besoin : `ldbRe` capture le numéro tel quel et le LDB
// est cité uniformément — ne pas y toucher.
const chKey = (n) => String(Number(n))

/** Calcule la réconciliation CODE↔ATLAS. Pur vis-à-vis de l'écriture de fichier (aucun writeFileSync ici). */
export function computeReconciliation({ srcDir = 'src', rawDir = RAWDIR } = {}) {
  const SRC = walk(srcDir, ['.ts', '.tsx', '.json'])
  const DOCS = readdirSync(rawDir)
    .filter((f) => f.endsWith('.md') && !['coverage.md', 'reconciliation.md'].includes(f))
    .map((f) => join(rawDir, f))

  // --- regex de réfs (source unique : _lib.mjs ; instances stateful /g locales) ---
  const LDB_RE = ldbRe()
  const OTHER_RE = otherRe()

  // === collecte CODE ===
  const codeLDB = new Map()      // ch -> [{line, file, row, text}]  (réfs ligne strictes)
  const codeOther = new Map()    // book -> ch -> [{line, file, row, text}]
  const codeOtherNoCh = new Map() // book -> [{line, file, row, text}]  (réfs SANS chapitre : `AA l.4395`)
  const codeCh = new Set()       // tout chapitre LDB mentionné (lâche)
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
        const book = bookOf(m[1].replace(/\s+/g, ' ').trim())
        if (!book) continue
        const rec = { line: Number(m[3]), file: f.replace(/\\/g, '/'), row: i + 1, text: ln.trim().slice(0, 160) }
        if (m[2] == null) {
          if (!codeOtherNoCh.has(book)) codeOtherNoCh.set(book, [])
          codeOtherNoCh.get(book).push(rec)
        } else {
          if (!codeOther.has(book)) codeOther.set(book, new Map())
          const chMap = codeOther.get(book)
          const ch = chKey(m[2])
          if (!chMap.has(ch)) chMap.set(ch, [])
          chMap.get(ch).push(rec)
        }
      }
    })
  }

  // === collecte ATLAS ===
  const atlasLDB = new Map()      // ch -> [[lo,hi], …]
  const atlasOther = new Map()    // book -> ch -> [[lo,hi], …]
  const atlasOtherChLoose = new Map() // book(canonique) -> Set(ch)  — mention lâche, miroir de atlasCh
  const catalogOtherCh = new Map()    // book(canonique) -> Set(ch)  — chapitres couverts par un catalogue
  const atlasCh = new Set()       // tout chapitre LDB cité (lâche)
  const catalogCh = new Set()     // chapitres LDB couverts par un catalogue (données verbatim, niveau chapitre)
  const docOwnerOfCh = new Map()  // ch -> doc (le + de réfs)
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
    for (const [abbr, re] of OTHER_LOOSE_RE) {
      re.lastIndex = 0
      for (const mm of text.matchAll(re)) {
        const ch = chKey(mm[1])
        if (!atlasOtherChLoose.has(abbr)) atlasOtherChLoose.set(abbr, new Set())
        atlasOtherChLoose.get(abbr).add(ch)
        if (/catalogue-/.test(d)) {
          if (!catalogOtherCh.has(abbr)) catalogOtherCh.set(abbr, new Set())
          catalogOtherCh.get(abbr).add(ch)
        }
      }
    }
    OTHER_RE.lastIndex = 0
    while ((m = OTHER_RE.exec(text))) {
      if (m[2] == null) continue // réf Atlas sans chapitre : pas d'unité chapitre à indexer
      const book = bookOf(m[1].replace(/\s+/g, ' ').trim())
      if (!book) continue
      if (!atlasOther.has(book)) atlasOther.set(book, new Map())
      const chMap = atlasOther.get(book)
      const ch = chKey(m[2])
      if (!chMap.has(ch)) chMap.set(ch, [])
      chMap.get(ch).push(span(m[3], ''))
    }
  }

  const covered = (ch, line) => (atlasLDB.get(ch) || []).some(([lo, hi]) => line >= lo - TOL && line <= hi + TOL)
  const coveredOther = (book, ch, line) =>
    ((atlasOther.get(book) || new Map()).get(ch) || []).some(([lo, hi]) => line >= lo - TOL && line <= hi + TOL)

  // === SENS A (LDB) : code → Atlas ===
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
        const ex = miss.map((l) => refs.find((r) => r.line === l)).filter(Boolean)
        softA.push({ ch, missCount: miss.length, totalLines: uniqLines.length, ex })
      }
    }
  }

  // === SENS A (14 autres livres) : code → Atlas — miroir du bloc LDB ci-dessus ===
  const hardAOther = []
  const softAOther = []
  for (const [book, chMap] of [...codeOther].sort((a, b) => a[0].localeCompare(b[0]))) {
    const looseCh = atlasOtherChLoose.get(book) || new Set()
    const catalogChSet = catalogOtherCh.get(book) || new Set()
    for (const [ch, refs] of [...chMap].sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]))) {
      const uniqLines = [...new Set(refs.map((r) => r.line))].sort((a, b) => a - b)
      if (!looseCh.has(ch)) {
        hardAOther.push({ book, ch, count: refs.length, lines: uniqLines, sample: refs.slice(0, 4) })
      } else if (catalogChSet.has(ch)) {
        // chapitre couvert par un catalogue — pas un trou de ligne (miroir catalogCh)
      } else {
        const miss = uniqLines.filter((l) => !coveredOther(book, ch, l))
        if (miss.length) {
          const ex = miss.map((l) => refs.find((r) => r.line === l)).filter(Boolean)
          softAOther.push({ book, ch, missCount: miss.length, totalLines: uniqLines.length, ex })
        }
      }
    }
  }

  // Résumé par livre (le compte central du #434 défaut 9)
  const bookStats = new Map()
  const bump = (book, key) => {
    if (!bookStats.has(book)) bookStats.set(book, { hard: 0, soft: 0, noCh: 0 })
    bookStats.get(book)[key]++
  }
  for (const h of hardAOther) bump(h.book, 'hard')
  for (const s of softAOther) bump(s.book, 'soft')
  for (const [book, refs] of codeOtherNoCh) {
    if (!bookStats.has(book)) bookStats.set(book, { hard: 0, soft: 0, noCh: 0 })
    bookStats.get(book).noCh = refs.length
  }

  // === SENS B (LDB uniquement — hors périmètre #434 défaut 9) : Atlas → code ===
  const nonImpl = []
  for (const d of DOCS) {
    const lines = readFileSync(d, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      if (/non impl[ée]ment[ée]/i.test(ln)) nonImpl.push({ doc: d.split('/').pop(), row: i + 1, text: ln.trim().slice(0, 200) })
    })
  }
  const atlasOnly = [...atlasCh].filter((ch) => !codeCh.has(ch)).sort((a, b) => Number(a) - Number(b))

  const codeOtherBooks = new Set([...codeOther.keys(), ...codeOtherNoCh.keys()])
  const atlasOtherBooks = new Set([...atlasOther.keys(), ...atlasOtherChLoose.keys()])

  return {
    hardA, softA, docOwnerOfCh, nonImpl, atlasOnly,
    hardAOther, softAOther, codeOtherNoCh, bookStats,
    codeOtherBooks, atlasOtherBooks,
  }
}

/** Rend le Markdown `docs/raw/reconciliation.md` — pur (aucun accès fichier). */
export function renderReport(data) {
  const { hardA, softA, docOwnerOfCh, nonImpl, atlasOnly, hardAOther, softAOther, codeOtherNoCh, bookStats, codeOtherBooks, atlasOtherBooks } = data
  const noChapterCount = [...codeOtherNoCh.values()].reduce((n, a) => n + a.length, 0)

  const L = []
  L.push('# Atlas RAW — Réconciliation CODE ↔ ATLAS', '')
  L.push('> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l\'app applique', '> (réfs `LDB NN l.X` dans `src/`, et pour les 14 autres livres `<ABRÉV> NN l.X`) absentes de', '> l\'Atlas. **Sens B** = règles que l\'Atlas décrit hors du code (borné au LDB).', `> Tolérance ligne = ±${TOL}.`, '')
  L.push(`**Sens A — code → Atlas (LDB)** : ${hardA.length} chapitre(s) cités par le code & absents de l'Atlas · ${softA.length} chapitre(s) couverts avec des lignes non pinées.`)
  L.push(`**Sens A — code → Atlas (14 autres livres)** : ${hardAOther.length} chapitre(s)-livre cités par le code & absents de l'Atlas · ${softAOther.length} chapitre(s)-livre couverts avec des lignes non pinées · ${noChapterCount} réf(s) sans chapitre (non réconciliables par cette mesure).`)
  L.push(`**Sens B — Atlas → code (LDB)** : ${nonImpl.length} marqueur(s) « (non implémenté) » · ${atlasOnly.length} chapitre(s) LDB cités par l'Atlas jamais référencés dans le code.`, '')

  L.push('## A1 — Chapitres appelés par le CODE (LDB), ABSENTS de l\'Atlas (trous durs)', '')
  if (!hardA.length) L.push('_Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche._', '')
  else for (const h of hardA) {
    L.push(`### LDB ${h.ch} — ${h.count} réf(s) code, 0 dans l'Atlas`)
    for (const s of h.sample) L.push(`- \`${s.file}:${s.row}\` (l.${s.line}) — ${s.text}`)
    L.push('')
  }

  L.push('## A2 — Lignes appelées par le CODE (LDB) non pinées par l\'Atlas (chapitre couvert, règle peut-être survolée)', '')
  if (!softA.length) L.push('_Aucune._', '')
  else for (const s of softA.sort((a, b) => b.missCount - a.missCount)) {
    const owner = (docOwnerOfCh.get(s.ch) || '').split('/').pop()
    L.push(`### LDB ${s.ch} — ${s.missCount}/${s.totalLines} ligne(s) code hors couverture (propriétaire : ${owner})`)
    for (const r of s.ex.slice(0, 12)) L.push(`- l.${r.line} — \`${r.file}:${r.row}\` — ${r.text}`)
    if (s.ex.length > 12) L.push(`- … +${s.ex.length - 12} autres`)
    L.push('')
  }

  L.push('## A-AUTRES 0 — Résumé Sens A par livre (14 livres hors LDB)', '')
  if (!bookStats.size) L.push('_Aucune réf code vers un autre livre._', '')
  else {
    L.push('| Livre | Trous durs (chapitres) | Chapitres à lignes non pinées | Réfs sans chapitre |', '|---|---|---|---|')
    for (const [book, st] of [...bookStats].sort((a, b) => a[0].localeCompare(b[0])))
      L.push(`| ${book} | ${st.hard} | ${st.soft} | ${st.noCh} |`)
    L.push('')
  }

  L.push('## A1-AUTRES — Chapitres appelés par le CODE (autres livres), ABSENTS de l\'Atlas (trous durs)', '')
  if (!hardAOther.length) L.push('_Aucun._', '')
  else for (const h of hardAOther) {
    L.push(`### ${h.book} ${h.ch} — ${h.count} réf(s) code, 0 dans l'Atlas`)
    for (const s of h.sample) L.push(`- \`${s.file}:${s.row}\` (l.${s.line}) — ${s.text}`)
    L.push('')
  }

  L.push('## A2-AUTRES — Lignes appelées par le CODE (autres livres) non pinées par l\'Atlas', '')
  if (!softAOther.length) L.push('_Aucune._', '')
  else for (const s of softAOther.sort((a, b) => b.missCount - a.missCount)) {
    L.push(`### ${s.book} ${s.ch} — ${s.missCount}/${s.totalLines} ligne(s) code hors couverture`)
    for (const r of s.ex.slice(0, 12)) L.push(`- l.${r.line} — \`${r.file}:${r.row}\` — ${r.text}`)
    if (s.ex.length > 12) L.push(`- … +${s.ex.length - 12} autres`)
    L.push('')
  }

  L.push('## A3-AUTRES — Réfs de CODE sans chapitre (`<ABRÉV> l.X`, pas d\'unité chapitre à couvrir)', '')
  if (!codeOtherNoCh.size) L.push('_Aucune._', '')
  else for (const [book, refs] of [...codeOtherNoCh].sort((a, b) => a[0].localeCompare(b[0]))) {
    L.push(`### ${book} — ${refs.length} réf(s) sans chapitre`)
    for (const r of refs.slice(0, 4)) L.push(`- \`${r.file}:${r.row}\` (l.${r.line}) — ${r.text}`)
    if (refs.length > 4) L.push(`- … +${refs.length - 4} autres`)
    L.push('')
  }

  L.push('## B1 — Règles décrites par l\'Atlas marquées « (non implémenté) » (LDB)', '')
  if (!nonImpl.length) L.push('_Aucun marqueur._', '')
  else for (const n of nonImpl) L.push(`- **${n.doc}** L${n.row} — ${n.text}`)
  L.push('')

  L.push('## B2 — Chapitres LDB cités par l\'Atlas, jamais référencés dans le code', '')
  if (!atlasOnly.length) L.push('_Aucun._', '')
  else L.push(atlasOnly.map((c) => `LDB ${c}`).join(' · '), '')

  L.push('## Autres livres', '')
  L.push(`Code : ${[...codeOtherBooks].sort().join(', ') || '—'}`)
  L.push(`Atlas : ${[...atlasOtherBooks].sort().join(', ') || '—'}`, '')

  return L.join('\n')
}

function main() {
  const data = computeReconciliation()
  writeFileSync(join(RAWDIR, 'reconciliation.md'), renderReport(data))
  console.log(`Sens A (LDB) : ${data.hardA.length} trous durs · ${data.softA.length} chapitres à lignes non pinées`)
  const noChapterCount = [...data.codeOtherNoCh.values()].reduce((n, a) => n + a.length, 0)
  console.log(`Sens A (autres livres) : ${data.hardAOther.length} trou(s) dur(s) chapitre-livre · ${data.softAOther.length} chapitre(s)-livre à lignes non pinées · ${noChapterCount} réf(s) sans chapitre (hors mesure)`)
  for (const [book, st] of [...data.bookStats].sort((a, b) => a[0].localeCompare(b[0])))
    console.log(`  ${book} : ${st.hard} trous durs · ${st.soft} chapitres non pinés · ${st.noCh} réfs sans chapitre`)
  console.log(`Sens B : ${data.nonImpl.length} (non implémenté) · ${data.atlasOnly.length} chapitres Atlas hors-code`)
}

const isMain = process.argv[1] && process.argv[1].endsWith('reconcile.mjs')
if (isMain) main()
