// Typecheck INCRÉMENTAL des agents : réutilise le cache `node_modules/.cache/typecheck.tsbuildinfo`
// (mesuré 2026-08-30 : ~7 s à chaud contre ~42-51 s pour un `tsc --noEmit` nu). La sortie complète
// part en fichier ; le résumé imprimé liste TOUTES les erreurs, jamais un extrait.
// La porte de vérité reste `npm run typecheck` (full, `--incremental false`).
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(REPO, 'node_modules', '.cache')
const TSBUILDINFO = join(CACHE, 'typecheck.tsbuildinfo')
const SORTIE = join(CACHE, 'typecheck-last.txt')

const full = process.argv.slice(2).includes('--full')

const args = [
  join(REPO, 'node_modules', 'typescript', 'bin', 'tsc'),
  '--noEmit',
  '--incremental',
  '--tsBuildInfoFile',
  TSBUILDINFO,
  '--pretty',
  'false',
]
// `--full` AJOUTE la désactivation de l'incrémental : le tsbuildinfo est un cache PARTAGÉ entre
// sessions, le supprimer serait une course.
if (full) args.push('--incremental', 'false')

const run = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8' })
const sortie = `${run.stdout ?? ''}${run.stderr ?? ''}`

mkdirSync(CACHE, { recursive: true })
writeFileSync(SORTIE, sortie, 'utf8')

const lignes = sortie.split(/\r?\n/)
const erreurs = lignes.filter((ligne) => /error TS\d+/.test(ligne))
const statut = run.status ?? 1

// Un échec SANS erreur TS (tsc introuvable, plantage du processus) ne se résume jamais en
// « 0 erreur(s) » : la cause brute est imprimée telle quelle.
if (run.error) {
  process.stdout.write(`typecheck:fast — ÉCHEC de lancement : ${run.error.message}\n`)
} else if (statut !== 0 && erreurs.length === 0) {
  const queue = lignes.filter((ligne) => ligne.trim() !== '').slice(-20)
  process.stdout.write(`typecheck:fast — ÉCHEC (code ${statut}) sans erreur TS reconnue\n`)
  for (const ligne of queue) process.stdout.write(`${ligne}\n`)
} else {
  process.stdout.write(`typecheck:fast — ${erreurs.length} erreur(s)\n`)
  for (const ligne of erreurs) process.stdout.write(`${ligne}\n`)
}
process.stdout.write(`sortie complète : ${SORTIE}\n`)
process.stdout.write(
  full
    ? 'mode full (--incremental false)\n'
    : 'mode incrémental — au doute : npm run typecheck (full)\n',
)

process.exit(statut)
