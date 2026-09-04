/**
 * Génère docs/reprise-apres-pause.md — runbook de reprise à froid (nouvelle machine, clone frais).
 * La part FACTUELLE (scripts npm et leur contenu, `git config` posés par `postinstall`, hooks Git,
 * hooks de session déclarés dans `.claude/settings.json`, workflows GitHub et leurs déclencheurs,
 * motifs de `.gitignore`, seuil de partage de la suite) est DÉRIVÉE des fichiers réels, fail-fast
 * si l'un disparaît/est renommé ; la part ÉDITORIALE (pourquoi un non-versionné l'est, cadence
 * d'archivage, conseils de vérification) N'EST PAS dérivable — elle vit ICI, en dur, exactement
 * comme les préambules de `scripts/docs/build-sources-vf.mjs`.
 *
 * Patron retenu : « éditorial EN DUR dans le générateur » (build-sources-vf.mjs), et non
 * « éditorial en donnée » (build-donnees.mjs) — il n'existe aucun manifeste de reprise à froid, et
 * en fabriquer un pour six phrases de motivation créerait une source de vérité de plus.
 *
 * Mode --check (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé,
 * exit 1 avec message actionnable si diff — jamais d'écriture en mode --check.
 *
 *   node scripts/docs/build-reprise.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { emitOrCheck } from './lib/jsdocUnion.mjs'
import { repartitionWorkers } from '../test/partition.mjs'

const OUTIL = 'build-reprise'

function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}

// ── Sources FACTUELLES ───────────────────────────────────────────────────────────────────────────

const PKG = JSON.parse(readFileSync('package.json', 'utf8'))

/** Contenu d'un script npm (fail-fast : un script renommé casse ici, pas dans le .md). */
function script(nom) {
  const v = PKG.scripts?.[nom]
  if (!v) abandon(`script npm « ${nom} » absent de package.json (renommé/supprimé ?)`)
  return v
}

/** Chemin qui doit exister sur disque (fail-fast). */
function chemin(p) {
  if (!existsSync(p)) abandon(`chemin « ${p} » introuvable (déplacé/supprimé ?)`)
  return p
}

/** Entrées d'un dossier filtrées par suffixe, triées. */
function entrees(dir, suffixe = '') {
  return readdirSync(chemin(dir))
    .filter((f) => f.endsWith(suffixe))
    .sort()
}

// Clés `git config` posées par `postinstall` — dédupliquées sur leur préfixe `<section>.<nom>`.
const POSTINSTALL = script('postinstall')
const CONFIGS = [...new Set([...POSTINSTALL.matchAll(/git config ([\w.-]+)/g)].map((m) => m[1]))]
if (!CONFIGS.includes('core.hooksPath')) {
  abandon('`postinstall` ne pose plus `core.hooksPath` — le runbook de reprise repose dessus')
}
const DRIVERS_FUSION = CONFIGS.filter((c) => c.startsWith('merge.') && c.endsWith('.driver')).map((c) =>
  c.slice('merge.'.length, -'.driver'.length),
)

// Hooks Git : les fichiers SANS extension sont ceux que git invoque par nom. La liste est DÉRIVÉE du
// dossier — un hook posé ou retiré change le runbook sans qu'on touche à ce script. Ce qui est exigé,
// c'est qu'il y en ait, et que `pre-commit` (le seul qui puisse REFUSER un commit) en soit.
const HOOKS_GIT = entrees('scripts/git-hooks').filter((f) => !f.includes('.'))
if (!HOOKS_GIT.includes('pre-commit')) abandon('hook Git « pre-commit » absent de scripts/git-hooks/')

// Hooks de session Claude Code déclarés dans `.claude/settings.json` (versionné).
const SETTINGS = JSON.parse(readFileSync(chemin('.claude/settings.json'), 'utf8'))

function hooksDeSession(evenement) {
  const groupes = SETTINGS.hooks?.[evenement]
  if (!Array.isArray(groupes) || !groupes.length) {
    abandon(`.claude/settings.json ne déclare plus d'événement « ${evenement} »`)
  }
  return groupes.flatMap((g) =>
    (g.hooks ?? []).map((h) => {
      const s = (h.command ?? '').match(/scripts\/hooks\/[\w.-]+\.mjs/)
      if (!s) abandon(`hook « ${evenement} » sans script scripts/hooks/*.mjs : ${h.command}`)
      chemin(s[0])
      return { matcher: g.matcher ?? '(tous)', script: s[0], role: h.statusMessage ?? '' }
    }),
  )
}

const EVENEMENTS = ['PreToolUse', 'PostToolUse', 'SessionStart']

// Workflows GitHub Actions : nom, déclencheurs, portes npm exécutées.
function bloc(texte, cle) {
  const lignes = texte.split('\n')
  const debut = lignes.findIndex((l) => l.startsWith(`${cle}:`))
  if (debut === -1) return []
  const suite = []
  for (const l of lignes.slice(debut + 1)) {
    if (l.trim() === '') continue
    if (!/^\s/.test(l)) break
    suite.push(l)
  }
  return suite
}

/** Corps SHELL de chaque étape `run:` d'un workflow — valeur inline OU bloc scalaire (`run: |`).
 *  Une porte npm posée dans un bloc multi-ligne est aussi réelle qu'une inline : ne lire que la forme
 *  inline faisait sous-compter les portes du runbook. */
function corpsRun(texte) {
  const lignes = texte.split('\n')
  const corps = []
  for (let i = 0; i < lignes.length; i += 1) {
    const m = lignes[i].match(/^(\s*)(-\s+)?run:(.*)$/)
    if (!m) continue
    const indentCle = m[1].length + (m[2] ? m[2].length : 0)
    const valeur = m[3].trim()
    if (valeur && !/^[|>][-+\d]*$/.test(valeur)) {
      corps.push(valeur)
      continue
    }
    for (let j = i + 1; j < lignes.length; j += 1) {
      if (lignes[j].trim() === '') continue
      const indent = lignes[j].length - lignes[j].trimStart().length
      if (indent <= indentCle) break
      corps.push(lignes[j].trim())
    }
  }
  return corps
}

/** Une invocation `npm` COMPLÈTE : sous-projet (`--prefix <dir>`) optionnel, verbe
 *  (`ci`/`install`/`test`/`audit`/`run <script>`), options longues comprises. */
const NPM = /\bnpm\s+(?:--prefix\s+\S+\s+)?(?:ci|install|test|audit|run\s+[\w:-]+)(?:\s+--[\w-]+(?:=\S+)?)*/g

/** Portes `npm` d'un workflow, dédupliquées dans l'ordre de première apparition. Fail-fast : une
 *  occurrence du mot `npm` que `NPM` ne capture pas est une forme inconnue — le compte mentirait. */
function portesNpm(fichier, texte) {
  const portes = []
  for (const ligne of corpsRun(texte)) {
    if (ligne.startsWith('#')) continue
    const vues = [...ligne.matchAll(NPM)].map((m) => m[0].replace(/\s+/g, ' '))
    const mots = (ligne.match(/\bnpm\b/g) ?? []).length
    if (vues.length !== mots) {
      abandon(
        `.github/workflows/${fichier} : forme d'invocation npm non reconnue — « ${ligne} » (${mots} occurrence(s) de \`npm\`, ${vues.length} capturée(s)). Étendre le motif \`NPM\` de ce script plutôt que laisser le runbook sous-compter ses portes.`,
      )
    }
    for (const v of vues) if (!portes.includes(v)) portes.push(v)
  }
  return portes
}

const WORKFLOWS = entrees('.github/workflows', '.yml').map((f) => {
  const texte = readFileSync(`.github/workflows/${f}`, 'utf8')
  const nom = (texte.match(/^name:\s*(.+)$/m) ?? [])[1]
  if (!nom) abandon(`.github/workflows/${f} n'a pas de champ « name: »`)
  const declencheurs = bloc(texte, 'on')
    .filter((l) => /^ {2}\S/.test(l))
    .map((l) => l.trim().replace(/:$/, ''))
  const crons = [...texte.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1])
  const portes = portesNpm(f, texte)
  return { fichier: f, nom, declencheurs, crons, portes }
})

function workflow(fichier) {
  const w = WORKFLOWS.find((x) => x.fichier === fichier)
  if (!w) abandon(`.github/workflows/${fichier} introuvable (renommé/supprimé ?)`)
  return w
}

// Motifs de `.gitignore` — le tableau des non-versionnés est keyé dessus (fail-fast si un motif
// disparaît : le runbook cesserait de décrire l'arbre réel).
const IGNORES = readFileSync(chemin('.gitignore'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

function motif(m) {
  if (!IGNORES.includes(m)) abandon(`motif « ${m} » absent de .gitignore (le runbook le décrit encore)`)
  return m
}

// Seuil de partage de la suite — DÉRIVÉ de la logique pure du lanceur, jamais recopié.
function seuilPartage() {
  for (let n = 1; n <= 256; n += 1) if (repartitionWorkers(n).split) return n
  abandon('scripts/test/partition.mjs ne partage jamais la suite — seuil indérivable')
}

const SEUIL = seuilPartage()

// Comptes d'inventaire du clone.
const NB_GUARD_LIBS = entrees('scripts/guards/lib', '.mjs').length
const NB_HOOKS_SESSION = entrees('scripts/hooks', '.mjs').filter((f) => !f.endsWith('.test.mjs')).length
const NB_DEFS = entrees('src/data/schemas/defs', '.ts').length
const NB_DEFS_SCENES = entrees('src/data/schemas/defs-scenes', '.ts').length
const NB_DATA_JSON = entrees('src/data', '.json').length
const ART_REF = entrees('scripts/art-ref', '.py')
const DECISIONS = entrees('docs/decisions')

const CANARI = workflow('canari.yml')
const CI = workflow('ci.yml')
const DEPLOY = workflow('deploy.yml')
const EXPORT = workflow('export-issues.yml')

const listeCode = (xs) => xs.map((x) => `\`${x}\``).join(', ')

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

/** Familles de mécanismes posés par `postinstall` : le PRÉDICAT est dérivé des clés `git config`
 *  réellement posées, le texte est ÉDITORIAL. Une clé sans famille déclarée casse ici, nominativement
 *  — plutôt qu'un compte en dur qui mentirait au premier réglage ajouté. */
const FAMILLES_POSTINSTALL = [
  {
    porte: (c) => c === 'core.hooksPath',
    texte: () =>
      `\`core.hooksPath\` → \`scripts/git-hooks\` : les hooks ${listeCode(HOOKS_GIT)} ne tournent plus. Le
   \`pre-commit\` porte les gardes anti-poison/anti-dérive de chaque commit ; \`post-merge\` et
   \`post-rewrite\` régénèrent les docs dérivés après une fusion ou un rebase. Le PALIER de revue
   adversariale se mesure sur l'histoire au moment du commit (\`scripts/guards/lib/revuePalier.mjs\`),
   et la fermeture des issues suit la PUBLICATION : job \`fermetures\` de \`.github/workflows/ci.yml\`
   après un \`build\` vert sur \`main\`, qui joue \`${script('ops:fermer')} <before>..<sha>\`.`,
  },
  {
    porte: (c) => /^merge\..+\.(?:driver|name)$/.test(c),
    texte: () =>
      `Les pilotes de fusion des docs dérivés (${listeCode(DRIVERS_FUSION)}), déclarés par
   \`.gitattributes\` et servis par \`scripts/git-hooks/merge-docs.mjs\` : sans eux, chaque rebase
   rouvre un conflit sur des fichiers que \`npm run docs:build\` régénère seul.`,
  },
]
for (const c of CONFIGS) {
  if (!FAMILLES_POSTINSTALL.some((f) => f.porte(c))) {
    abandon(
      `clé \`git config ${c}\` posée par postinstall sans famille déclarée dans ce script — la classer dans \`FAMILLES_POSTINSTALL\` avant que le runbook n'annonce un compte faux`,
    )
  }
}
const FAMILLES = FAMILLES_POSTINSTALL.filter((f) => CONFIGS.some(f.porte))
const lignesFamilles = FAMILLES.map((f, i) => `${i + 1}. ${f.texte()}`).join('\n')

/** Une porte vise le sous-projet `server/` sous DEUX formes : l'invocation directe
 *  (`npm --prefix server ci`) et le script racine qui la délègue (`npm run server:<x>` — package.json
 *  `server:typecheck` = `npm --prefix server run typecheck`). Ne lire que la première faisait
 *  sous-compter le bucket, qui annonçait alors 1 porte là où le canari en joue deux. */
const VISE_SERVEUR = /--prefix\s+server\b|\brun\s+server:/
const PORTES_SERVEUR = CANARI.portes.filter((p) => VISE_SERVEUR.test(p))

const lignesHooksSession = EVENEMENTS.flatMap((e) =>
  hooksDeSession(e).map(
    (h) => `| \`${e}\` | ${h.matcher.replaceAll('|', ' \\| ')} | \`${h.script}\` | ${h.role} |`,
  ),
).join('\n')

const lignesWorkflows = WORKFLOWS.map(
  (w) =>
    `| \`.github/workflows/${w.fichier}\` | ${w.nom} | ${w.declencheurs.join(', ')}${
      w.crons.length ? ` (cron \`${w.crons.join('`, `')}\`)` : ''
    } |`,
).join('\n')

/** Non-versionnés : motif de `.gitignore` (DÉRIVÉ) × pourquoi/regénération (ÉDITORIAL). */
const NON_VERSIONNES = [
  {
    quoi: `PDFs de \`Source/*.pdf\` (\`${motif('*.pdf')}\`)`,
    pourquoi: 'droits Cubicle 7, taille (limite GitHub 100 Mo/fichier)',
    acces:
      'conservés LOCALEMENT ; ré-extraction via `bash scripts/raw/reextract-all.sh` (Marker, staging `Source/_marker/split/`, **ne promeut pas** — revue manuelle avant d\'écraser `Source/`)',
  },
  {
    quoi: `Staging Marker (\`${motif('Source/_marker/')}\`)`,
    pourquoi: 'intermédiaire de pipeline ; seuls les chapitres curés `Source/<Livre>/NN - *.md` sont committés',
    acces: 'régénéré par le pipeline `scripts/raw/marker-*`',
  },
  {
    quoi: `Images extraites des PDF (\`${motif('/art-ref/')}\`)`,
    pourquoi: 'droits Cubicle 7, ce sont des sorties ; le pipeline lui-même reste tracké sous `scripts/art-ref/`',
    acces: `régénérables via ${listeCode(ART_REF.map((f) => `scripts/art-ref/${f}`))} + les PDFs locaux`,
  },
  {
    quoi: `Sorties de QC (\`${motif('public/qc/*')}\`)`,
    pourquoi: 'planches de revue régénérables — pas du source',
    acces: `régénérables par les scripts \`scripts/qc/\` ; l'exception \`${motif('!public/qc/baseline-affine/')}\` reste VERSIONNÉE`,
  },
  {
    quoi: `Réglages Claude Code personnels (\`${motif('.claude/*')}\`)`,
    pourquoi: 'environnement local',
    acces: `exceptions VERSIONNÉES : ${listeCode(
      IGNORES.filter((l) => l.startsWith('!.claude/')).map((l) => l.slice(1)),
    )}`,
  },
]

const lignesNonVersionnes = NON_VERSIONNES.map((n) => `| ${n.quoi} | ${n.pourquoi} | ${n.acces} |`).join('\n')

const out = `# Reprise après pause

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-reprise.mjs\` (\`npm run docs:reprise\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — la part FACTUELLE est lue aux fichiers réels : scripts npm et
leur contenu (\`package.json\`), clés \`git config\` posées par \`postinstall\`, hooks Git présents sous
\`scripts/git-hooks/\`, hooks de session déclarés dans \`.claude/settings.json\`, workflows de
\`.github/workflows/\` (nom, déclencheurs, portes \`npm\` exécutées — lues aux corps \`run:\`, forme
inline ET blocs \`run: |\`, \`--prefix\` et \`audit\`/\`ci\` compris ; une forme d'invocation npm inconnue
y fait ÉCHOUER le script plutôt que sous-compter), motifs de \`.gitignore\`, seuil de
partage de la suite calculé sur \`repartitionWorkers\` (\`scripts/test/partition.mjs\`). Un renommage
casse ce script au lieu de laisser le \`.md\` mentir. **Angles morts** : ce runbook ne mesure PAS
l'état de la machine (auth \`gh\`, PDFs présents, compte Cloudflare) — il dit où ça vit, pas si c'est
là ; une invocation \`npm\` posée AILLEURS que dans un corps \`run:\` (action composite \`uses:\`, script
appelé par une étape) reste hors mesure ; les motivations (« pourquoi ce fichier n'est pas versionné »), la cadence d'archivage et les
conseils de vérification sont de l'ÉDITORIAL fixé dans le script, non re-dérivé à chaque run ; les
secrets d'Actions ne sont pas lisibles depuis le dépôt (leur nom seul est cité).

Référence vivante : que faire pour repartir de zéro (nouvelle machine, clone frais) après une
longue pause. Chaque chemin/symbole cité existe dans le repo — vérifié via \`npm run docs:check\`.

## 1. Redémarrage code (clone nu → jeu qui tourne)

\`\`\`bash
git clone <url> && cd Game
npm install     # pose ${CONFIGS.length} réglages git (script "postinstall" de package.json)
npm test        # suite du moteur — deux processus Vitest (node + jsdom) si ≥ ${SEUIL} cœurs, sinon un seul
npm run dev     # http://localhost:5173 (un CLONE garde le port historique)
\`\`\`

Le port n'est historique QUE pour un arbre principal ou un clone : un **worktree lié** en dérive un
autre (5174-5272, \`scripts/port-dev.mjs\`) pour que deux arbres servis en même temps ne se recouvrent
jamais. \`npm run dev\` imprime celui qu'il sert.

\`npm install\` déclenche le script \`postinstall\`, qui pose : ${listeCode(CONFIGS)}.

**Sans ce postinstall, ${FAMILLES.length} familles de mécanismes sont MORTES.**

${lignesFamilles}

Le partage de la suite (\`${script('test')}\`) est décidé par \`repartitionWorkers\` : en dessous de
${SEUIL} cœurs, un seul processus Vitest ; au-delà, un processus \`node\` et un processus \`jsdom\`. La
variable d'environnement \`WFRP_TEST_COEURS\` force ce nombre (seule façon de jouer l'autre chemin sur
une machine quelconque).

\`src/data/*.json\` (${NB_DATA_JSON} fichiers) est la **SOURCE app-owned** : rien à régénérer après le clone.

Le canari (\`.github/workflows/canari.yml\`, ${CANARI.declencheurs.join(' + ')}, cron
\`${CANARI.crons.join('`, `')}\`) rejoue exactement ce chemin en CI, sur un runner propre, en
${CANARI.portes.length} portes :

${CANARI.portes.map((p) => `- \`${p}\``).join('\n')}

${
  PORTES_SERVEUR.length
    ? `Dont ${PORTES_SERVEUR.length} porte${PORTES_SERVEUR.length > 1 ? 's' : ''} sur le sous-projet \`server/\` (relay coop) :
${listeCode(PORTES_SERVEUR)} — son \`node_modules\` et son typecheck sont indépendants de ceux de la
racine, un clone frais doit les poser AUSSI.

`
    : ''
}Son step de résumé poste le rapport en commentaire sur l'issue \`canari\` la plus ANCIENNE encore
ouverte — il n'en crée une que s'il n'y en a aucune, et la FERME quand toutes les mesures sont vertes.
C'est le signal qu'un geste manuel a dévié de ce que \`npm install\` pose seul.

## 2. Ce que le clone CONTIENT

- \`${chemin('Source')}/\` — texte des livres en \`.md\`, **citable** (réfs \`LDB <chap> l.<ligne>\`).
- \`src/data/\` — données app-owned (${NB_DATA_JSON} fichiers JSON commités, éditables au Compendium).
- Les gardes de données : \`${chemin('scripts/guards/validate-data.mts')}\` + ${NB_GUARD_LIBS} modules
  sous \`scripts/guards/lib/\` (dont \`scripts/guards/lib/commentPoison.mjs\`,
  \`scripts/guards/lib/emojiAffordance.mjs\`, \`scripts/guards/lib/hardcode.mjs\`,
  \`scripts/guards/lib/labelLogic.mjs\`).
- Les gardes de SESSION : ${NB_HOOKS_SESSION} scripts sous \`scripts/hooks/\`, déclarés dans
  \`.claude/settings.json\` (versionné) — détail au § 5.
- Les schémas de données : \`src/data/schemas/\` (\`src/data/schemas/types.ts\`,
  \`src/data/schemas/validate.ts\`, \`src/data/schemas/_registry.generated.ts\`,
  \`src/data/schemas/_ids.generated.ts\`, \`src/data/schemas/grammaire/\` — le vocabulaire partagé —
  \`src/data/schemas/defs/\` : ${NB_DEFS} fichiers, un par catalogue, et
  \`src/data/schemas/defs-scenes/\` : ${NB_DEFS_SCENES} fichiers pour les documents de scène).
- \`scripts/art-ref/\` — le PIPELINE d'extraction d'images (${listeCode(ART_REF)}) : le code est
  tracké, ses SORTIES (images) ne le sont pas (§ 3).
- \`docs/decisions/\` (${listeCode(DECISIONS)}) — les issues GitHub EXPORTÉES par
  \`.github/workflows/export-issues.yml\` (${EXPORT.declencheurs.join(' + ')}, cron
  \`${EXPORT.crons.join('`, `')}\`) via \`${script('issues:export')}\`, commit auto si diff.

## 3. Ce que le clone NE contient PAS — et où ça vit

| Non-versionné | Pourquoi (\`.gitignore\`) | Régénération / accès |
|---|---|---|
${lignesNonVersionnes}

Ne sont pas non plus dans le clone, parce que ce ne sont pas des fichiers :

- **Compte Cloudflare du relay coop** — URL de prod dans \`src/net/relay.ts\` (\`RELAY_URL_PROD\`) ;
  redéployable via \`npm run relay:deploy\` (\`${script('relay:deploy')}\`).
- **Publication du jeu en prod** — workflow \`.github/workflows/deploy.yml\` (« ${DEPLOY.nom} »,
  ${DEPLOY.declencheurs.join(', ')}) ; il build le COMMIT de \`main\` sur un runner propre. Secret
  Actions \`PROD_DEPLOY_KEY\` (deploy key SSH) requis côté dépôt ; aucun clone local du dépôt prod
  nécessaire.
- **Auth \`gh\` (CLI GitHub)** — credentials locales, nécessaires aux commandes \`gh\` manuelles et aux
  gestes \`ops:*\` joués à la main (\`${script('ops:fermer')}\`, \`${script('ops:fermetures-non-citees')}\`).
  La fermeture des issues tourne en CI (job \`fermetures\`, \`GITHUB_TOKEN\`), comme l'export hebdomadaire.

## 4. Archivage des non-versionnés

Cadence recommandée : **à chaque nouveau livre importé** (PDF + art-ref associé), archiver vers
un stockage externe (l'utilisateur y consolide déjà les PDFs sources).

\`\`\`powershell
Compress-Archive -Path "Source\\*.pdf","art-ref" -DestinationPath "<stockage-externe>\\game-sources-$(Get-Date -Format yyyy-MM-dd).zip"
\`\`\`

Adapter \`<stockage-externe>\` (disque externe, cloud perso) — cette commande ne fait QUE lire
les non-versionnés locaux, elle ne touche pas au repo.

## 5. Portes de qualité — où elles vivent, comment vérifier qu'elles tournent

**Hooks Git locaux** (${listeCode(HOOKS_GIT)}) : posés par \`npm install\` via \`core.hooksPath\`.
Vérifier : \`git config core.hooksPath\` doit répondre \`scripts/git-hooks\`. Si vide → hooks MORTS,
refaire \`npm install\`.

**Hooks de session Claude Code** (gardes anti-dérive à l'écriture), déclarés dans
\`.claude/settings.json\` :

| Événement | Déclencheur (matcher) | Script | Rôle |
|---|---|---|---|
${lignesHooksSession}

**CI GitHub Actions** :

| Fichier | Nom | Déclencheurs |
|---|---|---|
${lignesWorkflows}

Vérifier qu'elles tournent : onglet Actions du dépôt, ou \`gh run list --workflow=canari.yml\`. La
porte à chaque push est \`.github/workflows/ci.yml\` (« ${CI.nom} », ${CI.declencheurs.join(', ')}).
`

emitOrCheck({
  out,
  path: 'docs/reprise-apres-pause.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:reprise — docs/reprise-apres-pause.md est PÉRIMÉ (diverge de package.json, .gitignore, .claude/settings.json, .github/workflows/, scripts/git-hooks/ ou du script).',
  rerunMsg: '  → relancer `npm run docs:reprise` et committer le résultat.',
  okMsg: 'docs:reprise — OK (docs/reprise-apres-pause.md à jour)',
  writeMsg: `docs/reprise-apres-pause.md — ${WORKFLOWS.length} workflows, ${HOOKS_GIT.length} hooks Git, ${NB_HOOKS_SESSION} gardes de session référencés.`,
})
