---
name: game-vision-fog-of-war
description: "Système de vision / brouillard de guerre (LoS, lumière, IA réciproque, portes) — architecture + invariants perf ; le voile est un filtre CSS PAR OBJET (fogFilterFor) appliqué dans le flux trié par CulledScene."
metadata: 
  node_type: memory
  type: project
  originSessionId: 92177717-0072-4ca3-bf2a-5956ae6564d8
---

Système de vision/brouillard de guerre. Demande user : « si pas en vue, on ne voit rien — même le décor ; pas à travers les murs ». Tout data-driven (éditable au Codex).

**Moteur PUR** `src/state/vision.ts` (vit en state car couplé à `Scene`, comme `lineOfSight.ts`) :
- `computeVisible(scene, viewers, light, smoke)` → Set `"x,y,z"` ; `computeLightField` (champ 0..1 + `sourceLit`) ; `ambientScalar`/`baseSightTiles` (dataset `lightLevels.json`) ; `darkSightTiles(c)` (capability sur traits, Vision nocturne 10/Infravision 999) ; `mapLights`/`combatantLights`.
- **Occlusion UNIQUE** = `lineOfSightCover` (combat ET vision). Pour la VISION, `occluded()` est plus strict : couvert TOTAL + anti-fuite au coin d'un mur (échantillonnage fin `tileBlocksSight`) + coins diagonaux des murs d'arête (`wallOnSight` réutilise `wallBetween`). RAW combat intact.

**Données** : `lightLevels.json` (jour/couvert/crépuscule/nuit/ténèbres, MAISON) ; `props.json` (types solid/opaque/cover/light) ; `TrappingData.light` ; terrain `opaque` ; `Scene.ambientLight`/`SceneEntity.light`.

**État/rendu** : `GameState.explored` (persistant, hors reset scene) + `visionState.computeStateVisible` (union héros vivants/groupe) ; `visible` DÉRIVÉ au memo d'`IsoStage` (stable pendant la marche, cf. [[game-isostage-walk-rerender-perf]]) + `markExplored`. `src/gameIso/FogLayer.tsx` : les 3 états en CSS `filter` (en vue = aucun filtre ; mémorisé `brightness(.42) saturate(.45) opacity(.82)` ; inconnu `brightness(0) opacity(.38)`) — CSS et non filtre SVG `url()`, que Chrome re-rastérise au CPU par élément. Culling des créatures hors-vue ; ghost conservé (vu du groupe mais hors LdV du tireur actif). Échelle 1 case = 2 m.

**IA réciproque** : `visionState.perceivedTiles(viewer)` → `EnemyTurnInput.perceived` ; `chooseEnemyAction` ne cible/poursuit que les héros perçus.

**Portes** : `WallSeg.closed` + `doorKey`/`doorIsOpen`/`setDoorOpen`/`toggleDoorIn` — fermée bloque vue+passage, défaut ouvert (non-cassant). Effet `setDoor` authorable. Combat door-toggle = gratuit (raffinement noté, pas fait).

**PERF (3 root causes historiques, corrigées)** : `computeVisible`/`occluded` en `.find` O(entités)/échantillon → **grille d'opacité `Uint8Array` O(1)** précalculée (`buildOpaque`) ; murs via `scene.walls.some` O(murs) → **Set d'arêtes O(1)** + `wallOnSight(..., edgeBlocks?)` injectable ; FogLayer dessinant TOUTE la scène re-rastérisée à chaque transform caméra → **culling au viewport** (AABB entiers dérivés d'IsoStage, memoïsé) + fusion de blocs 4×4 uniformes en 1 losange.

⚠️ **Coût structurel restant (PAS lié au brouillard)** : les grandes scènes très détaillées (ex. Opéra : ~2640 sols + ~999 murs + décor) restent lourdes au pan car toute la scène SVG se re-rastérise par frame — le culling viewport ne couvre que les couches lourdes filtrées par position ÉCRAN (`.filter().map()`), pas une vraie limite architecturale de ~1500 tuiles SVG complexes/frame. Fluidité totale nécessiterait un rendu bitmap/canvas de la scène statique, en CONFLIT avec le tri de profondeur (murs occultant les tokens vivent dans le même SVG trié) — chantier lourd non fait, NE PAS réintroduire `.find`/`.some` par tuile/rayon ni dessiner hors-viewport en attendant.

**⚠️ Le voile est PAR OBJET, dans le flux TRIÉ** : `stage/CulledScene.tsx` filtre au viewport puis applique `fogFilterFor(o, explored)` à chaque objet hors-vue, à SA profondeur, et coalesce les objets filtrés CONSÉCUTIFS sous un seul `<g filter>` (un filtre CSS = une couche GPU par élément) — les jetons non filtrés restent enfants directs, clé stable, sinon React les remonte à chaque frame et le cycle de marche se réinitialise. `fogFloorZ` (`builders/floors.ts`) donne l'étage de sol effectif sous un trou pour que le voile reflète le bon niveau. **Deux formes à ne PAS réintroduire** : (a) un split visible/!visible de la liste triée — il écrase l'ordre de profondeur (mur en vue par-dessus une rampe hors-vue, cf. [[game-iso-depth-perface-hard]]) ; (b) un voile-losange au sol — il ne couvre que l'empreinte, laissant la face d'un mur de 4 m éclairée au-dessus d'un triangle sombre. Les invariants perf ci-dessus (grille O(1), Set d'arêtes, culling viewport) tiennent.

Recette navigateur OK (occlusion murs, halos ténèbres, Vision nocturne, clic porte). Prolonge [[game-murs-aretes-systeme]], [[game-data-driven-architecture]].
