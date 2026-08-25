// Atlas des données `src/data/*.json` = DONNÉE (#903) : la partie éditoriale (rangement par
// rubrique, description d'une ligne, règle d'or, pièges d'homonymes) vit dans
// src/data/donnees.manifest.json ; tout ce que l'arbre permet de DÉRIVER (liste des fichiers réels,
// nombre d'entrées, présence d'un schéma zod, complétude du manifeste) est CALCULÉ ici. Sortie :
// docs/donnees.md. Re-run : node scripts/docs/build-donnees.mjs (npm run docs:donnees). Mode --check
// (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé, exit 1 avec
// message actionnable si diff — jamais d'écriture en mode --check. Mécanique d'émission partagée :
// emitOrCheck (scripts/docs/lib/jsdocUnion.mjs), patron `scripts/docs/build-systemes.mjs`.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { emitOrCheck } from './lib/jsdocUnion.mjs'

const DATA_DIR = 'src/data'
const DEFS_DIR = 'src/data/schemas/defs'

const MANIFEST = JSON.parse(readFileSync('src/data/donnees.manifest.json', 'utf8'))

const errors = []

// --- inventaire réel ---
const filesOnDisk = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).sort()
const defBasenames = new Set(readdirSync(DEFS_DIR).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')))

/** Def de schéma d'un `xxx.json` : même basename, points remplacés par des tirets
 *  (`primitives.manifest.json` → `primitives-manifest.ts`, cf. convention _registry.generated.ts). */
const schemaDefOf = (jsonFile) => jsonFile.replace(/\.json$/, '').replace(/\./g, '-')
const hasSchema = (jsonFile) => defBasenames.has(schemaDefOf(jsonFile))

// --- complétude du manifeste : bijection avec les fichiers réels ---
const manifestFiles = new Set()
for (const r of MANIFEST.rubriques) for (const e of r.entrees) for (const f of e.files) manifestFiles.add(f)

for (const f of filesOnDisk) {
  if (!manifestFiles.has(f)) errors.push(`${f} existe sur disque mais n'est cartographié dans aucune rubrique de donnees.manifest.json`)
}
for (const f of manifestFiles) {
  if (!existsSync(`${DATA_DIR}/${f}`)) errors.push(`donnees.manifest.json cartographie ${f} — absent de ${DATA_DIR}/`)
}

// --- nombre d'entrées par fichier (tableau plat) ou nature « objet à sous-catalogues » ---
function shapeOf(jsonFile) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(`${DATA_DIR}/${jsonFile}`, 'utf8'))
  } catch {
    return 'illisible'
  }
  if (Array.isArray(parsed)) return `${parsed.length} entrée(s)`
  return 'objet à sous-catalogues'
}

// --- vérification des cas d'homonymes du manifeste : chaque fichier cité existe réellement ---
for (const cas of MANIFEST.homonymes.cas) {
  for (const e of cas.entrees) {
    if (!existsSync(`${DATA_DIR}/${e.file}`)) errors.push(`homonyme « ${cas.mot} » : ${e.file} cité mais absent de ${DATA_DIR}/`)
  }
}

const schemaCoverage = filesOnDisk.filter(hasSchema).length

// --- rendu docs/donnees.md ---
let out = `# Atlas des données — \`src/data/*.json\` (base app-owned)\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-donnees.mjs\` (\`npm run docs:donnees\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source éditoriale (rangement par rubrique, description, règle d'or, pièges d'homonymes) :\n`
out += `> \`src/data/donnees.manifest.json\`. La liste des fichiers, leur nombre d'entrées et la présence d'un\n`
out += `> schéma sont CALCULÉS de l'arbre réel — jamais périmés : re-générer après tout ajout/retrait de\n`
out += `> \`src/data/*.json\`.\n\n`
out += `> Réf VIVANTE. \`src/data/*.json\` est la **SOURCE app-owned** (commitée, éditable au Compendium). Cet\n`
out += `> atlas répond à trois questions AVANT d'ajouter/curer une donnée : **où vit chaque concept**, **quelles\n`
out += `> conventions de champs**, **qu'est-ce qui existe déjà**. Procédure pas-à-pas : \`docs/ajouter-une-donnee.md\`\n`
out += `> (skill \`ajouter-une-donnee\`). Complétude verrouillée par \`src/data/data-atlas-complete.test.ts\` (tout\n`
out += `> fichier doit être cartographié ici) ; chemins vérifiés par \`npm run docs:check\`.\n\n`

out += `**Périmètre mesuré et angles morts** — la carte §A vient du manifeste ÉDITORIAL\n`
out += `\`src/data/donnees.manifest.json\` (rangement par rubrique, description, homonymes) : rien de tout cela\n`
out += `ne se devine de l'arbre, un jugement humain reste nécessaire. Ce que ce générateur CALCULE et\n`
out += `réfute au besoin : (1) bijection stricte manifeste ⇄ \`${filesOnDisk.length}\` fichiers réels de\n`
out += `\`src/data/*.json\` (un \`.json\` neuf non cartographié, ou une entrée de manifeste pointant sur un\n`
out += `fichier disparu, casse la génération) ; (2) nombre d'entrées par fichier (comptage \`Array.isArray\`,\n`
out += `\`objet à sous-catalogues\` sinon — angle mort assumé : cette étiquette ne dit RIEN du contenu réel\n`
out += `d'un objet à sous-catalogues, juste qu'il n'est pas un tableau plat) ; (3) couverture du contrat de\n`
out += `schéma zod (\`${schemaCoverage}/${filesOnDisk.length}\`, cf. §E-bis) ; (4) présence effective sur disque de\n`
out += `chaque fichier cité par un cas d'homonyme de §D. Angle mort déclaré : les DESCRIPTIONS de rubrique,\n`
out += `de fichier et d'homonyme restent du texte manuscrit du manifeste — ce générateur ne les vérifie PAS\n`
out += `contre le contenu réel des \`.json\` (une description qui ment sur ce que porte un fichier ne casse\n`
out += `pas la génération) ; seule la complétude de la CARTE (quel fichier existe, où il est rangé) est\n`
out += `garantie, pas la justesse de sa glose.\n\n`

out += `## §A — Carte : où va chaque donnée\n\n`
out += `**Règle d'or** : ${MANIFEST.reglesOr}\n\n`
for (const r of MANIFEST.rubriques) {
  out += `### ${r.nom}\n`
  out += `| Fichier | Contient |\n|---|---|\n`
  for (const e of r.entrees) {
    const label = e.files.map((f) => `\`${f}\``).join(' · ')
    const shapes = e.files.map(shapeOf).join(' · ')
    out += `| ${label} | ${e.desc} (${shapes}) |\n`
  }
  out += `\n`
  if (r.nom === 'Contenu de campagne / interlude / rencontres') out += `${MANIFEST.narratifNote}\n\n`
}

out += `## §B — Conventions de champs (à respecter à l'ajout)\n\n`
out += `- **\`source.book\`** = l'\`id\` STABLE d'un livre de \`src/data/books.json\` (slug neutre, ex.\n`
out += `  \`livre-de-base\`, \`archives-de-l-empire-2\`, \`mer-des-griffes\`) — **jamais** l'abréviation d'affichage ni\n`
out += `  le libellé. Relation **id-pure** (i18n-safe) : \`books.json\` est la source de vérité, **enforced** par\n`
out += `  \`src/data/book-source-integrity.test.ts\` (tout \`source.book\` ∈ ids de livres). L'affichage résout\n`
out += `  id→\`abr\` via \`bookAbr\` (choke-point \`registry.ts\` \`src()\`). Pour un ajout : copier l'\`id\` d'une entrée\n`
out += `  voisine du même livre (\`grep '"book"' <fichier>\`), ou le lire dans \`books.json\`. Contenu fan\n`
out += `  communautaire = livre \`frenchy-bzh\`.\n`
out += `- **\`source.page\`** = la **page IMPRIMÉE du livre** (le folio), comme la donnée existante (ex. LDB « À\n`
out += `  Enroulement » = folio 297, AA « Cimeterre » = folio 90 — sa \`desc\`, règle 5 ; la ligne de stats\n`
out += `  du Cimeterre, folio 91, va en \`alsoIn\`, cf. plus bas). Pour l'obtenir : trouve ton contenu dans le\n`
out += `  \`.md\` du livre (\`docs/sources-vf.md\` → dossier \`Source/\`), puis lis le **\`data-folio="N"\`** de l'ancre\n`
out += `  \`<span id="page-… data-folio="N">\` la plus proche AU-DESSUS de ton contenu — **\`N\` = la valeur de\n`
out += `  \`source.page\`**. ⚠ Le NUMÉRO du span-id seul (\`page-89\`) est l'**index PDF**, PAS le folio (c'est le\n`
out += `  piège de #148) — toujours lire \`data-folio\`. **Tous les livres de règles autorisés** ont \`data-folio\`\n`
out += `  baké et les ancres nues (sans folio) retirées — étiquetés (LDB, ADE I/II, EDOC, Middenheim, NADJ, ACE,\n`
out += `  PDT) comme scans (AA, ZI, MDG, EDO, MSR, MSRC) ; le \`00 - Index.md\` de chaque livre liste ses chapitres\n`
out += `  avec leur folio de début.\n`
out += `  **Enforced** (#536) par \`src/data/book-source-integrity.test.ts\`, volet « intégrité du folio », par DEUX\n`
out += `  voies : (A) **hors-livre** — le folio dépasse le dernier folio ATTESTÉ du livre (\`bookMaxFolio\` : dernier\n`
out += `  marqueur \`data-folio\` et dernière page citée par \`00 - Index.md\`), réfutation qui se passe de la \`desc\`\n`
out += `  ; (B) **encadrement** — la \`desc\` étant verbatim (règle 5), elle LOCALISE l'entrée dans le \`Source/\` du livre\n`
out += `  déclaré, et l'encadrement \`data-folio\` de l'occurrence réfute le folio qui ment. Défauts fondateurs :\n`
out += `  \`redoutable\` (ZI) déclarait \`page: 11\` pour un texte en folio 134 ; \`activities.json:duel\` déclarait\n`
out += `  \`page: 223\` dans un ADE II qui compte 98 pages. Mécanique : \`scripts/guards/lib/folioIntegrity.mjs\` ;\n`
out += `  rapport de solde (donne le folio RÉEL) : \`node scripts/data/audit-folios.mjs\`.\n`
out += `  ⚠ **Ce que la garde NE voit PAS** — elle ne réfute que ce qu'elle PROUVE et se tait sur le reste : sur les\n`
out += `  2082 entrées citées scannées, 1135 échappent à tout verdict d'encadrement (desc reformulée donc\n`
out += `  introuvable, desc trop courte pour localiser, chapitre sans marqueur, livre sans extraction FR). Une entrée\n`
out += `  neuve à desc NON verbatim et à folio faux mais PLAUSIBLE passe encore : seule la règle 5 la rattrape. Le\n`
out += `  stock n'est donc pas « les défauts du dépôt », c'est « les défauts que ces deux voies prouvent ».\n`
out += `  Si une desc se retrouve sur PLUSIEURS folios (définition ET récapitulatif d'annexe), cite la **DÉFINITION** ;\n`
out += `  le rapport les signale (rubrique « À ARBITRER ») car la garde ne les départage pas.\n`
out += `  **Mode CLIQUET** : le stock de 140 entrées déjà fausses est gelé dans \`scripts/guards/lib/folioRatchetStock.mjs\`\n`
out += `  et ne peut que DÉCROÎTRE — toute entrée NEUVE au folio réfuté échoue la CI, toute clé soldée qui y traîne\n`
out += `  aussi, et sa TAILLE est plafonnée par la garde (\`FOLIO_RATCHET_MAX\`) pour qu'« ajouter une ligne au stock »\n`
out += `  ne soit jamais le chemin le plus court. \`node scripts/data/audit-folios.mjs --stock\` re-rend le stock et\n`
out += `  REFUSE de l'agrandir : l'outil ne sait que solder.\n`
out += `- **\`alsoIn?: SecondaryRef[]\`** (#563, doctrine user 2026-07-17 : « jamais 2 talents différents ») —\n`
out += `  un même Talent/Trait/Qualité/objet **réimprimé** dans un AUTRE livre (ou un autre folio du même\n`
out += `  livre) reste **UNE entrée** : l'ANCRE (\`source\`, scalaire, porte la \`desc\`, règle 5, STRUCTURELLE —\n`
out += `  jamais un tableau positionnel) + \`alsoIn\` porte les emplacements SECONDAIRES, chacun une paire\n`
out += `  \`(book, page)\` pleine + un \`quote?\` authoré (auto-attestation verbatim, pour le cas où le \`label\`\n`
out += `  n'apparaît pas tel quel au folio déclaré — ex. une TABLE imprime un nom différent). Accessors SOURCE\n`
out += `  UNIQUE : \`allLocations(entry)\`/\`sourceBooks(entry)\` (\`src/data/sourceRefs.ts\`) — aucun futur lecteur\n`
out += `  n'inline \`alsoIn\`. **Enforced** par \`src/data/secondary-ref-integrity.test.ts\` : chaque \`alsoIn[i]\`\n`
out += `  doit être **auto-attesté** (le \`label\` du porteur OU son \`quote\` retrouvé dans le SPAN du folio\n`
out += `  déclaré — charge de la preuve sur l'auteur, jamais une réfutation par absence). Champ posé sur\n`
out += `  \`traits.json\`/\`qualities.json\`/\`trappings.json\`/\`spells.json\`/\`naval-traits.json\`\n`
out += `  (\`traits.ts\`/\`qualities.ts\`/\`trappings.ts\`/\`spells.ts\`/\`naval-traits.ts\`). Exemple réel — le\n`
out += `  Cimeterre (AA) a sa \`desc\` en prose folio 90 et sa ligne de stats (tableau des armes) folio 91,\n`
out += `  où le \`label\` seul ne suffirait pas à distinguer la ligne dans le span sans un \`quote\` :\n`
out += '  ```json\n'
out += `  {\n`
out += `    "id": "cimeterre",\n`
out += `    "label": "Cimeterre",\n`
out += `    "source": { "book": "aux-armes", "page": 90 },\n`
out += `    "alsoIn": [{ "book": "aux-armes", "page": 91, "quote": "Cimeterre" }]\n`
out += `  }\n`
out += '  ```\n'
out += `  (Lot 2, #563 : 15 entrées migrées — republications identiques et scissions prose/ligne-de-stats.)\n`
out += `- **\`variants?: Variant[]\`** (#563/#564) — variante RÉGLÉE d'une entrée sous une **règle optionnelle**\n`
out += `  du registre \`OPTIONAL_RULES\` (\`src/engine/policy.ts:43\`, lue par \`rule(id)\`) : \`when.rule\` DOIT être\n`
out += `  un id du registre (jamais un label, gate fantôme sinon — **enforced** par\n`
out += `  \`src/data/variants-integrity.test.ts\`), \`when.equals\` défaut \`true\` ; \`desc\`/\`source\` PROPRES\n`
out += `  portent la règle 5 **par variante** (le walk \`citedEntriesOf\` de \`folioIntegrity.mjs\` la découvre\n`
out += `  déjà, structurellement identique à une entrée) ; \`combat\` réutilise \`CombatFeature\` tel quel.\n`
out += `  Résolution : \`effectiveEntry(entry)\` (\`src/engine/variants.ts\`) — PRIMITIVE UNIQUE, applique la\n`
out += `  première variante active (\`activeVariant\`) en REPLACE par champ DÉCLARÉ au premier niveau, sinon\n`
out += `  rend la forme LDB de base. Une variante ne peut republier QUE les champs que son dataset **résout**\n`
out += `  effectivement (liste blanche \`VARIANT_RESOLVED_FIELDS\` de la def, passée à \`variantOf\` — schéma\n`
out += `  \`strictObject\`, donc tout autre champ est rejeté au parse ; **enforced** aussi côté donnée par\n`
out += `  \`src/data/variants-integrity.test.ts\`) : \`talents.json\` résout \`desc\`/\`source\` (Codex\n`
out += `  \`src/ui/compendium/registry.ts:1133\`), \`test\` (\`talentTestSLBonus\`, \`src/engine/magic.ts:314\`),\n`
out += `  \`max\` (\`talentMaxById\`, \`src/engine/careerSlots.ts:324\`) et \`combat\` (\`featuresOf\`/\`castingKindOf\`,\n`
out += `  \`src/engine/combatFeatures/dispatch.ts:59\`/\`:17\`) ; \`traits.json\` ne résout que \`desc\`/\`source\`\n`
out += `  (\`src/ui/compendium/registry.ts:483\`). \`passive\` et \`effects\` en sont EXCLUS — le moteur les lit sur\n`
out += `  l'entrée brute (\`src/engine/talentEffects.ts\`, \`src/engine/traits/dispatch.ts\`) ; un champ n'entre\n`
out += `  dans la liste qu'une fois son consommateur routé par \`effectiveEntry\`. \`careers\`/\`skills\`/\`spells\`\n`
out += `  n'admettent aucune variante (aucun consommateur \`effectiveEntry\`). Champ posé sur \`talents.json\` —\n`
out += `  11 talents d'Aux Armes Annexe III.\n`
out += `- **\`desc\`** et tout champ de prose (effet, règles) = **copié/collé VERBATIM** de la source, en **Markdown**\n`
out += `  (\`**gras**\`, \`*ital*\`, listes \`-\`), jamais en HTML, jamais reformulé (règle stricte 5 ; garde\n`
out += `  \`src/data/no-html-in-prose.test.ts\`).\n`
out += `- **Formes de champ** = copiées des entrées voisines (\`damage:{plusBF,flat}\`, \`qualities:[{id}]\`,\n`
out += `  \`passive: GameOp[]\`…). Toute logique est keyée par **id stable** ; le \`label\` est de l'affichage.\n`
out += `- **Forme du fichier** : la plupart sont des tableaux plats d'entrées \`{id,label,…}\`, mais certains sont des\n`
out += `  **objets à sous-catalogues** (\`mass-battle.json\`, \`sea-*.json\`, \`criticals.json\`…) ou des **tables d100\n`
out += `  par fourchette** — lire la structure existante avant d'ajouter (cf. §A).\n`
out += `- **Canonicalisation** : après édition manuelle, le fichier doit être **byte-identique** au round-trip de\n`
out += `  \`serializeDataset\` (\`src/data/serialize.ts\`), verrouillé par \`src/data/serialize.test.ts\` (2 espaces,\n`
out += `  **aucun** newline final). L'éditeur Codex l'applique à la sauvegarde ; en édition manuelle, ne **jamais**\n`
out += `  reformater à la main ni via un \`JSON.stringify\` maison — passer par \`serializeDataset\`.\n\n`

out += `## §C — CHECK-FIRST (avant tout ajout — anti-doublon)\n\n`
out += `Le concept existe peut-être **déjà**, dans un AUTRE sous-système (incident #148 : le Bélier vit dans 6\n`
out += `fichiers). Avant d'ajouter :\n\n`
out += '```\n'
out += `grep -rniE '<id-candidat>|<label>|<concept>' src/data/*.json\n`
out += '```\n\n'
out += `Si l'élément (ou un synonyme) existe → NE PAS dupliquer : l'étendre là où il vit, ou re-scoper la tâche.\n`
out += `Puis choisir le fichier via §A. En cas d'ambiguïté, lire 2-3 entrées voisines des fichiers candidats.\n\n`

out += `## §D — Pièges d'homonymes (un mot ≠ un concept)\n\n`
out += `${MANIFEST.homonymes.intro}\n\n`
out += `| Fichier | Ce que « ${MANIFEST.homonymes.cas[0].mot} » y est |\n|---|---|\n`
for (const cas of MANIFEST.homonymes.cas) {
  for (const e of cas.entrees) {
    out += `| \`${e.file}\` | ${e.desc} |\n`
  }
}
out += `\n${MANIFEST.homonymes.cas[0].lecon}\n\n`

out += `## §E-bis — Contrat de schéma (\`src/data/schemas/\`)\n\n`
out += `Chaque \`src/data/*.json\` valide contre un schéma zod **STRICT** — le contrat de donnée (Lot 1,\n`
out += `**${schemaCoverage}/${filesOnDisk.length}** datasets sous contrat, décompte CALCULÉ des defs présentes dans\n`
out += `\`src/data/schemas/defs/\`). Trois pièces :\n\n`
out += `- **\`src/data/schemas/defs/<nom>.ts\`** — 1 def PAR dataset (même basename que le \`.json\`), exporte\n`
out += `  \`file\` (le nom de fichier) et \`schema\` (\`z.ZodTypeAny\`, racine = la forme EXACTE du JSON — tableau\n`
out += `  ou objet à sous-catalogues). \`characteristics.ts\` est l'EXEMPLAIRE de la convention. Champs de\n`
out += `  référence commun (\`source.book\`/\`source.page\`) : \`sourceRefSchema\` (\`src/data/schemas/grammaire/valeurs.ts\`).\n`
out += `- **\`src/data/schemas/_registry.generated.ts\`** — GÉNÉRÉ par \`node scripts/gen-registry.mjs\`\n`
out += `  (\`npm run gen\`), scanne \`defs/\` et exporte \`SCHEMA_DEFS: SchemaDef[]\`. Ne JAMAIS éditer à la main.\n`
out += `- **\`PENDING\`** dans \`src/data/schema-contract.test.ts\` — la liste des \`.json\` encore sans schéma.\n`
out += `  **Vide** depuis la fin de la migration : tout nouveau dataset naît AVEC son def, jamais en PENDING\n`
out += `  transitoire.\n\n`
out += `**Portes qui font respecter le contrat :**\n`
out += `- \`src/data/schema-contract.test.ts\` (CI/\`npm test\`) : (a) chaque dataset de \`SCHEMA_DEFS\` valide\n`
out += `  son JSON réel, (b) EXHAUSTIVITÉ (tout \`.json\` est registré ou dans \`PENDING\`), (c) CLIQUET\n`
out += `  (\`PENDING\` ne peut pas contenir un fichier déjà schématisé).\n`
out += `- \`scripts/guards/validate-data.mts\` (pre-commit, \`scripts/git-hooks/pre-commit.mjs\`) : sur les\n`
out += `  \`.json\` STAGÉS, reparse et revalide contre \`SCHEMA_DEFS\` (Node/tsx, hors Vitest) ; un fichier sans\n`
out += `  schéma enregistré est ignoré silencieusement (ne peut pas arriver hors PENDING, cf. ci-dessus).\n\n`
out += `**Geste « ajouter un dataset »** : créer le \`.json\` **et** \`src/data/schemas/defs/<nom>.ts\` dans le\n`
out += `même commit, puis \`npm run gen\` (régénère \`_registry.generated.ts\`) — sinon la garde EXHAUSTIVITÉ\n`
out += `échoue (orphelin ni registré ni PENDING).\n\n`

out += `## §E-ter — Les deux espaces de clés « race » (species ⇄ rig)\n\n`
out += `Deux conventions de nommage de race coexistent, **par dessein**, DÉCOUPLÉES :\n\n`
out += `- **espace « données de personnage »** (\`species.refChar\`/\`species.refCareer\`, ex. \`Haut Elfe\`, \`Elfe\n`
out += `  Sylvain\`) — clé de \`names.json\`, \`careers.json\`, \`eyes.json\`, \`hairs.json\`, \`details.json\`.\n`
out += `- **espace « rig »** (id d'apparence, sûr pour nom de fichier, ex. \`Haut-Elfe\`, \`Elfe sylvain\`) — id\n`
out += `  de \`raceAppearance.json\` et des defs de \`src/gameIso/rig/\`.\n\n`
out += `\`speciesRace.json\` (consommé via \`baseSpeciesOf\`) est le **pont UNIQUE** species→rig — 5 des 7 races\n`
out += `jouables sont identiques d'un espace à l'autre, seuls les elfes divergent par tiret/casse ; ce\n`
out += `découplage est **intentionnel** (unifier les deux espaces casserait l'un des deux clans, chacun avec\n`
out += `ses dizaines de fichiers). Garde : \`src/data/names-species-keyspaces.test.ts\` — échoue si \`names.json\`\n`
out += `dérive hors de l'espace \`refChar\`, si le pont species→rig cesse d'être 1:1, ou si une clé d'un espace\n`
out += `se met à ressembler à une clé de l'autre sans être le couple ponté sanctionné.\n\n`

out += `## §F — À COLLER DANS UN BRIEF D'AGENT « DONNÉE »\n\n`
out += `> Tu vas ajouter/curer une entrée dans \`src/data/*.json\`. Discipline OBLIGATOIRE :\n`
out += `> 1. **CHECK-FIRST** : \`grep -rniE '<id>|<label>|<concept>' src/data/*.json\`. Le concept vit peut-être\n`
out += `>    déjà dans un autre sous-système (ex. #148 : le Bélier est dans 6 fichiers). S'il existe → ne duplique\n`
out += `>    pas, étends-le ou re-scope.\n`
out += `> 2. **Bon fichier** via \`docs/donnees.md\` §A. Une « machine de guerre / véhicule / navire » n'est pas un\n`
out += `>    \`trappings\`. Si c'est un **sort / une créature / un effet mécanique / une icône / un livre** → utilise\n`
out += `>    le skill de domaine dédié (\`ajouter-un-sort\`/\`creer-une-creature\`/\`ajouter-une-mecanique\`/…).\n`
out += `> 3. **Chaque champ = Source RAW ⊕ voisins** : lis le **tableau ET son en-tête** au \`Source/\` (FR only ;\n`
out += `>    ne confonds pas une colonne « Équipe » avec « Encombrement »). \`book\` = \`abr\` de \`books.json\` ;\n`
out += `>    \`page\` = vraie page ; \`desc\` = verbatim Markdown ; formes copiées des voisins.\n`
out += `> 4. **Zéro invention, zéro inflexion RAW silencieuse** : un champ introuvable → omission assumée ; une\n`
out += `>    mécanique RAW non modélisable → **issue au gabarit #101+** ou valeur \`maison\` taguée, JAMAIS « hors\n`
out += `>    scope ».\n`
out += `> 5. **Vérifie** : canonicaliser via \`serializeDataset\`, puis \`npm test\` + \`npm run typecheck\` verts ;\n`
out += `>    recette navigateur si l'élément est visible au Codex/éditeur.\n`

if (errors.length) {
  console.error(`build-donnees — ${errors.length} erreur(s) d'intégrité manifeste :`)
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}

const CHECK = process.argv.includes('--check')
emitOrCheck({
  out,
  path: 'docs/donnees.md',
  check: CHECK,
  staleMsg: "docs:donnees — docs/donnees.md est PÉRIMÉ (diverge de src/data/donnees.manifest.json ou de l'arbre src/data/*.json).",
  rerunMsg: '  → relancer `npm run docs:donnees` et committer le résultat.',
  okMsg: 'docs:donnees — OK (docs/donnees.md à jour)',
  writeMsg: `docs/donnees.md — ${filesOnDisk.length} fichiers cartographiés, ${schemaCoverage}/${filesOnDisk.length} sous contrat de schéma.`,
})
