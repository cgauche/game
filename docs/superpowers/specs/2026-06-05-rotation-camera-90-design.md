# Rotation caméra 90° (4 orientations) — design

*Date : 2026-06-05 — branche `feat/wfrp4-rpg-foundation`*

## But

Permettre au joueur de **tourner la caméra autour de la scène par pas de 90°**
(4 orientations cardinales), comme Baldur's Gate / Diablo II. Besoin n°1 :
**tactique — voir derrière les occultants** (un ennemi caché derrière une maison,
un mur, un décor haut doit pouvoir être révélé en tournant).

Rotation **horizontale** (azimut) uniquement. Pas de rotation libre/continue : le
rendu est en paper-doll 2.5D à vues discrètes, incompatible avec un angle arbitraire.

## Pourquoi c'est faisable proprement

État des lieux du rendu (vérifié dans le code) :

- **Projection centralisée** : `tileCenter`, `screenToTile` (picking, occurrence
  unique), `depth` (tri painter) sont tous dans `src/gameIso/iso.ts`. Tout le reste
  les consomme — jeu (`IsoStage.tsx`) **et** éditeur (`ui/editor/Editor.tsx`, qui
  importe `iso.ts` ligne 6 et partage `buildingObj`/`terrainOverlay`/`groundTile`).
- **Le facing des personnages est dérivé de la direction ÉCRAN** (`facing.ts`
  `facingView(dx,dy)`), pas de la grille → il se recalcule tout seul quand la
  projection tourne. **Gratuit.**
- **Seul occultant directionnel = les bâtiments.** `footCorners` (`catalog/buildings.ts:6`)
  dessine murs/porte sur les 2 faces avant (O→S, S→E) identifiées par **identité de
  coin grille**. En tournant, ces faces ne seraient plus face caméra → on verrait
  l'arrière / à travers. **C'est LE correctif d'occlusion.**
- `wallBlock` (mur-cube) et `tree` (billboard) sont symétriques/upright →
  invariants par rotation, aucun changement.

## Approche retenue : rotation dans la couche projection (A)

`rot ∈ {0,1,2,3}` (crans horaires de 90°) est un **paramètre de vue** porté par
l'objet `Dims` déjà passé partout. La **donnée de scène n'est jamais touchée**
(reste pure — règles CLAUDE.md #2/#3). Les sites d'appel passant déjà `dims`
héritent de `rot` sans modification : c'est ce qui rend l'approche contenue.

Approches écartées :
- **B (pré-rotation des données)** : transformer une copie tournée de toutes les
  coords chaque frame, projection fixe, dé-rotation du picking. Plus de pièces
  mobiles, footprints à tourner comme données, risque d'incohérence. Rejetée.
- **C (transform 3D CSS seul)** : pivoter le `<g>` SVG en 3D sans toucher la logique.
  Échoue le but : les bâtiments restent dessinés face-avant selon l'orientation
  d'origine → on voit l'arrière des murs / à travers, rien n'est révélé. Rejetée.

## Portée v1

- **Jeu** (`CampaignView`/`IsoStage`) : rotation **animée** (cross-fade).
- **Éditeur** (`Editor.tsx`) : rotation **snap instantané** (pas d'anim — suffit en
  authoring). Hérite du socle rot-aware partagé ; on câble juste son entrée Q/E.
- **Hors v1** : yaw 3D « plateau qui pivote » (polish d'animation), boussole HUD.

## Conception détaillée

### 1. Cœur projection (`src/gameIso/iso.ts`) — rot-aware, pur

```ts
export type Rot = 0 | 1 | 2 | 3;
export interface Dims { w: number; h: number; rot?: Rot } // rot absent ⇒ 0 (rétro-compat)
```

- **`rotTile(x, y, dims): {x, y}`** — helper pur appliquant la permutation grille
  selon `dims.rot`, autour du centre de la grille :
  - rot 0 : `(x, y)`
  - rot 1 : `(y, W−1−x)`
  - rot 2 : `(W−1−x, H−1−y)`
  - rot 3 : `(H−1−y, x)`
  (W = `dims.w`, H = `dims.h`.)
- **`effDims(dims)`** — dimensions effectives écran : pour `rot` impair, `w`↔`h`
  permutés (une grille W×H tournée de 90° occupe H×W). Utilisé par `originX` /
  `stageSize` pour garder la carte cadrée dans les 4 orientations.
- `tileCenter(x, y, dims)` : applique `rotTile` puis la formule iso existante, avec
  `originX` basé sur `effDims`.
- `depth(x, y, dims)` : **signature étendue avec `dims`** (pour connaître `rot`) ;
  retourne `x'+y'` des coords tournées → tri painter correct. ~8 sites d'appel à
  mettre à jour (mécanique).
- `screenToTile(px, py, dims)` : inverse exact — inversion de la formule puis
  **dé-rotation** (`rotTile` inverse) → round-trip garanti.
- `diamondPath` / `diamondCorners` : inchangés en signature (passent par `tileCenter`).

### 2. Bâtiments — faces par position écran (`catalog/buildings.ts`, `BuildingSprite.tsx`)

- **`footCorners`** : au lieu de labelliser N/E/S/O par identité de coin grille,
  projeter les 4 coins de l'empreinte puis les **trier par position écran** :
  - le coin le plus **haut** (min screenY) → `N`
  - le plus **bas** (max screenY) → `S` (face avant)
  - le plus à **droite** (max screenX) → `E`
  - le plus à **gauche** (min screenX) → `O`
  Ainsi murs/fenêtres/porte se dessinent toujours sur les 2 faces face-caméra,
  quel que soit `rot`. Le reste de `buildings.ts` raisonne en N/E/S/O **écran** →
  inchangé.
- **`facing`** (côté porte, `E`/`S`/`O` en repère grille) : **tourné par `rot`**
  avant rendu, pour que la porte reste sur la même façade *du monde* (et non sur
  une façade qui « suit » la caméra).
- **`buildingDepth`** : passe par `depth(..., dims)` rot-aware.

### 3. État + entrée + caméra

- **État de vue éphémère** : champ `camRot: Rot` dans le store `useGame`. **Jamais
  sérialisé dans le document de scène.** (Au store plutôt qu'en local IsoStage pour
  permettre une boussole HUD ultérieure et un partage jeu/éditeur cohérent.)
- **Entrée Q / E** : handler clavier.
  - `E` (horaire) : `camRot = (camRot + 1) & 3`
  - `Q` (anti-horaire) : `camRot = (camRot + 3) & 3`
  - Ignoré si une modale / un dialogue est ouvert.
  - Câblé côté jeu **et** côté éditeur.
- **Caméra** : `focus`/`cam` passent déjà par `tileCenter` → recentrage automatique
  après rotation. Rien à recâbler.
- **Picking** : `onPointerDown` (jeu) et `tileAt` (éditeur) lisent `dims` (avec `rot`)
  → `screenToTile` rot-aware. Une ligne chacun (injecter `rot` dans `dims`).

### 4. Animation (jeu uniquement)

La rotation iso 90° **n'est pas une rotation 2D rigide de l'écran** (le monde se
ré-agence : le projeté de la grille tournée n'est pas le projeté tourné), donc pas
de pivot rigide propre avec des sprites discrets.

**v1 = cross-fade court :**
- Au déclenchement : figer l'orientation courante en calque statique, basculer
  `camRot`, rendre la nouvelle orientation, **cross-fade ~250 ms** (ancien 1→0,
  nouveau 0→1), avec un léger **dézoom→rezoom** pour lire « on soulève et tourne
  le plateau ».
- Robuste : zéro distorsion de sprite, zéro chaos de profondeur en vol.

**Éditeur = snap** (pas d'animation).

**Dette / hors v1** : yaw 3D « carte qui pivote » (`rotateY`, swap à mi-course quand
le plateau est de profil/edge-on, donc invisible). Plus « physique » mais plus
risqué — noté pour plus tard.

### 5. Tests

Moteur pur d'abord (Vitest) :

- **`iso.test.ts`** :
  - round-trip `screenToTile(tileCenter(t, d), d) === t` pour les 4 `rot` ;
  - tous les tiles projetés dans les bornes de `stageSize(d)` pour les 4 `rot`
    (cadrage / `effDims`) ;
  - ordre `depth` cohérent : le tile le plus en avant à l'écran a le `depth` max,
    pour chaque `rot`.
- **`buildings`** : pour chaque `rot`, la face labellisée `S` est bien le coin
  d'empreinte le plus bas à l'écran ; rotation correcte de `facing`.
- **`facing`** : ajouter un cas « la même paire de tuiles donne une vue différente
  selon `rot` » (confirme le recalcul automatique).

Recette navigateur (Playwright MCP) :

- poser un perso **derrière une maison**, presser **Q/E** → il apparaît ;
- vérifier **porte/fenêtres sur la bonne façade** dans les 4 orientations ;
- vérifier le picking (clic) juste dans les 4 orientations (jeu + éditeur) ;
- console **0 erreur**, screenshots des 4 vues.

## Risques / points de vigilance

- **Cadrage (`effDims`/`originX`)** : c'est le calcul le plus fiddly ; couvert par le
  test « tous les tiles dans les bornes » pour les 4 `rot`.
- **`depth(x,y)` → `depth(x,y,dims)`** : changement de signature à propager (~8 sites
  jeu + éditeur) ; mécanique mais à ne pas oublier (le typecheck le rattrape).
- **Cross-fade** : peut légèrement désorienter ; le dézoom + recentrage focal
  atténuent. Si jugé gênant à la recette, repli sur snap (déjà la voie éditeur).
- **Vues directionnelles créatures** : certaines créatures n'ont pas de vue dos/profil
  (`creatureView` retombe sur `front`) — c'est l'existant, pas une régression de la
  rotation ; juste moins joli sous certains angles.
