# Design — Éditeur : tilesets, bâtiments et décors data-driven

*Date : 2026-06-04 · Branche : `feat/wfrp4-rpg-foundation`*

## 1. Problème

L'éditeur de carte actuel est trop pauvre pour rendre justice à l'univers Warhammer :

- Le vocabulaire de tuiles se limite à un enum `Terrain` de 8 valeurs, chacune rendue
  comme un losange plat. Aucune transition entre terrains.
- La seule primitive « bâtiment » est `mur` : un cube par tuile (`wallBlock`). Une
  « maison » se fait en empilant des murs — ça ne ressemble pas à un bâtiment.
- Aucune gestion d'occlusion : on ne peut pas **admirer** un bâtiment opaque sans
  perdre le groupe derrière lui.
- Tout le contenu visuel est **codé en dur** via des unions `export type` + des `switch`
  dans le renderer : ajouter un bâtiment/décor oblige à toucher 3 endroits et à
  recompiler le moteur. C'est l'inverse de la philosophie tileset de Neverwinter Nights.

## 2. Objectif

Atteindre le niveau de rendu de `public/ambush.html` (SVG peint à la main, animé,
ambiance) **dans le jeu et l'éditeur**, avec en plus :

1. Un **sol enrichi** avec raccord d'arêtes automatique (les *crossers* NWN).
2. Des **bâtiments multi-tuiles** procéduraux, opaques et admirables, avec deux modes
   de révélation au choix **par bâtiment** :
   - **cutaway** (toit qui se lève) : intérieur révélé dans la même scène quand le
     groupe y entre — pour les petits bâtiments jouables ;
   - **door** : façade pleine + porte qui déclenche une transition vers une scène
     d'intérieur dédiée — pour les monuments (cathédrale, palais).
3. Des **décors / placeables** posés librement (puits, charrette, fontaine, statue…),
   façon placeables NWN.
4. Une architecture **data-driven** : ajouter du contenu = ajouter **une entrée de
   catalogue**, sans toucher au moteur ni à l'éditeur.

## 3. Décisions validées

| Décision | Choix |
|---|---|
| Paradigme | Tilesets façon NWN (terrain peint + raccord d'arêtes + groupes bâtiments + placeables) |
| Occlusion | **Combiné** : cutaway (petits, in-scene) + porte→intérieur (monuments), choix par bâtiment |
| Source de l'art | **SVG procédural paramétré** (un générateur produit N variantes) |
| Extensibilité | **Catalogues (registres) data-driven**, pas d'unions `export type` figées |

## 4. Principe d'architecture : catalogues scindés

Le précédent existant : **les monstres sont déjà data-driven**, par deux registres
joints par `label` —

- stats : `src/data/creatures.json` → `creatures: CreatureData[]` (généré par
  `scripts/build-data.ts` depuis le canon) ;
- sprite : `src/gameIso/creatureSprites.json` → `Record<label, svg>`, lookup
  `enemySprite(label)` avec **fallback** `mutantStand()` si l'id est inconnu.

On généralise ce patron, en respectant la **règle d'architecture du projet** (le moteur
et l'état restent purs et ne dépendent jamais du rendu ; dépendances :
`gameIso → state → engine`, jamais l'inverse). Chaque famille (sol, bâtiment, décor)
est donc **scindée en deux registres joints par id** :

- **Sémantique (pur, `src/state/`)** : ce qui touche aux règles — walkability,
  précédence de raccord, empreinte bloquante, sémantique de porte/reveal.
- **Présentation (`src/gameIso/catalog/`)** : `render()` SVG, gradients, swatch,
  `paramsSchema`, animations.

Conséquences :

- `Scene` stocke des **`string` d'id**, jamais des membres d'union. Un id inconnu
  **dégrade proprement** vers un sprite/sol de secours → forward-compatible.
- Le renderer est **générique** : `CATALOG[id]?.render(...) ?? fallback`. Plus de `switch`.
- L'éditeur **lit les catalogues** : palette, inspecteur et champs de params se
  **génèrent** depuis les registres et les `paramsSchema`. Ajouter une entrée la fait
  apparaître automatiquement dans l'éditeur, sans toucher au code de l'éditeur.
- Le type d'autocomplétion est **dérivé** du catalogue (`type BuildingId =
  keyof typeof BUILDINGS`) — source de vérité unique, aucune union à maintenir à part.

## 5. Contrat de données

### 5.1 Sols (terrain)

L'enum `Terrain` devient un alias `string`. Vocabulaire enrichi (ids) :

- sols existants : `herbe`, `sol`, `route`, `eau`, `plancher`, `bois` (décor d'arbre) ;
- nouveaux sols : `pave` (pavés de ville), `terre` (terre battue / boue),
  `dalle` (dallage de pierre) ;
- primitives bâtiment autonomes conservées (compat + murets/clôtures) : `mur`, `porte`.

Registre **pur** (`src/state/terrain.ts`) :

```ts
export interface TerrainMeta {
  id: string;
  label: string;
  walkable: boolean;
  priority: number; // précédence de raccord (qui déborde sur qui)
}
export const TERRAINS: Record<string, TerrainMeta> = { /* … */ };
```

Registre **visuel** (`src/gameIso/catalog/terrain.ts`), joint par id :

```ts
export interface TerrainViz {
  id: string;
  gradient: string;  // id du <linearGradient> dans DEFS
  swatch: string;    // couleur d'aperçu pour la palette
  texture?: (x: number, y: number) => string; // détail procédural STABLE (seedé par x,y)
}
export const TERRAIN_VIZ: Record<string, TerrainViz> = { /* … */ };
```

### 5.2 Bâtiments (features multi-tuiles)

```ts
export interface BuildingParams {
  floors?: number;                              // 1–3
  roofMaterial?: 'tuile' | 'chaume' | 'ardoise';
  timberColor?: string;                         // couleur du colombage
  wallColor?: string;                           // couleur du torchis
  variant?: number;                             // graine de variation procédurale STABLE
}

export interface BuildingFeature {
  id: string;
  type: string;                                 // id de catalogue (BUILDINGS_META)
  foot: { x: number; y: number; w: number; h: number }; // empreinte sur la grille
  facing?: Facing;                              // orientation façade/porte
  reveal: 'cutaway' | 'door';
  door?: { x: number; y: number };              // tuile-porte (sur le bord de l'empreinte)
  interiorScene?: string;                       // si reveal:'door' → scène d'intérieur
  entry?: string;                               // entryPoint d'arrivée
  params?: BuildingParams;
  label?: string;
}

export interface Scene {
  // … champs existants …
  buildings?: BuildingFeature[];                // optionnel → [] par défaut (compat)
}
```

Registre **pur** (`src/state/buildings.ts`) :

```ts
export interface BuildingMeta {
  id: string;
  label: string;
  category: 'petit' | 'monument';
  defaultFoot: { w: number; h: number };
  defaultReveal: 'cutaway' | 'door';
  blocksFootprint?: boolean; // périmètre plein (sauf porte) → non walkable
}
export const BUILDINGS_META: Record<string, BuildingMeta> = { /* … */ };
```

Helpers **purs** (dans `scene.ts` ou `buildings.ts`), consultés par `isWalkable` :

- `buildingBlockedAt(scene, x, y): boolean` — la tuile est-elle un mur de bâtiment
  (périmètre plein, sauf la tuile-porte) ? Intérieur d'un bâtiment `cutaway` =
  walkable ; intérieur d'un `door` = bloqué (accès uniquement par transition).
- `buildingAt(scene, x, y): BuildingFeature | undefined` — quel bâtiment couvre cette
  tuile (pour le cutaway et l'interaction porte).

Registre **visuel** (`src/gameIso/catalog/buildings.ts`) :

```ts
export interface RenderCtx { dims: Dims; }
export interface BuildingLayers { walls: string; interior: string; roof: string; }
export interface BuildingViz {
  id: string;
  paramsSchema?: ParamField[];                  // pilote l'inspecteur
  render(foot: Rect, params: BuildingParams, ctx: RenderCtx): BuildingLayers;
}
export const BUILDINGS: Record<string, BuildingViz> = { /* … */ };
export type BuildingId = keyof typeof BUILDINGS; // type dérivé
```

Générateurs procéduraux initiaux : `colombage` (maison à colombages paramétrique),
`taverne`, `forge`, `echoppe` (petits, `cutaway` par défaut) ; `chapelle`, `tour`,
`manoir` (monuments, `door` par défaut). Le `render()` renvoie **trois calques**
distincts pour que le cutaway puisse masquer le **toit** seul.

### 5.3 Décors (placeables)

On réutilise `SceneEntity.kind === 'prop'` et son champ `ref?: string` existant, qui
référence désormais le catalogue de décors :

```ts
// src/gameIso/catalog/decor.ts
export interface PropViz {
  id: string;
  label: string;
  paramsSchema?: ParamField[];
  render(params: Record<string, unknown>, ctx: RenderCtx): string; // SVG
}
export const PROPS: Record<string, PropViz> = { /* … */ };
```

Catalogue initial : `tonneau`, `caisse`, `charrette`, `puits`, `fontaine`,
`etal-marche`, `statue`, `lampadaire`, `panneau`, `cloture`, `tas-foin`,
`feu-camp`, `arbre`. `propSprite(ref)` devient un lookup catalogue + fallback
(remplace le `barrel()` codé en dur).

### 5.4 Schéma de champ de paramètres (générique)

```ts
export type ParamField =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'color' };
```

L'inspecteur de l'éditeur génère les contrôles depuis ce schéma (composant partagé
`ParamFields.tsx`, dans l'esprit de l'`EffectList` existant).

## 6. Phases d'implémentation

Chaque phase est livrable et testable indépendamment.

### Phase 1 — Sols enrichis + raccord d'arêtes (crossers)

**Fichiers**
- 🆕 `src/state/terrain.ts` *(pur)* — registre `TERRAINS` (walkability + précédence).
- ✏️ `src/state/scene.ts` — `Terrain = string` ; `isWalkable`/`tileAt` consultent
  `TERRAINS` (fallback bloquant si id inconnu).
- 🆕 `src/gameIso/catalog/terrain.ts` *(visuel)* — `TERRAIN_VIZ`.
- ✏️ `src/gameIso/sprites.ts` — `DEFS` reçoit les gradients `pave/terre/dalle` ;
  `TILE_GRAD` → lookup catalogue.
- 🆕 `src/gameIso/ground.ts` — `groundTile(scene, x, y, dims)` : losange de base +
  **wedges de transition** vers chaque voisin de plus haute précédence (quad le long
  de l'arête partagée, opacité dégradée, clippé au losange ; les coins se recouvrent
  naturellement). Approximation SVG des crossers NWN, sans atlas de tuiles.
- ✏️ `IsoStage.tsx` + `Editor.tsx` — la couche sol passe par `groundTile()`.

**Algorithme de raccord** : pour une tuile T, pour chacun de ses 4 voisins de grille
N (= les 4 arêtes du losange), si `priority[N] > priority[T]`, dessiner un wedge le
long de l'arête partagée rempli du gradient de N, avec une opacité qui décroît vers
l'intérieur (~40 % de la demi-tuile). `eau` est un cas spécial (pas de débordement
herbe→eau ; berge dédiée).

**Recette** : peindre `pave` à côté de `herbe` → fondu auto à l'arête ; les nouveaux
sols apparaissent **tout seuls** dans la palette (lus du catalogue) ; walkability
correcte ; scènes `tome1-*` inchangées ; `npm run typecheck` + `npm test` verts ;
screenshot Playwright (0 erreur console).

### Phase 2 — Catalogues bâtiments + décors + cutaway

**Fichiers**
- ✏️ `src/state/scene.ts` — `BuildingFeature` + `Scene.buildings?` ; helpers purs
  `buildingBlockedAt` / `buildingAt` intégrés à `isWalkable` ; `emptyScene` ajoute
  `buildings: []`.
- 🆕 `src/state/buildings.ts` *(pur)* — `BUILDINGS_META` + logique empreinte→tuiles
  bloquées + sémantique porte.
- 🆕 `src/gameIso/catalog/buildings.ts` *(visuel)* — `BUILDINGS` + générateurs
  procéduraux (`colombage`, `taverne`, `forge`, `echoppe`, `chapelle`, `tour`,
  `manoir`), `render()` à 3 calques (`walls`, `interior`, `roof`).
- 🆕 `src/gameIso/catalog/decor.ts` *(visuel)* — `PROPS` ; `propSprite(ref)` → lookup
  + fallback.
- 🆕 `src/gameIso/anim.css` — portage des keyframes d'`ambush.html`
  (`breathe`/`flicker`/`glow` + fumée de cheminée/enseigne).
- ✏️ `IsoStage.tsx` — rendu bâtiments : `walls+interior` triés à l'empreinte,
  **`roof` en calque togglable**. Cutaway : `roof opacity→0` quand un allié est **dans**
  l'empreinte ou **visuellement derrière** (empreinte projetée vers la caméra de la
  hauteur du toit). Porte : marcher sur la tuile-porte d'un bâtiment `reveal:'door'`
  → effet `transition`.
- ✏️ `src/state/store.ts` — déclenche la transition à l'entrée sur une tuile-porte.

**Tri de profondeur** : un bâtiment occupe plusieurs tuiles ; sa profondeur de tri =
coin avant de l'empreinte (`max(x+y)`) pour que les entités devant se dessinent
par-dessus et celles derrière en dessous. Le toit est dessiné juste après les murs du
même bâtiment, puis togglé par le cutaway.

**Recette** : poser un bâtiment (JSON de test) → opaque avec toit ; y entrer (cutaway)
→ toit se fond, intérieur visible ; gros bâtiment `door` → la porte déclenche la
transition ; décors rendus depuis le catalogue ; walkability bloque les murs, autorise
la porte ; tests moteur `buildingBlockedAt`/`buildingAt` (purs, Vitest) ; Playwright.

### Phase 3 — Éditeur générique piloté par catalogue

**Fichiers**
- ✏️ `src/ui/editor/Editor.tsx` — onglet **Carte** : swatches terrain **auto** depuis
  le catalogue ; nouvelle section **Bâtiments** (groupée par `category`) ; liste
  **Décors** pour placer les `prop`. `Tool` gagne `{ mode: 'building'; type: string }`.
- Pose d'un bâtiment : **réutilise le drag-rect** des triggers → définit l'empreinte →
  crée la `BuildingFeature` avec `defaultReveal`/params par défaut.
- 🆕 `src/ui/editor/ParamFields.tsx` — éditeur de params **générique** depuis
  `paramsSchema` (slider/select/couleur), partagé.
- ✏️ Inspecteur : bâtiment → type, empreinte, `facing`, bascule `cutaway/door`,
  sélecteur tuile-porte, `interiorScene` (liste des scènes de campagne), libellé ;
  prop → `ref` + params.
- WYSIWYG : l'éditeur rend bâtiments + décors **avec les mêmes `render()`** que le jeu.

**Recette** : ajouter un type au catalogue → apparaît dans l'éditeur **sans toucher au
code de l'éditeur** ; drag pour poser ; régler les params en live ; `reveal=door` +
`interiorScene` ; tester en jeu via le bouton « ▶ Tester » ; typecheck/tests/Playwright.

## 7. Transverse — données & rétro-compatibilité

- `Terrain` devient `string` : les scènes `tome1-intro` / `tome1-route` restent valides
  (leurs ids existent dans `TERRAINS`).
- `Scene.buildings` est **optionnel** → `[]` par défaut ; les scènes existantes sont
  inchangées.
- Aucun changement de `npm run build:data` (le contenu visuel est du code, pas de la
  donnée générée).
- `scripts/gen-gallery.mjs` peut être étendu pour QC le catalogue bâtiments/décors
  (bonus, hors chemin critique).

## 8. Tests

- **Moteur/état (purs, Vitest)** : `isWalkable` avec terrains du registre ;
  `buildingBlockedAt` / `buildingAt` (empreinte, porte, cutaway vs door) ;
  résolution de catalogue avec fallback sur id inconnu.
- **Rendu/UX (Playwright MCP, cf. CLAUDE.md)** : charger `localhost:5173`, dérouler le
  flux, vérifier `console` (0 erreur), screenshoter ; raccord d'arêtes, cutaway,
  transition par porte, palette générée depuis le catalogue.

## 9. Hors scope (YAGNI)

- Élévation / raise-lower terrain (le sol reste à un seul niveau z).
- Rotation de caméra.
- Extraction d'art depuis les PDF pour les bâtiments (on reste procédural).
- Migration des sprites de créatures vers le nouveau style de catalogue (la porte
  reste ouverte, mais ce n'est pas dans ce chantier).
