// Dérivation AUTOMATIQUE des découpes (spike #découpe) : chaque `desc` de `src/data/<dataset>.json`
// est-elle retrouvable telle quelle dans le livre qu'elle cite, sous forme de suite contiguë de
// blocs ? Le parsing vient ENTIÈREMENT de `decoupe.mjs` (source unique) ; ce fichier n'est qu'un
// chercheur de correspondances + un rapport.
//
// Verdicts : EXACT (un run contigu de blocs d'une même section) · EXACT-MULTI-SECTIONS (un run
// contigu à cheval sur plusieurs sections d'un même chapitre) · MONTAGE (2+ runs disjoints, découpe
// gloutonne par paragraphes de la desc) · ECHEC (rien de contigu — paraphrase probable ou défaut
// d'extraction) · SANS-SOURCE (pas de `source.book`, ou livre sans `dir` dans `books.json`).
//
// Anti-faux-EXACT : toute ref émise est RE-RÉSOLUE par `resolveDecoupe` et son texte normalisé
// re-comparé à la desc normalisée ; une divergence est rapportée en `verification` (bug de la
// chaîne, jamais un verdict silencieux).
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ABBR_BY_BOOK_ID, chaptersOf, chapterIndex, joinNorm, normText, resolveDecoupe } from './decoupe.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Longueur d'amorce testée avant de tenter un run complet (filtre bon marché). */
const PROBE = 24

const _bookCache = new Map()

/**
 * Blocs d'un livre entier, à plat, en ordre de document.
 * @param {string} book id `books.json`
 * @returns {{ ch: string, sec: string, secOcc: number, idx: number, md: string, norm: string }[]}
 */
function flatBlocks(book) {
  if (_bookCache.has(book)) return _bookCache.get(book)
  const out = []
  for (const ch of chaptersOf(book)) {
    const chap = chapterIndex(book, ch)
    if (!chap) continue
    for (const s of chap.sections) {
      s.blocks.forEach((b, idx) => {
        out.push({ ch, sec: s.slug, secOcc: s.occ, idx, md: b.md, norm: normText(b.md) })
      })
    }
  }
  _bookCache.set(book, out)
  return out
}

/**
 * Cherche un run contigu de blocs (même chapitre) dont la concaténation normalisée vaut `target`.
 * @returns {{ i: number, j: number } | null}
 */
function findRun(blocks, target) {
  const probe = target.slice(0, PROBE)
  for (let i = 0; i < blocks.length; i++) {
    if (!blocks[i].norm || !blocks[i].norm.startsWith(probe.slice(0, blocks[i].norm.length))) continue
    if (!target.startsWith(blocks[i].norm.slice(0, PROBE))) continue
    const parts = []
    for (let j = i; j < blocks.length; j++) {
      if (blocks[j].ch !== blocks[i].ch || !blocks[j].norm) break
      parts.push(blocks[j].norm)
      const acc = joinNorm(parts)
      if (acc === target) return { i, j }
      if (!target.startsWith(acc)) break
    }
  }
  return null
}

/** Convertit un run de blocs en refs de découpe (une par section traversée). */
function runToRefs(book, blocks, { i, j }) {
  const refs = []
  for (let k = i; k <= j; k++) {
    const b = blocks[k]
    const last = refs[refs.length - 1]
    if (last && last.ch === b.ch && last.sec === b.sec && last.secOcc === b.secOcc && b.idx === last.b1 + 1) {
      last.b1 = b.idx
    } else {
      refs.push({ book, ch: b.ch, sec: b.sec, secOcc: b.secOcc, b0: b.idx, b1: b.idx })
    }
  }
  return refs
}

/** Texte normalisé rendu par une liste de refs (voie de vérification croisée). */
function resolvedText(refs) {
  const parts = []
  for (const r of refs) {
    const res = resolveDecoupe(r)
    if (res.error) return { error: `${res.error} : ${res.detail}` }
    parts.push(normText(res.md))
  }
  return { text: joinNorm(parts) }
}

/** Découpe gloutonne de la desc par paragraphes : liste de runs, ou null si un morceau résiste. */
function montage(blocks, paras) {
  const runs = []
  let pos = 0
  while (pos < paras.length) {
    let hit = null
    for (let k = paras.length; k > pos; k--) {
      const target = joinNorm(paras.slice(pos, k))
      const run = findRun(blocks, target)
      if (run) { hit = { run, next: k }; break }
    }
    if (!hit) return null
    runs.push(hit.run)
    pos = hit.next
  }
  return runs
}

/** Juge une entrée. @returns {{ verdict: string, refs?: object[], reason?: string, verification?: string }} */
function judge(entry) {
  const book = entry?.source?.book
  if (!book || !ABBR_BY_BOOK_ID[book]) return { verdict: 'SANS-SOURCE', reason: book ? `livre sans dir: ${book}` : 'source.book absent' }
  const desc = typeof entry.desc === 'string' ? entry.desc : ''
  if (!desc.trim()) return { verdict: 'ECHEC', reason: 'desc-vide' }
  const blocks = flatBlocks(book)
  const D = normText(desc)
  const paras = desc.split(/\n\s*\n/).map(normText).filter(Boolean)

  const full = findRun(blocks, D)
  if (full) {
    const refs = runToRefs(book, blocks, full)
    const check = resolvedText(refs)
    const ok = !check.error && check.text === D
    return {
      verdict: refs.length > 1 ? 'EXACT-MULTI-SECTIONS' : 'EXACT',
      refs,
      ...(ok ? {} : { verification: check.error ?? 'texte re-résolu != desc' }),
    }
  }

  const runs = paras.length > 1 ? montage(blocks, paras) : null
  if (runs) {
    const refs = runs.flatMap((r) => runToRefs(book, blocks, r))
    const check = resolvedText(refs)
    const ok = !check.error && check.text === D
    return { verdict: 'MONTAGE', refs, ...(ok ? {} : { verification: check.error ?? 'texte re-résolu != desc' }) }
  }

  const sub = D.length > 40 && blocks.some((b) => b.norm.includes(D))
  const orphan = paras.find((p) => !findRun(blocks, p)) ?? D
  return { verdict: 'ECHEC', reason: sub ? 'sous-bloc (desc = fragment d\'un bloc)' : `introuvable: « ${orphan.slice(0, 70)} … »` }
}

const dataset = process.argv[2]
if (!dataset) {
  console.error('usage: node scripts/source/derive-decoupes.mjs <dataset>   (nom sans .json)')
  process.exit(2)
}
const data = JSON.parse(readFileSync(join(ROOT, 'src', 'data', `${dataset}.json`), 'utf8'))
if (!Array.isArray(data)) { console.error(`${dataset}.json n'est pas un tableau d'entrées`); process.exit(2) }

const entries = data.map((e) => ({ id: e.id ?? e.label ?? '(sans id)', ...judge(e) }))
const count = (v) => entries.filter((e) => e.verdict === v).length
const report = {
  dataset,
  total: entries.length,
  exact: count('EXACT'),
  exactMultiSections: count('EXACT-MULTI-SECTIONS'),
  montage: count('MONTAGE'),
  echec: count('ECHEC'),
  sansSource: count('SANS-SOURCE'),
  descVide: entries.filter((e) => e.reason === 'desc-vide').length,
  verifications: entries.filter((e) => e.verification).map((e) => ({ id: e.id, verification: e.verification })),
  entries,
}
console.log(JSON.stringify(report, null, 1))
console.error(
  `${dataset}: total=${report.total} EXACT=${report.exact} EXACT-MULTI-SECTIONS=${report.exactMultiSections}` +
  ` MONTAGE=${report.montage} ECHEC=${report.echec} (dont desc vide ${report.descVide})` +
  ` SANS-SOURCE=${report.sansSource} | verifications KO=${report.verifications.length}`,
)
