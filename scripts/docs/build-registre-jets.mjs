// REGISTRE des chemins de jet — GÉNÉRÉ depuis le module de gardes `scripts/guards/lib/rollSeam*.mjs`
// (jamais une recopie à la main). Sortie : docs/registre-jets.md. Re-run :
// node scripts/docs/build-registre-jets.mjs (npm run docs:registre-jets). Mode --check (chaîné dans
// npm run docs:check) : régénère en mémoire, compare au .md committé, exit 1 si diff.
//
// SOURCE UNIQUE : les listes (familles canoniques, stocks + justifications) vivent dans
// `rollSeamWhitelist.mjs` et sont VÉRIFIÉES par `src/state/roll-seam-exclusivity-guard.test.ts` ;
// les comptes affichés ici sont RE-MESURÉS par les mêmes scanners (`rollSeamExclusivity.mjs`) — un
// compte de la doc ne peut pas diverger du compte du garde, il n'y a qu'un seul comptage.
//
// Pourquoi ce fichier (#1066) : l'inventaire du 2026-08-04 a mesuré des Tests résolus HORS de tout
// registre — un pending de jet monté à la main au call-site, et un helper de `src/engine` qui roule
// pour le compte d'un flux (`resolveClash` → `rollMightTest` → `rollTest`). Ce registre FIGE la
// population avant que les lots de re-routage la fassent bouger.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emitOrCheck } from './lib/jsdocUnion.mjs'
import {
  scanPendingJetFabrication, engineRollerExports, scanEngineDelegatedRoll,
} from '../guards/lib/rollSeamExclusivity.mjs'
import {
  ROLL_SEAM_CORE, ROLL_SEAM_PHASE2_STOCK,
  PENDING_JET_FABRICATION_STOCK, ENGINE_DELEGATED_ROLL_STOCK, SEAM_CALLERS,
} from '../guards/lib/rollSeamWhitelist.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const OUT = join(ROOT, 'docs/registre-jets.md')
const TOOL = 'build-registre-jets'
const check = process.argv.includes('--check')

/** Fichiers de PRODUCTION (hors tests) d'un dossier, en chemin relatif POSIX. */
function prodFiles(...dirs) {
  const out = []
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e)) {
        const rel = relative(ROOT, p).split('\\').join('/')
        if (!/\.test\.[tj]sx?$/.test(rel)) out.push({ rel, text: readFileSync(p, 'utf8') })
      }
    }
  }
  for (const d of dirs) walk(join(ROOT, d))
  return out
}

// --- (F) fabrication d'un pending de jet -----------------------------------------------------
const fabrication = new Map()
for (const { rel, text } of prodFiles('src')) {
  if (ROLL_SEAM_CORE.has(rel)) continue
  const sites = scanPendingJetFabrication(rel, text)
  if (sites.length) fabrication.set(rel, sites)
}

// --- (D) roulage délégué à un export de src/engine -------------------------------------------
const rollers = engineRollerExports(prodFiles('src/engine'))
const rollerNames = new Set(rollers.keys())
const delegue = new Map()
for (const { rel, text } of prodFiles('src/state', 'src/ui')) {
  if (ROLL_SEAM_CORE.has(rel)) continue
  const sites = scanEngineDelegatedRoll(rel, text, rollerNames)
  if (sites.length) delegue.set(rel, sites)
}

// --- population AUTHORÉE (donnée, pas code) ---------------------------------------------------
// Nœuds `test` des Flows authorés de src/data/spells.json : le champ `test` d'un pas d'effet
// (`FlowTest` — engine/flowCore.ts). Ils ne sont PAS un stock : c'est de la donnée, dont le chemin de
// résolution est unique et vérifié ci-dessous.
const spells = JSON.parse(readFileSync(join(ROOT, 'src/data/spells.json'), 'utf8'))
let authoredTests = 0
const countTests = (o) => {
  if (!o || typeof o !== 'object') return
  if (!Array.isArray(o) && o.test !== undefined) authoredTests++
  for (const k of Object.keys(o)) countTests(o[k])
}
countTests(spells)

// Les DEUX routeurs qui résolvent un nœud `test` de Flow — mesurés, pas supposés.
const ROUTEURS_AUTHORES = [
  ['resolveFlowTest', 'src/state/combat/triggeredTest.ts', 'voie CADENCE-AWARE : ouvre `openSkillTest` (modale influençable) quand l\'acteur est piloté.'],
  ['resolveInlineFlowTest', 'src/state/triggeredEffects.ts', 'jumeau store-free de la branche NON-interactive du précédent (jet résolu inline, journalisé).'],
]
const routeursManquants = ROUTEURS_AUTHORES.filter(([name, file]) =>
  !new RegExp(`function\\s+${name}\\b`).test(readFileSync(join(ROOT, file), 'utf8')))
if (routeursManquants.length) {
  console.error(`${TOOL} — routeur de nœud \`test\` authoré introuvable (la thèse « tout nœud test passe par ces routeurs » n'est plus mesurable) :`)
  for (const [n, f] of routeursManquants) console.error(`  ${n} (${f})`)
  process.exit(1)
}

// --- garde de génération : les stocks déclarés doivent COUVRIR la mesure --------------------------
const couverture = []
for (const [label, stock, mesure] of [
  ['(F) fabrication', PENDING_JET_FABRICATION_STOCK, fabrication],
  ['(D) délégué moteur', ENGINE_DELEGATED_ROLL_STOCK, delegue],
]) {
  for (const [rel, sites] of mesure) {
    const dec = stock.get(rel)
    if (!dec) couverture.push(`${label} — ${rel} : ${sites.length} site(s) HORS registre`)
    else if (dec.n !== sites.length) couverture.push(`${label} — ${rel} : ${sites.length} mesuré(s), ${dec.n} déclaré(s)`)
  }
  for (const [rel, dec] of stock) {
    if (!mesure.has(rel)) couverture.push(`${label} — ${rel} : entrée PÉRIMÉE (0 site mesuré, ${dec.n} déclaré)`)
    if (!dec.why?.trim()) couverture.push(`${label} — ${rel} : entrée SANS justification`)
    if (!['dette', 'tri', 'canonique', 'mixte'].includes(dec.kind)) couverture.push(`${label} — ${rel} : kind « ${dec.kind} » inconnu`)
  }
}
if (couverture.length) {
  console.error(`${TOOL} — registre désynchronisé (scripts/guards/lib/rollSeamWhitelist.mjs) :`)
  for (const l of couverture) console.error(`  ${l}`)
  process.exit(1)
}

// --- rendu -------------------------------------------------------------------------------------
const esc = (s) => (s ?? '—').split('|').join('\\|')
const total = (m) => [...m.values()].reduce((n, v) => n + v.length, 0)

/** Répartition des SITES par nature d'entrée — c'est elle qui dit ce qui doit tomber à zéro. */
function parNature(stock) {
  const par = new Map()
  for (const [, dec] of stock) par.set(dec.kind, (par.get(dec.kind) ?? 0) + dec.n)
  return [...par].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`).join(', ')
}

let out = `# Registre des chemins de jet — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-registre-jets.mjs\` (\`npm run docs:registre-jets\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source : le module de gardes \`scripts/guards/lib/rollSeamWhitelist.mjs\` (listes + justifications) et\n`
out += `> \`scripts/guards/lib/rollSeamExclusivity.mjs\` (scanners AST). Les comptes ci-dessous sont ceux du garde\n`
out += `> \`src/state/roll-seam-exclusivity-guard.test.ts\` — un seul comptage, jamais deux.\n\n`

out += `## À quoi ça sert\n\n`
out += `Répondre à « **par où passe ce jet ?** » sans relire les flux. Trois populations coexistent :\n`
out += `les familles CANONIQUES d'ouverture (un jet décrit à une porte), et deux populations de DETTE que\n`
out += `les gardes d'exclusivité laissaient passer par construction — un pending de jet monté à la main au\n`
out += `call-site, et un roulage délégué à un export de \`src/engine\`. Ce registre les FIGE : un site de plus,\n`
out += `une entrée devenue vide ou une entrée sans justification échouent la garde.\n\n`

out += `## Périmètre mesuré et angles morts (à dire pour ne pas se lire comme exhaustif)\n\n`
out += `- **(F)** ne voit qu'un **littéral d'objet** : un pending assemblé par spread depuis un helper, ou monté champ\n`
out += `  par champ, échappe. La conjonction \`skillValue\` + (\`target\` \\| \`roll: null\`) est un resserrement DÉLIBÉRÉ —\n`
out += `  \`skillValue:\` seul remonte 200+ faux positifs (types, paramètres de résolveur, patches de champ).\n`
out += `- **(D)** résout par **nom appelé**, sans suivi de liaison : un import renommé (\`import { resolveClash as x }\`)\n`
out += `  ou un appel indirect (référence passée en callback) échappe. Même angle mort que le garde d'exclusivité.\n`
out += `- **(D)** indexe les fonctions de \`src/engine\` par nom **à plat** : deux homonymes dans deux modules se\n`
out += `  confondent, et un homonyme local d'un rouleur peut faire entrer un export au titre de la transitivité.\n`
out += `- **(D)** ne scanne que \`src/state\` et \`src/ui\` (les consommateurs de flux) ; **(F)** scanne tout \`src\`.\n`
out += `- **Un tirage qui n'appelle ni \`rollTest\` ni \`d100\` n'est vu par AUCUN des trois scanners** — ex. le \`d10\` de\n`
out += `  \`massBattleFlow.ts:834\` (\`massBattleSetHazard\`, facteur environnemental du Round, \`ADE II 8 l.309\`) : un jet du\n`
out += `  RAW résolu en silence, hors de tout registre. Le surfaçage vit sur #1067, qui le nomme déjà.\n`
out += `- Les formes **(S)** « position de spec » et **(M)** « dé de monde » restent des exclusions par FORME du garde\n`
out += `  d'exclusivité (critères et angles morts : en-tête de \`scripts/guards/lib/rollSeamExclusivity.mjs\`).\n`
out += `- La population authorée ne compte que \`src/data/spells.json\` — les autres porteurs de \`FlowTest\` (traits,\n`
out += `  talents, États, consommables) ne sont pas dénombrés ici.\n`
out += `- Les **justifications** sont écrites à la main : ce sont des engagements, pas des mesures. Le registre garantit\n`
out += `  qu'elles EXISTENT et que les comptes sont exacts, pas qu'elles disent vrai.\n\n`

// --- familles canoniques ---
out += `## Familles CANONIQUES d'ouverture de jet\n\n`
out += `| Famille | Site | Exportée | Rôle |\n|---|---|---|---|\n`
for (const c of SEAM_CALLERS) {
  out += `| \`${c.name}\` | \`${c.file}\` | ${c.exported ? 'oui' : '**non** (module-locale)'} | ${esc(c.role)} |\n`
}
out += `\n_${SEAM_CALLERS.length} familles énumérées — chacune VÉRIFIÉE (le symbole existe, à ce fichier, avec ce statut d'export)._\n\n`

// --- (F) ---
out += `## (F) Fabrication d'un pending de jet au call-site\n\n`
out += `Signature AST discriminante : un littéral d'objet portant \`skillValue:\` **et** (\`target:\` **ou** \`roll: null\`)\n`
out += `— l'objet décrit DÉJÀ la cible du jet ou son emplacement de dé vide, donc un jet décrit hors de la porte.\n`
out += `Le roulage, lui, arrive plus tard et passe par le seam : rien ne le signalait. Les fichiers du noyau du\n`
out += `seam (\`ROLL_SEAM_CORE\`) sont hors périmètre — leur pending EST le foyer.\n\n`
out += `| Fichier | Sites | Nature | Lignes | Justification |\n|---|---|---|---|---|\n`
for (const [rel, dec] of PENDING_JET_FABRICATION_STOCK) {
  out += `| \`${rel}\` | ${dec.n} | ${dec.kind} | ${fabrication.get(rel).map((s) => s.line).join(', ')} | ${esc(dec.why)} |\n`
}
out += `\n_${total(fabrication)} sites mesurés dans ${fabrication.size} fichiers — par nature : ${parNature(PENDING_JET_FABRICATION_STOCK)}._\n\n`

// --- (D) ---
out += `## (D) Roulage délégué à un export de \`src/engine\`\n\n`
out += `\`rollSeamExcluded\` exempte \`src/engine/**\` de principe (le moteur reçoit un rng, il ne décide pas du\n`
out += `surfaçage) — ce qui suppose que l'APPELANT passe par le seam. Un export d'engine qui roule, appelé par un\n`
out += `flux, rend donc le call-site invisible aux deux gardes. La liste des rouleurs est **dérivée** (corps appelant\n`
out += `\`rollTest\`/\`d100\`, puis clôture TRANSITIVE — sans elle, \`resolveClash\` (qui ne roule qu'à travers\n`
out += `\`rollMightTest\`) reste invisible), \`rollTest\`/\`d100\` eux-mêmes exclus (population du garde d'exclusivité).\n`
out += `La forme (S) « position de spec » garde son exclusion structurelle.\n\n`
out += `| Fichier | Sites | Nature | Rouleurs appelés | Justification |\n|---|---|---|---|---|\n`
for (const [rel, dec] of ENGINE_DELEGATED_ROLL_STOCK) {
  const noms = [...new Set(delegue.get(rel).map((s) => s.name))].sort()
  out += `| \`${rel}\` | ${dec.n} | ${dec.kind} | ${noms.map((n) => `\`${n}\``).join(', ')} | ${esc(dec.why)} |\n`
}
out += `\n_${total(delegue)} call-sites mesurés dans ${delegue.size} fichiers, pour ${rollers.size} exports rouleurs dérivés de \`src/engine\` — par nature : ${parNature(ENGINE_DELEGATED_ROLL_STOCK)}._\n\n`
out += `> **Nature** (\`kind\`) : \`dette\` = tous les sites doivent disparaître · \`tri\` = population non qualifiée\n`
out += `> (tirage de table légitime ⇄ Test à enjeu silencieux), tri site par site · \`canonique\` = aucun site ne bouge ·\n`
out += `> \`mixte\` = l'entrée porte les deux natures. Sans ce discriminant, « cette liste décroît » ne veut rien dire.\n\n`

// --- population authorée ---
out += `## Population AUTHORÉE (donnée, pas code)\n\n`
out += `**${authoredTests}** nœuds \`test\` (\`FlowTest\`) dans \`src/data/spells.json\`. Ce n'est pas un stock : la donnée\n`
out += `n'a pas de call-site à router. Son chemin de résolution est unique et à DEUX routeurs mesurés :\n\n`
for (const [name, file, role] of ROUTEURS_AUTHORES) out += `- \`${name}\` (\`${file}\`) — ${role}\n`
out += `\nLe premier ouvre \`openSkillTest\` (famille canonique) ; le second est sa branche non-interactive. Un nœud\n`
out += `\`test\` enfoui sans routeur cadence-aware lève (\`resolveInlineFlowTest\` : « un test enfoui exige un routeur\n`
out += `cadence-aware ») — c'est le fail-closed de la donnée.\n\n`

// --- rappel du stock historique ---
out += `## Rappel — stock du garde d'exclusivité (\`rollTest\`/\`d100\`/\`TestOutcome.seal\` bruts)\n\n`
out += `Population historique (#918 phase 2), listée ici pour que le registre soit la vue COMPLÈTE ; sa source\n`
out += `reste \`ROLL_SEAM_PHASE2_STOCK\`. ${[...ROLL_SEAM_PHASE2_STOCK.values()].reduce((a, b) => a + b, 0)} sites dans ${ROLL_SEAM_PHASE2_STOCK.size} fichiers.\n\n`
out += `| Fichier | Sites |\n|---|---|\n`
for (const [rel, n] of ROLL_SEAM_PHASE2_STOCK) out += `| \`${rel}\` | ${n} |\n`
out += `\n`

emitOrCheck({
  out,
  path: OUT,
  check,
  staleMsg: `${TOOL} — docs/registre-jets.md est PÉRIMÉ (le registre ou la population ont bougé).`,
  rerunMsg: 'Régénérer : npm run docs:registre-jets',
  okMsg: `${TOOL} — docs/registre-jets.md à jour`,
  writeMsg: `${TOOL} — docs/registre-jets.md écrit (${total(fabrication)} sites (F), ${total(delegue)} call-sites (D), ${SEAM_CALLERS.length} familles, ${authoredTests} nœuds authorés)`,
})
