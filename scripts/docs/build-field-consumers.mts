/**
 * Rapport des CONSOMMATEURS PAR CHAMP — GÉNÉRÉ. Sortie : docs/consommateurs-de-champs.md.
 * Re-run : `npx tsx scripts/docs/build-field-consumers.mts` (`npm run docs:field-consumers`).
 * Mode --check (chaîné dans `npm run docs:check`) : régénère en mémoire, compare au .md committé,
 * exit 1 si diff — jamais d'écriture en mode --check.
 *
 * Objet (#903) — la mesure INVERSE de `build-entity-orphans.mjs` : celui-ci répond « qui cite cet
 * ID d'ENTITÉ de catalogue ? », celui-ci répond « qui LIT ce CHAMP d'un TYPE de donnée structuré ? ».
 * Question fondatrice : « qui lit le champ `spec` sur une référence de dotation (`TrappingRef`) ? » —
 * affirmé « personne » sur une recherche trop étroite, sans surface pour le vérifier (cf.
 * `scripts/guards/lib/groundingCorpus.mjs`, cas `dotation-spec-consommateurs`).
 *
 * PÉRIMÈTRE MESURÉ / ANGLES MORTS — `src/data/schemas/defs/*.ts` compte 109 fichiers, chacun
 * exportant un `schema` ANONYME (`z.array(z.strictObject({…}))`, l'entrée de catalogue elle-même,
 * ex. `TrappingData`) SANS alias TS nommé exploitable pour le scope-de-liaison de ce détecteur
 * (cf. angles morts de `fieldConsumers.mjs`) — mesurés (109 fichiers) mais HORS PÉRIMÈTRE de ce
 * rapport, dette non traitée. Retenus à la place (`fieldConsumerTargets.mts`) : les schémas
 * PARTAGÉS et RÉUTILISÉS, exportés sous un nom `export const xSchema` ET portant un alias TS
 * NOMMÉ vérifiable ailleurs dans le dépôt (`interface`/`type X = …`) — c'est la classe exacte où
 * vit `TrappingRef.spec`. Mesurés dans `src/data/schemas/common.ts` (37 schémas nommés) +
 * `src/data/schemas/defs/criticals.ts` (2) : 39 candidats, réduits à 17 après exclusion des deux
 * catégories ci-dessous (non un cliquet — `TARGETS` est un TABLEAU statique, étendu à la main si
 * un nouveau schéma nommé apparaît).
 *
 * SECOND ANGLE MORT, MESURÉ (pas hypothétique) — `fieldConsumers.mjs` ne borne une lecture que sur
 * un identifiant explicitement ANNOTÉ `T` (littéral du nom dans un type de paramètre/variable). Les
 * 16 champs mesurés « 0 lecteur » de la première version de ce rapport ont été vérifiés À LA MAIN
 * un par un (grep large, hors annotation) : **9/16 sont des FAUX NÉGATIFS du détecteur** — un
 * lecteur réel existe, mais accède via un chemin syntaxique que `fieldConsumers.mjs` ne suit pas :
 *   - `const x = a?.b` (variable sans annotation EXPLICITE, type INFÉRÉ) — `TraitInstance.hidden`
 *     (`engine/groups.ts` `hiddenGroupsOf`, param structurel dupliqué), `DetailRecipe.tintVar`
 *     (`gameIso/authoring/detailSvg.ts`), `EntityAppearance.armurePortee` (`gameIso/rig/
 *     enemyProfile.ts:185/254`, `cd = findCreatureById(...)?.appearance`), `CritEscalation.onRepeat`
 *     (`engine/{critical,aaCritical}.ts`, `entry.escalation?.onRepeat`), `Amputation.timing`
 *     (mêmes fichiers, `entry.amputation.timing`), `FlowTest.opposed` (`state/combat/
 *     triggeredTest.ts:320`, `const ft = node.test`) ;
 *   - accès CHAÎNÉ à travers un champ INTERMÉDIAIRE non lui-même annoté du type cible —
 *     `CountSpec.fixed`/`.roll` (`ref.count.fixed`/`.roll`, `data/index.ts`/`engine/{items,
 *     possessionGrants}.ts`/`ui/compendium/StructFields.tsx`, où seul `ref: TrappingRef` est
 *     annoté, jamais `ref.count: CountSpec`) ;
 *   - boucle `for…of` sur un tableau EXPLICITEMENT typé — `TrappingRef.label` (`engine/
 *     possessionGrants.ts`, `for (const ref of refs)` où `refs: TrappingRef[]` mais `ref` lui-même
 *     est inféré, non réannoté).
 * Taux de faux négatifs mesuré sur cet échantillon COMPLET (16/16 vérifiés) : 56 %, trop élevé pour
 * qu'un cliquet CI (`entityOrphanStock.mjs`) soit fiable SANS un vérificateur de types complet
 * (`ts.Program`/`TypeChecker`, hors budget de ce lot) — verrouiller ces 9 « orphelines » aurait été
 * verrouiller un FAIT FAUX. Ce rapport reste donc une mesure BRUTE, sans cliquet décroissant : la
 * garde (`src/data/field-consumers.test.ts`) ne verrouille QUE la fraîcheur du doc généré + le cas
 * fondateur `TrappingRef.spec` (vérifié indépendamment, non affecté par ces 9 faux négatifs — son
 * unique lecteur, `engine/trappingChoices.ts:36`, EST une annotation directe de paramètre).
 *
 * EXCLUS (39 → 17), avec raison :
 *   - `secondarySourceRefSchema` : aucun alias TS nommé exploitable trouvé (contrairement aux 16
 *     autres schémas de `common.ts` retenus) — dette de nommage distincte, non traitée ici ;
 *   - `gameOpSchema`/`conditionSchema`/`effectOpSchema`/`flowSchema`/`effectTargetingSchema`/
 *     `triggeredEffectSchema`/`formulaSchema`/`combatFeatureSchema` : vocabulaire MÉCANIQUE du
 *     moteur (`GameOp`/`Condition`/`Flow`/`EffectTrigger`/`EffectTargeting`/`Formula`,
 *     `src/engine/{ops,flowCore}.ts`) déjà catalogué par `npm run docs:vocabulaire`
 *     (`docs/vocabulaire-mecanique.md`) — un second générateur ferait doublon ;
 *   - 20 schémas SCALAIRES/ÉNUMÉRÉS de `common.ts` (`z.enum`/`z.string()`/`z.union` de primitifs,
 *     ex. `difficultySchema`, `charKeySchema`) : aucun champ objet à consommer, hors du périmètre
 *     de la question « qui lit CE CHAMP ? ».
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emitOrCheck } from './lib/jsdocUnion.mjs'
import { listProdFiles, scanFieldReads, groupByField } from '../guards/lib/fieldConsumers.mjs'
import { TARGETS, fieldsOf } from '../guards/lib/fieldConsumerTargets.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '').replace(/\\/g, '/')
const SRC_DIR = join(ROOT, 'src')
const OUT = 'docs/consommateurs-de-champs.md'

const files = listProdFiles(SRC_DIR)

let out = `# Consommateurs par champ — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`npx tsx scripts/docs/build-field-consumers.mts\` (\`npm run docs:field-consumers\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Pour chaque type de référence PARTAGÉ, qui LIT chaque champ (annotation de type explicite +\n`
out += `> accès/déstructuration, cf. \`scripts/guards/lib/fieldConsumers.mjs\`). Complète\n`
out += `> \`docs/orphelines-donnees.md\` (consommateurs d'ENTITÉ) — ici, consommateurs de CHAMP.\n\n`
out += `## Périmètre mesuré / angles morts\n\n`
out += `39 schémas NOMMÉS mesurés dans \`src/data/schemas/common.ts\` (37) + \`src/data/schemas/defs/criticals.ts\` (2) ; `
out += `**17 retenus** (voir en-tête du générateur pour le détail des 22 exclus). Les 109 catalogues `
out += `\`src/data/schemas/defs/*.ts\` (schéma d'entrée ANONYME par fichier) restent HORS PÉRIMÈTRE — `
out += `sans alias TS nommé, ce détecteur ne peut pas y borner une lecture.\n\n`
out += `Détection SYNTAXIQUE (pas un vérificateur de types complet) : un identifiant doit être `
out += `EXPLICITEMENT annoté du type cible. **Vérification manuelle des 16 champs « 0 lecteur »** de la `
out += `première mesure (échantillon COMPLET, pas partiel) : 9/16 (56 %) sont des FAUX NÉGATIFS — un `
out += `lecteur réel existe via une variable de type INFÉRÉ, un accès chaîné à travers un champ `
out += `intermédiaire non annoté, ou une boucle \`for…of\` sur un tableau typé (détail + fichiers : `
out += `en-tête du générateur). Taux trop élevé pour un cliquet CI fiable — ce rapport reste une mesure `
out += `BRUTE, non ratchetée.\n\n`

let totalFields = 0
let totalUnread = 0
let trappingRefSpecReaders = 0

for (const { schema, type, home } of TARGETS) {
  const fields = fieldsOf(schema)
  const hits = scanFieldReads(type, fields, files, ROOT)
  const byField = groupByField(fields, hits)
  totalFields += fields.length
  out += `### \`${type}\` (${home})\n\n`
  out += `| Champ | Lecteurs | Exemple |\n|---|---|---|\n`
  for (const f of fields) {
    const list = byField.get(f) ?? []
    if (type === 'TrappingRef' && f === 'spec') trappingRefSpecReaders = list.length
    if (list.length === 0) {
      totalUnread++
      out += `| \`${f}\` | **0 — JAMAIS LU** | — |\n`
    } else {
      const uniqSites = [...new Set(list.map((h: { file: string; line: number }) => `${h.file}:${h.line}`))]
      out += `| \`${f}\` | ${uniqSites.length} | \`${uniqSites[0]}\` |\n`
    }
  }
  out += `\n`
}

out += `## Synthèse\n\n`
out += `${TARGETS.length} types, ${totalFields} champs mesurés, **${totalUnread} avec « 0 lecteur » mesuré** `
out += `(56 % réfutés à la main sur l'échantillon initial — cf. Périmètre mesuré ci-dessus ; pas de `
out += `cliquet CI sur ce total).\n\n`
out += `## Cas fondateur\n\n`
out += `\`TrappingRef.spec\` : ${trappingRefSpecReaders} lecteur(s) mesuré(s) — \`trappingRefLabel\` `
out += `(\`src/data/index.ts\`, SOURCE UNIQUE du libellé affiché d'une \`TrappingRef\`) ne lit PAS \`ref.spec\` ; `
out += `l'unique lecteur est \`resolveOne\` (\`src/engine/trappingChoices.ts\`), qui le RECOPIE sans le consommer.\n`

emitOrCheck({
  out,
  path: OUT,
  check: process.argv.includes('--check'),
  staleMsg: `docs:field-consumers — ${OUT} est PÉRIMÉ (les schémas/le code source ont changé).`,
  rerunMsg: '  → relancer `npm run docs:field-consumers` et committer le résultat.',
  okMsg: `docs:field-consumers — OK (${OUT} à jour, ${totalUnread}/${totalFields} champs « 0 lecteur »)`,
  writeMsg: `${OUT} — ${totalUnread}/${totalFields} champs « 0 lecteur » sur ${TARGETS.length} types.`,
})
