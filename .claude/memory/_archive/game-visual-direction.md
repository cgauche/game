---
name: game-visual-direction
description: Direction artistique imposée pour le RPG Warhammer (projet Foundry/Game)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f7e33c80-160c-4d14-aeb7-48823768b89c
---

Pour le jeu vidéo RPG Warhammer (dépôt `cgauche/game`, sous `Foundry/Game`), la direction visuelle EXIGÉE par l'utilisateur est :

- **Isométrique 2.5D « à la Baldur's Gate »** (vue 3/4), PAS de vue top-down ni de carrés de couleur.
- **Art SVG dessiné/calculé à la main** (l'utilisateur sait que je peux faire de beaux modèles SVG). PAS de « formes procédurales » génériques.
- **Scènes narratives détaillées** : la scène d'embuscade DOIT montrer la diligence renversée, les cadavres, les traînées de sang, les mutants qui dévorent — pas juste des pions.
- **Tout doit être ANIMÉ** (mutants qui se balancent/dévorent, mouches, corbeau, lumière qui vacille, respiration idle ; et à terme marche/attaque/mort).
- Three.js a été écarté ; le rendu cible est **2D isométrique SVG/canvas**.

**Why:** la première livraison (carrés de couleur top-down générés par code, « jeu 2D des années 1980 ») a été rejetée nettement. L'utilisateur veut un vrai RPG avec ambiance et art soigné.

**How to apply:** preuves d'art validées dans `public/art-proof.html` et `public/ambush.html` (générées par `scripts/gen-art.mjs` / `scripts/gen-ambush.mjs`). Le futur moteur de rendu remplace les carrés Phaser par ce style iso SVG, en réutilisant le moteur de règles WFRP4 (`src/engine`), le store et le schéma de Scène. Voir [[game-rules-engine-reuse]].
