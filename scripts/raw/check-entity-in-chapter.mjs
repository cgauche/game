// Garde de classe « réf fausse BLANCHIE par la normalisation » (#600).
// Une réf de fiche Atlas syntaxiquement conforme (`ABBR N p.X`) ne prouve PAS que la cible est
// juste : #600 a trouvé deux talents (`empreint-d-ulgu`, `empreint-de-la-magie`) tagués `LDB 10`
// alors que leur texte vit en NADJ/EDOC — la graphie passait toutes les gardes de bornage de ligne
// (check-refs/check-code-refs/citation-graphy-guard) parce qu'elles vérifient une PLAGE de ligne,
// jamais le CONTENU. Ici : pour chaque entrée `docs/raw/talents.md` de forme
//   ### <Nom>
//   **Source :** <ABBR> <N> ...
// on résout le fichier-chapitre (`chapterFile`, _lib.mjs) et on vérifie que `<Nom>` (normalisé :
// markdown/casse/accents dépouillés) apparaît dans le texte du chapitre cité. Absence = violation.
// Tolérances documentées : parenthèse finale du titre (« Artilleur (mise à jour AA) ») retirée avant
// comparaison — c'est une annotation d'édition, pas le nom RAW ; articles/prépositions français
// élidés OU non (« Empreint de la Magie » data vs « Empreint de Magie » EDOC 13 l.254) retirés des
// DEUX côtés avant comparaison. Réf sans chapitre NUMÉRIQUE résoluble (« AA Annexe III »,
// « ADE II ch. Les Ogres ») = hors sujet (rien à chapitrer) : périmètre de check-refs/check-code-refs.
// Cliquet PAR (doc, nom) — patron `assertAgainstBaseline` de check-code-refs.mjs.
// Re-run : node scripts/raw/check-entity-in-chapter.mjs (npm run raw:check-entity-in-chapter).
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chapterFile, otherAbbrAlternation } from './_lib.mjs'

export const TARGETS = ['docs/raw/talents.md']
export const BASELINE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'entity-in-chapter-baseline.json')

// `<ABBR> <N>` en tête de ligne Source (LDB inclus, alternation _lib.mjs partagée — jamais réécrite).
// Chapitre = premier groupe de chiffres qui suit l'abréviation (`ch.` optionnel devant) ; une réf
// sans chapitre numérique immédiat (« AA Annexe III », « ADE II ch. Les Ogres ») ne matche pas —
// hors sujet ici (rien à chapitrer), périmètre de check-refs/check-code-refs.
const SOURCE_ABBR_RE = () => new RegExp(`^(LDB|${otherAbbrAlternation()})\\s+(?:ch\\.\\s*)?(\\d+)\\b`)

/** Normalise pour le match de PRÉSENCE (tolérant, pas le match exact de citation) : dépouille le
 *  markdown (emphase/code), les accents (NFD → suppression des diacritiques) et la casse. */
export function normalizeLoose(s) {
  return s
    .replace(/[*_`]/g, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Tolère les articles/prépositions français élidés OU non entre la version data et le verbatim RAW
// (cas #600 : « Empreint de la Magie » (talents.json) vs « Empreint de Magie » (EDOC 13 l.254)) —
// mots-outils retirés des DEUX côtés de la comparaison, jamais du texte affiché.
const STOPWORDS_RE = /\b(de|du|des|le|la|les|un|une)\b/g
const CONTRACTED_STOPWORDS_RE = /\b[dl]'/g
export function stripArticles(s) {
  return s.replace(CONTRACTED_STOPWORDS_RE, '').replace(STOPWORDS_RE, ' ').replace(/\s+/g, ' ').trim()
}

/** Titre de talent → nom comparable : retire une parenthèse finale d'annotation d'édition
 *  (« Artilleur (mise à jour AA) » → « Artilleur »). */
export function entityNameFromHeader(header) {
  return header.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

const chapterTextCache = new Map()
function chapterTextOf(cf) {
  if (!chapterTextCache.has(cf.path)) chapterTextCache.set(cf.path, stripArticles(normalizeLoose(readFileSync(cf.path, 'utf8'))))
  return chapterTextCache.get(cf.path)
}

/** Parcourt un doc Atlas (défaut : docs/raw/talents.md) et retourne les entrées `### <Nom>` /
 *  `**Source :** <ABBR> <N>…` dont `<Nom>` (normalisé) est ABSENT du texte du chapitre cité —
 *  `{ doc, row, name, ref, chapterFile }`. Réf sans chapitre numérique résoluble = ignorée. */
export function scanMissingEntities(docPath) {
  const lines = readFileSync(docPath, 'utf8').split('\n')
  const abbrRe = SOURCE_ABBR_RE()
  const violations = []
  for (let i = 0; i < lines.length; i++) {
    const h = /^#{2,6}\s+(.+?)\s*$/.exec(lines[i])
    if (!h) continue
    // La ligne Source suit le titre à quelques lignes près (blockquotes/notes intercalées tolérées).
    let sourceLine = null
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const s = /^\*\*Source\s*:\*\*\s*(.+?)\s*$/.exec(lines[j])
      if (s) { sourceLine = s[1]; break }
      if (/^#{2,6}\s+/.test(lines[j])) break // prochain titre atteint sans Source : pas une entrée
    }
    if (sourceLine == null) continue
    const m = abbrRe.exec(sourceLine)
    abbrRe.lastIndex = 0
    if (!m) continue // pas de chapitre numérique résoluble : hors sujet
    const [, abbr, nn] = m
    const cf = chapterFile(abbr, nn)
    if (!cf) continue // chapitre introuvable : périmètre de check-refs/check-code-refs, pas ici
    const name = entityNameFromHeader(h[1])
    if (!name) continue
    const needle = stripArticles(normalizeLoose(name))
    if (!needle || !chapterTextOf(cf).includes(needle)) {
      violations.push({ doc: docPath, row: i + 1, name, ref: `${abbr} ${Number(nn)}`, chapterFile: cf.file })
    }
  }
  return violations
}

export function scanAll(targets = TARGETS) {
  return targets.flatMap((t) => scanMissingEntities(t))
}

/** Compte par (doc, nom) — unité du cliquet. */
export function countsByEntry(violations) {
  const counts = {}
  for (const v of violations) counts[`${v.doc}::${v.name}`] = (counts[`${v.doc}::${v.name}`] ?? 0) + 1
  return counts
}

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

export function readBaseline(path = BASELINE_PATH) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

function main() {
  const violations = scanAll()
  const counts = countsByEntry(violations)
  const baseline = readBaseline()
  const { over, stale } = assertAgainstBaseline(counts, baseline)

  console.log(`check-entity-in-chapter : ${violations.length} entrée(s) dont le nom est ABSENT du chapitre cité, sur ${TARGETS.join(', ')}`)

  if (over.length) {
    console.log('RÉGRESSION — hausse de réfs fausses par entrée :')
    for (const o of over) console.log(`  ${o}`)
  }
  if (stale.length) {
    console.log('Baseline(s) PÉRIMÉE(s) (réfs réparées) — à ABAISSER dans entity-in-chapter-baseline.json :')
    for (const s of stale) console.log(`  ${s}`)
  }
  if (!over.length && !stale.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return
  }
  console.log('Détail (fichier:ligne — nom, réf citée, chapitre résolu) :')
  for (const v of violations) console.log(`${v.doc}:${v.row} — "${v.name}" cite ${v.ref} (${v.chapterFile}), nom absent`)
  process.exitCode = 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
