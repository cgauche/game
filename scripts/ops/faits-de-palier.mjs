// FAITS D'UN PALIER — tout ce qu'un script PUR mesure d'une fenêtre `<base>..<tête>`, pour qu'un
// workflow n'ait plus rien à mesurer lui-même.
//
// Un script de workflow n'a aucun accès au système de fichiers et n'importe rien : s'il devait
// mesurer, il le ferait par des agents, c'est-à-dire à la parole d'un modèle. Les faits arrivent
// donc en `args.faits`, produits ICI, et chacun porte sa PROVENANCE — un fait `gh` peut manquer
// (réseau, jeton) sans que le reste de la mesure tombe : l'indisponibilité se DIT, elle ne se
// devine pas.
//
// Aucune mesure n'est réécrite : ce script COMPOSE les hôtes existants (`revuePalier.mjs`,
// `plageStock.mjs`, `fermetures-non-citees.mjs`, `audit-stock.mjs`, le journal de dérogations du
// pre-push) — un hôte n'est jamais dupliqué.
//
// Usage : `npm run ops:faits-de-palier -- --base <sha> --tete <sha>`, plus :
//   `--hors-ligne`            saute ce qui appelle GitHub et l'audit de dépendances ;
//   `--revue-precedente <p>`  impose le texte de la revue précédente au lieu de celui de HEAD ;
//   `--cwd <dossier>`         l'arbre MESURÉ (défaut : la racine de ce script) — git, soldes suivis et
//                             journal de dérogations sont tous lus dans CET arbre, jamais mélangés ;
//   `--sortie <chemin>`       où le JSON complet est aussi ÉCRIT (défaut sous `os.tmpdir()`) : un
//                             workflow n'embarque alors dans ses prompts que les champs dont il a
//                             besoin et donne ce chemin pour le reste ;
//   `--sans-chainage`         BANC uniquement : rejoue une fenêtre DÉJÀ jugée (le chaînage à la revue
//                             précédente n'est pas exigé). Le JSON le DIT (`chainage`), et le texte
//                             produit par `revue-palier` porte alors sa marque de banc.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ascendanceDansHead, derniereRevueArchivee, memeSha } from '../guards/lib/revuePalier.mjs'
import { croissancesDeLaPlage } from '../guards/lib/plageStock.mjs'
import { tenter } from '../guards/lib/gitPorte.mjs'
import { coursesCiDeMain } from '../guards/lib/coursesCi.mjs'
import { cheminJustificatifs } from '../guards/lib/justificatif.mjs'
import { FERMETURE_RE, soldesSuivis } from './fermetures-non-citees.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Séparateurs de champ et d'enregistrement du journal git : aucun sujet de commit ne les porte. */
export const CHAMP = String.fromCharCode(31)
export const ENREGISTREMENT = String.fromCharCode(30)

/**
 * Arguments de la ligne de commande. PUR.
 * @throws {Error} nommé si `--base` ou `--tete` manque : la fenêtre ne se devine pas.
 * @returns {{ base: string, tete: string, revuePrecedente: string|null, cwd: string,
 *   horsLigne: boolean, sortie: string|null, sansChainage: boolean }}
 */
export function analyserArguments(argv) {
  const args = [...(argv ?? [])]
  const valeur = (drapeau) => {
    const i = args.indexOf(drapeau)
    return i === -1 ? null : (args[i + 1] ?? null)
  }
  const base = valeur('--base')
  const tete = valeur('--tete')
  const manques = [base ? null : '--base <sha>', tete ? null : '--tete <sha>'].filter(Boolean)
  if (manques.length) {
    throw new Error(`faits-de-palier : argument(s) manquant(s) — ${manques.join(', ')}`)
  }
  return {
    base,
    tete,
    revuePrecedente: valeur('--revue-precedente'),
    cwd: valeur('--cwd') ?? RACINE,
    horsLigne: args.includes('--hors-ligne'),
    sortie: valeur('--sortie'),
    sansChainage: args.includes('--sans-chainage'),
  }
}

/** Où le JSON complet s'écrit quand `--sortie` n'est pas donné. PUR. Hors de l'arbre mesuré : un
 *  fait n'a rien à faire dans le dossier qu'il juge. */
export const sortieParDefaut = (base, tete) =>
  join(tmpdir(), 'wfrp-faits-de-palier', `faits-${String(base).slice(0, 9)}-${String(tete).slice(0, 9)}.json`)

/**
 * Commits d'un journal `--format=%H<CHAMP>%s<CHAMP>%B<ENREGISTREMENT>`. PUR.
 * @returns {{ sha: string, sujet: string, corps: string }[]}
 */
export function parserJournal(brut) {
  return String(brut ?? '')
    .split(ENREGISTREMENT)
    .map((bloc) => bloc.replace(/^\r?\n/, ''))
    .filter((bloc) => bloc.trim())
    .map((bloc) => {
      const [sha = '', sujet = '', corps = ''] = bloc.split(CHAMP)
      return { sha: sha.trim(), sujet: sujet.trim(), corps }
    })
    .filter((c) => c.sha)
}

/** Marque les commits qui touchent `src`/`scripts` — la SUBSTANCE, au sens du palier. PUR. */
export function marquerSubstance(commits, shasDeSubstance) {
  const substantiels = new Set([...(shasDeSubstance ?? [])].map((s) => String(s).trim()).filter(Boolean))
  return (commits ?? []).map((c) => ({ ...c, substance: substantiels.has(c.sha) }))
}

/**
 * Fermetures citées par les messages de la fenêtre, croisées avec les soldes SUIVIS par git. PUR.
 * Le motif est celui du closer (`FERMETURE_RE`) — jamais une seconde graphie.
 * @returns {{ numero: string, sha: string, sujet: string, solde: boolean }[]}
 */
export function fermeturesDesCommits(commits, soldes) {
  const suivis = new Set([...(soldes ?? [])].map(String))
  const out = []
  for (const c of commits ?? []) {
    const message = `${c.sujet}\n${c.corps ?? ''}`
    for (const m of message.matchAll(new RegExp(FERMETURE_RE.source, 'gi'))) {
      const numero = m[2]
      if (out.some((f) => f.numero === numero && f.sha === c.sha)) continue
      out.push({ numero, sha: c.sha, sujet: c.sujet, solde: suivis.has(numero) })
    }
  }
  return out
}

/**
 * Dérogations journalisées par le pre-push. PUR. Le journal porte UNE ligne JSON par tentative
 * (`{ horodatage, etat, motif, sha, raison }`) : une ligne qui n'est pas un objet JSON n'est pas
 * devinée, elle est rendue `{ etat: 'illisible', ligne }` et comptée à part.
 * `shas` MARQUE (`dansLaFenetre`) sans filtrer — le tri revient à `derogationsDeLaFenetre`.
 * @returns {{ horodatage: string, etat: string, motif: string, sha: string, raison: string,
 *   dansLaFenetre: boolean }[] }
 */
export function derogationsDuJournal(texte, shas = null) {
  const fenetre = shas ? new Set([...shas].map(String)) : null
  return String(texte ?? '')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter(Boolean)
    .map((ligne) => {
      let lu
      try {
        lu = JSON.parse(ligne)
      } catch {
        return { etat: 'illisible', ligne, dansLaFenetre: false }
      }
      if (!lu || typeof lu !== 'object' || Array.isArray(lu)) return { etat: 'illisible', ligne, dansLaFenetre: false }
      const sha = String(lu.sha ?? '')
      return {
        horodatage: String(lu.horodatage ?? ''),
        etat: String(lu.etat ?? ''),
        motif: String(lu.motif ?? ''),
        sha,
        raison: String(lu.raison ?? ''),
        dansLaFenetre: fenetre ? fenetre.has(sha) : true,
      }
    })
}

/**
 * Ce que la fenêtre porte VRAIMENT en dérogations. PUR. Une revue juge SA fenêtre : servir le journal
 * entier fait juger des pushes d'un autre palier (6 lignes hors fenêtre servies sur 6, mesuré
 * 2026-09-04). Le NOMBRE des autres reste rendu : leur existence est un fait, leur contenu non. Les
 * lignes ILLISIBLES sont comptées à part : les noyer dans « hors fenêtre » ferait passer un journal
 * corrompu pour un journal d'un autre palier.
 * @returns {{ dansLaFenetre: object[], horsFenetre: number, illisibles: number }}
 */
export function derogationsDeLaFenetre(texte, shas) {
  const toutes = derogationsDuJournal(texte, shas)
  const illisibles = toutes.filter((d) => d.etat === 'illisible')
  const lisibles = toutes.filter((d) => d.etat !== 'illisible')
  const retenues = lisibles.filter((d) => d.dansLaFenetre)
  return {
    dansLaFenetre: retenues,
    horsFenetre: lisibles.length - retenues.length,
    illisibles: illisibles.length,
  }
}

/**
 * Courses CI par commit, depuis la liste servie par `coursesCiDeMain`. PUR.
 * Un sha sans course est rendu avec `conclusion: null` : « pas de course » est un fait.
 * @returns {{ sha: string, courses: { workflow: string, conclusion: string|null, statut: string|null }[] }[]}
 */
export function coursesParCommit(servies, shas) {
  const courses = Array.isArray(servies) ? servies : []
  return [...(shas ?? [])].map((sha) => ({
    sha,
    courses: courses
      .filter((c) => String(c.headSha ?? '') === sha)
      .map((c) => ({
        workflow: c.workflowName ?? null,
        conclusion: c.conclusion || null,
        statut: c.status || null,
      })),
  }))
}

// ── Lecture réelle ────────────────────────────────────────────────────────────────────────────

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 })

function main() {
  let options
  try {
    options = analyserArguments(process.argv.slice(2))
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    process.exit(1)
  }
  const { base, tete, revuePrecedente, cwd, horsLigne, sortie, sansChainage } = options

  const derniere = derniereRevueArchivee(cwd)
  if (derniere.etat !== 'trouvee') {
    process.stderr.write(`faits-de-palier : aucune revue archivée ne juge l'histoire de HEAD (${derniere.etat}) — la base d'une fenêtre est la TÊTE de la dernière revue.\n`)
    process.exit(1)
  }
  const chaine = memeSha(base, derniere.tete)
  if (!chaine && !sansChainage) {
    process.stderr.write(`faits-de-palier : \`--base ${base}\` n'est pas la tête de fenêtre de la dernière revue archivée (${derniere.chemin} → ${derniere.tete}) — une fenêtre s'enchaîne à la précédente.\n`)
    process.exit(1)
  }
  // Le BANC rejoue une fenêtre déjà jugée pour comparer deux méthodes : seul le chaînage cède, et le
  // JSON le dit à qui le lit — un texte produit sur ces faits porte sa marque de banc et ne s'archive pas.
  const chainage = chaine
    ? 'vérifié'
    : `ignoré (--sans-chainage, banc) — base attendue par l'histoire : ${derniere.tete}, base jouée : ${base}`
  const ascendance = ascendanceDansHead(tete, cwd)
  if (!ascendance.disponible) {
    process.stderr.write(`faits-de-palier : ascendance indisponible — ${ascendance.raison} : \`--tete ${tete}\` n'a pas pu être située dans l'histoire de HEAD.\n`)
    process.exit(1)
  }
  if (ascendance.absent || ascendance.valeur !== true) {
    process.stderr.write(`faits-de-palier : \`--tete ${tete}\` n'est pas dans l'histoire de HEAD — la fenêtre jugerait une histoire que ce dépôt ne porte pas.\n`)
    process.exit(1)
  }

  const commits = marquerSubstance(
    parserJournal(git(['log', `--format=%H${CHAMP}%s${CHAMP}%B${ENREGISTREMENT}`, `${base}..${tete}`], cwd)),
    git(['rev-list', `${base}..${tete}`, '--', 'src', 'scripts'], cwd).split('\n').map((l) => l.trim()).filter(Boolean),
  )
  const shas = commits.map((c) => c.sha)
  const fermetures = fermeturesDesCommits(commits, soldesSuivis(cwd))
  const stocks = tenter(() => croissancesDeLaPlage({ cwd, avant: base, apres: tete }))

  const depuis = git(['log', '-1', '--format=%cs', base], cwd).trim()
  const fermeturesHorsCommit = horsLigne
    ? { disponible: false, raison: '`--hors-ligne` : GitHub non consulté' }
    : tenter(() => execFileSync(process.execPath, [join(RACINE, 'scripts', 'ops', 'fermetures-non-citees.mjs'), '--depuis', depuis], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000,
    }))
  const auditStock = horsLigne
    ? { disponible: false, raison: '`--hors-ligne` : audit de dépendances non joué' }
    : tenter(() => execFileSync(process.execPath, [join(RACINE, 'scripts', 'ops', 'audit-stock.mjs')], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000,
    }))
  // `limit: 300` : la lecture des courses n'a pas de fenêtre de dates, la limite EST la fenêtre. Une
  // plage dont le plus ancien commit sort des 300 dernières courses de `main` rend `courses: []` —
  // indiscernable d'un commit jamais couru, et c'est ce que le lecteur doit savoir.
  // `workflow: null` : TOUS les workflows, pas seulement `ci.yml`.
  const coursesCi = (() => {
    if (horsLigne) return { disponible: false, raison: '`--hors-ligne` : courses CI non consultées' }
    const vu = coursesCiDeMain({ cwd, limit: 300, workflow: null })
    return vu.disponible ? { disponible: true, valeur: coursesParCommit(vu.valeur, shas) } : vu
  })()

  const derogations = tenter(() => {
    const journal = join(cheminJustificatifs({ cwd }), 'derogations.log')
    return existsSync(journal)
      ? derogationsDeLaFenetre(readFileSync(journal, 'utf8'), shas)
      : { dansLaFenetre: [], horsFenetre: 0, illisibles: 0 }
  })

  const texteDeRevue = tenter(() => (revuePrecedente
    ? readFileSync(revuePrecedente, 'utf8')
    : git(['show', `HEAD:${derniere.chemin}`], cwd)))

  const faitsChemin = sortie ?? sortieParDefaut(base, tete)
  const faits = {
    base,
    tete,
    depuis,
    chainage,
    faitsChemin,
    commits,
    fermetures,
    stocks,
    fermeturesHorsCommit,
    auditStock,
    derogations,
    coursesCi,
    revuePrecedente: { chemin: revuePrecedente ?? derniere.chemin, ...texteDeRevue },
    provenance: {
      commits: 'script',
      fermetures: 'script',
      stocks: 'script',
      chainage: 'script',
      fermeturesHorsCommit: 'gh',
      auditStock: 'npm audit',
      derogations: 'journal local du pre-push',
      coursesCi: 'gh',
      revuePrecedente: 'git',
    },
  }
  const rendu = `${JSON.stringify(faits, null, 1)}\n`
  // Le JSON s'écrit AUSSI dans un fichier : un consommateur qui n'a besoin que de trois champs les
  // prend et donne ce chemin pour le reste, au lieu de recopier 72 Ko dans chaque prompt.
  mkdirSync(dirname(faitsChemin), { recursive: true })
  writeFileSync(faitsChemin, rendu)
  process.stderr.write(`[faits] ${faitsChemin}\n`)
  process.stdout.write(rendu)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
