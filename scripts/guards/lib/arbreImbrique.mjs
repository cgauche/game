// Arbre GIT imbriqué dont le contenu part dans un commit du dépôt hôte (#1679 L1c). `.gitignore`
// n'ignore les worktrees d'agents que par leur NOM (`/.wt-*/`) : un worktree lié ou un clone posé
// sous un autre nom reste intégralement `git add -A`-able (mesuré 2026-09-02 : `git ls-files -o --
// .wt-1501` rend 1 entrée sans `--exclude-standard`). La détection se fait donc par le FAIT — un
// dossier ANCÊTRE du chemin stagé porte un `.git` (FICHIER pour un worktree lié, DOSSIER pour un
// clone) — jamais par un motif de nom.
// LIMITE : un sous-module git porte la MÊME signature (`.git` FICHIER `gitdir:`) et serait refusé
// lui aussi ; le dépôt n'en a aucun (pas de `.gitmodules`) — s'il en apparaît un, les distinguer
// par la cible du `gitdir:` (sous `.git/modules/` pour un sous-module).
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const porteUnGitParDefaut = (dossier) => existsSync(join(dossier, '.git'))

/**
 * REND un offender par dossier d'arbre imbriqué dont un chemin stagé descend, trié par chemin.
 * La racine du dépôt hôte est exclue (son `.git` est celui qui commite). `porteUnGit` est injecté
 * pour la mesure ; par défaut, le disque.
 */
export function scanArbresImbriques(chemins, { racine, porteUnGit = porteUnGitParDefaut } = {}) {
  const racineAbs = resolve(racine)
  const juges = new Map()
  const coupables = new Set()
  for (const chemin of chemins) {
    let courant = dirname(resolve(racineAbs, chemin.replace(/\\/g, '/')))
    while (courant.startsWith(racineAbs + sep)) {
      if (!juges.has(courant)) juges.set(courant, porteUnGit(courant))
      if (juges.get(courant)) coupables.add(courant)
      courant = dirname(courant)
    }
  }
  return [...coupables]
    .map((d) => relative(racineAbs, d).split(sep).join('/'))
    .sort()
    .map((dossier) => ({
      dossier,
      detail:
        `worktree/clone imbriqué stagé : ${dossier} — retire-le de l'index ` +
        `(\`git rm --cached -r ${dossier}\`) et gitignore-le`,
    }))
}
