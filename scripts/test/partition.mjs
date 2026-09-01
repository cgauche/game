// Logique PURE du lanceur de suite `scripts/test/run.mjs` : partition des fichiers de test par
// environnement, répartition des workers, routage des filtres. Aucun accès disque, aucun spawn.
import { relative, isAbsolute, join } from 'node:path'

/** Docblock d'environnement — copie VERBATIM de la regex que Vitest 2.1.9 applique lui-même dans
 *  `groupFilesByEnv` (node_modules/vitest/dist/chunks/resolveConfig.rBxzbVsl.js:6559). Vitest la
 *  cherche dans le fichier ENTIER (pas de borne de tête) et hors de tout parseur de commentaire :
 *  une occurrence dans une chaîne compte. La partition doit décider comme lui, sinon un fichier
 *  jsdom atterrit dans le processus node — d'où la copie plutôt qu'une variante « propre ». */
export const REGEX_ENV_DOCBLOCK = /@(?:vitest|jest)-environment\s+([\w-]+)\b/

/** Environnement d'un fichier de test, du docblock ou, à défaut, de `test.environment`. */
export function environnementDe(code, defaut = 'node') {
  return code.match(REGEX_ENV_DOCBLOCK)?.[1] || defaut
}

/** Deux seaux : `jsdom` (docblock jsdom) et `node` (tout le reste). Le seau ne décide QUE du
 *  processus qui portera le fichier — Vitest relit le docblock et honore l'environnement réel,
 *  donc un `happy-dom` embarqué côté node reste exécuté en happy-dom. */
export function partitionner(fichiers, lire, defaut = 'node') {
  const node = []
  const jsdom = []
  for (const f of fichiers) (environnementDe(lire(f), defaut) === 'jsdom' ? jsdom : node).push(f)
  return { node, jsdom }
}

/** Seuil du partage, en cœurs : sous 7 (`n − 1 < 6`), un seul processus Vitest. */
export const SEUIL_PARTAGE = 7

/** Workers par processus : 2/3 node · 1/3 jsdom sur `n − 1`, le cœur restant allant au parent.
 *  Le gain du partage est mesuré à 16 cœurs (10+5, 12+6) ; la CI GitHub publique (4 vCPU) reste
 *  sous le seuil, donc mono-processus. Le régime RÉEL de chaque run est mesuré et imprimé par la
 *  ligne `[diag] machine` du lanceur (cœurs, mémoire, mode, bornes). */
export function repartitionWorkers(n) {
  if (n < SEUIL_PARTAGE) return { split: false, node: n, jsdom: 0 }
  const node = Math.max(1, Math.round((2 / 3) * (n - 1)))
  return { split: true, node, jsdom: Math.max(1, n - 1 - node) }
}

/** Cœurs pris en compte pour décider du partage. La mesure système est la règle ; `WFRP_TEST_COEURS`
 *  la FORCE — seule façon de jouer le chemin PARTAGÉ (ou le chemin mono) sur une machine quelconque,
 *  et de le tenir sous test (`run-capture.test.mjs`) plutôt que à la merci du matériel du runner. */
export function coeurs(env, mesure) {
  const force = Number(env.WFRP_TEST_COEURS)
  return Number.isInteger(force) && force > 0 ? force : mesure()
}

/** Filtrage positionnel de Vitest — reproduction de `filterFiles`
 *  (node_modules/vitest/dist/chunks/cli-api.DqsSTaIi.js:10044) : chemins relatifs à la racine,
 *  comparaison insensible à la casse, filtres passés en `/` sous Windows. */
export function filtrerFichiers(fichiers, filtres, racine, plateforme = process.platform) {
  if (!filtres.length) return fichiers
  const fs = plateforme === 'win32' ? filtres.map((f) => f.replace(/\\/g, '/')) : filtres
  return fichiers.filter((t) => {
    const cible = relative(racine, t).toLocaleLowerCase()
    return fs.some((f) => {
      if (isAbsolute(f) && t.startsWith(f)) return true
      const rel = f.endsWith('/') ? join(relative(racine, f), '/') : relative(racine, f)
      return cible.includes(f.toLocaleLowerCase()) || cible.includes(rel.toLocaleLowerCase())
    })
  })
}

/** Côtés à lancer pour ces filtres : un filtre qui ne désigne que des fichiers jsdom ne rend que
 *  `jsdom`. Aucun filtre → les deux. Aucun fichier touché → `node` seul, donc un côté unique : le
 *  lanceur retombe sur le lancement mono-processus, qui rend le verdict de Vitest sur ce filtre. */
export function cotesRequis(filtres, partition, racine, plateforme = process.platform) {
  if (!filtres.length) return ['node', 'jsdom']
  const cotes = ['node', 'jsdom'].filter(
    (c) => filtrerFichiers(partition[c], filtres, racine, plateforme).length > 0,
  )
  return cotes.length ? cotes : ['node']
}

/** Drapeaux dont la sémantique est globale à UN processus : rapport unique (`--coverage`,
 *  `--outputFile`), sortie machine que le préfixage `[node] `/`[jsdom] ` rendrait illisible
 *  (`--reporter`, `--mergeReports` — cac accepte aussi la graphie `--merge-reports`), racine ou
 *  configuration qui entrent en conflit avec celles des configs générées (`--config`/`-c`,
 *  `--root`/`-r`, `--workspace`), modes hors lancement unique (`--shard`, `--ui`, `--watch`/`-w`). */
export const DRAPEAUX_MONO = [
  '--config', '-c', '--workspace', '--coverage', '--shard', '--ui', '--watch', '-w',
  '--outputFile', '--reporter', '--mergeReports', '--merge-reports', '--root', '-r',
]

/** Sépare les arguments passés après `npm test --` : positionnels vs drapeaux. Un positionnel ne
 *  devient un FILTRE de routage que s'il est un chemin existant (`estChemin`) ; tout autre token
 *  (valeur de drapeau, motif de `-t`, nombre) ne route rien. Aucun argument n'est consommé ici :
 *  l'argv de l'appelant part intact dans l'enfant (cf. `argumentsEnfant`). */
export function separerArguments(argv, estChemin = () => true) {
  const filtres = []
  let mono = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('-')) {
      const nom = a.split('=')[0]
      if (DRAPEAUX_MONO.includes(nom)) mono = true
      // Forme séparée `--reporter json` : la valeur suit et n'est pas un positionnel.
      if (!a.includes('=') && argv[i + 1] && !argv[i + 1].startsWith('-') && VALEUR_ATTENDUE.includes(nom)) i++
    } else if (estChemin(a)) filtres.push(a)
  }
  return { filtres, mono }
}

const VALEUR_ATTENDUE = [
  '--config', '-c', '--workspace', '--reporter', '--outputFile', '--testNamePattern', '-t',
  '--pool', '--environment', '--mode', '--shard', '--root', '-r', '--dir', '--project',
]

/** Ligne de commande d'un enfant : les drapeaux du partage, puis l'argv de l'appelant TEL QUEL —
 *  rien n'est reconstruit, donc aucun argument n'est perdu, dupliqué ni déplacé. */
export function argumentsEnfant(vitest, config, workers, argv) {
  return [
    vitest,
    'run',
    '--config',
    config,
    '--maxWorkers',
    String(workers),
    // `--maxWorkers` sans `--minWorkers` découvre 0 fichier (mesuré 2026-08-23).
    '--minWorkers',
    '1',
    // Un filtre qui ne touche qu'un côté laisse l'autre sans fichier : ce n'est pas un échec.
    '--passWithNoTests',
    ...argv,
  ]
}

/** Verdict d'un processus enfant : un enfant tué par signal, ou clos sans code, ne réussit pas. */
export function codeEnfant(code, signal) {
  return signal ? 1 : (code ?? 1)
}

/** Verdict du lanceur : les deux côtés doivent réussir. */
export function codeAgrege(codes) {
  return codes.every((c) => c === 0) ? 0 : 1
}

/** Une entrée d'`include` est un GLOB : un chemin porteur de métacaractère ne peut pas être
 *  recopié tel quel dans la config générée sans risquer d'être perdu des deux côtés. */
export function cheminsGlobSuspects(chemins) {
  return chemins.filter((c) => /[*?[\]{}()!]/.test(c))
}

/** Plafond de workers du lancement mono-processus : `min(4, cœurs − 1)`, plancher 1 — le lanceur
 *  occupe un cœur. La CI publique à 4 vCPU a relevé 14,9 Go / 15,6 Go (96 %) de mémoire système
 *  avec 4 workers ([diag] du run 33458711078, #1619). Le lancement partagé a ses propres bornes
 *  (`argumentsEnfant`). */
export const maxWorkersMono = (cpus) => Math.max(1, Math.min(4, cpus - 1))

/** Bornes à injecter devant l'argv de l'appelant : rien si l'appelant borne DÉJÀ lui-même — un
 *  `--minWorkers` en double fait sortir cac en 148 ms (« Expected a single value », mesuré
 *  2026-08-30). Les deux graphies acceptées par cac (`--minWorkers`, `--min-workers`) comptent. */
export function bornesWorkers(argv, cpus) {
  const nom = (a) => a.split('=')[0].toLowerCase().replace(/-/g, '')
  const borne = argv.some((a) => a.startsWith('-') && ['minworkers', 'maxworkers'].includes(nom(a)))
  return borne ? [] : ['--minWorkers=1', `--maxWorkers=${maxWorkersMono(cpus)}`]
}

/** Environnement des processus Vitest : sortie SANS séquence ANSI. `FORCE_COLOR` est SUPPRIMÉ, pas
 *  mis à `'0'` — tinyrainbow teste la PRÉSENCE de la variable (44 séquences ANSI subsistaient avec
 *  `FORCE_COLOR=0`, mesuré 2026-08-30), et Node avertit deux fois par processus quand `NO_COLOR` et
 *  `FORCE_COLOR` cohabitent. */
export function envEnfant(env) {
  const sortie = { ...env }
  for (const cle of Object.keys(sortie)) if (/^force_color$/i.test(cle)) delete sortie[cle]
  sortie.NO_COLOR = '1'
  return sortie
}

/** Ligne de bilan du reporter Vitest (`Test Files  1 passed (1)`, `Tests  7 passed (7)`). */
export function porteBilan(ligne) {
  return /^\s*(?:Test Files|Tests)\s+\S/.test(ligne)
}

/** En-tête de la capture, écrit AVANT le lancement : le fichier n'est jamais vide, même si le run
 *  est tué (timeout, coupure). */
export function enteteCapture({ commande, pid, cwd, date }) {
  return [
    `# commande : ${commande}`,
    `# date : ${date.toISOString()}`,
    `# pid : ${pid}`,
    `# cwd : ${cwd}`,
    '',
    '',
  ].join('\n')
}

/** Résumé final. Un échec SANS bilan Vitest (aucune ligne `Test Files`/`Tests`) rend la cause
 *  BRUTE plutôt qu'un résumé vide ; le chemin de la capture est la dernière ligne. */
export function resumeLancement({ statut, bilan, queue, capture }) {
  const lignes = []
  if (statut !== 0 && !bilan) {
    lignes.push(`[test] ÉCHEC (code ${statut}) sans bilan Vitest — cause brute :`)
    for (const ligne of queue) lignes.push(ligne)
  }
  lignes.push(`capture : ${capture}`)
  return lignes.join('\n') + '\n'
}

/** Motifs de DÉTRESSE du run, comptés au fil de la sortie. Chaque regex est un fragment VERBATIM du
 *  message émetteur : react/cjs/react.development.js:2620 (act chevauchants),
 *  react-dom/cjs/react-dom.development.js:27628 (act hors act) et :29371 (unmount pendant rendu),
 *  @vitest/runner/dist/index.js:72 (test expiré), tinypool/dist/index.js:118 (worker perdu — le
 *  message porte une capitale, d'où le drapeau `i`). Un message d'amont qui change fait tomber le
 *  test d'échantillons de `run.test.mjs`, jamais le compteur en silence. */
export const SENTINELLES = [
  ['act hors act', /inside a test was not wrapped in act/],
  ['act chevauchants', /overlapping act\(\) calls/],
  ['unmount pendant rendu', /synchronously unmount a root while React was already rendering/],
  ['React coincé', /Should not already be working/],
  ['test expiré', /Test timed out in \d+ms/],
  ['worker perdu', /worker exited unexpectedly|JS heap out of memory/i],
]

/** Compte, par libellé, les lignes portant chaque sentinelle. Une ligne peut en porter plusieurs. */
export function compterSentinelles(lignes) {
  const compte = Object.fromEntries(SENTINELLES.map(([libelle]) => [libelle, 0]))
  for (const ligne of lignes) {
    for (const [libelle, motif] of SENTINELLES) if (motif.test(ligne)) compte[libelle]++
  }
  return compte
}

/** Bloc `[diag]` du run : machine (ce que le lanceur a RÉELLEMENT servi), pic de mémoire relevé au
 *  fil du run, comptes de sentinelles. `partage` et `maxWorkers` sont FOURNIS et non déduits de
 *  `cpus` : un drapeau global à un seul processus (`--coverage`) impose le mono même à 16 cœurs. */
export function bilanDiagnostic(
  compte,
  { cpus, memGo, memMaxGo, rssMaxMo, secondes, partage, maxWorkers },
) {
  const pourcent = memGo > 0 ? Math.round((memMaxGo / memGo) * 100) : 0
  const comptes = SENTINELLES.map(([libelle]) => `${libelle} ${compte[libelle] ?? 0}`).join(' · ')
  return [
    `[diag] machine : ${cpus} cœurs · ${memGo.toFixed(1)} Go · ${partage ? 'partagé' : 'mono'}` +
      ` (seuil ${SEUIL_PARTAGE}) · maxWorkers=${maxWorkers}`,
    `[diag] mémoire système max : ${memMaxGo.toFixed(1)} Go / ${memGo.toFixed(1)} Go (${pourcent} %)` +
      ` · rss lanceur max ${Math.round(rssMaxMo)} Mo · fenêtre ${secondes.toFixed(1)} s`,
    `[diag] sentinelles : ${comptes}`,
    '',
  ].join('\n')
}
