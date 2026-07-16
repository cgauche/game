---
name: game-namematch-deleted
description: Le name-matcher flou du rig est SUPPRIMÉ — le rendu se résout 100% par la donnée
metadata: 
  node_type: memory
  type: project
  originSessionId: 583862c1-7e63-4e95-b150-b9b93ba918ab
---

De-POC P5/5d **TERMINÉ** (commits `3c7fd62` + `199980f` sur `feat/wfrp4-rpg-foundation`) : le **name-matcher flou est supprimé**, sur demande explicite de l'utilisateur (« suppression complète maintenant » + « une fois l'ancien système supprimé ils devront se plier au nouveau »).

`resolveRender(species, traits, name)` (`src/gameIso/rig/bodyPlan.ts`) résout l'espèce de rendu UNIQUEMENT par la DONNÉE : espèce explicite → espèce du RECORD (`findCreature`) → le nom s'il EST une espèce canonique (lookup **EXACT** `defByName`) → bipède Humain. Trait Nuée → `swarm`. `enemyRigProfile`/`entityRigProfile` suivent la même chaîne. Helper `resolveByName(name)` (data-driven) pour `bodyPlanOf` + galeries DEV.

SUPPRIMÉS — ne PAS réintroduire : `matchIn`, `bipedSpeciesMatch`/`bipedSpeciesScale`, `creatureMatch`, `creaturePlanMatch`, `creatureSpeciesScale`, `quadSpeciesMatch`/`wingSpeciesMatch`, `detectSpecies` ; les wrappers legacy `quadrupedSvg`/`wingedSvg`/`*SpeciesFromName`/`*SpeciesScale` de composeQuad/Wing ; et les champs `aliases`/`matchPriority`/`aliasOnly` du type `CreatureDef` + des 69 defs. `speciesScale` (lookup exact) = SEULE fonction d'échelle. composeQuad/Wing reçoivent une espèce EXACTE.

Conséquences : un SYNONYME (« Guerrier des clans », « Goule de crypte ») ne résout plus tout seul → l'entité/record DOIT porter `appearance.species` (le contenu arène+scénarios est déjà record-backed — audité : 0 synonyme utilisé). Les 13 variantes démon frenchy (espèce « Démon ») rendent en bipède Démon partout (combat+exploration, fin de l'incohérence). « Démon » exact rend en Démon (l'ex-`aliasOnly` ne masque plus le lookup). One-shots QC obsolètes supprimés. Prolonge [[game-frenchy-bzh-creatures]] + [[game-data-driven-architecture]] + [[game-creature-registry]].
