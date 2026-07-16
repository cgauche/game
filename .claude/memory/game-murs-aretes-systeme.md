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

**Rendu iso texturé** : `gameIso/walls.ts::wallSegs` — quad extrudé sur l'arête, LAMBRIS (panneau renfoncé + moulure + corniche + plinthe + poteaux d'angle), porte ajourée encadrée, ombrage par côté. `IsoStage` fusionne `wallObjs` dans le tri global.

**Murs DIAGONAUX** : `WallSeg.side += '\\'`(NO→SE) / `'/'`(NE→SO) = cloison oblique en travers d'une case (éventail auditorium/foyer courbe). PUREMENT VISUEL — `edgeOf`/walkability ne gèrent que N-E (déplacement reste orthogonal).

**Vue du dessus** : `wallSeg`/`stairSeg` ont une branche `dims.view==='top'` dédiée — mur = trait épais sur l'arête (porte = ouverture au centre), escalier = symbole de plan (carré gironné + chevron) ; l'extrusion iso ferait flotter des panneaux en vue du dessus.

**Élévation sub-niveau** : `Level.elev?: number[]` (parallèle à `tiles`, unités d'étage) + `elevAt(scene,x,y,z)`. `ground.ts::groundTile` soulève le losange de son élévation locale ; `elevSkirt` dresse une jupe (paroi verticale texturée) sur chaque arête en dénivelé (portée par la case HAUTE). Purement visuel/positionnel — marchabilité et étages inchangés (vraies chutes = Effet `fall` séparé, cf. [[game-opera-nadj-multiniveau-program]]).

**INVARIANTS DE RENDU (leçons dures, généralisables à tout élément positionné sur une case)** :
- **`liftAt(x,y,z)`** (=z+élévation locale) est LA fonction PARTAGÉE de tout ce qui se positionne sur une case — jeton (feetZ), surlignages de case (halos), et tout futur picking DOIVENT tous passer par elle. Un token qui se soulève sans que son surlignage suive = jeton hors de sa case.
- **Tout rendu DIRECTIONNEL (jupes, ombrage de mur) doit dériver l'avant/arrière de la GÉOMÉTRIE ÉCRAN** (position projetée de l'arête après rotation), jamais d'une direction MONDE figée — sinon sous rotation de caméra les jupes se posent sur les mauvaises arêtes et l'éclairage s'inverse.
- **`iso.ts::tileEdge(x,y,side,dims,lift)` = SOURCE UNIQUE des 2 extrémités-écran d'une arête cardinale** (coins de grille projetés AVEC rotation) — walls, jupes d'élévation et escaliers s'en servent tous, via le même `tileCenter`. **LEÇON CLÉ (utilisateur) : des comportements divergents entre éléments similaires (mur ≠ jupe ≠ escalier avant unification) sont un signal de DUPLICATION — extraire la primitive plutôt que corriger chaque site séparément.** Cf. [[feedback-contenu-donnee-editeur-pas-code]].

**Authoring** : `state/asciiMap.ts::parseWalledAscii` — carte WxH en box-drawing (2H+1)×(2W+1) chars, slots impairs=tuiles, pairs=arêtes (`|`/`-` mur, `:` porte, `+` jonction, espace ouvert), bords périmétriques inclus. Lisible comme un vrai floorplan.

**Outils éditeur** : outil MURS 🧱 (sous-modes Cloison/Porte/Diagonale ＼／, posés sur l'arête la plus proche via `screenToTileF` fractionnaire + `nearestEdge` + `canonEdge` anti-doublon, aperçu doré au survol, toggle) ; outil ÉLÉVATION ⛰ (presets Estrade/Scène/Haute/Fosse/Cave + saisie libre, pinceau 1/3/5, drag continu, undo par trait, mutation pure `paintElev`).

**Consommé** : le plan de l'Opéra (p.40 rez / p.41 étage) a été redessiné intégralement sur ce système (murs droits+obliques+portes, multi-niveaux, vide central, escaliers, textures, élévation scène/fosse) — cf. [[game-opera-nadj-multiniveau-program]] pour l'état du chantier consommateur.
