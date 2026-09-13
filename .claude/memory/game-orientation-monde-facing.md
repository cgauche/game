---
name: game-orientation-monde-facing
description: "L'orientation d'un personnage est une donnée MONDE (Dir8) ; le rendu n'en est qu'une projection"
metadata:
  node_type: memory
  type: project
---

`Dir8` (`src/state/dir8.ts`) vit dans `store.facing` (vivant, sérialisé) et `SceneEntity.facing` (authoré) ; jamais sur le `Combatant` du moteur (pas de règle de flanc/dos). Le rendu est la projection pure `project(dir, camRot)` (`src/gameIso/rig/facing.ts`), recalculée à chaque rendu.

**Why:** un facing calculé en espace-écran ne suit pas la rotation de caméra et ne tient pas au repos.

**How to apply:** écrire l'orientation par les actions du store (déplacement, attaque, sort, entrée en combat) ; ne jamais la dériver d'un état de rendu. Les deux moteurs d'animation — rig (clips keyframe) et plan (pose closed-form) — restent SÉPARÉS : leur fusion a été évaluée et rejetée, elle ne se re-propose pas.
