# Consommateurs par champ — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `npx tsx scripts/docs/build-field-consumers.mts` (`npm run docs:field-consumers`) — NE PAS ÉDITER À LA MAIN.
> Pour chaque type de référence PARTAGÉ, qui LIT chaque champ (accès/déstructuration résolus au
> `TypeChecker`, cf. `scripts/guards/lib/fieldConsumers.mjs`). Complète
> `docs/orphelines-donnees.md` (consommateurs d'ENTITÉ) — ici, consommateurs de CHAMP.

## Périmètre mesuré / angles morts

Schémas NOMMÉS candidats : `src/data/schemas/grammaire/` (formes partagées entre documents) + les `src/data/schemas/defs/` dont les sous-schémas sont nommés (`criticals.ts`, `props.ts`) ; **23 retenus** (voir en-tête du générateur pour les raisons d'exclusion). Les catalogues `src/data/schemas/defs/*.ts` à schéma d'entrée ANONYME restent HORS PÉRIMÈTRE — non par absence de nom TS : l'alias existe pour la plupart (41 interfaces `XData` dans `src/data/index.ts`, mesure 2026-09-01 — ex. `TrappingData` `index.ts:1113`, annotée par `src/engine/items.ts:20` et `src/engine/activities.ts:28`) et les champs d'une entrée anonyme sont dérivables (`scripts/docs/lib/zod-introspect.mts#introspecterDefs`) —, mais parce que la DÉRIVATION de `TARGETS` (jointure `type`↔`XData`) est un geste distinct, encore à faire (#1620) ; à l'unité, le geste d'auteur reste ouvert (nommer son schéma d'entrée dans SON def — ou en `grammaire/` si la forme est réellement partagée — puis l'ajouter à `TARGETS`), fait pour `props.json` → `PropData`.

Détection au VÉRIFICATEUR DE TYPES (`ts.Program`/`TypeChecker`) : un lecteur est un accès dont le SYMBOLE de propriété est celui déclaré par le type cible, la propriété devant lui être PROPRE ou son porteur être DÉCLARÉ de ce type — aucune annotation littérale n'est cherchée, et un type anonyme de même forme ne crédite rien. Quatre états sont mesurés, dont deux ne sont pas des mesures de lecture (hérité, absent du type TS) ; ceux qui ont des membres ici : **145 lus** ; **6 « 0 — JAMAIS LU »** (`SourceRef.note`, `CastingNumberMod.maison`, `CastingNumberMod.source`, `CastingNumberMod.desc`, `PropData.type`, `PropData.label`) — champ PROPRE au type, aucun lecteur ; **7 absents du type TS** (`AdvancementRef.table`, `PropData.labelF`, `PropData.desc`, `PropData.source`, `PropData.alsoIn`, `PropData.maison`, `PropData.icon`) — le champ du schéma n'existe pas sur le type : divergence schéma↔type, listée en fin de rapport, sur 158 champs de 23 types.

Le détecteur SYNTAXIQUE qui a précédé (annotation littérale du type) rendait 41 champs « 0 lecteur » sur ces mêmes 158. Des 16 « 0 lecteur » de la première version de ce rapport (échantillon COMPLET), 12 ont un lecteur mesuré — dont `argDifficulty` et `stageOutcome`, qu'une vérification à la main manque comme le scan syntaxique, `spec` d'une `QualityRef` (champ PROPRE : `qualityRefSchema` porte son propre shape) et `hidden` d'un `TraitInstance` (`hiddenGroupsOf` annote `TraitInstance[]`) ; les 4 autres sont de vrais zéros. Coût : ~17 s et ~1,3 Go pour un rapport complet, contre 1,8 s au scan syntaxique. Angles morts (redéclaration structurelle, spread, clé dynamique, champ absent du type) : en-tête de `fieldConsumers.mjs`.

### `TraitInstance` (src/engine/statEntry.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 62 | `src/engine/combatFeatures/dispatch.ts:214` |
| `value` | 14 | `src/engine/creatureAttacks.ts:97` |
| `arg` | 17 | `src/engine/creatureAttacks.ts:94` |
| `count` | 4 | `src/engine/creatureAttacks.ts:102` |
| `range` | 6 | `src/engine/creatureEquip.ts:81` |
| `natural` | 1 | `src/engine/creatureEquip.ts:87` |
| `hidden` | 1 | `src/engine/groups.ts:57` |

### `SourceRef` (src/data/schemas/grammaire/valeurs.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `book` | 11 | `src/data/sourceRefs.ts:29` |
| `page` | 10 | `src/ui/CarnetScreen.tsx:25` |
| `note` | **0 — JAMAIS LU** | — |

### `DetailRecipe` (src/gameIso/detail/types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `courses` | 20 | `src/gameIso/authoring/detailSvg.ts:119` |
| `bands` | 1 | `src/gameIso/detail/expand.ts:101` |
| `timber` | 9 | `src/gameIso/authoring/detailSvg.ts:351` |
| `speckle` | 9 | `src/gameIso/authoring/detailSvg.ts:332` |
| `tufts` | 10 | `src/gameIso/authoring/detailSvg.ts:409` |
| `tintVar` | 4 | `src/gameIso/authoring/detailSvg.ts:177` |
| `seedScope` | 4 | `src/gameIso/authoring/detailSvg.ts:333` |

### `DiceSpec` (src/engine/dice.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `n` | 10 | `src/engine/dice.ts:78` |
| `sides` | 10 | `src/engine/dice.ts:78` |
| `plus` | 8 | `src/engine/dice.ts:78` |

### `Ref` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 61 | `src/data/index.ts:2900` |
| `spec` | 19 | `src/data/index.ts:3411` |

### `QualityRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 4 | `src/data/index.ts:3423` |
| `spec` | 1 | `src/data/index.ts:3424` |
| `value` | 3 | `src/data/index.ts:3425` |

### `CastingNumberMod` (src/engine/castingNumber.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `multiply` | 2 | `src/engine/castingNumber.ts:109` |
| `divide` | 2 | `src/engine/castingNumber.ts:110` |
| `round` | 2 | `src/engine/castingNumber.ts:110` |
| `delta` | 2 | `src/engine/castingNumber.ts:111` |
| `min` | 2 | `src/engine/castingNumber.ts:112` |
| `scope` | 2 | `src/engine/castingNumber.ts:127` |
| `maison` | **0 — JAMAIS LU** | — |
| `source` | **0 — JAMAIS LU** | — |
| `desc` | **0 — JAMAIS LU** | — |

### `CountSpec` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `fixed` | 4 | `src/data/index.ts:3487` |
| `roll` | 3 | `src/data/index.ts:3487` |

### `TrappingRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 8 | `src/engine/items.ts:307` |
| `spec` | 2 | `src/engine/items.ts:309` |
| `count` | 10 | `src/data/index.ts:3487` |
| `qualities` | 4 | `src/data/index.ts:3490` |
| `qualityChoice` | 6 | `src/data/index.ts:3488` |
| `text` | 2 | `src/data/index.ts:3481` |
| `vehicleId` | 5 | `src/data/index.ts:3483` |
| `label` | 7 | `src/engine/possessionGrants.ts:25` |
| `creatureId` | 5 | `src/data/index.ts:3485` |
| `choice` | 5 | `src/data/index.ts:3478` |
| `wildcard` | 3 | `src/data/index.ts:3479` |

### `AdvancementRef` (src/data/index.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 8 | `src/data/index.ts:3460` |
| `spec` | 2 | `src/engine/careerSlots.ts:170` |
| `choix` | 7 | `src/data/index.ts:2900` |
| `pick` | 2 | `src/data/index.ts:3463` |
| `of` | 6 | `src/data/index.ts:3462` |
| `table` | — | *absent du type TS* |
| `random` | 3 | `src/data/index.ts:3465` |

### `EntityAppearance` (src/engine/authoringAppearance.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `seed` | 5 | `src/gameIso/rig/enemyProfile.ts:127` |
| `monster` | 12 | `src/gameIso/rig/enemyProfile.ts:128` |
| `colors` | 13 | `src/gameIso/rig/bodyPlan.ts:122` |
| `parts` | 5 | `src/gameIso/rig/enemyProfile.ts:131` |
| `sex` | 8 | `src/gameIso/rig/enemyProfile.ts:125` |
| `build` | 8 | `src/gameIso/rig/enemyProfile.ts:126` |
| `species` | 19 | `src/gameIso/rig/bodyPlan.ts:166` |
| `tenue` | 7 | `src/gameIso/rig/enemyProfile.ts:108` |
| `harnais` | 2 | `src/gameIso/rig/bodyPlan.ts:124` |
| `armurePortee` | 5 | `src/gameIso/rig/enemyProfile.ts:187` |
| `eyes` | 13 | `src/gameIso/rig/bodyPlan.ts:123` |
| `features` | 9 | `src/gameIso/rig/enemyProfile.ts:129` |

### `FlowTest` (src/engine/flowCore.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `stake` | 10 | `src/engine/flowCore.ts:809` |
| `skill` | 30 | `src/engine/disease.ts:341` |
| `sense` | 2 | `src/state/combatEffects.ts:437` |
| `characteristic` | 24 | `src/engine/disease.ts:341` |
| `difficulty` | 8 | `src/engine/disease.ts:328` |
| `requireSL` | 2 | `src/state/combatEffects.ts:476` |
| `label` | 11 | `src/state/combat/triggeredTest.ts:225` |
| `tool` | 2 | `src/state/combatEffects.ts:439` |
| `vsGroups` | 5 | `src/state/combatEffects.ts:344` |
| `vsStatus` | 1 | `src/state/combatEffects.ts:343` |
| `begging` | 3 | `src/state/combatEffects.ts:348` |
| `vsCapricieux` | 1 | `src/state/combatEffects.ts:352` |
| `easierIf` | 11 | `src/state/combatEffects.ts:393` |
| `argDifficulty` | 1 | `src/state/triggeredEffects.ts:74` |
| `unlessImmune` | 1 | `src/state/combat/flowEval.ts:151` |
| `onlyGroups` | 1 | `src/state/combat/flowEval.ts:152` |
| `exceptGroups` | 1 | `src/state/combat/flowEval.ts:153` |
| `gate` | 1 | `src/engine/flowCore.ts:376` |
| `noSupport` | 4 | `src/state/combat/triggeredTest.ts:784` |
| `menace` | 7 | `src/state/combat/triggeredTest.ts:235` |
| `difficultyBy` | 1 | `src/engine/flowCore.ts:370` |
| `opposed` | 5 | `src/state/combat/triggeredTest.ts:294` |

### `TravelTableEntry` (src/engine/travelTables.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 2 | `src/state/travelFlow.ts:1145` |
| `max` | 1 | `src/ui/compendium/registry.ts:744` |
| `id` | 8 | `src/engine/mountTravel.ts:214` |
| `label` | 8 | `src/engine/mountTravel.ts:198` |
| `desc` | 1 | `src/state/travelPostes.ts:362` |
| `stageOutcome` | 1 | `src/state/travelPostes.ts:363` |
| `vehicleWounds` | 3 | `src/engine/vehicle.ts:59` |
| `occupantOps` | 3 | `src/state/travelFlow.ts:1149` |
| `mount` | 2 | `src/engine/mountTravel.ts:199` |

### `ShipCrewHit` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `crewTarget` | 2 | `src/engine/shipCritical.ts:243` |
| `test` | 5 | `src/engine/shipCritical.ts:66` |
| `ops` | 2 | `src/engine/shipCritical.ts:246` |

### `ShipCritEntry` (src/data/shipCriticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `min` | 1 | `src/ui/compendium/registry.ts:767` |
| `max` | 1 | `src/ui/compendium/registry.ts:767` |
| `id` | 3 | `src/data/index.ts:479` |
| `label` | 2 | `src/engine/shipCritical.ts:107` |
| `ops` | 3 | `src/engine/riverNavigation.ts:213` |
| `shrapnel` | 3 | `src/engine/shipCritical.ts:110` |
| `hullCrits` | 2 | `src/engine/shipCritical.ts:103` |
| `crewHit` | 2 | `src/engine/shipCritical.ts:112` |
| `note` | 2 | `src/engine/shipCritical.ts:113` |

### `PropData` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 11 | `src/data/index.ts:2674` |
| `type` | **0 — JAMAIS LU** | — |
| `label` | **0 — JAMAIS LU** | — |
| `labelF` | — | *absent du type TS* |
| `desc` | — | *absent du type TS* |
| `source` | — | *absent du type TS* |
| `alsoIn` | — | *absent du type TS* |
| `maison` | — | *absent du type TS* |
| `icon` | — | *absent du type TS* |
| `solid` | 2 | `src/data/props.types.ts:616` |
| `opaque` | 3 | `src/data/props.types.ts:581` |
| `cover` | 3 | `src/data/props.types.ts:581` |
| `light` | 3 | `src/data/props.types.ts:590` |
| `foot` | 2 | `src/data/props.types.ts:371` |
| `volume` | 18 | `src/data/index.ts:2680` |
| `seatSlots` | 3 | `src/data/props.types.ts:399` |

### `PropVolumeRecipe` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `capIdentite` | 2 | `src/data/props.types.ts:575` |
| `primitives` | 6 | `src/data/props.types.ts:448` |

### `PropPrimitive` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `kind` | 5 | `src/data/props.types.ts:273` |
| `center` | 6 | `src/data/props.types.ts:273` |
| `size` | 3 | `src/data/props.types.ts:273` |
| `material` | 4 | `src/data/props.types.ts:537` |
| `emet` | 2 | `src/data/props.types.ts:587` |
| `radiusM` | 2 | `src/data/props.types.ts:274` |
| `heightM` | 2 | `src/data/props.types.ts:274` |
| `sides` | 2 | `src/data/props.types.ts:274` |
| `slope` | 1 | `src/data/props.types.ts:275` |

### `PropSeatSlot` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `id` | 5 | `src/data/props.types.ts:600` |
| `anchor` | 5 | `src/data/props.types.ts:400` |
| `facing` | 1 | `src/state/seating.ts:157` |
| `approach` | 2 | `src/data/props.types.ts:527` |

### `PropPoint3` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `xM` | 16 | `src/data/props.types.ts:167` |
| `yM` | 16 | `src/data/props.types.ts:166` |
| `hM` | 15 | `src/data/props.types.ts:166` |

### `PropSize3` (src/data/props.types.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `xM` | 3 | `src/data/props.types.ts:196` |
| `yM` | 3 | `src/data/props.types.ts:197` |
| `hM` | 3 | `src/data/props.types.ts:198` |

### `CritEscalation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `perRound` | 1 | `src/engine/trauma.ts:572` |
| `apresDelai` | 2 | `src/engine/trauma.ts:573` |
| `medicalAidGate` | 2 | `src/engine/trauma.ts:577` |
| `bleedOnReinjury` | 2 | `src/engine/trauma.ts:588` |
| `onRepeat` | 1 | `src/engine/critical.ts:312` |
| `onNextCritWhileCondition` | 2 | `src/engine/trauma.ts:600` |
| `onHealGrant` | 2 | `src/engine/trauma.ts:594` |

### `Amputation` (src/data/criticals.ts)

| Champ | Lecteurs | Exemple |
|---|---|---|
| `difficulty` | 1 | `src/engine/critical.ts:87` |
| `sequels` | 1 | `src/engine/critical.ts:76` |
| `unites` | 1 | `src/engine/critical.ts:77` |
| `timing` | 2 | `src/engine/critical.ts:327` |
| `loss` | 4 | `src/engine/critical.ts:74` |

## Champs du schéma ABSENTS du type TS

7 champs déclarés au SCHÉMA n'existent pas sur le type TS de leur `home` : `AdvancementRef.table`, `PropData.labelF`, `PropData.desc`, `PropData.source`, `PropData.alsoIn`, `PropData.maison`, `PropData.icon`. Divergence schéma↔type — ni lus ni lisibles, hors du compte des « 0 lecteur ».

## Synthèse

23 types, 158 champs mesurés : 145 lus, **6 avec « 0 lecteur » mesuré** au `TypeChecker`, 0 hérité, 7 absents du type TS. Ces « 0 lecteur » sont sous CLIQUET NOMINATIF (`src/data/field-consumers.test.ts`) : la liste attendue y est écrite champ par champ — un zéro apparu comme un zéro disparu est rouge, et la ligne ne se retire qu'avec le lecteur qui l'annule.

## Cas fondateur

Le champ `spec` d'une référence de dotation a 2 lecteur(s) mesuré(s) — `src/engine/items.ts:309`, `src/engine/trappingChoices.ts:36`.

`trappingRefLabel` (`src/data/index.ts`, SOURCE UNIQUE du libellé affiché d'une `TrappingRef`) ne lit PAS `ref.spec` — le rendu « base (spec) » passe par `refConcrete`, partagée par toute `Ref`.
<!-- sources-empreinte: fed8a37f1e12745641f43516c6bc08fc901627ca (2090 fichiers, 171 dossiers) corps: 73644939390c9f2f847fd8f9b289a9d456dd14f4 -->
