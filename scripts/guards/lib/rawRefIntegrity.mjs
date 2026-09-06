// Intégrité des réfs RAW du CODE — volet « la ligne citée ne porte RIEN » (#1318 axe B / P5).
// `check-code-refs.mjs` borne déjà la ligne (hors borne du chapitre = mort) ; une réf DANS les
// bornes mais pointant une ligne VIDE reste invérifiée — c'est par là qu'est passée une règle
// inventée citée `LDB 17 l.84` (chapitre de 87 lignes, ligne 84 vide).
//
// Sous-cas GATÉ : la ou les lignes citées sont TOUTES vides ET la fenêtre ±`WINDOW` autour d'elles ne
// partage AUCUN mot signifiant (≥ `MIN_WORD_LEN` lettres) avec le contexte porteur (la ligne de code
// citante ± `WINDOW`). Le recouvrement est LEXICAL, sur le préfixe de `STEM_LEN` lettres (accents
// repliés) : « nourriture » recouvre « nourri », « colère » recouvre « colères », et un cognat FR/EN
// recouvre aussi (« critique » / « critical » → `criti`). Un mot-clé dont la forme diverge AVANT ce
// préfixe (radical distinct, synonyme, vocabulaire de code étranger) ne recouvre PAS : une dérive de
// ligne post-ré-extraction Marker n'est donc innocentée QUE si son sujet reste à ±`WINDOW` ET s'écrit
// pareil — mesure du 2026-08-16 : sans le préfixe, 161 sites gelés dont 84 avaient déjà leur sujet à
// ±6 lignes ; avec le préfixe, 108 à cette date. Le stock gelé COURANT se lit dans la baseline, jamais ici.
//
// Vocabulaire RÉUTILISÉ de `scripts/raw/_lib.mjs` (source unique) : `ldbRe`/`otherRe`/`span`/
// `bookOf`/`chapterFile`/`readText`. Périmètre src/ aligné sur `check-code-refs.mjs`.
import { readFileSync } from 'node:fs'
import { listerArbre } from './lister.mjs'
import { ldbRe, otherRe, span, refNums, isRangeSuffix, chapterFile, bookOf, readText } from '../../raw/_lib.mjs'

// Réexport des DEUX résolveurs de `_lib.mjs` dont les consommateurs TypeScript ont besoin : une
// seule couture typée (`rawRefIntegrity.d.mts`) au lieu d'un second `.d.mts` sur `_lib.mjs`.
export { chapterFile, readText }

export const SRC_DIR = 'src'
export const EXCLUDE_SRC_PREFIX = 'src/gameIso/rig/parts/tenues/defs/' // art de couverture (cf. check-code-refs)
export const WINDOW = 2
export const MIN_WORD_LEN = 5
/** Longueur du préfixe sur lequel se juge le recouvrement (tolère pluriel/dérivé, pas le synonyme). */
export const STEM_LEN = 5

/** Fichiers de la garde elle-même : ses fixtures citent des réfs À DESSEIN (preuve de morsure). */
export const SELF_FILES = ['src/raw-ref-integrity.test.ts']

/** Exemptions AU SITE (jamais au fichier) : `{ file, row, ref, raison, date }`. Une exemption
 *  nomme la ligne EXACTE du code citant + la réf — un déplacement de site la périme (fail-closed). */
export const SITE_EXEMPTIONS = []

/** Registre gelé du STOCK hérité : `{ "<fichier src>": { "<réf>": <nb de sites aveugles> } }`.
 *  Cliquet à double sens (patron `check-code-refs.mjs`) : toute HAUSSE échoue (réf aveugle NEUVE),
 *  toute baisse échoue aussi tant que le registre n'est pas ABAISSÉ (réf réparée = ligne à retirer).
 *  Régime cible : fichier vide `{}` (tolérance zéro) — chaque entrée est une dette à solder en
 *  lisant le `Source/` et en réancrant la réf sur la ligne qui porte VRAIMENT le passage.
 *  Les formes COMPACTES (`l.A/B/C`, `_lib.mjs`) comptent chaque ancre SÉPARÉMENT : une seule d'entre
 *  elles pointant une ligne vide suffit à rougir la réf entière. */
export const BASELINE_PATH = new URL('../raw-blind-refs-baseline.json', import.meta.url)

/** Comptes mesurés `{ fichier: { réf: n } }` à partir d'une liste de réfs aveugles. */
export function countsByFileRef(blind) {
  const out = {}
  for (const b of blind) {
    out[b.file] = out[b.file] || {}
    out[b.file][b.ref] = (out[b.file][b.ref] ?? 0) + 1
  }
  return out
}

/** Compare comptes mesurés et registre gelé → `{ over, stale }` (lignes-rapport `fichier — réf`). */
export function assertAgainstBaseline(counts, baseline) {
  const over = []
  for (const [file, refs] of Object.entries(counts)) {
    for (const [ref, n] of Object.entries(refs)) {
      const b = baseline[file]?.[ref] ?? 0
      if (n > b) over.push(`${file} — ${ref} : ${n} site(s) aveugle(s) (gelé ${b})`)
    }
  }
  const stale = []
  for (const [file, refs] of Object.entries(baseline)) {
    for (const [ref, b] of Object.entries(refs)) {
      const n = counts[file]?.[ref] ?? 0
      if (n < b) stale.push(`${file} — ${ref} : gelé ${b}, réel ${n} — ABAISSER/retirer`)
    }
  }
  return { over, stale }
}

/** Radicaux signifiants d'un texte : mots ≥ `minLen` lettres (accents repliés, minuscules), réduits
 *  à leur préfixe de `STEM_LEN` lettres — seule tolérance de forme (pluriel/dérivé), jamais un synonyme. */
export function significantWords(text, minLen = MIN_WORD_LEN) {
  const folded = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return new Set((folded.match(/[a-z]+/g) || []).filter((w) => w.length >= minLen).map((w) => w.slice(0, STEM_LEN)))
}

/** Recouvrement lexical entre deux textes (au moins un mot signifiant commun). */
export function sharesSignificantWord(a, b, minLen = MIN_WORD_LEN) {
  const wa = significantWords(a, minLen)
  for (const w of significantWords(b, minLen)) if (wa.has(w)) return true
  return false
}

/** Fenêtre `[lo-w … hi+w]` (1-based, bornée) d'un tableau de lignes, jointe par espaces. */
export function windowText(lines, lo, hi, w = WINDOW) {
  const from = Math.max(1, lo - w)
  const to = Math.min(lines.length, hi + w)
  return lines.slice(from - 1, to).join(' ')
}

/** VERDICT PUR (aucun disque) d'une réf : `true` = à ROUGIR (lignes citées toutes vides ET aucun
 *  mot signifiant partagé entre la fenêtre du chapitre et le contexte porteur du code). */
export function isBlindRef(chapterLines, lo, hi, contextText, w = WINDOW, minLen = MIN_WORD_LEN) {
  if (lo < 1 || hi > chapterLines.length) return false // hors borne = domaine de check-code-refs
  for (let i = lo; i <= hi; i++) if (chapterLines[i - 1].trim() !== '') return false
  return !sharesSignificantWord(windowText(chapterLines, lo, hi, w), contextText, minLen)
}

/** Ancres JUGEABLES d'une réf : une PLAGE `-fin` reste UN intervalle `[lo,hi]` ; les autres formes
 *  (`+pts`, compacte `/n…`) sont des ancres DISTINCTES — chacune se juge seule, sinon `l.202/213`
 *  se lirait 202→213 et sa ligne 213 VIDE resterait invisible (#1318 E3-L4, défaut D5). */
function* anchorsOf(line, suffix) {
  if (isRangeSuffix(suffix)) { yield span(line, suffix); return }
  for (const n of refNums(line, suffix)) yield [n, n]
}

/** Réfs `<ABRÉV> NN l.X[-Y|+n…|/n…]` d'une ligne — `{ abbr, nn, lo, hi, ref }` (miroir de check-code-refs). */
export function* refsInLine(ln) {
  const ldb = ldbRe()
  let m
  while ((m = ldb.exec(ln))) {
    for (const [lo, hi] of anchorsOf(m[2], m[3])) {
      yield { abbr: 'LDB', nn: m[1], lo, hi, ref: `LDB ${Number(m[1])} l.${m[2]}${m[3]}` }
    }
  }
  const other = otherRe()
  while ((m = other.exec(ln))) {
    const nn = m[2]
    if (nn == null) continue
    const abbr = bookOf(m[1].replace(/\s+/g, ' ').trim())
    if (!abbr) continue
    for (const [lo, hi] of anchorsOf(m[3], m[4])) {
      yield { abbr, nn, lo, hi, ref: `${abbr} ${Number(nn)} l.${m[3]}${m[4]}` }
    }
  }
}

export const isExcludedSrc = (rel) => rel.startsWith(EXCLUDE_SRC_PREFIX) || SELF_FILES.includes(rel)

function fichiersDuCode(dir) {
  return listerArbre(dir, {
    descendre: (rel) => !rel.split('/').includes('node_modules'),
    filtre: (rel) => /\.(tsx?|json)$/.test(rel),
  }).map((rel) => `${dir}/${rel}`)
}

const _chapterLines = new Map() // path -> string[] (une lecture par chapitre, ~15 livres)
function chapterLinesOf(path) {
  if (!_chapterLines.has(path)) _chapterLines.set(path, readText(path).split('\n'))
  return _chapterLines.get(path)
}

const isExempt = (hit) => SITE_EXEMPTIONS.some((e) => e.file === hit.file && e.row === hit.row && e.ref === hit.ref)

/** Scanne `srcDir` et retourne les réfs AVEUGLES : `{ file, row, ref, abbr, nn, lo, hi }`. */
export function scanBlindRefs(srcDir = SRC_DIR) {
  const blind = []
  for (const f of fichiersDuCode(srcDir)) {
    const rel = f.split('\\').join('/')
    if (isExcludedSrc(rel)) continue
    const src = readFileSync(f, 'utf8').split('\n')
    src.forEach((ln, i) => {
      for (const { abbr, nn, lo, hi, ref } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        if (!cf) continue // chapitre introuvable = domaine de check-code-refs
        const context = windowText(src, i + 1, i + 1)
        if (!isBlindRef(chapterLinesOf(cf.path), lo, hi, context)) continue
        const hit = { file: rel, row: i + 1, ref, abbr, nn, lo, hi }
        if (!isExempt(hit)) blind.push(hit)
      }
    })
  }
  return blind
}

/** Registre gelé (`{}` si le fichier est absent — régime de tolérance zéro). */
export function readBaseline(path = BASELINE_PATH) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

/** Sérialise des comptes en registre (clés triées — diff stable). */
export function serializeBaseline(counts) {
  const out = {}
  for (const file of Object.keys(counts).sort()) {
    out[file] = {}
    for (const ref of Object.keys(counts[file]).sort()) out[file][ref] = counts[file][ref]
  }
  return `${JSON.stringify(out, null, 2)}\n`
}

/** File d'AUDIT (non gatée) : réfs pointant une ligne vide, groupées par réf, comptées par sites. */
export function scanEmptyLineRefs(srcDir = SRC_DIR) {
  const byRef = new Map()
  for (const f of fichiersDuCode(srcDir)) {
    const rel = f.split('\\').join('/')
    if (isExcludedSrc(rel)) continue
    const src = readFileSync(f, 'utf8').split('\n')
    src.forEach((ln, i) => {
      for (const { abbr, nn, lo, hi, ref } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        if (!cf) continue
        const lines = chapterLinesOf(cf.path)
        if (lo < 1 || hi > lines.length) continue
        let allEmpty = true
        for (let k = lo; k <= hi && allEmpty; k++) if (lines[k - 1].trim() !== '') allEmpty = false
        if (!allEmpty) continue
        const context = windowText(src, i + 1, i + 1)
        const overlap = sharesSignificantWord(windowText(lines, lo, hi), context)
        const cur = byRef.get(ref) || { ref, sites: 0, blind: 0, files: new Set() }
        cur.sites += 1
        if (!overlap) cur.blind += 1
        cur.files.add(`${rel}:${i + 1}`)
        byRef.set(ref, cur)
      }
    })
  }
  return [...byRef.values()].sort((a, b) => b.blind - a.blind || b.sites - a.sites)
}
