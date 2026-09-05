// JUSTIFICATIF DE GATES PAR CONTENU (#1679 L2) — la mémoire, entre deux commandes, de « telle gate a
// tourné VERTE sur tel contenu ». Le pre-push est un LECTEUR de ces fichiers : il ne rejoue aucune
// suite, il vérifie que le contenu poussé est celui qui a été mesuré.
//
// DEUX CLÉS, CHOISIES PAR GATE. `cleTree` hache les blobs de l'arbre du commit PRIVÉ de `docs/` et
// `.claude/` : deux commits qui ne diffèrent que par un doc régénéré ou une fiche mémoire la
// partagent, et une gate qui ne lit pas ces dossiers vaut pour les deux (7/30 des dernières têtes
// poussées, mesuré). Mais 12 gates LISENT `docs/` ou `.claude/` (table `RAISON_CLE_COMPLETE`,
// chacune avec sa raison) : pour celles-là, la clé est l'arbre PLEIN (`cleComplete`) — sans quoi un
// commit qui casse `docs/raw/combat.md` réutiliserait un `docs:check` vert, la classe exacte de
// l'incident 17926d5de.
//
// OÙ ILS VIVENT : `<git-common-dir>/wfrp-justificatifs/<cleTree>/<gate>.<cle>.<propre|sale>.json` —
// partagé par l'arbre principal et tous ses worktrees, et hors de `node_modules` (que `npm ci`
// efface). Ce partage est JUSTE ici, parce que la clé est le CONTENU jugé : un justificatif écrit
// depuis un worktree vaut pour le même contenu où qu'il soit. Il ne l'était pas pour le palier, qui
// comptait des ÉVÉNEMENTS locaux (32 pour 9 commits réels, 2026-09-04) — d'où sa mesure sur
// l'histoire.
//
// UN FICHIER PAR (GATE, CLÉ GOUVERNANTE, PROPRETÉ) : le NOM porte tout ce qui distingue deux
// verdicts, donc deux fichiers de même nom sont ÉQUIVALENTS. L'écrivain écrit LE SIEN et ne lit
// rien — aucun lire-modifier-écrire à se disputer, le renommage atomique suffit, et un rejeu sur
// arbre sale ne peut plus effacer la preuve d'un push régulier (elle porte un autre nom). Le
// lecteur préfère le PROPRE. Un justificatif n'existe QU'AU VERT : `scripts/gates/justifie.mjs` et
// `scripts/test/run.mjs` n'écrivent que sur un code de sortie nul.
//
// `sale` est mesuré AU MOMENT DE LA GATE, jamais au push : une gate jouée sur un arbre porteur de
// modifications non committées au périmètre de la clé ne prouve rien sur le contenu poussé. La liste
// des chemins qui salissent est la MÊME que celle de la clé (`horsCle`), sinon un `docs/` régénéré
// non stagé — 11 lignes mesurées sur l'arbre principal — refuserait tout push.
import { execFileSync } from 'node:child_process'
import * as FS from 'node:fs'
import { join, resolve } from 'node:path'

/** Chemins hors de la clé PARTIELLE : dérivés (`docs/`) et mémoire de session (`.claude/`). UNE
 *  liste, deux lecteurs : `cleTree` et `perimetreSale`. */
export const horsCle = (chemin) => /^(?:docs|\.claude)\//.test(String(chemin).replace(/\\/g, '/'))

/** Entrées de l'arbre de `sha`, une par élément (`<mode> <type> <sha>\t<chemin>`). */
function entreesArbre(sha, { cwd }) {
  return execFileSync('git', ['ls-tree', '-r', '-z', sha], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\0')
    .filter(Boolean)
}

const cheminDeEntree = (entree) => entree.slice(entree.indexOf('\t') + 1)
const dansLaCle = (entree) => !horsCle(cheminDeEntree(entree))

/**
 * Empreinte (40 hexadécimaux) d'un ENSEMBLE d'entrées d'arbre, par `git hash-object`.
 * `scripts/docs/lib/empreinte-sources.mjs:98-102` hache lui aussi un ensemble de blobs, en node pur :
 * son entrée est l'INDEX (`git ls-files -s`) et sa valeur se pose en pied de doc, alors qu'ici
 * l'entrée est l'arbre d'un COMMIT (`git ls-tree <sha>`) et la valeur est GRAVÉE dans le nom des
 * fichiers du magasin. Deux entrées, deux durées de vie : les fusionner alignerait un pied de doc
 * sur un nom de fichier de `.git/`.
 */
function empreinteArbre(entrees, { cwd }) {
  return execFileSync('git', ['hash-object', '--stdin'], {
    cwd,
    encoding: 'utf8',
    input: `${entrees.join('\n')}\n`,
    maxBuffer: 1 << 28,
  }).trim()
}

/** Les DEUX clés du contenu de `sha`, en UN seul `git ls-tree` : constructeur des trois lecteurs
 *  (pre-push, lanceur de gates, mesure d'ops). */
export function clesDeContenu(sha, { cwd = process.cwd() } = {}) {
  const entrees = entreesArbre(sha, { cwd })
  return {
    cleTree: empreinteArbre(entrees.filter(dansLaCle), { cwd }),
    cleComplete: empreinteArbre(entrees, { cwd }),
  }
}

/** Clé PARTIELLE : le contenu de l'arbre de `sha` hors `docs/` et `.claude/`. */
export const cleTree = (sha, { cwd = process.cwd() } = {}) =>
  empreinteArbre(entreesArbre(sha, { cwd }).filter(dansLaCle), { cwd })

/** Clé COMPLÈTE : l'arbre de `sha` en ENTIER, docs et mémoire compris. */
export const cleTreeComplete = (sha, { cwd = process.cwd() } = {}) =>
  empreinteArbre(entreesArbre(sha, { cwd }), { cwd })

/**
 * Gates dont les ENTRÉES vivent sous `docs/` ou `.claude/` : leur justificatif ne vaut que pour un
 * arbre IDENTIQUE EN ENTIER. Table NOMINATIVE — une gate absente d'ici est gouvernée par la clé
 * partielle. Chaque raison est mesurée sur le corpus que la gate lit, et sert telle quelle dans le
 * refus « jouée sur un AUTRE arbre ».
 */
export const RAISON_CLE_COMPLETE = {
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

/** Clé qui GOUVERNE `gate` — seule expression de la règle : complète pour les gates qui lisent
 *  `docs/` ou `.claude/`, partielle pour les autres. */
export const cleGouvernante = (gate, cles) => (gate in RAISON_CLE_COMPLETE ? cles.cleComplete : cles.cleTree)

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
export function cheminJustificatifs({ cwd = process.cwd(), fs = FS } = {}) {
  const commun = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd, encoding: 'utf8' }).trim()
  const dossier = join(resolve(cwd, commun), 'wfrp-justificatifs')
  fs.mkdirSync(dossier, { recursive: true })
  return dossier
}

/** Segment de nom de fichier d'une gate. `:` sépare un flux de données alternatif sous NTFS :
 *  `docs:check.json` y est un nom ILLÉGAL (EINVAL au renommage, mesuré), et 18 des 22 gates en
 *  portent un. */
export const segmentDeGate = (gate) => encodeURIComponent(gate)

/** Nom de fichier d'un justificatif : le NOM porte la gate, la valeur de la clé GOUVERNANTE et la
 *  propreté ; le DOSSIER porte la clé partielle. */
export const fichierDeJustificatif = ({ gate, cle, sale }) =>
  `${segmentDeGate(gate)}.${cle}.${sale ? 'sale' : 'propre'}.json`

const NOM_DE_JUSTIFICATIF = /^(.+)\.([0-9a-f]{40})\.(propre|sale)\.json$/

/** `{ gate, cle, sale }` lus DANS le nom, ou `null` si ce n'en est pas un — `derogations.log` et
 *  l'ancienne graphie `<segment>.json` en sont. */
export function nomDeJustificatif(nom) {
  const vu = NOM_DE_JUSTIFICATIF.exec(nom)
  return vu ? { gate: decodeURIComponent(vu[1]), cle: vu[2], sale: vu[3] === 'sale' } : null
}

/** `true` si `nom` est un justificatif de la graphie courante. */
export const estFichierDeJustificatif = (nom) => nomDeJustificatif(nom) !== null

/**
 * Justificatif d'UNE gate pour le contenu décrit par `cles`, ou `null`. `gate` et `cles` sont
 * OBLIGATOIRES : un appel qui les oublie lirait le dossier d'un autre contenu et créditerait un
 * push à tort. Le PROPRE prime sur le SALE, et la propreté rendue vient du NOM — un champ `sale`
 * resté dans le contenu d'un fichier migré est ignoré.
 */
export function lireJustificatif({ cwd = process.cwd(), gate, cles, fs = FS } = {}) {
  if (!gate) throw new Error('lireJustificatif : `gate` est obligatoire')
  if (!cles?.cleTree || !cles?.cleComplete)
    throw new Error(
      'lireJustificatif : `cles` est obligatoire — construis-le par `clesDeContenu(sha, { cwd })`',
    )
  const dossier = join(cheminJustificatifs({ cwd, fs }), cles.cleTree)
  const cle = cleGouvernante(gate, cles)
  for (const sale of [false, true]) {
    const fichier = join(dossier, fichierDeJustificatif({ gate, cle, sale }))
    if (!fs.existsSync(fichier)) continue
    try {
      return { ...JSON.parse(fs.readFileSync(fichier, 'utf8')), sale }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Existe-t-il, sous la clé partielle de `cles`, un justificatif de `gate` posé sous une AUTRE clé
 * gouvernante ? La question n'a de sens que pour une gate gouvernée par la clé COMPLÈTE : pour les
 * autres, la clé du nom EST celle du dossier, donc `false` par construction.
 */
export function justificatifsSousDAutresCles({ cwd = process.cwd(), gate, cles, fs = FS } = {}) {
  if (!(gate in RAISON_CLE_COMPLETE)) return false
  const cle = cleGouvernante(gate, cles)
  let noms
  try {
    noms = fs.readdirSync(join(cheminJustificatifs({ cwd, fs }), cles.cleTree))
  } catch {
    return false
  }
  return noms.some((nom) => {
    const vu = nomDeJustificatif(nom)
    return vu !== null && vu.gate === gate && vu.cle !== cle
  })
}

/**
 * Pose le verdict VERT de `gate` sur le contenu de `sha`, dans SON fichier : dossier = clé
 * partielle, nom = (gate, clé gouvernante, propreté). Écriture ATOMIQUE (fichier temporaire puis
 * renommage) et sans aucune lecture — deux écrivains simultanés n'ont rien à se disputer.
 *
 * UN VERDICT NE SE DÉGRADE JAMAIS : un rejeu sur arbre SALE écrit un fichier `sale`, à côté du
 * `propre` qu'il ne touche pas. Le fait qui l'exige est mesuré : sous la clé de `b7227f7b5`, 5 gates
 * portent `sale:true` à des dates POSTÉRIEURES au push (2026-09-03) — le travail reprend après le
 * push, et sans nom porteur son rejeu écrase la preuve du push régulier.
 */
export function ecrireJustificatif({
  cwd = process.cwd(),
  gate,
  sha,
  date = new Date().toISOString(),
  capture,
  fs = FS,
} = {}) {
  const cles = clesDeContenu(sha, { cwd })
  const salis = perimetreSale({ cwd })
  const sale = salis.length > 0
  const contenu = {
    gate,
    cleTree: cles.cleTree,
    cleComplete: cles.cleComplete,
    sha,
    date,
    salis,
    ...(capture ? { capture } : {}),
  }
  const dossier = join(cheminJustificatifs({ cwd, fs }), cles.cleTree)
  fs.mkdirSync(dossier, { recursive: true })
  const fichier = join(dossier, fichierDeJustificatif({ gate, cle: cleGouvernante(gate, cles), sale }))
  const temporaire = `${fichier}.${process.pid}.en-cours`
  fs.writeFileSync(temporaire, `${JSON.stringify(contenu, null, 2)}\n`)
  fs.renameSync(temporaire, fichier)
  return { fichier, cleTree: cles.cleTree, cleComplete: cles.cleComplete, salis }
}

/**
 * Passe le magasin de l'ancienne graphie (`<segment>.json`, un fichier par gate) à la courante
 * (`<segment>.<cle>.<propre|sale>.json`). Tout est DANS le contenu — `gate`, `cleTree`,
 * `cleComplete`, `sale` — donc le renommage se calcule sans git. Un contenu au statut non vert est
 * EFFACÉ (un justificatif n'existe qu'au vert), un contenu illisible ou sans ses deux clés est
 * laissé en place et DIT. Idempotente : sur un magasin déjà migré, rien ne bouge. Le magasin est
 * partagé par tous les worktrees, et rien d'autre que les `.json` d'un dossier de clé n'est touché
 * (`derogations.log`, à la racine, est hors d'atteinte). REND `{ renommes, effaces, illisibles }`.
 */
export function migrerAncienneGraphie({
  cwd = process.cwd(),
  fs = FS,
  journal = (texte) => process.stderr.write(texte),
} = {}) {
  const racine = cheminJustificatifs({ cwd, fs })
  const bilan = { renommes: 0, effaces: 0, illisibles: [] }
  for (const dossierCle of fs.readdirSync(racine)) {
    if (!/^[0-9a-f]{40}$/.test(dossierCle)) continue
    const dossier = join(racine, dossierCle)
    for (const nom of fs.readdirSync(dossier)) {
      if (!nom.endsWith('.json') || estFichierDeJustificatif(nom)) continue
      const fichier = join(dossier, nom)
      let contenu
      try {
        contenu = JSON.parse(fs.readFileSync(fichier, 'utf8'))
      } catch {
        bilan.illisibles.push(fichier)
        continue
      }
      if (contenu?.statut && contenu.statut !== 'vert') {
        fs.rmSync(fichier, { force: true })
        bilan.effaces += 1
        continue
      }
      const gate = contenu?.gate ?? decodeURIComponent(nom.slice(0, -'.json'.length))
      if (!contenu?.cleTree || !contenu?.cleComplete) {
        bilan.illisibles.push(fichier)
        continue
      }
      fs.renameSync(
        fichier,
        join(dossier, fichierDeJustificatif({ gate, cle: cleGouvernante(gate, contenu), sale: contenu.sale === true })),
      )
      bilan.renommes += 1
    }
  }
  if (bilan.illisibles.length)
    journal(
      `[justificatif] ${bilan.illisibles.length} justificatif(s) illisible(s), laissé(s) en place :\n` +
        `${bilan.illisibles.map((f) => `  ${f}`).join('\n')}\n`,
    )
  return bilan
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
    'mutant : régénère puis git diff, donc injouable en gate — mais `npm run gates` le joue tel quel AVANT ' +
    'ses lanes et REFUSE si un registre bouge (scripts/gates/toutes.mjs), parce que la suite et `build` ' +
    'appellent tous deux `genAll()` et écriraient les mêmes fichiers en même temps',
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
  const lignes = FS.readFileSync(fichier ?? join(cwd, '.github', 'workflows', 'ci.yml'), 'utf8').split(/\r?\n/)
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
  fermetures:
    'ferme sur GitHub les tickets soldés par la plage POUSSÉE, après un `build` vert : il agit APRÈS ' +
    'la publication et ne mesure rien du contenu — le justifier au push serait circulaire ' +
    '(scripts/ops/fermer-depuis-main.mjs)',
  migrations:
    'rejeu EN PLACE des migrations : le jouer sur un arbre de travail réécrit src/data et src/scenes ' +
    'et rend un verdict faux (#1613) — le hook pre-push le joue sur un EXPORT de la tête ' +
    '(scripts/migrations/replay-head.mjs), et non par justificatif',
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

/**
 * Verdict d'UNE gate : `null` si elle passe, sinon le motif de refus. `autresCles` vient de
 * `justificatifsSousDAutresCles` — il distingue « jamais jouée » de « jouée sur un AUTRE arbre »,
 * et n'est vrai que pour une gate gouvernée par la clé COMPLÈTE.
 */
export function motifDeRefus(vue, { nom, commande }, { autresCles = false } = {}) {
  if (!vue && autresCles)
    return (
      `gate « ${nom} » jouée sur un AUTRE arbre : elle ${RAISON_CLE_COMPLETE[nom]}, et ce contenu-là a ` +
      `changé depuis — la rejouer : ${commande}`
    )
  if (!vue) return `gate « ${nom} » jamais jouée sur ce contenu — la produire : ${commande}`
  if (vue.sale)
    return `gate « ${nom} » jouée sur un arbre SALE (${(vue.salis ?? []).join(' · ')}) — committer, puis rejouer : ${commande}`
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
