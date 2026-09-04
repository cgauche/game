// PORTE des fermetures HORS COMMIT — le filet que `scripts/hooks/fermetures-sans-solde.test.mjs` ne
// peut pas tendre : celui-ci ne lit que les MESSAGES DE COMMIT, donc une issue fermée depuis l'UI web
// ou par un `gh issue close` hors du chemin instrumenté lui est INVISIBLE (cas #1659 et #1673, fermés
// à la main le 2026-09-02, `commit_id` nul sur l'événement `closed`).
//
// Ici la mesure part de l'API : issues FERMÉES dans la fenêtre, croisées avec les commits fermants
// (`corrige|fixes|closes|ferme #N`) et avec les soldes SUIVIS par git. Le verdict porte sur l'ÉCART à
// la baseline nominative datée `fermetures-non-citees.json` :
//   - fermeture NEUVE hors baseline, non citée, sans solde suivi, sans label `duplicate` -> ROUGE ;
//   - entrée de baseline qui a depuis un solde suivi ou un commit fermant -> ROUGE « entrée périmée » ;
//   - `state_reason: not_planned` N'EXEMPTE PAS (une fermeture « pas prévu » sans solde est exactement
//     la fuite) ; seul `duplicate` exempte, le survivant du doublon portant le solde.
//
// Usage : `npm run ops:fermetures-non-citees` (fenêtre 7 j) ou
// `node scripts/ops/fermetures-non-citees.mjs --depuis 2026-08-20`. Le nom dit le RAPPORT : `ops:fermer`
// est le geste qui FERME (scripts/ops/fermer-depuis-main.mjs), celui-ci ne fait que mesurer.
// Le comparateur est PUR (`comparerFermetures`) ; la lecture de GitHub et de git vit dans `main`.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ecartsDeStock } from '../guards/lib/stock.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CHEMIN_BASELINE = join(RACINE, 'scripts', 'ops', 'fermetures-non-citees.json')
export const DEPOT = 'cgauche/game'

/** Le MÊME motif que le closer et que `fermetures-sans-solde.test.mjs` — jamais une seconde graphie. */
export const FERMETURE_RE = /(fixes|closes|corrige|ferme)\s+#(\d+)/gi

/** Label qui EXEMPTE : le doublon n'a pas de solde propre, c'est le survivant qui le porte. */
export const LABEL_EXEMPTANT = 'duplicate'

/** SECONDE exemption, et la seule autre : l'issue du canari, fermée par le canari LUI-MÊME quand
 *  toutes ses mesures sont vertes (`.github/workflows/canari.yml`, step « Résumé »). Ce n'est pas une
 *  fuite : le rapport EST la preuve, et il vit dans le fil de l'issue.
 *  L'issue se reconnaît à son TITRE, comme dans le workflow — `SURVIVANTE` la cherche par
 *  `Canari rouge in:title`, et un seul terme désigne donc un seul objet. Le label `canari` est une
 *  décoration posée à la création : #1493 et #1614, les deux issues canari OUVERTES, ont
 *  `labels: []` (mesuré 2026-09-04, le label venait d'être créé), et une exemption qui en dépendrait
 *  serait INERTE le jour où le premier run vert ferme la survivante.
 *  Les DEUX conditions comptent : une issue « Canari rouge » fermée par un humain reste une
 *  fermeture hors commit à solder, et le bot ne blanchit pas les fermetures qu'il fait par ailleurs.
 *  NON PROUVÉ sur ce dépôt : 25 fermetures échantillonnées, 0 par le bot — le premier run réel
 *  tranchera la graphie exacte du `closed_by.login`. */
export const FERMEUR_CANARI = 'github-actions[bot]'
export const TITRE_CANARI = 'Canari rouge'
const fermeeParLeCanari = (f) =>
  f.closedBy === FERMEUR_CANARI && String(f.titre ?? '').startsWith(TITRE_CANARI)

/**
 * Verdict de l'écart entre la baseline et ce que la fenêtre observe. PUR.
 * @param {{ entrees: {numero:number}[] }} baseline
 * @param {{ numero:number, titre:string, closedAt:string, closedBy:string, stateReason:string, labels:string[] }[]} fermees
 *   issues fermées dans la fenêtre
 * @param {Set<string>|string[]} cites numéros cités par un commit fermant de la fenêtre
 * @param {Set<string>|string[]} soldes numéros dont `.claude/soldes/<N>.md` est SUIVI par git
 * @returns {{ rouges: string[], rapport: string[], nonCitees: object[], taille: number }}
 */
export function comparerFermetures(baseline, fermees, cites, soldes) {
  const cite = new Set([...cites].map(String))
  const solde = new Set([...soldes].map(String))
  const connues = new Set((baseline?.entrees ?? []).map((e) => String(e.numero)))

  const nonCitees = fermees.filter((f) => !cite.has(String(f.numero)))
  const jugeables = nonCitees.filter(
    (f) => !(f.labels ?? []).includes(LABEL_EXEMPTANT)
      && !fermeeParLeCanari(f)
      && !solde.has(String(f.numero)),
  )

  const ecart = ecartsDeStock({
    observe: jugeables,
    stock: baseline?.entrees ?? [],
    cle: (e) => String(e.numero),
    remede: {
      neuve: (cle, f) =>
        `FERMETURE NEUVE hors baseline, citée par AUCUN commit et sans .claude/soldes/${cle}.md suivi : ` +
        `#${cle} (fermée le ${f.closedAt} par ${f.closedBy}, state_reason ${f.stateReason}) ` +
        `${f.titre} — une fermeture porte son solde : la rouvrir, la solder, ou l'inscrire a la baseline avec sa date.`,
      perimee: (cle) =>
        `entrée périmée : retire-la — #${cle} a désormais son solde suivi ou son commit fermant ` +
        '(scripts/ops/fermetures-non-citees.json)',
    },
  })

  // Une entrée de baseline dont la fenêtre ne parle plus (fermée avant `--depuis`) n'est pas périmée :
  // seule la PREUVE d'un solde ou d'une citation la retire. `ecartsDeStock` ne voit que la fenêtre —
  // on ne garde donc de ses `perimees` que celles dont la preuve existe.
  const perimees = ecart.perimees.filter((ligne) => {
    const n = /#(\d+)/.exec(ligne)?.[1]
    return Boolean(n) && (solde.has(n) || cite.has(n))
  })

  const rapport = nonCitees.map((f) => {
    const n = String(f.numero)
    const etat = (f.labels ?? []).includes(LABEL_EXEMPTANT) ? 'doublon (exempté)'
      : fermeeParLeCanari(f) ? 'canari (exempté)'
        : solde.has(n) ? 'solde suivi'
          : connues.has(n) ? 'baseline' : 'NEUVE'
    const labels = (f.labels ?? []).join(',') || '(sans label)'
    return `#${n} [${etat}] ${f.closedAt} par ${f.closedBy} · ${f.stateReason} · ${labels} · ${f.titre}`
  })

  return { rouges: [...ecart.neuves, ...perimees].sort(), rapport, nonCitees, taille: connues.size }
}

/** Rapport MARKDOWN destiné au commentaire de l'issue canari. */
export function rapportMarkdown({ depuis, rapport, rouges }) {
  const lignes = rapport.length
    ? rapport.map((l) => `- ${l}`).join('\n')
    : '- aucune fermeture non citée dans la fenêtre'
  const verdict = rouges.length
    ? `**${rouges.length} écart(s) à la baseline :**\n${rouges.map((r) => `- ${r}`).join('\n')}`
    : '**Aucun écart à la baseline.**'
  return [`### Fermetures hors commit depuis le ${depuis}`, '', lignes, '', verdict].join('\n')
}

/** `gh` sur un runner GitHub Actions hérite d'un stdin jamais fermé : sans `stdio[0] = 'ignore'`
 *  (l'équivalent programmatique du `< /dev/null` de la ligne de commande, mesuré au grounding L2),
 *  `gh api --paginate` peut rester pendu à attendre une entrée qui ne vient pas.
 *  JAMAIS `shell: true` : `gh` est un exécutable, et sous `cmd.exe` le `&` de la requête de recherche
 *  (`…closed:>=…&per_page=100`) coupe la commande en deux — mesuré 2026-09-04, HTTP 422 puis
 *  « 'per_page' n'est pas reconnu en tant que commande interne ». */
const gh = (args) =>
  execFileSync('gh', args, {
    cwd: RACINE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const git = (args) => execFileSync('git', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 1e8 })

/** Issues FERMÉES depuis `depuis`. L'endpoint s'écrit SANS barre oblique de tête : sous Git Bash,
 *  MSYS réécrit un argument commençant par `/` en chemin Windows et `gh` refuse alors l'endpoint
 *  (mesuré 2026-09-04 : « invalid API endpoint: "C:/Program Files/Git/repos/…" »). */
export function fermeesDepuis(depuis) {
  const brut = gh([
    'api', '--paginate',
    `search/issues?q=repo:${DEPOT}+is:issue+closed:>=${depuis}&per_page=100`,
    '--jq', '.items[] | {numero: .number, titre: .title, closedAt: .closed_at, stateReason: (.state_reason // "null"), labels: [.labels[].name]}',
  ])
  const issues = brut.split('\n').filter(Boolean).map((l) => JSON.parse(l))
  // `search/issues` ne porte PAS `closed_by` : il se lit une issue à la fois — c'est le nom qu'il faut
  // pour dire QUI a fermé hors commit, et la fenêtre est de l'ordre de la dizaine d'issues.
  return issues.map((i) => ({
    ...i,
    // `--jq` de `gh` rend une chaîne BRUTE (jamais du JSON entre guillemets) : elle se trime, elle ne se parse pas.
    closedBy: gh(['api', `repos/${DEPOT}/issues/${i.numero}`, '--jq', '.closed_by.login // "null"']).trim(),
  }))
}

/** Le commit qui ferme un ticket PRÉCÈDE la fermeture vue par l'API, et un rebase peut l'en éloigner
 *  encore : la fenêtre des CITATIONS déborde donc celle des fermetures. MESURÉ 2026-09-04 sans cette
 *  marge : #1385, fermé le 2026-08-20T01:35Z par un commit du 2026-08-19, ressortait « fermeture
 *  NEUVE non citée » — un faux rouge de BORD, à deux heures près. */
export const MARGE_CITATION_JOURS = 7

export const reculeDe = (date, jours) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - jours * 24 * 3600 * 1000).toISOString().slice(0, 10)

/** Numéros cités par un commit fermant depuis `depuis`, marge de bord comprise. */
export function citesDepuis(depuis) {
  const journal = git(['log', `--since=${reculeDe(depuis, MARGE_CITATION_JOURS)}`, '--pretty=format:%B%x00'])
  return new Set([...journal.matchAll(FERMETURE_RE)].map((m) => m[2]))
}

/** Numéros dont le solde est SUIVI par git (jamais un fichier seulement présent sur le disque). */
export function soldesSuivis() {
  return new Set(
    git(['ls-files', '.claude/soldes']).split('\n').filter(Boolean)
      .map((p) => p.split('/').pop().replace(/\.md$/, '')),
  )
}

function main() {
  const args = process.argv.slice(2)
  const iDepuis = args.indexOf('--depuis')
  const defaut = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const depuis = iDepuis !== -1 ? args[iDepuis + 1] : defaut

  const baseline = JSON.parse(readFileSync(CHEMIN_BASELINE, 'utf8'))
  const { rouges, rapport, taille } = comparerFermetures(
    baseline, fermeesDepuis(depuis), citesDepuis(depuis), soldesSuivis(),
  )
  process.stdout.write(`[fermetures] fenêtre depuis ${depuis} · baseline ${taille} entrée(s)\n`)
  process.stdout.write(`${rapportMarkdown({ depuis, rapport, rouges })}\n`)
  if (rouges.length) {
    for (const r of rouges) process.stderr.write(`  ROUGE ${r}\n`)
    process.exit(1)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
