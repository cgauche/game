// Lecteur de chapitres du `Source/` sur le DISQUE : la seule entrée/sortie de la chaîne de découpe.
// Le parsing lui-même vient de `src/data/source/decoupe.ts` (source unique, pure) — ce module ne fait
// que résoudre `bookId → dossier → fichier de chapitre`, lire le texte (CRLF-robuste, `readText`) et
// mémoriser le chapitre parsé.
import { readdirSync } from 'node:fs'
import { BOOKS, chapterFile, readText } from '../raw/_lib.mjs'
import { parseChapitre } from '../../src/data/source/decoupe.ts'
import booksData from '../../src/data/books.json' with { type: 'json' }

/** `books.json.id` → sigle Atlas, restreint aux livres porteurs d'un `dir` (extraction FR présente). */
export const ABBR_BY_BOOK_ID = Object.fromEntries(
  booksData.filter((b) => b.dir).map((b) => [b.id, b.abbr]),
)

const DIR_BY_ABBR = new Map(BOOKS)
const _cache = new Map()

/** Numéros de chapitre (`NN`) d'un livre, triés. @param {string} bookId @returns {string[]} */
export function chapitresDe(bookId) {
  const dir = DIR_BY_ABBR.get(ABBR_BY_BOOK_ID[bookId])
  if (!dir) return []
  return readdirSync(dir)
    .map((f) => /^(\d{2}) - .+\.md$/.exec(f))
    .filter(Boolean)
    .map((m) => m[1])
    .sort()
}

/** Nom du fichier d'un chapitre, ou `null`. @param {string} bookId @param {string|number} ch */
export function fichierChapitre(bookId, ch) {
  const abbr = ABBR_BY_BOOK_ID[bookId]
  return (abbr ? chapterFile(abbr, ch) : null)?.file ?? null
}

/**
 * Chapitre PARSÉ (avec cache), ou `null` si le livre ou le fichier n'existe pas.
 * @param {string} bookId @param {string|number} ch
 * @returns {import('../../src/data/source/decoupe.ts').ChapitreParse | null}
 */
export function lireChapitre(bookId, ch) {
  const key = `${bookId}|${ch}`
  if (_cache.has(key)) return _cache.get(key)
  const abbr = ABBR_BY_BOOK_ID[bookId]
  const res = abbr ? chapterFile(abbr, ch) : null
  const out = res ? parseChapitre(readText(res.path)) : null
  _cache.set(key, out)
  return out
}

/**
 * OUBLIE le chapitre mémorisé : un `Source/` réécrit sous un processus qui dure (serveur de dev)
 * doit être relu, sans quoi le lecteur resservirait l'ancien texte. @param {string} bookId
 * @param {string|number} ch @returns {boolean} `true` si un chapitre était mémorisé.
 */
export function oublierChapitre(bookId, ch) {
  return _cache.delete(`${bookId}|${ch}`)
}
