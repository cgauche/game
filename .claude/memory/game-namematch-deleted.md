---
name: game-namematch-deleted
description: Le name-matcher flou du rig est SUPPRIMÉ — le rendu se résout 100% par la donnée
metadata: 
  node_type: memory
  type: project
  originSessionId: 583862c1-7e63-4e95-b150-b9b93ba918ab
---

De-POC P5/5d **TERMINÉ** (commits `3c7fd62` + `199980f`) : le rig n'a **aucun name-matcher flou**, sur demande explicite de l'utilisateur (« suppression complète maintenant » + « une fois l'ancien système supprimé ils devront se plier au nouveau »).

`resolveRender(species, traits, idOrName)` (`src/gameIso/rig/bodyPlan.ts`) résout l'espèce de rendu UNIQUEMENT par la DONNÉE : espèce EXPLICITE (1er arg) → espèce du RECORD (`findCreatureById(id).appearance.species`) → bipède Humain. Trait Nuée → `swarm`. Le **3ᵉ argument est un ID** — il sert au lookup de record et au match de véhicule, **jamais de repli par libellé** ; une espèce se passe par le 1er argument. `enemyRigProfile`/`entityRigProfile` suivent la même chaîne. `speciesScale` (lookup exact) = SEULE fonction d'échelle ; `composeQuad`/`composeWing` reçoivent une espèce EXACTE.

**L'interdit qui en découle** : aucun repli de résolution par le NOM ne se rebranche — ni matcher flou, ni champ d'alias sur `CreatureDef` (`aliases`/`matchPriority`/`aliasOnly`), ni wrapper « SVG depuis un libellé ». Une créature qui ne résout pas est une **donnée à corriger**, pas un cas à rattraper par son libellé.

Conséquences : un SYNONYME (« Guerrier des clans », « Goule de crypte ») ne résout pas tout seul → l'entité/record DOIT porter `appearance.species` (le contenu arène+scénarios est record-backed — audité : 0 synonyme utilisé). Les 13 variantes démon frenchy (espèce « Démon ») rendent en bipède Démon partout (combat+exploration). « Démon » exact rend en Démon. Prolonge [[game-frenchy-bzh-creatures]] + [[game-data-driven-architecture]] + [[game-creature-registry]].
