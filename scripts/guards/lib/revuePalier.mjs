// LA REVUE DE PALIER — comment elle se lit, et comment le palier se mesure.
//
// Une revue de palier est un fichier COMMITTÉ, écrit directement sous son nom d'archive
// `.claude/soldes/revue-palier-<date>-<base>.md` : la date et la base de sa fenêtre `<base>..<tête>`
// NOMMENT le fichier, et son contenu porte les deux. Un seul objet, à un seul endroit — le nom se
// déduit du contenu (`nomDArchiveDeRevue`), et la porte au commit vérifie qu'ils se répondent.
//
// Le palier se MESURE sur l'histoire : les commits touchant `src`/`scripts` depuis la tête de fenêtre
// de la dernière revue archivée DANS HEAD. C'est une lecture que n'importe qui refait en deux
// commandes git, et qui rend la même valeur depuis n'importe quel arbre. Un compteur d'événements
// compterait ce que chaque worktree fait de son côté (20 sur ce dépôt, dont des trains qui ne
// rejoignent jamais `main`) : deux worktrees suffisent à en faire un nombre que rien ne recoupe.
import { GitIndisponible, estAncetre, lireGit, sortieOuNull } from './gitPorte.mjs'
import { parUnitesDeCode } from './lister.mjs'

/** Lecture git de ce module : la sortie, ou `''` quand l'objet demandé n'existe pas (un dépôt sans
 *  HEAD ne porte aucune archive, et ce n'est pas une erreur). Une INDISPONIBILITÉ (git absent, hors
 *  dépôt) JETTE — `mesureDuPalier` la rend en `erreur` nommée. */
const git = (args, cwd) => {
  const vu = lireGit(args, { cwd })
  if (!vu.disponible) throw new GitIndisponible(vu.raison)
  return sortieOuNull(vu) ?? ''
}

const DATE_RE = /\d{4}-\d{2}-\d{2}/g
const FENETRE_RE = /([0-9a-f]{7,40})\.\.([0-9a-f]{7,40})/
const CHEMIN_DE_REVUE_RE = /^\.claude\/soldes\/revue-palier-.+\.md$/

/**
 * Ce qu'une revue dit d'elle-même. PUR. Chaque champ vaut `null` s'il est illisible.
 * La date est la DERNIÈRE de la 1re ligne (le titre porte souvent des numéros de tickets avant
 * elle) ; la fenêtre est la PREMIÈRE du corps.
 * @returns {{ date: string|null, base: string|null, tete: string|null }}
 */
export function fenetreDeRevue(texte) {
  const contenu = String(texte ?? '')
  const premiereLigne = contenu.split(/\r?\n/, 1)[0] ?? ''
  const dates = [...premiereLigne.matchAll(DATE_RE)].map((m) => m[0])
  const fenetre = FENETRE_RE.exec(contenu)
  return { date: dates.at(-1) ?? null, base: fenetre?.[1] ?? null, tete: fenetre?.[2] ?? null }
}

/**
 * Ce qui manque à une revue pour être NOMMABLE, en clair. PUR — liste vide = nommable.
 * @returns {string[]}
 */
export function problemesDeRevue(texte) {
  const { date, base } = fenetreDeRevue(texte)
  const problemes = []
  if (!date) problemes.push('aucune date AAAA-MM-JJ en 1re ligne — le fichier porte cette date dans son nom')
  if (!base) problemes.push('aucune fenêtre `<base>..<tête>` (shas de 7 à 40 caractères) — le fichier porte cette base dans son nom')
  return problemes
}

/**
 * Nom de fichier d'une revue : `revue-palier-<date>-<base>.md`. PUR.
 * Sans fenêtre, la date seule nomme (`revue-palier-<date>.md`) : les revues écrites avant que la
 * porte n'exige la fenêtre restent nommables, et l'histoire garde leurs noms. `dateDeRepli` sert
 * quand la revue elle-même n'en porte aucune ; sans elle et sans date lisible, le retour est `null`.
 * @returns {string|null}
 */
export function nomDArchiveDeRevue(texte, dateDeRepli = null) {
  const { date, base } = fenetreDeRevue(texte)
  const jour = date ?? dateDeRepli
  if (!jour) return null
  return base ? `revue-palier-${jour}-${base}.md` : `revue-palier-${jour}.md`
}

/** Deux écritures du MÊME sha : git abrège librement (9 caractères ici, 40 là). Le préfixe décide,
 *  jamais moins de 7 caractères — la longueur d'abréviation par défaut de git. */
export function memeSha(a, b) {
  if (!a || !b) return false
  const [court, long] = a.length <= b.length ? [a, b] : [b, a]
  return court.length >= 7 && long.startsWith(court)
}

/**
 * Les revues archivées telles que HEAD les porte — jamais l'index, jamais le disque. La mesure du
 * palier porte sur l'histoire COMMITTÉE, et elle est lue par une gate qui tourne pendant que d'autres
 * gates écrivent dans l'arbre.
 * @returns {{ chemin: string, date: string|null, base: string|null, tete: string|null }[]}
 */
export function archivesDe(cwd = process.cwd()) {
  // Dépôt sans HEAD : `git` rend `''` (objet absent), donc aucune archive — et ce n'est pas une erreur.
  const suivis = git(['ls-tree', '-r', '--name-only', 'HEAD', '--', '.claude/soldes'], cwd).split('\n').filter(Boolean)
  return suivis
    .filter((chemin) => CHEMIN_DE_REVUE_RE.test(chemin))
    .map((chemin) => ({ chemin, ...fenetreDeRevue(git(['show', `HEAD:${chemin}`], cwd)) }))
}

/**
 * Les revues AJOUTÉES par le commit en cours, avec leur contenu STAGÉ : ce sont elles que la porte au
 * commit valide, et c'est le seul endroit où l'index est lu.
 * @returns {{ chemin: string, nom: string, contenu: string }[]}
 */
export function revuesNeuves(cwd = process.cwd()) {
  const ajoutees = git(['diff', '--cached', '--name-status', '--diff-filter=A', '--', '.claude/soldes'], cwd)
    .split('\n')
    .map((ligne) => ligne.split('\t')[1])
    .filter((chemin) => chemin && CHEMIN_DE_REVUE_RE.test(chemin))
  return ajoutees.map((chemin) => ({
    chemin,
    nom: chemin.split('/').pop(),
    contenu: git(['show', `:${chemin}`], cwd),
  }))
}

/**
 * La dernière revue de HEAD qui JUGE son histoire : celle dont la tête de fenêtre est un ancêtre de
 * HEAD, et dont il reste le moins de commits jusqu'à HEAD. C'est la FENÊTRE qui décide, jamais le nom
 * du fichier — `.claude/soldes/revue-palier-82e95be10.md` porte dans son NOM un sha orphelin (la
 * version pré-rebase de `112c814b6`), et sa FENÊTRE `7692b631c..2c11fdd9a` est bien dans l'histoire :
 * c'est cette revue-là qui fait référence.
 * Une ASCENDANCE INDISPONIBLE (git muet) n'est pas « orpheline » : elle a son propre état, et
 * l'appelant la nomme au lieu de conclure que la revue ne juge rien.
 * @returns {{ etat:'trouvee', chemin:string, date:string|null, base:string|null, tete:string, reste:number }
 *   | { etat:'aucune-archive' } | { etat:'toutes-orphelines', chemins:string[] }
 *   | { etat:'ascendance-indisponible', raison:string }}
 */
export function derniereRevueArchivee(cwd = process.cwd()) {
  const archivees = archivesDe(cwd)
  if (archivees.length === 0) return { etat: 'aucune-archive' }
  const jugeantes = []
  for (const r of archivees) {
    if (!r.tete) continue
    const vu = estAncetre(r.tete, 'HEAD', { cwd })
    if (!vu.disponible) return { etat: 'ascendance-indisponible', raison: vu.raison }
    if (vu.absent || vu.valeur !== true) continue
    jugeantes.push({ ...r, reste: Number.parseInt(git(['rev-list', '--count', `${r.tete}..HEAD`], cwd).trim(), 10) })
  }
  jugeantes.sort((a, b) => a.reste - b.reste || parUnitesDeCode(a.chemin, b.chemin))
  if (jugeantes.length === 0) return { etat: 'toutes-orphelines', chemins: archivees.map((r) => r.chemin) }
  return { etat: 'trouvee', ...jugeantes[0] }
}

/** L'ascendance de `sha` vis-à-vis de HEAD, en union à trois issues : la tête de fenêtre d'une revue
 *  neuve est un commit que ce dépôt porte, sinon la revue juge une histoire qui n'existe pas ici. Un
 *  sha INCONNU rend `absent` — l'appelant en fait « pas dans cette histoire ». Le PRÉDICAT booléen
 *  correspondant est `estDansHead` (`gitPorte.mjs`), partagé avec le garde de solde. */
export const ascendanceDansHead = (sha, cwd = process.cwd()) =>
  sha ? estAncetre(sha, 'HEAD', { cwd }) : { disponible: true, absent: true }

/** Commits de SUBSTANCE depuis `tete` : ceux qui touchent `src` ou `scripts`, plus celui que l'index
 *  s'apprête à faire s'il en touche aussi (le commit en cours compte pour le palier qu'il franchit). */
export function commitsDeSubstanceDepuis(cwd, tete) {
  const publies = Number.parseInt(
    git(['rev-list', '--count', `${tete}..HEAD`, '--', 'src', 'scripts'], cwd).trim(), 10,
  )
  const stage = git(['diff', '--cached', '--name-only', '--', 'src', 'scripts'], cwd).trim()
  return (Number.isFinite(publies) ? publies : 0) + (stage ? 1 : 0)
}

/**
 * Ce que le contrôle de palier a besoin de savoir, mesuré. `erreur` = le palier est INMESURABLE et le
 * dit ; `compte: 0` sans référence = HEAD ne porte AUCUNE revue archivée, donc le palier n'a pas
 * d'origine à partir de laquelle compter — ce qui n'est pas un défaut de l'arbre jugé.
 * @returns {{ compte:number, tete:string|null, chemin:string|null, erreur?:string }}
 */
export function mesureDuPalier(cwd = process.cwd()) {
  let derniere
  try {
    derniere = derniereRevueArchivee(cwd)
  } catch (err) {
    return { compte: 0, tete: null, chemin: null, erreur: `histoire illisible depuis ${cwd} — ${err.message}` }
  }
  if (derniere.etat === 'aucune-archive') return { compte: 0, tete: null, chemin: null }
  if (derniere.etat === 'ascendance-indisponible') {
    return {
      compte: 0,
      tete: null,
      chemin: null,
      erreur: `ascendance indisponible : ${derniere.raison} — le palier ne se mesure pas sans git`,
    }
  }
  if (derniere.etat === 'toutes-orphelines') {
    return {
      compte: 0,
      tete: null,
      chemin: null,
      erreur:
        `aucune des ${derniere.chemins.length} revues archivées ne juge l'histoire de HEAD — leur tête de `
        + `fenêtre n'en est pas un ancêtre (${derniere.chemins.join(', ')}) : le palier ne peut pas se mesurer, `
        + 'et une revue dont la tête de fenêtre est ORPHELINE (rebase) se ré-écrit sur sa fenêtre réelle',
    }
  }
  return { compte: commitsDeSubstanceDepuis(cwd, derniere.tete), tete: derniere.tete, chemin: derniere.chemin }
}
