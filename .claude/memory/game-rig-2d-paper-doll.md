---
name: game-rig-2d-paper-doll
description: "Le rig SVG du jeu est un pantin 2D de FACE — les poses tournent dans le plan de l'image, pas en profondeur."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5b5e1576-6e66-4371-b038-61f34984d882
---

**Le rig (`src/gameIso/rig/`) est un pantin 2D vu de FACE.** Les angles de `Pose`
(deltas sur les os) tournent les os **dans le plan de l'image** (roll), PAS en
profondeur (pas de pitch/yaw 3D). Vérifié visuellement (planche de debug, 2026-06-05) :

- `torse` **positif = bascule le tronc vers la GAUCHE écran** (roll anti-horaire), pas
  « penché en avant ». `torse: 46` couche presque le perso à l'horizontale.
- `bassin` positif = bascule TOUT le corps vers la gauche.
- `cuisseG/D` = balance la jambe sur le côté (pas un fléchi qui abaisse la hauteur) ;
  `tibia` négatif plie le genou en arrière. Un gros repli de jambes **écarte/couche**.
- `epauleD/G` positif = descend/ramène le bras vers l'avant-bas en travers ; négatif = lève.
- `tete` = incline la tête sur le côté.

**Conséquence :** impossible de faire un vrai **accroupi / agenouillé / assis / bow en
avant** (ça demande de la profondeur ou de baisser le bassin, que le rig ne fait pas).
Les poses au sol partent à l'horizontale. Exprimer ces intentions **debout** : via les
**balancements de membres** (bras qui plongent bas-devant = « fouille/dévore », bras
levés = prière/terreur) + un **bob** + le **décor** (prop `cadavre` à côté). Cf.
`ambientClips.ts` (feeding/praying/cowering refaits ainsi). Le facing 8-dir gère les
orientations via des **vues d'art distinctes** (front/back/profile), pas par rotation 3D.
Voir [[game-goal-sprites-anims-complets]], [[game-visual-direction]].

**Pour itérer une pose : rends-la en PNG et REGARDE-la.** `@resvg/resvg-js` est dispo
(rasterise SVG→PNG sans navigateur) ; ou via le dev server + Playwright (`public/*.html`
de QC). Ne pas régler des angles à l'aveugle.
