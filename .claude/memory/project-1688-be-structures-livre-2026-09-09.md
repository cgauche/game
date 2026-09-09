---
name: project-1688-be-structures-livre-2026-09-09
description: "#1688 LIVRÉ le 2026-09-09 (AA 10 l.98 : le BE d'une Structure compte 1 + écart de Taille au-dessus de l'attaquant, armes de siège exemptes ; `StructureData.taille` maison éditable) — leçon : poser `size` sur le Combatant d'une Structure fuit vers cinq lecteurs du Trait Taille des créatures (empreinte 3×3, tir +40, Terreur…) — une Taille « pour ce compte-là » vit en donnée et se lit au site, jamais sur le Combatant"
metadata:
  type: project
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
---

**#1688 livré (2026-09-09, wt-1624, push 98172ff56..5829f59ec)** — règle AA 10 l.98 jouée : `structureEnduranceMult(weapon, target, attackerSize)` (`src/engine/structures.ts`, source unique lue par `woundsFromHit` et par le journal du coup) = `1 + max(0, sizeGap(tailleStructure, tailleAttaquant))` hors Atout Siège ; `StructureData.taille` EXIGÉ (nœud `sizeCategorySchema` nommé, graphie RAW « Très petite ») sur les 24 structures en VALEUR MAISON (le RAW dit « le MJ doit déterminer ») avec une raison par entrée dans `maison` (barème une fois au JSDoc du champ) ; `attackerSize` requis dans `woundsFromHit` (33 sites), garde nommée sur `woundsAtCritLocation` (AA 10 l.105).

**Leçons (mesurées)** :
- **Une Taille « pour ce compte-là » ne se pose pas sur le `Combatant`** : le premier geste posait `size` sur la Structure → le juge a mesuré cinq lecteurs du Trait Taille des créatures exposés (`SIZE_RANGED_MOD` +40, `footprintN` 1 → 3 cases, `sizeDamageMultiplier`, `forceOpposedOutcome`, `peurTerreurFromSize` Terreur 2), contre AA 10 l.96 (corps à corps automatique), LDB 85 l.344 (« représente les créatures ») et la doctrine `footprint.ts:29-32` → la donnée est lue au site par `findStructureById(target.creatureId)`, garde dérivée « aucun Combatant de structure ne porte `size` » + sondes des cinq lecteurs.
- **Un `maison` dit la raison de CETTE entrée** : 21 chaînes copiées-collées récitant un barème = refus ; le barème vit une fois au def.
- **Un paramètre optionnel muet est un trou** : `attackerSize?` → requis, chaque site le passe (ou une garde nommée dit pourquoi il est inatteignable).
- Angle mort de `comment-poison-guard` nommé : la tombale « Remplace … qui étaient … désormais » (sans « ancien ») passe.
- Trois tests verrouillaient l'ABSENCE de la règle (BE compté une fois) : réécrits depuis le RAW — vérifier au `git show` ce qu'un test ancien affirmait avant de le « casser ».
- Cliquets à recaler après un champ exigé sur un dataset : gel CLES du Codex (`registry-enveloppe`), stock des champs étrangers (`codex-edit-charge-discriminee` : `structures` en est sorti, elle présentait `occulte`), partition `source`+`maison`, byte-fidélité `serializeDataset`, fixtures de scène sans le champ. Et `docs:build` après CHAQUE commit de sources (deuxième oubli de la session : `docs:empreinte` rouge).

**Why:** ne pas refaire le geste `Combatant.size` sur une entité non-créature. **How to apply:** toute donnée « de Taille » d'une non-créature (structure, véhicule, navire) se lit au site par sa def, jamais par `Combatant.size`. Liens : [[project-1686-materiaux-etat-2026-09-05]], [[feedback-un-detecteur-ne-mesure-que-sa-couverture]], [[feedback-gates-docs-build-avant-lancement-sinon-25-min-perdues]].
