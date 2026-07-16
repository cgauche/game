---
name: game-rampart-solid-block-height-unified
description: "Rempart = bloc plein général (mur) + chemin de ronde, PAS de sous-système zone-rempart ; hauteurs unifiées WALL_H=LEVEL_H=4m"
metadata: 
  node_type: memory
  type: project
  originSessionId: 658a4d3a-3f5a-489f-92b0-3ae4352fd194
---

Remodel majeur du rempart/porte (siege-enceinte), piloté par l'user contre l'accumulation de code spécifique dans le moteur (commit `e3bb58f9`, branche feat/wfrp4-rpg-foundation).

**Modèle GÉNÉRAL (plus de « zone rempart »)** : un rempart = un **bâtiment solide** — masse = terrain **bloc plein `mur`** au sol (le moteur en dérive TOUTES les faces, dont la **paroi latérale d'un tunnel** qu'il borde) ; chemin de ronde = une **couche de sol** marchable posée par-dessus ; porte = z0 laissé **passable** (tunnel) + herse WallSeg sur la bouche. Authoré par la recette `cells` (mapSpec, contenu). Le tunnel a parois + plafond **gratuitement** via 2 règles **générales** (valables pour TOUT élément) : bloc plein (relief existant) + **« tuile couverte par un solide au-dessus → plafond POV »** (`coveringHeight`, geometry.ts). **Zéro `isRampart`/`gateTunnel` dans le nouveau chemin.**

**Hauteurs UNIFIÉES** : `WALL_H = LEVEL_H` (iso.ts) ⇒ `WALL_H_M = METRES_PER_LEVEL = 4 m`. **Un mur = un étage partout** (herse/merlons remplissent leur ouverture ; fini le « délire » mur 2,25 m / niveau 4 m que l'user a pointé). `mur.solidHeightM=4`. Terrain `muraille` (créé puis) **jeté** — le `mur` suffit. Choix user : unifier VERS 4 m (murs des bâtiments montent à l'étage), PAS vers 2,5 m.

**Pourquoi c'est la bonne archi** (leçon user, cf. [[feedback-appearance-svg-in-defs]], [[game-data-driven-architecture]]) : le POV est un 2ᵉ moteur qui re-dérive tout → chaque élément spécifique re-branché dans floors/walls/pov = spaghetti. Solution = primitives générales composables (bloc plein + couche de sol + structure), pas du code par-élément.

**FAIT (commit `d7cc1b63`, suite verte 8293/8293)** — le sous-système zone-rempart est **entièrement supprimé** :
- SUPPRIMÉS : `isRampart`/`rampartAt`/`buriedUnderRampart`/`gateTunnelAt`/`rampAccessAcross` + la règle
  `isWalkable` « masse de mur » (l'impassabilité vient du terrain `mur`) ; `isRampartPerimeterEdge`/
  `structureUnder(Edge)` ; les branches `isRampart` de floors (isOverhang / skip de falaise).
- **Créneaux = décoration de RENDU pure** : `crestEls` (ex-`rampartWallEls` réduit à la crête) émet les
  merlons de PÉRIMÈTRE via `crownFaces`, keyé sur `Layer.crenellated` (ex-`Layer.rampart` RENOMMÉ, marqueur
  render-only). N'ajoute AUCUN `WallSeg` de scène → **ne coupe NI passage NI LdV plongeante** (le PIÈGE
  évité ; garde-fou testé). Authoring : `paintCrenellated` marque le chemin de ronde ; cells le pose.

Vérif in-game POV : `siege-explore` (14,38) plein nord = tunnel avec parois + plafond de pierre + herse ;
iso = masse pleine à sommet crénelé. HAZARD // : `walls.ts`/`walls.test.ts` avaient un hunk fenêtre d'une
session // (croisee-cadre retiré) embarqué dans mon commit (atomicité) ; `affineWalls.ts`/`catalog/structures/*`
= leur WIP staged, laissé intact (cf. [[git-commits-propres-wip-parallele]], [[game-curated-commit-interleaved-tree]]).
