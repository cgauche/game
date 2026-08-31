# Consommateurs par champ — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `npx tsx scripts/docs/build-field-consumers.mts` (`npm run docs:field-consumers`) — NE PAS ÉDITER À LA MAIN.
> Pour chaque type de référence PARTAGÉ, qui LIT chaque champ (annotation de type explicite +
> accès/déstructuration, cf. `scripts/guards/lib/fieldConsumers.mjs`). Complète
> `docs/orphelines-donnees.md` (consommateurs d'ENTITÉ) — ici, consommateurs de CHAMP.

## Périmètre mesuré / angles morts

Schémas NOMMÉS candidats : `src/data/schemas/grammaire/` (formes partagées entre documents) + les `src/data/schemas/defs/` dont les sous-schémas sont nommés (`criticals.ts`, `props.ts`) ; **23 retenus** (voir en-tête du générateur pour les raisons d'exclusion). Les catalogues `src/data/schemas/defs/*.ts` à schéma d'entrée ANONYME restent HORS PÉRIMÈTRE — sans alias TS nommé, ce détecteur ne peut pas y borner une lecture ; en SORTIR un catalogue est un geste d'auteur (nommer son schéma d'entrée dans SON def — ou en `grammaire/` si la forme est réellement partagée — puis l'ajouter à `TARGETS`), fait pour `props.json` → `PropData`.

Détection SYNTAXIQUE (pas un vérificateur de types complet) : un identifiant doit être EXPLICITEMENT annoté du type cible. **Vérification manuelle des 16 champs « 0 lecteur »** de la première mesure (échantillon COMPLET, pas partiel) : 9/16 (56 %) sont des FAUX NÉGATIFS — un lecteur réel existe via une variable de type INFÉRÉ, un accès chaîné à travers un champ intermédiaire non annoté, ou une boucle `for…of` sur un tableau typé (détail + fichiers : en-tête du générateur). Taux trop élevé pour un cliquet CI fiable — ce rapport reste une mesure BRUTE, non ratchetée.

### `TraitInstance` (src/engine/statEntry.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 6 | `src/engine/creatureEquip.ts:77` |
| `value` | 6 | `src/engine/creatureEquip.ts:72` |
| `arg` | 8 | `src/engine/creatureEquip.ts:80` |
| `count` | 3 | `src/engine/grantedTraits.ts:31` |
| `range` | 6 | `src/engine/creatureEquip.ts:81` |
| `natural` | 1 | `src/engine/creatureEquip.ts:87` |
| `hidden` | **0 — JAMAIS LU** | — |

### `SourceRef` (src/data/schemas/grammaire/valeurs.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `book` | 1 | `src/ui/creator/CharacterCreator.tsx:1259` |
| `page` | 1 | `src/ui/creator/CharacterCreator.tsx:1259` |
| `note` | **0 — JAMAIS LU** | — |

### `DetailRecipe` (src/gameIso/detail/types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `courses` | 5 | `src/gameIso/authoring/roofsSvg.ts:137` |
| `bands` | 1 | `src/gameIso/detail/expand.ts:101` |
| `timber` | 4 | `src/gameIso/backends/webgl/faceBake.ts:85` |
| `speckle` | 6 | `src/gameIso/authoring/detailSvg.ts:414` |
| `tufts` | 9 | `src/gameIso/authoring/detailSvg.ts:409` |
| `tintVar` | 1 | `src/gameIso/backends/webgl/faceColors.ts:144` |
| `seedScope` | 1 | `src/gameIso/backends/webgl/groundAccents.ts:70` |

### `DiceSpec` (src/engine/dice.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `n` | 2 | `src/engine/dice.ts:78` |
| `sides` | 2 | `src/engine/dice.ts:78` |
| `plus` | 3 | `src/engine/dice.ts:78` |

### `Ref` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 4 | `src/data/index.ts:3337` |
| `spec` | 1 | `src/data/index.ts:3338` |

### `QualityRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 1 | `src/data/index.ts:3349` |
| `spec` | **0 — JAMAIS LU** | — |
| `value` | 2 | `src/data/index.ts:3349` |

### `CastingNumberMod` (src/engine/castingNumber.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `multiply` | 2 | `src/engine/castingNumber.ts:109` |
| `divide` | 2 | `src/engine/castingNumber.ts:110` |
| `round` | 2 | `src/engine/castingNumber.ts:110` |
| `delta` | 2 | `src/engine/castingNumber.ts:111` |
| `min` | 2 | `src/engine/castingNumber.ts:112` |
| `scope` | 1 | `src/ui/compendium/registry.ts:1036` |
| `maison` | **0 — JAMAIS LU** | — |
| `source` | **0 — JAMAIS LU** | — |
| `desc` | **0 — JAMAIS LU** | — |

### `CountSpec` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `fixed` | **0 — JAMAIS LU** | — |
| `roll` | **0 — JAMAIS LU** | — |

### `TrappingRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 4 | `src/data/index.ts:3400` |
| `spec` | 1 | `src/engine/trappingChoices.ts:36` |
| `count` | 3 | `src/data/index.ts:3401` |
| `qualities` | 2 | `src/data/index.ts:3404` |
| `qualityChoice` | 2 | `src/data/index.ts:3402` |
| `text` | 1 | `src/data/index.ts:3395` |
| `vehicleId` | 2 | `src/data/index.ts:3397` |
| `label` | **0 — JAMAIS LU** | — |
| `creatureId` | 2 | `src/data/index.ts:3399` |
| `choice` | 3 | `src/data/index.ts:3392` |
| `wildcard` | 1 | `src/data/index.ts:3393` |

### `AdvancementRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 7 | `src/data/index.ts:3371` |
| `spec` | 2 | `src/engine/careerSlots.ts:170` |
| `choix` | 6 | `src/data/index.ts:3370` |
| `pick` | 1 | `src/data/index.ts:3378` |
| `of` | 4 | `src/data/index.ts:3377` |
| `table` | **0 — JAMAIS LU** | — |
| `random` | 2 | `src/data/index.ts:3380` |

### `EntityAppearance` (src/engine/authoringAppearance.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `seed` | 2 | `src/gameIso/rig/enemyProfile.ts:127` |
| `monster` | 4 | `src/gameIso/rig/enemyProfile.ts:128` |
| `colors` | 5 | `src/gameIso/rig/bodyPlan.ts:122` |
| `parts` | 2 | `src/gameIso/rig/enemyProfile.ts:131` |
| `sex` | 3 | `src/gameIso/rig/enemyProfile.ts:125` |
| `build` | 3 | `src/gameIso/rig/enemyProfile.ts:126` |
| `species` | 5 | `src/gameIso/AnimatedPlanToken.tsx:14` |
| `tenue` | 3 | `src/gameIso/rig/enemyProfile.ts:108` |
| `harnais` | 1 | `src/gameIso/rig/bodyPlan.ts:124` |
| `armurePortee` | **0 — JAMAIS LU** | — |
| `eyes` | 5 | `src/gameIso/rig/bodyPlan.ts:123` |
| `features` | 3 | `src/gameIso/rig/enemyProfile.ts:129` |

### `FlowTest` (src/engine/flowCore.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `stake` | 5 | `src/state/combat/triggeredTest.ts:206` |
| `skill` | 14 | `src/state/combat/triggeredTest.ts:193` |
| `sense` | 2 | `src/state/combatEffects.ts:436` |
| `characteristic` | 11 | `src/state/combat/triggeredTest.ts:193` |
| `difficulty` | 2 | `src/engine/flowCore.ts:371` |
| `requireSL` | 1 | `src/state/combatEffects.ts:475` |
| `label` | 6 | `src/state/combat/triggeredTest.ts:224` |
| `tool` | 1 | `src/state/combatEffects.ts:438` |
| `vsGroups` | 4 | `src/state/combatEffects.ts:343` |
| `vsStatus` | 1 | `src/state/combatEffects.ts:342` |
| `begging` | 3 | `src/state/combatEffects.ts:347` |
| `vsCapricieux` | 1 | `src/state/combatEffects.ts:351` |
| `easierIf` | 7 | `src/state/combatEffects.ts:392` |
| `argDifficulty` | **0 — JAMAIS LU** | — |
| `unlessImmune` | 1 | `src/state/combat/flowEval.ts:151` |
| `onlyGroups` | 1 | `src/state/combat/flowEval.ts:152` |
| `exceptGroups` | 1 | `src/state/combat/flowEval.ts:153` |
| `gate` | 1 | `src/engine/flowCore.ts:376` |
| `noSupport` | 1 | `src/state/combatEffects.ts:430` |
| `menace` | 5 | `src/state/combat/triggeredTest.ts:234` |
| `difficultyBy` | 1 | `src/engine/flowCore.ts:370` |
| `opposed` | 2 | `src/state/combat/triggeredTest.ts:293` |

### `TravelTableEntry` (src/engine/travelTables.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 1 | `src/ui/compendium/registry.ts:692` |
| `max` | 1 | `src/ui/compendium/registry.ts:692` |
| `id` | 1 | `src/engine/mountTravel.ts:214` |
| `label` | 1 | `src/engine/mountTravel.ts:198` |
| `desc` | **0 — JAMAIS LU** | — |
| `stageOutcome` | **0 — JAMAIS LU** | — |
| `vehicleWounds` | 1 | `src/ui/compendium/registry.ts:693` |
| `occupantOps` | 1 | `src/ui/compendium/registry.ts:694` |
| `mount` | 1 | `src/engine/mountTravel.ts:199` |

### `ShipCrewTest` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `skill` | 5 | `src/engine/shipCritical.ts:164` |
| `char` | 4 | `src/engine/shipCritical.ts:164` |
| `difficulty` | 3 | `src/engine/shipCritical.ts:164` |
| `crewTarget` | 2 | `src/engine/shipCritical.ts:161` |
| `onFail` | 2 | `src/engine/shipCritical.ts:168` |

### `ShipCritEntry` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 1 | `src/ui/compendium/registry.ts:704` |
| `max` | 1 | `src/ui/compendium/registry.ts:704` |
| `id` | **0 — JAMAIS LU** | — |
| `label` | **0 — JAMAIS LU** | — |
| `ops` | 1 | `src/ui/compendium/registry.ts:711` |
| `shrapnel` | 1 | `src/ui/compendium/registry.ts:707` |
| `hullCrits` | 1 | `src/ui/compendium/registry.ts:708` |
| `crewTest` | 1 | `src/ui/compendium/registry.ts:702` |
| `note` | 1 | `src/ui/compendium/registry.ts:705` |

### `PropData` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | **0 — JAMAIS LU** | — |
| `type` | **0 — JAMAIS LU** | — |
| `label` | **0 — JAMAIS LU** | — |
| `labelF` | **0 — JAMAIS LU** | — |
| `desc` | **0 — JAMAIS LU** | — |
| `source` | **0 — JAMAIS LU** | — |
| `alsoIn` | **0 — JAMAIS LU** | — |
| `maison` | **0 — JAMAIS LU** | — |
| `icon` | **0 — JAMAIS LU** | — |
| `solid` | **0 — JAMAIS LU** | — |
| `opaque` | **0 — JAMAIS LU** | — |
| `cover` | **0 — JAMAIS LU** | — |
| `light` | **0 — JAMAIS LU** | — |
| `foot` | 1 | `src/data/props.types.ts:85` |
| `volume` | 1 | `src/gameIso/builders/propVolumes.ts:132` |
| `seatSlots` | **0 — JAMAIS LU** | — |

### `PropVolumeRecipe` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `primitives` | **0 — JAMAIS LU** | — |

### `PropPrimitive` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `kind` | 2 | `src/gameIso/builders/propVolumes.ts:118` |
| `center` | 3 | `src/gameIso/builders/propVolumes.ts:118` |
| `size` | 2 | `src/gameIso/builders/propVolumes.ts:118` |
| `material` | **0 — JAMAIS LU** | — |
| `radius` | 1 | `src/gameIso/builders/propVolumes.ts:119` |
| `heightM` | 1 | `src/gameIso/builders/propVolumes.ts:119` |
| `sides` | 1 | `src/gameIso/builders/propVolumes.ts:119` |
| `slope` | 1 | `src/gameIso/builders/propVolumes.ts:120` |

### `PropSeatSlot` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | **0 — JAMAIS LU** | — |
| `anchor` | **0 — JAMAIS LU** | — |
| `facing` | **0 — JAMAIS LU** | — |
| `approach` | **0 — JAMAIS LU** | — |

### `PropPoint3` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `x` | 4 | `src/gameIso/builders/propVolumes.ts:40` |
| `y` | 4 | `src/gameIso/builders/propVolumes.ts:40` |
| `h` | 4 | `src/gameIso/builders/propVolumes.ts:40` |

### `PropSize3` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `x` | **0 — JAMAIS LU** | — |
| `y` | **0 — JAMAIS LU** | — |
| `h` | **0 — JAMAIS LU** | — |

### `CritEscalation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `perRound` | 1 | `src/engine/trauma.ts:530` |
| `apresDelai` | 2 | `src/engine/trauma.ts:531` |
| `medicalAidGate` | 2 | `src/engine/trauma.ts:538` |
| `bleedOnReinjury` | 2 | `src/engine/trauma.ts:549` |
| `onRepeat` | **0 — JAMAIS LU** | — |
| `onNextCritWhileCondition` | 2 | `src/engine/trauma.ts:561` |
| `onHealGrant` | 2 | `src/engine/trauma.ts:555` |

### `Amputation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `difficulty` | 1 | `src/engine/critical.ts:64` |
| `sequels` | 1 | `src/engine/critical.ts:79` |
| `unites` | 1 | `src/engine/critical.ts:77` |
| `timing` | **0 — JAMAIS LU** | — |
| `loss` | 5 | `src/engine/critical.ts:59` |

## Synthèse

23 types, 158 champs mesurés, **41 avec « 0 lecteur » mesuré** (56 % réfutés à la main sur l'échantillon initial — cf. Périmètre mesuré ci-dessus ; pas de cliquet CI sur ce total).

## Cas fondateur

`TrappingRef.spec` : 1 lecteur(s) mesuré(s) — `trappingRefLabel` (`src/data/index.ts`, SOURCE UNIQUE du libellé affiché d'une `TrappingRef`) ne lit PAS `ref.spec` ; l'unique lecteur est `resolveOne` (`src/engine/trappingChoices.ts`), qui le RECOPIE sans le consommer.
