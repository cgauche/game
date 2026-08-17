# Consommateurs par champ — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `npx tsx scripts/docs/build-field-consumers.mts` (`npm run docs:field-consumers`) — NE PAS ÉDITER À LA MAIN.
> Pour chaque type de référence PARTAGÉ, qui LIT chaque champ (annotation de type explicite +
> accès/déstructuration, cf. `scripts/guards/lib/fieldConsumers.mjs`). Complète
> `docs/orphelines-donnees.md` (consommateurs d'ENTITÉ) — ici, consommateurs de CHAMP.

## Périmètre mesuré / angles morts

39 schémas NOMMÉS mesurés dans `src/data/schemas/common.ts` (37) + `src/data/schemas/defs/criticals.ts` (2) ; **17 retenus** (voir en-tête du générateur pour le détail des 22 exclus). Les 109 catalogues `src/data/schemas/defs/*.ts` (schéma d'entrée ANONYME par fichier) restent HORS PÉRIMÈTRE — sans alias TS nommé, ce détecteur ne peut pas y borner une lecture.

Détection SYNTAXIQUE (pas un vérificateur de types complet) : un identifiant doit être EXPLICITEMENT annoté du type cible. **Vérification manuelle des 16 champs « 0 lecteur »** de la première mesure (échantillon COMPLET, pas partiel) : 9/16 (56 %) sont des FAUX NÉGATIFS — un lecteur réel existe via une variable de type INFÉRÉ, un accès chaîné à travers un champ intermédiaire non annoté, ou une boucle `for…of` sur un tableau typé (détail + fichiers : en-tête du générateur). Taux trop élevé pour un cliquet CI fiable — ce rapport reste une mesure BRUTE, non ratchetée.

### `TraitInstance` (src/engine/statEntry.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 7 | `src/engine/creatureEquip.ts:73` |
| `value` | 6 | `src/engine/creatureEquip.ts:72` |
| `arg` | 8 | `src/engine/creatureEquip.ts:75` |
| `count` | 3 | `src/engine/grantedTraits.ts:31` |
| `range` | 6 | `src/engine/creatureEquip.ts:76` |
| `natural` | 1 | `src/engine/creatureEquip.ts:82` |
| `hidden` | **0 — JAMAIS LU** | — |

### `SourceRef` (src/data/schemas/common.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `book` | 1 | `src/ui/creator/CharacterCreator.tsx:1255` |
| `page` | 1 | `src/ui/creator/CharacterCreator.tsx:1255` |
| `note` | **0 — JAMAIS LU** | — |

### `DetailRecipe` (src/gameIso/detail/types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `courses` | 5 | `src/gameIso/authoring/roofsSvg.ts:137` |
| `bands` | 1 | `src/gameIso/detail/expand.ts:101` |
| `timber` | 4 | `src/gameIso/backends/webgl/faceBake.ts:84` |
| `speckle` | 6 | `src/gameIso/authoring/detailSvg.ts:414` |
| `tufts` | 9 | `src/gameIso/authoring/detailSvg.ts:409` |
| `tintVar` | 1 | `src/gameIso/backends/webgl/faceColors.ts:134` |
| `seedScope` | 1 | `src/gameIso/backends/webgl/groundAccents.ts:68` |

### `DiceSpec` (src/engine/dice.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `n` | 2 | `src/engine/dice.ts:61` |
| `sides` | 2 | `src/engine/dice.ts:61` |
| `plus` | 3 | `src/engine/dice.ts:61` |

### `Ref` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 3 | `src/data/index.ts:3059` |
| `spec` | 1 | `src/data/index.ts:3060` |

### `QualityRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 1 | `src/data/index.ts:3071` |
| `spec` | **0 — JAMAIS LU** | — |
| `value` | 2 | `src/data/index.ts:3071` |

### `CastingNumberMod` (src/engine/castingNumber.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `multiply` | 2 | `src/engine/castingNumber.ts:109` |
| `divide` | 2 | `src/engine/castingNumber.ts:110` |
| `round` | 2 | `src/engine/castingNumber.ts:110` |
| `delta` | 2 | `src/engine/castingNumber.ts:111` |
| `min` | 2 | `src/engine/castingNumber.ts:112` |
| `scope` | 1 | `src/ui/compendium/registry.ts:1019` |
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
| `id` | 4 | `src/data/index.ts:3117` |
| `spec` | 1 | `src/engine/trappingChoices.ts:36` |
| `count` | 3 | `src/data/index.ts:3118` |
| `qualities` | 2 | `src/data/index.ts:3121` |
| `qualityChoice` | 2 | `src/data/index.ts:3119` |
| `text` | 1 | `src/data/index.ts:3112` |
| `vehicleId` | 2 | `src/data/index.ts:3114` |
| `label` | **0 — JAMAIS LU** | — |
| `creatureId` | 2 | `src/data/index.ts:3116` |
| `choice` | 3 | `src/data/index.ts:3109` |
| `wildcard` | 1 | `src/data/index.ts:3110` |

### `AdvancementRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `ref` | 4 | `src/data/index.ts:3091` |
| `wildcard` | 5 | `src/data/index.ts:3093` |
| `specOptions` | 3 | `src/data/index.ts:3092` |
| `choice` | 4 | `src/data/index.ts:3095` |
| `random` | 2 | `src/data/index.ts:3096` |

### `EntityAppearance` (src/engine/authoringAppearance.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `seed` | 2 | `src/gameIso/rig/enemyProfile.ts:126` |
| `monster` | 4 | `src/gameIso/rig/enemyProfile.ts:127` |
| `colors` | 5 | `src/gameIso/rig/bodyPlan.ts:121` |
| `parts` | 2 | `src/gameIso/rig/enemyProfile.ts:130` |
| `sex` | 3 | `src/gameIso/rig/enemyProfile.ts:124` |
| `build` | 3 | `src/gameIso/rig/enemyProfile.ts:125` |
| `species` | 5 | `src/gameIso/AnimatedPlanToken.tsx:14` |
| `tenue` | 3 | `src/gameIso/rig/enemyProfile.ts:107` |
| `harnais` | 1 | `src/gameIso/rig/bodyPlan.ts:123` |
| `armurePortee` | **0 — JAMAIS LU** | — |
| `eyes` | 5 | `src/gameIso/rig/bodyPlan.ts:122` |
| `features` | 3 | `src/gameIso/rig/enemyProfile.ts:128` |

### `FlowTest` (src/engine/flowCore.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `stake` | 5 | `src/state/combat/triggeredTest.ts:206` |
| `skill` | 14 | `src/state/combat/triggeredTest.ts:193` |
| `spec` | 13 | `src/state/combat/triggeredTest.ts:193` |
| `sense` | 2 | `src/state/combatEffects.ts:435` |
| `characteristic` | 11 | `src/state/combat/triggeredTest.ts:193` |
| `difficulty` | 2 | `src/engine/flowCore.ts:370` |
| `requireSL` | 1 | `src/state/combatEffects.ts:474` |
| `label` | 6 | `src/state/combat/triggeredTest.ts:224` |
| `tool` | 1 | `src/state/combatEffects.ts:437` |
| `vsGroups` | 4 | `src/state/combatEffects.ts:342` |
| `vsStatus` | 1 | `src/state/combatEffects.ts:341` |
| `begging` | 3 | `src/state/combatEffects.ts:346` |
| `vsCapricieux` | 1 | `src/state/combatEffects.ts:350` |
| `easierIf` | 7 | `src/state/combatEffects.ts:391` |
| `argDifficulty` | **0 — JAMAIS LU** | — |
| `unlessImmune` | 1 | `src/state/combat/flowEval.ts:151` |
| `onlyGroups` | 1 | `src/state/combat/flowEval.ts:152` |
| `exceptGroups` | 1 | `src/state/combat/flowEval.ts:153` |
| `gate` | 1 | `src/engine/flowCore.ts:375` |
| `noSupport` | 1 | `src/state/combatEffects.ts:429` |
| `menace` | 5 | `src/state/combat/triggeredTest.ts:234` |
| `difficultyBy` | 1 | `src/engine/flowCore.ts:369` |
| `opposed` | 2 | `src/state/combat/triggeredTest.ts:293` |

### `TravelTableEntry` (src/engine/travelTables.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 1 | `src/ui/compendium/registry.ts:671` |
| `max` | 1 | `src/ui/compendium/registry.ts:671` |
| `id` | 4 | `src/engine/mountTravel.ts:197` |
| `label` | 2 | `src/engine/mountTravel.ts:196` |
| `text` | 1 | `src/ui/compendium/registry.ts:672` |
| `stageOutcome` | **0 — JAMAIS LU** | — |
| `vehicleWounds` | 1 | `src/ui/compendium/registry.ts:673` |
| `occupantOps` | 1 | `src/ui/compendium/registry.ts:674` |

### `ShipCrewTest` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `skillId` | 4 | `src/engine/shipCritical.ts:164` |
| `difficulty` | 3 | `src/engine/shipCritical.ts:164` |
| `crewTarget` | 2 | `src/engine/shipCritical.ts:161` |
| `onFail` | 2 | `src/engine/shipCritical.ts:168` |

### `ShipCritEntry` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 1 | `src/ui/compendium/registry.ts:685` |
| `max` | 1 | `src/ui/compendium/registry.ts:685` |
| `id` | 1 | `src/ui/compendium/registry.ts:684` |
| `label` | 1 | `src/ui/compendium/registry.ts:684` |
| `ops` | 1 | `src/ui/compendium/registry.ts:692` |
| `shrapnel` | 1 | `src/ui/compendium/registry.ts:688` |
| `hullCrits` | 1 | `src/ui/compendium/registry.ts:689` |
| `crewTest` | 1 | `src/ui/compendium/registry.ts:682` |
| `note` | 1 | `src/ui/compendium/registry.ts:686` |

### `CritEscalation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `fingerLossPerRound` | 1 | `src/engine/trauma.ts:422` |
| `amputateAfter1d10Days` | 1 | `src/engine/trauma.ts:423` |
| `amputateSequel` | 1 | `src/engine/trauma.ts:428` |
| `medicalAidGate` | 2 | `src/engine/trauma.ts:430` |
| `bleedOnReinjury` | 2 | `src/engine/trauma.ts:441` |
| `onRepeat` | **0 — JAMAIS LU** | — |
| `onNextCritWhileCondition` | 2 | `src/engine/trauma.ts:453` |
| `onHealGrant` | 2 | `src/engine/trauma.ts:447` |

### `Amputation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `difficulty` | 1 | `src/engine/critical.ts:79` |
| `sequels` | 1 | `src/engine/critical.ts:91` |
| `timing` | **0 — JAMAIS LU** | — |
| `loss` | 5 | `src/engine/critical.ts:74` |

## Synthèse

17 types, 120 champs mesurés, **14 avec « 0 lecteur » mesuré** (56 % réfutés à la main sur l'échantillon initial — cf. Périmètre mesuré ci-dessus ; pas de cliquet CI sur ce total).

## Cas fondateur

`TrappingRef.spec` : 1 lecteur(s) mesuré(s) — `trappingRefLabel` (`src/data/index.ts`, SOURCE UNIQUE du libellé affiché d'une `TrappingRef`) ne lit PAS `ref.spec` ; l'unique lecteur est `resolveOne` (`src/engine/trappingChoices.ts`), qui le RECOPIE sans le consommer.
