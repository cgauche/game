# Vue du dessus (mode bascule) — design

*Date : 2026-06-10 · Statut : validé (design), prêt pour le plan d'implémentation.*

## Objectif

Ajouter une **vue du dessus** (orthogonale, grille **carrée `[]`**) en **mode bascule** à côté de
la vue isométrique actuelle. Les sprites n'ont pas de vue du dessus réelle, donc :

- **Décor / props / terrain** → on garde la **vue de face** (les billboards actuels), simplement
  posés sur une case carrée. Aucun nouveau rendu.
- **Personnages** (héros, ennemis, PNJ, créatures) → **pion-portrait** : un disque avec leur
  visage vu de face (façon jeton VTT) + anneau d'équipe.

La bascule doit être disponible **dans le jeu ET dans l'éditeur**, via un **bouton** à côté de
ceux de zoom / rotation caméra. **Zoom et rotation caméra continuent de fonctionner** en vue du
dessus.

## Principe directeur

La projection est **entièrement isolée dans `src/gameIso/iso.ts`** — `tileCenter`, `diamondPath`,
`screenToTile`, `stageSize`, `depth`. Le jeu (`IsoStage`) et l'éditeur (`Editor`) passent tous
deux par ces fonctions. C'est **la couture unique**.

`rot` (rotation caméra par crans de 90°) est **déjà** un axe de `Dims` ; le zoom est appliqué
**au-dessus** de la projection (transform `<g>` côté jeu, `viewBox` côté éditeur). Tous deux sont
donc **indépendants de la projection** et marcheront sans modification.

On ajoute donc un **second axe à `Dims` : `view: 'iso' | 'top'`**, exactement comme `rot`. Tout le
reste (caméra, FX, marche, surbrillances, picking, éditeur) en hérite **sans duplication**.

## Composants

### 1. Géométrie — `iso.ts`

```ts
export interface Dims {
  w: number;
  h: number;
  rot?: Rot;                 // existant
  view?: 'iso' | 'top';      // NOUVEAU ; absent ⇒ 'iso'
}
```

`view: 'top'` (grille carrée, côté `CELL` ≈ 56 px) :

- **`tileCenter(x, y, dims)`** : `r = rotTile(x, y, dims)` (rotation honorée comme en iso), puis
  `cx = originX_top + r.x · CELL`, `cy = originY_top + r.y · CELL`. La case est **centrée** sur ce
  point (les pieds d'un billboard tombent au centre de la case, comme en iso).
- **`diamondPath(x, y, dims)`** : retourne un **carré** centré sur `tileCenter`
  (`cx±CELL/2`, `cy±CELL/2`) au lieu du losange. Le nom est conservé (15+ appelants) — il désigne
  « le contour de la tuile ».
- **`screenToTile(px, py, dims)`** : inverse carré — `x = round((px − originX_top) / CELL)`,
  `y = round((py − originY_top) / CELL)`, puis `unrotTile`.
- **`stageSize(dims)`** : `w = effDims.w · CELL + marges`, `h = effDims.h · CELL + SPRITE_HEADROOM + marge`.
  `SPRITE_HEADROOM` reste (les billboards montent au-dessus de la case).
- **`depth(x, y, dims)`** : en `top`, tri **par rangée d'abord** (`r.y · K + r.x`) — la rangée
  écran (`r.y`) détermine le recouvrement des billboards. (En iso c'est `r.x + r.y` ; ce tri
  diagonal serait **faux** en vue du dessus, où l'axe écran vertical est `r.y` seul.)

`iso.test.ts` couvrira les **deux** modes. `originX_top` / `originY_top` incluent une marge gauche
et le headroom (valeurs à ajuster en recette navigateur).

### 2. Tokens — divergence **uniquement sur les acteurs**

- **Personnages → pion-portrait** : disque (clip circulaire) contenant la **vue de face cadrée sur
  le visage** + anneau d'équipe (plein héros / pointillé ennemi, R9), **barre de PV** et **icônes
  d'état** au-dessus, **halo doré** si actif. Bipède *et* créature (cadrage tête vs haut-avant,
  comme `RigPortrait` le fait déjà).
- **Décor / props / terrain → inchangés** : déjà des billboards de face ; ils posent juste sur une
  case carrée. C'est ça « le décor en vue de face ».

Mise en œuvre :

- **`pickBackend(subject, view?)`** devient conscient du mode. En `view: 'top'` + sujet **acteur**
  (backend `rig`/`plan`) : renvoie le **corps en vue de face** + `portraitBox` + `flat: true`.
  Décor (backend `sprite`) : inchangé, `flat: false`.
- Le **cadrage visage / vue de face** est **extrait dans un helper pur unique** consommé à la fois
  par `RigPortrait` (vignette HTML du HUD) **et** le disque sur la carte (SVG) → **zéro
  duplication** (mémoire « ne pas dupliquer »). Le disque SVG utilise un `<svg viewBox={portraitBox}>`
  imbriqué, clippé en cercle.
- **`BodyToken`** gagne un mode **`flat`** : enfant **centré** sur la case (pas de décalage
  pieds `−60,−150`), **anneau circulaire** (au lieu de l'ellipse iso), mort = **estompé** (pas de
  bascule 78°). Reste la coquille de positionnement **unique** (mémoire « BodyToken = coquille
  unique ») : PV, icônes, voile, halo actif sont réutilisés tels quels. Décor en `top` reste en
  ancrage pieds (billboard debout).

`EntityToken` (mutualisé jeu↔éditeur) ne change quasiment pas : il lit `dims.view`, appelle
`pickBackend(subject, dims.view)` et passe `flat` à `BodyToken` → l'éditeur hérite de la vue du
dessus **gratuitement**.

### 3. État + bouton — parallèle à zoom/rot, **par surface**

- **Jeu** : le store gagne `viewMode: 'iso' | 'top'` + `toggleViewMode()`. `IsoStage` construit
  `dims = { ...scene.dimensions, rot: shownRot, view: viewMode }`.
- **Éditeur** : `useEditorView` gagne `viewMode` / `setViewMode` (état local, comme `rot`).
  **Nommage : `viewMode`** pour éviter la collision avec le `view` existant (= viewBox caméra de
  l'éditeur). `Editor` construit `dims = { ...scene.dimensions, rot, view: viewMode }`.
- **`ViewControls`** (déjà partagé) reçoit `view` + `onToggleView` et rend un **bouton** (icône
  ⬚/◇, `title="Vue du dessus"`, état actif visible). Câblé par les deux écrans.

La bascule est **par surface** (le jeu a la sienne dans le store, l'éditeur la sienne dans
`useEditorView`) — cohérent avec la façon dont zoom et `rot` sont déjà gérés séparément.

## Ce qui hérite gratis (rien à recoder)

Zoom · rotation caméra Q/E · picking clic→case · FX (flottants / projectiles / halos / zones,
via `tileCenter`) · glissement de marche (le disque glisse de case en case via `walkPosOf` +
`tileCenter`) · tout l'éditeur (placement, drag, triggers, footprints, sélection).

## Décisions tranchées

- **Taille de case** carrée ≈ **56 px** (proche du `TW = 64` actuel) ; ajustée en recette.
- **Bâtiments** (toits multi-tuiles extrudés en 2.5D) : en vue du dessus, rendu de l'**empreinte à
  plat** (périmètre + teinte de toit + porte) — l'extrusion iso n'a pas de sens vu du dessus, la
  fidélité fine est déférée.
- **Animation** : en vue du dessus, le pion **glisse** de case en case ; **pas d'anim de membres**
  (c'est un disque). Mort = disque estompé.

## Risques / vigilance

- **Cœur `iso.ts`** bien testé : le branchement `view` doit préserver le mode `iso` à l'identique.
  Garde-fou : `iso.test.ts` (deux modes) + golden de rendu existants (`biped-golden`, etc.).
- **Refactor `RigPortrait`** : l'extraction du helper de cadrage ne doit pas régresser les
  vignettes du HUD → vérifier la parité (test de rendu du portrait inchangé).
- **`depth` en `top`** : bien utiliser le tri par rangée (`r.y`), pas le diagonal iso, sinon les
  billboards proches passent derrière les lointains.
- **Marges / clipping** : un billboard près du bord gauche/haut ne doit pas être coupé →
  `originX_top` / headroom à régler en recette.

## Tests

- `iso.test.ts` : `tileCenter` / `diamondPath` (carré) / `screenToTile` (aller-retour) /
  `stageSize` / `depth` en `view: 'top'`, avec `rot` 0..3.
- Parité `RigPortrait` après extraction du helper (rendu identique).
- Golden de rendu existants : inchangés en `iso` (non-régression).
- Recette navigateur (Playwright) : bascule en jeu **et** dans l'éditeur ; zoom + rotation
  fonctionnels en `top` ; picking clic→case ; un combat lisible en pions-portraits.

## Hors périmètre

- Vue du dessus comme vue **par défaut** (reste un mode bascule, démarrage en iso).
- Refonte des billboards de décor en vraies icônes « vue du dessus » dédiées (on réutilise la vue
  de face).
- Fidélité fine des bâtiments en vue du dessus (empreinte à plat suffit en v1).
- Persistance du mode choisi entre sessions (sauf si trivial via l'état déjà sérialisé).
