---
name: game-massbattle-activities-distinct
description: "Théâtre de guerre : SEULE la boucle de résolution (clash/hold/round) reste du domaine ; l'activité + le budget + la Puissance se FONDENT dans le système d'Activité unique"
metadata: 
  node_type: memory
  type: project
  originSessionId: e416e0e1-cd6b-424e-9f7f-769fed50cae3
---

**RÉVISÉ 2026-07-05** (l'ancienne version disait « ne PAS fondre » — décision utilisateur INVERSE, cf. [[game-activites-unification-chantier]]).

Ce qui reste **légitimement distinct** du système d'Activité : UNIQUEMENT la **boucle de résolution de domaine** du théâtre de guerre (`massBattle.ts`/`massBattleFlow.ts`, ADE II ch.8) — le Test spectaculaire de Puissance par Round, le clash mutuel, « Tenez votre position » (hold), les hasards, l'enchaînement de Scènes. Ça reste du code de domaine, derrière un resolver.

Ce qui **se FOND** dans le système d'Activité unique (décision 2026-07-05, contre l'ancienne note) :
- **La définition** des 5 activités de bataille (Discours/Planification/Infiltration/Repérage/Sabotage) → des `ActivityDef` du catalogue unique (`activities.json`), plus de `BattleActivityDef`.
- **Le budget** « max 3 / 1 semaine » → invariant RAW UNIQUE partagé avec l'interlude (le double-compteur `massBattle.activitiesDone` vs `interlude.perHero.left` était un **bug de fidélité** confirmé : `ADE II ch.8 l.65` « comme à l'accoutumée, max 3 » = MÊME budget que `LDB 23 l.5`).
- **La Puissance d'armée** → NON plus un `might:number` + vocabulaire `ActivityOutcome{target:'allyMight'}`, mais les **Blessures d'un Combattant inanimé** (builder `inanimateCombatant`, même patron que `structureCombatant` de siège). Du coup les issues d'activité de bataille = de purs `GameOp` (`heal`/`wounds`) via `applyOps` — zéro vocabulaire ad hoc. Un « palier » RAW (succès/Stupéfiant) = une `OutcomeBand` (`minSL`).

Faux obstacles écartés (B les avait pris pour des incompatibilités) : paliers vs bandes = isomorphes ; Test combiné / assistance multi-PJ / prérequis `requires`/`grantsFlag` = capacités GÉNÉRIQUES d'`ActivityDef`, pas un schéma à part. Suppressions actées : `BattleActivityDef`, `ActivityOutcome`, `PendingBattleTest`, `BattleTestModal`.
