---
name: game-passifs-unifies-p0-p3
description: "Système de passifs unifié (collecteur passiveMods + kind) — P0-P3 + B + C (édition Codex) + découplage mutation/table + doc LIVRÉS ; reste recette navigateur + chantier 2 apparence"
metadata: 
  node_type: memory
  type: project
  originSessionId: 583862c1-7e63-4e95-b150-b9b93ba918ab
---

Chantier « mettre à plat TOUS les passifs en UN collecteur identique pour tous » (demande user répétée : éditer/créer les passifs d'un trait/mutation/qualité comme un sort, **no defer, no debt**). Le `kind` (PassiveKind, `ops.ts`) porte le profil d'annulation ET la règle de combinaison.

**LIVRÉ & vert (engine 983)** — collecteur `passiveMods(c): PassiveMod[]` dans `trauma.ts`, helper `pmods(c, op, additive?)` (additive ⇔ `intrinsèque` → Σ dans la base ; sinon POOL non-cumul) :
- **P0** (74b82c2) collecteur + table `PASSIVE_CANCELLERS` + kinds.
- **P1a** (5954edb) `passiveMods`→`PassiveMod[]` + kind `magique` (sorts = pool, non annulable).
- **P1b** (0c610df) mutations charMod (base-additif via `passiveCharSum`) + mouvement (`passiveMoveMod`, Σ tous `moveMod`). Lues INLINE dans passiveMods (cycle trauma→corruption→characteristics évité).
- **P1c** (3f10062) mutations skillMods nommées → `passiveSkillSum`. `mutationTestMod`→`mutationCharTestMod` (testMods-by-char SEULS restants).
- **P2** (1fae96d) maladies (kind `maladie`, annulée par Détermination — relocalisé de disease.ts) + faim (kind `faim`) → collecteur. `traumaModSurvives`→`modSurvives(c,kind,t?)`.
- **P3** (7a45bc4) **traits de profil spawn→live** : `Combatant.liveTraits` (facultatifs bestiaire / statbloc éditeur / accordés `grantTrait`) émis intrinsèque ; `characteristics`=BASE pure. `baseWithTraits(c,key)`=base+charMods de trait (sans volatils) pour lecteurs BRUTS (Encombrement/polymorphe/Initiative). Blessures via `withTraitChars` ; `effectiveMaxWounds` ré-référencé sur `baseWithTraits`. grant/remove sync `liveTraits`.

**Pièges/contraintes clés :**
- Cycle : le collecteur (trauma.ts) ne peut importer QUE des feuilles (disease/provisions/wearPenalty/traits-dispatch — aucune n'importe trauma/characteristics). `encumbrance.ts` IMPORTE trauma → l'`agilityTestPenalty` (pénalité de Test liée à l'ÉTAT de charge, ≠ passif d'élément) RESTE couche orthogonale avec `testStatePenalty` (pas un defer).
- combat.ts + store.ts:1385 (lecteurs BRUTS d'Initiative → `baseWithTraits(c,'I')`) édités DANS L'ARBRE mais NON commités (WIP // actif sur ces 2 fichiers ; mes lignes rideront à leur commit). `git diff` AVANT tout commit scopé : combat.ts portait `hideValue` (WIP marchand //).
- `creatures.json` = app-owned, modifiable au besoin (permission user) ; n'a pas fallu (Blessures gérées en moteur).

**B LIVRÉ** (bb7cd98+4f7bb64) — op `testMod{char?}` ; mutation char-tests + objet Laid (testMod{Soc}) + port d'armure (skillMod{skill}, source unique `wearEntries`) → collecteur ; `passiveTestMod`/`passiveSkillSum` (match BASE exacte) ; testValue laisse tomber soc/armour/mutationCharTestMod. Encombrement Agilité reste orthogonal (cycle). applyOps NON touché.

**C — édition/création Codex (data-driven). Ordre : MIGRER les passifs TS→JSON d'ABORD, puis le Codex auto-édite (CodexEdit `inferFields`).**
- **C/traits LIVRÉ — v2 ops-unifié** (ec73638 typed PUIS 153c06b refonte) : décision USER = passifs en **`PassiveMod[]`** (GameOp+kind, CONTINUS sans wrapper Flow), édités par **GameOpEditor COMME un sort**, PAS en champs typés. `TraitData.passive: PassiveMod[]` ; 8 traits de profil migrés `defs/`→`traits.json` (defs réduites `{key}`) ; `traitPassiveMods` (dispatch) = SOURCE unique lue DIRECT par le collecteur (liveTraits `out.push(...traitPassiveMods)`) ; `traitCharMods`/`traitMovementMod` = EXTRACTEURS (charMod/moveMod) pour baseWithTraits+Blessures ; `dispatch→src/data`+`src/data→engine/ops`(type) acycliques. Engine 983 vert, byte-identique. Scripts `_*.mjs` JSON.stringify(_,null,2)=byte-fidèle (NE PAS python text-mode = CRLF).
- **C/qualités LIVRÉ** (818defd) — `QualityData.passive: GameOp[]` ; socMod de Laid (defs TS) → `qualities.json` (op `testMod{Soc,-10}`) ; `qualitySocMod` lit `qualityByLabel.get(key).passive` ; def laid réduite, `QualityDef.socMod` retiré ; Codex `isPassive` étendu aux qualités.
- **C/mutations mécanique LIVRÉ — chantier 1** (ac1a293) — `Mutation.passive: GameOp[]` au lieu de charMods/movement/skillMods/testMods ; `mutations.json` `fx.{…}`→`fx.passive` (26 mut, loader `mutations.ts` étale `fx`→runtime) ; collecteur lit `m.passive` (out.push intrinsèque). **apAll/apLocations (armure nat. → recomputeLoadout/mutationArmourBonus) + derivedWeapon/traits/psychTraits RESTENT** (couches à part). `mutationCharDelta/mutationMovementDelta` + `TraitDef.charMods/movement` retirés (nettoyage ac9f27b).
- **VOCAB CONFIRMÉ non-dupliqué** : `charMod{char:CharKey}` = LE seul op de modif de carac (passif `intrinsèque`→base ; sort via applyOps→`ActiveEffect{char,bonus}`→pool `magique`). M ∉ CharKey (les 10 d100 seules) → `moveMod` LÉGITIME (pas de Bonus/dizaines, combinaison ÷2 moveScale propre). Réutiliser `GameOpEditor` (liste d'ops) ; appearance ≠ GameOp (couche rig séparée, par label).
- **CHANTIER 2 (apparence d'élément data-driven)** : prompt complet écrit (donner aux trait/mutation un fragment `appearance?: Partial<EntityAppearance>` mergé par `composeRig`, éditeur `MonsterPartsFields` EXISTANT ; migrer legs/faceFlip/registre overlay code→données ; primitif inédit = +1 catalogue rig). À lancer en session séparée.
- **DÉCOUPLAGE mutation/table LIVRÉ** (36da6e8) — la plage d100 n'est PLUS dans la mutation (collision dès qu'une 2e table — dieu du Chaos, Compagnon T1 — rejoue la même mutation). `mutations.json`=`[{label,kind,passive,apAll,…}]` (40 entités, fx déballé top-level) ; `mutationTables.json`=`[{label, ranges:[{min,max,mutation:<ref>}]}]` (tables ÉDITABLES). `rollMutation(table,rng)` table→plage→ref→entité ; consommateurs inchangés (kind=nom de table). Migration ATOMIQUE (ancien format retiré même commit, cf. [[feedback-zero-retrocompat-briques-solides]]).
- **CODEX mutations + tables LIVRÉ** (805afd8) — `mutations`/`mutationTables` exposés en datasets (index→overrides ARRAYS→catégories registry « Mutations »/« Tables de Corruption »). Mutation éditée comme trait/qualité (champs inférés + `passive` via `<GameOpEditor>`, `isPassive`). Cycle évité (`import type` mutation dans index). serialize byte-fidèle (29). **Traits/qualités/mutations TOUS éditables au Codex** (passif=GameOp[], `<GameOpEditor ops=entry.passive>`).
- **ÉDITEUR de `ranges` LIVRÉ** (e4e252f) — `MutationTableField` (CodexEdit) édite les plages d100 d'une Table de Corruption (min/max clampés 1-100 + réf mutation autocomplétée via `RefDatalist ds="mutations"` RÉUTILISÉ) au lieu du JSON brut. typecheck clean.
- **DOC + CLAUDE/mémoire LIVRÉ** — `docs/systeme-passifs.md` (8 sections : vocabulaire GameOp/PassiveMod, taxonomie `kind`, collecteur, donnée éditable, spawn→live, découplage mutation/table, édition Codex, frontières appearance≠GameOp, recettes) ; CLAUDE.md = bullet « Passifs unifiés » dans Systèmes clés + 2 lignes Primitives partagées (`GameOpEditor` liste d'ops / `passiveMods` collecteur).
- **RESTE** : recette navigateur (éditer un trait/mut/qualité/table au Codex → effet live) ; chantier 2 apparence data-driven (prompt écrit, [[game-apparence-catalogue-convergence]]).

Voir [[game-trauma-ops-passive-collector]], [[game-data-driven-architecture]], [[feedback-no-commit-surgery-shared-tree]].
