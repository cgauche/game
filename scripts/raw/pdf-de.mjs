// CLI de la couture `pdfDe` (`scripts/raw/_lib.mjs`, #1739) : c'est par elle que Python et shell
// obtiennent un chemin de PDF de livre ou de `Source/_marker/`, sans lire `src/data/books.json`.
// Imprime UN chemin absolu par argument, dans l'ordre reçu ; exit 1 et rien sur stdout au premier
// refus (livre inconnu, sans `pdf` déclaré, fichier absent).
// Usage :
//   node scripts/raw/pdf-de.mjs <id>...                    PDF officiel (`pdfRequisDe`)
//   node scripts/raw/pdf-de.mjs --copie-marker <id>...     copie de travail Marker, posée si absente (`copieMarkerDe`)
//   node scripts/raw/pdf-de.mjs --sortie-marker <id>...    dossier de sortie Marker à ÉCRIRE (`sortieMarkerDe`)
//   node scripts/raw/pdf-de.mjs --marker <relatif>...      chemin sous `Source/_marker/` (`markerDe`)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { copieMarkerDe, markerDe, pdfRequisDe, sortieMarkerDe } from './_lib.mjs'

/** La copie de travail Marker, POSÉE depuis le PDF officiel si elle manque — seul écrivain de la couture. */
function poserCopieMarker(id) {
  const copie = copieMarkerDe(id)
  if (existsSync(copie)) return copie
  const officiel = pdfRequisDe(id)
  mkdirSync(dirname(copie), { recursive: true })
  copyFileSync(officiel, copie)
  return copie
}

const MODES = {
  officiel: pdfRequisDe,
  '--copie-marker': poserCopieMarker,
  '--sortie-marker': (id) => sortieMarkerDe(id, { exiger: false }),
  '--marker': (relatif) => markerDe(relatif),
}

/** Les chemins demandés par `argv` (sans `node` ni le script). LÈVE au premier refus. */
function cheminsDe(argv) {
  const mode = argv[0] in MODES ? argv[0] : 'officiel'
  const args = mode === 'officiel' ? argv : argv.slice(1)
  if (!args.length) throw new Error('usage : node scripts/raw/pdf-de.mjs [--copie-marker | --sortie-marker | --marker] <id | relatif>...')
  return args.map(MODES[mode])
}

try {
  process.stdout.write(`${cheminsDe(process.argv.slice(2)).join('\n')}\n`)
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
