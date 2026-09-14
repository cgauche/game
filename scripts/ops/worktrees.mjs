// INVENTAIRE DES WORKTREES — ce que git sait de chaque arbre lié, CLASSÉ, et une purge qui ne
// touche QUE ce qui ne peut rien perdre.
//
// Le danger d'un dépôt à trente worktrees n'est pas d'en garder un de trop : c'est d'en retirer un
// qui portait du travail. Le classement répond donc à UNE question par arbre — « que perdrait-on à
// le retirer ? » — et l'ordre de priorité est celui du RISQUE : principal (jamais), absent (déjà
// perdu, git n'a qu'à l'oublier), verrouillé (quelqu'un l'a dit), sale (des modifications non
// commitées), propre hors de `origin/main` (des commits que main n'a pas), propre et fusionné
// (rien à perdre).
//
// La purge n'emploie AUCUN geste forçant : `git worktree remove` sans `--force` refuse un arbre
// sale, `git branch -d` (minuscule) refuse une branche non fusionnée. Ces deux refus sont la
// DERNIÈRE barrière — un `-f` ici ferait du classement le seul garde-fou, et un classement est
// faillible.
//
// Le verdict de fusion se lit contre `origin/main` APRÈS un `fetch` unique. S'il est indisponible,
// l'inventaire s'imprime SANS ce verdict et la purge REFUSE : on ne purge pas sur rien.
//
// Usage : `npm run ops:worktrees` (inventaire seul) ou `npm run ops:worktrees -- --purger`.
import { fileURLToPath } from 'node:url'
import { estAncetre, fetchOrigin, lireGit, natureDuChemin } from '../guards/lib/gitPorte.mjs'

/** Racine de l'arbre qui porte CE script (le dépôt commun répond pour tous ses worktrees). */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/**
 * `git worktree list --porcelain` → un enregistrement par worktree. PURE.
 * Blocs séparés par une ligne vide ; le PREMIER bloc est l'arbre principal.
 * @param {string} texte
 * @returns {{chemin: string, head: string|null, branche: string|null, verrouille: boolean,
 *   verrouillePour: string|null, principal: boolean, prunable: string|null, nu: boolean}[]}
 */
export function parseWorktrees(texte) {
  const blocs = String(texte ?? '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  return blocs.map((bloc, i) => {
    const w = {
      chemin: '', head: null, branche: null, verrouille: false, verrouillePour: null,
      principal: i === 0, prunable: null, nu: false,
    }
    for (const ligne of bloc.split('\n')) {
      const [cle, ...reste] = ligne.trim().split(' ')
      const valeur = reste.join(' ').trim()
      if (cle === 'worktree') w.chemin = valeur
      else if (cle === 'HEAD') w.head = valeur
      else if (cle === 'branch') w.branche = valeur.replace(/^refs\/heads\//, '')
      else if (cle === 'detached') w.branche = null
      else if (cle === 'bare') w.nu = true
      else if (cle === 'locked') { w.verrouille = true; w.verrouillePour = valeur || null }
      else if (cle === 'prunable') w.prunable = valeur || 'prunable'
    }
    return w
  }).filter((w) => w.chemin)
}

/** Les six classes, de la plus intouchable à la seule purgeable. */
export const CLASSES = ['principal', 'absent', 'verrouillé', 'sale', 'propre+hors-main', 'propre+fusionné']

/**
 * Classe d'un worktree — l'ORDRE est celui du risque, et il est total : une combinaison ne peut pas
 * rendre deux classes. Un verdict de fusion INCONNU (`fusionne` nul) est traité comme « hors de
 * main » : la purge ne s'ouvre que sur un OUI mesuré. PURE.
 * @param {{principal?: boolean, sale?: boolean, fusionne?: boolean|null, verrouille?: boolean,
 *   absent?: boolean}} etat
 * @returns {'principal'|'absent'|'verrouillé'|'sale'|'propre+hors-main'|'propre+fusionné'}
 */
export function classerWorktree({ principal = false, sale = false, fusionne = null, verrouille = false, absent = false }) {
  if (principal) return 'principal'
  if (absent) return 'absent'
  if (verrouille) return 'verrouillé'
  if (sale) return 'sale'
  return fusionne === true ? 'propre+fusionné' : 'propre+hors-main'
}

/** Sha court d'un head porcelain. PURE. */
export const shaCourt = (head) => (head ? String(head).slice(0, 7) : '?')

/** Ce que la ligne d'inventaire nomme dans sa colonne « branche ». PURE. */
export const refDe = (w) => w.branche ?? `détaché@${shaCourt(w.head)}`

/** LA raison — pourquoi on y touche, ou pourquoi on n'y touche pas. PURE. */
export function raisonDe(w) {
  switch (w.classe) {
    case 'principal': return 'arbre principal — jamais touché'
    case 'absent': return `répertoire absent (${w.prunable ?? 'disparu du disque'}) — git worktree prune`
    case 'verrouillé': return `verrouillé${w.verrouillePour ? ` : ${w.verrouillePour}` : ''} — déverrouiller d'abord`
    case 'sale': return 'modifications non commitées — rien ne se retire sous elles'
    case 'propre+hors-main': return w.fusionne === null
      ? 'verdict de fusion indisponible — origin/main non lu'
      : 'des commits que origin/main n’a pas — pas encore purgeable'
    default: return 'fusionné dans origin/main — purgeable'
  }
}

/** Une ligne d'inventaire : `<classe>\t<chemin>\t<branche|détaché@sha>\t<raison>`. PURE. */
export const ligneDInventaire = (w) => [w.classe, w.chemin, refDe(w), raisonDe(w)].join('\t')

/** Compte par classe, dans l'ordre de `CLASSES`, classes vides omises. PURE. */
export function comptesParClasse(worktrees) {
  const comptes = {}
  for (const classe of CLASSES) {
    const n = worktrees.filter((w) => w.classe === classe).length
    if (n) comptes[classe] = n
  }
  return comptes
}

/**
 * Inventaire classé des worktrees du dépôt de `racine`. `git`, `fetch` et la sonde de disque sont
 * injectables (mesure).
 * @param {{racine?: string, git?: Function, fetch?: Function, nature?: Function}} [params]
 * @returns {{ok: true, worktrees: object[], fusionLue: boolean} | {ok: false, refus: string}}
 */
export function inventaire({ racine = RACINE, git = lireGit, fetch = fetchOrigin, nature = natureDuChemin } = {}) {
  const vuFetch = fetch({ cwd: racine })
  const fusionLue = vuFetch.disponible === true

  const vuListe = git(['worktree', 'list', '--porcelain'], { cwd: racine, site: 'git worktree list' })
  if (!vuListe.disponible) return { ok: false, refus: `git worktree list illisible : ${vuListe.raison}` }
  if (vuListe.absent || vuListe.valeur.status !== 0) return { ok: false, refus: 'git worktree list n’a rien rendu' }

  const worktrees = parseWorktrees(vuListe.valeur.stdout).map((w) => {
    if (w.principal) return { ...w, absent: false, sale: false, fusionne: null, classe: 'principal' }
    const absent = nature(w.chemin) !== 'repertoire'
    let sale = false
    if (!absent) {
      const vuStatus = git(['-C', w.chemin, 'status', '--porcelain'], { cwd: racine, site: 'git status' })
      sale = vuStatus.disponible && !vuStatus.absent && vuStatus.valeur.stdout.trim() !== ''
    }
    let fusionne = null
    if (fusionLue && !absent && w.head) {
      const vu = estAncetre(w.head, 'origin/main', { cwd: racine })
      fusionne = vu.disponible && !vu.absent ? vu.valeur === true : null
    }
    const enrichi = { ...w, absent, sale, fusionne }
    return { ...enrichi, classe: classerWorktree({ ...enrichi, principal: false }) }
  })

  return { ok: true, worktrees, fusionLue }
}

/**
 * Retire les worktrees `propre+fusionné`, et EUX SEULS. Aucun geste forçant : les refus de git
 * (`remove` sans `--force`, `branch -d`) sont la dernière barrière.
 * @param {{racine?: string, worktrees: object[], git?: Function}} params
 * @returns {{chemin: string, geste: string, ok: boolean, detail: string}[]}
 */
export function purger({ racine = RACINE, worktrees, git = lireGit }) {
  const gestes = []
  const rendu = (vu) => (vu.disponible
    ? (vu.absent ? 'objet absent' : `code ${vu.valeur.status}${vu.valeur.stderr.trim() ? ` — ${vu.valeur.stderr.trim()}` : ''}`)
    : `indisponible — ${vu.raison}`)
  const reussi = (vu) => vu.disponible && !vu.absent && vu.valeur.status === 0

  for (const w of worktrees.filter((x) => x.classe === 'propre+fusionné')) {
    const vuRemove = git(['worktree', 'remove', w.chemin], { cwd: racine, site: 'git worktree remove' })
    gestes.push({ chemin: w.chemin, geste: `git worktree remove ${w.chemin}`, ok: reussi(vuRemove), detail: rendu(vuRemove) })
    if (!reussi(vuRemove) || !w.branche) continue
    const vuBranche = git(['branch', '-d', w.branche], { cwd: racine, site: 'git branch -d' })
    gestes.push({ chemin: w.chemin, geste: `git branch -d ${w.branche}`, ok: reussi(vuBranche), detail: rendu(vuBranche) })
  }
  // Un worktree `absent` (dossier disparu, `prunable`) suffit à justifier la taille : sans cela,
  // l'inventaire le répéterait à chaque passage tant qu'aucun retrait n'a lieu par ailleurs.
  if (gestes.length || worktrees.some((w) => w.classe === 'absent')) {
    const vuPrune = git(['worktree', 'prune'], { cwd: racine, site: 'git worktree prune' })
    gestes.push({ chemin: racine, geste: 'git worktree prune', ok: reussi(vuPrune), detail: rendu(vuPrune) })
  }
  return gestes
}

function main() {
  const veutPurger = process.argv.slice(2).includes('--purger')
  const vu = inventaire({ racine: RACINE })
  if (!vu.ok) {
    process.stderr.write(`[worktrees] ${vu.refus}\n`)
    process.exit(1)
  }
  for (const w of vu.worktrees) process.stdout.write(`${ligneDInventaire(w)}\n`)
  const comptes = comptesParClasse(vu.worktrees)
  process.stdout.write(`\n${Object.entries(comptes).map(([c, n]) => `${c}=${n}`).join(' ')}\n`)
  if (!vu.fusionLue) process.stdout.write('origin/main non lu (fetch indisponible) : aucun verdict de fusion\n')

  if (!veutPurger) return
  if (!vu.fusionLue) {
    process.stderr.write('[worktrees] --purger refusé : origin/main n’a pas été lu, on ne purge pas sur rien.\n')
    process.exit(1)
  }
  const gestes = purger({ racine: RACINE, worktrees: vu.worktrees })
  if (!gestes.length) process.stdout.write('rien à purger : aucun worktree propre+fusionné\n')
  for (const g of gestes) process.stdout.write(`${g.ok ? 'ok' : 'ÉCHEC'}\t${g.geste}\t${g.detail}\n`)
  if (gestes.some((g) => !g.ok)) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
