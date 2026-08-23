// scripts/git-hooks/docs-rebuild.mjs — corps PARTAGÉ des hooks post-merge / post-rewrite.
// Après une fusion ou un rebase, les docs dérivés portent la version « ours » retenue par le pilote
// merge-docs.mjs : seule la régénération fait foi. Ce hook la relance et NOMME ce qui a bougé.
// Il ne touche JAMAIS l'index (aucun `git add`/`commit`) : la décision de committer reste humaine.
// Silencieux quand rien de pertinent n'a bougé (aucune source de doc dans le lot fusionné/rebasé).
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_RE = /^(?:src|scripts|docs|Source)\/|^package\.json$/

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' })

/** Fichiers du lot que le hook vient de recevoir (ORIG_HEAD..HEAD). Sans ORIG_HEAD : `null`
 *  (= inconnu, on régénère). */
export function touchedFiles(cwd) {
  try {
    return git(['diff', '--name-only', 'ORIG_HEAD', 'HEAD'], cwd).split('\n').filter(Boolean)
  } catch {
    return null
  }
}

/** Vrai si le lot peut avoir périmé un doc dérivé (src/, scripts/, docs/, Source/ ou package.json). */
export const touchesDocSources = (files) => files === null || files.some((f) => SOURCE_RE.test(f.replace(/\\/g, '/')))

function main() {
  const cwd = git(['rev-parse', '--show-toplevel']).trim()
  if (!touchesDocSources(touchedFiles(cwd))) return
  try {
    execFileSync(process.execPath, ['scripts/docs/build-all.mjs', '--quiet'], { cwd, stdio: ['ignore', 'ignore', 'inherit'] })
  } catch {
    // Régénération interrompue : docs/ est un mélange d'ancien et de neuf. L'annoncer « à
    // committer » figerait ce mélange — on nomme la consigne, on ne l'exécute pas.
    process.stderr.write(`docs — régénération INTERROMPUE : docs/ possiblement incohérent, \`git checkout -- docs/\` puis corriger la cause.\n`)
    return
  }
  const changed = git(['diff', '--name-only', '--', 'docs/'], cwd).split('\n').filter(Boolean)
  if (!changed.length) return
  process.stderr.write(`docs régénérés : à committer (${changed.length}) :\n${changed.map((f) => `  ${f}`).join('\n')}\n`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
