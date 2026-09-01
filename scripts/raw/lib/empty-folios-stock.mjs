// Générateur du stock trié des ancres SANS CONTENU (#1457 lot A1) — `scripts/raw/empty-folios-baseline.json`.
// Le détecteur (`check-folio-continuity.mjs#scanAllEmptyFolios`) dit QUELLES pages n'ont aucun
// contenu dans le `.md` ; il ne peut pas dire si la page en avait. Le TRI est fait ICI, au PDF du
// dépôt (`Source/<dir>.pdf`, pypdf via `lib/pdf-extract.py`, offset K = folio + offset du livre) :
//   - la page PDF porte du texte utile  → PERDUE (la vérité citable manque au corpus) ;
//   - la page PDF n'en porte pas        → BÉNIGNE (pleine page d'illustration, page blanche).
// Le tri est donc STRUCTUREL (mesuré), jamais une liste d'exceptions à la main.
// Le PDF n'est lu QU'ICI : la garde CI consomme le JSON commité (aucune dépendance python).
// Re-run : node scripts/raw/lib/empty-folios-stock.mjs [--seuil N] [--dry]
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS } from '../_lib.mjs'
import { EMPTY_STOCK_PATH, scanEmptyFoliosInBook } from '../check-folio-continuity.mjs'
import { extractPages, resolveBookOffset, HAS_LOWER_RE } from '../anchor-fill.mjs'

// Seuil de caractères utiles au-dessus duquel la page PDF est jugée PORTEUSE de texte. Mesuré sur
// le corpus (rapport `--dry`) : les pages bénignes plafonnent bas (titre courant + légende), les
// pages perdues sont des pages de prose. Voir le rendu du lot A1 pour la distribution.
export const SEUIL_UTILE = 200

// Caractères utiles d'une page PDF : lignes portant un MOT réel (3 minuscules consécutives —
// critère de `anchor-fill.mjs`, qui écarte titre courant, numéro de folio et codes de chapitre),
// espaces retirés.
export function caracteresUtiles(pageText) {
  if (!pageText) return 0
  return pageText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => HAS_LOWER_RE.test(l))
    .join('')
    .replace(/\s+/g, '')
    .length
}

/** Mesure un livre : `{ abbr, ok, reason?, mesures:[{ ...candidat, pdfChars }] }`. */
export function mesurerLivre(abbr, dir, { extract = extractPages } = {}) {
  const candidats = scanEmptyFoliosInBook(abbr, dir)
  if (!candidats.length) return { abbr, ok: true, mesures: [] }
  const off = resolveBookOffset(dir)
  if (!off.ok) return { abbr, ok: false, reason: off.reason, mesures: [] }
  const pdfPath = `${dir}.pdf`
  if (!existsSync(pdfPath)) return { abbr, ok: false, reason: `PDF introuvable : ${pdfPath}`, mesures: [] }
  const pages = extract(pdfPath, [...new Set(candidats.map((c) => c.folio + off.offset))])
  const mesures = candidats.map((c) => ({ ...c, pdfChars: caracteresUtiles(pages.get(c.folio + off.offset)) }))
  return { abbr, ok: true, offset: off.offset, mesures }
}

/** Trie des mesures en `{ perdues, benignes }` (entrées nominatives, ligne exclue : elle dérive). */
export function trier(mesures, seuil = SEUIL_UTILE) {
  const entree = (m) => ({ ref: m.ref, file: m.file, folio: m.folio, pdfChars: m.pdfChars })
  return {
    perdues: mesures.filter((m) => m.pdfChars > seuil).map(entree),
    benignes: mesures.filter((m) => m.pdfChars <= seuil).map(entree),
  }
}

function main() {
  const args = process.argv.slice(2)
  const seuilIdx = args.indexOf('--seuil')
  const seuil = seuilIdx >= 0 ? Number(args[seuilIdx + 1]) : SEUIL_UTILE
  const dry = args.includes('--dry')

  const toutes = []
  for (const [abbr, dir] of BOOKS) {
    const r = mesurerLivre(abbr, dir)
    if (!r.ok) { console.log(`## ${abbr} — NON TRIABLE (${r.reason}) : ${scanEmptyFoliosInBook(abbr, dir).length} candidat(s)`); continue }
    toutes.push(...r.mesures)
  }
  toutes.sort((a, b) => a.ref.localeCompare(b.ref) || a.folio - b.folio)
  const { perdues, benignes } = trier(toutes, seuil)

  console.log(`candidats mesurés : ${toutes.length} — PERDUES ${perdues.length} · bénignes ${benignes.length} (seuil ${seuil} caractères utiles au PDF)`)
  console.log('distribution (caractères utiles au PDF, trié) :')
  console.log(`  ${toutes.map((m) => m.pdfChars).sort((a, b) => a - b).join(' ')}`)
  for (const m of toutes) {
    console.log(`${m.pdfChars > seuil ? 'PERDUE ' : 'bénigne'} ${m.ref} (${m.file}) folio ${m.folio} l.${m.line} — ${m.pdfChars} car.`)
  }
  if (dry) { console.log('(--dry : rien écrit)'); return }
  writeFileSync(EMPTY_STOCK_PATH, `${JSON.stringify({ seuil, perdues, benignes }, null, 2)}\n`, 'utf8')
  console.log(`écrit : ${EMPTY_STOCK_PATH}`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
