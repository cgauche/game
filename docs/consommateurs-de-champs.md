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
| `book` | 1 | `src/ui/creator/CharacterCreator.tsx:1256` |
| `page` | 1 | `src/ui/creator/CharacterCreator.tsx:1256` |
| `note` | **0 — JAMAIS LU** | — |

### `DetailRecipe` (src/gameIso/detail/types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `courses` | 5 | `src/gameIso/backends/affineRoofs.ts:130` |
| `bands` | 1 | `src/gameIso/detail/expand.ts:86` |
| `timber` | 2 | `src/gameIso/detail/expand.ts:91` |
| `speckle` | 6 | `src/gameIso/backends/affineDetail.ts:477` |
| `tufts` | 9 | `src/gameIso/backends/affineDetail.ts:472` |
| `tintVar` | **0 — JAMAIS LU** | — |
| `seedScope` | 2 | `src/gameIso/pov/geometry.ts:330` |

### `DiceSpec` (src/engine/dice.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `n` | 2 | `src/engine/dice.ts:61` |
| `sides` | 2 | `src/engine/dice.ts:61` |
| `plus` | 3 | `src/engine/dice.ts:61` |

### `Ref` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 3 | `src/data/index.ts:2869` |
| `spec` | 1 | `src/data/index.ts:2870` |

### `QualityRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 1 | `src/data/index.ts:2875` |
| `spec` | **0 — JAMAIS LU** | — |
| `value` | 2 | `src/data/index.ts:2875` |

### `CastingNumberMod` (src/engine/castingNumber.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `multiply` | 2 | `src/engine/castingNumber.ts:109` |
| `divide` | 2 | `src/engine/castingNumber.ts:110` |
| `round` | 2 | `src/engine/castingNumber.ts:110` |
| `delta` | 2 | `src/engine/castingNumber.ts:111` |
| `min` | 2 | `src/engine/castingNumber.ts:112` |
| `scope` | 1 | `src/ui/compendium/registry.ts:1002` |
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
| `id` | 4 | `src/data/index.ts:2919` |
| `spec` | 1 | `src/engine/trappingChoices.ts:36` |
| `count` | 3 | `src/data/index.ts:2920` |
| `qualities` | 2 | `src/data/index.ts:2923` |
| `qualityChoice` | 2 | `src/data/index.ts:2921` |
| `text` | 1 | `src/data/index.ts:2914` |
| `vehicleId` | 2 | `src/data/index.ts:2916` |
| `label` | **0 — JAMAIS LU** | — |
| `creatureId` | 2 | `src/data/index.ts:2918` |
| `choice` | 3 | `src/data/index.ts:2911` |
| `wildcard` | 1 | `src/data/index.ts:2912` |

### `AdvancementRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `ref` | 4 | `src/data/index.ts:2893` |
| `wildcard` | 5 | `src/data/index.ts:2895` |
| `specOptions` | 3 | `src/data/index.ts:2894` |
| `choice` | 4 | `src/data/index.ts:2897` |
| `random` | 2 | `src/data/index.ts:2898` |

### `EntityAppearance` (src/engine/authoringAppearance.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `seed` | 2 | `src/gameIso/rig/enemyProfile.ts:126` |
| `monster` | 4 | `src/gameIso/rig/enemyProfile.ts:127` |
| `colors` | 5 | `src/gameIso/rig/bodyPlan.ts:121` |
| `parts` | 2 | `src/gameIso/rig/enemyProfile.ts:130` |
| `sex` | 3 | `src/gameIso/rig/enemyProfile.ts:124` |
| `build` | 3 | `src/gameIso/rig/enemyProfile.ts:125` |
| `species` | 6 | `src/gameIso/AnimatedPlanToken.tsx:14` |
| `tenue` | 3 | `src/gameIso/rig/enemyProfile.ts:107` |
| `harnais` | 1 | `src/gameIso/rig/bodyPlan.ts:123` |
| `armurePortee` | **0 — JAMAIS LU** | — |
| `eyes` | 5 | `src/gameIso/rig/bodyPlan.ts:122` |
| `features` | 3 | `src/gameIso/rig/enemyProfile.ts:128` |

### `FlowTest` (src/engine/flowCore.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `stake` | 2 | `src/state/combat/triggeredTest.ts:197` |
| `skill` | 9 | `src/state/combat/triggeredTest.ts:189` |
| `spec` | 8 | `src/state/combat/triggeredTest.ts:189` |
| `sense` | 1 | `src/state/combatEffects.ts:391` |
| `characteristic` | 8 | `src/state/combat/triggeredTest.ts:189` |
| `difficulty` | 2 | `src/engine/flowCore.ts:370` |
| `requireSL` | 1 | `src/state/combatEffects.ts:418` |
| `label` | 3 | `src/state/combat/triggeredTest.ts:192` |
| `tool` | 1 | `src/state/combatEffects.ts:393` |
| `vsGroups` | 3 | `src/state/combatEffects.ts:325` |
| `vsStatus` | 1 | `src/state/combatEffects.ts:324` |
| `begging` | 2 | `src/state/combatEffects.ts:329` |
| `vsCapricieux` | 1 | `src/state/combatEffects.ts:333` |
| `easierIf` | 7 | `src/state/combatEffects.ts:354` |
| `argDifficulty` | **0 — JAMAIS LU** | — |
| `unlessImmune` | 1 | `src/state/combat/flowEval.ts:71` |
| `onlyGroups` | 1 | `src/state/combat/flowEval.ts:72` |
| `exceptGroups` | 1 | `src/state/combat/flowEval.ts:73` |
| `gate` | 1 | `src/engine/flowCore.ts:375` |
| `noSupport` | 1 | `src/state/combatEffects.ts:386` |
| `menace` | 1 | `src/state/combat/triggeredTest.ts:201` |
| `difficultyBy` | 1 | `src/engine/flowCore.ts:369` |
| `opposed` | **0 — JAMAIS LU** | — |

### `TravelTableEntry` (src/engine/travelTables.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 1 | `src/ui/compendium/registry.ts:669` |
| `max` | 1 | `src/ui/compendium/registry.ts:669` |
| `id` | 4 | `src/engine/mountTravel.ts:192` |
| `label` | 2 | `src/engine/mountTravel.ts:191` |
| `text` | 1 | `src/ui/compendium/registry.ts:670` |
| `stageOutcome` | **0 — JAMAIS LU** | — |
| `vehicleWounds` | 1 | `src/ui/compendium/registry.ts:671` |
| `occupantOps` | 1 | `src/ui/compendium/registry.ts:672` |

### `ShipCrewTest` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `skillId` | 4 | `src/engine/shipCritical.ts:149` |
| `difficulty` | 3 | `src/engine/shipCritical.ts:149` |
| `crewTarget` | 2 | `src/engine/shipCritical.ts:146` |
| `onFail` | 2 | `src/engine/shipCritical.ts:153` |

### `ShipCritEntry` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 1 | `src/ui/compendium/registry.ts:683` |
| `max` | 1 | `src/ui/compendium/registry.ts:683` |
| `id` | 1 | `src/ui/compendium/registry.ts:682` |
| `label` | 1 | `src/ui/compendium/registry.ts:682` |
| `ops` | 1 | `src/ui/compendium/registry.ts:690` |
| `shrapnel` | 1 | `src/ui/compendium/registry.ts:686` |
| `hullCrits` | 1 | `src/ui/compendium/registry.ts:687` |
| `crewTest` | 1 | `src/ui/compendium/registry.ts:680` |
| `note` | 1 | `src/ui/compendium/registry.ts:684` |

### `CritEscalation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `fingerLossPerRound` | 1 | `src/engine/trauma.ts:419` |
| `amputateAfter1d10Days` | 1 | `src/engine/trauma.ts:420` |
| `amputateSequel` | 1 | `src/engine/trauma.ts:425` |
| `medicalAidGate` | 2 | `src/engine/trauma.ts:427` |
| `bleedOnReinjury` | 2 | `src/engine/trauma.ts:438` |
| `onRepeat` | **0 — JAMAIS LU** | — |
| `onNextCritWhileCondition` | 2 | `src/engine/trauma.ts:450` |
| `onHealGrant` | 2 | `src/engine/trauma.ts:444` |

### `Amputation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `difficulty` | 1 | `src/engine/critical.ts:79` |
| `sequels` | 1 | `src/engine/critical.ts:91` |
| `timing` | **0 — JAMAIS LU** | — |
| `loss` | 5 | `src/engine/critical.ts:74` |

## Synthèse

17 types, 120 champs mesurés, **16 avec « 0 lecteur » mesuré** (56 % réfutés à la main sur l'échantillon initial — cf. Périmètre mesuré ci-dessus ; pas de cliquet CI sur ce total).

## Cas fondateur

`TrappingRef.spec` : 1 lecteur(s) mesuré(s) — `trappingRefLabel` (`src/data/index.ts`, SOURCE UNIQUE du libellé affiché d'une `TrappingRef`) ne lit PAS `ref.spec` ; l'unique lecteur est `resolveOne` (`src/engine/trappingChoices.ts`), qui le RECOPIE sans le consommer.
