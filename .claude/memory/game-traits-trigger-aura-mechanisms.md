---
name: game-traits-trigger-aura-mechanisms
description: "Traits non-attaque câblés en donnée — onTurnStart (Redoutable), death-spawn summon (Charnier), aura de DR (Aura de Dhar). Dette talent.test texte-libre SOLDÉE (talent.test.matches structuré id-based)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 79086e8f-2b86-464f-8a9e-6f2bc67f4515
---

Câblage de traits de créature (ZI/frenchy) « en donnée » via le système d'effets/triggers, sans code par-entité (cf. [[game-talents-editable-data]], [[game-flow-logic-authoring]]) :

- **Redoutable** (ZI) : `effects:[{trigger:'onTurnStart', flow: if(garde Empêtré/Surpris) → gainAdvantage}]`. Op **`gainAdvantage`** (porte l'Avantage à ≥ amount, jamais réduit). L'**Indice d'instance** est baké via `withArg` (placeholder `'$indice'` → `trait.value`, comme `'$arg'`) ; `effectsOf`/`freeAttackSourcesOf` passent `inst.value`. `onTurnStart` émis par `combat/turnHooks`.

- **Ops IMPURES dans les triggers** : `summon`/`zone` (grille/initiative) sont inertes dans `applyOps` et n'étaient résolues qu'au lancement de sort. `resolveTriggerImpureOps(get,set,actor,trigger)` (combatFlow) les MOISSONNE (`triggerEffectOps` → `spellEffectOps`) et dispatche : summon→`applySummon`, zone→`placeZoneFromOp` (extrait op-based de `placeSpellZone`, réutilisé par sort ET trigger). Branché sur `notifySlain` (onSlain) → **Charnier** = 3d10 Zombies à la mort (op summon onSlain).

- **Aura de trait** : `TraitData.aura = {rangeChar?/rangeMeters, affects:'enemies'|'allies'|'all', passive:GameOp[]}`. Le hook `recompute-auras` (onRoundEnd) projette `aura.passive` dans `c.auraMods` des cibles à portée. ⚠️ Les CONSOMMATEURS doivent lire `auraMods` : aujourd'hui `testMod` général (conditions.ts) + `skillDRBonus` (étendu) — généraliser à tous les mods GameOp (router par sémantique de combinaison additif vs non-cumul) reste à faire. **Aura de Dhar** : aura `skillDRBonus` Focalisation/Langue(Magick) lue au lancement par `castTestTalentDR` ; `skillDRBonus(c, skill, spec?)` est SPEC-aware (Langue (Magick) seulement). Aura de Mort différée (gating par DOMAINE du cast à bâtir).

**DETTE SOLDÉE (vérifié au code 2026-07-05)** : le matching de `talent.test` n'est plus du texte libre. `talent.test.matches` (donnée) est une structure **id-based** `{skill, spec?}` — `castTestTalentDR(c, skill, spec?)` (`engine/magic.ts`) résout uniquement par comparaison d'id de Compétence (+ spec), plus aucun `.includes`/substring sur un libellé. Garde de curation dédiée : `engine/talent-test-sl.test.ts` (« Intégrité des talent.test.matches »). Prochain appelant qui a besoin du même mécanisme : toujours passer un **id de Compétence (+spec)**, jamais un libellé.
