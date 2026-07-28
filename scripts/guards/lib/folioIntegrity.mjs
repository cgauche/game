// Mécanique d'INTÉGRITÉ DU FOLIO (#536, suite #278/#281/#309). `sourceRefInline.mjs` garde la FORME
// de `sourceRefSchema`, `citationCoverage.mjs` la COUVERTURE (chaque entrée cite-t-elle une source ?) :
// aucun des deux ne vérifie que le folio déclaré POINTE SUR LA BONNE PAGE. Ce module le prouve, en
// croisant deux invariants déjà posés par le dépôt :
//   1. règle stricte 5 (CLAUDE.md) — une `desc` est un copié/collé VERBATIM de la source, donc elle
//      DOIT se retrouver telle quelle dans le `Source/` du livre déclaré ;
//   2. `source.page` est le folio IMPRIMÉ (`game-source-page-is-printed-folio`), et l'extraction
//      Marker sème des marqueurs `<span data-folio="N">` au fil du texte.
// La `desc` sert donc de LOCALISATEUR : on la retrouve dans le livre, on relève l'encadrement
// `data-folio` de l'occurrence, on le compare au folio déclaré. Le défaut fondateur : `redoutable`
// (ZI) déclarait `page: 11` et `fouissement` `page: 13` pour un texte réellement en folio 134
// (même import `7924eb20`, migration `frenchy-*.json`).
//
// Module ESM pur, exécutable par `node` nu — consommé par `src/data/book-source-integrity.test.ts`
// (verrou cliquet) ET par `scripts/data/audit-folios.mjs` (rapport).
//
// DEUX voies de réfutation, indépendantes :
//   A. PAGE IMPOSSIBLE — le folio déclaré dépasse le dernier folio ATTESTÉ du livre (`bookMaxFolio` :
//      dernier marqueur `data-folio` ET dernière page citée par `00 - Index.md`). Aucun besoin de la
//      `desc` : cette voie couvre donc AUSSI les entrées dont la desc est introuvable/trop courte.
//   B. FOLIO ENCADRÉ — la `desc` est retrouvée verbatim et son encadrement `data-folio` exclut le
//      folio annoncé.
//
// PRUDENCE DÉLIBÉRÉE — hors de ces deux voies, le module ne REFUTE rien et se tait :
//   - `desc` introuvable verbatim → `desc-introuvable`, JAMAIS un verdict d'encadrement. Ce n'est pas
//     une absolution de la règle 5 : la recherche exacte reste bruitée (tableaux, colonnes recollées,
//     puces `•`/`-`), et un cliquet bâti sur ce signal figerait du bruit — cf. le faux ami
//     `reconcile` (157 dettes, CI verte). La règle 5 garde sa propre voie.
//   - encadrement à borne haute INCONNUE (aucun marqueur ne suit dans le chapitre — l'extraction est
//     CREUSE par endroits : `09 - Compétences.md` n'a que 2 marqueurs (117, 118) pour les folios
//     117-131) → borne ouverte : tout folio ≥ borne basse ET ≤ `bookMaxFolio` reste irréfutable.
// Un écart de la voie B n'est donc jamais un artefact de découpage : il est encadré des DEUX côtés
// par des marqueurs qui, eux, sont ancrés dans le texte.
//
// COUVERTURE — ce que la garde NE voit PAS (dit sans détour, cf. l'en-tête de `folioRatchetStock.mjs`) :
// une entrée dont la desc est reformulée (donc introuvable) ou trop courte, et dont le folio faux
// reste DANS les bornes du livre, n'est réfutée par AUCUNE des deux voies. La voie A ne ferme que
// l'évasion « page hors du livre ».

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS } from '../../raw/_lib.mjs'
import booksData from '../../../src/data/books.json' with { type: 'json' }


const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Pont `books.json.id` → `abbr` (SOURCE UNIQUE des acronymes, ref #585) — DÉRIVÉ de `books.json`,
 *  filtré aux entrées porteuses d'un `dir` (extraction FR exploitable par l'Atlas RAW). Un livre
 *  absent de cette table n'a pas d'extraction FR exploitable : ses entrées sont `livre-hors-atlas`
 *  (irréfutables), jamais en échec. */
export const BOOK_ABBR_BY_ID = Object.fromEntries(
  booksData.filter((b) => b.dir).map((b) => [b.id, b.abbr]),
)

const DIR_BY_ABBR = new Map(BOOKS)

/** Longueur normalisée minimale d'une `desc` pour servir de localisateur : sous ce seuil, une
 *  chaîne courte se retrouve un peu partout dans un livre et l'encadrement ne prouve rien. */
export const MIN_DESC = 60

const DROP = new Set(['*', '_', '`'])

/**
 * Normalise pour un match VERBATIM tolérant au seul habillage (casse, apostrophes typographiques,
 * espaces insécables, emphase Markdown, retours à la ligne), et retourne la carte index→offset BRUT
 * qui permet de relocaliser l'occurrence dans le texte d'origine (donc entre ses marqueurs).
 * @param {string} s @returns {{ text: string, idx: number[] }}
 */
export function normMap(s) {
  const src = s.normalize('NFC')
  const out = []
  const idx = []
  let prevSpace = false
  for (let i = 0; i < src.length; i++) {
    let c = src[i]
    if (c === '’' || c === '‘') c = "'"
    if (c === ' ' || c === ' ') c = ' '
    if (DROP.has(c)) continue
    if (/\s/.test(c)) {
      if (prevSpace) continue
      out.push(' ')
      idx.push(i)
      prevSpace = true
      continue
    }
    prevSpace = false
    out.push(c.toLowerCase())
    idx.push(i)
  }
  return { text: out.join(''), idx }
}

const CACHE = new Map()

/** Chapitres d'un livre (par abréviation `BOOKS`), normalisés + marqueurs `data-folio` positionnés.
 *  @param {string} abbr @returns {{ file: string, text: string, idx: number[], folios: [number, number][] }[]} */
export function bookDocs(abbr) {
  const hit = CACHE.get(abbr)
  if (hit) return hit
  const rel = DIR_BY_ABBR.get(abbr)
  const docs = []
  if (rel) {
    const dir = join(ROOT, rel)
    let names
    try {
      names = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
    } catch {
      names = []
    }
    for (const name of names) {
      const raw = readFileSync(join(dir, name), 'utf8')
      const { text, idx } = normMap(raw)
      /** @type {[number, number][]} */
      const folios = []
      for (const m of raw.matchAll(/data-folio="(\d+)"/g)) folios.push([m.index ?? 0, Number(m[1])])
      docs.push({ file: name, text, idx, folios })
    }
  }
  CACHE.set(abbr, docs)
  return docs
}

/** Sentinelle de borne haute INCONNUE (extraction creuse : aucun marqueur ne suit dans le chapitre). */
export const OPEN = null

const MAX_CACHE = new Map()

/**
 * Dernier folio ATTESTÉ d'un livre — borne DURE de la voie A : un `source.page` au-delà ne désigne
 * aucune page existante, la desc n'a pas son mot à dire. Deux attestations, on retient la plus haute :
 *   - le plus grand marqueur `data-folio` de l'extraction ;
 *   - la plus grande page citée par `00 - Index.md`, dans ses DEUX formats : `— p. 94-98` (étendue de
 *     chapitre, ex. ADE II) et `— folio 25` (début de chapitre seul, ex. AA/ZI).
 * Prendre le MAX des deux est délibérément conservateur : sur les livres au format `— folio N`,
 * l'index ne borne que le DÉBUT du dernier chapitre, et l'extraction Marker peut laisser la queue du
 * livre sans marqueur — cette borne est alors un MINORANT du vrai dernier folio, jamais un majorant.
 * Elle ne réfute donc que ce qu'aucune des deux attestations ne couvre. Mesure à la pose : 0 entrée
 * légitime n'en est victime, les 15 réfutées le sont de 2 à 125 folios au-delà (ADE II, 98 pages).
 * @param {string} abbr @returns {number} 0 = livre sans attestation (aucune réfutation par cette voie)
 */
export function bookMaxFolio(abbr) {
  const hit = MAX_CACHE.get(abbr)
  if (hit !== undefined) return hit
  let max = 0
  for (const doc of bookDocs(abbr)) for (const [, f] of doc.folios) if (f > max) max = f
  const rel = DIR_BY_ABBR.get(abbr)
  if (rel) {
    try {
      const t = readFileSync(join(ROOT, rel, '00 - Index.md'), 'utf8')
      for (const m of t.matchAll(/—\s*(?:p\.\s*(\d+)(?:\s*[-–]\s*(\d+))?|folio\s+(\d+))/g)) {
        const n = Number(m[2] ?? m[1] ?? m[3])
        if (n > max) max = n
      }
    } catch {
      /* pas d'index : les marqueurs seuls font la borne */
    }
  }
  MAX_CACHE.set(abbr, max)
  return max
}

/**
 * Folios possibles d'un extrait couvrant les offsets bruts `a..b` d'un chapitre.
 * @param {[number, number][]} folios @param {number} a @param {number} b
 * @returns {{ lo: number, hi: number | null } | null} `null` si aucun marqueur n'encadre l'extrait.
 */
export function folioRange(folios, a, b) {
  let before = null
  let after = null
  const inside = []
  for (const [off, n] of folios) {
    if (off <= a) before = n
    else if (off <= b) inside.push(n)
    else {
      after = n
      break
    }
  }
  if (before === null && inside.length === 0) return null
  const lo = before !== null ? before : inside[0]
  let hi
  if (inside.length > 0) hi = after !== null ? Math.max(inside[inside.length - 1], after - 1) : OPEN
  else hi = after !== null ? after - 1 : OPEN
  if (hi !== OPEN && hi < lo) hi = lo
  return { lo, hi }
}

/**
 * Verdict d'une entrée portant `source: {book, page}` + `desc`.
 * @param {{ book: string, page: number, desc: string }} entry
 * @returns {{ verdict: 'folio-ok'|'folio-ment'|'folio-impossible'|'desc-introuvable'|'livre-hors-atlas'|'desc-trop-courte'|'sans-marqueur', ranges?: {lo:number,hi:number|null,file:string}[], max?: number }}
 */
export function auditFolio({ book, page, desc }) {
  const abbr = BOOK_ABBR_BY_ID[book]
  if (!abbr) return { verdict: 'livre-hors-atlas' }
  const docs = bookDocs(abbr)
  if (docs.length === 0) return { verdict: 'livre-hors-atlas' }
  // Voie A AVANT la desc : une page hors du livre se réfute sans localisateur, ce qui couvre aussi
  // les entrées à desc trop courte ou introuvable.
  const max = bookMaxFolio(abbr)
  if (max > 0 && page > max) return { verdict: 'folio-impossible', max }
  const nd = normMap(desc).text
  if (nd.length < MIN_DESC) return { verdict: 'desc-trop-courte' }
  /** @type {{lo:number,hi:number|null,file:string}[]} */
  const ranges = []
  let found = false
  for (const doc of docs) {
    let from = 0
    for (;;) {
      const i = doc.text.indexOf(nd, from)
      if (i < 0) break
      found = true
      const a = doc.idx[i]
      const b = doc.idx[Math.min(i + nd.length - 1, doc.idx.length - 1)]
      const r = folioRange(doc.folios, a, b)
      if (r) ranges.push({ ...r, file: doc.file })
      from = i + 1
    }
  }
  if (!found) return { verdict: 'desc-introuvable' }
  if (ranges.length === 0) return { verdict: 'sans-marqueur' }
  // UNE occurrence encadrante suffit — non par confort, mais parce qu'une desc retrouvée SUR le folio
  // déclaré ne peut pas être dite mensongère : le texte y est. La contrepartie est que ce module ne
  // départage PAS deux occurrences : ce choix est une convention de citation, pas un fait réfutable —
  // `auditFolios` les SIGNALE (`multi`) pour arbitrage humain. Mesuré sur les 1047 entrées à desc
  // retrouvée : 1 SEULE est multi-occurrence (`traits.json:fouissement`, folios 23 et 134 — le ZI y
  // définit le Trait DEUX fois en toutes lettres ; le schéma ne sait pas écrire « défini à deux
  // endroits », #563) — la règle ne pèse donc sur rien d'autre.
  const ok = ranges.some(({ lo, hi }) => page >= lo && (hi === OPEN || page <= hi))
  return { verdict: ok ? 'folio-ok' : 'folio-ment', ranges }
}

/** Entrées d'un dataset portant `source.book` + `source.page` + `desc`, à TOUTE profondeur : la moitié
 *  des datasets n'est pas un tableau racine (`criticals.json` groupe par localisation, `sea-events.json`
 *  par rubrique…) — s'arrêter au 1er niveau laissait 180 entrées citées hors de tout scan.
 *  Clé = `id` STABLE quand il existe (0 collision mesurée sur les 2082 entrées), sinon le chemin JSON
 *  des 16 entrées anonymes — jamais un libellé (doctrine 2026-07-09).
 *  @param {unknown} data @returns {{ id: string, book: string, page: number, desc: string }[]} */
export function citedEntriesOf(data) {
  /** @type {{ id: string, book: string, page: number, desc: string }[]} */
  const out = []
  /** @param {unknown} node @param {string} path */
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`))
      return
    }
    const rec = /** @type {Record<string, unknown>} */ (node)
    const src = rec.source
    if (src && typeof src === 'object' && !Array.isArray(src)) {
      const s = /** @type {Record<string, unknown>} */ (src)
      if (typeof s.book === 'string' && typeof s.page === 'number' && typeof rec.desc === 'string') {
        out.push({
          id: typeof rec.id === 'string' ? rec.id : path || '?',
          book: s.book,
          page: s.page,
          desc: rec.desc,
        })
      }
    }
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'source') continue
      walk(v, path ? `${path}.${k}` : k)
    }
  }
  walk(data, '')
  return out
}

/**
 * Emplacements SECONDAIRES (`alsoIn[]`, #563 Lot 1 item 2) d'un dataset, à TOUTE profondeur — même
 * patron de walk que `citedEntriesOf`. Chaque item porte `label` (celui de l'entrée PORTEUSE, pour
 * l'attestation POSITIVE) et `quote` (auto-attestation authorée propre à CET emplacement).
 * @param {unknown} data @returns {{ key: string, book: string, page: number, label: string | undefined, quote: string | undefined }[]} */
export function secondaryEntriesOf(data) {
  /** @type {{ key: string, book: string, page: number, label: string | undefined, quote: string | undefined }[]} */
  const out = []
  /** @param {unknown} node @param {string} path */
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`))
      return
    }
    const rec = /** @type {Record<string, unknown>} */ (node)
    const also = rec.alsoIn
    if (Array.isArray(also)) {
      const ownerId = typeof rec.id === 'string' ? rec.id : path || '?'
      const ownerLabel = typeof rec.label === 'string' ? rec.label : undefined
      also.forEach((ref, i) => {
        if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return
        const r = /** @type {Record<string, unknown>} */ (ref)
        if (typeof r.book === 'string' && typeof r.page === 'number') {
          out.push({
            key: `${ownerId}.alsoIn[${i}]`,
            book: r.book,
            page: r.page,
            label: ownerLabel,
            quote: typeof r.quote === 'string' ? r.quote : undefined,
          })
        }
      })
    }
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'source' || k === 'alsoIn') continue
      walk(v, path ? `${path}.${k}` : k)
    }
  }
  walk(data, '')
  return out
}

/**
 * Verdict d'attestation POSITIVE d'un emplacement SECONDAIRE (#563 Lot 1 item 2) : la CHARGE de la
 * preuve est sur l'auteur (comme la règle 5 pour `desc`) — pas d'attestation = REFUSÉ, jamais une
 * réfutation par absence. Deux preuves possibles, cherchées dans le SPAN du folio DÉCLARÉ (jamais
 * n'importe où dans le livre, contrairement à `auditFolio` qui cherche la desc PUIS vérifie le
 * folio) : le `label` de l'entrée porteuse, ou le `quote` authoré (cas d'une table qui n'imprime pas
 * le `label` — ex. `zweihander-flamberge`).
 * @param {{ book: string, page: number, label: string | undefined, quote: string | undefined }} entry
 * @returns {{ verdict: 'attesté'|'non-attesté'|'folio-impossible'|'livre-hors-atlas', via?: 'label'|'quote', max?: number }}
 */
export function auditSecondaryRef({ book, page, label, quote }) {
  const abbr = BOOK_ABBR_BY_ID[book]
  if (!abbr) return { verdict: 'livre-hors-atlas' }
  const docs = bookDocs(abbr)
  if (docs.length === 0) return { verdict: 'livre-hors-atlas' }
  const max = bookMaxFolio(abbr)
  if (max > 0 && page > max) return { verdict: 'folio-impossible', max }
  /** @type {[string, 'label'|'quote'][]} */
  const candidates = []
  if (typeof quote === 'string' && quote.trim().length > 0) candidates.push([quote, 'quote'])
  if (typeof label === 'string' && label.trim().length > 0) candidates.push([label, 'label'])
  for (const [needle, via] of candidates) {
    const nd = normMap(needle).text
    if (!nd) continue
    for (const doc of docs) {
      let from = 0
      for (;;) {
        const i = doc.text.indexOf(nd, from)
        if (i < 0) break
        const a = doc.idx[i]
        const b = doc.idx[Math.min(i + nd.length - 1, doc.idx.length - 1)]
        const r = folioRange(doc.folios, a, b)
        if (r && page >= r.lo && (r.hi === OPEN || page <= r.hi)) return { verdict: 'attesté', via }
        from = i + 1
      }
    }
  }
  return { verdict: 'non-attesté' }
}

/**
 * Scanne `src/data/*.json` pour les emplacements SECONDAIRES (`alsoIn[]`) et rend ceux REFUSÉS
 * (folio hors livre, ou ni label ni quote attesté dans le span déclaré).
 * @param {string} dataDir
 * @returns {{ violations: {key:string,file:string,book:string,page:number,verdict:'non-attesté'|'folio-impossible',max?:number}[], total: number }}
 */
export function auditSecondaries(dataDir) {
  const violations = []
  let total = 0
  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json') && f !== 'books.json').sort()
  for (const f of files) {
    let data
    try {
      data = JSON.parse(readFileSync(join(dataDir, f), 'utf8'))
    } catch {
      continue
    }
    for (const e of secondaryEntriesOf(data)) {
      total++
      const r = auditSecondaryRef(e)
      if (r.verdict === 'non-attesté' || r.verdict === 'folio-impossible') {
        violations.push({ key: `${f}:${e.key}`, file: f, book: e.book, page: e.page, verdict: r.verdict, max: r.max })
      }
    }
  }
  return { violations, total }
}

/**
 * Scanne `src/data/*.json` et rend les entrées dont le folio est RÉFUTÉ (par l'une ou l'autre voie),
 * le décompte par verdict, le TOTAL scanné (`stats` en somme — aucune catégorie n'est retranchée du
 * rapport), et les entrées MULTI-occurrences à arbitrer.
 * @param {string} dataDir
 * @returns {{ violations: {key:string,file:string,id:string,book:string,page:number,voie:'encadrement'|'hors-livre',ranges:{lo:number,hi:number|null,file:string}[],max:number|null}[], stats: Record<string, number>, total: number, multi: {key:string,page:number,ranges:{lo:number,hi:number|null,file:string}[]}[] }}
 */
export function auditFolios(dataDir) {
  /** @type {Record<string, number>} */
  const stats = {}
  const violations = []
  const multi = []
  let total = 0
  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json') && f !== 'books.json').sort()
  for (const f of files) {
    let data
    try {
      data = JSON.parse(readFileSync(join(dataDir, f), 'utf8'))
    } catch {
      continue
    }
    for (const e of citedEntriesOf(data)) {
      total++
      const r = auditFolio(e)
      stats[r.verdict] = (stats[r.verdict] ?? 0) + 1
      const key = `${f}:${e.id}`
      if ((r.ranges?.length ?? 0) > 1) multi.push({ key, page: e.page, ranges: r.ranges ?? [] })
      if (r.verdict === 'folio-ment' || r.verdict === 'folio-impossible') {
        violations.push({
          key,
          file: f,
          id: e.id,
          book: e.book,
          page: e.page,
          voie: r.verdict === 'folio-impossible' ? 'hors-livre' : 'encadrement',
          ranges: r.ranges ?? [],
          max: r.max ?? null,
        })
      }
    }
  }
  return { violations, stats, total, multi }
}

/**
 * Rend le TEXTE de `folioRatchetStock.mjs` depuis une mesure. SOURCE UNIQUE du format du stock : le
 * solde d'une clé se fait en corrigeant le folio au Source puis en RE-RENDANT, jamais en recopiant une
 * ligne à la main. `scripts/data/audit-folios.mjs --stock` refuse d'écrire un stock plus GRAND que
 * l'actuel : l'outil ne peut que solder ; faire croître le stock reste un geste manuel, donc visible.
 * @param {ReturnType<typeof auditFolios>['violations']} violations @param {string} entete
 * @returns {string}
 */
export function renderStock(violations, entete) {
  const lignes = []
  let fichier = null
  for (const v of [...violations].sort((a, b) => a.key.localeCompare(b.key))) {
    if (v.file !== fichier) {
      fichier = v.file
      lignes.push(`  // ${fichier}`)
    }
    const reel =
      v.voie === 'hors-livre'
        ? `hors livre (dernier folio ${v.max})`
        : v.ranges.map((r) => (r.hi === null ? `${r.lo}+` : r.lo === r.hi ? `${r.lo}` : `${r.lo}-${r.hi}`)).join(',')
    lignes.push(`  '${v.key}', // p.${v.page} -> ${reel}`)
  }
  return `${entete}\n/** @type {ReadonlySet<string>} */\nexport const FOLIO_RATCHET = new Set([\n${lignes.join('\n')}\n])\n`
}

export { basename }
