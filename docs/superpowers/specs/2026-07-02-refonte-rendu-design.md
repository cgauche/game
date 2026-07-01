# Refonte totale — rendu ISO / éditeur de map / POV

## Contexte

Après l'empilement rapide de nombreuses features de rendu (verticalité métrique, murs d'arête, multi-niveaux, surplombs, occlusion, vue edge-on 8 crans, vue du dessus, POV première personne, apparence JSON, MapSpec/buildScene), l'utilisateur n'est **satisfait ni du résultat visuel ni du code**. Mission : tout mettre à plat, revoir la structure, corriger code/SVG/géométrie pour un rendu au niveau « dessiné main » (direction connue : iso SVG dessiné main « à la Baldur's Gate », animé).

**Décisions utilisateur actées (2026-07-02) :**
- Périmètre : **tout remettre à plat** (y compris format map/authoring si le jugement le commande — licence de supprimer/refaire ce qui n'atteint pas la barre, tests compris, réécrits de zéro plutôt que travestis).
- Vues conservées : **iso losange 4 rotations (cœur) + vue du dessus + vue de face (edge-on 8 crans) + POV première personne** — toutes.
- Barre visuelle : **« dessiné main » d'emblée**, pas seulement « lisible et cohérent ».
- Contrat : zéro dette/duplication/rétro-compat/code mort, data-driven maximal, réutiliser l'existant, rien de hardcodé. Orchestrateur + agents codeurs, tout vérifier (ne croire ni ticket, ni commentaires, ni agents, ni user ; vérifier le RAW).

## État des lieux (constaté en jeu + lecture directe)

### Symptômes visuels (screenshots faits en session, dev server + Playwright)
1. **La vue par défaut au chargement est la pire** : `camEdge: true` par défaut (`store.ts:991`) → toute scène s'ouvre en vue « de face » (edge-on) qui rend en rangées de rectangles plats illisibles (siège = mur de briques plein écran ; Bourg = « tricot »). Un cran de rotation plus loin, la même scène est un iso losange lisible.
2. **POV = prototype nu** : polygones à aplats gris sans texture ; au spawn du siège on regarde le ciel vide (facing par défaut 'S' + groupe au bord sud de la carte → regard hors-carte).
3. **Même la bonne vue iso est fade/synthétique** : murs = grands aplats + 2-3 bandes (aucune texture pierre), toits = mosaïque de losanges (effet carrelage + motifs zigzag cassés sur certains pans), sol uniforme sans variation par tuile, bâtiments lus comme « muret + toit flottant ».
   - **Cause racine toit identifiée** (`catalog/buildings/render-helpers.ts:roofFromCells`) : nappe rendue **une quad PAR CELLULE**, liseré par cellule, teinte choisie par pente dominante PAR CELLULE (`|dhx|` vs `|dhy|`) → mosaïque, et zigzag de teintes le long des faîtes diagonaux où les deux pentes s'équilibrent. Correctif cible : fusionner les cellules en **pans continus** (un polygone par pan + lignes de rangs issues de la recette matériau).

### Diagnostic code (lecture directe)
- **`src/gameIso/iso.ts` (271 l.) : SAIN.** Module de projection pur et testé — losange/top/edge-on, 4 rotations, z (LEVEL_H), tri de profondeur (BASE_SCALE/Z_STEP), arêtes (`tileEdge`), occlusion (`makeOccludes`). Les 3 projections partagent la géométrie axis-alignée (`axisStep`). À conserver comme socle.
- **`src/gameIso/shade.ts` : SAIN.** Ombrage pur (lumière ⊥ identité matériau), garde-fou anti-hex dans les renderers migrés.
- **Apparence JSON récente (commit ac32b07c) : fondation bonne, couverture incomplète.** `src/data/structureAppearance.json`, `reliefMaterials.json`, `roofMaterials.json`, `TerrainDef.stops` — consommés par walls.ts/RoofSprite/ground ; POV consomme la même donnée mais ne rend que des aplats. Parité iso↔POV annoncée « restant à vérifier » dans le commit lui-même → non tenue en pratique.
- **`src/gameIso/walls.ts` (194 l.) : structure saine (pur, data-driven), langage visuel pauvre** (slabs + bandes). Rendu par concat de strings SVG.
- **`src/gameIso/pov/` (8 fichiers, ~1230 l.) : architecture propre** (noyau pur `makeCamera`+`buildPovDrawList`, couche React fine `PovStage.tsx`, scène partagée) mais **contenu de rendu embryonnaire** (draw list = polygones remplis, pas de props/détail, facing par défaut absurde).
- **`src/gameIso/IsoStage.tsx` : LE monolithe en crise — ~1 840 l. dont ~1 700 dans UNE fonction React.** Terrain, murs, toits, surplombs/fantômes, occlusion/estompe/cutaway, fog, tokens, previews, FX, caméra/zoom/pan, pointeur — tout entrelacé. À démonter.
- **Infra de vérification existante** : QC headless SVG→PNG via `@resvg/resvg-js` (`scripts/qc/render-*.mts`, ex. render-walls, render-opera, sortie `public/qc/*.png`), galeries (`npm run galleries`), suite Vitest ~7150 tests verte, `__wfrp` devtools pour recette Playwright.
- Changements non commités pré-existants hors périmètre : `src/engine/flowCore.ts`, `src/engine/relations.ts` (petits, moteur — à laisser de côté / signaler).

### Inventaire détaillé — rapport A (couche rendu) ✔

**4 pipelines de rendu pour 1 scène partagée :**
| Pipeline | Fichier | Projection | Notes |
|---|---|---|---|
| Jeu iso/edge/top | `IsoStage.tsx` (1839 l.) | 3 projections d'`iso.ts` | tout-en-un, monolithe |
| POV | `pov/` (1319 l.) | perspective pinhole (`camera.ts`, math distincte — attendu) | noyau pur + React fine |
| Éditeur | `ui/editor/EditorCanvas.tsx` (557 l.) | réutilise primitives `iso.ts` | MAIS ré-implémente boucle de tri + ses propres toits plats |
| Galeries QC | `scripts/*gen-*.mts` | rig direct (Node, resvg) | **aucune galerie d'ENVIRONNEMENT** (sols/murs/toits) — trou de vérification |

**Carte de duplication (8 points concrets) :**
1. Apparence de mur assemblée 2× (walls.ts iso détaillé VS pov/geometry.ts quads monde ; `wallApp` partagé mais assemblage réécrit ; détail bois iso-only).
2. Extrémités d'arête N/E/\// : **4 implémentations** (iso.ts `tileEdge`, walls.ts `edgeEnds`, pov `segEnds`/`edgeFaceWorld`, pov/camera `wallCornersWorld`).
3. Relief falaise/rampe re-dérivé 2× (ground.ts `reliefFaces` VS pov risers `neighborTop`).
4. Sol : 2 mécanismes de fill (gradient SVG iso VS swatch teinté POV) sur la même `TerrainDef`.
5. Toits 2× (RoofSprite 3D jeu VS losanges plats éditeur) + POV : aucun toit.
6. Occlusion 2 approches dans IsoStage même (`makeOccludes` VS `coversActorBelow` maison).
7. Boucle de tri `{d,el}` ré-implémentée IsoStage VS EditorCanvas.
8. Logique 'top' éclatée (walls/sprites/iso).

**Ce que le POV ne rend PAS** : props, toits, overlays terrain, créatures non-humanoïdes (skip), FX/surbrillances, wedges — v1 heightfield + murs + billboards humanoïdes cap 10.

**IsoStage.tsx — sections du monolithe** (l.124→1839, une fonction) : caméra 8 crans + transition dim-and-turn ; niveaux/lift ; brouillard ; 5 couches mémoïsées (floorObjs avec surplomb/fantôme, wallObjs, decorObjs, roofObjs cutaway, entityObjs) ; ciblage/survol/réticule ; surbrillances statiques ; branche combat + branche explo ; tri ; caméra/focus/culling ; pointeur (picking cross-couche z haut→bas, pan, clic) ; JSX ~500 l. (fog sandwich, overlays portes, télégraphes, gabarit ZdE, tooltips, debug, ambiance).

**Modèle scène (état sain)** : `Scene.layers[z].tiles` PLAT + `height` métrique, `walls: WallSeg[]` (arêtes), `roofs`, `entities` ; le rendu dérive relief/surplomb/profondeur/occlusion. Accès : `tileAt`/`heightAt`/`structureIsDown`/`doorIsOpen`.

### Inventaire détaillé — rapport B (couche apparence) ✔ *(claims charnières re-vérifiés par sondage)*

**3 sources de couleur concurrentes aujourd'hui** : (A) JSON `src/data/*.json` (structures/relief/toits — propre, partagé iso↔POV) ; (B) defs terrain `src/state/terrain/defs/*.ts` (stops+swatch) + **CSS `var(--struct-*)` de base.css pour la pierre** (split-brain : le POV en garde un miroir hex en dur `STRUCT_FALLBACK`, `pov/geometry.ts:58` — **vérifié**) ; (C) inline dans les renderers.

**Hardcodé restant (par gravité)** :
- `catalog/decor/defs/*.ts` : **321 littéraux hex sur 97 fichiers** (**vérifié par grep**) + la forme SVG entière en `render()` code (assumé par la doctrine defs/).
- `sprites.ts` : wallBlock/tree/villager/ombres/rigFxGradients + `TERRAIN_OVERLAYS` mur/bois en code.
- `IsoStage.tsx` : `AMBIANCE_DEFS` (g_warm/vignette/filtre), tunables.
- `pov/*` : FOG_OUTDOOR/FOG_COLOR/ciel/vignette/formules tint.
- Formes/facteurs inline (couleurs OK) : `ground.ts` (SLOPE_BOT, DECK_THICKNESS…), `walls.ts` (OUTLINE, DOOR_FRAC, BREACH_*…).
- **Garde-fou anti-hex ne couvre que 4 fichiers** (walls, ground, RoofSprite, render-helpers) — rate sprites.ts, pov/*, IsoStage, decor defs.

**Partage iso↔POV réel** : la DONNÉE est partagée (`wallApp`, `reliefMaterial`, `TerrainDef`) mais le POV ne consomme que `face/band/cap` en aplats teintés — ignore wood.*, stops, orientation ; ne rend ni décor, ni toits. → l'impression « plans nus » vient du rendu, pas de la donnée.

**Pourquoi le sol est uniforme** : `TerrainDef` = 1 gradient vertical 2-stops identique sur toutes les tuiles ; aucun motif, aucun jitter/seed par tuile.

**Chaîne auteur SAINE** : scènes/MapSpec/scénarios déclarent l'apparence **uniquement par id** (terrain, prop ref, roofMaterial) — jamais une couleur. Tout le hardcodé est enfermé dans les defs de rendu.

---

## Architecture cible — « une scène, une apparence, N projections »

**Verdicts par brique (licence supprimer/refaire appliquée avec jugement) :**
| Brique | Verdict | Sort |
|---|---|---|
| `iso.ts` (projection 3-en-1, tri, arêtes, occlusion) | SAIN | socle conservé |
| `shade.ts` + matériaux JSON | SAIN, incomplet | conservé + étendu (vocabulaire de détail) |
| Modèle `Scene` (layers/walls/roofs/entities) + MapSpec/buildScene | SAIN (chaîne 100 % par ids) | conservé |
| `pov/camera.ts` (pinhole pur) | SAIN | conservé |
| `IsoStage.tsx` (monolithe 1839 l.) | EN CRISE | démonté → builders purs + stage fin |
| `pov/geometry.ts` (heightfield qui re-dérive tout) | à refondre | re-écrit sur les builders partagés |
| `EditorCanvas` pipeline local + toits plats | duplication | consomme les builders (chrome d'éditeur séparé) |
| Langage visuel (aplats) | INSUFFISANT | matériaux v2 « dessiné main » |
| `sprites.ts` wallBlock/tree, `TERRAIN_OVERLAYS` | legacy | absorbé/supprimé |
| Galeries QC (rig only) | trou | + galerie d'ENVIRONNEMENT headless |

**Couche 1 — Matériaux v2 (données).** Étendre les defs existantes (terrain/structure/toit/relief + nouvelle def `ambiance`) avec un **vocabulaire déclaratif de détail en espace de FACE (UV)** : rangées/courses (pierres, bardeaux, chaume, planches), bandes, mouchetis, jitter seedé par tuile/arête/instance, contours irréguliers, variance de palette. Une recette est de la DONNÉE ; les deux backends la dessinent. Palette pierre unifiée (JSON seule source ; CSS var généré si l'UI en a besoin ; `STRUCT_FALLBACK`+`resolveCss` supprimés). Garde-fou anti-hex étendu à TOUS les renderers d'environnement.

**Couche 2 — Builders de scène purs, projection-agnostiques (le cœur du démontage).** UN builder par préoccupation produit des éléments sémantiques en espace monde + état (visible/occlus/cutaway/down/open) : `buildFloors` (sols + relief + surplombs + wedges — `ground.ts` les fusionne déjà), `buildWalls`, `buildRoofs`, `buildProps`, `buildTokens`, `buildHighlights/Overlays` (jeu seul). Remplacent : les 5 couches mémoïsées d'IsoStage, la boucle locale de l'éditeur, le heightfield POV. Dérivations uniques : relief (deltas hauteur), surplomb, occlusion (fusion `makeOccludes`/`coversActorBelow`), arêtes (seul `tileEdge`).

**Couche 3 — Deux backends de projection.**
- **Écran-affine** (iso losange · edge-on · top) : projette via `iso.ts`, dessine les recettes UV→écran, tri `depth()` partagé. L'éditeur = ce backend + options (sans fog, toits en mode plan étiqueté).
- **Perspective** (POV) : projette via `camera.ts` + clip, dessine les MÊMES recettes UV en trapèzes perspectives (détail par bande de distance), props/tokens en billboards, brume/tint depuis la def `ambiance`.

**Couche 4 — Stages React fins.** IsoStage ≈ 150-300 l. (état → builders memoïsés → rendu) + hooks extraits `useStagePointer` (picking pur partagé) / `useStageCamera`. PovStage reste fin. Défauts corrigés : **chargement en vue coin (losange)** — l'edge-on reste accessible au cran de rotation ; POV spawn orienté vers le contenu ; cap billboard POV paramétré.

**Décor (97 defs)** *(arbitrage utilisateur 2026-07-02)* : conforme à la doctrine defs/ — le dessin reste du code par def, MAIS couleurs → matériaux partagés (fin des 321 hex) et le POV rend les props en **billboards du même SVG iso** (comme les personnages).

### Conception de la couture (validée par stress-test adversarial, agent Plan)

**Type pivot « élément sémantique »** — union par genre, payload géométrique en faces :
- Coordonnées pivot : **(x,y) en unités de GRILLE continues + h en MÈTRES** — jamais de rotation, jamais d'écran. Affine → `tileCenter(x,y,dims,z)` ; perspective → `{x·mpt, y·mpt, h}`.
- `Face { poly: GP[], plane: 'ground'|'vertical'|'slope', material: MaterialRef{domain,id,part}, detail?: DetailRef }` — la base UV n'est PAS stockée (dérivée de `poly[0]→poly[1]` + `plane` par chaque backend ; une base stockée dériverait).
- `SceneEl = floor|wall|roof (faces) · prop|token (billboard, zéro face)` + `{ key stable monde, cell{x,y,z index de couche}, span? (empreinte), sortClass sémantique, states{visible,down,open,overhang,roofOccupied} }`.
- **Les builders n'importent NI `Dims` NI `CamPose`** (sinon la sortie mémoïsée s'invalide à chaque rotation et le POV hérite d'un concept étranger). La rotation vit 100 % dans le backend affine. `segEnds` (aiguillage N/E/`\`/`/`) devient helper PARTAGÉ du builder murs.

**Recettes de détail (données)** : `DetailRecipe { courses?{hM,joint,jointW,stagger,blockWM?,edgeWobble,paletteVar}, bands?[{atV,hM,color}], timber?{postEveryM,braces,wM,color}, speckle?{perM2,rM,colors}, seedScope:'edge'|'tile'|'instance' }`. **Seed jamais stocké** : dérivé de l'identité monde `hash32(kind,x,y,z,side?)` → stable entre frames, rotations et projections.

**Rendu affine — règle structurante « pattern = structure, fill = couleur »** : la face pose son fill plein (teintable nuit/ambiance/estompe), un `<pattern userSpaceOnUse>` par-dessus ne dessine QUE les joints/traits sur fond transparent. En affine toutes les faces de même orientation partagent le même vecteur d'arête écran → **un pattern par (matériau × orientation × plan)**, partagé par toute la carte. Le détail seedé = couche d'« accents » fusionnée en **1 `<path>` multi-sous-chemins par face et par couleur**. Anti-périodicité : 3-4 patterns pré-seedés par matériau, choisis par hash(x,y).

**Rendu perspective (POV) — LOD minimaliste assumé** : couleur de base + `bands` (mécanique existante merlons/herse) + `courses` en trapèzes UNIQUEMENT ≤ 3 cases, joints seuls de 3 à 6, rien au-delà (brouillard dès 6). `speckle/timber` hors POV v1. Le contrat = « les deux backends interprètent le même SCHÉMA de données, chacun à sa résolution », pas la parité pixel.

**Perf (budget ~4-6k nœuds DOM)** : expansion du détail APRÈS le culling écran (jamais dans le memo pleine-carte) ; ≤ 2,5 nœuds/tuile sol, ≤ 8-10/mur, 1/cellule de toit + patterns partagés ; LOD par zoom (<0,7 patterns seuls, <0,5 fills plats) ; **fix du `objs.sort` à 60 Hz** (couches statiques pré-triées, insertion binaire des seuls éléments dynamiques) ; **l'éditeur reçoit memo + culling** (aujourd'hui il rend TOUT — maillon faible).

**Tri & états — deux natures, pas d'abstraction forcée** :
- Profondeur : **chaque backend calcule la sienne** (`sortClass → offset` + `depth`/`footprintDepth` en affine — les invariants BASE_SCALE ≫ Z_STEP ≫ offsets sont des acquis à ne pas « unifier » ; peintre par centroïde en POV).
- (a) *Vérité de scène* (porte ouverte, structure abattue, toit occupé, visible/fog) → camera-free → dans `states`, calculée par les builders, consommée par les DEUX backends. (b) *Vérité de vue* (estompe `makeOccludes`, reveal `coversActorBelow`, fantôme de surplomb, `lower-floor-dim`) → screen-space → le backend/stage affine DÉCORE au dessin (opacité/filtre). `makeOccludes` ne fuit jamais dans le pivot ; le POV n'a pas d'estompe (clipNear fait ce travail).

**Pièges IsoStage recensés (à respecter pendant la migration)** : picking par `data-cid` + `elementFromPoint` → tokens et hit-areas RESTENT des éléments React individuels (jamais fusionnés en innerHTML) ; overlays portes/structures/télégraphes = INTERACTION → restent dans le stage, hors builders ; identité référentielle de la sortie des builders = contrat de perf (memo par couche) ; trio ghost/solidOverhang/reveal porté À L'IDENTIQUE avant d'y toucher ; pas de batching innerHTML là où l'état par-tuile anime une opacité (reveal 0.2s).

## Lots d'implémentation

Chaque lot : agents codent (worktree si parallélisme), orchestrateur vérifie TOUT (suite verte + typecheck + planches QC + recette navigateur), commit. Le jeu reste jouable à chaque commit. Un flag dev de comparaison (`__wfrp.render2`) peut vivre PENDANT un lot mais le lot se termine TOUJOURS par la bascule + suppression de l'ancien chemin (zéro coexistence durable).

0. **Instruments + données (risque nul)** :
   - Commit du présent design en `docs/superpowers/specs/2026-07-02-refonte-rendu-design.md` (trace du spec validé).
   - Galerie d'ENVIRONNEMENT headless (resvg, comme `scripts/qc/render-*.mts`) : scènes de réf (siège, Bourg, opéra, intérieur) × {iso 4 rot, edge-on 4 rot, top, POV 2 caps} → planches contact PNG `public/qc/env-*.png`. C'est l'instrument de non-régression et de validation à l'œil de TOUT le chantier.
   - Schéma `DetailRecipe` posé dans les defs (aucun consommateur), `hash32`, tests d'expansion.
   - Quick wins de défauts : **chargement en vue coin (losange)** (`camEdge` défaut false), POV spawn orienté vers le contenu.
1. **Pivot + buildFloors** : types `SceneEl`/`Face`, `buildFloors` (sols + relief + surplombs + wedges — `ground.ts` est déjà quasi-pivot) ; backend affine reproduisant `groundTile` à l'identique (sans détail). Brancher l'**ÉDITEUR d'abord** (pas de fog/anim/picking token, + memo/culling qui lui manquent), puis IsoStage ; suppression des chemins locaux à la bascule. Planches identiques = non-régression.
2. **buildWalls** : remplace l'assemblage de `walls.ts` ET des murs de `pov/geometry.ts` (premier vrai gain deux-backends). Herse/merlons/parapet portés en recettes `bands`. Arêtes 4 implémentations → `tileEdge`/`segEnds` partagés.
3. **buildRoofs + relief POV** : `roofFromCells` → **pans continus** (fix cause racine mosaïque/zigzag), toits éditeur = même builder en mode plan ; `buildFloors` consommé par le POV (remplace sols+risers du heightfield). Occlusion 2→1 (fusion `coversActorBelow` dans le modèle states/décoration).
4. **Matériaux v2 (détail affine) + PILOTE SIÈGE (pierre)** *(arbitrage utilisateur)* : patterns structure + accents seedés + LOD zoom + def `ambiance` JSON (ciel/brume/vignette/g_warm partagés iso↔POV) + palette pierre unifiée (suppression `STRUCT_FALLBACK`/`resolveCss`/var CSS split-brain). **Validation utilisateur à l'œil** sur planche avant/après (remparts/porte/rampe/multi-niveaux + edge-on lisible). Puis généralisation aux matériaux restants + **pilote n°2 = Bourg** (bois/colombages/toits/terrain), 2e validation.
5. **POV au niveau (LOD minimaliste)** : toits POV, props/tokens en billboards du SVG iso (cap paramétré), courses ≤ 3 cases/joints 3-6, ambiance partagée.
6. **buildTokens/Props/Highlights + amincissement final d'IsoStage** : le pointeur en DERNIER (`useStagePointer`/`useStageCamera` — il dépend des locaux cam/zoom/dims) ; fix `objs.sort` 60 Hz (couches pré-triées + insertion binaire des dynamiques). IsoStage ≈ 150-300 l.
7. **Décor** : 321 hex des 97 defs → matériaux partagés ; `TERRAIN_OVERLAYS`/`wallBlock`/`tree`/villager de `sprites.ts` absorbés dans les catalogues ou supprimés ; edge-on : échelle billboards + ombrage de rangées de profondeur.
8. **Nettoyage final** : garde-fou anti-hex étendu à TOUS les renderers d'environnement + decor defs ; suppression du mort résiduel ; goldens réécrits de zéro là où ils testaient le monolithe ; doc rendu (`docs/`) ; MAJ mémoire projet.

## Vérification

- **Planches contact QC headless** par scène de réf × projections × rotations (le nouvel instrument du Lot 0) — comparaison avant/après à chaque lot, lecture d'image par agents + par moi.
- **Suite Vitest verte + typecheck** à chaque lot ; goldens de builders (snapshots SVG) réécrits de zéro là où les anciens testaient le monolithe.
- **Recette Playwright** (localhost:5173, `__wfrp`, 0 erreur console) sur siège + Bourg + opéra en fin de lot.
- **Validation utilisateur à l'œil** sur les 2 pilotes artistiques avant généralisation.

## Hors périmètre / notes

- `src/gameIso/rig/` (créatures/armes/tenues) : mature, non touché (points d'entrée `pickBackend` conservés).
- Changements non commités pré-existants `src/engine/flowCore.ts`/`relations.ts` : hors périmètre, à laisser tels quels.
- Combat/logique (combatFlow, vision/fog logique, MapSpec) : non touchés hors consommation par les builders.
