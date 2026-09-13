---
name: game-rig-2d-paper-doll
description: "Le rig SVG est un pantin 2D de FACE — les poses tournent dans le plan de l'image, jamais en profondeur"
metadata:
  node_type: memory
  type: reference
---

Le rig (`src/gameIso/rig/`) est un pantin 2D vu de FACE : les angles de `Pose` font tourner les os DANS LE PLAN de l'image (roll), jamais en pitch/yaw — `torse` positif couche le tronc vers la gauche écran, un gros repli de jambes écarte ou couche au lieu d'abaisser. Accroupi, agenouillé, assis et révérence sont donc IMPOSSIBLES : ces intentions s'expriment debout, par balancement de membres + bob + décor (`src/gameIso/rig/anim/ambientClips.ts`). Les 8 directions viennent de vues d'art distinctes (front/back/profile), pas d'une rotation.

**Why:** régler des angles comme s'ils avaient de la profondeur produit des poses couchées absurdes.
**How to apply:** exprimer la pose debout ; rendre le résultat en PNG (`@resvg/resvg-js`) et le REGARDER — jamais d'angle réglé à l'aveugle.
