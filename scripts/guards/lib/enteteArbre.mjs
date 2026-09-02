// FILIGRANE D'ARBRE — l'unique fabrique de la ligne qui dit SUR QUOI une mesure a porté : sha court,
// sujet du dernier commit, et nombre de fichiers non committés. Une planche QC, une capture d'écran
// ou un chiffre de volume rendus sans cette ligne ne se rattachent à aucun arbre : deux sessions
// mesurent alors deux états différents en croyant se comparer.
// Consommateurs : scripts/recette/intentions-portee.mjs, scripts/qc/mesure-volume.mts,
// scripts/qc/capture-jeu.mjs — une seule implémentation, jamais une copie par script.
import { execFileSync } from 'node:child_process'

/** Lecteur git par défaut : `git <args>` dans `racine`, sortie ébarbée.
 *  @param {string} racine @returns {(args: string[]) => string} */
export const gitDans = (racine) => (args) =>
  execFileSync('git', args, { cwd: racine, encoding: 'utf8' }).trim()

/**
 * Ligne de filigrane : `arbre <sha7> « <sujet, 70 car. max> » + N fichier(s) non committé(s)`.
 * `git` est injectable pour la mesure (dépôt jetable), jamais pour cacher l'arbre réel.
 * @param {string} racine @param {(args: string[]) => string} [git]
 * @returns {string}
 */
export function enteteArbre(racine, git = gitDans(racine)) {
  const sales = git(['status', '--short']).split(/\r?\n/).filter(Boolean).length
  const sha = git(['rev-parse', '--short', 'HEAD'])
  const sujet = git(['log', '-1', '--format=%s']).slice(0, 70)
  return `arbre ${sha} « ${sujet} » + ${sales} fichier(s) non committé(s)`
}
