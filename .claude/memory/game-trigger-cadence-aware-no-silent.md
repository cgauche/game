---
name: game-trigger-cadence-aware-no-silent
description: "Chantier TERMINÉ : plus aucun jet de héros atteignable ne se résout en silence — résolveur de Test unique `resolveFlowTest` (Flow+Test+continuation), cascade influençable pour tout Test manuel (upkeep, triggers, sorts, fin de combat)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2bd0b898-fab8-47a8-b273-3403aa017410
---

**GÉNÉRALISÉ le 2026-07-09 (user, playtest naval) : « aucun jet ne doit être silencieux. C'est une règle. »** — étendu AU-DELÀ des triggers de combat : voyage, entretien, faim/exposition, bilan de nuit. Compression de cadence (#232 traversée commandée) = moins d'INTERRUPTIONS, jamais moins de TRACES : chaque jet laisse sa ligne visible (atome de jet unifié), et l'influence suit le RAW — vérifié au Source le même soir : la Chance s'applique à TOUT Test raté sans restriction de contexte (`LDB 17 l.21-27` « Relancer un Test qui s'est conclu par un échec », `LDB 12 l.40` une seule relance) → le bilan de nuit lecture-seule (MultiRollList) était une divergence RAW, corrigée par l'affordance Chance à la ligne. Règle sœur du même soir : [[feedback-personne-ne-lit-le-journal]].

**Principe FERME (user) : aucun jet ATTEIGNABLE PAR UN HÉROS ne se résout en silence.** Tout jet héros passe par la voie **cadence-aware** — héros en cadence MANUELLE → étape de cascade INFLUENÇABLE (Chance/Pacte/Résilience) ; ennemi ou cadence rapide/auto → l'auto-pilote pilote LE MÊME flux (jamais un `rollTest` inline caché). Corollaires : un talent réactif = 1 DONNÉE (jamais un dispatch parallèle par mécanique) ; l'étape de cascade est GÉNÉRIQUE (zéro applier par mécanique).

**Prédicat unique de cadence** : `roundTestInteractive(c) = c.kind==='hero' && !cadenceAuto()` (cadenceAuto = rapide OU auto) — appliqué à TOUS les hooks d'upkeep (poison-resist, steel-jaw/Mâchoires, broken-recovery/Brisé, se-fatiguer). En rapide/auto le héros est auto-résolu comme un monstre (jet silencieux DANS le hook) ; seul le manuel ouvre une cascade. ⚠️ L'axe correct est la **cadence**, pas `c.kind==='hero'` seul — une 1ʳᵉ version avait introduit `endOfRound(skipPoisonResist)` comme dette de contournement, corrigée en unifiant sur ce prédicat.

**Architecture finale (DÉCISION VERROUILLÉE) — 3 mécanismes de résolution de Test FUSIONNÉS en UN** : `resolveFlowTest` unique (scène→modale `openSkillTest` / héros manuel→cascade influençable / ennemi→inline ; toujours vrai jet + branche fail + continuation `after` sérialisable). Frontière du « système unique » = **Flow + Test + continuation**, PAS le vocabulaire d'effets (`Effect` scène ⊥ `GameOp` combat restent 2 vocabulaires distincts, pontés par `Effect{type:'ops'}` — fusionner les deux aurait été une FAUSSE unification). Conséquence : **zéro op `test`/`opposedTest`** — un Test est un nœud de la STRUCTURE Flow, jamais une feuille d'effet. `runSpellFlow` (combat, cassé — branche succès silencieuse) est **SUPPRIMÉ**, remplacé par `runCombatFlow`/`runCastFlow` à pile + `after`.

**5ᵉ nœud Flow `choice`** (décision joueur opt-in, coût d'Avantage optionnel, PAS composable de test/if) — exécuteur `resolveFlowChoice` RÉUTILISE l'étape-choix de cascade déjà existante (motif `knockdown`, `pushCombatStep` yes/no + applier). Zéro nouveau mécanisme. `FlowTest.opposed.{attackerBonusSL,bonusSL}` porte les bonus de pré-jet figé (Furtif, Assommante, Piège-lame…) qui suivent la cascade ET l'inline.

**Découverte clé : la cascade ne suppose PAS de tour actif** (l'hypothèse inverse était fausse) — `pushCombatStep` append à toute cascade `purpose:'combat'` ou en démarre une, `resumeSuspendedAI` à la fermeture est no-op safe hors-tour. Ça a débloqué la migration des jets HORS-TOUR : Surprise (opposé Discrétion/Perception + Vigilance, au setup), Corruption/Maladie de fin de combat (`openCombatEndCascade`, AVANT l'écran de victoire, calque `openRoundEndCascade`).

**Chantier COMPLET** : tous les Tests héros-atteignables routés cadence-aware — triggers (Venin/Affamé/Hurlement/2 enchants via `EffectTrigger='onGainCondition'` + hook `setConditionGainedHook` injecté dans `addCondition`/`addTimedCondition`, engine pur, inversion de dépendance), 9 sorts, Assommante (opposé), 12 Tests de maladresse (`miscast.ts` produit un nœud Flow, convention engine pur déjà établie ops/domainAttributes), Frappe Réactive (`onCharged`), Déstabilisante (opposé F/Athlétisme→À Terre), Focalisation (Calme→Imparfaite, op impure+hook, registre `HOOK_BACKED_OPS`/`flowHasImpureOp`), Piège-lame (opposé Force→bris), Peur à l'approche, Bénédiction de Protection (gate de déclaration d'attaque), Surprise, Corruption+Maladie fin de combat. **Mâchoires d'acier = 1 entrée `talents.json`** (`effects:[{trigger:'onGainCondition', condition:'sonne', flow:{kind:'test',...}}]`) — plus de hook hardcodé.

**Vocabulaire de triggers de cycle de vie** : `EffectTrigger += onCombatStart/onCombatEnd/onRoundEnd/onTurnStart/onTurnEnd`, câblés aux hooks existants (inerte par défaut, golden stable).

**Gotchas** :
- `FALLBACK` FORK non traité : `scripts/maneuvers/generate.mjs` est STALE (libellés capitalisés + `seqOps` plat vs le json hand-migré ids+Flow) — **NE PAS re-lancer** (reverterait les migrations) ; `maneuvers.json` = source de vérité, réconciliation generator↔json = chantier séparé à arbitrer.
- Discipline anti-collision : ne jamais toucher/committer le WIP d'une autre session (rig/, docs/raw, scripts/raw).
- Pattern de revue rodé pour les gros lots : agent opus avec spec STOP-on-snag + revue stricte (tsc/suite/golden/grep récurrence de l'ancien mécanisme/scope) + recette navigateur avant push.

Suite verte, golden byte-identique tout du long (roundBoundary/turnStart/hitSaves). Recettes navigateur live faites (Mâchoires, Venin enfoui sous `if` avec arg Difficile, Surprise, embuscade). Prolonge [[feedback-pas-de-commentaire-rappel-ancien]], [[game-talents-editable-data]], [[game-flow-logic-authoring]], [[game-data-driven-architecture]].
