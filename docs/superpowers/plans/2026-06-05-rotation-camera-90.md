# Rotation caméra 90° (4 orientations) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au joueur de tourner la caméra autour de la scène par pas de 90° (4 orientations cardinales) pour voir derrière les occultants, en jeu (animé) et dans l'éditeur (snap).

**Architecture:** `rot ∈ {0,1,2,3}` est un paramètre de vue porté par l'objet `Dims` déjà passé partout. La rotation est appliquée *dans* la projection centralisée (`iso.ts`) ; la donnée de scène reste pure. Les bâtiments relabellisent leurs faces par position écran ; le facing (`screenDir`) devient rot-aware. État `camRot` dans le store pour le jeu (lu en live par les callbacks bus du rig), `rot` local pour l'éditeur.

**Tech Stack:** Vite + TypeScript + React, SVG iso fait main, Zustand (store), Vitest (tests purs).

**Spec :** `docs/superpowers/specs/2026-06-05-rotation-camera-90-design.md`

**Conventions du repo :**
- Tests : `npx vitest run <fichier>` (un fichier) ou `npm test` (tout). Typecheck : `npm run typecheck`.
- Working tree partagé (WIP parallèle de l'utilisateur) : committer **uniquement les fichiers de chaque tâche** via `git add <chemins exacts>` puis `git commit` (jamais `git add -A`).
- Fin de ligne CRLF (Windows) — l'avertissement git `LF will be replaced by CRLF` est normal, l'ignorer.

---

## Task 1 : Helpers de rotation purs dans `iso.ts`

Ajoute le type `Rot`, la rotation de tuile (avant/inverse) et les dimensions effectives. Purement additif — aucune signature existante ne change, le build reste vert.

**Files:**
- Modify: `src/gameIso/iso.ts`
- Test: `src/gameIso/iso.test.ts` (créer)

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/gameIso/iso.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { rotTile, unrotTile, effDims, type Dims } from './iso';

describe('rotTile / unrotTile', () => {
  const dims: Dims = { w: 5, h: 3 };

  it('rot 0 = identité', () => {
    expect(rotTile(2, 1, { ...dims, rot: 0 })).toEqual({ x: 2, y: 1 });
  });

  it('rot 1 : (x,y) -> (y, W-1-x)', () => {
    expect(rotTile(0, 0, { ...dims, rot: 1 })).toEqual({ x: 0, y: 4 });
    expect(rotTile(4, 0, { ...dims, rot: 1 })).toEqual({ x: 0, y: 0 });
  });

  it('rot 2 : (x,y) -> (W-1-x, H-1-y)', () => {
    expect(rotTile(0, 0, { ...dims, rot: 2 })).toEqual({ x: 4, y: 2 });
  });

  it('rot 3 : (x,y) -> (H-1-y, x)', () => {
    expect(rotTile(0, 0, { ...dims, rot: 3 })).toEqual({ x: 2, y: 0 });
  });

  it('unrotTile inverse rotTile pour les 4 rotations', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const d = { ...dims, rot };
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const r = rotTile(x, y, d);
          expect(unrotTile(r.x, r.y, d)).toEqual({ x, y });
        }
    }
  });
});

describe('effDims', () => {
  it('rot pair = dims inchangées', () => {
    expect(effDims({ w: 5, h: 3, rot: 0 })).toEqual({ w: 5, h: 3 });
    expect(effDims({ w: 5, h: 3, rot: 2 })).toEqual({ w: 5, h: 3 });
  });
  it('rot impair = w/h permutés', () => {
    expect(effDims({ w: 5, h: 3, rot: 1 })).toEqual({ w: 3, h: 5 });
    expect(effDims({ w: 5, h: 3, rot: 3 })).toEqual({ w: 3, h: 5 });
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run : `npx vitest run src/gameIso/iso.test.ts`
Expected : FAIL — `rotTile is not exported` / `does not provide an export named 'rotTile'`.

- [ ] **Step 3 : Implémenter dans `iso.ts`**

Étendre l'interface `Dims` (ligne 18-21) et ajouter les helpers après. `Dims.rot` est optionnel → tout le code existant qui passe `{w,h}` compile inchangé.

```ts
export type Rot = 0 | 1 | 2 | 3;

export interface Dims {
  w: number;
  h: number;
  rot?: Rot; // orientation caméra (cran de 90° horaire) ; absent ⇒ 0
}

/** Dimensions effectives à l'écran : pour rot impair, une grille W×H tournée occupe H×W. */
export function effDims(dims: Dims): { w: number; h: number } {
  return (dims.rot ?? 0) % 2 === 0 ? { w: dims.w, h: dims.h } : { w: dims.h, h: dims.w };
}

/** Coordonnée de tuile tournée (grille → espace écran tourné). PUR. */
export function rotTile(x: number, y: number, dims: Dims): { x: number; y: number } {
  const W = dims.w, H = dims.h;
  switch (dims.rot ?? 0) {
    case 1: return { x: y, y: W - 1 - x };
    case 2: return { x: W - 1 - x, y: H - 1 - y };
    case 3: return { x: H - 1 - y, y: x };
    default: return { x, y };
  }
}

/** Inverse de rotTile (espace écran tourné → grille). PUR. */
export function unrotTile(x: number, y: number, dims: Dims): { x: number; y: number } {
  const W = dims.w, H = dims.h;
  switch (dims.rot ?? 0) {
    case 1: return { x: W - 1 - y, y: x };
    case 2: return { x: W - 1 - x, y: H - 1 - y };
    case 3: return { x: y, y: H - 1 - x };
    default: return { x, y };
  }
}
```

- [ ] **Step 4 : Lancer le test → succès attendu**

Run : `npx vitest run src/gameIso/iso.test.ts`
Expected : PASS (tous les cas rotTile/unrotTile/effDims).

- [ ] **Step 5 : Typecheck + commit**

Run : `npm run typecheck`
Expected : 0 erreur.

```bash
git add src/gameIso/iso.ts src/gameIso/iso.test.ts
git commit -m "feat(iso): helpers de rotation purs (Rot, rotTile, unrotTile, effDims)"
```

---

## Task 2 : Projection rot-aware (`tileCenter`, `originX`/`stageSize`, `screenToTile`)

Branche `rot` dans la projection. Ces fonctions reçoivent **déjà** `dims` → aucune signature ne change, modifications internes seulement. Round-trip picking et cadrage validés par test.

**Files:**
- Modify: `src/gameIso/iso.ts`
- Test: `src/gameIso/iso.test.ts`

- [ ] **Step 1 : Ajouter les tests qui échouent**

Ajouter à la fin de `src/gameIso/iso.test.ts` :

```ts
import { tileCenter, screenToTile, stageSize } from './iso';

describe('projection rot-aware', () => {
  const ROTS = [0, 1, 2, 3] as const;

  it('screenToTile inverse tileCenter pour les 4 rotations', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot };
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(screenToTile(cx, cy, dims)).toEqual({ x, y });
        }
    }
  });

  it('toutes les tuiles tiennent dans stageSize pour les 4 rotations', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot };
      const stage = stageSize(dims);
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(cx).toBeGreaterThanOrEqual(0);
          expect(cx).toBeLessThanOrEqual(stage.w);
          expect(cy).toBeGreaterThanOrEqual(0);
          expect(cy).toBeLessThanOrEqual(stage.h);
        }
    }
  });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run : `npx vitest run src/gameIso/iso.test.ts`
Expected : FAIL — le round-trip casse pour rot ≠ 0 (et possiblement les bornes), car la projection ignore encore `rot`.

- [ ] **Step 3 : Rendre la projection rot-aware dans `iso.ts`**

Remplacer `originX`, `tileCenter`, `stageSize`, `screenToTile` par leurs versions effectives/tournées :

```ts
/** Marge à gauche pour que la tuile la plus à gauche reste visible (dimensions effectives). */
export function originX(dims: Dims) {
  const ed = effDims(dims);
  return (ed.h - 1) * (TW / 2) + TW / 2;
}
export function originY() {
  return SPRITE_HEADROOM;
}

/** Centre écran d'une tuile (x,y), en tenant compte de la rotation caméra. */
export function tileCenter(x: number, y: number, dims: Dims): { cx: number; cy: number } {
  const r = rotTile(x, y, dims);
  return {
    cx: originX(dims) + (r.x - r.y) * (TW / 2),
    cy: originY() + (r.x + r.y) * (TH / 2),
  };
}

/** Taille totale du canvas SVG (dimensions effectives). */
export function stageSize(dims: Dims): { w: number; h: number } {
  const ed = effDims(dims);
  return {
    w: (ed.w + ed.h) * (TW / 2) + TW,
    h: (ed.w + ed.h) * (TH / 2) + SPRITE_HEADROOM + TH,
  };
}

/** Inverse : point écran → tuile entière (dé-tourne après inversion). */
export function screenToTile(px: number, py: number, dims: Dims): { x: number; y: number } {
  const dx = px - originX(dims);
  const dy = py - originY();
  const a = dx / (TW / 2);
  const b = dy / (TH / 2);
  const rx = Math.round((a + b) / 2);
  const ry = Math.round((b - a) / 2);
  return unrotTile(rx, ry, dims);
}
```

Note : `originX` change de signature (`number` → `Dims`). Vérifier qu'aucun appelant externe ne l'utilise : `git grep -n "originX(" src` doit ne montrer que des usages internes à `iso.ts` (sinon les mettre à jour).

- [ ] **Step 4 : Lancer → succès attendu**

Run : `npx vitest run src/gameIso/iso.test.ts`
Expected : PASS (round-trip + bornes pour les 4 rotations).

- [ ] **Step 5 : Typecheck + commit**

Run : `npm run typecheck`
Expected : 0 erreur (les appels existants passent `{w,h}` sans `rot` ⇒ rot 0 ⇒ comportement identique).

```bash
git add src/gameIso/iso.ts src/gameIso/iso.test.ts
git commit -m "feat(iso): tileCenter/screenToTile/stageSize rot-aware via effDims"
```

---

## Task 3 : `depth(x,y,dims)` rot-aware + propagation de signature

`depth` doit connaître `rot` pour trier en painter dans l'orientation courante. Sa signature change → on met à jour **tous** les sites d'appel dans la même tâche (build cassé en milieu de tâche, vert à la fin).

**Files:**
- Modify: `src/gameIso/iso.ts` (def), `src/gameIso/sprites.ts:41`, `src/gameIso/BuildingSprite.tsx:8-9`, `src/gameIso/IsoStage.tsx` (lignes 322,336,341,346,361,369,378), `src/ui/editor/Editor.tsx` (lignes 628,639,648)
- Test: `src/gameIso/iso.test.ts`

- [ ] **Step 1 : Ajouter le test qui échoue**

Ajouter à `src/gameIso/iso.test.ts` :

```ts
import { depth } from './iso';

describe('depth rot-aware', () => {
  it('le tri depth suit la position écran (cy) pour les 4 rotations', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const dims: Dims = { w: 5, h: 5, rot };
      const tiles: { d: number; cy: number }[] = [];
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++)
          tiles.push({ d: depth(x, y, dims), cy: tileCenter(x, y, dims).cy });
      const byDepth = [...tiles].sort((a, b) => a.d - b.d).map((t) => t.cy);
      // cy doit être non-décroissant quand on trie par depth (plus profond = plus bas à l'écran)
      for (let i = 1; i < byDepth.length; i++) expect(byDepth[i]).toBeGreaterThanOrEqual(byDepth[i - 1]);
    }
  });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run : `npx vitest run src/gameIso/iso.test.ts`
Expected : FAIL — `Expected 3 arguments, but got 2` (TS) ou tri incohérent pour rot ≠ 0.

- [ ] **Step 3 : Changer la def dans `iso.ts`**

```ts
/** Profondeur de tri (plus grand = devant), dans l'orientation courante. */
export function depth(x: number, y: number, dims: Dims) {
  const r = rotTile(x, y, dims);
  return r.x + r.y;
}
```

- [ ] **Step 4 : Mettre à jour tous les appelants**

`src/gameIso/sprites.ts:41` (a déjà `dims` en scope) :

```ts
  return ov ? { d: depth(x, y, dims) + ov.depthBias, html: ov.render(x, y, dims) } : null;
```

`src/gameIso/BuildingSprite.tsx` — `buildingDepth` prend désormais `dims` ; mettre à jour la def et l'appel dans `buildingObj` :

```ts
export function buildingDepth(b: BuildingFeature, dims: Dims): number {
  return depth(b.foot.x + b.foot.w - 1, b.foot.y + b.foot.h - 1, dims);
}
```
et dans `buildingObj` (déjà `dims` en paramètre) :
```ts
    d: buildingDepth(b, dims),
```

`src/gameIso/IsoStage.tsx` — remplacer chaque `depth(A, B)` par `depth(A, B, dims)` aux lignes 322, 336, 341, 346, 361, 369, 378. Exemple ligne 322 :
```ts
    objs.push({ d: depth(ent.pos.x, ent.pos.y, dims), el: token(`e-${ent.id}`, ent.pos.x, ent.pos.y, entitySprite(ent), 0.55, undefined, false, ent.anim) });
```
(Idem pour `depth(wp.x, wp.y, dims) + 0.5` aux 336/341/346/378, et `depth(ent.pos.x, ent.pos.y, dims)` aux 361/369.)

`src/ui/editor/Editor.tsx` — lignes 628, 639, 648, ajouter `, dims` (déjà en scope) :
```ts
                      d: depth(e.pos.x, e.pos.y, dims) + 0.4,
                    objs.push({ d: depth(e.pos.x, e.pos.y, dims) + 0.5, el: <EntityToken key={e.id} ent={e} dims={dims} /> });
                      d: depth(en.pos.x, en.pos.y, dims) + 0.45,
```

Vérifier l'exhaustivité : `git grep -n "depth(" src` ne doit plus montrer aucun appel à 2 arguments.

- [ ] **Step 5 : Lancer test + typecheck → succès**

Run : `npx vitest run src/gameIso/iso.test.ts && npm run typecheck`
Expected : PASS + 0 erreur TS.

- [ ] **Step 6 : Commit**

```bash
git add src/gameIso/iso.ts src/gameIso/iso.test.ts src/gameIso/sprites.ts src/gameIso/BuildingSprite.tsx src/gameIso/IsoStage.tsx src/ui/editor/Editor.tsx
git commit -m "feat(iso): depth(x,y,dims) rot-aware + propagation aux sites d'appel"
```

---

## Task 4 : Bâtiments — faces par position écran + rotation de la porte

`footCorners` labellise N/E/S/O par **position écran** (plus bas = S, etc.) au lieu de l'identité de coin grille → murs/porte toujours face caméra. Le `facing` (porte) est tourné par `rot`.

**Files:**
- Modify: `src/gameIso/catalog/buildings.ts`
- Test: `src/gameIso/catalog/buildings.test.ts` (créer)

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/gameIso/catalog/buildings.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { footCorners, rotateFacing } from './buildings';
import type { Dims } from '../iso';

describe('rotateFacing', () => {
  it('tourne la façade horaire N→E→S→O', () => {
    expect(rotateFacing('N', 1)).toBe('E');
    expect(rotateFacing('E', 1)).toBe('S');
    expect(rotateFacing('S', 1)).toBe('O');
    expect(rotateFacing('O', 1)).toBe('N');
    expect(rotateFacing('N', 2)).toBe('S');
    expect(rotateFacing('N', 0)).toBe('N');
  });
  it('undefined reste undefined', () => {
    expect(rotateFacing(undefined, 1)).toBeUndefined();
  });
});

describe('footCorners par position écran', () => {
  const foot = { x: 2, y: 2, w: 3, h: 2 };
  it('S est le coin le plus bas, N le plus haut, pour les 4 rotations', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const dims: Dims = { w: 10, h: 10, rot };
      const c = footCorners(foot, { dims });
      const cys = [c.N[1], c.E[1], c.S[1], c.O[1]];
      const cxs = [c.N[0], c.E[0], c.S[0], c.O[0]];
      expect(c.S[1]).toBe(Math.max(...cys));
      expect(c.N[1]).toBe(Math.min(...cys));
      expect(c.E[0]).toBe(Math.max(...cxs));
      expect(c.O[0]).toBe(Math.min(...cxs));
    }
  });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run : `npx vitest run src/gameIso/catalog/buildings.test.ts`
Expected : FAIL — `footCorners`/`rotateFacing` non exportés.

- [ ] **Step 3 : Implémenter dans `buildings.ts`**

Remplacer `footCorners` (lignes 5-17) par une version triée par position écran, **exportée**. Importer `Facing` est déjà fait (ligne 3).

```ts
/** Coins écran (sol) de l'empreinte, labellisés par POSITION ÉCRAN (rot-aware) :
 *  le coin projeté le plus bas = S (face avant), le plus haut = N, etc. */
export function footCorners(foot: Rect, ctx: RenderCtx) {
  const pts = [
    tileCenter(foot.x, foot.y, ctx.dims),
    tileCenter(foot.x + foot.w - 1, foot.y, ctx.dims),
    tileCenter(foot.x + foot.w - 1, foot.y + foot.h - 1, ctx.dims),
    tileCenter(foot.x, foot.y + foot.h - 1, ctx.dims),
  ];
  const top = pts.reduce((a, b) => (b.cy < a.cy ? b : a));
  const bot = pts.reduce((a, b) => (b.cy > a.cy ? b : a));
  const right = pts.reduce((a, b) => (b.cx > a.cx ? b : a));
  const left = pts.reduce((a, b) => (b.cx < a.cx ? b : a));
  return {
    N: [top.cx, top.cy - TH / 2] as number[],
    E: [right.cx + TW / 2, right.cy] as number[],
    S: [bot.cx, bot.cy + TH / 2] as number[],
    O: [left.cx - TW / 2, left.cy] as number[],
  };
}

const FACING_ORDER: Facing[] = ['N', 'E', 'S', 'O'];
/** Tourne une façade-monde dans le repère écran courant (cran horaire `rot`). */
export function rotateFacing(f: Facing | undefined, rot: number): Facing | undefined {
  if (!f) return undefined;
  return FACING_ORDER[(FACING_ORDER.indexOf(f) + rot) & 3];
}
```

Puis appliquer la rotation du `facing` une seule fois, dans `buildingLayers` (ligne ~244) :

```ts
export function buildingLayers(type: string, foot: Rect, params: BuildingParams, ctx: RenderCtx): BuildingLayers {
  const rctx: RenderCtx = { ...ctx, facing: rotateFacing(ctx.facing, ctx.dims.rot ?? 0) };
  const viz = BUILDINGS[type];
  if (!viz) return colombage(foot, params, rctx); // fallback = maison générique
  return viz.render(foot, params, rctx);
}
```

- [ ] **Step 4 : Lancer → succès attendu**

Run : `npx vitest run src/gameIso/catalog/buildings.test.ts`
Expected : PASS.

- [ ] **Step 5 : Typecheck + commit**

Run : `npm run typecheck`
Expected : 0 erreur.

```bash
git add src/gameIso/catalog/buildings.ts src/gameIso/catalog/buildings.test.ts
git commit -m "feat(buildings): faces labellisees par position ecran + rotation de la porte (rot-aware)"
```

---

## Task 5 : `camRot` dans le store

Ajoute l'état de vue `camRot` et l'action `rotateCam` au store `useGame`. Pas de sérialisation dans la scène.

**Files:**
- Modify: `src/state/store.ts` (interface `GameState` ~ligne 208 ; objet `create` ~ligne 350)
- Test: `src/state/store.test.ts` (existant)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `src/state/store.test.ts` (adapter l'import s'il existe déjà ; le store est un singleton `useGame`) :

```ts
import { useGame } from './store';

describe('camRot', () => {
  it('démarre à 0 et tourne horaire/anti-horaire en bouclant sur 4', () => {
    useGame.setState({ camRot: 0 });
    useGame.getState().rotateCam(1);
    expect(useGame.getState().camRot).toBe(1);
    useGame.getState().rotateCam(1);
    useGame.getState().rotateCam(1);
    useGame.getState().rotateCam(1);
    expect(useGame.getState().camRot).toBe(0); // 4 crans = tour complet
    useGame.getState().rotateCam(-1);
    expect(useGame.getState().camRot).toBe(3); // boucle négative
  });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run : `npx vitest run src/state/store.test.ts`
Expected : FAIL — `rotateCam is not a function` / `camRot` undefined.

- [ ] **Step 3 : Implémenter dans `store.ts`**

Dans l'interface `GameState` (vers ligne 212, près de `mode`), ajouter :

```ts
  camRot: 0 | 1 | 2 | 3; // orientation caméra (cran de 90° horaire) — état de vue, non sérialisé
  rotateCam: (dir: 1 | -1) => void;
```

Dans l'objet `create<GameState>((set, get) => ({ ... }))`, près de `mode: 'exploration',` (ligne 354), ajouter l'état initial et l'action :

```ts
  camRot: 0,
  rotateCam: (dir) => set((s) => ({ camRot: (((s.camRot + dir) % 4) + 4) % 4 as 0 | 1 | 2 | 3 })),
```

- [ ] **Step 4 : Lancer → succès attendu**

Run : `npx vitest run src/state/store.test.ts`
Expected : PASS.

- [ ] **Step 5 : Typecheck + commit**

Run : `npm run typecheck`
Expected : 0 erreur.

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(store): camRot + rotateCam (etat de vue, non serialise)"
```

---

## Task 6 : `screenDir` rot-aware + appelants rig (facing)

Le facing est dérivé de `screenDir`, qui recalcule la projection sans `rot`. On le rend rot-aware (paramètre `dims` optionnel) et on met à jour les appelants qui lisent le `camRot` du store en live.

**Files:**
- Modify: `src/gameIso/rig/facing.ts`, `src/gameIso/RigToken.tsx:67-72`, `src/gameIso/AnimatedQuadToken.tsx:26-29`
- Test: `src/gameIso/rig/facing.test.ts` (existant)

- [ ] **Step 1 : Ajouter le test qui échoue**

Ajouter au `describe('screenDir', ...)` de `src/gameIso/rig/facing.test.ts` :

```ts
  it('tourne les extrémités selon dims.rot', () => {
    // sans dims = comportement actuel (rot 0)
    expect(screenDir({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ dx: 1, dy: 1 });
    // rot 1 sur grille 3×3 : (0,0)->(0,2), (1,0)->(0,1) → dx=1, dy=-1
    expect(screenDir({ x: 0, y: 0 }, { x: 1, y: 0 }, { w: 3, h: 3, rot: 1 })).toEqual({ dx: 1, dy: -1 });
  });
```

- [ ] **Step 2 : Lancer → échec attendu**

Run : `npx vitest run src/gameIso/rig/facing.test.ts`
Expected : FAIL — `screenDir` n'accepte pas de 3e argument / résultat `{dx:1,dy:1}` au lieu de `{dx:1,dy:-1}`.

- [ ] **Step 3 : Rendre `screenDir` rot-aware**

Dans `src/gameIso/rig/facing.ts`, importer `rotTile`/`Dims` et tourner les extrémités :

```ts
import { rotTile, type Dims } from '../iso';
```
```ts
/** Vecteur direction ÉCRAN entre deux tuiles, dans l'orientation caméra `dims` (rot). PUR. */
export function screenDir(
  from: { x: number; y: number },
  to: { x: number; y: number },
  dims?: Dims,
) {
  const a = dims ? rotTile(from.x, from.y, dims) : from;
  const b = dims ? rotTile(to.x, to.y, dims) : to;
  return { dx: b.x - b.y - (a.x - a.y), dy: b.x + b.y - (a.x + a.y) };
}
```

- [ ] **Step 4 : Mettre à jour les appelants rig (lecture live du store)**

`src/gameIso/RigToken.tsx` — importer le store s'il ne l'est pas déjà (`import { useGame } from '../state/store';` est présent), puis dans `face()` (ligne 68-72) construire le `dims` de vue depuis le store :

```ts
    const face = (a?: { x: number; y: number }, b?: { x: number; y: number }) => {
      if (!a || !b) return;
      const st = useGame.getState();
      const vd = st.scene ? { ...st.scene.dimensions, rot: st.camRot } : undefined;
      const { dx, dy } = screenDir(a, b, vd);
      if (dx === 0 && dy === 0) return;
      setFacing(facingView(dx, dy));
    };
```

`src/gameIso/AnimatedQuadToken.tsx` (lignes 26-29) — même patron :

```ts
      const st = useGame.getState();
      const vd = st.scene ? { ...st.scene.dimensions, rot: st.camRot } : undefined;
      const { dx, dy } = screenDir(a, b, vd);
      if (dx !== 0 || dy !== 0) setFacing(facingView(dx, dy));
```
(Ajouter `import { useGame } from '../state/store';` en tête d'`AnimatedQuadToken.tsx` s'il manque — vérifier d'abord.)

- [ ] **Step 5 : Lancer test + typecheck → succès**

Run : `npx vitest run src/gameIso/rig/facing.test.ts && npm run typecheck`
Expected : PASS + 0 erreur.

- [ ] **Step 6 : Commit**

```bash
git add src/gameIso/rig/facing.ts src/gameIso/rig/facing.test.ts src/gameIso/RigToken.tsx src/gameIso/AnimatedQuadToken.tsx
git commit -m "feat(facing): screenDir rot-aware + rig lit camRot du store"
```

---

## Task 7 : Câblage jeu (`IsoStage`) — dims, Q/E, boutons, animation « dim-and-turn »

Branche `camRot` dans le rendu du jeu : `dims` de vue, entrée clavier Q/E (via `e.code`, robuste AZERTY), boutons HUD, et une transition animée qui assombrit/dézoome brièvement le temps de pivoter (la tuile se ré-agence pendant le creux). Met aussi à jour le dernier appelant `screenDir` (créatures monolithiques, ligne 152).

**Files:**
- Modify: `src/gameIso/IsoStage.tsx`
- Vérif : navigateur (Playwright MCP)

- [ ] **Step 1 : État de vue + dims tournées**

En haut du composant (après `const [zoom, setZoom] = useState(1);`, ligne 69) :

```ts
  const camRot = useGame((s) => s.camRot);
  const rotateCam = useGame((s) => s.rotateCam);
  // rot AFFICHÉE (retarde la cible pour masquer le ré-agencement sous le creux d'opacité)
  const [shownRot, setShownRot] = useState<0 | 1 | 2 | 3>(camRot);
  const [turning, setTurning] = useState(false);
  useEffect(() => {
    if (shownRot === camRot) return;
    setTurning(true);
    const t1 = window.setTimeout(() => setShownRot(camRot), 130); // swap au creux
    const t2 = window.setTimeout(() => setTurning(false), 260);   // remontée
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [camRot, shownRot]);
```

Remplacer `const dims: Dims = scene.dimensions;` (ligne 200) par :

```ts
  const dims: Dims = { ...scene.dimensions, rot: shownRot };
```

- [ ] **Step 2 : Mettre à jour l'appelant `screenDir` des créatures monolithiques (ligne ~152)**

Dans le `useEffect` qui calcule `creatureFacing` (ligne 152), passer le `dims` de vue. Comme `dims` est calculé dans le corps de rendu (pas dans ce effect), reconstruire depuis le store :

```ts
      const st = useGame.getState();
      const vd = st.scene ? { ...st.scene.dimensions, rot: st.camRot } : undefined;
      const { dx, dy } = screenDir(from, to, vd);
```

- [ ] **Step 3 : Entrée clavier Q/E (physique, robuste AZERTY)**

Ajouter un effect (près des autres effects du composant) :

```ts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().dialogue) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable)) return;
      if (e.code === 'KeyE') rotateCam(1);
      else if (e.code === 'KeyQ') rotateCam(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rotateCam]);
```

- [ ] **Step 4 : Animation dim-and-turn sur la caméra**

Le `<g>` caméra (ligne 462) : injecter le creux d'opacité + dézoom quand `turning`. Remplacer son `style` par :

```tsx
      <g style={{ transform: `translate(${VW / 2}px,${VH / 2}px) scale(${zoom * (turning ? 0.9 : 1)}) translate(${-VW / 2}px,${-VH / 2}px) translate(${cam.x}px,${cam.y}px)`, transition: 'transform 0.13s ease-out, opacity 0.13s ease-out', opacity: turning ? 0.22 : 1 }}>
```

- [ ] **Step 5 : Boutons HUD de rotation**

Près des boutons de zoom (bloc commençant ligne 548, hors caméra), ajouter deux boutons de rotation. Insérer dans le même groupe `<g>` (adapter les `translate` pour ne pas chevaucher le zoom — p.ex. à `translate(0,150)` et `translate(50,150)`) :

```tsx
        <g transform="translate(0,150)" onPointerDown={(e) => { e.stopPropagation(); rotateCam(-1); }} style={{ cursor: 'pointer' }}>
          <circle r={18} fill="#1b1622" stroke="#5a4f6b" />
          <text textAnchor="middle" y={6} fontSize={20} fill="#d8cfe6">⟲</text>
        </g>
        <g transform="translate(50,150)" onPointerDown={(e) => { e.stopPropagation(); rotateCam(1); }} style={{ cursor: 'pointer' }}>
          <circle r={18} fill="#1b1622" stroke="#5a4f6b" />
          <text textAnchor="middle" y={6} fontSize={20} fill="#d8cfe6">⟳</text>
        </g>
```
(Si la disposition exacte des boutons de zoom diffère, garder simplement la même mécanique `onPointerDown` + `e.stopPropagation()` ; le positionnement précis est cosmétique.)

- [ ] **Step 6 : Typecheck**

Run : `npm run typecheck`
Expected : 0 erreur.

- [ ] **Step 7 : Recette navigateur (Playwright MCP)**

1. `npm run dev`, charger `http://localhost:5173`.
2. Lancer un scénario de test (menu **« 🧪 Tests — scénarios »**) avec un bâtiment et un combattant, OU placer un perso derrière une maison.
3. Presser **E** puis **Q** plusieurs fois :
   - la vue pivote par crans de 90°, avec un bref assombrissement/dézoom ;
   - un perso caché derrière une maison **apparaît** sous le bon angle ;
   - **porte/fenêtres** restent sur une façade cohérente (face caméra) dans les 4 orientations ;
   - **cliquer une tuile** sélectionne/déplace la bonne tuile dans les 4 orientations (picking) ;
   - le facing des persos en mouvement reste plausible après rotation.
4. Console navigateur : **0 erreur**. Screenshot des 4 orientations.

Si le creux d'opacité paraît gênant : réduire à `opacity: turning ? 0.45 : 1` ; en dernier recours, retirer `turning` du `<g>` (repli snap, déjà la voie éditeur).

- [ ] **Step 8 : Commit**

```bash
git add src/gameIso/IsoStage.tsx
git commit -m "feat(jeu): rotation camera 90 (Q/E + boutons HUD + transition dim-and-turn)"
```

---

## Task 8 : Câblage éditeur (`Editor`) — rot local + Q/E (snap)

L'éditeur partage la projection rot-aware ; il lui faut juste un `rot` local et l'entrée Q/E. Pas d'animation (snap).

**Files:**
- Modify: `src/ui/editor/Editor.tsx`
- Vérif : navigateur (Playwright MCP)

- [ ] **Step 1 : État local + dims tournées**

Ajouter près des autres `useState` du composant éditeur :

```ts
  const [rot, setRot] = useState<0 | 1 | 2 | 3>(0);
```

Remplacer `const dims: Dims = scene.dimensions;` (ligne 163) par :

```ts
  const dims: Dims = { ...scene.dimensions, rot };
```

- [ ] **Step 2 : Entrée clavier Q/E (gardée contre la saisie texte)**

Ajouter un effect (l'éditeur a beaucoup de champs → le garde contre INPUT/TEXTAREA/SELECT/contentEditable est essentiel) :

```ts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable)) return;
      if (e.code === 'KeyE') setRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3));
      else if (e.code === 'KeyQ') setRot((r) => (((r + 3) % 4) as 0 | 1 | 2 | 3));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
```

- [ ] **Step 3 : (Optionnel) deux petits boutons de rotation dans la barre d'outils**

Si la barre d'outils de l'éditeur a un emplacement naturel, ajouter deux boutons HTML :

```tsx
        <button type="button" onClick={() => setRot((r) => (((r + 3) % 4) as 0 | 1 | 2 | 3))} title="Tourner anti-horaire (Q)">⟲</button>
        <button type="button" onClick={() => setRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3))} title="Tourner horaire (E)">⟳</button>
```
(Cosmétique — si aucun emplacement évident, s'en tenir à Q/E.)

- [ ] **Step 4 : Typecheck**

Run : `npm run typecheck`
Expected : 0 erreur.

- [ ] **Step 5 : Recette navigateur (Playwright MCP)**

1. Ouvrir l'éditeur, charger/créer une scène avec un bâtiment.
2. Cliquer hors d'un champ texte, presser **E**/**Q** : la vue **snap** par crans de 90°, sans animation.
3. Vérifier : placement d'entité au clic correct (picking) dans les 4 orientations ; bâtiment lisible (faces face caméra) sous tous les angles.
4. Vérifier qu'écrire dans un champ (label, param) **n'altère pas** la rotation (Q/E tapés dans un input ne tournent pas la caméra).
5. Console : **0 erreur**.

- [ ] **Step 6 : Commit**

```bash
git add src/ui/editor/Editor.tsx
git commit -m "feat(editeur): rotation camera 90 (rot local + Q/E, snap)"
```

---

## Vérification finale

- [ ] `npm test` (suite complète) : verte.
- [ ] `npm run typecheck` : 0 erreur.
- [ ] Recette jeu + éditeur faites, screenshots des 4 orientations, console propre.
- [ ] (Optionnel) Mémoire projet : noter la convention « rotation = paramètre de vue dans `Dims`, jamais dans la scène ; facing via `screenDir(dims)` » si jugé non-évident.

## Notes / pièges

- **Sens de `rotateFacing`** : si à la recette la porte se place sur la mauvaise façade, inverser le sens (`- rot` au lieu de `+ rot`). Purement cosmétique, couvert par un test de cohérence (pas de sens absolu imposé).
- **Créatures sans vue dos/profil** : `creatureView` retombe sur `front` (existant) — moins joli sous certains angles, pas une régression de la rotation.
- **Éditeur ≠ store camRot** : l'éditeur utilise un `rot` local ; le facing rig de l'éditeur (statique) lit le `camRot` du store (= 0) — sans effet visible car ses entités ne bougent pas. Acceptable.
- **`originX(dims)`** : signature changée (`number` → `Dims`) ; vérifier qu'aucun appelant hors `iso.ts` ne casse (`git grep "originX("`).
