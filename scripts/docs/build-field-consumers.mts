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
 * PÉRIMÈTRE MESURÉ / ANGLES MORTS — la plupart des `src/data/schemas/defs/*.ts` exportent un
 * `schema` ANONYME (`z.array(z.strictObject({…}))`, l'entrée de catalogue elle-même, ex.
 * `TrappingData`) SANS alias TS nommé exploitable pour le scope-de-liaison de ce détecteur (cf.
 * angles morts de `fieldConsumers.mjs`) — HORS PÉRIMÈTRE de ce rapport, dette non traitée.
 * Retenus à la place (`fieldConsumerTargets.mjs`) : les schémas exportés sous un nom
 * `export const xSchema` ET portant un alias TS NOMMÉ vérifiable ailleurs dans le dépôt
 * (`interface`/`type X = …`) — c'est la classe exacte où vit `TrappingRef.spec`. Candidats
 * mesurés dans `src/data/schemas/grammaire/` (formes de valeur/référence/mécanique partagées par
 * plusieurs documents) et dans les `defs/` dont les sous-schémas sont nommés (`criticals.ts`,
 * `props.ts`), réduits par les deux catégories d'exclusion ci-dessous (non un cliquet — `TARGETS`
 * est un TABLEAU statique, étendu à la main si un nouveau schéma nommé apparaît).
 *
 * SORTIR un catalogue de l'angle mort = un geste d'auteur : NOMMER son schéma d'entrée (et ses
 * sous-schémas) dans SON def — `export const xSchema` dans `defs/<catalogue>.ts`, patron
 * `defs/criticals.ts` (`critEscalationSchema`, `amputationSchema`) — ou dans `grammaire/` si la forme
 * est RÉELLEMENT partagée entre documents, puis l'ajouter à `TARGETS`. Un def ADOPTÉ par `document()`
 * n'expose plus son entrée en nœud zod : il publie ses clés relevées avant le sceau (`cles` du handle,
 * patron `defs/props.ts`), et `TARGETS` porte alors `cles:` au lieu de `schema:`.
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
 * EXCLUS, avec raison :
 *   - `secondarySourceRefSchema` (`grammaire/valeurs.ts`) : aucun alias TS nommé exploitable trouvé
 *     (contrairement aux schémas retenus) — dette de nommage distincte, non traitée ici ;
 *   - `gameOpSchema`/`conditionSchema`/`effectOpSchema`/`flowSchema`/`effectTargetingSchema`/
 *     `triggeredEffectSchema`/`formulaSchema`/`combatFeatureSchema` : vocabulaire MÉCANIQUE du
 *     moteur (`GameOp`/`Condition`/`Flow`/`EffectTrigger`/`EffectTargeting`/`Formula`,
 *     `src/engine/{ops,flowCore}.ts`) déjà catalogué par `npm run docs:vocabulaire`
 *     (`docs/vocabulaire-mecanique.md`) — un second générateur ferait doublon ;
 *   - les schémas SCALAIRES/ÉNUMÉRÉS de `grammaire/valeurs.ts` (`z.enum`/`z.string()`/`z.union` de primitifs,
 *     ex. `difficultySchema`, `charKeySchema`) : aucun champ objet à consommer, hors du périmètre
 *     de la question « qui lit CE CHAMP ? ».
 */
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emitOrCheck } from './lib/jsdocUnion.mjs'
import { listProdFiles, scanFieldReads, groupByField } from '../guards/lib/fieldConsumers.mjs'
import { TARGETS, fieldsOf } from '../guards/lib/fieldConsumerTargets.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '').replace(/\\/g, '/')
const SRC_DIR = join(ROOT, 'src')
const OUT = 'docs/consommateurs-de-champs.md'

type Hit = { file: string; line: number }

/**
 * Le rapport, EN MÉMOIRE : le `.md` à écrire + les sites mesurés par type et par champ. UN SEUL
 * balayage du corpus nourrit les deux consommateurs — la fraîcheur du `.md` et le cas fondateur de
 * `src/data/field-consumers.test.ts`, qui appelle cette fonction EN PROCESSUS (le CLI ci-dessous
 * n'est qu'un autre appelant). Le cache de lecture/AST vit le temps de l'appel : il est créé ici,
 * partagé par tous les types de `TARGETS`, et libéré au retour.
 */
export function buildFieldConsumersMd(): { md: string; byType: Map<string, Map<string, Hit[]>>; totalFields: number; totalUnread: number } {
  const files = listProdFiles(SRC_DIR)
  const cache = new Map<string, { text: string; sf: unknown }>()

  let out = `# Consommateurs par champ — GÉNÉRÉ\n\n`
  out += `> ⚠️ Fichier GÉNÉRÉ par \`npx tsx scripts/docs/build-field-consumers.mts\` (\`npm run docs:field-consumers\`) — NE PAS ÉDITER À LA MAIN.\n`
  out += `> Pour chaque type de référence PARTAGÉ, qui LIT chaque champ (annotation de type explicite +\n`
  out += `> accès/déstructuration, cf. \`scripts/guards/lib/fieldConsumers.mjs\`). Complète\n`
  out += `> \`docs/orphelines-donnees.md\` (consommateurs d'ENTITÉ) — ici, consommateurs de CHAMP.\n\n`
  out += `## Périmètre mesuré / angles morts\n\n`
  out += `Schémas NOMMÉS candidats : \`src/data/schemas/grammaire/\` (formes partagées entre documents) + les `
  out += `\`src/data/schemas/defs/\` dont les sous-schémas sont nommés (\`criticals.ts\`, \`props.ts\`) ; `
  out += `**${TARGETS.length} retenus** (voir en-tête du générateur pour les raisons d'exclusion). Les catalogues `
  out += `\`src/data/schemas/defs/*.ts\` à schéma d'entrée ANONYME restent HORS PÉRIMÈTRE — sans alias TS nommé, `
  out += `ce détecteur ne peut pas y borner une lecture ; en SORTIR un catalogue est un geste d'auteur (nommer `
  out += `son schéma d'entrée dans SON def — ou en \`grammaire/\` si la forme est réellement partagée — puis `
  out += `l'ajouter à \`TARGETS\`), fait pour \`props.json\` → \`PropData\`.\n\n`
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
  const byType = new Map<string, Map<string, Hit[]>>()

  // Une cible porte SOIT son nœud zod (`schema`), SOIT ses clés déjà relevées (`cles` d'un handle
  // `document()`, dont le nœud est scellé et n'expose plus de `.shape`).
  for (const { schema, cles, type, home } of TARGETS as readonly { schema?: unknown; cles?: readonly string[]; type: string; home: string }[]) {
    const fields = fieldsOf(schema ?? cles)
    const hits = scanFieldReads(type, fields, files, ROOT, cache)
    const byField = groupByField(fields, hits)
    byType.set(type, byField)
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

  return { md: out, byType, totalFields, totalUnread }
}

/** CLI : écriture du `.md`, ou `--check` (chaîné dans `npm run docs:check`). */
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { md, totalFields, totalUnread } = buildFieldConsumersMd()
  emitOrCheck({
    out: md,
    path: OUT,
    check: process.argv.includes('--check'),
    staleMsg: `docs:field-consumers — ${OUT} est PÉRIMÉ (les schémas/le code source ont changé).`,
    rerunMsg: '  → relancer `npm run docs:field-consumers` et committer le résultat.',
    okMsg: `docs:field-consumers — OK (${OUT} à jour, ${totalUnread}/${totalFields} champs « 0 lecteur »)`,
    writeMsg: `${OUT} — ${totalUnread}/${totalFields} champs « 0 lecteur » sur ${TARGETS.length} types.`,
  })
}
