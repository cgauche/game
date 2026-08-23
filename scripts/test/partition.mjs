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

/** Workers par processus : 2/3 node · 1/3 jsdom sur `n − 1`, le cœur restant allant au parent.
 *  Le gain du partage est mesuré à 16 cœurs (10+5, 12+6) ; 4 vCPU (CI GitHub publique) non mesuré
 *  → un seul processus. Seuil du partage : `n − 1 ≥ 6`, soit 7 cœurs. */
export function repartitionWorkers(n) {
  if (n - 1 < 6) return { split: false, node: n, jsdom: 0 }
  const node = Math.max(1, Math.round((2 / 3) * (n - 1)))
  return { split: true, node, jsdom: Math.max(1, n - 1 - node) }
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
