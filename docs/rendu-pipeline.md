# Pipeline de rendu — « une scène, une apparence, N projections »

Le rendu du monde part d'UN document de scène (`state/scene.ts`) et d'UNE couche d'apparence en
donnée, et se projette dans plusieurs vues (iso losange, vue de face, vue du dessus, première
personne) sans dupliquer la logique. Deux étages nets :

```
Scene ──(builders, PURS, espace MONDE)──▶ SceneEl[] ──(backends)──▶ SVG
                                                     ├─ affine  : iso / edge-on / top   (Dims)
                                                     └─ perspective : POV première personne (Camera)
apparence = DONNÉE (src/data/*.json + defs de terrain) ; LUMIÈRE = shade.ts ; jamais un hex dans un renderer.
```

Contrat de perf : un **builder n'importe ni `Dims` ni caméra**. Sa sortie (mémoïsée par `IsoStage`)
survit à toute rotation/projection ; le POV n'hérite d'aucun concept d'écran.

## 1. Le pivot — `builders/types.ts`

Les builders dérivent la scène en **éléments sémantiques en espace monde**. Points en unités de
**grille** continues (coins de case à ±0.5), hauteur `h` en **mètres** (`GP = {x, y, h}`).

- `SceneEl = FloorEl | WallEl | RoofEl | PropEl | TokenEl` — union discriminée par `kind`.
- `Face { poly: GP[]; material: MaterialRef; side? }` — ni base UV ni « plane » stockés : chaque
  backend dérive l'orientation (sol/paroi/pente) de `material.domain`+`part` (et `side`).
- `MaterialRef { domain: 'terrain'|'relief'|'structure'|'roof'; id; part? }` — **référence** de
  matériau (jamais une couleur). `part` distingue les faces d'un même matériau (falaise/rampe/pilier…).
- `ElBase` : `key` stable (identité monde, clé React/DOM), `cell {x,y,z}` (`z` = index de COUCHE,
  découplé de la hauteur métrique), `span?` (empreinte multi-cases), `states`.
- `ElStates` = vérités de SCÈNE camera-free (`visible`, `overhang`, `ghost`, `solidOverhang`, `open`,
  `down`, `roofOccupied`). La vérité de VUE (estompe d'occlusion, reveal, assombrissement de l'étage
  inférieur) reste une **décoration** du stage/backend (opacité/filtre), pas du pivot.

## 2. Les builders — `builders/*.ts`

| Builder | Sortie | Rôle |
|---|---|---|
| `buildFloors` | `FloorEl[]` | sols + **relief auto-dérivé** (falaises/rampes/tabliers de terrain, wedges) ; faces à matériau `terrain`/`relief` |
| `buildWalls` | `WallEl[]` | murs d'arête (portes, parapets, herses) ; `side`, `ends`, `appearance` (structure), `door` |
| `buildRoofs` | `RoofEl[]` | toits en **pans continus** (une face par pan, `plane 'slope'`) + `lines` sémantiques (faîte/arêtier/égout/rang) |
| `buildProps` | `PropEl[]` | décor **billboard** : props de scène (`source:'entity'`, SVG du catalogue) + overlays de terrain en relief (`source:'terrain'`, mur/bois) |
| `buildTokens` | `TokenEl[]` | sujets de token (`figurant` / `combatant` / `mounted`) — la position INTERPOLÉE de marche reste au stage |
| `buildHighlights` | `HighlightEl[]` | cases sémantiques de combat (déplacement/visée/ZdE) — couleurs posées au backend |

## 3. Les backends

### Affine — `backends/*` (iso losange · edge-on · top)
Piloté par `Dims` (`view`/`rot`/`edge`). Pont monde→écran UNIQUE : `project.ts::projGP(gp, dims)` =
`tileCenter(x, y, dims, metricToLift(h))` — **la rotation caméra et l'élévation-écran vivent ici**,
jamais dans un builder. Un backend par classe d'élément : `affineFloors`, `affineWalls`,
`affineRoofs`, `affineProps`, chacun résolvant ses couleurs par `part` depuis la def d'apparence +
`shade.ts`. Chaque backend expose aussi sa profondeur de tri (`floorDepth`, `roofDepth`, `propDepth`…
— ordre du peintre) ; `stage/objs.ts` fusionne et trie.
**Périmètre depuis #1176 P3-4 (commit C5a)** : l'écran de JEU ne passe plus par ces backends — son
monde est volumique (`stage/GameStage3D`). Ils servent le PLAN de station (murs au trait,
`stage/layers`), l'APERÇU d'authoring (`ui/editor/EditorCanvas`, `stage/tokens`) et les planches QC ;
leur requalification est le lot C5b (cliquets `stage/double-voie-ratchet.test.ts` et
`ui/editor/double-voie-editeur-ratchet.test.ts`).

### Perspective — `pov/*` (première personne)
`camera.ts` (caméra + brume/fog calculés, `rgb(...)` à canaux **calculés**), `geometry.ts` (liste de
dessin : sols/murs/toits viennent des **mêmes builders** ; seuls les plafonds sont dérivés ici),
`billboardCore.ts` + `billboards.tsx` (props en billboards du même SVG iso), `PovStage.tsx`. Surfaces
prises en monde, clippées au plan proche, projetées, teintées (lumière + brouillard), triées loin→proche.

## 4. Détail de surface (matériaux v2) — `detail/*`

`DetailRecipe` (donnée PURE portée par les defs d'apparence via `detail`) : `courses` (assises/bardeaux
+ blocs appareillés), `bands` (plinthe/arase), `timber` (colombage), mouchetis… Dimensions en **mètres**.

`detail/expand.ts::expandRecipe` déplie la recette en **primitives UV** en espace de face `[0,1]²`
(u gauche→droite, v haut→bas ; épaisseurs restant en mètres). **Déterminisme total au seed** : chaque
section tire son sous-flux de `seedStream(hash32(identité-monde, section))` — jamais stocké, donc iso
et POV retombent sur le MÊME détail.

Chaque backend rasterise à sa résolution : `affineDetail` pose un `<pattern userSpaceOnUse>` par
(recette × orientation d'arête × plan) qui ne dessine que les joints (fond transparent, `patternTransform`
constant → pattern partagé par toute la carte), puis des **accents seedés** (blocs nuancés, mouchetis,
touffes) fusionnés en un `<path>` par face et par couleur ; le POV (`geometry.ts`) fait des trapèzes
perspectives fondus par la distance. **LOD par zoom** (`lodOf`) : `<0.5` fills plats · `<0.7` motifs
seuls · `≥0.7` motifs + accents.

## 5. Ambiance — `catalog/ambiance.ts` (← `src/data/ambiance.json`)

Ciel d'extérieur, brumes (intérieure sombre / extérieure claire), vignette, voile chaud, filtre de
l'étage inférieur, voile de nuit. Les stages (`IsoStage`/`PovStage`) et la QC headless consomment les
MÊMES defs SVG assemblées ici. `DEFS` (`sprites.ts`) = dégradés de terrain (dérivés des `TerrainDef.stops`)
+ `rigFxGradients` (`rig/fxGradients.ts`, domaine rig/FX), montés une fois au niveau App (`GlobalSvgDefs`).

## 6. Garde-fou anti-couleur — `renderer-no-hardcoded-color.test.ts`

Aucun renderer d'environnement ne porte de **littéral** de couleur : toute couleur vient de la DONNÉE
(`src/data/*.json`, defs de terrain) ou de `shade.ts` (la LUMIÈRE : `shade`/`mix` + voiles `ao`/`spec`/
`warm`). Couverture = **balayage récursif** de `builders/ backends/ detail/ pov/ catalog/ stage/` + les
renderers racine (`IsoStage.tsx`, `sprites.ts`) + un bloc dédié aux 97 defs de props (`catalog/decor/defs/`,
qui consomment la palette `P.<ton>` de `decorPalette.json`). Hors périmètre (couleur légitime) : le rig
(`rig/**`), les FX de combat (`fx/**`), les tokens (`BodyToken` = chrome d'état),
`shade.ts`, et les defs de terrain (`state/terrain/defs/**` = donnée d'identité matériau, comme un JSON).

## 7. QC visuel — `npm run qc:env` (`scripts/qc/render-env.mts`)

Instrument de **non-régression visuelle** headless (resvg). Rend 4 scènes de référence (siège, Bourg,
opéra, caveau) via les panneaux partagés (`env-panels.ts`, mêmes primitives pures que le jeu, plein
détail matériaux v2) dans TOUTES les projections : iso rot 0-3, edge rot 0-3, top, + 2 POV. Sortie :
`public/qc/env-<sceneId>.png` (1 planche, 11 panneaux). Workflow : copier les PNG **avant** un changement
d'apparence, relancer, comparer (md5 / lecture visuelle) — une migration donnée-neutre doit rester
byte-identique.

## 8. Où ajouter…

- **un matériau** (structure/relief/toit) : entrée dans `src/data/{structureAppearance,reliefMaterials,
  roofMaterials}.json` (`id` + couleurs par `part` + `detail` optionnelle) ; les `Wall/Roof/FloorEl` le
  référencent par id, les backends résolvent les couleurs par `part`.
- **un ton de couleur du décor** : entrée dans `src/data/decorPalette.json` → dispo en `P.<ton>`.
- **un terrain** : `src/state/terrain/defs/<id>.ts` (`TerrainDef` : `gradient`/`swatch`/`stops`) puis
  `npm run gen`. Décor de terrain : `overlayProp` (billboard de prop, ex. `bois → 'arbre'`, rendu par les
  2 backends via `buildProps`) ou `solidHeightM` (bloc plein, ex. `mur`, dérivé du relief par `buildFloors`).
- **un prop / décor** : `src/gameIso/catalog/decor/defs/<id>.ts` (SVG boîte 120×150, couleurs via
  `P.<ton>`) puis `npm run gen`. **Symétrique** → un seul dessin `PropViz.render`. **Directionnel**
  (siège, canapé…) → déclare ses vues `PropViz.views` (`= ViewArt<[params, ctx]>`, `front`/`profile`/`back`) ;
  la sélection vue + miroir + repli se fait dans la MACHINERIE (`propSvg`, `catalog/decor/index.ts`) via
  `project(dir, camRot)` puis `pickView`, jamais dans la def (garde `defs-directional-guard.test.ts`).

### Objets ORIENTÉS — un seul contrat de vues (`rig/viewArt.ts`)

Tout art orienté procédural rendu par le système de plans (coque de NAVIRE `rig/ship/composeShip.ts`,
ENGIN de siège `rig/engin/artkit.ts`, véhicule TERRESTRE `rig/land/composeLand.ts`) ET les props
directionnels partagent l'UNIQUE contrat `ViewArt` (`front?`/`profile?`/`back?`, une vue peut manquer).
La sélection vue+miroir vient du SEUL résolveur `project(dir, camRot)` (`rig/facing.ts`) ; le repli d'une
vue absente sur la plus proche déclarée est `pickView`/`foldView` ; la COUVERTURE réelle (`declaredViews`)
pilote la galerie QC `oriented-objects.html`. Le PROFIL est dessiné vers la DROITE, le gauche = miroir de
la machinerie. Le routage d'un véhicule à coque se fait par **`hull.propulsion`** dans `rig/bodyPlan.ts`
(`resolveRender`) : `maritime`/`fluvial` → gabarit `navire` avec l'**ID de véhicule** comme espèce ;
`terrestre` → gabarit `terrestre` — un attelage ne peut PLUS retomber par accident sur la coque de navire.
Chaque type de navire a son ART DE COQUE dédié (`rig/ship/defs/<id>.ts`, registre `SHIP_ARTS` auto-chargé,
boîte à outils `rig/ship/artkit.ts` : voiles carrées/latines/jonque, avirons, châteaux, pavois — proue à
DROITE, quille à y=0) ; un id sans def retombe sur la silhouette procédurale par gréement (`hull.rig`)
de `composeShip` — couverture déclarée, visible dans la galerie.

Les **BÊTES** (plans non équipables) sont HORS de ce contrat : elles ne se replient pas de vue en
vue, elles se dessinent ENTIÈRES par vue — une illustration continue en coordonnées monde
(`src/gameIso/rig/quadruped/atelier/<espèce>-<vue>.dessin.mts`), compilée par os dans le repère
local de chacun par `scripts/rig/compile-dessin-quad.mts` (`--check` en porte de commit), servie au
rendu par le canal `QuadProps.viewArt` (aucun `foldView` : une vue non déclarée se compose au
socle). Arbitrage utilisateur du 2026-08-06 (verbatim consigné au ticket #1082). L'assemblage par pièces reste aux bipèdes
équipables et aux éléments attachés (`deco`). Direction d'art : épuré, jugé à 40 / 64 / 128 px.
- **un TYPE d'élément** (au-delà de floor/wall/roof/prop/token) : ajouter le variant à `SceneEl`
  (`builders/types.ts`, discriminé par `kind`) + un builder + le rendu dans CHAQUE backend (affine ET
  POV) + sa profondeur de tri propre (chaque backend calcule la sienne, cf. `floorDepth`/`wallDepth`/…).
