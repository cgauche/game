---
name: game-talents-editable-data
description: "Talents = mécanique 100% en DONNÉE éditable au Codex (passive/effects/combat), plus de hardcode"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac3fb303-33fb-4bd5-999a-5b57154f44c2
---

Chantier « éditer/créer des talents » LIVRÉ (plan `scalable-shimmying-floyd.md`, bout en bout) : la mécanique d'un talent vit en DONNÉE, éditable/créable au Codex, plus en dur.

**Étape 1 (MVP)** — `TalentData` porte `passive: GameOp[]` (collecté par `talentPassiveMods`→`passiveMods`, comme les traits) + `effects: TriggeredEffect[]` (tiré par `fireTriggers` via `effectsOf`, talents inclus). Op **`grantFreeAttack`** (3 axes : `weapon` held/mainHand/natural × `when` available/immediate × cost/test/activeIf/perCharger), INERTE dans applyOps, résolue côté état. Codex : `isPassive`/`isTriggered` incluent `'talents'` → `GameOpEditor`+`TriggeredEffectsField` ; GameOpEditor offre `grantFreeAttack`.
- **Frénésie** (`when:'available'`) : `frenzyFreeUsed` SUPPRIMÉ → `hasFreeWeaponAttack(c)` lit le grant du talent + plafond `freeAttacksThisTurn['arme']` (5 frenzy tests verts, comportement identique).
- **Assaut féroce** (`onHit`) + **Frappe réactive** (`onCharged`, nouveau déclencheur) : résolveur `resolveTalentFreeAttacks` dans combatFlow (motif aiFrenzyAttack — instantané, Action préservée, plafond/Round qui borne la récursion, jet `op.test`, 1×/chargeur). Sites : `attackConfirm` (onHit héros) + commit de charge IA (onCharged). Test `talent-free-attack.test.ts`.

**Étape 2A** — les 48/49 `combatFeatures/defs/*.ts` (flags EN CODE) → `TalentData.combat` (talents.json) ; `featuresOf` lit `findTalentById(id).combat` ; registry/_registry.generated/normalize/defs SUPPRIMÉS ; 2 hooks-fonction → déclaratifs (`offHandPenalty:{perLevel,zeroAt}`, `attackModes:string[]`). **Le SESSION PARALLÈLE a co-migré ça (commit `09a69a7` Phase F)** → on a convergé (j'ai ajouté le retrait de l'entrée gen-registry).

**Étape 2B** — 4 checks `talentId ===` en dur → donnée+helper : Magie des Arcanes→`arcaneDomainOf` (4 sites, réutilise `castingKind:'arcane'`), Costaud→`combat.encumbranceBonus`+`talentEncumbranceBonus`, Âme pure→`combat.corruptionThreshold`, Chirurgie→`combat.surgery`+`hasSurgery`.

Piège vécu : SESSION PARALLÈLE commitait l'arbre entier chaque minute (sweeps Phases D-F) → `git show/diff/grep` racy ; se fier au WORKING TREE (tsc+tests) pas au git state ; talents.json clobbé une fois puis re-persisté. Reste : recette navigateur (différée — HMR churn du parallèle casse les recettes). Prolonge [[game-passifs-unifies-p0-p3]] + [[game-maneuver-capability-unification-parallel]].
