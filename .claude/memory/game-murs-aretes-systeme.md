---
name: game-murs-aretes-systeme
description: "Système de MURS SUR ARÊTES (cloisons fines) — moteur+rendu+authoring+outils éditeur LIVRÉS et consommés (plan de l'Opéra redessiné dessus)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5712d0f5-1e23-43ac-9ebc-d5b78277f3e8
---

Système complet de murs sur ARÊTES (cloisons fines entre deux cases), demandé pour reproduire un plan fidèlement — les murs-TUILES (`'mur'` occupe une case) ne permettent ni cloison fine, ni porte propre, ni façade courbe en blocs.

**Schéma + walkability** : `Scene.walls?: WallSeg[]` (`{x,y,side:'N'|'E',z?,door?}`, scene.ts). Forme CANONIQUE : N = arête entre (x,y) et (x,y-1) ; E = entre (x,y) et (x+1,y). `wallBetween`/`edgeOf` (scene.ts). `path.ts` : `neighborsOf` filtre les arêtes murées, saut interdit si décollage muré, escaliers ignorent les murs (passage explicite), une `door` laisse passer. Sans `walls` → BFS inchangé (non-régression).

**Rendu iso texturé** : `gameIso/builders/walls.ts::buildWalls` (extrémités-écran par `wallEnds`, couronnements par `crownFaces`/`crestEls`/`gableEls`) — quad extrudé sur l'arête, LAMBRIS (panneau renfoncé + moulure + corniche + plinthe + poteaux d'angle), porte ajourée encadrée, ombrage par côté. `IsoStage` fusionne `wallObjs` dans le tri global.

**Murs DIAGONAUX** : `WallSeg.side += '\\'`(NO→SE) / `'/'`(NE→SO) = cloison oblique en travers d'une case (éventail auditorium/foyer courbe). PUREMENT VISUEL — `edgeOf`/walkability ne gèrent que N-E (déplacement reste orthogonal).

**Vue du dessus** : `wallSeg`/`stairSeg` ont une branche `dims.view==='top'` dédiée — mur = trait épais sur l'arête (porte = ouverture au centre), escalier = symbole de plan (carré gironné + chevron) ; l'extrusion iso ferait flotter des panneaux en vue du dessus.

**Relief sub-niveau** : `Layer.height?: number[]` (parallèle à `tiles`, en **MÈTRES**) + `heightAt(scene,x,y,z)` (`state/scene.ts`) ; `metricToLift` / `METRES_PER_LEVEL = 4` (`state/relief.ts`) convertissent en unités d'étage pour le rendu. `buildFloors` (`gameIso/builders/floors.ts`) soulève le losange de sa hauteur locale et dérive les faces de dénivelé du delta avec chaque voisine : `gradeBetween` tranche `ramp` (≤ `STEP_MAX_M` = 1 m, plan incliné) vs `cliff` (paroi verticale), un bloc plein tirant ses 4 falaises du `solidHeightM` de son terrain. Le relief est **PORTEUR**, pas décoratif : le grade pilote la traversée verticale (`isWalkableGrade`, `surfaceLink`) et la distance verticale — les vraies chutes restent l'Effet `fall` séparé, cf. [[game-opera-nadj-multiniveau-program]].

**INVARIANTS DE RENDU (leçons dures, généralisables à tout élément positionné sur une case)** :
- **`liftAt(x,y,z)`** (=z+élévation locale) est LA fonction PARTAGÉE de tout ce qui se positionne sur une case — jeton (feetZ), surlignages de case (halos), et tout futur picking DOIVENT tous passer par elle. Un token qui se soulève sans que son surlignage suive = jeton hors de sa case.
- **Tout rendu DIRECTIONNEL (jupes, ombrage de mur) doit dériver l'avant/arrière de la GÉOMÉTRIE ÉCRAN** (position projetée de l'arête après rotation), jamais d'une direction MONDE figée — sinon sous rotation de caméra les jupes se posent sur les mauvaises arêtes et l'éclairage s'inverse.
- **`geometry/iso.ts::tileEdge(x,y,side,dims,lift)` = SOURCE UNIQUE des 2 extrémités-écran d'une arête cardinale** (coins de grille projetés AVEC rotation) — murs, faces de relief et escaliers s'en servent tous, via le même `tileCenter`. ⚠ La projection canonique vit dans **`src/geometry/iso.ts`** (`src/gameIso/iso.ts` est un autre module) : importer par le chemin, jamais par le nom de fichier. **LEÇON CLÉ (utilisateur) : des comportements divergents entre éléments similaires (mur ≠ jupe ≠ escalier avant unification) sont un signal de DUPLICATION — extraire la primitive plutôt que corriger chaque site séparément.** Cf. [[credo-exemples-calibrants]].

**Authoring** : `state/asciiMap.ts::parseWalledAscii` — carte WxH en box-drawing (2H+1)×(2W+1) chars, slots impairs=tuiles, pairs=arêtes (`|`/`-` mur, `:` porte, `+` jonction, espace ouvert), bords périmétriques inclus. Lisible comme un vrai floorplan.

**Outils éditeur** (`Tool` de `ui/editor/editorState.ts`) : outil MURS (`{mode:'wall'}`, sous-modes Cloison/Porte/Diagonale, `structure` = matériau porté par l'outil ; l'arête la plus proche vient de `screenToTileF` fractionnaire + `nearestEdge` + `canonEdge` anti-doublon, aperçu doré au survol, toggle) ; outil HAUTEUR (`{mode:'height'; metres}` → mutation pure `paintHeight` de `state/sceneEdit.ts`, pinceau, drag continu, undo par trait) — on peint des MÈTRES, la traversée verticale s'auto-dérive du delta.

**Consommé** : le plan de l'Opéra (p.40 rez / p.41 étage) a été redessiné intégralement sur ce système (murs droits+obliques+portes, multi-niveaux, vide central, escaliers, textures, élévation scène/fosse) — cf. [[game-opera-nadj-multiniveau-program]] pour l'état du chantier consommateur.
