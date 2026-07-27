// Rapport des ENTITÉS DE DONNÉES sans consommateur — GÉNÉRÉ. Sortie : docs/orphelines-donnees.md.
// Re-run : node scripts/docs/build-entity-orphans.mjs (npm run docs:orphelines). Mode --check
// (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé, exit 1 si diff —
// jamais d'écriture en mode --check. Corpus/détection PARTAGÉS avec la garde cliquet
// `src/data/entity-orphans.test.ts` : scripts/guards/lib/entityConsumers.mjs.
//
// Objet : la mesure INVERSE des gardes RAW du dépôt (`check-doc-refs.mjs`, `check-refs.mjs`…), qui
// vérifient que ce qui est CITÉ existe. Ici : ce qui EXISTE est-il cité ? « La mécanique est juste,
// le chemin qui y mène est absent » — douze Carrières livrées et inatteignables, un chapitre curé
// sans porte d'accès, une table jamais tirée (#734) sont la MÊME classe de défaut : une entité
// correcte, sans AUCUN consommateur mesuré.
//
// PÉRIMÈTRE MESURÉ — 7 des 10 catalogues `src/data/*.json` adressés par `id` que `id-collisions.test.ts`
// traite comme une famille homogène (`traits`, `talents`, `qualities`, `maneuvers`, `skills`, `props`,
// `vehicles`, cf. `entityConsumers.mjs#CATEGORY_FILES`). 3 catalogues MESURÉS puis ÉCARTÉS :
//   `spells` (576 entrées, 282 « orphelines » brutes = 49 %), `trappings` (440, 215 = 49 %),
//   `creatures` (490, 362 = 74 %) — un taux 8 à 12× celui des 7 catalogues retenus (0–6 %) qui
//   signale un ANGLE MORT STRUCTUREL non résolu, pas une vraie dette à ce volume : ces trois
//   catalogues portent chacun un lookup de repli PAR LABEL (`findSpell(label)`, `findTrappingByLabel`,
//   `findCreature(label)` — src/data/index.ts) que la détection par ID SEUL, ici, ne voit PAS —
//   une entité citée uniquement par son libellé (donnée d'auteur, save de partie) compterait à tort
//   comme orpheline. Réconcilier ces 3 catalogues exige un détecteur id-OU-label dédié ; ce rapport
//   ne le prétend pas et ne les couvre pas. Les ~99 autres `src/data/*.json` (hors ces 10 catalogues)
//   sont HORS PÉRIMÈTRE de ce générateur.
//
// DÉFINITION D'UN CONSOMMATEUR — DEUX modes indépendants, un id compte comme consommé s'il satisfait
// L'UN OU L'AUTRE (détail complet, grammaire, angles morts : en-tête de `entityConsumers.mjs`) :
//
// MODE 1 (id-collisions.test.ts) — l'id de l'entité apparaît comme jeton de chaîne CITÉ complet
// (`"<id>"`/`'<id>'`) dans un AUTRE `src/data/*.json` ou dans `src/**/*.ts(x)` de PRODUCTION (hors
// tests, commentaires retirés). ANGLES MORTS DÉCLARÉS (repris/étendus de `tableConsumerStock.mjs`) :
// (1) un consommateur MORT (code jamais appelé) compte comme réel ; (2) une chaîne de donnée qui vaut
// EXACTEMENT l'id sans être une op de résolution réelle compte à tort comme consommatrice ; (3) un id
// construit par SLUG D'UN AUTRE CHAMP au runtime (patron mesuré dans le dépôt : `findTalent(name)?.id
// ?? slugId(name)` — engine/character.ts, careerSlots.ts, scenes/test-scenarios/*.ts ;
// `traits/dispatch.ts#mutationsAtSpawn` en a le cas connu pour les mutations) échapperait à la
// détection si SEUL le libellé apparaissait ailleurs — vérifié à la main pour les 20 entrées du stock
// initial (ni id NI label cités ailleurs que leur propre déclaration).
//
// MODE 2 (`computeFieldPredicateConsumers`) — sélection dynamique par PRÉDICAT DE CHAMP : du code de
// production filtre le catalogue (`<catalogue>.filter((param) => param.champ === 'valeur'…)`, ex.
// `ui/InterludeScreen.tsx` bâtissant le pool de l'Artisanat) sans jamais citer l'id, et l'entité
// satisfait ce prédicat. Restreint fail-closed à une grammaire d'égalité littérale simple sur
// `Array.prototype.filter` (jamais `.find`/`.some`, jamais négation/optionnel/parenthèses de
// groupement), ET à un résultat EXPLOITÉ PAR ID : la chaîne doit se terminer par
// `.map((param) => param.id)` (jamais `.label` — un filtre qui SÉLECTIONNE sans MENER à l'entité par id
// n'est pas un consommateur, cf. `entityConsumers.mjs` pour le cas mesuré `falseQualities()` REJETÉ).
// Tout filtre hors grammaire est IGNORÉ (l'entrée reste orpheline). Trouvaille mesurée (2026-07) :
// `qualities:laid` est sélectionnée par ses champs `type`/`subType` ET exploitée par id
// (`ui/InterludeScreen.tsx:52-53`) sans jamais être citée littéralement — la définition MODE 1 seule
// la classait à tort en dette.
//
// ENTITÉS MÉTA (`META_CATALOG_ENTRIES`) — une ligne de TABLE RAW transcrite en entrée de catalogue
// pour son vocabulaire de tirage (ex. `talents:talent-aleatoire`, LDB 10 p.132), jamais une entité
// POSSÉDABLE : ni consommateur MODE 1 ni MODE 2 n'a de sens pour elle — traitée comme systématiquement
// consommée, MÊME source que `src/data/obtainability-guard.test.ts` (l'autre garde qui connaît ce
// même fait structurel) : aucune des deux ne re-déclare le fait chez elle.
//
// CE QUE CE RAPPORT NE RÉPOND PAS — il mesure des consommateurs d'ENTITÉ (« qui cite/sélectionne cet
// id »), PAS des consommateurs de CHAMP GÉNÉRIQUE (« qui LIT ce champ sur les entités qui le portent »
// — ex. « qui lit `spec` sur une `TrappingRef` »). Ce sont deux instruments distincts : celui-ci ne
// peut pas remplacer une recherche `ctx_search`/AST ciblée sur un champ précis.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { emitOrCheck } from './lib/jsdocUnion.mjs'
import {
  CATEGORY_FILES, loadCategoryIds, buildConsumerCorpus, isConsumed,
  computeFieldPredicateConsumers, META_CATALOG_ENTRIES,
} from '../guards/lib/entityConsumers.mjs'

const DATA_DIR = 'src/data'
const SRC_DIR = 'src'
const OUT = 'docs/orphelines-donnees.md'

function labelOf(dataDir, file, id) {
  const arr = JSON.parse(readFileSync(join(dataDir, file), 'utf8'))
  return arr.find((e) => e.id === id)?.label ?? null
}

const corpus = buildConsumerCorpus(DATA_DIR, SRC_DIR)
const ids = loadCategoryIds(DATA_DIR)
const { consumed: fieldConsumed } = computeFieldPredicateConsumers(DATA_DIR, SRC_DIR)
const isEntityConsumed = (cat, id) =>
  isConsumed(corpus, id) || fieldConsumed.get(cat)?.has(id) || META_CATALOG_ENTRIES.has(`${cat}:${id}`)

let out = `# Orphelines de données — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-entity-orphans.mjs\` (\`npm run docs:orphelines\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Pour chaque catalogue \`src/data/*.json\` retenu, les entités qu'AUCUN autre \`src/data/*.json\`,\n`
out += `> AUCUN code de prod TypeScript (\`.ts\`/\`.tsx\`, hors tests) ne cite l'id en toutes lettres NI ne\n`
out += `> sélectionne par prédicat de champ (\`catalogue.filter(...)\`). Périmètre\n`
out += `> mesuré, angles morts déclarés, définition d'un consommateur : voir l'en-tête de\n`
out += `> \`scripts/docs/build-entity-orphans.mjs\`. Cliquet décroissant : \`src/data/entity-orphans.test.ts\`\n`
out += `> + \`scripts/guards/lib/entityOrphanStock.mjs\`.\n\n`
out += `## Catalogues ÉCARTÉS (angle mort structurel mesuré, pas couverts)\n\n`
out += `| Catalogue | Entités | Orphelines BRUTES (id seul) | Taux |\n|---|---|---|---|\n`
out += `| \`spells\` | 576 | 282 | 49 % |\n`
out += `| \`trappings\` | 440 | 215 | 49 % |\n`
out += `| \`creatures\` | 490 | 362 | 74 % |\n\n`
out += `Ces trois catalogues portent un lookup de repli PAR LABEL (\`findSpell\`/\`findTrappingByLabel\`/\n`
out += `\`findCreature\`) que la détection id-seule ne voit pas — taux 8 à 12× les catalogues retenus,\n`
out += `signe d'un détecteur inadapté plutôt que d'une dette réelle à ce volume. Non câblés ici.\n\n`
out += `## Catalogues MESURÉS\n\n`
out += `| Catalogue | Entités | Orphelines | Taux |\n|---|---|---|---|\n`

let totalEntities = 0
let totalOrphans = 0
const orphansByCategory = {}
for (const [cat, allIds] of Object.entries(ids)) {
  const orphans = allIds.filter((id) => !isEntityConsumed(cat, id))
  orphansByCategory[cat] = orphans
  totalEntities += allIds.length
  totalOrphans += orphans.length
  const pct = allIds.length ? Math.round((orphans.length / allIds.length) * 100) : 0
  out += `| \`${cat}\` | ${allIds.length} | ${orphans.length} | ${pct} % |\n`
}
out += `| **Total** | **${totalEntities}** | **${totalOrphans}** | — |\n\n`

for (const [cat, orphans] of Object.entries(orphansByCategory)) {
  if (!orphans.length) continue
  out += `### \`${cat}\`\n\n`
  for (const id of orphans) {
    const label = labelOf(DATA_DIR, CATEGORY_FILES[cat], id)
    out += `- \`${id}\`${label ? ` — ${label}` : ''}\n`
  }
  out += `\n`
}

emitOrCheck({
  out,
  path: OUT,
  check: process.argv.includes('--check'),
  staleMsg: `docs:orphelines — ${OUT} est PÉRIMÉ (les catalogues source ont changé).`,
  rerunMsg: '  → relancer `npm run docs:orphelines` et committer le résultat.',
  okMsg: `docs:orphelines — OK (${OUT} à jour, ${totalOrphans}/${totalEntities} orphelines mesurées)`,
  writeMsg: `${OUT} — ${totalOrphans}/${totalEntities} orphelines mesurées sur ${Object.keys(ids).length} catalogues.`,
})
