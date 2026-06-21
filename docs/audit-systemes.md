# Audit & recensement des systèmes — RPG WFRP4 (web)

> Vision globale de TOUS les systèmes de l'application : couche, rôle, consommateurs, et dette.
> Établi par deux passages : (1) cartographie de l'existant ; (2) passage adversarial instrumenté
> (métriques, jq, vérifications directes). On **ignore** les commentaires auto-élogieux du code.
>
> Boussole : data-driven · règles optionnelles · multilangue · zéro doublon/legacy/deprecated/dette/
> rétro-compat · respect du RAW.

Architecture en couches : **`data/` → `engine/` (pur) → `state/` (Zustand) → présentation (`ui/`,`gameIso/`)**
+ transverses (`net/`, `audio/`, `i18n/`). Règle : le state applique des résultats du moteur pur ; jamais l'inverse.

---

## A. Couche DONNÉES — `src/data/` + registres `/defs/`

### A.1 JSON app-owned (~43 fichiers, source canonique, éditables au Compendium)
- **Profils & règles** : `species`, `classes`, `careers`, `careerLevels`, `skills`, `talents`, `qualities`,
  `traits`, `etats`, `maladies`, `mutations` + `mutationTables`.
- **Bestiaire** : `creatures` (officiel + homebrew frenchy mergé).
- **Magie & foi** : `spells` (+ `frenchy-spells` mergé), `domains`, `gods`.
- **Inventaire** : `trappings`, `weaponGroups`.
- **Apparence** : `raceAppearance`, `eyes`, `hairs`, `details`, `names`.
- **Scénario** : `oups`, `interludeEvents`, `peripeties`, `pregens`.
- **Métadonnées** : `books`, `locations`, `stars`, `lightLevels`, `maneuvers`.
- **Tables verbatim LDB** : `criticals`, `advancementCosts`.
- **Accès** : `data/index.ts` (1012 l.) — exports + lookups `id→label` (point unique).

### A.2 Registres `/defs/` (CODE, présentation, jamais lus par le moteur)
- Rig créatures/races/gabarits/armes/tenues/éléments (`gameIso/rig/.../defs/` + `_registry.generated.ts`).
- Décor & bâtiments (`gameIso/catalog/{decor,buildings}/defs/`).
- Terrains (`state/terrain/defs/`). Marchands (`state/merchants/defs/`). Audio (`audio/defs/`).

---

## B. Couche MOTEUR — `src/engine/` (pur, ~70 fichiers, testé Vitest)

1. **Tests & Degrés de Réussite** — `tests.ts` (rollTest/evaluateTest/opposedTest, bandes auto).
2. **Combat** — `combat.ts` (943 l. : touche, localisation inversée, dégâts, critiques, parade/esquive, initiative).
3. **Caractéristiques** — `characteristics.ts` (effectiveChar, bonus, Blessures max, encombrement, Mouvement).
4. **Cadence** — `cadence.ts` (mode round manuel/rapide/auto via règle optionnelle).
5. **Psychologie** — `psychology.ts` (peur, terreur, frénésie, animosité, haine, tests de Calme).
6. **Magie** — `magic.ts` (635 l.), `miscast.ts`, `grimoire.ts`, `spellspec.ts` (incantation, focalisation,
   Imparfaites, colère des dieux, ZdE, contresort).
7. **Corruption & mutations** — `corruption.ts`, `mutations.ts`.
8. **Création** — `character.ts`, `creation.ts`, `careerSlots.ts`, `talentEffects.ts`.
9. **Avancement** — `advancement.ts` (coûts PX data-driven).
10. **Inventaire/objets** — `items.ts` (611 l. : loadout, qualités, encombrement, mains).
11. **Compétences** — `skills.ts`. **Équipement créature** — `creatureEquip.ts`.
12. **États / durées** — `conditions.ts` (`endOfRound()` + décrément durées).
13. **Passifs unifiés** — `trauma.ts` (`passiveMods` : collecteur UNIQUE des modificateurs persistants).
14. **Vocabulaire d'effets** — `ops.ts` (1176 l., ~65 GameOp + `applyOps`).
15. **Règles optionnelles** — `policy.ts` (`OPTIONAL_RULES` ~23, `rule()`).
16. **Dispatch traits/qualités** — `traits/dispatch.ts`, `qualities/dispatch.ts`, `traits/registry.ts`.
17. **Social** — `social.ts` (statut/échelon). **Argent** — `money.ts`. **Types** — `types.ts` (746 l.).

---

## C. Couche ÉTAT — `src/state/` (~69 fichiers)

### C.1 Cœur & infrastructure
18. **Store central** — `store.ts` (1453 l., 165 importateurs).
19. **Champs d'état** — `stateFields.ts` (`initialFields`/`resetFields`, clés de snapshot).
20. **Sauvegarde** — `saves.ts` (snapshot déterministe, 3 slots localStorage, import/export).
21. **Bus d'événements** — `bus.ts` (découplage state↔rendu/audio).
22. **RNG seedé** — `battleRng.ts` (déterminisme golden). **Identité** — `entityId.ts`, `dir8.ts`.
23. **Devtools** — `devtools.ts` (650 l., `window.__wfrp`).

### C.2 Flux de jet
24. **Fabrique de flux** — `rollFlow.ts` (générateur Lancer→Chance→Pacte→Résilience→Appliquer).
25. **Specs de flux** — `rollFlows.ts` (922 l., ~31 specs : attack/defense/cast/counterspell/focus/trample/
    maneuver/run/approach/ward/frenzy/disengagement/test/reload/stateRecovery/activity/heal/appraise/
    bargain/corruption/cascade/extendedTest/forceDoor…).
26. **Types de pendings** — `pendings.ts` (804 l. : PendingTest/Attack/Victory/… + ScheduledEffect).
27. **Langage de flux** — `flow.ts`, `flowTypes.ts` (Conditions+Effets, runFlow/evalCondition).
28. **Cascade** — `cascade.ts` (modale multi-étapes influençable).
29. **jetProps** — `ui/jetProps/*` (5 hooks, utilisés seulement par CascadeModal — *cf. dette*).

### C.3 Combat (`combatFlow.ts` baril + `state/combat/`)
30. **Orchestration** — `combatFlow.ts` (**4129 l.**, fichier-dieu — *cf. dette*).
31. **Slice combat** — `combatSlice.ts` (2096 l., routeur — *cf. dette*).
32. **Effets de combat** — `combatEffects.ts` (977 l. : applyEffects, checkTriggers, fireScheduledEffects, butin).
33. **Setup / auto** — `combatSetup.ts`, `combatAuto.ts`.
34. **Hooks** — `combat/roundHooks.ts`, `combat/turnHooks.ts`, `combatHooks.ts` (registres).
35. **Tests déclenchés** — `combat/triggeredTest.ts`.
36. **Géométrie / path** — `combatGeometry.ts`, `path.ts`, `footprint.ts`, `lineOfSight.ts`, `jumpMove.ts`.
37. **Vision** — `visionState.ts`, `vision.ts` (brouillard, dérivé). **Zones** — `zones.ts` (TTL-round).
38. **Montures** — `mount.ts`. **IA** — `ai.ts`, `attackRelevance.ts`.
39. **Invocations** — `summonFlow.ts`. **Psy rencontre** — `encounterPsychFlow.ts`.
40. **Logs** — `combatLog.ts` (événements + texte FR persisté — *cf. dette i18n*).
41. **Garde** — `combatGate.ts`. **Manœuvres** — `combatManeuvers.ts`. **Effets déclenchés** — `triggeredEffects.ts`.
42. **Ciblage** — `targeting.ts`. **Bâtiments/terrain** — `buildings.ts`, `terrain/`.

### C.4 Campagne / monde
43. **Scène (schéma)** — `scene.ts` (599 l. : tiles/entities/dialogues/triggers/encounters + `Effect[]` ~25 kinds + `EFFECT_HANDLERS`).
44. **Carte du monde** — `worldMap.ts` (lieux, routes, horloge de voyage).
45. **Groupe** — `partyFlow.ts` (avancement PX, équipement, consommables, butin).
46. **Marchand** — `merchantFlow.ts` + `merchants/` (stock, panier, marchandage, évaluation, réparation).
47. **Voyage** — `travelFlow.ts`. **Repos** — `restFlow.ts` (616 l.). **Interlude** — `interludeFlow.ts`.
48. **Infirmerie** — `medicFlow.ts`. **Corruption** — `corruptionFlow.ts`.
49. **Entretien quotidien** — `upkeep.ts` (rations/maladies/convalescence + `purgeClockEffects`).
50. **Entretien hors combat** — `outOfCombatUpkeep.ts`. **Provisions** — (dans upkeep/rest).
51. **Spawn** — `spawn.ts` (Bestiaire→Combatant). **Navigation expl.** — `exploreNav.ts`.
52. **Règles maison** — `houseRules.ts` (persistance overrides de `policy.ts`).
53. **Coop** — `netFlow.ts`, `netOwnership.ts` (hôte autoritaire, sièges, intents).

---

## D. Couche TEMPORELLE / DÉCLENCHÉE *(transverse — nœud de dette)*

Sept canaux parallèles, sans horloge maître :
54. **`roundBoundary`** (~18 hooks) — `combat/roundHooks.ts`.
55. **`turnStart`/`turnEnd`** — `combat/turnHooks.ts`.
56. **`endOfRound()`** + 3 boucles de décrément — `engine/conditions.ts`.
57. **`purgeClockEffects()`** (`untilTime`) — `upkeep.ts`.
58. **`runDailyUpkeep()`** (jour calendaire) — `upkeep.ts`.
59. **`fireScheduledEffects()`** (`executeAt`) — `combatEffects.ts`.
60. **`checkTriggers()`** (spatial) — `combatEffects.ts`.
61. **`outOfCombatUpkeep()`** (prorata hors combat) — `outOfCombatUpkeep.ts`.

---

## E. Couche PRÉSENTATION — rendu iso `src/gameIso/`
62. **Projection** — `iso.ts`. **Hub rendu** — `IsoStage.tsx` (1448 l.).
63. **Sélection backend** — `pickBackend.tsx` (classifieur rig/plan/sprite).
64. **Tokens** — `BodyToken`, `EntityToken`, `RigToken`, `AnimatedRigToken`, `AnimatedPlanToken`, `MountedToken`.
65. **Rig (factory)** — `rig/composeRig.tsx`, `skeletons.ts`, `plans/defs/` (~15 plans corporels), `palette.ts`.
66. **Apparence** — `rig/appearance.ts`, `parts/combatantVisuals.ts`. **Pièces** — `parts/{equipment,weapons,tenues,elements,traitVisuals}`.
67. **Décor** — `sprites.ts`, `BuildingSprite.tsx`, `ground.ts`, `walls.ts`, `stairs.ts`, `catalog/`.
68. **Brouillard / cible** — `FogLayer.tsx`, `TargetReticle.tsx`.
69. **FX** — `fx/useCombatFx.ts`, `FxLayer.tsx`, `fx/useWalkAnim.ts`, `anim/clips.ts`, `anim/creatureAttackPoses.ts`.

## F. Couche PRÉSENTATION — UI React `src/ui/`
70. **Écrans** — `App`, `GameMenu`, `CampaignView`, `CharacterSheet` (911 l.), `PartyScreen`, `CompendiumScreen`, `Editor`, `CoopLobby`, `InterludeScreen` (594 l.).
71. **Portrait (primitives)** — `PortraitTile`, `CharFrame`, `RigPortrait`, `StateChips`, `CharCard`.
72. **Flux de jet (primitives)** — `RollFlowShell`, `breakdown.ts`, `OptionChooser`, `InfluenceRow`, `VsHeader`, `RollPanel/RollLine`, `Dice`, `ForcedRollPicker`, `ChanceButtons`, `ResilienceButton`.
73. **Modales de jet** — ~31 `*Modal.tsx`. **Autres modales** — `Document`, `HouseRules`, `Loot`, `SaveLoad`, `StateRecovery`, `TravelRecap`, `CombatBanner`, `Modal`.
74. **Barre d'action** — `ActionBar.tsx` (626 l.). **Dialogue/voyage** — `DialogueBox`, `NarratedLine`, `MultiRollList`.
75. **Marchand/loot** — `MerchantPanel`, `GearAssignList`. **Créateur** — `creator/CharacterCreator` (1220 l.), `CreatorSummary`, `draft.ts`.
76. **Onglets (primitive)** — `TabbedEntry` (sous-utilisée).

## G. Éditeur v2 — `src/ui/editor/`
77. `Editor` (hub) + `editorState.ts` + `EditorCanvas` + `Palette` + `Inspector` (973 l.) + `LogicDock` +
    `GameOpEditor` (éditeur d'ops, réutilisé) + `EffectList` (605 l.) + `FlowEditor` + `DialogueDetail` +
    `StatblockEditor` + `WorldMapEditor` + `ValidationPanel` + `useSceneHistory`/`useEditorView` + `propDefaults.ts`.

## H. Compendium — `src/ui/compendium/`
78. `CompendiumScreen` + `CodexEntry`/`CodexEdit` (657 l.) + `CreaturePreview` + `registry.ts` (721 l.) +
    `describe.ts` + `editFields.ts` + `search.ts` + `relations.ts`.

## I. Transverses
79. **Coop réseau** — `net/` (`relay`, `session`, `protocol`, `compress`, `intents`, `transport`) + `server/` (Worker CF : `room`, `roomLogic`).
80. **Audio** — `audio/` (`music` pur, `engine`, `wiring`, `_registry.generated`, `defs/`).
81. **i18n** — `i18n/index.ts` (`t()` pur) + `messages/fr.ts` (~250 clés).

---

## J. SYNTHÈSE DE LA DETTE (cibles de nettoyage)

### Métriques brutes
- 902 fichiers source, ~80 800 lignes. Baseline : **typecheck OK, 5310 tests verts**.
- Trous de typage : **385 casts `as`**, **153 non-null `!`**, **22 `any`**, 6 `@ts-ignore`/eslint-disable. 0 TODO/FIXME.

### D.1 Couche temporelle *(7 canaux + 3 champs de durée + hack `COMBAT_PERSIST=9999`)*
Double chemin d'expiration sur `ActiveEffect` (`roundsLeft` + `untilTime`). → **unifier** (Duration discriminé + horloge maître).

### D.2 Fichiers-dieu *(confirmé par lignes)*
`combatFlow.ts` 4129 l. (3 fonctions >240 l. : applyAttackResult/applyCast/runEnemyAI), `combatSlice.ts` 2096 l.
(79 imports/ligne), `store.ts` 1453 l., `ops.ts` 1176 l. (switch ~65 cas), 6 barils `export *` masquant le couplage.

### D.3 Intégrité des données *(jq)*
- **18 ids dupliqués** entre traits/talents/qualities/maneuvers (certains voulus trait→manœuvre ; vrais conflits : `frenesie`, `haine`, `magique`, `taille`…).
- **`NATURAL_WEAPON` codé en dur** (`creatureEquip.ts:20`) → devrait être `capabilities` data.
- **135/138 sorts frenchy sans effet mécanique** → *hors périmètre* (fallback narratif assumé, documenté ici).
- Mineur : casse `Magie Mineure` vs `Magia mineure`.

### D.4 Déterminisme & typage *(vérifié)*
- `social.ts:73` **`Math.random()`** hors RNG seedé (appel sans `rng` depuis `combatEffects.ts`) → rejouabilité cassée.
- Type **`Money` dupliqué** (`engine/money.ts:8` + `pendings.ts:21`).
- `rollFlows.ts:711` (frenzy) **oublie `sl`** en Résilience. `castInfo(sp as any)` (`combatFlow.ts:2481`).
- `partyFlow.ts` : ~14 clones `JSON.parse(JSON.stringify)`.

### D.5 Legacy / rétro-compat *(à purger — règle « zéro rétro-compat »)*
`weaponSets` (`types.ts:538`), `trauma.decompteUntil` (`types.ts:344`), fallback regex `(2m)` (`items.ts`),
double-lookup sort (`partyFlow.ts:367`), vieux formats de save (`worldMap`, `saves-flow`), `fallbackSpec` regex (`spellspec.ts`).

### D.6 Multilangue *(incomplet)*
7 maps moteur non rebasculées sur `t()` ; ~40 littéraux FR `ops.ts` ; **`combatLog.text` FR persisté** ;
~20 chaînes FR `ui/` ; garde-fou ESLint `no-new-hardcoded-labels` non implémenté.

### D.7 Hardcodé restant *(→ data)*
ZdE parsée regex (`spellspec.ts`), `LODGING_META`/`FOOD_META` (`RestModal.tsx`), flanc/dos inféré (`combatGeometry.ts`).

### D.8 Doublons *(à prouver avant fusion)*
2 chemins de Peur (`approach`/`psychAffliction`), tests opposés (`attack/defense` vs `cascadeRoll`),
`test`/`extendedTest`, `disengagement`/`run`, onglets UI (3 systèmes) + 2 segmenteds en dur, blocs résolveurs
quasi-identiques `rollFlows.ts` (approach/ward, activity/reload).
