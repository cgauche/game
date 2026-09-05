// FILIGRANE D'ARBRE — l'unique fabrique de la ligne qui dit SUR QUOI une mesure a porté : sha court,
// sujet du dernier commit, et nombre de fichiers non committés. Une planche QC, une capture d'écran
// ou un chiffre de volume rendus sans cette ligne ne se rattachent à aucun arbre : deux sessions
// mesurent alors deux états différents en croyant se comparer.
// Consommateurs : scripts/recette/intentions-portee.mjs, scripts/qc/mesure-volume.mts,
// scripts/qc/capture-jeu.mjs — une seule implémentation, jamais une copie par script.
//
// Le filigrane ne JETTE JAMAIS : il est imprimé juste avant les refus d'un hook, et une exception ici
// emporterait les refus nommés avec elle. Git indisponible donne une ligne DÉGRADÉE qui le dit.
import { GitIndisponible, lireGit, sortieOuNull } from './gitPorte.mjs'

/** Lecteur git par défaut : `git <args>` dans `racine`, sortie ébarbée, `null` si l'objet demandé
 *  n'existe pas. Une INDISPONIBILITÉ JETTE avec sa raison — `enteteArbre` en fait sa ligne dégradée.
 *  @param {string} racine @returns {(args: string[]) => string | null} */
export const gitDans = (racine) => (args) => {
  const vu = lireGit(args, { cwd: racine })
  if (!vu.disponible) throw new GitIndisponible(vu.raison)
  const sortie = sortieOuNull(vu)
  return sortie === null ? null : sortie.trim()
}

/**
 * Ligne de filigrane : `arbre <sha7> « <sujet, 70 car. max> » + N fichier(s) non committé(s)`.
 * `git` est injectable pour la mesure (dépôt jetable), jamais pour cacher l'arbre réel.
 * @param {string} racine @param {(args: string[]) => string | null} [git]
 * @returns {string}
 */
export function enteteArbre(racine, git = gitDans(racine)) {
  const lu = (args) => {
    try {
      return git(args)
    } catch (e) {
      return { panne: e.message }
    }
  }
  const statut = lu(['status', '--short'])
  const sha = lu(['rev-parse', '--short', 'HEAD'])
  const sujet = lu(['log', '-1', '--format=%s'])
  const panne = [statut, sha, sujet].find((v) => v?.panne)?.panne
  if (panne) return `arbre (git indisponible : ${panne})`
  if (statut === null || sha === null || sujet === null)
    return 'arbre (git indisponible : aucune réponse de git dans cet arbre)'
  const sales = String(statut).split(/\r?\n/).filter(Boolean).length
  return `arbre ${sha} « ${String(sujet).slice(0, 70)} » + ${sales} fichier(s) non committé(s)`
}
