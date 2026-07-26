---
name: game-rollflow-canonical-system
description: "Le système de jet (rollFlowSpecs/rollFlowFactory) — tout passe par la fabrique + atomes partagés, gardé par 2 tests ; ne JAMAIS recoder la mécanique dans un resolve. Inclut la lignée de son unification (fabrique mono/multi, suppression des modales dédiées, dédup du cycle d'influence)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 638edf37-5125-453f-9364-6fd1d1e5d63e
---

Le **système de jet différé** (`src/state/rollFlowFactory.ts` = fabrique, `rollFlowSpecs.ts` = registre des ~35 flux) a été unifié de bout en bout (chantier 2026-07). Principe INVIOLABLE : **un flux ne fournit que sa FORME + sa DONNÉE ; il ne recode JAMAIS la mécanique** dans son closure. Tout passe par la fabrique + les atomes partagés :

- **Verbes d'influence** (Chance/Résilience/Résistance/Détermination) : composés UNE fois par `makeRollFlow` + `RollFlowLens`. Détermination est un VERBE de fabrique (`caps.determine`), pas un hand-code. `resist` = Résistance (Menace).
- **Dé forcé** policy-aware : `bestForcedRoll(cible)` (jamais `evaluateTest(1,…)` en dur — bug Fast DR). **Réussite forcée** : atome `forcedTR(roll,target,sl)`. **+1 DR** : atome `bumpSL(tr)` (jamais `sl+1, success:true`).
- **Gating** (`failed` → dispo Chance/Résilience/Pacte) : DÉRIVE de `spec.outcome(slot) → {won,sl}` (issue canonique UNIQUE). Plus de `spec.failed` bespoke → divergence structurellement impossible (bug historique `activity` : narration lisait `combinedLevel`, `failed` lisait skill-1).
- **Test SIMPLE** : déclaré en DONNÉE via `simpleTestResolve`/`simpleTestResultResolve`/`simpleRoll` (valeur + difficulté + **rng CONTEXTUEL paramétré** : battleRng en combat, defaultRNG hors-combat — NE PAS normaliser à un seul). Opt `actorless` pour les Tests à valeur BAKÉE (`p.skillValue`) car le porteur peut être un PNJ non résolu par `actorIn` (Médecin de scène → régression arene-flow si on garde `if(!actor)`).
- **Fabriques de dédup** : `opposedBinaryFlow` (disengage/auContact/grapple/distraire), `forcedBinarySuccess` (frenzy/approach/ward/flee), `flatRollLens`/`resultRollLens`.

**Bespoke LÉGITIME (pas de la dette)** : opposé-non-binaire (recover/bargain/activity-tenue via `resolveOpposed`), combiné (`evaluateCombinedTest`), étendu (extendedTest/focus/reload), `test` (talents/DR/inversion/requireSL), primitives métier partagées avec l'IA (`resolveFrenzyEntry`). `resolveRenounce` (« Je te renie ! ») = choix de CONSÉQUENCE post-jet (pendingRenounce), pas un verbe de flux → sa propre abstraction, pas la fabrique.

**2 GARDES verrouillent la classe** (lancer avant de committer un flux) : `rollflow-no-drift.test.ts` (scan STATIQUE src/state+engine : bannit dé-01 en dur, `sl+1,success:true`, littéral forcé recopié ; exige les atomes) + `rollflow-outcome-invariant.test.ts` (BEHAVIORAL : pilote chaque flux perdant/gagnant, casse si `failed` ≠ issue réelle). Cf. [[credo-exemples-calibrants]].

RESTE (séquencé, 2026-07) : lever value/difficulté/rng en DONNÉE pure sur `spec.test` (zéro `resolve`) ; **Axe C** (UI plomberie : helpers de cycle d'influence) ; `resolveRenounce`.

## Lignée de l'unification (historique des chantiers qui ont produit ce système)

**Fabrique MULTI-jets = la MÊME fabrique que mono** (2026-06-14) : `makeRollFlow` est la fabrique UNIQUE
mono ET multi (N participants) via une **lentille** `spec.multi = { slots, idOf, replace }` — ABSENTE en
mono (le pending EST le slot, `pid` ignoré), PRÉSENTE en multi (`participants[pid]`). Le câblage des 7
verbes (roll/reroll/bonusSL/forceSuccess/setForcedRoll/cancel/darkPact) est écrit UNE fois — un
« générique » du cas multi qui recopierait ce câblage est un FAUX générique, pas une abstraction.
Deux régimes prouvés sur la même fabrique : PARALLÈLE (jets indépendants, ex. Contre-sort à
plusieurs agrégé dans `counterspellConfirm`) et SÉQUENTIEL (chaque jet dépend du précédent, ex. Test
Étendu LDB 12, DR cumulé, restart si total<0). Une rangée `interactive:false` = témoin.

**Suppression de modales dédiées au profit du ciblage carte** : `CleaveModal`/`DualStrikeModal`
N'EXISTENT PLUS — Frappe Mortelle, 2ᵉ frappe deux-armes et cibles de Surincantation passent par
`TargetPrompt` (bandeau non bloquant + clic carte sur `IsoStage`), pas des boutons-noms en modale.

**Dédup du cycle d'influence** : `InfluenceRow` (rangée Chance/Relance gratuite/+1 DR/Pacte/Résilience)
est partagée par Attaque/Défense/Incantation/Désengagement — créée sur remarque utilisateur
(« copié/collé »). Le dé forcé (LDB 17 l.73) a été généralisé aux 4 flux après divergence repérée par
l'utilisateur (« pourquoi seules certaines modales… ») : sélecteur partagé `ForcedRollPicker` (11 = le
plus bas double → Critique, PAS le plus haut).

**Détail UI récurrent** : `NarratedLine.tsx` (`NarratedSegments`/`JournalLine`) dédup l'issue en une seule
ligne style journal (au lieu de dupliquer verdict+log) ; `Dice.tsx` anime le d100 (~0,5 s puis se pose,
rendu initial = valeur finale pour SSR/tests stables, respecte `prefers-reduced-motion`).
