---
name: game-iso-depth-z-secondary
description: Ordre du peintre iso = z-SECONDAIRE (pas z-dominant) ; vérifier rendu sur 2 projections × 4 rotations
metadata: 
  node_type: memory
  type: project
  originSessionId: 03105508-1981-4187-b39c-23c39463ada6
---

Le tri en profondeur iso (`src/gameIso/iso.ts depth`) est **z-SECONDAIRE**, plus z-dominant : `depth(x,y,z) = base*BASE_SCALE + z*Z_STEP` (BASE_SCALE=64, Z_STEP=2 ; `base` = anti-diagonale `r.x+r.y` en losange, `r.y*(w+h)+r.x` en edge). Précédence : **anti-diagonale écran ≫ z ≫ offset de calque** (sol −0.5 / overlay +0.25 / jeton +0.5 / mur +0.45 / escalier +0.42, tous < Z_STEP). `LEVEL_DEPTH` (1e6) et `floorDepth` SUPPRIMÉS : le sol se trie PAR TUILE `depth(x,y,z)−0.5`, les overlays/highlights PAR CASE `depth(x,y,z)+0.25` (plus de groupe par-z). Tout élément multi-cases passe par `footprintDepth(x,y,w,h,dims,z)` = `Math.max(depth(coins))` → correct aux 4 rotations.

Pourquoi : l'ancien modèle z-dominant (tout z=N après tout z=N−1) rendait un élément VERTICAL multi-niveaux (mur/escalier) intriable — ancré bas il passait sous le sol z1 (courtine plate, porte invisible), ancré haut il passait DEVANT la cour (le mur avalait la cour en edge-on). Le z-secondaire imbrique par vraie position écran. Sûr car AUCUN surplomb en porte-à-faux dans le contenu (chaque tuile z1 est au-dessus de SA case z0 ; cf. `rampartTilesAbove`). Bâtiments = objets z0 uniques (`BuildingSprite`), inchangés.

Rempart (siège) : le chemin de ronde fait **2 cases** (y37 champ + y38 cour) straddlant l'arête du mur. `structureSeg` rend la FACE à l'arête du mur mais le **parapet/créneaux à l'arête EXTÉRIEURE** (`outerEdge(w,dims)` : N→N de (x,y−1), E→E de (x+1,y)) — sinon les créneaux bisectent la passerelle. Une **tour** (height≥2) : `wallDepth` plafonne son z de tri au **niveau de rempart** (`rampartLevelOf(w,scene)`) au lieu de son sommet extrudé, sinon elle occulte l'unité posée sur sa propre case.

LEÇON (coûteuse) : un bug de RENDU se vérifie OBLIGATOIREMENT dans **les 2 projections (`camEdge` true/false) × les 4 rotations (`camRot`)** — le losange paraissait correct pendant que l'edge-on était cassé. Ne JAMAIS dire « corrigé » sur un seul angle. Cf. [[game-murs-aretes-systeme]], [[game-vision-fog-of-war]], [[game-opera-nadj-multiniveau-program]], [[credo-exemples-calibrants]].
