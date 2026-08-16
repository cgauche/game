---
name: game-orientation-monde-facing
description: "Architecture de l'orientation des persos (facing) — Dir8 monde persistant projeté au rendu"
metadata: 
  node_type: memory
  type: project
  originSessionId: 24bd007c-bb00-4fa8-84dd-c36f173caa26
  modified: 2026-08-16T07:38:53.578Z
---

Refonte orientation (livrée + poussée, 2026-06-07). Le facing était calculé en espace-écran, éphémère, sur événement (`useState` par token) → ne suivait pas la rotation caméra, ne tenait pas au repos. Remplacé par une **orientation MONDE persistante** :

- Type `Dir8` (N/NE/E/SE/S/SO/O/NO) dans `src/state/dir8.ts`. Vit dans `store.facing: Record<id, Dir8>` (vivant, sérialisé) + `SceneEntity.facing` (authored, éditable). **Jamais sur le `Combatant` du moteur** (engine reste pur — visuel seulement, pas de règle flanc/dos).
- Rendu = **pure projection** `project(dir, camRot)` dans `src/gameIso/rig/facing.ts`, recalculée à CHAQUE rendu → tourner la caméra ré-oriente les sprites sans aucun event. Les tokens (RigToken/AnimatedPlanToken) lisent `store.facing[id] ?? authored` + `camRot` et projettent. **Invariante : l'orientation est une donnée monde, le rendu n'en est qu'une projection.** Table de vérité 8×4 figée par test (`facing.test.ts`).
- Écrit via actions store `faceFromPath`/`faceToward`/`faceAtCombatStart` : déplacement (héros/charge/IA/moveParty), attaque (attaquant **et** défenseur), sorts (lanceur, +cible si offensif), entrée en combat (vers l'ennemi le plus proche).
- Caméra = 4 positions (90°), orientation perso = 8 (diagonales) ; le rendu snappe 8→3 vues d'art (front/back/profile) + miroir (cf. [[game-rig-2d-paper-doll]]).
- `BodyToken` (src/gameIso/BodyToken.tsx) = **coquille de positionnement unique** (ombre+ancrage+échelle+mort). ⚠ 2026-08-16 : `EntityToken` SUPPRIMÉ et `IsoStage` ne monte plus de corps React (voie volumique par défaut, #1176) — `BodyToken`/`tokenBodyKind` sans importeur prod hors éditeur, candidats purge Phase 3.
- `pickBackend` (src/gameIso/pickBackend.tsx) = **classifieur unique** `{backend:'rig'|'plan'|'sprite', body, speciesScale, id}` : collapse l'échelle `isHero/enemyRigProfile/entityRigProfile/bodyPlanOf` des **4 sites** de dispatch (combat + exploration + leader + éditeur). A corrigé un bug éditeur (personnages quadrupèdes en sprite figé → animés) + unifié l'id entité (`e-`). NE porte pas de layout (échelle de base/anneau/dim restent au site).
- **Les 2 moteurs d'animation rig vs plan restent SÉPARÉS — fusion REJETÉE** (verdict adversarial, workflow) : asymétrie *essentielle*, pas incidente. Rig = système de **clips keyframe** (clips par arme×16 maniements, parade/esquive, styling de sort, ré-émission d'impact sync au swing) ; plan = **fonction de pose closed-form** (`walkPose(phase)`/`attackPose(0..1)`). Toute interface unique serait lossy (on détruit les comportements rig) ou leaky (le plan stub ~70% de no-ops). Câblage bus reste **par-backend**. NE PAS re-proposer la fusion.
- Legacy supprimé au passage : chemin de rendu monolithique en combat (mort — `bodyPlanOf` ne renvoie jamais `'monolithic'`), `hasCreatureViews`. `creatureView`/`creatureViews.json` GARDÉS (outillage QC). Cf. [[credo-exemples-calibrants]].

Spec/plan : `docs/superpowers/specs|plans/2026-06-07-orientation-monde-facing*.md`.
