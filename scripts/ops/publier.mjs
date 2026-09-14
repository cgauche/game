// PUBLICATION — le TRAIN, en un processus du dépôt.
//
// INVARIANT (ticket #1736, « Design », 2026-09-14) : « La PUBLICATION est un train d'ÉTAPES FIXES,
// jouées par UN processus du dépôt, détaché du harnais, idempotent et REPRENABLE ; l'orchestrateur
// lance, lit un journal, juge le contenu — il ne joue plus aucune étape à la main. Critère
// "l'étape N+1 coûte une ligne" : ajouter une étape = une entrée dans la table `ETAPES` (nom,
// `jouer(ctx)`, `dejaFaite(ctx)`), rien d'autre. »
//
// RÉGIME (CLAUDE.md § Commandes) : commit FINAL → gates → push. Le train le joue dans l'ordre de
// `ci.yml`, en NEUF étapes — preflight, derives, rebase, docs, gates, push, ci, pilotage, fin :
// preflight (une saleté faite UNIQUEMENT de docs DÉRIVÉS ne refuse pas : l'étape `derives` la
// commet ; les PRÉREQUIS de toutes les gates de `ci.yml` y sont mesurés AVANT de payer la série),
// derives (les docs dérivés laissés non commités par le hook `post-rewrite` d'un rebase
// MANUEL sont commis AVANT le rebase — mesuré le 2026-09-14 : `git rebase origin/main` refuse de
// DÉMARRER sur un arbre sale, « cannot rebase: You have unstaged changes »), rebase sur
// origin/main, docs dérivés régénérés — la plage sans source de doc saute la RÉGÉNÉRATION, jamais
// le COMMIT — gates en SÉRIE, push `HEAD:main` par la porte pre-push, sonde de la course CI,
// pilotage des tickets cités, fin.
//
// INTERDITS, gravés — `commandeInterdite` les refuse AVANT tout spawn, et ce fichier ne porte aucun
// `gh issue close` (la fermeture appartient au job `fermetures` de la CI) :
//   · `git add -A` / `--all` / `.`      — le commit des docs stage des chemins EXPLICITES ;
//   · `git stash`                        — rien ne se met de côté ;
//   · `git push --force` / `-f` / `--force-with-lease`, et aucun levier de dérogation du pre-push ;
//   · `git reset --hard`, `git branch -D`, `git worktree remove --force` ;
//   · `git commit` sans `--` de chemins explicites ;
//   · `git checkout` / `git restore`     — le train ne restaure jamais un fichier.
// Un rebase INTERROMPU trouvé sur disque à la préflight est NOMMÉ, jamais avorté d'office.
//
// Usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--ci-timeout-min <n>]
//                                      [--verrou-timeout-min <n>]
import { spawnSync, spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { estAncetre, fetchOrigin, lireGit, raisonCourte, sortieOuNull, urlOrigineAcceptee } from '../guards/lib/gitPorte.mjs'
import { ANNULEE, ROUGES, coursesCiDeMain } from '../guards/lib/coursesCi.mjs'
import { clesDeContenu, gatesRequises, lireJustificatif, motifDeRefus } from '../guards/lib/justificatif.mjs'
import { numerosCites, numerosFermes } from '../guards/lib/fermetures.mjs'
import { DEPOT, commitsDeLaPlage, marqueDe } from './fermer-depuis-main.mjs'
import { GENERATORS, SOURCES_LUES } from '../docs/build-all.mjs'
import { MANAGED_ROOTS } from '../agents/compat-core.mjs'
import { touchesDocSources } from '../git-hooks/docs-rebuild.mjs'
import { ECRIT_LU, fichierDurees, prerequisAbsents, refusDePrerequis } from '../gates/toutes.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { CHEMIN_VERROU, lireTenant, tenantVivant } from '../test/verrou.mjs'
import { resoudreOutilLocal } from '../lancer-local.mjs'

/** L'arbre où VIT ce script — jamais `process.cwd()` : le train publie SON worktree. */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Délai par défaut, en minutes, de la sonde de course CI. */
export const CI_TIMEOUT_MIN = 40

/**
 * Délai par défaut, en minutes, de la sonde du VERROU MACHINE (`scripts/test/verrou.mjs`) : le temps
 * qu'on accorde à une suite tierce avant de refuser. Mesuré (#1736, trains réels du 2026-09-14) :
 * une série de gates dure de 689 à 1 434 s — deux séries tierces enchaînées tiennent sous 60 min.
 */
export const VERROU_TIMEOUT_MIN = 60

/** Période de la sonde CI — et de la sonde du verrou — en millisecondes. */
export const PERIODE_SONDE_MS = 30_000

/** Nom du workflow que la sonde reconnaît (`.github/workflows/ci.yml`, `name: CI`). */
export const WORKFLOW = 'CI'

/** Marque d'IDEMPOTENCE du pilotage : elle porte la tête publiée. */
export const marquePublication = (sha) => `<!-- publier: ${sha} -->`

// ── Purs : options, journal, plan ──────────────────────────────────────────────────────

/**
 * Options de la ligne de commande. PURE — grammaire propre (drapeaux booléens + une option à
 * valeur) : `separerInvocation` lit `<positionnel> [--opt val]* -- reste`, une grammaire qui n'est
 * pas la nôtre.
 * @param {string[]} argv arguments APRÈS `node publier.mjs`
 * @returns {{detache:boolean, reprendre:boolean, etapes:boolean, ciTimeoutMin:number, verrouTimeoutMin:number, inconnus:string[]}}
 */
export function optionsDe(argv) {
  const args = (argv ?? []).map(String)
  const connus = new Set(['--detache', '--reprendre', '--etapes', '--ci-timeout-min', '--verrou-timeout-min'])
  const valeurs = { '--ci-timeout-min': CI_TIMEOUT_MIN, '--verrou-timeout-min': VERROU_TIMEOUT_MIN }
  const inconnus = []
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (Object.hasOwn(valeurs, a)) {
      const n = Number(args[i + 1])
      if (Number.isFinite(n) && n > 0) valeurs[a] = n
      i += 1
      continue
    }
    if (!connus.has(a)) inconnus.push(a)
  }
  return {
    detache: args.includes('--detache'),
    reprendre: args.includes('--reprendre'),
    etapes: args.includes('--etapes'),
    ciTimeoutMin: valeurs['--ci-timeout-min'],
    verrouTimeoutMin: valeurs['--verrou-timeout-min'],
    inconnus,
  }
}

/** Nom de fichier de journal d'une branche : tout ce qui n'est ni mot, ni point, ni tiret fond en
 *  `_` (`chantier/1736-publier` → `chantier_1736-publier`). PURE. */
export const nomDeJournal = (branche) => String(branche ?? 'sans-branche').replace(/[^\w.-]+/g, '_')

/** Journal neuf d'une branche. PURE. */
export const journalVide = (branche) => ({ branche, base: null, tete: null, reprises: 0, etapes: {} })

/**
 * Le journal dont un run PART. PURE. Sans `--reprendre`, un run est un LOT NEUF : le journal du
 * disque ne le contamine pas. Sans cela, `reprises` survivait d'un lot à l'autre (un 2ᵉ lot
 * refuserait « origin/main a bougé DEUX fois » dès le premier mouvement) et les étapes vertes d'un
 * autre contenu décoreraient son pilotage.
 * @param {{reprendre:boolean, lu:object|null, branche:string}} p `lu` = journal du disque, ou `null`
 * @returns {{journal:object, repris:boolean, vertes:number}}
 */
export function journalInitial({ reprendre, lu, branche }) {
  if (!reprendre || !lu) return { journal: journalVide(branche), repris: false, vertes: 0 }
  const vertes = Object.values(lu.etapes ?? {}).filter((e) => e?.etat === 'vert').length
  return { journal: lu, repris: true, vertes }
}

/**
 * Mode d'ouverture du LOG — il suit `journalInitial` : un run NEUF (sans `--reprendre`) est un lot
 * neuf, son log part VIDE (`'w'`) ; `--reprendre` continue le même lot, donc APPEND (`'a'`). PURE.
 * Mesuré (2026-09-14, premier train réel) : ouvert en `'a'` sans condition, un run neuf écrivait à
 * la suite du précédent, et une veille `until grep -q "^PUBLICATION:" <log>` se déclenchait aussitôt
 * sur la ligne `PUBLICATION:` du run d'avant.
 * `enfant` = le processus spawné par `--detache` : le PARENT a déjà tronqué (mode décidé ici) avant
 * de spawner, donc l'enfant ouvre TOUJOURS en append — sinon il tronquerait le log de son parent.
 * @param {{reprendre?:boolean, enfant?:boolean}} p
 * @returns {'w'|'a'}
 */
export const modeDuLog = ({ reprendre = false, enfant = false } = {}) => (reprendre || enfant ? 'a' : 'w')

/**
 * La ligne que le PARENT laisse dans le log quand il détache l'enfant. PURE.
 * Sans elle, `--detache` ne laisse aucune trace MACHINE : le pid et le log ne sont écrits que sur le
 * stdout du parent, que personne ne conserve (mesuré le 2026-09-14 :
 * `grep -c -E "tach|pid=|log=" node_modules/.cache/publication/chantier_1736-publier.log` → 0 sur
 * 446 lignes, trois trains réels). L'enfant n'y touche pas : il est né après.
 * @param {{pid: number, log: string, args: string[]}} p
 * @returns {string} ligne terminée par un saut
 */
export const ligneDeDetachement = ({ pid, log, args }) =>
  `[publier] détaché — pid=${pid} log=${log} args=${(args ?? []).join(' ')}\n`

/** Nom de ROTATION du log d'un run précédent : `<nom>.<AAAAMMJJ-HHMMSS>.log`, horodaté en heure locale
 *  (celle que l'opérateur lit). PURE. @param {string} chemin log courant @param {Date} date */
export function nomDeRotation(chemin, date) {
  const d = (n, l = 2) => String(n).padStart(l, '0')
  const horodatage =
    `${d(date.getFullYear(), 4)}${d(date.getMonth() + 1)}${d(date.getDate())}` +
    `-${d(date.getHours())}${d(date.getMinutes())}${d(date.getSeconds())}`
  return `${String(chemin).replace(/\.log$/, '')}.${horodatage}.log`
}

/** Motif des logs de ROTATION d'un log courant — il ne matche NI `<nom>.log`, NI le `<nom>.json.<pid>.tmp`
 *  de `sauverJournal`. PURE. @param {string} chemin log courant @returns {RegExp} sur le NOM de fichier */
export function motifDeRotation(chemin) {
  const nom = String(chemin).split(/[\\/]/).pop().replace(/\.log$/, '')
  return new RegExp(`^${nom.replace(/[.+^${}()|[\]\\*?]/g, '\\$&')}\\.\\d{8}-\\d{6}\\.log$`)
}

/**
 * ROTATION du log : un log NON VIDE est renommé (`nomDeRotation`) avant qu'un run neuf ne reparte —
 * la trace du run précédent survit, et le log courant repart vide, donc la veille `^PUBLICATION:`
 * reste valide sans offset. Le bornage est par PÉREMPTION d'ÂGE, par la source unique
 * `purgerPerimes` — aucune constante de compte ici. Ce n'est PAS une archive :
 * `node_modules/.cache/` est effacé par le `npm ci` d'`ops:chantier` — le log est une trace de
 * travail, la PREUVE d'une publication est sa sortie collée au ticket.
 * @param {string} chemin log courant @param {Date} date
 * @returns {string|null} le chemin du log tourné, `null` si rien n'a été tourné
 */
export function rotationnerLog(chemin, date = new Date()) {
  let tourne = null
  try {
    if (statSync(chemin).size > 0) {
      tourne = nomDeRotation(chemin, date)
      renameSync(chemin, tourne)
    }
  } catch {
    /* log absent, ou tenu par un autre processus : le run neuf repart vide de toute façon */
    tourne = null
  }
  purgerPerimes({ dossier: join(chemin, '..'), motif: motifDeRotation(chemin), ageMs: PEREMPTION_MS })
  return tourne
}

/**
 * Ouvre le log dans le mode décidé par `modeDuLog`. Le fd rendu est TOUJOURS en `'a'` : en mode
 * détaché, le MÊME fichier porte deux écrivains (le fd hérité comme stdout/stderr de l'enfant, et
 * le fd que l'enfant ouvre pour `journaliser`) — deux fds à offset propre se piétineraient, deux
 * fds en append jamais. Le `'w'` se joue donc par une ROTATION puis une TRONCATURE explicite, une
 * seule fois.
 * @param {string} chemin @param {'w'|'a'} mode
 */
function ouvrirLog(chemin, mode) {
  if (mode === 'w') {
    rotationnerLog(chemin)
    writeFileSync(chemin, '')
  }
  return openSync(chemin, 'a')
}

/** Les gates ont-elles été REJOUÉES pour la tête du journal (et non simplement justifiées d'avance) ?
 *  PURE — la trace vit sur l'ÉTAPE, jamais en drapeau top-level qui survivrait au lot suivant. */
export const gatesRejouees = (journal) =>
  journal?.etapes?.gates?.detail?.joue === true && journal.etapes.gates.tete === journal.tete

/**
 * Première étape NON VERTE du journal — le point de reprise. Une étape verte POUR UNE AUTRE TÊTE est
 * « à faire » : sans cela, un 2ᵉ lot sur la même branche sauterait la sonde CI et le pilotage et
 * s'annoncerait vert. PURE.
 *
 * RÈGLE DE TÊTE, une seule : la comparaison porte sur la TÊTE VIVANTE (`git rev-parse HEAD` au
 * moment où l'on juge), jamais sur `journal.tete` (la tête PUBLIÉE, posée par `derives`/`rebase`), et
 * une étape SANS estampille est « à faire ». Sans cela, une étape estampillée `null` (`preflight` et
 * `derives` d'un journal d'avant cette règle) restait verte pour TOUTE tête, à jamais.
 * @param {{etapes?:object}} journal @param {string[]} noms ordre de `ETAPES`
 * @param {string|null} teteVivante `HEAD` mesuré maintenant
 * @returns {string|null} `null` = tout est vert pour cette tête
 */
export function planDeReprise(journal, noms, teteVivante) {
  const etapes = journal?.etapes ?? {}
  for (const nom of noms) {
    const vue = etapes[nom]
    if (!vue || vue.etat !== 'vert') return nom
    if (vue.tete == null || vue.tete !== teteVivante) return nom
  }
  return null
}

/** État affiché d'une étape au journal (`--etapes`), sous la MÊME règle de tête que `planDeReprise`. PURE. */
export const etatDeLEtape = (journal, nom, teteVivante) => {
  const vue = journal?.etapes?.[nom]
  if (!vue) return 'à faire'
  if (vue.etat === 'vert' && (vue.tete == null || vue.tete !== teteVivante)) return 'à faire (verte pour une autre tête)'
  return vue.etat
}

/**
 * Le MOTEUR du train : joue les étapes dans l'ordre, saute celles que `dejaFaite` déclare, arrête à
 * la première rouge, écrit le journal après CHAQUE étape. PUR hors des `jouer` qu'on lui donne —
 * testable avec des étapes factices.
 *
 * Une étape peut demander une RELANCE (`{ relancer: [<noms>] }`, cas « origin/main a bougé ») : les
 * étapes nommées repassent « à faire » et le train reprend du début. Une seule fois — le compteur
 * `reprises` du journal est la borne, et l'étape qui demande la relance la lit.
 * @returns {{etat:'vert'|'rouge'|'indeterminee', etape?:string, raison?:string}}
 */
export function jouerLeTrain(ctx, etapes, journal, { sauver = () => {}, journaliser = () => {} } = {}) {
  const noms = etapes.map((e) => e.nom)
  for (let tour = 0; tour <= etapes.length; tour += 1) {
    let relance = null
    for (const etape of etapes) {
      if (etape.dejaFaite(ctx, journal)) {
        // Une étape déjà faite s'ENREGISTRE, estampillée comme une étape jouée : sans cela, le journal
        // d'un run repris ne portait AUCUNE trace machine des étapes constatées, et `--etapes` les
        // rendait « à faire » après coup. Le détail précédent est CONSERVÉ : `ci.dejaFaite` (:800) le
        // relit (`detail.etat === 'verte'`), l'écraser ferait resonder la course à chaque reprise.
        const vu = journal.etapes[etape.nom]
        const instant = new Date().toISOString()
        journal.etapes[etape.nom] = {
          etat: 'vert',
          debut: instant,
          fin: instant,
          detail: { ...(vu?.detail ?? {}), dejaFaite: true },
          tete: ctx.tete ?? null,
        }
        sauver(journal)
        journaliser(`[publier] ${etape.nom} — déjà faite\n`)
        continue
      }
      journaliser(`[publier] ${etape.nom} — début\n`)
      const debut = Date.now()
      const vu = etape.jouer(ctx, journal) ?? { ok: false, raison: 'aucun verdict rendu' }
      const secondes = (Date.now() - debut) / 1000
      journal.etapes[etape.nom] = {
        etat: vu.ok ? 'vert' : vu.indetermine ? 'indéterminée' : 'rouge',
        debut: new Date(debut).toISOString(),
        fin: new Date().toISOString(),
        detail: vu.detail ?? null,
        tete: ctx.tete ?? null,
      }
      sauver(journal)
      if (vu.ok) {
        journaliser(`[publier] ${etape.nom} — vert (${secondes.toFixed(1)} s)${vu.dit ? ` : ${vu.dit}` : ''}\n`)
        if (vu.relancer) {
          relance = vu.relancer
          break
        }
        continue
      }
      if (vu.indetermine) {
        journaliser(`[publier] ${etape.nom} — INDÉTERMINÉE : ${vu.raison}\n`)
        return { etat: 'indeterminee', etape: etape.nom, raison: vu.raison }
      }
      journaliser(`[publier] ${etape.nom} — ROUGE : ${vu.raison}\n`)
      return { etat: 'rouge', etape: etape.nom, raison: vu.raison }
    }
    if (!relance) return { etat: 'vert' }
    for (const nom of relance) if (noms.includes(nom)) journal.etapes[nom] = { etat: 'à faire', tete: null }
    sauver(journal)
    journaliser(`[publier] relance du train depuis ${relance[0]}\n`)
  }
  return { etat: 'rouge', etape: 'moteur', raison: 'trop de relances du train' }
}

// ── Purs : verdicts et mise en forme ───────────────────────────────────────────────────

/**
 * Verdict de la CI pour un sha, lu dans les courses TRIÉES (`coursesCiDeMain` trie `createdAt`
 * décroissant). PUR. Une conclusion inconnue n'est PAS verte : elle rougit, et se nomme.
 * @returns {{etat:'absente'|'en-vol'|'verte'|'rouge'|'annulee', course?:object}}
 */
export function verdictDesRuns(courses, sha, { workflow = WORKFLOW } = {}) {
  const notres = (courses ?? []).filter(
    (c) => String(c?.headSha ?? '') === String(sha) && (!c?.workflowName || String(c.workflowName) === workflow),
  )
  if (!notres.length) return { etat: 'absente' }
  const course = notres[0]
  if (String(course.status ?? 'completed') !== 'completed') return { etat: 'en-vol', course }
  const conclusion = String(course.conclusion ?? '')
  if (conclusion === ANNULEE) return { etat: 'annulee', course }
  if (conclusion === 'success') return { etat: 'verte', course }
  // `ROUGES` nomme les trois échecs connus ; toute AUTRE conclusion (`neutral`, `skipped`, une
  // valeur neuve de GitHub) n'est pas verte non plus — elle rougit, et le journal la porte.
  return { etat: 'rouge', course, inattendue: !ROUGES.has(conclusion) }
}

/**
 * Que faire de la série de gates, vu le dernier code rendu et l'état du verrou machine ? PURE —
 * la sonde du verrou est une INSTANCE de la sonde CI (`attendre(PERIODE_SONDE_MS)` en boucle bornée).
 *  - `'rejouer'`        : (re)jouer la série — aucun run encore joué, ou le verrou n'a rien refusé ;
 *  - `'sonder'`         : le verrou est tenu par un PID VIVANT et la borne n'est pas atteinte ;
 *  - `'rouge-borne'`    : la borne de sonde est ATTEINTE — elle PRIME, même si le tenant vient de
 *    mourir au même tour : ce qu'on a vécu est une attente bornée, et le refus doit le dire ;
 *  - `'rouge-orphelin'` : refus 2 SANS tenant vivant avant la borne (le 2 ne vient que du verrou).
 * @param {{status:number|null, tenantVivant:object|null, debut:number, maintenant:number, timeoutMin:number}} p
 * @returns {'rejouer'|'sonder'|'rouge-borne'|'rouge-orphelin'}
 */
export function verdictDeSondeDuVerrou({ status, tenantVivant, debut, maintenant, timeoutMin }) {
  if (status !== 2) return 'rejouer'
  if (maintenant - debut >= timeoutMin * 60_000) return 'rouge-borne'
  if (!tenantVivant) return 'rouge-orphelin'
  return 'sonder'
}

/** `motif` de glob SIMPLE (`*` = un segment sans `/`) appliqué à un chemin POSIX. PURE. */
export function correspondGlob(chemin, motif) {
  const echappe = String(motif).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
  return new RegExp(`^${echappe}$`).test(String(chemin))
}

/**
 * Ce chemin est-il DÉRIVÉ, donc committable par l'étape `docs` ? Trois familles, toutes déclarées
 * ailleurs : les `targets`/`injecte` des `GENERATORS`, la mesure `docs/.sources-lues.json`
 * (`build-all.mjs` REFUSE si elle n'est pas dans l'index), et les sorties de `npm run agents:sync`
 * (le pre-commit joue `agents:check` à chaque commit). PURE.
 */
export function estDocDerive(chemin, generators = GENERATORS, { sourcesLues = SOURCES_LUES, racinesAgents = MANAGED_ROOTS } = {}) {
  const c = String(chemin ?? '').replace(/\\/g, '/')
  if (!c) return false
  if (c === sourcesLues) return true
  if (racinesAgents.some((r) => c === r || c.startsWith(`${r}/`))) return true
  return (generators ?? []).some((g) =>
    [...(g.targets ?? []), ...(g.injecte ?? [])].some((motif) => correspondGlob(c, motif)),
  )
}

/**
 * Partage des chemins SALES en deux tas : ce que l'étape `docs` sait committer (`estDocDerive`) et
 * le reste. PURE. Mesuré (2026-09-14, premier train réel) : après un rebase MANUEL, le hook
 * `post-rewrite` régénère les docs dérivés SANS les committer (`scripts/git-hooks/docs-rebuild.mjs`)
 * — sans ce partage, la préflight refusait le train pour une saleté que l'étape `docs` commet.
 * @param {string[]} chemins
 * @returns {{derives:string[], manuscrits:string[]}}
 */
export function partitionSales(chemins, ...reste) {
  const derives = []
  const manuscrits = []
  for (const c of chemins ?? []) (estDocDerive(c, ...reste) ? derives : manuscrits).push(c)
  return { derives, manuscrits }
}

/**
 * Options GLOBALES de git, posées AVANT le sous-commande (`git -c k=v push …`, `git -C dir add …`).
 * Les sauter est la condition pour que `commandeInterdite` lise le vrai sous-commande : sans cela,
 * `['-c','x=y','add','-A']` passait pour un sous-commande `-c` inconnu, donc AUTORISÉ. PURE.
 * @returns {string[]} les arguments à partir du sous-commande
 */
export function sansOptionsGlobales(args) {
  const a = (args ?? []).map(String)
  const aValeur = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env'])
  let i = 0
  while (i < a.length) {
    const x = a[i]
    if (aValeur.has(x)) {
      i += 2
      continue
    }
    if (x.startsWith('--') && x.includes('=')) {
      i += 1
      continue
    }
    if (x.startsWith('-')) {
      i += 1
      continue
    }
    break
  }
  return a.slice(i)
}

/** Refus de commande, ou `null`. PURE — la SEULE liste des gestes que le train ne fait pas. */
export function commandeInterdite(args) {
  const a = sansOptionsGlobales(args)
  const sous = a[0]
  const porte = (...formes) => a.slice(1).some((x) => formes.includes(x) || formes.some((f) => x.startsWith(`${f}=`)))
  if (sous === 'stash') return '`git stash` : le train ne met rien de côté'
  if (sous === 'checkout' || sous === 'restore') return `\`git ${sous}\` : le train ne restaure aucun fichier`
  if (sous === 'add' && porte('-A', '--all', '.')) return '`git add` global : le commit des docs stage des chemins EXPLICITES'
  if (sous === 'push' && porte('--force', '-f', '--force-with-lease')) return '`git push` FORCÉ : jamais, sous aucune forme'
  if (sous === 'reset' && porte('--hard')) return '`git reset --hard` : le train ne détruit aucun travail'
  if (sous === 'branch' && porte('-D')) return '`git branch -D` : le train ne supprime aucune branche'
  if (sous === 'worktree' && a[1] === 'remove' && porte('--force', '-f')) return '`git worktree remove --force` : jamais'
  if (sous === 'commit' && !a.includes('--')) return '`git commit` sans `--` de chemins explicites : le commit des docs les nomme'
  return null
}

/** Motif du commit de dérivés de l'étape `derives` — ceux que le hook `post-rewrite` a laissés. */
export const MOTIF_POST_REWRITE = 'docs dérivés laissés non commités par le hook post-rewrite d’un rebase manuel'

/** Motif du commit de dérivés de l'étape `docs` — ceux que la régénération du train vient d'écrire. */
export const MOTIF_APRES_REBASE = 'docs dérivés régénérés après rebase sur origin/main (post-rewrite)'

/** Refus commun aux deux commits de dérivés : sans `#N`, la porte de commit refuserait le message. */
export const REFUS_SANS_TICKET =
  'aucun `#N` cité par la plage : le commit `chore(docs)` n’aurait aucun ticket, et la porte de commit le refuse — cite un ticket dans un commit de la plage'

/**
 * La PLAGE dont les `#N` légitiment un commit de dérivés. PURE. Le journal la porte dès que l'étape
 * `rebase` a rendu ; AVANT elle (étape `derives`), `origin/main..HEAD` la remplace — `origin/main`
 * vient d'être fetché par la préflight.
 */
export const plageDeCitations = (journal) =>
  journal?.base && journal?.tete ? `${journal.base}..${journal.tete}` : 'origin/main..HEAD'

/** Message du commit de docs dérivés. PURE — une seule forme pour les deux étapes qui commettent. */
export const messageDeDerives = (numeros, motif) => `chore(docs): ${numeros.map((n) => `refs #${n}`).join(' ')} — ${motif}\n`

/** Première ligne d'un message de commit, bornée. PURE. */
export const titreDeCommit = (message, max = 120) => {
  const ligne = String(message ?? '').split('\n')[0].trim()
  return ligne.length > max ? `${ligne.slice(0, max - 1)}…` : ligne
}

/**
 * Corps du commentaire de pilotage d'UN ticket. PURE — la marque est TOUJOURS la dernière ligne.
 * @param {{numero:string, base:string, tete:string, commits:{sha:string,message:string}[],
 *   gates:{nom:string, secondes?:number}[], gatesJouees:boolean, ci:{etat:string, course?:object},
 *   ferme:boolean, fermeParCi?:boolean, fermeAutrement?:boolean}} p
 */
export function corpsDePilotage({ numero, base, tete, commits, gates, gatesJouees, ci, ferme, fermeParCi = false, fermeAutrement = false }) {
  const court = (sha) => String(sha ?? '').slice(0, 9)
  const lignes = [
    `## Publication ${court(tete)}`,
    '',
    `Plage publiée : \`${court(base)} → ${court(tete)}\` sur \`main\`.`,
    '',
    `### Commits (${commits.length})`,
    ...commits.map((c) => `- \`${court(c.sha)}\` ${titreDeCommit(c.message)}`),
    '',
    '### Gates',
  ]
  if (!gatesJouees) {
    lignes.push('- gates déjà justifiées pour ce contenu (non rejouées).')
  } else {
    lignes.push(
      `- jouées par \`npm run gates -- --serie\`, bridées à \`WFRP_TEST_COEURS=4\` : les durées ci-dessous ne sont PAS comparables à la référence série.`,
      ...gates.map((g) => `- ${g.nom}${typeof g.secondes === 'number' ? ` — ${g.secondes.toFixed(1)} s` : ' — durée non mesurée'}`),
    )
  }
  lignes.push('', '### CI')
  const course = ci?.course
  lignes.push(
    course
      ? `- ${ci.etat} — course \`${course.databaseId}\` : https://github.com/${DEPOT}/actions/runs/${course.databaseId}`
      : `- ${ci?.etat ?? 'non lue'} — aucune course rattachée à cette tête.`,
  )
  lignes.push('')
  if (fermeAutrement) lignes.push(`#${numero} était déjà FERMÉ par un autre geste que cette publication.`)
  else if (fermeParCi) lignes.push(`#${numero} a été FERMÉ par la CI (job \`fermetures\`) sur cette publication.`)
  else if (ferme) lignes.push(`Ce commit FERME #${numero} : fermeture par le job \`fermetures\` de la CI.`)
  else lignes.push(`#${numero} est rattaché (\`refs\`) par cette publication, non fermé.`)
  lignes.push('', marquePublication(tete))
  return `${lignes.join('\n')}\n`
}

// ── Impur : le train réel ──────────────────────────────────────────────────────────────

/** Chemins du journal et du log d'une branche. */
export const cheminsDeJournal = (racine, branche) => {
  const dossier = join(racine, 'node_modules', '.cache', 'publication')
  const nom = nomDeJournal(branche)
  return { dossier, json: join(dossier, `${nom}.json`), log: join(dossier, `${nom}.log`) }
}

/** Écriture ATOMIQUE du journal (temporaire + renommage). */
export function sauverJournal(chemin, journal) {
  mkdirSync(join(chemin, '..'), { recursive: true })
  const tmp = `${chemin}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(journal, null, 2)}\n`)
  renameSync(tmp, chemin)
}

/** Journal lu sur disque, ou neuf. */
export function lireJournal(chemin, branche) {
  try {
    const lu = JSON.parse(readFileSync(chemin, 'utf8'))
    return { ...journalVide(branche), ...lu, etapes: lu.etapes ?? {} }
  } catch {
    return journalVide(branche)
  }
}

/** Sortie d'un `git` de LECTURE, trimée, ou `null`. */
const lu = (args, cwd) => {
  const vu = sortieOuNull(lireGit(args, { cwd, site: `git ${args[0]}` }))
  return vu === null ? null : vu.trim()
}

/** Fichier temporaire hors de l'arbre (message de commit, corps de commentaire). */
function fichierTemporaire(prefixe, contenu) {
  const chemin = join(tmpdir(), `wfrp-publier-${prefixe}-${process.pid}-${Date.now()}.txt`)
  writeFileSync(chemin, contenu)
  return chemin
}

/** Les `#N` cités par la plage de `journal` (ou `origin/main..HEAD` avant le rebase), dédupliqués. */
function numerosDeLaPlage(racine, journal) {
  return [...new Set(commitsDeLaPlage(plageDeCitations(journal), racine).flatMap((c) => numerosCites(c.message)))]
}

/**
 * COMMIT de docs DÉRIVÉS : stage des chemins EXPLICITES, message qui cite les tickets de la plage,
 * `journal.tete` avancé. UNE implémentation, deux appelants (`derives` avant le rebase, `docs`
 * après) — le geste est le même, seul le MOTIF change.
 * @param {object} ctx @param {{chemins:string[], numeros:string[], motif:string, journal:object}} p
 * @returns {{ok:boolean, raison?:string, detail?:object, dit?:string}}
 */
function commettreDerives(ctx, { chemins, numeros, motif, journal }) {
  const fichier = fichierTemporaire('msg', messageDeDerives(numeros, motif))
  try {
    const add = ctx.git(['add', '--', ...chemins])
    if (!add.disponible || add.absent || add.valeur.status !== 0) return { ok: false, raison: `\`git add\` a échoué sur ${chemins.length} chemin(s)` }
    const commit = ctx.git(['commit', '-F', fichier, '--', ...chemins])
    if (!commit.disponible || commit.absent || commit.valeur.status !== 0)
      return { ok: false, raison: `\`git commit\` des docs a échoué : ${(commit.raison ?? commit.valeur?.stderr ?? '').toString().trim().slice(0, 400)}` }
  } finally {
    rmSync(fichier, { force: true })
  }
  journal.tete = ctx.tete
  return { ok: true, detail: { chemins, numeros }, dit: `${chemins.length} doc(s) dérivé(s) commis — tête ${journal.tete.slice(0, 9)}` }
}

/** Gates requises encore SANS justificatif pour `sha`, avec leur motif. */
function gatesManquantes(racine, sha) {
  const cles = clesDeContenu(sha, { cwd: racine })
  return gatesRequises({ cwd: racine })
    .map((gate) => ({ gate, motif: motifDeRefus(lireJustificatif({ cwd: racine, gate: gate.nom, cles }), gate) }))
    .filter((v) => v.motif !== null)
}

/** Durées du dernier run de gates (`durees.json`), ou `{}`. */
function lireDurees(racine) {
  try {
    return JSON.parse(readFileSync(fichierDurees(racine), 'utf8'))
  } catch {
    return {}
  }
}

/** `gh <args>`, en union simple. Jamais `shell: true`. */
function gh(args, cwd) {
  const vu = spawnSync('gh', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 })
  if (vu.error) return { ok: false, raison: vu.error.message }
  if (vu.status !== 0) return { ok: false, raison: `gh a rendu ${vu.status} : ${String(vu.stderr ?? '').trim().slice(0, 200)}` }
  return { ok: true, stdout: String(vu.stdout ?? '') }
}

/** Attente BLOQUANTE sans busy-loop (le train est synchrone de bout en bout). */
function attendre(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Le contexte que les étapes partagent. `git` est la SEULE porte de mutation, gardée par
 * `commandeInterdite` : un geste interdit JETTE avant tout spawn. `npm` est la SEULE porte des
 * `npm run <script>` des étapes — une porte, donc une décision mesurable en test.
 */
export function contexteDe({ racine, branche, options, journaliser, fdLog }) {
  return {
    racine,
    branche,
    options,
    journaliser,
    fdLog,
    npm(script) {
      // `shell: true` : sous win32, `npm` est un `.cmd`, que `spawnSync` ne sait lancer autrement.
      const binaire = process.platform === 'win32' ? 'npm.cmd' : 'npm'
      return spawnSync(binaire, ['run', script], { cwd: racine, stdio: ['ignore', fdLog, fdLog], shell: true })
    },
    get tete() {
      return lu(['rev-parse', 'HEAD'], racine)
    },
    git(args) {
      const interdit = commandeInterdite(args)
      if (interdit) throw new Error(`GESTE INTERDIT — ${interdit}`)
      return lireGit(args, { cwd: racine, site: `git ${args[0]}`, timeout: 600_000 })
    },
  }
}

/**
 * PRÉREQUIS ABSENTS de TOUTES les gates requises par `ci.yml`, une ligne par manque, dans le TEXTE
 * de la gate (`refusDePrerequis`, scripts/gates/toutes.mjs:500) — aucune reformulation ici.
 * Pourquoi à la PRÉFLIGHT : un prérequis absent ne se voit sinon qu'au moment où la gate est jouée,
 * c'est-à-dire APRÈS la série — mesuré le 2026-09-14 (3ᵉ train réel,
 * node_modules/.cache/publication/chantier_1736-publier.log) : 881 s de gates, puis
 * `server:typecheck` rouge sur un `server/node_modules` absent, et le train perdu.
 * `resoudreOutilLocal(racine, 'vitest', …)` RESTE : la table `ECRIT_LU` ne déclare qu'UN prérequis
 * (`server/node_modules`, scripts/gates/toutes.mjs:373) — l'outillage de la RACINE n'y est pas.
 * @param {string} racine arbre mesuré
 * @returns {string[]} lignes de refus, vide quand tout est là
 */
export function prerequisDesGates(racine, { gates = gatesRequises({ cwd: racine }), ecritLu = ECRIT_LU } = {}) {
  const lignes = []
  for (const gate of gates) {
    const absents = prerequisAbsents(ecritLu[gate.nom], racine)
    if (absents.length) lignes.push(...refusDePrerequis(gate.nom, absents).trimEnd().split('\n'))
  }
  return lignes
}

/**
 * Remet les miroirs d'agents en phase AVANT le commit des dérivés, par la porte `ctx.npm`.
 * `agents:sync` se déclenche sur un `agents:check` ROUGE, jamais sur la saleté de `CLAUDE.md` : un
 * commit de la plage qui touche `.claude/skills/**` ou `.claude/credo.md` sans resynchroniser laisse
 * `agents:check` rouge au pre-commit, et le commit des docs échouerait sans nommer la cause.
 * @param {{npm: Function, journaliser: Function}} ctx
 * @returns {{ok: true} | {ok: false, raison: string}}
 */
export function synchroniserAgents(ctx) {
  const verif = ctx.npm('agents:check')
  if (verif.status === 0) return { ok: true }
  ctx.journaliser(`[publier] docs — \`agents:check\` rendu ${verif.status} : \`npm run agents:sync\`\n`)
  const sync = ctx.npm('agents:sync')
  if (sync.status !== 0)
    return { ok: false, raison: `\`npm run agents:sync\` a rendu ${sync.status} : le pre-commit jouerait \`agents:check\` et refuserait le commit` }
  return { ok: true }
}

/** La table des ÉTAPES : nom, `jouer(ctx, journal)`, `dejaFaite(ctx, journal)`. Ajouter une étape,
 *  c'est ajouter UNE entrée ici — rien d'autre. */
export const ETAPES = [
  {
    nom: 'preflight',
    // TOUJOURS rejouée : elle EST la garde.
    dejaFaite: () => false,
    jouer(ctx) {
      const { racine } = ctx
      for (const nom of ['rebase-merge', 'rebase-apply']) {
        const chemin = lu(['rev-parse', '--git-path', nom], racine)
        if (chemin && existsSync(resolve(racine, chemin)))
          return { ok: false, raison: `rebase interrompu (${nom}) : \`git rebase --abort\` ou \`--continue\` à la main, puis \`--reprendre\`` }
      }
      if (lu(['symbolic-ref', '--quiet', 'HEAD'], racine) === null)
        return { ok: false, raison: 'HEAD DÉTACHÉ : le train publie une branche, pas un sha errant' }
      const { derives, manuscrits } = partitionSales(cheminsSales(racine))
      if (manuscrits.length)
        return {
          ok: false,
          raison:
            `arbre NON COMMITÉ (${manuscrits.length}) — on ne publie que du committé :\n` +
            `${manuscrits.map((s) => `    ${s}`).join('\n')}` +
            (derives.length ? `\n  (et ${derives.length} doc(s) dérivé(s) régénéré(s) que l’étape derives aurait commis)` : ''),
        }
      const origine = lu(['remote', 'get-url', 'origin'], racine)
      if (!urlOrigineAcceptee(origine)) return { ok: false, raison: `origin étranger au dépôt : ${origine ?? 'illisible'}` }
      const vuFetch = fetchOrigin({ cwd: racine })
      if (!vuFetch.disponible) return { ok: false, raison: `origin non consultable : ${vuFetch.raison}` }
      const outil = resoudreOutilLocal(racine, 'vitest', 'vitest')
      if (outil.refus) return { ok: false, raison: outil.refus }
      const manquants = prerequisDesGates(racine)
      if (manquants.length)
        return {
          ok: false,
          raison: `prérequis de gate ABSENTS — les poser avant la série :\n${manquants.map((l) => `    ${l}`).join('\n')}`,
        }
      const reste = derives.length
        ? `${derives.length} doc(s) dérivé(s) régénéré(s) non commités (post-rewrite) : l’étape derives les commet`
        : 'arbre propre'
      return {
        ok: true,
        detail: { derivesSales: derives },
        dit: `${reste}, origin consultable, outillage local posé, prérequis de gates présents`,
      }
    },
  },
  {
    // Les docs DÉRIVÉS sales sont commis ICI, AVANT le rebase. Mesuré (2026-09-14, 2ᵉ train réel) :
    // `git rebase origin/main` REFUSE de démarrer sur un arbre sale (« cannot rebase: You have
    // unstaged changes ») — tolérer la saleté à la préflight sans la committer avant le rebase ne
    // faisait que déplacer le refus d'une étape.
    nom: 'derives',
    dejaFaite(ctx) {
      return partitionSales(cheminsSales(ctx.racine)).derives.length === 0
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const { derives, manuscrits } = partitionSales(cheminsSales(racine))
      if (manuscrits.length)
        return {
          ok: false,
          raison:
            `MANUSCRIT(S) sale(s) que la préflight venait de refuser — l’arbre a bougé depuis :\n` +
            manuscrits.map((c) => `    ${c}`).join('\n'),
        }
      if (!derives.length) return { ok: true, dit: 'aucun doc dérivé sale' }
      const numeros = numerosDeLaPlage(racine, journal)
      if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
      return commettreDerives(ctx, { chemins: derives, numeros, motif: MOTIF_POST_REWRITE, journal })
    },
  },
  {
    nom: 'rebase',
    dejaFaite(ctx, journal) {
      return Boolean(journal.base) && journal.base === lu(['rev-parse', 'origin/main'], ctx.racine) && journal.tete === ctx.tete
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const teteAvant = ctx.tete
      const vu = ctx.git(['rebase', 'origin/main'])
      if (!vu.disponible || vu.absent || vu.valeur.status !== 0) {
        const conflits = (lu(['diff', '--name-only', '--diff-filter=U'], racine) ?? '').split('\n').filter(Boolean)
        const entame = ['rebase-merge', 'rebase-apply'].some((nom) => {
          const chemin = lu(['rev-parse', '--git-path', nom], racine)
          return Boolean(chemin) && existsSync(resolve(racine, chemin))
        })
        // Un rebase qui REFUSE DE DÉMARRER (arbre sale, HEAD détaché…) n'a rien entamé : `--abort`
        // y rendrait « No rebase in progress » et masquerait la vraie raison. Mesuré (2026-09-14) :
        // tout échec était classé CONFLIT, sans un seul fichier à nommer.
        if (!conflits.length && !entame) {
          const brut = vu.disponible && !vu.absent ? `${vu.valeur.stderr ?? ''}\n${vu.valeur.stdout ?? ''}` : vu.raison
          return { ok: false, raison: `rebase sur origin/main REFUSÉ (aucun rebase entamé) : ${raisonCourte(brut)}` }
        }
        ctx.git(['rebase', '--abort'])
        return {
          ok: false,
          raison: `rebase sur origin/main en CONFLIT (abandonné)${conflits.length ? ` — fichiers :\n${conflits.map((f) => `    ${f}`).join('\n')}` : ''}`,
        }
      }
      journal.base = lu(['rev-parse', 'origin/main'], racine)
      journal.tete = ctx.tete
      journal.teteAvant = teteAvant
      const commits = lu(['rev-list', `${journal.base}..HEAD`], racine)
      if (!commits) return { ok: false, raison: `rien à publier : ${journal.base?.slice(0, 9)}..HEAD est VIDE` }
      return { ok: true, detail: { base: journal.base, tete: journal.tete, reecrit: teteAvant !== journal.tete }, dit: `base ${journal.base.slice(0, 9)} → tête ${journal.tete.slice(0, 9)}` }
    },
  },
  {
    nom: 'docs',
    // La tête ENREGISTRÉE sur l'étape, jamais `journal.tete` — celui-ci est réécrit par l'étape
    // `rebase` du lot SUIVANT, et un `docs` vert du lot précédent serait alors sauté à tort.
    dejaFaite(ctx, journal) {
      return journal.etapes.docs?.etat === 'vert' && journal.etapes.docs.tete === ctx.tete
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const touches = (lu(['diff', '--name-only', `${journal.base}..${journal.tete}`], racine) ?? '').split('\n').filter(Boolean)
      // La saleté est lue AVANT toute décision de saut : le hook `post-rewrite` d'un rebase MANUEL a
      // pu régénérer des dérivés sans les committer, alors que la plage ne touche aucune source de
      // doc. `touchesDocSources` ne court-circuite donc que la RÉGÉNÉRATION, jamais le COMMIT —
      // sauter celui-ci laisserait l'arbre sale jusqu'aux gates, qui le refusent.
      const salesAvant = cheminsSales(racine)
      const regenerer = touchesDocSources(touches)
      if (!regenerer && !salesAvant.length) return { ok: true, dit: 'aucune source de doc dans la plage, arbre propre : docs inchangés' }
      if (regenerer) {
        const check = spawnSync(process.execPath, [join(racine, 'scripts/docs/build-all.mjs'), '--check'], {
          cwd: racine, stdio: ['ignore', ctx.fdLog, ctx.fdLog],
        })
        if (check.status !== 0) {
          ctx.journaliser('[publier] docs — `--check` non vert : passe COMPLÈTE de build-all\n')
          const passe = spawnSync(process.execPath, [join(racine, 'scripts/docs/build-all.mjs'), '--quiet'], {
            cwd: racine, stdio: ['ignore', ctx.fdLog, ctx.fdLog],
          })
          if (passe.status !== 0)
            return {
              ok: false,
              raison: `build-all a rendu ${passe.status} : docs/ possiblement incohérent — \`git checkout -- docs/\` puis corriger la cause (rien n'a été staged ni commité)`,
            }
        }
      }
      const agents = synchroniserAgents(ctx)
      if (!agents.ok) return agents
      const chemins = cheminsSales(racine)
      const { manuscrits } = partitionSales(chemins)
      if (manuscrits.length)
        return { ok: false, raison: `doc MANUSCRIT modifié par la régénération :\n${manuscrits.map((c) => `    ${c}`).join('\n')}` }
      if (!chemins.length) return { ok: true, dit: 'docs dérivés déjà à jour : rien à committer' }
      const numeros = numerosDeLaPlage(racine, journal)
      if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
      return commettreDerives(ctx, { chemins, numeros, motif: MOTIF_APRES_REBASE, journal })
    },
  },
  {
    nom: 'gates',
    dejaFaite(ctx) {
      return gatesManquantes(ctx.racine, 'HEAD').length === 0
    },
    jouer(ctx) {
      const { racine } = ctx
      const timeoutMin = ctx.options?.verrouTimeoutMin ?? VERROU_TIMEOUT_MIN
      const debut = Date.now()
      let vu = { status: null }
      // SONDE DU VERROU : le code 2 ne vient que du verrou machine (`avecVerrouMachine`, aucun autre
      // `return 2` dans `scripts/gates/toutes.mjs`). Une suite tierce s'attend — elle ne se subit pas.
      for (let sonde = 1; ; sonde += 1) {
        const vivant = vu.status === 2 ? tenantVivant({ chemin: CHEMIN_VERROU }) : null
        const verdict = verdictDeSondeDuVerrou({ status: vu.status, tenantVivant: vivant, debut, maintenant: Date.now(), timeoutMin })
        if (verdict === 'rouge-orphelin') {
          const mort = lireTenant(undefined, CHEMIN_VERROU)
          return {
            ok: false,
            raison: `gates refusées (code 2) mais AUCUN tenant vivant dans ${CHEMIN_VERROU}${mort ? ` (PID ${mort.pid} mort)` : ' (verrou absent ou illisible)'} — relancer`,
          }
        }
        if (verdict === 'rouge-borne')
          return {
            ok: false,
            raison: `verrou machine TENU par un autre processus (code 2) — une autre suite tourne, attendre puis \`--reprendre\` : sondé ${timeoutMin} min${vivant ? ` (PID ${vivant.pid}, ${vivant.cwd || 'arbre inconnu'})` : ' (le tenant a disparu au dernier tour)'}`,
          }
        if (verdict === 'sonder') {
          const restant = Math.max(0, Math.round((timeoutMin * 60_000 - (Date.now() - debut)) / 60_000))
          ctx.journaliser(
            `[publier] gates — verrou tenu par PID ${vivant.pid} (${vivant.cwd || 'arbre inconnu'}) depuis ${vivant.date ?? 'date inconnue'} : sonde ${sonde}, ${restant} min avant refus\n`,
          )
          attendre(PERIODE_SONDE_MS)
        }
        vu = spawnSync(process.execPath, [join(racine, 'scripts/gates/toutes.mjs'), '--serie'], {
          cwd: racine,
          env: { ...process.env, WFRP_TEST_COEURS: process.env.WFRP_TEST_COEURS ?? '4' },
          stdio: ['ignore', ctx.fdLog, ctx.fdLog],
        })
        if (vu.status !== 2) break
      }
      if (vu.status !== 0) {
        const manquantes = gatesManquantes(racine, 'HEAD')
        return {
          ok: false,
          raison: `gates rouges (code ${vu.status})${manquantes.length ? ` — sans justificatif pour HEAD :\n${manquantes.map((m) => `    ${m.motif}`).join('\n')}` : ' — toutes les gates sont pourtant justifiées : lire le log'}`,
        }
      }
      return { ok: true, detail: { joue: true, coeurs: process.env.WFRP_TEST_COEURS ?? '4' }, dit: 'toutes les gates requises sont justifiées pour HEAD' }
    },
  },
  {
    nom: 'push',
    dejaFaite(ctx, journal) {
      if (!journal.tete) return false
      const vu = estAncetre(journal.tete, 'origin/main', { cwd: ctx.racine })
      return vu.disponible && !vu.absent && vu.valeur === true
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const vuFetch = fetchOrigin({ cwd: racine })
      if (!vuFetch.disponible) return { ok: false, raison: `origin non consultable avant le push : ${vuFetch.raison}` }
      const distant = lu(['rev-parse', 'origin/main'], racine)
      if (distant !== journal.base) {
        if ((journal.reprises ?? 0) >= 1)
          return { ok: false, raison: 'origin/main a bougé DEUX fois pendant le train — relancer `npm run ops:publier`' }
        journal.reprises = (journal.reprises ?? 0) + 1
        return { ok: true, relancer: ['rebase', 'docs', 'gates'], dit: `origin/main a bougé (${distant?.slice(0, 9)}) : le train reprend au rebase` }
      }
      ctx.journaliser('[publier] push — porte pre-push en cours (rejeu des migrations sur export ~17 s + lecture CI)\n')
      const vu = ctx.git(['push', 'origin', 'HEAD:main'])
      if (!vu.disponible || vu.absent || vu.valeur.status !== 0) {
        const brut = String(vu.raison ?? vu.valeur?.stderr ?? '').split('\n').slice(-40).join('\n')
        return { ok: false, raison: `push REFUSÉ :\n${brut}` }
      }
      return { ok: true, dit: `${journal.tete.slice(0, 9)} poussé sur main` }
    },
  },
  {
    nom: 'ci',
    dejaFaite(ctx, journal) {
      const vue = journal.etapes.ci
      return vue?.etat === 'vert' && vue.tete === ctx.tete && vue.detail?.etat === 'verte'
    },
    jouer(ctx, journal) {
      const fin = Date.now() + ctx.options.ciTimeoutMin * 60_000
      let dernier = { etat: 'absente' }
      while (Date.now() < fin) {
        const vu = coursesCiDeMain({ cwd: ctx.racine, limit: 30 })
        if (!vu.disponible) ctx.journaliser(`[publier] ci — courses non lues : ${vu.raison}\n`)
        else {
          dernier = verdictDesRuns(vu.valeur, journal.tete)
          const id = dernier.course?.databaseId
          ctx.journaliser(`[publier] ci — ${dernier.etat}${id ? ` (course ${id})` : ''}\n`)
          if (dernier.etat === 'verte') return { ok: true, detail: dernier, dit: `course ${id} verte` }
          if (dernier.etat === 'rouge' || dernier.etat === 'annulee')
            return { ok: false, detail: dernier, raison: `course CI ${dernier.etat}${id ? ` (${id})` : ''} — le push est FAIT : corriger sur main` }
        }
        attendre(PERIODE_SONDE_MS)
      }
      return { indetermine: true, detail: dernier, raison: `aucun verdict de la CI en ${ctx.options.ciTimeoutMin} min — le push est FAIT` }
    },
  },
  {
    nom: 'pilotage',
    // Le journal SUFFIT : chaque commentaire est déjà idempotent par sa marque (relue par `gh` dans
    // `jouer`), et une étape verte pour CETTE tête a posé ou constaté les N de CETTE plage.
    dejaFaite(ctx, journal) {
      const vue = journal.etapes.pilotage
      return vue?.etat === 'vert' && vue.tete === ctx.tete
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const commits = commitsDeLaPlage(`${journal.base}..${journal.tete}`, racine)
      const numeros = [...new Set(commits.flatMap((c) => numerosCites(c.message)))]
      const fermes = new Set(commits.flatMap((c) => numerosFermes(c.message)))
      const durees = lireDurees(racine)
      const gates = gatesRequises({ cwd: racine }).map((g) => ({ nom: g.nom, secondes: durees[g.nom] }))
      const ci = journal.etapes.ci?.detail ?? { etat: 'non lue' }
      const rates = []
      const poses = []
      for (const numero of numeros) {
        const vue = gh(['issue', 'view', numero, '--repo', DEPOT, '--json', 'state,comments'], racine)
        if (!vue.ok) {
          rates.push(`#${numero} : ${vue.raison}`)
          continue
        }
        let issue
        try {
          issue = JSON.parse(vue.stdout)
        } catch (e) {
          rates.push(`#${numero} : réponse gh illisible (${e.message})`)
          continue
        }
        const corpsVus = (issue.comments ?? []).map((c) => String(c.body ?? ''))
        if (corpsVus.some((c) => c.includes(marquePublication(journal.tete)))) {
          ctx.journaliser(`[publier] pilotage — #${numero} déjà piloté\n`)
          continue
        }
        const fermeParCi = corpsVus.some((c) => commits.some((k) => c.includes(marqueDe(k.sha))))
        const corps = corpsDePilotage({
          numero,
          base: journal.base,
          tete: journal.tete,
          commits,
          gates,
          gatesJouees: gatesRejouees(journal),
          ci,
          ferme: fermes.has(numero),
          fermeParCi,
          fermeAutrement: String(issue.state ?? '').toLowerCase() === 'closed' && !fermeParCi,
        })
        const fichier = fichierTemporaire(`corps-${numero}`, corps)
        try {
          const pose = gh(['issue', 'comment', numero, '--repo', DEPOT, '--body-file', fichier], racine)
          if (pose.ok) poses.push(numero)
          else rates.push(`#${numero} : ${pose.raison}`)
        } finally {
          rmSync(fichier, { force: true })
        }
      }
      if (rates.length) return { ok: false, detail: { poses, rates }, raison: `pilotage manqué sur ${rates.length} ticket(s) :\n${rates.map((r) => `    ${r}`).join('\n')}` }
      return { ok: true, detail: { poses, numeros }, dit: `${poses.length} commentaire(s) posé(s) sur ${numeros.length} ticket(s) cité(s)` }
    },
  },
  {
    nom: 'fin',
    dejaFaite(ctx, journal) {
      return journal.etapes.fin?.etat === 'vert' && journal.etapes.fin.tete === ctx.tete
    },
    jouer(ctx, journal) {
      journal.etat = 'vert'
      return { ok: true, dit: `publication complète de ${journal.tete?.slice(0, 9)}` }
    },
  },
]

/** Chemins que `git status --porcelain -z` rend SALES, dédupliqués (un renommage porte ses deux). */
export function cheminsSales(racine) {
  const champs = String(sortieOuNull(lireGit(['status', '--porcelain', '-z'], { cwd: racine })) ?? '').split('\0')
  const chemins = []
  for (let i = 0; i < champs.length; i += 1) {
    const champ = champs[i]
    if (!champ) continue
    const etat = champ.slice(0, 2)
    chemins.push(champ.slice(3))
    if (/[RC]/.test(etat) && champs[i + 1]) {
      i += 1
      chemins.push(champs[i])
    }
  }
  return [...new Set(chemins.filter(Boolean))]
}

function main() {
  const options = optionsDe(process.argv.slice(2))
  if (options.inconnus.length) {
    process.stderr.write(`[publier] option inconnue : ${options.inconnus.join(' ')}\n  usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--ci-timeout-min <n>] [--verrou-timeout-min <n>]\n`)
    process.exit(1)
  }
  const toplevel = lu(['rev-parse', '--show-toplevel'], RACINE)
  if (!toplevel || resolve(toplevel) !== resolve(RACINE)) {
    process.stderr.write(`[publier] REFUS : ${RACINE} n'est pas la racine de son dépôt (git dit ${toplevel ?? 'rien'})\n`)
    process.exit(1)
  }
  const branche = lu(['rev-parse', '--abbrev-ref', 'HEAD'], RACINE) ?? 'HEAD'
  const chemins = cheminsDeJournal(RACINE, branche)
  mkdirSync(chemins.dossier, { recursive: true })
  const surDisque = existsSync(chemins.json) ? lireJournal(chemins.json, branche) : null

  // La TÊTE VIVANTE : la seule contre laquelle une étape verte se juge (`planDeReprise`).
  const teteVivante = lu(['rev-parse', 'HEAD'], RACINE)

  if (options.etapes) {
    const journal = surDisque ?? journalVide(branche)
    const reprise = planDeReprise(journal, ETAPES.map((e) => e.nom), teteVivante)
    process.stdout.write(
      `publication ${branche} — journal ${chemins.json}\n` +
        `base=${journal.base ?? '—'} tete=${journal.tete ?? '—'} (publiée) · HEAD=${teteVivante ?? '—'} (vivante) reprises=${journal.reprises ?? 0}\n` +
        ETAPES.map((e) => `  ${e.nom.padEnd(10)} ${etatDeLEtape(journal, e.nom, teteVivante)}`).join('\n') +
        `\nreprise : ${reprise ?? 'rien à jouer (tout est vert pour cette tête)'}\n`,
    )
    return 0
  }

  if (options.detache) {
    // Le PARENT décide du mode (et tronque le cas échéant) AVANT de spawner : l'enfant héritera de
    // ce fd comme stdout/stderr et ouvrira le sien en append.
    const fdLog = ouvrirLog(chemins.log, modeDuLog({ reprendre: options.reprendre }))
    const argsEnfant = process.argv.slice(2).filter((a) => a !== '--detache')
    const enfant = spawn(process.execPath, [fileURLToPath(import.meta.url), ...argsEnfant], {
      cwd: RACINE,
      detached: true,
      stdio: ['ignore', fdLog, fdLog],
      windowsHide: true,
      env: { ...process.env, WFRP_PUBLIER_ENFANT: '1' },
    })
    enfant.unref()
    // Le détachement est écrit DANS le log, par le parent : c'est la seule trace machine qu'un train
    // a été lancé détaché, et sur quels arguments.
    writeSync(fdLog, ligneDeDetachement({ pid: enfant.pid, log: chemins.log, args: argsEnfant }))
    closeSync(fdLog)
    process.stdout.write(`pid=${enfant.pid}\nlog=${chemins.log}\n`)
    return 0
  }

  const enfant = process.env.WFRP_PUBLIER_ENFANT === '1'
  const fdLog = ouvrirLog(chemins.log, modeDuLog({ reprendre: options.reprendre, enfant }))
  const journaliser = (texte) => {
    writeSync(fdLog, texte)
    if (!enfant) process.stderr.write(texte)
  }
  const ctx = contexteDe({ racine: RACINE, branche, options, journaliser, fdLog })
  const { journal, repris, vertes } = journalInitial({ reprendre: options.reprendre, lu: surDisque, branche })
  journaliser(`[publier] ${new Date().toISOString()} — branche ${branche}${options.reprendre ? ' (--reprendre)' : ''}\n`)
  journaliser(`[publier] ${repris ? `journal repris (${vertes} étape(s) verte(s))` : 'journal neuf'}\n`)
  if (repris) {
    const reprise = planDeReprise(journal, ETAPES.map((e) => e.nom), ctx.tete)
    journaliser(`[publier] reprise : ${reprise ?? 'rien à jouer (tout est vert pour cette tête)'}\n`)
  }
  let verdict
  try {
    verdict = jouerLeTrain(ctx, ETAPES, journal, { sauver: (j) => sauverJournal(chemins.json, j), journaliser })
  } catch (e) {
    verdict = { etat: 'rouge', etape: 'moteur', raison: `ARRÊT INATTENDU : ${e?.stack ?? e}` }
  }
  journal.etat = verdict.etat
  sauverJournal(chemins.json, journal)
  const derniere =
    verdict.etat === 'vert'
      ? `PUBLICATION: vert ${journal.tete}`
      : verdict.etat === 'indeterminee'
        ? `PUBLICATION: indéterminée ci ${journal.tete}`
        : `PUBLICATION: rouge ${verdict.etape} — ${String(verdict.raison).split('\n')[0]}`
  journaliser(`${derniere}\n`)
  closeSync(fdLog)
  return verdict.etat === 'vert' ? 0 : verdict.etat === 'indeterminee' ? 3 : 1
}

const estMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (estMain) process.exit(main())
