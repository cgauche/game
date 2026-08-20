// Outil de TRIAGE d'un ré-ancrage de chapitre (#1318 axe E3) — jamais une garde.
//
// `check-refs`/`check-code-refs` bornent la ligne, `raw-ref-integrity` rougit la ligne VIDE sans
// recouvrement : aucun des trois ne voit la réf qui tombe sur une ligne PLEINE mais ÉTRANGÈRE au
// passage (angle mort asserté dans `src/raw-ref-integrity.test.ts`). Une dérive de ligne post-
// ré-extraction Marker en produit en masse — mesure du lot E3-L11 : 13 sites survivants de règles
// pourtant remappées ailleurs dans le même geste, tous invisibles aux trois gardes.
//
// Cet outil confronte TOUTE réf d'un chapitre au TEXTE de sa ligne, triée par ligne citée, pour que
// le verdict se rende À L'ŒIL, une règle à la fois. Il n'assère rien et sort toujours 0 : la lecture
// du `Source/` reste humaine.
//
// Usage : node scripts/raw/audit-refs-chapitre.mjs LDB 85
//         node scripts/raw/audit-refs-chapitre.mjs EDOC 8 --largeur 200
//         node scripts/raw/audit-refs-chapitre.mjs "ADE II" 4
//
// Vocabulaire RÉUTILISÉ de `_lib.mjs` (source unique) : `ldbRe`/`otherRe`/`refNums`/`isRangeSuffix`/
// `chapterFile`/`bookOf`/`readText`/`PIVOT_ABBR` + les ensembles d'exclusion de fiches. Périmètre de
// balayage = `src/` + `scripts/` + `docs/`, hors artefacts DATÉS (`docs/plans`, `docs/superpowers`,
// fiches `epreuve-*`) et hors rapports RÉ-GÉNÉRÉS (`RAWDOC_META_GENERATED`).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  ldbRe, otherRe, refNums, isRangeSuffix, chapterFile, bookOf, readText, PIVOT_ABBR,
  RAWDOC_META_GENERATED, isRawEpreuve,
} from './_lib.mjs'

export const ROOTS = ['src', 'scripts', 'docs']
export const SKIP_DIRS = new Set(['node_modules', '.git', 'plans', 'superpowers'])
export const EXCLUDE_PREFIX = ['src/gameIso/rig/parts/tenues/defs/'] // art de couverture (cf. check-code-refs)

function walk(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return acc }
  for (const e of entries) {
    const p = join(dir, e)
    let s
    try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) { if (!SKIP_DIRS.has(e)) walk(p, acc) }
    else if (/\.(tsx?|mjs|mts|json|md)$/.test(e) && !RAWDOC_META_GENERATED.has(e) && !isRawEpreuve(e)) acc.push(p)
  }
  return acc
}

/** ANCRES jugeables d'une réf : une plage `-fin` reste UN intervalle, les autres formes (`+pts`,
 *  compacte `/n…`) sont des ancres DISTINCTES — chacune se lit seule (miroir de `rawRefIntegrity`). */
function anchorsOf(line, suffix) {
  const nums = refNums(line, suffix)
  if (isRangeSuffix(suffix)) return [[nums[0], Math.max(...nums)]]
  return nums.map((n) => [n, n])
}

/** Réfs d'une ligne visant `(abbr, nn)` — `{ ref, anchors }`. */
export function* refsInLine(ln, abbr, nn) {
  const wanted = Number(nn)
  if (abbr === PIVOT_ABBR) {
    const re = ldbRe()
    let m
    while ((m = re.exec(ln))) {
      if (Number(m[1]) !== wanted) continue
      yield { ref: `${PIVOT_ABBR} ${wanted} l.${m[2]}${m[3]}`, anchors: anchorsOf(m[2], m[3]) }
    }
    return
  }
  const re = otherRe()
  let m
  while ((m = re.exec(ln))) {
    if (m[2] == null || Number(m[2]) !== wanted) continue
    if (bookOf(m[1].replace(/\s+/g, ' ').trim()) !== abbr) continue
    yield { ref: `${abbr} ${wanted} l.${m[3]}${m[4]}`, anchors: anchorsOf(m[3], m[4]) }
  }
}

/** Balaye le dépôt et rend `Map(ref → { anchors, sites:[{file,row,cite}] })` pour un chapitre. */
export function auditChapter(abbr, nn, roots = ROOTS) {
  const byRef = new Map()
  for (const root of roots) {
    for (const f of walk(root)) {
      const rel = f.split('\\').join('/')
      if (EXCLUDE_PREFIX.some((x) => rel.startsWith(x))) continue
      let src
      try { src = readFileSync(f, 'utf8').split('\n') } catch { continue }
      src.forEach((ln, i) => {
        const vues = new Set()
        for (const { ref, anchors } of refsInLine(ln, abbr, nn)) {
          if (vues.has(ref)) continue
          vues.add(ref)
          const cur = byRef.get(ref) ?? { anchors, sites: [] }
          cur.sites.push({ file: rel, row: i + 1, cite: ln.trim() })
          byRef.set(ref, cur)
        }
      })
    }
  }
  return byRef
}

function main() {
  const argv = process.argv.slice(2)
  const wIdx = argv.indexOf('--largeur')
  const largeur = wIdx >= 0 ? Number(argv[wIdx + 1]) : 150
  const [abbr, nn] = wIdx >= 0 ? [...argv.slice(0, wIdx), ...argv.slice(wIdx + 2)] : argv
  if (!abbr || !nn) {
    console.error('usage : node scripts/raw/audit-refs-chapitre.mjs <ABRÉV> <NN> [--largeur N]')
    process.exit(2)
  }
  const cf = chapterFile(abbr, nn)
  if (!cf) {
    console.error(`chapitre introuvable : ${abbr} ${nn}`)
    process.exit(2)
  }
  const L = readText(cf.path).split('\n')
  const byRef = auditChapter(abbr, nn)
  const first = (ref) => Number(/l\.(\d+)/.exec(ref)[1])
  const refs = [...byRef.keys()].sort((a, b) => first(a) - first(b) || a.localeCompare(b))

  console.log(`# ${abbr} ${nn} — ${cf.path} (${L.length} lignes)`)
  console.log(`# ${refs.length} réf(s) distincte(s), ${[...byRef.values()].reduce((n, v) => n + v.sites.length, 0)} site(s)`)
  console.log('# VIDE!! = la ligne citée ne porte RIEN · HORS BORNE!! = au-delà du chapitre')
  console.log('# Le reste se juge À L\'ŒIL : une ligne PLEINE mais étrangère au sujet est une dérive, aucune garde ne la voit.')
  let vides = 0
  for (const ref of refs) {
    const { anchors, sites } = byRef.get(ref)
    console.log(`\n=== ${ref}   (${sites.length} site(s))`)
    for (const [lo, hi] of anchors) {
      for (const n of lo === hi ? [lo] : [lo, hi]) {
        if (n < 1 || n > L.length) { console.log(`  L${n}: HORS BORNE!!`); vides++; continue }
        const txt = L[n - 1].trim()
        if (txt === '') { console.log(`  L${n}: VIDE!!`); vides++ }
        else console.log(`  L${n}: ${txt.slice(0, largeur)}`)
      }
    }
    for (const s of sites) console.log(`   @ ${s.file}:${s.row}  ${s.cite.slice(0, largeur)}`)
  }
  console.log(`\n${vides} ancre(s) VIDE!!/HORS BORNE!! — triage, pas un verdict.`)
}

if (import.meta.url === `file://${process.argv[1].split('\\').join('/')}` || process.argv[1]?.endsWith('audit-refs-chapitre.mjs')) main()
