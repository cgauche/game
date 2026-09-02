// scripts/docs/build-all.mjs — régénère TOUS les docs dérivés (`npm run docs:build`).
// SOURCE UNIQUE de la liste des générateurs : `GENERATORS`. `npm run docs:check` chaîne les MÊMES
// scripts en `--check` (plus des vérificateurs purs, qui n'écrivent rien) ; la garde
// scripts/git-hooks/merge-docs.test.mjs refuse toute dérive entre les deux listes.
// Une cible n'est pas toujours un `docs/*.md` ÉCRIT EN ENTIER : `build-implemente.mjs` injecte un
// champ dans les fiches raw, `build-doctrines.mjs` injecte le bloc « Doctrines utilisateur » entre
// marqueurs dans CLAUDE.md — ces deux-là déclarent `targets: []` et se jouent comme les autres.
// Ordre motivé : les rapports d'Atlas LISENT les fiches docs/raw (coverage.mjs:309, reconcile.mjs:54,
// reanchor.mjs:207), ils passent donc APRÈS build-catalogs/build-implemente qui les écrivent. C'est
// cet ordre qui autorise une source elle-même GÉNÉRÉE : une source écrite par un générateur PLUS TARD
// dans la liste serait lue périmée, et se fait refuser par nom.
//
// EMPREINTE DE SOURCES (#1679 L1b) — chaîne complète, aucun maillon écrit à la main :
//   1. chaque générateur est lancé avec `scripts/docs/lib/enregistreur-lectures.mjs` en préchargeur
//      (`NODE_OPTIONS`, donc les sous-processus node en héritent) : ce qu'il lit se MESURE ;
//   2. le set fusionné (un fichier par PID) part dans le dérivé `docs/.sources-lues.json` ;
//   3. chaque doc reçoit en pied l'empreinte de ses sources TELLES QUE LE DISQUE les portait ;
//   4. `--empreinte` recalcule la même empreinte depuis l'INDEX git et compare au pied : un doc
//      STAGÉ, régénéré depuis un arbre où une source lue n'est pas stagée, diverge (joué au commit).
// Le rendu est DÉTERMINISTE (tout est trié) : deux `docs:build` de suite rendent des octets
// identiques, `.sources-lues.json` compris. Son CHURN suit ce qu'un générateur LIT, jamais ce qu'il
// écrit — un commit ne le bouge que s'il ajoute/retire une source ou un dossier lu (fichier neuf
// sous `src/`, import de plus, fiche `docs/raw` de plus), pas parce qu'une source a changé de
// contenu (c'est le PIED du doc qui bouge, lui, à chaque régénération).
// Cinq générateurs étaient AVEUGLES à toute mesure naïve, mesuré 2026-09-02 : les trois `runner: 'tsx'`
// (`tsx/dist/cli.mjs` RE-SPAWNE un processus — ils sont lancés ici par `node --import tsx/esm`) et les
// deux qui appelaient `npx tsx <dumper>` (`build-donnees.mjs`, `build-codex-relations.mjs`, passés à
// `resoudreOutilLocal` + `envIsole`, qui transmettent l'env).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path, { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { binLocal, envIsole, resoudreOutilLocal } from '../lancer-local.mjs'
import {
  avecPied, empreinteDeLIndex, empreinteDuDisque, existeFichier, fusionnerLectures,
  hashBlobDisque, ignoresGit, indexGit, lirePied, serialiserSourcesLues,
} from './lib/empreinte-sources.mjs'

/** `{ runner, script, targets, injecte, check }` — `runner` = 'node' | 'tsx' ; `targets` = docs ÉCRITS
 *  EN ENTIER (glob toléré, cf. la garde de taxonomie de scripts/git-hooks/merge-docs.test.mjs), et
 *  seuls eux reçoivent le pied « sources-empreinte » ; `injecte` = fichiers dont le générateur ne
 *  réécrit QU'UN BLOC (il les relit, ils ne sont donc pas ses sources) ;
 *  `check: false` = pas de mode `--check` (le script écrit toujours), donc sauté par `--check`.
 *  Ordre = ordre d'exécution. */
export const GENERATORS = [
  { runner: 'node', script: 'scripts/raw/build-catalogs.mjs', targets: ['docs/raw/catalogue-*.md'], check: false },
  { runner: 'node', script: 'scripts/raw/build-implemente.mjs', targets: [], injecte: ['docs/raw/*.md'] },
  { runner: 'node', script: 'scripts/docs/build-systemes.mjs', targets: ['docs/systemes.md'] },
  { runner: 'node', script: 'scripts/docs/build-donnees.mjs', targets: ['docs/donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-sources-vf.mjs', targets: ['docs/sources-vf.md'] },
  { runner: 'node', script: 'scripts/docs/build-effects.mjs', targets: ['docs/campagne-effects.md'] },
  { runner: 'node', script: 'scripts/docs/build-vocabulaire.mjs', targets: ['docs/vocabulaire-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-index-moteur.mjs', targets: ['docs/index-moteur.md'] },
  { runner: 'node', script: 'scripts/docs/build-registre-jets.mjs', targets: ['docs/registre-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-usages-jets.mjs', targets: ['docs/usages-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-entity-orphans.mjs', targets: ['docs/orphelines-donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-test-scenarios.mjs', targets: ['docs/test-scenarios.md'] },
  { runner: 'node', script: 'scripts/docs/build-reprise.mjs', targets: ['docs/reprise-apres-pause.md'] },
  { runner: 'node', script: 'scripts/docs/build-icones.mjs', targets: ['docs/ajouter-une-icone.md'] },
  { runner: 'node', script: 'scripts/docs/build-codex-relations.mjs', targets: ['docs/codex-relations.md'] },
  { runner: 'node', script: 'scripts/docs/build-map-authoring.mjs', targets: ['docs/map-authoring.md'] },
  { runner: 'node', script: 'scripts/docs/build-passifs.mjs', targets: ['docs/systeme-passifs.md'] },
  { runner: 'node', script: 'scripts/docs/build-rendu-pipeline.mjs', targets: ['docs/rendu-pipeline.md'] },
  { runner: 'node', script: 'scripts/docs/build-flux-de-jet.mjs', targets: ['docs/ajouter-un-flux-de-jet.md'] },
  { runner: 'node', script: 'scripts/docs/build-mecanique.mjs', targets: ['docs/ajouter-une-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-sort.mjs', targets: ['docs/ajouter-un-sort.md'] },
  { runner: 'node', script: 'scripts/docs/build-ajouter-donnee.mjs', targets: ['docs/ajouter-une-donnee.md'] },
  { runner: 'node', script: 'scripts/docs/build-regles-optionnelles.mjs', targets: ['docs/regles-optionnelles.md'] },
  // Écrit un BLOC entre marqueurs dans CLAUDE.md, fichier manuscrit : `targets: []` comme
  // build-implemente.mjs (la taxonomie de fusion ne vaut que pour un fichier écrit EN ENTIER).
  { runner: 'node', script: 'scripts/docs/build-doctrines.mjs', targets: [], injecte: ['CLAUDE.md'] },
  { runner: 'tsx', script: 'scripts/gen-sorts-doc.mts', targets: ['docs/sorts-implementation.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-field-consumers.mts', targets: ['docs/consommateurs-de-champs.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-structures.mts', targets: ['docs/structures-donnees.md'] },
  // Rapports 100 % dérivés de l'Atlas : le .md est écrit AVANT la porte de régression (reanchor.mjs
  // l.343 puis l.354+), donc `docs:build` régénère le fichier ET laisse remonter l'exit 1.
  { runner: 'node', script: 'scripts/raw/coverage.mjs', targets: ['docs/raw/coverage.md'], check: false },
  { runner: 'node', script: 'scripts/raw/reconcile.mjs', targets: ['docs/raw/reconciliation.md'], check: false },
  { runner: 'node', script: 'scripts/raw/reanchor.mjs', targets: ['docs/raw/reanchor.md'], check: false },
]

/** Étapes de `docs:check` qui ne GÉNÈRENT rien (vérificateurs purs, sans `--check`) — déclarées
 *  ici pour que la chaîne npm reste dérivable d'UNE source. */
export const NON_GENERATOR_CHECKS = [
  'scripts/docs/check-doc-refs.mjs',
  'scripts/docs/check-plans-anchors.mjs',
  'scripts/raw/check-atlas-counts.mjs',
  'scripts/data/check-progression-schemas.mjs',
]

/** Scripts que `docs:check` passe en `--check` (source unique : ceux qui SAVENT vérifier). */
export const checkedScripts = () => new Set(GENERATORS.filter((g) => g.check !== false).map((g) => g.script))

/** Chemin du dérivé qui porte les sets MESURÉS, un par générateur. */
export const SOURCES_LUES = 'docs/.sources-lues.json'

const ENREGISTREUR = pathToFileURL(fileURLToPath(new URL('lib/enregistreur-lectures.mjs', import.meta.url))).href

/**
 * Entrée ESM de `tsx` DANS CET ARBRE (`exports['./esm']`). L'exécutable `tsx` re-spawne un processus
 * node : le générateur y perdrait le préchargeur passé en argument. `resoudreOutilLocal` porte le
 * refus nommé quand l'arbre ne l'a pas installé (porte d'outillage local, #1679 L1c).
 */
function tsxEsmDe(cwd) {
  const { refus } = resoudreOutilLocal(cwd, 'tsx', 'tsx')
  if (refus) {
    console.error(refus)
    process.exit(2)
  }
  const paquet = path.join(cwd, 'node_modules', 'tsx')
  const sousChemin = JSON.parse(readFileSync(path.join(paquet, 'package.json'), 'utf8')).exports?.['./esm']
  if (typeof sousChemin !== 'string') {
    console.error(`[outillage] le paquet tsx de cet arbre n'expose pas « ./esm » : ${paquet}`)
    process.exit(2)
  }
  return path.join(paquet, sousChemin)
}

/** Chemins visés par une liste de `targets`/`injecte` — un glob se déplie sur le disque. */
export function ciblesSurDisque(cibles, cwd) {
  return cibles.flatMap((cible) => {
    if (!cible.includes('*')) return [cible]
    const dossier = cible.slice(0, cible.lastIndexOf('/'))
    const motif = new RegExp(`^${cible.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`)
    let noms
    try { noms = readdirSync(path.join(cwd, dossier)) } catch { noms = [] }
    return noms.map((n) => `${dossier}/${n}`).filter((p) => motif.test(p)).sort()
  })
}

function run({ runner, script }, { cwd, quiet, check, tsxEsm, lectures, cibles }) {
  const args = [
    ...(runner === 'tsx' ? ['--import', pathToFileURL(tsxEsm).href] : []),
    script,
    ...(check ? ['--check'] : []),
  ]
  const env = envIsole(process.env, binLocal(cwd))
  if (lectures) {
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --import ${ENREGISTREUR}`.trim()
    env.WFRP_LECTURES_RACINE = cwd
    env.WFRP_LECTURES_SORTIE = path.join(lectures, 'l')
    env.WFRP_LECTURES_CIBLE = cibles.join(',')
  }
  execFileSync(process.execPath, args, {
    cwd,
    env,
    stdio: quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit',
  })
}

/** Un générateur lit au MOINS son propre fichier et une source : en dessous, la mesure a échoué. */
export const SEUIL_SOURCES = 2

/**
 * Message d'ARRÊT quand le set mesuré d'un générateur est vide ou minuscule — jamais une empreinte
 * « vérifiée » sur du vide. Sans les trois mécaniques (`syncBuiltinESMExports`, `NODE_OPTIONS`,
 * `tsx/esm`), 7 générateurs rendaient 10 chemins ou moins (mesure du juge, 2026-09-02).
 */
export function refusSourcesInsuffisantes(script, nombre) {
  return nombre < SEUIL_SOURCES
    ? `docs:build — ARRÊT sur ${script} : ${nombre} source(s) mesurée(s), l'enregistreur de lectures est AVEUGLE sur ce générateur.`
    : null
}

/**
 * AUTO-CONTRÔLE de fin de génération : les cibles qui existent sur disque et ne portent AUCUN pied.
 * Une cible non signée n'est jugée par rien — ni par `--empreinte`, ni par le hook. Le cas est vécu :
 * un générateur joué SEUL réécrit sa cible et effaçait la signature (d'où `ecrireDoc`, qui la garde).
 */
export function ciblesNonSignees(cwd, parGenerateur) {
  return Object.entries(parGenerateur).flatMap(([script, e]) =>
    e.cibles
      .filter((cible) => {
        const chemin = path.join(cwd, cible)
        return existeFichier(chemin) && !lirePied(readFileSync(chemin, 'utf8'))
      })
      .map((cible) => `${cible} (écrit par ${script})`),
  )
}

/** Le dérivé committé (`{}` quand le dépôt n'en porte pas : `docs:build` l'écrit). */
function lireSourcesLues(cwd) {
  try { return JSON.parse(readFileSync(path.join(cwd, SOURCES_LUES), 'utf8')) } catch { return {} }
}

/**
 * Cible → générateur qui la SIGNE. Un doc écrit en entier n'a qu'un auteur : deux pieds sur le même
 * fichier seraient contradictoires, et le second effacerait le premier. REND aussi les doublons.
 */
export function proprietairesDeCibles(cwd) {
  const par = new Map()
  const doublons = []
  for (const g of GENERATORS)
    for (const cible of ciblesSurDisque(g.targets, cwd)) {
      if (par.has(cible)) doublons.push(`${cible} : déclarée par ${par.get(cible)} ET ${g.script}`)
      else par.set(cible, g.script)
    }
  return { par, doublons }
}

/** Contenu d'un chemin DANS L'INDEX (`git show :<chemin>`), ou `null` si le commit ne le porte pas. */
function auCommit(cwd, chemin) {
  try { return execFileSync('git', ['show', `:${chemin}`], { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }) } catch { return null }
}

/** Sources du générateur dont le DISQUE et l'INDEX divergent — la cause à nommer, jamais un sha1 nu. */
function sourcesDivergentes(cwd, blobs, fichiers) {
  const divergentes = []
  for (const chemin of fichiers) {
    let disque
    try { disque = hashBlobDisque(path.join(cwd, chemin)) } catch { disque = null }
    if (disque !== blobs.get(chemin)) divergentes.push(chemin)
  }
  return divergentes
}

/**
 * `--empreinte [--only <script>…]` : SANS rien régénérer, recalcule depuis l'INDEX l'empreinte des
 * sources de chaque générateur et la compare au pied du doc TEL QUE L'INDEX LE PORTE. Les deux côtés
 * sortent du commit en fabrication, et de rien d'autre. REND le code de sortie.
 * Sans `--only`, tout doc que l'index porte est jugé (la CI, sur un arbre où index = HEAD) ; avec,
 * le hook ne fait juger que les docs STAGÉS. Aucun doc à juger = 0 : il n'y a rien à mentir.
 */
function verifierEmpreintes(cwd, seulement) {
  const lues = lireSourcesLues(cwd)
  const tous = Object.keys(lues)
  if (!tous.length) {
    console.error(`docs:empreinte — ${SOURCES_LUES} absent ou vide : aucune source n'est mesurée (npm run docs:build).`)
    return 1
  }
  const scripts = tous.filter((s) => !seulement || seulement.has(s))
  if (!scripts.length) {
    console.log('docs:empreinte — aucun doc stagé à confronter à l\'index.')
    return 0
  }
  // Rien n'est exigible tant que le commit ne porte pas la mécanique : sans `docs/.sources-lues.json`
  // dans l'index, les docs de l'index sont ceux d'AVANT l'empreinte et n'ont aucun pied à tenir.
  if (auCommit(cwd, SOURCES_LUES) === null) {
    console.log(`docs:empreinte — ${SOURCES_LUES} n'est pas dans l'index : aucun pied n'est encore au commit, rien à confronter (régime levé par scripts/docs/sources-lues-au-commit.test.mjs, qui exige ce dérivé au commit).`)
    return 0
  }
  const blobs = indexGit(cwd)
  const refus = []
  let docsJuges = 0
  for (const script of scripts) {
    const entree = lues[script]
    const { empreinte, manquants } = empreinteDeLIndex(blobs, {
      fichiers: entree.fichiers,
      dossiers: new Map(entree.dossiers.map((d) => [d, []])),
    })
    for (const chemin of manquants)
      refus.push(`${script} : source non suivie « ${chemin} » — l'index ne la porte pas, elle ne peut pas être vérifiée`)
    for (const cible of entree.cibles) {
      const texte = auCommit(cwd, cible)
      if (texte === null) continue
      docsJuges += 1
      const pied = lirePied(texte)
      if (!pied) {
        refus.push(`${cible} : pied « sources-empreinte » absent de l'index — régénérer (npm run docs:build) et stager`)
        continue
      }
      if (pied.empreinte === empreinte) continue
      const divergentes = sourcesDivergentes(cwd, blobs, entree.fichiers)
      refus.push(
        `${cible} : doc régénéré depuis un arbre ≠ index (pied ${pied.empreinte.slice(0, 12)}, index ${empreinte.slice(0, 12)})\n` +
          `      source(s) qui diffèrent de l'index : ${divergentes.length ? divergentes.join(', ') : "aucune sur ce disque — le pied vient d'un autre arbre, ou un dossier lu a changé de listing"}\n` +
          '      → stage la source, ou régénère après avoir stagé',
      )
    }
  }
  if (refus.length) {
    process.stderr.write(`docs:empreinte — REFUS (${refus.length}) :\n${refus.map((r) => `  ${r}`).join('\n')}\n`)
    return 1
  }
  console.log(
    docsJuges
      ? `docs:empreinte — OK (${scripts.length} générateur(s), ${docsJuges} doc(s) confrontés à l'index)`
      : 'docs:empreinte — aucun doc stagé à confronter à l\'index.',
  )
  return 0
}

function main() {
  const quiet = process.argv.includes('--quiet')
  const check = process.argv.includes('--check')
  const cwd = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const seulement = (() => {
    const i = process.argv.indexOf('--only')
    return i < 0 ? null : new Set(process.argv.slice(i + 1).filter((a) => !a.startsWith('--')))
  })()
  if (process.argv.includes('--empreinte')) process.exit(verifierEmpreintes(cwd, seulement))
  // Refus d'un tsx NON LOCAL avant le premier générateur : à mi-chaîne, docs/ serait à moitié écrit.
  const tsxEsm = GENERATORS.some((g) => g.runner === 'tsx') ? tsxEsmDe(cwd) : null
  const ignores = ignoresGit(cwd)
  const { doublons } = proprietairesDeCibles(cwd)
  if (doublons.length) {
    process.stderr.write(`docs:build — ARRÊT : cible(s) déclarée(s) par DEUX générateurs, le second pied effacerait le premier :\n${doublons.map((d) => `  ${d}`).join('\n')}\n`)
    process.exit(1)
  }
  const racineLectures = path.join(cwd, 'node_modules', '.cache', 'lectures-docs', String(process.pid))
  rmSync(racineLectures, { recursive: true, force: true })
  const parGenerateur = {}
  // Fail-fast : un générateur rouge laisse docs/ à moitié régénéré ; enchaîner les suivants
  // fabriquerait un lot incohérent que le hook annoncerait « à committer ».
  for (const [rang, g] of GENERATORS.entries()) {
    if (check && g.check === false) continue
    const dossier = path.join(racineLectures, String(rang))
    mkdirSync(dossier, { recursive: true })
    // Un générateur relit ce qu'il écrit (son .md en `--check`, le fichier où il injecte un bloc) :
    // rien de tout cela n'est une de ses sources. Seul un `targets` — un doc écrit EN ENTIER — reçoit
    // le pied : `build-doctrines` n'écrit qu'un bloc de CLAUDE.md et `build-implemente` qu'un champ
    // des fiches docs/raw, deux fichiers manuscrits qu'aucune empreinte ne peut signer.
    const signees = ciblesSurDisque(g.targets, cwd)
    const cibles = [...new Set([...signees, ...ciblesSurDisque(g.injecte ?? [], cwd)])].sort()
    try {
      run(g, { cwd, quiet, check, tsxEsm, lectures: dossier, cibles })
    } catch (e) {
      process.stderr.write(`docs:build — ARRÊT sur ${g.script} (code ${e.status ?? e.message}) : docs/ n'est PAS à jour.\n`)
      process.exit(1)
    }
    const lues = fusionnerLectures(dossier)
    const aveugle = refusSourcesInsuffisantes(g.script, lues.fichiers.length)
    if (aveugle) {
      process.stderr.write(`${aveugle}
`)
      process.exit(1)
    }
    const ecritesAuMemeRangOuPlusTard = new Map(
      GENERATORS.flatMap((autre, r) => (r >= rang ? ciblesSurDisque(autre.targets, cwd).map((c) => [c, autre.script]) : [])),
    )
    for (const source of lues.fichiers) {
      const producteur = ecritesAuMemeRangOuPlusTard.get(source)
      if (producteur) {
        process.stderr.write(`docs:build — ARRÊT sur ${g.script} : lit « ${source} », que ${producteur} écrit au même rang ou plus tard — cette source serait périmée.\n`)
        process.exit(1)
      }
    }
    parGenerateur[g.script] = { cibles: signees, fichiers: lues.fichiers, dossiers: [...lues.dossiers.keys()] }
    if (check) continue
    // Le pied se pose AVANT le générateur suivant : un doc signé plus tard serait lu SANS son pied par
    // les suivants, et leur empreinte suivrait la génération PRÉCÉDENTE — mesuré sur `coverage.mjs`,
    // qui lit les `catalogue-*.md` que `build-catalogs.mjs` signe.
    const { empreinte } = empreinteDuDisque(cwd, lues, ignores)
    const pied = { empreinte, fichiers: lues.fichiers.length, dossiers: lues.dossiers.size }
    for (const cible of signees) {
      const chemin = path.join(cwd, cible)
      if (existeFichier(chemin)) writeFileSync(chemin, avecPied(readFileSync(chemin, 'utf8'), pied))
    }
  }
  const nonSignees = ciblesNonSignees(cwd, parGenerateur)
  if (nonSignees.length) {
    process.stderr.write(
      `docs:build — ARRÊT : ${nonSignees.length} cible(s) SANS pied « sources-empreinte », donc jugée(s) par rien :\n${nonSignees.map((c) => `  ${c}`).join('\n')}\n`,
    )
    process.exit(1)
  }
  const rendu = serialiserSourcesLues(check ? { ...lireSourcesLues(cwd), ...parGenerateur } : parGenerateur)
  const cheminRendu = path.join(cwd, SOURCES_LUES)
  if (!check) {
    writeFileSync(cheminRendu, rendu)
    console.log(`${SOURCES_LUES} — ${Object.keys(parGenerateur).length} générateur(s) mesuré(s).`)
    return
  }
  let actuel
  try { actuel = readFileSync(cheminRendu, 'utf8') } catch { actuel = null }
  if (actuel !== rendu) {
    process.stderr.write(`docs:check — ${SOURCES_LUES} est PÉRIMÉ (les sources MESURÉES d'au moins un générateur ont changé).\n  → relancer \`npm run docs:build\` et committer le résultat.\n`)
    process.exit(1)
  }
  console.log(`docs:check — OK (${SOURCES_LUES} à jour, ${Object.keys(parGenerateur).length} générateur(s) mesuré(s))`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
