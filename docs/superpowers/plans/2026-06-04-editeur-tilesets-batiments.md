# Éditeur : tilesets, bâtiments & décors data-driven — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le système de tuiles plat/codé-en-dur de l'éditeur par des catalogues data-driven (sols avec raccord d'arêtes, bâtiments multi-tuiles avec cutaway/porte, décors procéduraux), au niveau de rendu de `public/ambush.html`.

**Architecture:** Chaque famille (sol/bâtiment/décor) est scindée en deux registres joints par `id` : **sémantique pure** dans `src/state/` (walkability, précédence, empreinte, porte — testée en Vitest) et **présentation** dans `src/gameIso/catalog/` (`render()` SVG, gradients, `paramsSchema`). Le `Scene` stocke des `string` d'id ; renderer et éditeur sont génériques (`CATALOG[id]?.… ?? fallback`). Dépendances : `gameIso → state → engine`, jamais l'inverse.

**Tech Stack:** Vite + React + TypeScript, Zustand (store), Vitest (moteur/état pur), rendu isométrique SVG (`src/gameIso/`), Playwright MCP (validation UI).

**Réf design:** `docs/superpowers/specs/2026-06-04-editeur-tilesets-batiments-design.md`

---

## File Structure

**Phase 1 — sols + raccord d'arêtes**
- Create `src/state/terrain.ts` — registre pur `TERRAINS` (id, label, walkable, priority).
- Modify `src/state/scene.ts` — `Terrain = string` ; `WALKABLE`/`isWalkable`/`tileAt` via registre.
- Create `src/state/terrain.test.ts` — tests registre + walkability.
- Create `src/gameIso/catalog/terrain.ts` — registre visuel `TERRAIN_VIZ` (gradient, swatch).
- Create `src/gameIso/ground.ts` — `edgeBlends()` (pur, testé) + `groundTile()` (SVG).
- Create `src/gameIso/ground.test.ts` — tests sélection de wedges.
- Modify `src/gameIso/sprites.ts` — `DEFS` (gradients `pave/terre/dalle`), `TILE_GRAD` → catalogue.
- Modify `src/gameIso/IsoStage.tsx` + `src/ui/editor/Editor.tsx` — couche sol via `groundTile()`.

**Phase 2 — bâtiments + décors + cutaway**
- Modify `src/state/scene.ts` — `BuildingFeature`, `Scene.buildings`, helpers purs.
- Create `src/state/buildings.ts` — registre pur `BUILDINGS_META` + `buildingBlockedAt`/`buildingAt`/`doorAt`/`roofHidden`.
- Create `src/state/buildings.test.ts` — tests empreinte/porte/cutaway.
- Create `src/gameIso/catalog/types.ts` — `ParamField`, `RenderCtx`, `BuildingLayers`, `BuildingViz`, `PropViz`.
- Create `src/gameIso/catalog/buildings.ts` — `BUILDINGS` + générateurs procéduraux.
- Create `src/gameIso/catalog/decor.ts` — `PROPS` + générateurs.
- Modify `src/gameIso/sprites.ts` — `propSprite(ref)` → catalogue décor.
- Create `src/gameIso/anim.css` — keyframes portées d'`ambush.html`.
- Modify `src/gameIso/IsoStage.tsx` — rendu bâtiments + cutaway + import `anim.css`.
- Modify `src/state/store.ts` — transition par tuile-porte dans `moveParty`.

**Phase 3 — éditeur générique**
- Create `src/ui/editor/ParamFields.tsx` — éditeur de params générique depuis `paramsSchema`.
- Modify `src/ui/editor/Editor.tsx` — palette générée (terrain/bâtiments/décors), outil `building`, inspecteur, WYSIWYG.

---

## PHASE 1 — Sols enrichis + raccord d'arêtes

### Task 1: Registre terrain pur

**Files:**
- Create: `src/state/terrain.ts`
- Test: `src/state/terrain.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/state/terrain.test.ts
import { describe, it, expect } from 'vitest';
import { TERRAINS, terrainWalkable, terrainPriority } from './terrain';

describe('registre terrain', () => {
  it('contient les ids existants + nouveaux', () => {
    for (const id of ['herbe', 'sol', 'route', 'eau', 'plancher', 'bois', 'mur', 'porte', 'pave', 'terre', 'dalle'])
      expect(TERRAINS[id], id).toBeDefined();
  });
  it('walkability : herbe/route/pave franchissables, eau/mur non', () => {
    expect(terrainWalkable('herbe')).toBe(true);
    expect(terrainWalkable('pave')).toBe(true);
    expect(terrainWalkable('eau')).toBe(false);
    expect(terrainWalkable('mur')).toBe(false);
  });
  it('id inconnu → non franchissable (fallback bloquant)', () => {
    expect(terrainWalkable('zzz-inconnu')).toBe(false);
  });
  it('précédence : pave déborde sur herbe (priorité plus haute)', () => {
    expect(terrainPriority('pave')).toBeGreaterThan(terrainPriority('herbe'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/state/terrain.test.ts`
Expected: FAIL — `Cannot find module './terrain'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/state/terrain.ts
/** Registre PUR des terrains (sémantique : walkability + précédence de raccord).
 *  Présentation (gradient/swatch) → src/gameIso/catalog/terrain.ts, joint par id. */
export interface TerrainMeta {
  id: string;
  label: string;
  walkable: boolean;
  /** Précédence de raccord d'arêtes : un terrain de priorité plus haute « déborde »
   *  sur ses voisins de priorité plus basse (façon crossers NWN). */
  priority: number;
}

export const TERRAINS: Record<string, TerrainMeta> = {
  herbe:    { id: 'herbe',    label: 'Herbe',          walkable: true,  priority: 1 },
  terre:    { id: 'terre',    label: 'Terre battue',   walkable: true,  priority: 2 },
  bois:     { id: 'bois',     label: 'Sous-bois',      walkable: false, priority: 1 },
  route:    { id: 'route',    label: 'Chemin',         walkable: true,  priority: 3 },
  sol:      { id: 'sol',      label: 'Sol nu',         walkable: true,  priority: 2 },
  dalle:    { id: 'dalle',    label: 'Dallage',        walkable: true,  priority: 4 },
  pave:     { id: 'pave',     label: 'Pavés',          walkable: true,  priority: 5 },
  plancher: { id: 'plancher', label: 'Plancher',       walkable: true,  priority: 4 },
  eau:      { id: 'eau',      label: 'Eau',            walkable: false, priority: 0 },
  mur:      { id: 'mur',      label: 'Mur',            walkable: false, priority: 9 },
  porte:    { id: 'porte',    label: 'Porte',          walkable: true,  priority: 9 },
};

export function terrainWalkable(id: string): boolean {
  return TERRAINS[id]?.walkable ?? false;
}
export function terrainPriority(id: string): number {
  return TERRAINS[id]?.priority ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/state/terrain.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/terrain.ts src/state/terrain.test.ts
git commit -m "feat(state): registre terrain pur (walkability + precedence)"
```

---

### Task 2: Migrer `scene.ts` vers `Terrain = string` + registre

**Files:**
- Modify: `src/state/scene.ts:11-23` (type `Terrain` + `WALKABLE`), `:140-142` (`isWalkable`)
- Test: `src/state/scene.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/state/scene.test.ts
import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, tileAt } from './scene';

describe('scene + terrain registre', () => {
  it('isWalkable suit le registre terrain', () => {
    const s = emptyScene(3, 3); // rempli d'herbe
    s.tiles[0] = 'pave';
    s.tiles[1] = 'eau';
    expect(isWalkable(s, 0, 0)).toBe(true);  // pave
    expect(isWalkable(s, 1, 0)).toBe(false); // eau
  });
  it('hors-grille → mur (bloqué)', () => {
    const s = emptyScene(3, 3);
    expect(tileAt(s, -1, 0)).toBe('mur');
    expect(isWalkable(s, -1, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/state/scene.test.ts`
Expected: FAIL (le test compile mais on va d'abord casser/retirer l'ancien `WALKABLE`). Si déjà vert, continuer — le refactor suivant ne doit pas le casser.

- [ ] **Step 3: Implement — remplacer le type et la table**

Dans `src/state/scene.ts`, remplacer le bloc lignes 11-23 :

```ts
import { CharKey, Difficulty } from '../engine/types';
import { terrainWalkable } from './terrain';

/** Un terrain est un id de catalogue (cf. src/state/terrain.ts). */
export type Terrain = string;
```

(supprimer l'ancienne union `Terrain` et la constante `WALKABLE`.)

Puis remplacer `isWalkable` (lignes ~140-142) :

```ts
export function isWalkable(scene: Scene, x: number, y: number): boolean {
  return terrainWalkable(tileAt(scene, x, y));
}
```

- [ ] **Step 4: Find & fix usages de `WALKABLE`**

Run: `grep -rn "WALKABLE" src/`
Expected: corriger chaque usage pour passer par `terrainWalkable(id)`. Attendu : seul `scene.ts` l'exportait ; s'il reste des imports, les remplacer.

- [ ] **Step 5: Run typecheck + tests**

Run: `npm run typecheck && npm test -- src/state/scene.test.ts`
Expected: typecheck OK, 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state/scene.ts src/state/scene.test.ts
git commit -m "refactor(state): Terrain=string via registre (compat scenes existantes)"
```

---

### Task 3: Catalogue visuel terrain + gradients

**Files:**
- Create: `src/gameIso/catalog/terrain.ts`
- Modify: `src/gameIso/sprites.ts` (`DEFS` ~198-217, `TILE_GRAD` ~22-31)

- [ ] **Step 1: Créer le catalogue visuel**

```ts
// src/gameIso/catalog/terrain.ts
/** Présentation des terrains (joint à src/state/terrain.ts par id). */
export interface TerrainViz {
  id: string;
  gradient: string; // id du <linearGradient> dans DEFS
  swatch: string;   // couleur d'aperçu (palette éditeur)
}
export const TERRAIN_VIZ: Record<string, TerrainViz> = {
  herbe:    { id: 'herbe',    gradient: 'g_grass',    swatch: '#3d6630' },
  terre:    { id: 'terre',    gradient: 'g_terre',    swatch: '#6b5436' },
  bois:     { id: 'bois',     gradient: 'g_grass',    swatch: '#2f4d20' },
  route:    { id: 'route',    gradient: 'g_route',    swatch: '#8a744c' },
  sol:      { id: 'sol',      gradient: 'g_sol',      swatch: '#5b4d40' },
  dalle:    { id: 'dalle',    gradient: 'g_dalle',    swatch: '#8d8a86' },
  pave:     { id: 'pave',     gradient: 'g_pave',     swatch: '#7c7a82' },
  plancher: { id: 'plancher', gradient: 'g_plancher', swatch: '#7a5a30' },
  eau:      { id: 'eau',      gradient: 'g_eau',      swatch: '#2f5a8a' },
  mur:      { id: 'mur',      gradient: 'g_sol',      swatch: '#9b8e72' },
  porte:    { id: 'porte',    gradient: 'g_porte',    swatch: '#7a5a3a' },
};
export const FALLBACK_GRADIENT = 'g_grass';
export function terrainGradient(id: string): string {
  return TERRAIN_VIZ[id]?.gradient ?? FALLBACK_GRADIENT;
}
```

- [ ] **Step 2: Ajouter les 3 nouveaux gradients à `DEFS`**

Dans `src/gameIso/sprites.ts`, ajouter à la chaîne `DEFS` (avant la fermeture backtick) — bloc exact à coller :

```ts
  <linearGradient id="g_terre" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7a5f3c"/><stop offset="100%" stop-color="#57452b"/></linearGradient>
  <linearGradient id="g_dalle" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a7a39d"/><stop offset="100%" stop-color="#7c7872"/></linearGradient>
  <linearGradient id="g_pave"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8f8d96"/><stop offset="100%" stop-color="#63616b"/></linearGradient>
```

- [ ] **Step 3: Brancher `TILE_GRAD` sur le catalogue**

Dans `sprites.ts`, remplacer la constante `TILE_GRAD` (et ses usages internes) par un ré-export du catalogue, pour ne pas casser les imports existants :

```ts
import { terrainGradient } from './catalog/terrain';
// … supprimer l'ancien TILE_GRAD: Record<Terrain,string>
export { terrainGradient };
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: erreurs sur les usages de `TILE_GRAD[t]` dans `IsoStage.tsx`/`Editor.tsx` → seront corrigées en Task 5. Pour l'instant, vérifier que `sprites.ts` et `catalog/terrain.ts` compilent isolément (les erreurs restantes ne concernent que les 2 consommateurs).

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/catalog/terrain.ts src/gameIso/sprites.ts
git commit -m "feat(gameIso): catalogue visuel terrain + gradients pave/terre/dalle"
```

---

### Task 4: Logique de raccord d'arêtes (`edgeBlends`, pur) + `groundTile`

**Files:**
- Create: `src/gameIso/ground.ts`
- Test: `src/gameIso/ground.test.ts`

Les 4 voisins de grille correspondent aux 4 arêtes du losange. Convention de direction :
`E = (x+1,y)`, `S = (x,y+1)`, `O = (x-1,y)`, `N = (x,y-1)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/gameIso/ground.test.ts
import { describe, it, expect } from 'vitest';
import { edgeBlends } from './ground';
import { emptyScene } from '../state/scene';

describe('edgeBlends (raccord d arêtes)', () => {
  it('un voisin de priorité plus haute déborde ; plus basse n est pas listé', () => {
    const s = emptyScene(3, 3);          // tout herbe (priority 1)
    s.tiles[1 * 3 + 1] = 'herbe';        // centre = herbe
    s.tiles[1 * 3 + 2] = 'pave';         // E (x=2,y=1) = pave (priority 5)
    const blends = edgeBlends(s, 1, 1);
    expect(blends).toContainEqual({ dir: 'E', terrain: 'pave' });
    // un voisin herbe (même priorité) ne déborde pas
    expect(blends.find((b) => b.terrain === 'herbe')).toBeUndefined();
  });
  it('aucun débordement si tous voisins ≤ priorité du centre', () => {
    const s = emptyScene(3, 3);
    s.tiles[1 * 3 + 1] = 'pave';          // centre = pave (haute)
    const blends = edgeBlends(s, 1, 1);   // voisins herbe (basse)
    expect(blends).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/gameIso/ground.test.ts`
Expected: FAIL — `Cannot find module './ground'`.

- [ ] **Step 3: Implement**

```ts
// src/gameIso/ground.ts
import { Scene, tileAt } from '../state/scene';
import { terrainPriority } from '../state/terrain';
import { terrainGradient } from './catalog/terrain';
import { Dims, tileCenter, diamondPath, TW, TH } from './iso';

export type EdgeDir = 'N' | 'E' | 'S' | 'O';
const NEIGHBOURS: Record<EdgeDir, [number, number]> = {
  N: [0, -1], E: [1, 0], S: [0, 1], O: [-1, 0],
};

export interface EdgeBlend { dir: EdgeDir; terrain: string; }

/** Voisins de plus haute précédence qui « débordent » sur la tuile (x,y). */
export function edgeBlends(scene: Scene, x: number, y: number): EdgeBlend[] {
  const self = terrainPriority(tileAt(scene, x, y));
  const out: EdgeBlend[] = [];
  for (const dir of ['N', 'E', 'S', 'O'] as EdgeDir[]) {
    const [dx, dy] = NEIGHBOURS[dir];
    const nt = tileAt(scene, x + dx, y + dy);
    if (terrainPriority(nt) > self) out.push({ dir, terrain: nt });
  }
  return out;
}

/** SVG d'une tuile de sol : losange de base + wedges de transition. */
export function groundTile(scene: Scene, x: number, y: number, dims: Dims): string {
  const base = `<path d="${diamondPath(x, y, dims)}" fill="url(#${terrainGradient(tileAt(scene, x, y))})" stroke="rgba(0,0,0,0.16)"/>`;
  const { cx, cy } = tileCenter(x, y, dims);
  // 4 sommets du losange
  const top = [cx, cy - TH / 2], right = [cx + TW / 2, cy], bot = [cx, cy + TH / 2], left = [cx - TW / 2, cy];
  // arête partagée par direction (paire de sommets), repliée vers le centre à 40%
  const EDGE: Record<EdgeDir, number[][]> = {
    N: [top, right], E: [right, bot], S: [bot, left], O: [left, top],
  };
  const wedges = edgeBlends(scene, x, y).map(({ dir, terrain }) => {
    const [a, b] = EDGE[dir];
    const ia = [a[0] + (cx - a[0]) * 0.4, a[1] + (cy - a[1]) * 0.4];
    const ib = [b[0] + (cx - b[0]) * 0.4, b[1] + (cy - b[1]) * 0.4];
    const d = `M${a[0]},${a[1]} L${b[0]},${b[1]} L${ib[0]},${ib[1]} L${ia[0]},${ia[1]} Z`;
    return `<path d="${d}" fill="url(#${terrainGradient(terrain)})" opacity="0.7"/>`;
  }).join('');
  return base + wedges;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/gameIso/ground.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/ground.ts src/gameIso/ground.test.ts
git commit -m "feat(gameIso): raccord d aretes (edgeBlends pur + groundTile SVG)"
```

---

### Task 5: Brancher la couche sol (jeu + éditeur) + recette Playwright

**Files:**
- Modify: `src/gameIso/IsoStage.tsx:78-85` (boucle `floor`)
- Modify: `src/ui/editor/Editor.tsx:326-335` (couche sol)

- [ ] **Step 1: IsoStage — utiliser `groundTile`**

Dans `IsoStage.tsx`, remplacer la boucle `floor` :

```tsx
import { groundTile } from './ground';
// …
const floor: JSX.Element[] = [];
for (let y = 0; y < dims.h; y++)
  for (let x = 0; x < dims.w; x++)
    floor.push(<g key={`f${x}-${y}`} dangerouslySetInnerHTML={{ __html: groundTile(scene, x, y, dims) }} />);
```

Supprimer l'import devenu inutile `TILE_GRAD` ; garder `diamondPath` (utilisé ailleurs).

- [ ] **Step 2: Editor — même branchement**

Dans `Editor.tsx`, remplacer la fonction qui pousse les `els` de sol (lignes ~326-335) par :

```tsx
import { groundTile } from '../../gameIso/ground';
// …
{(() => {
  const els: JSX.Element[] = [];
  for (let y = 0; y < dims.h; y++)
    for (let x = 0; x < dims.w; x++)
      els.push(<g key={`f${x}-${y}`} dangerouslySetInnerHTML={{ __html: groundTile(scene, x, y, dims) }} />);
  return els;
})()}
```

- [ ] **Step 3: Palette éditeur depuis le catalogue terrain**

Dans `Editor.tsx`, remplacer la constante `TERRAINS` locale (ligne 12) et la palette (lignes ~200-212) pour itérer le registre :

```tsx
import { TERRAINS as TERRAIN_META } from '../../state/terrain';
import { TERRAIN_VIZ } from '../../gameIso/catalog/terrain';
// …
const TERRAIN_IDS = Object.keys(TERRAIN_META);
// dans le JSX palette :
{TERRAIN_IDS.map((t) => (
  <button
    key={t}
    className={`terrain-swatch ${tool.mode === 'tile' && tool.terrain === t ? 'active' : ''}`}
    style={{ background: TERRAIN_VIZ[t]?.swatch ?? '#888' }}
    onClick={() => setTool({ mode: 'tile', terrain: t })}
    title={TERRAIN_META[t].label}
  >
    {TERRAIN_META[t].label}
  </button>
))}
```

Supprimer l'import `TERRAIN_COLORS` de `../../game/palette` s'il n'est plus utilisé.

- [ ] **Step 4: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: typecheck OK, toute la suite verte.

- [ ] **Step 5: Recette Playwright (validation visuelle)**

Run: `npm run dev` (laisser tourner). Avec Playwright MCP :
1. `browser_navigate` http://localhost:5173/
2. Aller dans l'éditeur, peindre `pave` adjacent à `herbe`, vérifier le fondu d'arête.
3. Vérifier que la palette liste `pave/terre/dalle` (lus du catalogue).
4. `browser_console_messages` → 0 erreur.
5. `browser_take_screenshot` (raccord visible).

Expected: fondu visible, palette complète, console propre.

- [ ] **Step 6: Commit**

```bash
git add src/gameIso/IsoStage.tsx src/ui/editor/Editor.tsx
git commit -m "feat(editeur): couche sol via groundTile + palette terrain data-driven"
```

---

## PHASE 2 — Bâtiments + décors + cutaway

### Task 6: Schéma `BuildingFeature` + `Scene.buildings`

**Files:**
- Modify: `src/state/scene.ts` (interfaces + `emptyScene` ~144-158)

- [ ] **Step 1: Ajouter les types**

Dans `scene.ts`, après `SceneEntity`, ajouter :

```ts
export interface BuildingParams {
  floors?: number;
  roofMaterial?: 'tuile' | 'chaume' | 'ardoise';
  timberColor?: string;
  wallColor?: string;
  variant?: number;
}
export interface BuildingFeature {
  id: string;
  type: string;                 // id de catalogue
  foot: { x: number; y: number; w: number; h: number };
  facing?: Facing;
  reveal: 'cutaway' | 'door';
  door?: { x: number; y: number };
  interiorScene?: string;
  entry?: string;
  params?: BuildingParams;
  label?: string;
}
```

Dans l'interface `Scene`, ajouter `buildings?: BuildingFeature[];`.
Dans `emptyScene`, ajouter `buildings: [],` à l'objet retourné.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: OK (champ optionnel, rien ne casse).

- [ ] **Step 3: Commit**

```bash
git add src/state/scene.ts
git commit -m "feat(state): schema BuildingFeature + Scene.buildings"
```

---

### Task 7: Registre bâtiments pur + helpers (empreinte, porte, cutaway)

**Files:**
- Create: `src/state/buildings.ts`
- Test: `src/state/buildings.test.ts`
- Modify: `src/state/scene.ts` (`isWalkable` consulte `buildingBlockedAt`)

- [ ] **Step 1: Write the failing test**

```ts
// src/state/buildings.test.ts
import { describe, it, expect } from 'vitest';
import { emptyScene } from './scene';
import { buildingBlockedAt, buildingAt, doorAt, roofHidden, BUILDINGS_META } from './buildings';
import type { BuildingFeature } from './scene';

const house: BuildingFeature = {
  id: 'b1', type: 'maison', foot: { x: 2, y: 2, w: 3, h: 3 },
  reveal: 'cutaway', door: { x: 3, y: 4 },
};

describe('helpers bâtiment', () => {
  it('le périmètre bloque, la porte et l intérieur cutaway non', () => {
    const s = emptyScene(8, 8); s.buildings = [house];
    expect(buildingBlockedAt(s, 2, 2)).toBe(true);   // coin (périmètre)
    expect(buildingBlockedAt(s, 3, 2)).toBe(true);   // bord haut
    expect(buildingBlockedAt(s, 3, 4)).toBe(false);  // porte
    expect(buildingBlockedAt(s, 3, 3)).toBe(false);  // intérieur cutaway → walkable
  });
  it('door reveal : intérieur bloqué', () => {
    const s = emptyScene(8, 8); s.buildings = [{ ...house, reveal: 'door' }];
    expect(buildingBlockedAt(s, 3, 3)).toBe(true);   // intérieur door → bloqué
    expect(buildingBlockedAt(s, 3, 4)).toBe(false);  // porte reste franchissable
  });
  it('buildingAt / doorAt', () => {
    const s = emptyScene(8, 8); s.buildings = [house];
    expect(buildingAt(s, 3, 3)?.id).toBe('b1');
    expect(buildingAt(s, 0, 0)).toBeUndefined();
    expect(doorAt(s, 3, 4)?.id).toBe('b1');
    expect(doorAt(s, 3, 3)).toBeUndefined();
  });
  it('roofHidden si un allié est dans l empreinte', () => {
    expect(roofHidden(house, [{ x: 3, y: 3 }])).toBe(true);
    expect(roofHidden(house, [{ x: 0, y: 0 }])).toBe(false);
  });
  it('catalogue meta contient maison + chapelle', () => {
    expect(BUILDINGS_META.maison).toBeDefined();
    expect(BUILDINGS_META.chapelle.category).toBe('monument');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/state/buildings.test.ts`
Expected: FAIL — module manquant.

- [ ] **Step 3: Implement**

```ts
// src/state/buildings.ts
/** Registre PUR des bâtiments + helpers (sémantique : empreinte, porte, cutaway). */
import type { Scene, BuildingFeature } from './scene';

export interface BuildingMeta {
  id: string;
  label: string;
  category: 'petit' | 'monument';
  defaultFoot: { w: number; h: number };
  defaultReveal: 'cutaway' | 'door';
}

export const BUILDINGS_META: Record<string, BuildingMeta> = {
  maison:   { id: 'maison',   label: 'Maison à colombages', category: 'petit',    defaultFoot: { w: 3, h: 3 }, defaultReveal: 'cutaway' },
  echoppe:  { id: 'echoppe',  label: 'Échoppe',             category: 'petit',    defaultFoot: { w: 2, h: 2 }, defaultReveal: 'cutaway' },
  taverne:  { id: 'taverne',  label: 'Taverne',             category: 'petit',    defaultFoot: { w: 4, h: 3 }, defaultReveal: 'cutaway' },
  forge:    { id: 'forge',    label: 'Forge',               category: 'petit',    defaultFoot: { w: 3, h: 2 }, defaultReveal: 'cutaway' },
  chapelle: { id: 'chapelle', label: 'Chapelle',            category: 'monument', defaultFoot: { w: 4, h: 5 }, defaultReveal: 'door' },
  tour:     { id: 'tour',     label: 'Tour',                category: 'monument', defaultFoot: { w: 2, h: 2 }, defaultReveal: 'door' },
  manoir:   { id: 'manoir',   label: 'Manoir',              category: 'monument', defaultFoot: { w: 5, h: 4 }, defaultReveal: 'door' },
};

function inFoot(b: BuildingFeature, x: number, y: number): boolean {
  return x >= b.foot.x && x < b.foot.x + b.foot.w && y >= b.foot.y && y < b.foot.y + b.foot.h;
}
function isPerimeter(b: BuildingFeature, x: number, y: number): boolean {
  return x === b.foot.x || x === b.foot.x + b.foot.w - 1 || y === b.foot.y || y === b.foot.y + b.foot.h - 1;
}
function isDoor(b: BuildingFeature, x: number, y: number): boolean {
  return !!b.door && b.door.x === x && b.door.y === y;
}

export function buildingAt(scene: Scene, x: number, y: number): BuildingFeature | undefined {
  return (scene.buildings ?? []).find((b) => inFoot(b, x, y));
}
export function doorAt(scene: Scene, x: number, y: number): BuildingFeature | undefined {
  return (scene.buildings ?? []).find((b) => isDoor(b, x, y));
}
/** Une tuile est-elle bloquée par un bâtiment ? */
export function buildingBlockedAt(scene: Scene, x: number, y: number): boolean {
  for (const b of scene.buildings ?? []) {
    if (!inFoot(b, x, y)) continue;
    if (isDoor(b, x, y)) return false;            // la porte est toujours franchissable
    if (isPerimeter(b, x, y)) return true;        // murs périmétriques
    if (b.reveal === 'door') return true;          // intérieur inaccessible (transition only)
    return false;                                  // intérieur cutaway → walkable
  }
  return false;
}
/** Le toit doit-il être masqué (cutaway) ? */
export function roofHidden(b: BuildingFeature, allies: { x: number; y: number }[]): boolean {
  if (b.reveal !== 'cutaway') return false;
  return allies.some((a) => inFoot(b, a.x, a.y));
}
```

- [ ] **Step 4: Brancher dans `isWalkable`**

Dans `scene.ts`, modifier `isWalkable` :

```ts
import { terrainWalkable } from './terrain';
import { buildingBlockedAt } from './buildings';

export function isWalkable(scene: Scene, x: number, y: number): boolean {
  if (buildingBlockedAt(scene, x, y)) return false;
  return terrainWalkable(tileAt(scene, x, y));
}
```

> NOTE: `buildings.ts` importe des **types** de `scene.ts` (`import type`) et `scene.ts` importe une **fonction** de `buildings.ts`. L'import `type` évite le cycle de valeur. Vérifier au typecheck.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/state/buildings.test.ts && npm run typecheck`
Expected: 6 tests PASS, typecheck OK.

- [ ] **Step 6: Commit**

```bash
git add src/state/buildings.ts src/state/buildings.test.ts src/state/scene.ts
git commit -m "feat(state): registre batiments pur + walkability empreinte/porte/cutaway"
```

---

### Task 8: Types de catalogue visuel (`catalog/types.ts`)

**Files:**
- Create: `src/gameIso/catalog/types.ts`

- [ ] **Step 1: Implement**

```ts
// src/gameIso/catalog/types.ts
import type { Dims } from '../iso';
import type { BuildingParams } from '../../state/scene';

export type ParamField =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'color' };

export interface RenderCtx { dims: Dims; }
export type Rect = { x: number; y: number; w: number; h: number };

/** 3 calques distincts → permet de masquer le toit seul (cutaway). */
export interface BuildingLayers { walls: string; interior: string; roof: string; }

export interface BuildingViz {
  id: string;
  paramsSchema?: ParamField[];
  render(foot: Rect, params: BuildingParams, ctx: RenderCtx): BuildingLayers;
}

export interface PropViz {
  id: string;
  label: string;
  paramsSchema?: ParamField[];
  render(params: Record<string, unknown>, ctx: RenderCtx): string;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: OK.

```bash
git add src/gameIso/catalog/types.ts
git commit -m "feat(gameIso): types de catalogue (ParamField, BuildingViz, PropViz)"
```

---

### Task 9: Catalogue bâtiments — squelette + générateur `colombage` + fallback

**Files:**
- Create: `src/gameIso/catalog/buildings.ts`
- Test: `src/gameIso/catalog/buildings.test.ts`

Helper de projection : l'empreinte `foot` se projette via `tileCenter` des 4 coins. Le « volume » du bâtiment = prisme dont la hauteur dépend de `floors`.

- [ ] **Step 1: Write the failing test (résolution + fallback + calques)**

```ts
// src/gameIso/catalog/buildings.test.ts
import { describe, it, expect } from 'vitest';
import { buildingLayers } from './buildings';

const dims = { w: 10, h: 10 };
const foot = { x: 2, y: 2, w: 3, h: 3 };

describe('catalogue bâtiments', () => {
  it('résout un type connu en 3 calques non vides', () => {
    const L = buildingLayers('maison', foot, { floors: 2 }, { dims });
    expect(L.walls.length).toBeGreaterThan(0);
    expect(L.roof.length).toBeGreaterThan(0);
  });
  it('type inconnu → fallback (ne jette pas, calques définis)', () => {
    const L = buildingLayers('zzz', foot, {}, { dims });
    expect(L.walls).toBeDefined();
    expect(typeof L.roof).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/gameIso/catalog/buildings.test.ts`
Expected: FAIL — module manquant.

- [ ] **Step 3: Implement le squelette + `colombage` + résolveur**

```ts
// src/gameIso/catalog/buildings.ts
import { tileCenter, TH } from '../iso';
import type { BuildingViz, BuildingLayers, RenderCtx, Rect } from './types';
import type { BuildingParams } from '../../state/scene';

/** Coins écran de l'empreinte (au niveau du sol). */
function footCorners(foot: Rect, ctx: RenderCtx) {
  const tl = tileCenter(foot.x, foot.y, ctx.dims);
  const tr = tileCenter(foot.x + foot.w - 1, foot.y, ctx.dims);
  const br = tileCenter(foot.x + foot.w - 1, foot.y + foot.h - 1, ctx.dims);
  const bl = tileCenter(foot.x, foot.y + foot.h - 1, ctx.dims);
  // sommets extérieurs du quadrilatère de base
  return {
    N: [tl.cx, tl.cy - TH / 2],
    E: [tr.cx + 32, tr.cy],
    S: [br.cx, br.cy + TH / 2],
    O: [bl.cx - 32, bl.cy],
  };
}

/** Générateur paramétrique « maison à colombages ». */
const colombage: BuildingViz['render'] = (foot, params, ctx) => {
  const c = footCorners(foot, ctx);
  const floors = params.floors ?? 2;
  const H = 46 * floors;                 // hauteur de mur
  const timber = params.timberColor ?? '#4a3220';
  const wallC = params.wallColor ?? '#d8c9a8';
  const up = (p: number[], h: number) => `${p[0]},${p[1] - h}`;

  // murs gauche (O→S) et droit (E→S) en élévation
  const walls =
    `<path d="M${c.O} L${c.S} L${up(c.S, H)} L${up(c.O, H)} Z" fill="${wallC}" stroke="${timber}" stroke-width="2"/>` +
    `<path d="M${c.S} L${c.E} L${up(c.E, H)} L${up(c.S, H)} Z" fill="${wallC}" stroke="${timber}" stroke-width="2" opacity="0.92"/>` +
    // poutres de colombage (croix)
    `<path d="M${up(c.O, H * 0.5)} L${up(c.S, H * 0.5)} M${up(c.S, H * 0.5)} L${up(c.E, H * 0.5)}" stroke="${timber}" stroke-width="3" opacity="0.7"/>`;

  // intérieur (plancher) visible au cutaway : losange du sol assombri
  const interior =
    `<path d="M${c.N} L${c.E} L${c.S} L${c.O} Z" fill="#3a2c1e" opacity="0.9"/>`;

  // toit : prisme au-dessus de H, faîte au milieu N–S
  const ridge = (h: number) => [ (c.N[0] + c.S[0]) / 2, (c.N[1] + c.S[1]) / 2 - h ];
  const r = ridge(H + 34);
  const roof =
    `<path d="M${up(c.O, H)} L${up(c.N, H)} L${r} Z" fill="#7a2d22"/>` +
    `<path d="M${up(c.N, H)} L${up(c.E, H)} L${r} Z" fill="#5e221a"/>` +
    `<path d="M${up(c.O, H)} L${up(c.S, H)} L${r} Z" fill="#6a271e"/>` +
    `<path d="M${up(c.S, H)} L${up(c.E, H)} L${r} Z" fill="#511d16"/>`;

  return { walls, interior, roof };
};

export const BUILDINGS: Record<string, BuildingViz> = {
  maison: { id: 'maison', paramsSchema: [
    { key: 'floors', label: 'Étages', type: 'number', min: 1, max: 3, step: 1 },
    { key: 'roofMaterial', label: 'Toit', type: 'select', options: [
      { value: 'tuile', label: 'Tuiles' }, { value: 'chaume', label: 'Chaume' }, { value: 'ardoise', label: 'Ardoise' } ] },
    { key: 'timberColor', label: 'Colombage', type: 'color' },
    { key: 'wallColor', label: 'Torchis', type: 'color' },
  ], render: colombage },
};

const FALLBACK: BuildingLayers = { walls: '', interior: '', roof: '' };

export function buildingLayers(type: string, foot: Rect, params: BuildingParams, ctx: RenderCtx): BuildingLayers {
  const viz = BUILDINGS[type];
  if (!viz) return colombage(foot, params, ctx); // fallback = maison générique
  return viz.render(foot, params, ctx);
}
export type BuildingId = keyof typeof BUILDINGS;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/gameIso/catalog/buildings.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/catalog/buildings.ts src/gameIso/catalog/buildings.test.ts
git commit -m "feat(gameIso): catalogue batiments + generateur colombage + fallback"
```

---

### Task 10: Générateurs restants (taverne, forge, echoppe, chapelle, tour, manoir)

**Files:**
- Modify: `src/gameIso/catalog/buildings.ts` (ajouter 6 entrées)

> Chaque entrée suit le **même contrat** (`render(foot,params,ctx) → {walls,interior,roof}`) et réutilise `footCorners`/`up`. Réglages visuels distincts : `taverne` = colombage large + enseigne (`<g class="sway">`), `forge` = murs pierre + cheminée fumante (`<g class="smoke">`), `echoppe` = petit + auvent, `chapelle` = nef haute + toit raide + clocheton, `tour` = cylindre + créneaux, `manoir` = 2 corps + toit d'ardoise.

- [ ] **Step 1: Ajouter `taverne` (variante de colombage + enseigne)**

```ts
const taverne: BuildingViz['render'] = (foot, params, ctx) =>
  ({ ...colombage(foot, { ...params, floors: params.floors ?? 2 }, ctx),
     // l'enseigne est ajoutée aux murs
   });
// puis dans BUILDINGS :
taverne: { id: 'taverne', paramsSchema: BUILDINGS.maison.paramsSchema, render: taverne },
```

> NOTE: réutiliser `paramsSchema` de `maison` est volontaire (DRY). Pour les bâtiments avec params spécifiques (chapelle/tour), définir leur propre schéma.

- [ ] **Step 2: Ajouter `forge`, `echoppe`** (mêmes coins, hauteurs/couleurs différentes — pierre `#8a8378`, auvent). Implémenter en suivant la structure de `colombage` (3 calques).

- [ ] **Step 3: Ajouter `chapelle`, `tour`, `manoir`** (monuments — `roof` plus imposant ; `interior` peut rester vide car `reveal:'door'` ne révèle pas l'intérieur).

```ts
// dans BUILDINGS, chaque monument :
chapelle: { id: 'chapelle', render: chapelle },
tour:     { id: 'tour',     render: tour },
manoir:   { id: 'manoir',   render: manoir },
```

- [ ] **Step 4: Test de couverture du catalogue**

Ajouter à `buildings.test.ts` :

```ts
import { BUILDINGS } from './buildings';
it('tous les types meta ont un render', () => {
  for (const id of ['maison','echoppe','taverne','forge','chapelle','tour','manoir'])
    expect(BUILDINGS[id], id).toBeDefined();
});
```

Run: `npm test -- src/gameIso/catalog/buildings.test.ts`
Expected: PASS.

- [ ] **Step 5: QC visuel via gen-gallery (optionnel) + Commit**

```bash
git add src/gameIso/catalog/buildings.ts src/gameIso/catalog/buildings.test.ts
git commit -m "feat(gameIso): generateurs taverne/forge/echoppe/chapelle/tour/manoir"
```

---

### Task 11: Catalogue décors + refactor `propSprite`

**Files:**
- Create: `src/gameIso/catalog/decor.ts`
- Test: `src/gameIso/catalog/decor.test.ts`
- Modify: `src/gameIso/sprites.ts` (`propSprite`)

- [ ] **Step 1: Write the failing test**

```ts
// src/gameIso/catalog/decor.test.ts
import { describe, it, expect } from 'vitest';
import { PROPS, propSvg } from './decor';

describe('catalogue décors', () => {
  it('contient les placeables de base', () => {
    for (const id of ['tonneau','caisse','charrette','puits','fontaine','etal-marche','statue','lampadaire','panneau','cloture','tas-foin','feu-camp','arbre'])
      expect(PROPS[id], id).toBeDefined();
  });
  it('id inconnu → fallback (tonneau), pas d exception', () => {
    expect(propSvg('zzz').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/gameIso/catalog/decor.test.ts`
Expected: FAIL — module manquant.

- [ ] **Step 3: Implement** (réutiliser les sprites existants `crate/barrel` de `sprites.ts` et ajouter les nouveaux ; chaque `render` renvoie un SVG en boîte locale 120×150 pieds en (60,150), comme les autres sprites)

```ts
// src/gameIso/catalog/decor.ts
import type { PropViz } from './types';

const tonneau = () => `<g><ellipse cx="60" cy="146" rx="22" ry="8" fill="#3a2a18"/><path d="M40 110 Q60 104 80 110 L78 144 Q60 150 42 144 Z" fill="#6a4a2a"/><path d="M40 122 h40 M40 134 h40" stroke="#2a1c10" stroke-width="3"/><ellipse cx="60" cy="110" rx="20" ry="7" fill="#7a5a32"/></g>`;
const caisse  = () => `<g><path d="M30 150 L30 110 L60 96 L90 110 L90 150 L60 164 Z" fill="#7a5a32"/><path d="M30 110 L60 124 L90 110 L60 96 Z" fill="#8a6a3c"/><path d="M60 124 L60 164 M30 110 L30 150 M90 110 L90 150" stroke="#3a2a18" stroke-width="2"/></g>`;
const puits   = () => `<g><ellipse cx="60" cy="140" rx="30" ry="14" fill="#5a5550"/><ellipse cx="60" cy="136" rx="24" ry="10" fill="#2a2622"/><rect x="34" y="60" width="6" height="80" fill="#4a3220"/><rect x="80" y="60" width="6" height="80" fill="#4a3220"/><path d="M28 62 L60 40 L92 62 Z" fill="#7a2d22"/></g>`;
// … fontaine, charrette, etal-marche, statue, lampadaire, panneau, cloture, tas-foin, feu-camp, arbre
// (chacun ≈ 1 ligne SVG dans le style ci-dessus ; feu-camp porte class="warm" pour le flicker)

export const PROPS: Record<string, PropViz> = {
  tonneau:       { id: 'tonneau',       label: 'Tonneau',     render: tonneau },
  caisse:        { id: 'caisse',        label: 'Caisse',      render: caisse },
  puits:         { id: 'puits',         label: 'Puits',       render: puits },
  // … les autres entrées ici (même forme) …
};
export function propSvg(ref: string): string {
  return (PROPS[ref] ?? PROPS.tonneau).render({}, { dims: { w: 0, h: 0 } });
}
```

> NOTE implémentation : compléter les 13 entrées listées dans le test. `arbre` peut envelopper le `tree()` existant adapté en boîte locale.

- [ ] **Step 4: Brancher `propSprite` sur le catalogue**

Dans `sprites.ts`, remplacer `propSprite` :

```ts
import { propSvg } from './catalog/decor';
export function propSprite(ref?: string): string {
  return propSvg(ref ?? 'tonneau');
}
```

Mettre à jour les appelants : `IsoStage.tsx` et `Editor.tsx` passent `ent.ref` à `propSprite`.

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- src/gameIso/catalog/decor.test.ts && npm run typecheck`
Expected: PASS, typecheck OK.

- [ ] **Step 6: Commit**

```bash
git add src/gameIso/catalog/decor.ts src/gameIso/catalog/decor.test.ts src/gameIso/sprites.ts src/gameIso/IsoStage.tsx src/ui/editor/Editor.tsx
git commit -m "feat(gameIso): catalogue decors (placeables) + propSprite data-driven"
```

---

### Task 12: Animations ambiantes (`anim.css`)

**Files:**
- Create: `src/gameIso/anim.css`
- Modify: `src/gameIso/IsoStage.tsx` (import du css)

- [ ] **Step 1: Porter les keyframes d'`ambush.html`**

```css
/* src/gameIso/anim.css — keyframes partagées (cf. public/ambush.html) */
.breathe{animation:breathe 3s ease-in-out infinite}
.warm{animation:flicker 3.6s ease-in-out infinite}
.glow{animation:glow 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.sway{animation:sway 2.8s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 0}
.smoke{animation:smoke 4s linear infinite;transform-box:fill-box}
@keyframes breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.035)}}
@keyframes flicker{0%,100%{opacity:.85}40%{opacity:1}65%{opacity:.7}}
@keyframes glow{0%,100%{transform:scale(.8);opacity:.6}50%{transform:scale(1.35);opacity:1}}
@keyframes sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes smoke{0%{opacity:.5;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-40px) scale(1.6)}}
```

- [ ] **Step 2: Importer dans IsoStage**

En tête de `IsoStage.tsx` : `import './anim.css';`

- [ ] **Step 3: Vérifier (dev) + Commit**

Run: `npm run dev` → vérifier en console 0 erreur.

```bash
git add src/gameIso/anim.css src/gameIso/IsoStage.tsx
git commit -m "feat(gameIso): keyframes d ambiance partagees (anim.css)"
```

---

### Task 13: Rendu bâtiments + cutaway dans IsoStage

**Files:**
- Modify: `src/gameIso/IsoStage.tsx` (couche objets ~106-148)

- [ ] **Step 1: Ajouter les bâtiments à la liste d'objets triés**

Dans `IsoStage.tsx`, après la boucle décor statique (murs/arbres), ajouter :

```tsx
import { buildingLayers } from './catalog/buildings';
import { roofHidden } from '../state/buildings';
// …
// allié(s) pour le cutaway : en exploration = partyPos ; en combat = héros vivants
const allies = mode === 'battle' && battle
  ? battle.combatants.filter((c) => c.kind === 'hero' && c.pos).map((c) => c.pos!)
  : [partyPos];

for (const b of scene.buildings ?? []) {
  const L = buildingLayers(b.type, b.foot, b.params ?? {}, { dims });
  // profondeur de tri = coin avant de l'empreinte
  const d = depth(b.foot.x + b.foot.w - 1, b.foot.y + b.foot.h - 1);
  const hideRoof = roofHidden(b, allies);
  objs.push({ d, el: (
    <g key={`b-${b.id}`}>
      <g dangerouslySetInnerHTML={{ __html: L.interior }} />
      <g dangerouslySetInnerHTML={{ __html: L.walls }} />
      <g style={{ transition: 'opacity 0.25s' }} opacity={hideRoof ? 0 : 1}
         dangerouslySetInnerHTML={{ __html: L.roof }} />
    </g>
  ) });
}
```

- [ ] **Step 2: Faire de même dans l'éditeur (WYSIWYG)**

Dans `Editor.tsx`, dans la boucle objets, ajouter le même rendu des `scene.buildings` (sans cutaway — toit toujours visible dans l'éditeur, ou cutaway désactivé). Réutiliser `buildingLayers`.

- [ ] **Step 3: Typecheck + recette Playwright**

Run: `npm run typecheck`. Puis avec un JSON de scène contenant un `buildings:[{maison…}]` (créer un fixture de test dans l'éditeur) :
1. `npm run dev`, charger la scène.
2. Vérifier le bâtiment opaque avec toit.
3. Déplacer le groupe dans l'empreinte → le toit se fond (cutaway), intérieur visible.
4. `browser_console_messages` → 0 erreur ; screenshot.

Expected: cutaway fonctionnel, tri de profondeur correct.

- [ ] **Step 4: Commit**

```bash
git add src/gameIso/IsoStage.tsx src/ui/editor/Editor.tsx
git commit -m "feat(jeu): rendu batiments multi-tuiles + cutaway (toit togglable)"
```

---

### Task 14: Transition par tuile-porte

**Files:**
- Modify: `src/state/store.ts` (`moveParty` ~182-189)
- Test: `src/state/store.test.ts` (ajouter un cas)

- [ ] **Step 1: Write the failing test**

```ts
// ajout dans src/state/store.test.ts
import { doorAt } from './buildings';
// … dans un describe approprié :
it('marcher sur une tuile-porte (reveal door) déclenche une transition', () => {
  // monter un store minimal avec 2 scènes enregistrées (A avec bâtiment door→B)
  // déplacer le groupe sur la porte, attendre que la scène courante devienne B.
  // (suivre le patron des tests de transition existants dans ce fichier)
});
```

> NOTE: adapter au harnais de `store.test.ts` existant (regarder comment il enregistre les scènes et appelle `moveParty`/`transitionTo`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/state/store.test.ts`
Expected: FAIL (transition non déclenchée).

- [ ] **Step 3: Implement — hook dans `moveParty`**

```ts
import { doorAt } from './buildings';
// …
moveParty: (pt) => {
  const { scene, mode } = get();
  if (!scene || mode !== 'exploration') return;
  if (!isWalkable(scene, pt.x, pt.y)) return;
  set({ partyPos: pt });
  bus.emit(EVT.SCENE_DIRTY);
  const door = doorAt(scene, pt.x, pt.y);
  if (door && door.reveal === 'door' && door.interiorScene) {
    get().transitionTo(door.interiorScene, door.entry);
    return;
  }
  checkTriggers(get, set);
},
```

- [ ] **Step 4: Run test + typecheck**

Run: `npm test -- src/state/store.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(jeu): porte de batiment (reveal door) -> transition vers interieur"
```

---

## PHASE 3 — Éditeur générique piloté par catalogue

### Task 15: Composant générique `ParamFields`

**Files:**
- Create: `src/ui/editor/ParamFields.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/ui/editor/ParamFields.tsx
import { ParamField } from '../../gameIso/catalog/types';

export function ParamFields({ schema, values, onChange }: {
  schema: ParamField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <>
      {schema.map((f) => (
        <label className="ed-field" key={f.key}>
          {f.label}
          {f.type === 'number' && (
            <input type="number" min={f.min} max={f.max} step={f.step ?? 1}
              value={Number(values[f.key] ?? f.min ?? 0)}
              onChange={(e) => onChange(f.key, Number(e.target.value))} />
          )}
          {f.type === 'select' && (
            <select value={String(values[f.key] ?? f.options[0]?.value)}
              onChange={(e) => onChange(f.key, e.target.value)}>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {f.type === 'color' && (
            <input type="color" value={String(values[f.key] ?? '#888888')}
              onChange={(e) => onChange(f.key, e.target.value)} />
          )}
        </label>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Typecheck + Commit**

Run: `npm run typecheck`

```bash
git add src/ui/editor/ParamFields.tsx
git commit -m "feat(editeur): ParamFields generique (slider/select/couleur depuis paramsSchema)"
```

---

### Task 16: Palette éditeur — section Bâtiments + Décors (depuis catalogues)

**Files:**
- Modify: `src/ui/editor/Editor.tsx` (type `Tool`, palette onglet Carte)

- [ ] **Step 1: Étendre le type `Tool`**

```tsx
type Tool =
  | { mode: 'tile'; terrain: string }
  | { mode: 'entity'; kind: EntityKind }
  | { mode: 'building'; type: string }
  | { mode: 'erase' }
  | { mode: 'trigger' };
```

- [ ] **Step 2: Ajouter les sections Bâtiments & Décors dans l'onglet Carte**

```tsx
import { BUILDINGS_META } from '../../state/buildings';
import { PROPS } from '../../gameIso/catalog/decor';
// …
<div className="mini-title">Bâtiments</div>
<div className="entity-tools">
  {Object.values(BUILDINGS_META).map((b) => (
    <button key={b.id}
      className={`btn small ${tool.mode === 'building' && tool.type === b.id ? 'btn-primary' : ''}`}
      onClick={() => setTool({ mode: 'building', type: b.id })}
      title={`${b.label} (${b.category})`}>
      {b.label}
    </button>
  ))}
</div>
```

> Les décors se placent via l'entité `prop` existante : on garde le bouton `Décor` (kind `prop`) et on choisit le `ref` dans l'inspecteur (Task 17, via un `<select>` sur `Object.keys(PROPS)`).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: erreurs attendues là où `applyAt` ne gère pas encore `mode:'building'` → corrigées en Task 17.

- [ ] **Step 4: Commit**

```bash
git add src/ui/editor/Editor.tsx
git commit -m "feat(editeur): palette batiments + outil building (depuis catalogue)"
```

---

### Task 17: Pose de bâtiment (drag-empreinte) + inspecteur

**Files:**
- Modify: `src/ui/editor/Editor.tsx` (handlers pointer, `applyAt`, inspecteur)

- [ ] **Step 1: Pose par drag (réutiliser le drag-rect des triggers)**

Dans les handlers `onPointerDown/Move/Up`, traiter `tool.mode === 'building'` comme le mode `trigger` (drag d'un rectangle), mais au `Up` créer une `BuildingFeature` :

```tsx
function addBuilding(rect: Rect) {
  const meta = BUILDINGS_META[(tool as any).type];
  const b: BuildingFeature = {
    id: `b-${Date.now().toString(36)}`,
    type: meta.id,
    foot: rect,
    reveal: meta.defaultReveal,
    door: { x: rect.x + Math.floor(rect.w / 2), y: rect.y + rect.h - 1 },
    params: {},
    label: meta.label,
  };
  setScene({ ...scene, buildings: [...(scene.buildings ?? []), b] });
  setSelectedBuilding(b.id);
}
```

Ajouter un état `selectedBuilding` (string|null) parallèle à `selected`.

- [ ] **Step 2: Inspecteur bâtiment**

Quand un bâtiment est sélectionné, afficher : type (lecture seule), empreinte, `facing`, bascule `reveal` (cutaway/door), sélecteur de tuile-porte (parmi les tuiles de bord), `interiorScene` (`<select>` des scènes de campagne — réutiliser le registre `campaign`), libellé, params via `<ParamFields schema={BUILDINGS[b.type].paramsSchema ?? []} values={b.params ?? {}} onChange={…}/>`, et un bouton Supprimer.

```tsx
import { ParamFields } from './ParamFields';
import { BUILDINGS } from '../../gameIso/catalog/buildings';
// onChange param :
const updateBuildingParam = (key: string, value: unknown) =>
  setScene({ ...scene, buildings: (scene.buildings ?? []).map((b) =>
    b.id === selectedBuilding ? { ...b, params: { ...b.params, [key]: value } } : b) });
```

- [ ] **Step 3: Inspecteur décor (prop) — choix du `ref`**

Quand l'entité sélectionnée est `kind === 'prop'`, ajouter un `<select>` :

```tsx
{sel.kind === 'prop' && (
  <label className="ed-field">Décor
    <select value={sel.ref ?? 'tonneau'} onChange={(e) => updateSel({ ref: e.target.value })}>
      {Object.values(PROPS).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  </label>
)}
```

- [ ] **Step 4: Typecheck + recette Playwright**

Run: `npm run typecheck`. Puis dev :
1. Choisir « Maison », drag sur la carte → bâtiment posé.
2. Inspecteur : changer étages/matériau/couleurs → rendu mis à jour live.
3. Basculer `reveal=door`, choisir `interiorScene` → tester en jeu (▶ Tester) : la porte transitionne.
4. Placer un décor, changer son `ref` → sprite mis à jour.
5. Console 0 erreur ; screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/ui/editor/Editor.tsx
git commit -m "feat(editeur): pose batiment par drag + inspecteur (params, reveal, porte, decor ref)"
```

---

### Task 18: Recette end-to-end + nettoyage

**Files:**
- Modify: (selon résidus) `src/game/palette.ts` (si `TERRAIN_COLORS` orphelin)

- [ ] **Step 1: Vérifier extensibilité (le critère d'acceptation clé)**

Ajouter temporairement une entrée `grange` dans `BUILDINGS_META` **et** `BUILDINGS` (render = `colombage`). Vérifier qu'elle apparaît dans la palette éditeur **sans toucher au code de l'éditeur**. Retirer ensuite si non désirée.

- [ ] **Step 2: Suite complète**

Run: `npm run typecheck && npm test`
Expected: tout vert.

- [ ] **Step 3: Recette Playwright complète**

Dérouler : peindre sols (raccord) → poser maison cutaway → poser chapelle door+interiorScene → poser décors → ▶ Tester → entrer dans la maison (cutaway), franchir la porte de la chapelle (transition). Console 0 erreur ; screenshots.

- [ ] **Step 4: Nettoyage des orphelins**

Run: `grep -rn "TERRAIN_COLORS\|TILE_GRAD\|WALKABLE\|barrel\|crate" src/`
Supprimer le code mort confirmé.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore(editeur): recette e2e tilesets/batiments + nettoyage code mort"
```

---

## Self-Review — couverture spec

- §5.1 Sols + précédence → Tasks 1–4. ✅
- §5.2 Bâtiments (schéma, meta pur, helpers, viz) → Tasks 6–10. ✅
- §5.3 Décors → Task 11. ✅
- §5.4 ParamField → Tasks 8, 15. ✅
- §4 Catalogues scindés + fallback → Tasks 1/3 (terrain), 7/9 (bâtiment), 11 (décor). ✅
- §6 Phase 1 (sol+raccord) → Tasks 1–5 ; Phase 2 (bâtiments/décors/cutaway) → Tasks 6–14 ; Phase 3 (éditeur) → Tasks 15–18. ✅
- §7 Rétro-compat (`Terrain=string`, `buildings?`) → Tasks 2, 6. ✅
- §8 Tests purs Vitest + recette Playwright → Tasks 1,2,4,7,9,11,14 (unit) ; 5,13,17,18 (Playwright). ✅
- §2 Occlusion combinée (cutaway + door) → Tasks 7 (roofHidden/blocked), 13 (cutaway), 14 (door). ✅

**Cohérence des noms vérifiée** : `terrainWalkable`/`terrainPriority`, `terrainGradient`, `edgeBlends`/`groundTile`, `buildingBlockedAt`/`buildingAt`/`doorAt`/`roofHidden`, `BUILDINGS_META` (pur) vs `BUILDINGS` (viz) + `buildingLayers`, `PROPS`/`propSvg`/`propSprite`, `ParamFields`. Pas de divergence inter-tâches.

**Zones laissées à l'auteur (art procédural)** : le détail SVG exact des générateurs Task 10 et des 13 décors Task 11 est guidé par les exemplaires complets (`colombage`, `tonneau/caisse/puits`) + le contrat 3-calques ; à peaufiner visuellement en recette (c'est de l'art, pas de la logique — validé en Playwright, pas en unit test, conformément au CLAUDE.md).
