// JUSTIFICATIF DE GATES PAR CONTENU (#1679 L2) — la mémoire, entre deux commandes, de « telle gate a
// tourné VERTE sur tel contenu ». Le pre-push est un LECTEUR de ces fichiers : il ne rejoue aucune
// suite, il vérifie que le contenu poussé est celui qui a été mesuré.
//
// DEUX CLÉS, CHOISIES PAR GATE. `cleTree` hache les blobs de l'arbre du commit PRIVÉ de `docs/` et
// `.claude/` : deux commits qui ne diffèrent que par un doc régénéré ou une fiche mémoire la
// partagent, et une gate qui ne lit pas ces dossiers vaut pour les deux (7/30 des dernières têtes
// poussées, mesuré). Mais 12 gates LISENT `docs/` ou `.claude/` (table `CLE_DE_GATE`, chacune avec
// sa raison) : pour celles-là, la clé est l'arbre PLEIN (`cleTreeComplete`) — sans quoi un commit
// qui casse `docs/raw/combat.md` réutiliserait un `docs:check` vert, la classe exacte de l'incident
// 17926d5de.
//
// OÙ ILS VIVENT : `<git-common-dir>/wfrp-justificatifs/<cleTree>/<gate>.json` — le MÊME endroit que
// le compteur de palier de `scripts/git-hooks/post-commit` (`wfrp-palier.compteur`), pour les mêmes
// raisons : partagé par l'arbre principal et tous ses worktrees, et hors de `node_modules` (que
// `npm ci` efface). UN FICHIER PAR GATE : deux gates concurrentes n'ont aucun lire-modifier-écrire
// à partager, le renommage atomique suffit.
//
// `sale` est mesuré AU MOMENT DE LA GATE, jamais au push : une gate jouée sur un arbre porteur de
// modifications non committées au périmètre de la clé ne prouve rien sur le contenu poussé. La liste
// des chemins qui salissent est la MÊME que celle de la clé (`horsCle`), sinon un `docs/` régénéré
// non stagé — 11 lignes mesurées sur l'arbre principal — refuserait tout push.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Chemins hors de la clé PARTIELLE : dérivés (`docs/`) et mémoire de session (`.claude/`). UNE
 *  liste, deux lecteurs : `cleTree` et `perimetreSale`. */
export const horsCle = (chemin) => /^(?:docs|\.claude)\//.test(String(chemin).replace(/\\/g, '/'))

/** Blobs de l'arbre de `sha`, une entrée par ligne, filtrés par `garder`. */
function empreinteArbre(sha, { cwd, garder }) {
  const brut = execFileSync('git', ['ls-tree', '-r', '-z', sha], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 })
  const entrees = brut
    .split('\0')
    .filter(Boolean)
    .filter((e) => garder(e.slice(e.indexOf('\t') + 1)))
  return execFileSync('git', ['hash-object', '--stdin'], {
    cwd,
    encoding: 'utf8',
    input: `${entrees.join('\n')}\n`,
    maxBuffer: 1 << 28,
  }).trim()
}

/** Clé PARTIELLE : le contenu de l'arbre de `sha` hors `docs/` et `.claude/`. */
export const cleTree = (sha, { cwd = process.cwd() } = {}) =>
  empreinteArbre(sha, { cwd, garder: (chemin) => !horsCle(chemin) })

/** Clé COMPLÈTE : l'arbre de `sha` en ENTIER, docs et mémoire compris. */
export const cleTreeComplete = (sha, { cwd = process.cwd() } = {}) =>
  empreinteArbre(sha, { cwd, garder: () => true })

/**
 * Gates dont les ENTRÉES vivent sous `docs/` ou `.claude/` : leur justificatif ne vaut que pour un
 * arbre IDENTIQUE EN ENTIER. Table NOMINATIVE — une gate absente d'ici est gouvernée par la clé
 * partielle. Chaque raison est mesurée sur le corpus que la gate lit.
 */
export const CLE_DE_GATE = {
  'agents:check': 'lit .claude/ (credo, skills, agents, settings) — scripts/agents/compat-cli.mjs:16-20',
  'test:hooks': 'lit .claude/ (soldes, settings.json) — scripts/hooks/soldes-stock.test.mjs:16, settings-guard-canaux.test.mjs:27',
  'test:docs': 'lit docs/ et .claude/memory/ — scripts/docs/check-plans-anchors.test.mjs, build-doctrines.test.mjs:1',
  'docs:check': 'lit docs/ (références vivantes, docs générés, Atlas)',
  'docs:empreinte': 'lit docs/ (pied sources-empreinte de chaque doc dérivé)',
  'test:raw': 'lit docs/raw/ (harnais de couverture de l’Atlas)',
  'raw:coverage': 'lit docs/raw/',
  'raw:reconcile': 'lit docs/raw/',
  'raw:check-refs': 'lit docs/raw/',
  'raw:check-code-refs': 'lit docs/raw/',
  'raw:check-folio-continuity': 'lit docs/raw/',
  'raw:reanchor': 'lit docs/raw/',
}

/** `true` si la gate est gouvernée par la clé COMPLÈTE. */
export const gateSurArbrePlein = (nom) => nom in CLE_DE_GATE

/** Lignes de `git status --porcelain` dont un chemin est DANS la clé partielle. Un renommage porte
 *  ses deux chemins (`-z` rend le nouveau, puis l'ancien) : l'entrée compte si l'un des deux y est. */
export function perimetreSale({ cwd = process.cwd() } = {}) {
  const champs = execFileSync('git', ['status', '--porcelain', '-z'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  }).split('\0')
  const lignes = []
  for (let i = 0; i < champs.length; i += 1) {
    const champ = champs[i]
    if (!champ) continue
    const etat = champ.slice(0, 2)
    const chemins = [champ.slice(3)]
    if (/[RC]/.test(etat) && champs[i + 1]) {
      i += 1
      chemins.push(champs[i])
    }
    if (chemins.some((c) => !horsCle(c))) lignes.push(`${etat} ${chemins.join(' <- ')}`)
  }
  return lignes
}

/** `<git-common-dir>/wfrp-justificatifs/`, créé au besoin. */
export function cheminJustificatifs({ cwd = process.cwd() } = {}) {
  const commun = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd, encoding: 'utf8' }).trim()
  const dossier = join(resolve(cwd, commun), 'wfrp-justificatifs')
  mkdirSync(dossier, { recursive: true })
  return dossier
}

/** Nom de FICHIER d'une gate. `:` sépare un flux de données alternatif sous NTFS : `docs:check.json`
 *  y est un nom ILLÉGAL (EINVAL au renommage, mesuré), et 19 des 23 gates en portent un. */
export const fichierDeGate = (gate) => `${encodeURIComponent(gate)}.json`

/** Justificatif d'UNE gate pour une clé partielle donnée, ou `null`. */
export function lireJustificatif({ cwd = process.cwd(), cleTree: cle, gate } = {}) {
  const fichier = join(cheminJustificatifs({ cwd }), cle, fichierDeGate(gate))
  if (!existsSync(fichier)) return null
  try {
    return JSON.parse(readFileSync(fichier, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Pose le verdict de `gate` sur le contenu de `sha`. UN FICHIER PAR GATE, rangé sous la clé
 * PARTIELLE et portant AUSSI la clé complète : le lecteur choisit celle qui gouverne la gate
 * (`CLE_DE_GATE`). Écriture ATOMIQUE (fichier temporaire puis renommage) — aucun lire-modifier-écrire
 * partagé entre deux sessions, donc aucune gate perdue par écrasement.
 */
export function ecrireJustificatif({
  cwd = process.cwd(),
  gate,
  sha,
  statut = 'vert',
  date = new Date().toISOString(),
  capture,
} = {}) {
  const cle = cleTree(sha, { cwd })
  const cleComplete = cleTreeComplete(sha, { cwd })
  const salis = perimetreSale({ cwd })
  const contenu = {
    gate,
    cleTree: cle,
    cleComplete,
    sha,
    statut,
    date,
    sale: salis.length > 0,
    salis,
    ...(capture ? { capture } : {}),
  }
  const dossier = join(cheminJustificatifs({ cwd }), cle)
  mkdirSync(dossier, { recursive: true })
  const fichier = join(dossier, fichierDeGate(gate))
  const temporaire = `${fichier}.${process.pid}.en-cours`
  writeFileSync(temporaire, `${JSON.stringify(contenu, null, 2)}\n`)
  renameSync(temporaire, fichier)
  return { fichier, cleTree: cle, cleComplete, salis }
}

/**
 * Steps de `ci.yml` qui ne PEUVENT PAS devenir une gate locale, chacun avec sa raison. La liste est
 * exhaustive et EXACTE (ligne pour ligne) : c'est elle qui rend le classement fail-CLOSED — un step
 * d'une autre forme fait LEVER `gatesRequises`, au lieu d'être ignoré en silence.
 */
export const CI_SEULEMENT = {
  'npm ci': 'installation des dépendances du runner — rien à mesurer sur le contenu poussé',
  'npm --prefix server ci':
    'install serveur — à jouer une fois localement, le refus du pre-push le dit',
  "npm run gen && git diff --exit-code -- '*.generated.ts'":
    'mutant : régénère puis git diff — L3 D1 le jouera sur export',
  "npm run raw:catalogs && git diff --exit-code -- 'docs/raw/catalogue-*.md'":
    'mutant : régénère puis git diff — L3 D1 le jouera sur export',
}

/** Nom de gate d'une commande de step : `npm test` → `test`, `npm run <x>` → `<x>`, sinon `null`. */
export function nomDeGate(commande) {
  if (/^npm test$/.test(commande)) return 'test'
  const script = /^npm run ([A-Za-z0-9:_.-]+)$/.exec(commande)
  return script ? script[1] : null
}

/**
 * Steps de `ci.yml`, dans l'ordre du fichier. Un scalaire de bloc (`run: |`) est réduit à ses lignes
 * jointes par ` ; ` — une forme, donc, qui doit être classée comme les autres au lieu de disparaître.
 * `cles` porte les AUTRES clés du step (`working-directory`, `env`, `shell`…) : une gate locale ne
 * les reproduit pas, donc leur présence doit LEVER plutôt que créditer la commande racine.
 * REND `[{ job, commande, cles }]`.
 */
export function stepsCi({ cwd = process.cwd(), fichier } = {}) {
  const lignes = readFileSync(fichier ?? join(cwd, '.github', 'workflows', 'ci.yml'), 'utf8').split(/\r?\n/)
  const steps = []
  let job = null
  let courant = null
  const poser = () => {
    if (courant && courant.commande !== null) steps.push(courant)
    courant = null
  }
  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i]
    const entete = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(ligne)
    if (entete) {
      poser()
      job = entete[1]
      continue
    }
    if (/^\s*-\s/.test(ligne)) poser()
    const cle = /^\s*-?\s*([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(ligne)
    if (!cle) continue
    const [, nomCle, valeur] = cle
    if (!courant) courant = { job, commande: null, cles: [] }
    if (nomCle !== 'run') {
      courant.cles.push(nomCle)
      continue
    }
    if (!/^[|>]/.test(valeur)) {
      courant.commande = valeur
      continue
    }
    const blanc = /^\s*/.exec(ligne)[0]
    const corps = []
    for (let j = i + 1; j < lignes.length; j += 1) {
      if (lignes[j].trim() === '') continue
      if (/^\s*/.exec(lignes[j])[0].length <= blanc.length) break
      corps.push(lignes[j].trim())
      i = j
    }
    courant.commande = corps.join(' ; ')
  }
  poser()
  return steps
}

/** Clés de step INERTES pour une gate locale : elles ne changent ni la commande ni son contexte. */
export const CLES_DE_STEP_INERTES = ['name', 'if', 'id']

/**
 * Jobs de `ci.yml` dont les steps ne se justifient PAS localement, avec leur raison. Nominatif :
 * un job neuf est exigé au push tant qu'il n'est pas nommé ici.
 */
export const JOBS_HORS_JUSTIFICATIF = {
  migrations:
    'rejeu EN PLACE des migrations : le jouer sur un arbre de travail réécrit src/data et src/scenes ' +
    'et rend un verdict faux (#1613) — T1b le vérifie sur un EXPORT de la tête',
}

/**
 * Gates exigées au push = les steps de `.github/workflows/ci.yml`, DANS L'ORDRE DU FICHIER, hors
 * `JOBS_HORS_JUSTIFICATIF`. Aucun nom n'est recopié ici : un step ajouté à la CI devient exigé au
 * push sans qu'on touche au hook. Un step qui n'est ni `npm test`/`npm run <x>` ni une entrée de
 * `CI_SEULEMENT`, ou qui porte une clé non inerte, LÈVE : le classement est une décision, pas un
 * silence. REND `[{ nom, commande, job }]`.
 */
export function gatesRequises({ cwd = process.cwd(), fichier } = {}) {
  const gates = []
  const vus = new Set()
  for (const { job, commande, cles } of stepsCi({ cwd, fichier })) {
    if (job in JOBS_HORS_JUSTIFICATIF) continue
    const nom = nomDeGate(commande)
    const parasites = cles.filter((c) => !CLES_DE_STEP_INERTES.includes(c))
    if (nom && parasites.length)
      throw new Error(
        `step non classé : ${commande} — il porte ${parasites.join(', ')}, que « npm run ${nom} » ne ` +
          'reproduit pas ; donne-lui un script de package.json qui le porte, ou classe-le en CI_SEULEMENT',
      )
    if (!nom) {
      if (commande in CI_SEULEMENT) continue
      throw new Error(
        `step non classé : ${commande} — ajoute-le à package.json comme script (« npm run <x> ») ou à ` +
          'CI_SEULEMENT (scripts/guards/lib/justificatif.mjs) avec sa raison',
      )
    }
    if (vus.has(nom)) continue
    vus.add(nom)
    gates.push({ nom, commande, job })
  }
  return gates
}

/** Verdict d'UNE gate : `null` si elle passe, sinon le motif de refus. `cles` porte les deux clés du
 *  contenu poussé ; celle qui gouverne la gate vient de `CLE_DE_GATE`. */
export function motifDeRefus(vue, { nom, commande }, cles = null) {
  if (!vue) return `gate « ${nom} » jamais jouée sur ce contenu — la produire : ${commande}`
  if (vue.statut !== 'vert') return `gate « ${nom} » au statut ${vue.statut} — la rejouer : ${commande}`
  if (vue.sale)
    return `gate « ${nom} » jouée sur un arbre SALE (${(vue.salis ?? []).join(' · ')}) — committer, puis rejouer : ${commande}`
  if (cles && gateSurArbrePlein(nom) && vue.cleComplete !== cles.cleComplete)
    return (
      `gate « ${nom} » jouée sur un AUTRE arbre : elle ${CLE_DE_GATE[nom]}, et ce contenu-là a changé ` +
      `depuis — la rejouer : ${commande}`
    )
  return null
}

/** Drapeaux de Vitest qui RESTREIGNENT ce qui est joué : sous l'un d'eux, un vert ne dit rien de la
 *  suite entière. `--bail` n'en est pas : il ARRÊTE au premier rouge, donc un run VERT sous `--bail`
 *  a tout joué (et seul un run vert écrit un justificatif). */
export const DRAPEAUX_RESTRICTIFS = [
  '--changed',
  '-t',
  '--testNamePattern',
  '--shard',
  '--project',
  '--dir',
  '--related',
  '--exclude',
]

/** Une suite est COMPLÈTE quand aucun fichier ne la filtre et qu'aucun drapeau ne la restreint. */
export const suiteComplete = (filtres, argv) =>
  filtres.length === 0 && !argv.some((a) => DRAPEAUX_RESTRICTIFS.includes(a.split('=')[0]))
/**
 * Commande RÉELLEMENT jouée par un script de `package.json`, l'enveloppe de justificatif retirée.
 * Consommateurs : les gardes qui décrivent le contrat d'une porte (`typecheck` FULL, chaîne de
 * `docs:check`) — elles jugent ce qui s'exécute, pas la couche qui l'enregistre.
 */
export function commandeEffective(scripts, nom, vus = new Set()) {
  const brut = scripts?.[nom] ?? ''
  if (vus.has(nom)) return brut
  vus.add(nom)
  const enveloppe = /^node scripts\/gates\/justifie\.mjs\s+\S+\s+--\s+(.+)$/.exec(brut)
  if (!enveloppe) return brut
  const interne = enveloppe[1].trim()
  const relais = /^npm run ([A-Za-z0-9:_.-]+)$/.exec(interne)
  return relais ? commandeEffective(scripts, relais[1], vus) : interne
}
