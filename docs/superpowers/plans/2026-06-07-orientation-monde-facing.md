# Orientation-monde persistante + consolidation tokens — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux personnages une orientation en espace-monde persistante (8 directions), projetée au rendu en fonction de la rotation caméra, puis consolider la couche de tokens et supprimer le legacy mort.

**Architecture:** L'orientation devient une donnée monde (`Dir8`) stockée dans le store (live) + `SceneEntity.facing` (authored). Le rendu est une **pure projection** `project(dir, camRot) → {view, mirror}` recalculée à chaque rendu — tourner la caméra ré-oriente tout le monde gratuitement. Les tokens lisent l'orientation du store au lieu de la dériver d'événements bus éphémères. Enfin une coquille `BodyToken` absorbe la triplication facing/miroir/positionnement/bus/mort.

**Tech Stack:** Vite + TypeScript + React, Zustand (store), Vitest (tests moteur/purs), rendu SVG isométrique.

**Spec:** `docs/superpowers/specs/2026-06-07-orientation-monde-facing-design.md`

---

## Carte des fichiers

| Fichier | Rôle | Phase |
|---|---|---|
| `src/gameIso/rig/facing.ts` | + `Dir8`, `DIR8_DELTA`, `project()`, `facingToward()` (gardent `View`/`facingView`/`screenDir`) | P1 |
| `src/gameIso/rig/facing.test.ts` | tests purs : 32 cas `project`, `facingToward` | P1 |
| `src/state/scene.ts` | `SceneEntity.facing` retypé `Facing`→`Dir8` | P0 |
| `src/state/store.ts` | table `facing: Record<string,Dir8>` + actions `setFacing`/`faceFromPath`/`faceToward`/`faceAtCombatStart` | P1/P2 |
| `src/gameIso/RigToken.tsx` | lit `store.facing[id]` + `camRot`, projette ; supprime `useState`/`face` facing | P1 |
| `src/gameIso/AnimatedPlanToken.tsx` | idem | P1 |
| `src/gameIso/AnimatedRigToken.tsx` / `AmbientRigToken.tsx` | passent `facing?: Dir8` (authored) à RigToken | P1/P2 |
| `src/gameIso/IsoStage.tsx` | **supprime** branche monolithique morte + effets `creatureFx`/`creatureFacing` + import mort | P0 |
| `src/gameIso/sprites.ts` | **supprime** `hasCreatureViews` | P0 |
| `src/state/combatFlow.ts` | écrit l'orientation (attaque/IA/frappé) | P2 |
| `src/state/spawn.ts` ou flux init combat | orientation au spawn (vers ennemi) | P2 |
| `src/gameIso/BodyToken.tsx` (créé) | coquille unifiée + interface backend | P3 |
| `src/ui/editor/Editor.tsx` | sélecteur « Orientation » entité (Dir8) | P4 |
| `Foundry/Game/CLAUDE.md` | retire la note périmée « code Phaser src/game/ » | P0 |

---

## Phase 0 — Nettoyage legacy (zéro changement de comportement)

### Task 0.1 : Supprimer la branche de rendu monolithique morte + ses effets dans IsoStage

**Files:**
- Modify: `src/gameIso/IsoStage.tsx` (import `:41` ; effets `:172-214` ; branche dispatch `~:424-429` ; param `mirror` de `token()` `~:347,364`)

Contexte : `bodyPlanOf(name)` ne renvoie **jamais** `'monolithic'` (les 51 defs ont un plan). Donc la branche `else` monolithique en combat est inatteignable, et les effets `creatureFx` + `creatureFacing` qui l'alimentent sont morts.

- [ ] **Step 1 : Vérifier que la branche est bien morte (preuve avant suppression)**

Run: `cd "C:/Users/gauch/PhpstormProjects/Foundry/Game" && rg -n "plan:\s*['\"]monolithic['\"]" src/gameIso/rig/creatures/defs`
Expected: aucun résultat (0 def monolithique → branche inatteignable).

- [ ] **Step 2 : Supprimer l'effet `creatureFx` (IsoStage.tsx:171-190)**

Supprimer le bloc commentaire + `const [creatureFx, setCreatureFx] = …` + son `useEffect` complet (lignes ~171-190, le bloc « Anim légère des créatures monolithiques »).

- [ ] **Step 3 : Supprimer l'effet `creatureFacing` (IsoStage.tsx:192-214)**

Supprimer le bloc commentaire « Facing 8-dir des créatures monolithiques » + `const [creatureFacing, setCreatureFacing] = …` + son `useEffect` complet (lignes ~192-214).

- [ ] **Step 4 : Supprimer l'import mort + la branche dispatch + le param `mirror` de `token()`**

Dans l'import `:41`, retirer `import { facingView, screenDir } from './rig/facing';` (devenu inutile).
Dans l'import sprites `:25-33`, retirer `creatureView` (et `hasCreatureViews` s'il y figure).
Dans le dispatch combat (`~:424-429`), supprimer la branche `else` monolithique (`creatureView(...)` + lecture `creatureFacing[c.id]` + `creatureFx[c.id]`). Après suppression de la branche (b) plan vs (c) monolithique : la garde `else if (bodyPlanOf(c.name) !== 'monolithic')` devient un simple `else` (tout non-rig non-monolithique passe par `AnimatedPlanToken`).
Dans le helper `token()` (`~:347-369`), retirer le param `mirror` et le `transform={mirror ? 'translate(160,0) scale(-1,1)' : undefined}` (jamais truthy après suppression).

- [ ] **Step 5 : Typecheck + tests**

Run: `cd "C:/Users/gauch/PhpstormProjects/Foundry/Game" && npm run typecheck`
Expected: 0 erreur (si une référence résiduelle à `creatureView`/`creatureFacing`/`creatureFx` subsiste, le typecheck la signale → la retirer).
Run: `npm test`
Expected: suite verte.

- [ ] **Step 6 : Commit**

```bash
git add src/gameIso/IsoStage.tsx
git commit -m "refactor(iso): supprime le chemin de rendu monolithique mort (effets creatureFx/creatureFacing + branche inatteignable)"
```

### Task 0.2 : Supprimer `hasCreatureViews` (0 appelant)

**Files:**
- Modify: `src/gameIso/sprites.ts` (`:128-130`)
- Test: `src/gameIso/creatureView.test.ts` (vérifier qu'il ne teste pas `hasCreatureViews` ; sinon retirer ce cas)

> Décision actée : on **garde** `creatureView` + `creatureViews.json` (outillage QC `_qc-*`/`_ref-*`/`_ingest-*`). On ne retire QUE `hasCreatureViews`, qui n'a aucun appelant applicatif.

- [ ] **Step 1 : Confirmer 0 appelant**

Run: `cd "C:/Users/gauch/PhpstormProjects/Foundry/Game" && rg -n "hasCreatureViews" src scripts`
Expected: seulement la définition (`sprites.ts`) et éventuellement `creatureView.test.ts`.

- [ ] **Step 2 : Supprimer la fonction `hasCreatureViews` dans `sprites.ts:128-130`**

- [ ] **Step 3 : Si `creatureView.test.ts` testait `hasCreatureViews`, retirer ce `it(...)`** (garder les tests de `creatureView`).

- [ ] **Step 4 : Tests + typecheck**

Run: `npm run typecheck && npm test`
Expected: verts.

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/sprites.ts src/gameIso/creatureView.test.ts
git commit -m "refactor(sprites): supprime hasCreatureViews (0 appelant)"
```

### Task 0.3 : Retyper `SceneEntity.facing` en `Dir8` + corriger la doc périmée

**Files:**
- Modify: `src/state/scene.ts` (`:17` type `Facing`, `:91` champ `SceneEntity.facing`)
- Modify: `Foundry/Game/CLAUDE.md` (note « code Phaser src/game/ »)

> `Facing` (4-dir) reste défini et utilisé par `BuildingFeature.facing` (`:129`). On introduit `Dir8` et on bascule **uniquement** `SceneEntity.facing` dessus.

- [ ] **Step 1 : Ajouter `Dir8` dans `scene.ts` (juste sous `Facing`, ligne ~17)**

```ts
export type Facing = 'N' | 'S' | 'E' | 'O';
/** Orientation MONDE d'une entité (8 directions grille). Projetée au rendu via project(). */
export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';
```

- [ ] **Step 2 : Retyper `SceneEntity.facing` (scene.ts:91)**

```ts
  facing?: Dir8;
```

- [ ] **Step 3 : Retirer la note Phaser périmée de `Foundry/Game/CLAUDE.md`**

Supprimer la phrase « (PAS Phaser — le code Phaser sous `src/game/` est obsolète, conservé mais non utilisé) » (le dossier `src/game/` n'existe plus). Garder « Rendu isométrique en SVG React ».

- [ ] **Step 4 : Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: verts (aucun lecteur de `SceneEntity.facing` → le retypage ne casse rien).

- [ ] **Step 5 : Commit**

```bash
git add src/state/scene.ts CLAUDE.md
git commit -m "refactor(scene): SceneEntity.facing -> Dir8 (8 dir monde) + doc Phaser perimee retiree"
```

---

## Phase 1 — Modèle facing-monde + projection pure

### Task 1.1 : `project()` + `facingToward()` dans `facing.ts` (TDD)

**Files:**
- Modify: `src/gameIso/rig/facing.ts`
- Test: `src/gameIso/rig/facing.test.ts`

Dérivation : `rotTile(p+d) − rotTile(p)` est linéaire en `d` (les offsets `W-1`,`H-1` s'annulent). Delta tourné par `camRot` :
`rot0 (gx,gy)` · `rot1 (gy,−gx)` · `rot2 (−gx,−gy)` · `rot3 (−gy,gx)`. Puis skew iso `sdx=rgx−rgy`, `sdy=rgx+rgy`, puis `facingView`.

- [ ] **Step 1 : Écrire les tests qui échouent — `facing.test.ts`**

Ajouter au fichier de test (créer s'il n'existe pas) :

```ts
import { describe, it, expect } from 'vitest';
import { project, facingToward, type Dir8 } from './facing';

const DIRS: Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

describe('facingToward', () => {
  it('cardinaux + diagonaux + nul', () => {
    expect(facingToward({ x: 2, y: 2 }, { x: 2, y: 0 })).toBe('N'); // -y
    expect(facingToward({ x: 2, y: 2 }, { x: 4, y: 2 })).toBe('E'); // +x
    expect(facingToward({ x: 2, y: 2 }, { x: 2, y: 5 })).toBe('S'); // +y
    expect(facingToward({ x: 2, y: 2 }, { x: 0, y: 2 })).toBe('O'); // -x
    expect(facingToward({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe('SE'); // +x+y
    expect(facingToward({ x: 3, y: 3 }, { x: 0, y: 0 })).toBe('NO'); // -x-y
    expect(facingToward({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe('S'); // nul → défaut S
  });
});

describe('project: 8 dirs x 4 rotations = 32 cas', () => {
  // rot0 : E (+x) → screen (sdx=1,sdy=1) bas-droite = front,!mirror ; O → front,mirror ;
  //        N (-y) → screen (1,-1) haut-droite = back,!mirror ; S → back? non : (−1,1) → front,mirror.
  // On épingle les 32 sorties exactes calculées par la même géométrie.
  const EXP: Record<Dir8, Array<{ view: string; mirror: boolean }>> = {
    // [rot0, rot1, rot2, rot3]
    E:  [{view:'front',mirror:false},{view:'back',mirror:false},{view:'back',mirror:true},{view:'front',mirror:true}],
    O:  [{view:'back',mirror:true},{view:'front',mirror:true},{view:'front',mirror:false},{view:'back',mirror:false}],
    N:  [{view:'back',mirror:false},{view:'back',mirror:true},{view:'front',mirror:true},{view:'front',mirror:false}],
    S:  [{view:'front',mirror:true},{view:'front',mirror:false},{view:'back',mirror:false},{view:'back',mirror:true}],
    NE: [{view:'profile',mirror:false},{view:'back',mirror:true},{view:'profile',mirror:true},{view:'front',mirror:false}],
    SE: [{view:'front',mirror:false},{view:'profile',mirror:false},{view:'back',mirror:true},{view:'profile',mirror:true}],
    SO: [{view:'profile',mirror:true},{view:'front',mirror:true},{view:'profile',mirror:false},{view:'back',mirror:false}],
    NO: [{view:'back',mirror:false},{view:'profile',mirror:true},{view:'front',mirror:true},{view:'profile',mirror:false}],
  };
  for (const d of DIRS) {
    for (let rot = 0 as 0|1|2|3; rot < 4; rot = (rot + 1) as 0|1|2|3) {
      it(`${d} @rot${rot}`, () => {
        expect(project(d, rot)).toEqual(EXP[d][rot]);
      });
    }
  }
});
```

> Note exécution : les valeurs `EXP` ci-dessus sont la cible géométrique attendue. Au 1er run d'implémentation, si une cellule diverge, **recalculer la cellule à la main** avec la formule (delta→rotDelta→skew→facingView) et corriger le test (pas l'inverse) — c'est le test qui fige la géométrie ; la recette navigateur (Task 2.x) tranche un éventuel miroir gauche/droite global.

- [ ] **Step 2 : Lancer le test → échec (project/facingToward indéfinis)**

Run: `cd "C:/Users/gauch/PhpstormProjects/Foundry/Game" && npx vitest run src/gameIso/rig/facing.test.ts`
Expected: FAIL (`project is not a function`).

- [ ] **Step 3 : Implémenter dans `facing.ts`**

Ajouter en tête l'import du type `Rot` et le `Dir8` (réexporté depuis scene pour usage local), puis :

```ts
import { rotTile, type Dims, type Rot } from '../iso';
export type { Dir8 } from '../../state/scene';
import type { Dir8 } from '../../state/scene';

/** Dir8 (monde) → delta grille unitaire. */
export const DIR8_DELTA: Record<Dir8, { gx: number; gy: number }> = {
  N:  { gx: 0, gy: -1 }, NE: { gx: 1, gy: -1 }, E: { gx: 1, gy: 0 }, SE: { gx: 1, gy: 1 },
  S:  { gx: 0, gy: 1 },  SO: { gx: -1, gy: 1 }, O: { gx: -1, gy: 0 }, NO: { gx: -1, gy: -1 },
};

/** Rotation d'un delta grille par le cran caméra (partie linéaire de rotTile). PUR. */
function rotDelta(gx: number, gy: number, rot: Rot): { gx: number; gy: number } {
  switch (rot) {
    case 1: return { gx: gy, gy: -gx };
    case 2: return { gx: -gx, gy: -gy };
    case 3: return { gx: -gy, gy: gx };
    default: return { gx, gy };
  }
}

/** Orientation MONDE + cran caméra → vue + miroir. PUR. (corrige la rotation caméra) */
export function project(dir: Dir8, camRot: Rot): { view: View; mirror: boolean } {
  const d = DIR8_DELTA[dir];
  const r = rotDelta(d.gx, d.gy, camRot);
  return facingView(r.gx - r.gy, r.gx + r.gy);
}

/** Delta grille (to−from) → Dir8 la plus proche (défaut 'S' si nul). PUR. */
export function facingToward(from: { x: number; y: number }, to: { x: number; y: number }): Dir8 {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (dx === 0 && dy === 0) return 'S';
  const key = `${dx},${dy}`;
  const M: Record<string, Dir8> = {
    '0,-1': 'N', '1,-1': 'NE', '1,0': 'E', '1,1': 'SE',
    '0,1': 'S', '-1,1': 'SO', '-1,0': 'O', '-1,-1': 'NO',
  };
  return M[key];
}
```

- [ ] **Step 4 : Lancer le test → vert (corriger les cellules EXP divergentes par recalcul main si besoin)**

Run: `npx vitest run src/gameIso/rig/facing.test.ts`
Expected: PASS (32 + 1). En cas de divergence d'une cellule, recalculer à la main et ajuster `EXP`.

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/rig/facing.ts src/gameIso/rig/facing.test.ts
git commit -m "feat(facing): project(dir,camRot) + facingToward() purs + 32 cas de projection"
```

### Task 1.2 : Table d'orientation `facing` dans le store + actions

**Files:**
- Modify: `src/state/store.ts` (état près de `camRot:253` ; actions près de `rotateCam:440-441`)

- [ ] **Step 1 : Ajouter l'état `facing` (sous `camRot`)**

```ts
  /** Orientation MONDE vivante par entité/combattant (Dir8). Sérialisée avec l'état. */
  facing: {} as Record<string, import('./scene').Dir8>,
```

- [ ] **Step 2 : Ajouter les actions (près de `rotateCam`)**

```ts
  setFacing(id: string, dir: import('./scene').Dir8) {
    set((s) => ({ facing: { ...s.facing, [id]: dir } }));
  },
  faceToward(id: string, from?: { x: number; y: number }, to?: { x: number; y: number }) {
    if (!from || !to) return;
    const dir = facingToward(from, to);
    set((s) => ({ facing: { ...s.facing, [id]: dir } }));
  },
  faceFromPath(id: string, path?: { x: number; y: number }[]) {
    if (!path || path.length < 2) return;
    get().faceToward(id, path[0], path[path.length - 1]);
  },
```

(Importer `facingToward` depuis `../gameIso/rig/facing` en tête de `store.ts`.)

- [ ] **Step 3 : Typecheck**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/state/store.ts
git commit -m "feat(store): table facing (Dir8 monde) + actions setFacing/faceToward/faceFromPath"
```

### Task 1.3 : `RigToken` lit l'orientation du store (suppr. du facing éphémère)

**Files:**
- Modify: `src/gameIso/RigToken.tsx`

- [ ] **Step 1 : Remplacer le `useState` facing + la closure `face` par une lecture store projetée**

- Imports : remplacer `import { facingView, screenDir, type View } from './rig/facing';` par `import { project, type View } from './rig/facing'; import type { Dir8 } from '../state/scene';`.
- Signature : ajouter un prop `facing?: Dir8` (orientation authored, fallback).
- Supprimer `const [facing, setFacing] = useState(...)` (`:49`).
- Dans le `useEffect` : supprimer entièrement la closure `face` (`:64-71`) et les deux appels `face(...)` (`:74-75` et `:97-98`). Le reste des handlers (clips attaque/parade/esquive/hit/walk + timer) **reste**. Retirer `play`/`playClip`/`holdClip` inchangés.
- Avant le rendu, dériver la vue :

```ts
  const camRot = useGame((s) => s.camRot);
  const worldDir = useGame((s) => s.facing[id]) ?? facing;
  const fv = worldDir ? project(worldDir, camRot) : { view: 'front' as View, mirror: false };
```

- Remplacer `facing.mirror`/`facing.view` au rendu (`:119-120`) par `fv.mirror`/`fv.view`.

- [ ] **Step 2 : Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: verts (le test `AnimatedRigToken.test.tsx` reste structurel).

- [ ] **Step 3 : Commit**

```bash
git add src/gameIso/RigToken.tsx
git commit -m "refactor(RigToken): orientation lue du store + projetee (camRot), suppr. facing ephemere"
```

### Task 1.4 : `AnimatedPlanToken` lit l'orientation du store

**Files:**
- Modify: `src/gameIso/AnimatedPlanToken.tsx`

- [ ] **Step 1 : Même bascule que RigToken**

- Imports : `import { project, type View } from './rig/facing';` (retirer `facingView, screenDir`).
- Supprimer `const [facing, setFacing] = useState(...)` (`:22`), la closure `face` (`:33-39`) et ses appels (`:55`, `:62`). Le `getState().battle.combatants` du handler d'attaque (`:61`) n'est plus nécessaire → réduire le handler à `if (d.from !== id) return; modeRef.current = { kind:'attack', start: performance.now() }; ensureLoop();`.
- Dériver avant rendu :

```ts
  const camRot = useGame((s) => s.camRot);
  const worldDir = useGame((s) => s.facing[id]);
  const fv = worldDir ? project(worldDir, camRot) : { view: 'front' as View, mirror: false };
```

- Au rendu (`:82-83`) : `plan.resolve(species, fv.view, pose, { colors })` et `transform={fv.mirror ? 'translate(120,0) scale(-1,1)' : undefined}`.

- [ ] **Step 2 : Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: verts.

- [ ] **Step 3 : Commit**

```bash
git add src/gameIso/AnimatedPlanToken.tsx
git commit -m "refactor(AnimatedPlanToken): orientation lue du store + projetee (camRot)"
```

### Task 1.5 : Écrire l'orientation aux déplacements + attaques (combat)

**Files:**
- Modify: `src/state/store.ts` (héros move `~:1005-1006`, charge `~:1044`)
- Modify: `src/state/combatFlow.ts` (IA move `~:1205-1206`, attaque `~:554`, sorts `~:936/:982`)

> Lire chaque site juste avant l'émission `ANIM_MOVE`/`ANIM_ATTACK` et insérer l'écriture d'orientation **dans la même mutation pré-émission** (cf. spec §5 + piège setState/relecture).

- [ ] **Step 1 : Héros move (store.ts) — avant `bus.emit(EVT.ANIM_MOVE, {id, path})`**

Insérer `get().faceFromPath(id, path);` (id = combattant actif, path = chemin émis). Idem pour la charge (`~:1044`).

- [ ] **Step 2 : IA move (combatFlow.ts ~:1206) — avant l'émission `ANIM_MOVE`**

Insérer `useGame.getState().faceFromPath(enemy.id, path);` (selon le nom local du chemin/ennemi à ce site).

- [ ] **Step 3 : Attaque (combatFlow.ts ~:554) — avant `bus.emit(EVT.ANIM_ATTACK, …)`**

Insérer `useGame.getState().faceToward(attacker.id, attacker.pos, target.pos);` (l'attaquant se tourne vers la cible ; noms locaux à confirmer à la lecture). Idem aux 2 sites de sort (`~:936`, `~:982`).

- [ ] **Step 4 : Recette manuelle ciblée (navigateur) — déplacement/attaque + rotation**

Run: `npm run dev` puis charger un scénario de test combat. Vérifier : un héros qui bouge se tourne dans la direction de marche ; à l'attaque l'attaquant fait face à la cible ; **Q/E** (rotation caméra) → l'orientation reste cohérente (le perso garde sa cible). 0 erreur console.

- [ ] **Step 5 : Commit**

```bash
git add src/state/store.ts src/state/combatFlow.ts
git commit -m "feat(facing): ecrit l'orientation monde au deplacement et a l'attaque (heros + IA)"
```

---

## Phase 2 — Comportements au repos

### Task 2.1 : Orientation au spawn / début de combat (face à l'ennemi)

**Files:**
- Modify: `src/state/store.ts` (ajouter `faceAtCombatStart`)
- Modify: site d'initialisation du combat (là où `battle` est posé / `order` calculé — à localiser via `rg "startCombat|battle ="`)

- [ ] **Step 1 : Ajouter `faceAtCombatStart()` dans le store**

```ts
  faceAtCombatStart() {
    const b = get().battle; const scene = get().scene; if (!b) return;
    const next: Record<string, import('./scene').Dir8> = { ...get().facing };
    for (const c of b.combatants) {
      if (!c.pos) continue;
      // authored (entité de scène) prioritaire
      const authored = scene?.entities.find((e) => e.id === c.id)?.facing;
      if (authored) { next[c.id] = authored; continue; }
      // sinon : vers l'ennemi le plus proche (camp opposé)
      const foes = b.combatants.filter((o) => o.pos && (o.kind === 'hero') !== (c.kind === 'hero'));
      let best: typeof c | undefined; let bd = Infinity;
      for (const o of foes) {
        const d = Math.max(Math.abs(o.pos!.x - c.pos.x), Math.abs(o.pos!.y - c.pos.y));
        if (d < bd) { bd = d; best = o; }
      }
      if (best?.pos) next[c.id] = facingToward(c.pos, best.pos);
    }
    set({ facing: next });
  },
```

- [ ] **Step 2 : Appeler `faceAtCombatStart()` une fois le `battle` initialisé** (après le `set({ battle, ... })` de démarrage de combat).

- [ ] **Step 3 : Recette (navigateur)** : lancer un combat → au spawn, les ennemis et héros se font face (plus de « tous regardent la caméra »). Tourner la caméra → reste cohérent.

- [ ] **Step 4 : Commit**

```bash
git add src/state/store.ts
git commit -m "feat(facing): orientation au debut de combat (authored sinon ennemi le plus proche)"
```

### Task 2.2 : Le défenseur se tourne vers l'attaquant quand il est frappé

**Files:**
- Modify: `src/state/combatFlow.ts` (chemin d'application des dégâts / résolution d'attaque, près de l'émission `ANIM_ATTACK` `~:554`)

- [ ] **Step 1 : À la résolution d'une attaque offensive, tourner la cible vers l'attaquant**

Au même site que l'attaque (Task 1.5 step 3), ajouter : `useGame.getState().faceToward(target.id, target.pos, attacker.pos);` (le défenseur fait face à son attaquant). Ne le faire que pour une attaque offensive (pas un soin/bénédiction — cf. `isSupportiveCast`).

- [ ] **Step 2 : Recette** : un ennemi attaqué de côté/derrière se retourne vers l'attaquant.

- [ ] **Step 3 : Commit**

```bash
git add src/state/combatFlow.ts
git commit -m "feat(facing): le defenseur se tourne vers l'attaquant (frappe offensive)"
```

### Task 2.3 : Orientation en exploration (`moveParty`) + entités d'ambiance

**Files:**
- Modify: `src/state/store.ts` (`moveParty` `~:683-696`)
- Modify: `src/gameIso/AmbientRigToken.tsx` + `AnimatedRigToken.tsx` (passer `facing` authored)

- [ ] **Step 1 : `moveParty` écrit l'orientation du groupe (direction de marche)**

Dans `moveParty`, après calcul du déplacement, `get().faceFromPath('__party', path)` (ou l'id de token de groupe utilisé par le rendu — à confirmer à la lecture ; le leader est rendu sous `__party`).

- [ ] **Step 2 : `AmbientRigToken`/`AnimatedRigToken` transmettent `facing` authored**

`AmbientRigToken` reçoit l'entité de scène : passer `facing={entity.facing}` à `RigToken`. `AnimatedRigToken` (combat) : pas d'authored (le store pilote), ne rien passer.

- [ ] **Step 3 : Recette** : le groupe se tourne en marchant (exploration) ; une entité d'ambiance avec `facing` authored est orientée et reste cohérente à la rotation caméra.

- [ ] **Step 4 : Commit**

```bash
git add src/state/store.ts src/gameIso/AmbientRigToken.tsx src/gameIso/AnimatedRigToken.tsx
git commit -m "feat(facing): orientation en exploration (moveParty) + entites d'ambiance (authored)"
```

---

## Phase 3 — Consolidation `BodyToken`

> Refactor de structure (pas de changement de comportement). Objectif : une coquille unique portant positionnement + facing + miroir + câblage bus + mort ; backends `rig`/`plan` ne fournissent que les pixels. Dé-risqué par les tests P1 et le backend monolithique déjà supprimé.

### Task 3.1 : Extraire le wrapper de positionnement partagé

**Files:**
- Create: `src/gameIso/BodyToken.tsx`
- Modify: `src/gameIso/IsoStage.tsx` (`token()`/`tokenNode()` `~:347-385`), `EntityToken.tsx`

- [ ] **Step 1 : Lire** `IsoStage.tsx:340-465` (token/tokenNode/dispatch) + `EntityToken.tsx` en entier + `sprites.ts:16-20` (`placeSprite`) pour figer la signature exacte du wrapper (ombre + ring + translate(cx,feetY) + box scale + dim + death tilt + bakedDeath).

- [ ] **Step 2 : Créer `BodyToken` (coquille)** portant : `cx,cy`, `scale`, `ring?`, `dim?`, `mirror`, `boxWidth` (120 rig/plan), `dead`/`bakedDeath`, et `children` (les pixels du backend). Centralise l'ombre, le `translate`, la box `translate(-60s,-150s) scale(s)`, le miroir paramétré par `boxWidth`, la bascule de mort.

- [ ] **Step 3 : Router `tokenNode()` et `EntityToken` à travers `BodyToken`** (supprimer leurs wrappers dupliqués). `token()` (string) peut rester pour les sprites string non-React, ou être ré-exprimé via `placeSprite`.

- [ ] **Step 4 : Typecheck + tests + recette visuelle** (rendu identique avant/après — comparer un screenshot combat + exploration + éditeur).

- [ ] **Step 5 : Commit** `refactor(iso): coquille BodyToken (positionnement/ombre/miroir/mort partages)`.

### Task 3.2 : Interface `BodyBackend` + dispatch unique `pickBackend`

**Files:**
- Modify: `src/gameIso/BodyToken.tsx`, `IsoStage.tsx` (dispatch combat `~:404-430` + exploration `~:432-465`), `src/ui/editor/Editor.tsx` (`:737,:762,:1051`)

- [ ] **Step 1 : Définir `BodyBackend`** : `{ kind:'rig'|'plan'; boxWidth; render(view, mirror, animState, ctx): ReactNode }` (rig ⇒ `RigSprite`+clips ; plan ⇒ `plan.resolve`+sampler, **avec mode rest statique** pour exploration/éditeur).

- [ ] **Step 2 : `pickBackend(entityOrCombatant)`** encapsulant `isHero / enemyRigProfile / entityRigProfile / bodyPlanOf` → `{ backend, props, scale }`.

- [ ] **Step 3 : Brancher les 2 sites IsoStage + l'éditeur** sur `pickBackend → <BodyToken>` ; router les non-bipèdes d'exploration par le backend plan (fin de l'asymétrie statique) ; **absorber `EntityToken`** (le supprimer une fois l'éditeur basculé).

- [ ] **Step 4 : Câblage bus une fois dans la coquille** (souscription `ANIM_*` filtrée par id → interface d'animation backend). Vérifier qu'aucune animation ne régresse (lunge/parade/esquive/hit/walk/idle).

- [ ] **Step 5 : Typecheck + tests + recette complète** (combat, exploration, éditeur).

- [ ] **Step 6 : Commit** `refactor(iso): BodyBackend + pickBackend unifie (rig/plan), EntityToken absorbe`.

---

## Phase 4 — Éditeur : sélecteur d'orientation entité

**Files:**
- Modify: `src/ui/editor/Editor.tsx` (inspecteur entité `~:1035-1212` ; modèle du sélecteur bâtiment `~:959-972`)

### Task 4.1 : Contrôle « Orientation » (Dir8) dans l'inspecteur d'entité

- [ ] **Step 1 : Lire** `Editor.tsx:959-972` (sélecteur orientation bâtiment) pour copier le motif `<select>` + mise à jour d'état.

- [ ] **Step 2 : Ajouter un `<select>` « Orientation »** dans l'inspecteur d'entité (`personnage`/`objet`/`prop`) listant les 8 `Dir8` (N, NE, E, SE, S, SO, O, NO), valeur `selEntity.facing ?? 'S'`, écrivant `entity.facing` via l'updater d'entité existant.

- [ ] **Step 3 : Recette** : poser une entité, choisir « Orientation = E », tester la scène → l'entité regarde l'Est (et reste cohérente à la rotation caméra). Le spawn combat respecte l'authored (Task 2.1).

- [ ] **Step 4 : Commit** `feat(editor): selecteur d'orientation (Dir8) pour les entites`.

---

## Self-review (couverture spec)

- Spec §3 (modèle `Dir8`, store + scene) → Tasks 0.3, 1.1, 1.2. ✓
- Spec §4 (projection pure + tests) → Task 1.1 (32 cas). ✓
- Spec §5 (déclencheurs move/attaque/frappé/spawn/exploration) → Tasks 1.5, 2.1, 2.2, 2.3. ✓
- Spec §6 (tokens dérivés) → Tasks 1.3, 1.4. ✓
- Spec §7 (BodyToken + backends) → Tasks 3.1, 3.2. ✓
- Spec §8 (suppression legacy) → Tasks 0.1, 0.2, 0.3. ✓
- Spec §9 (éditeur) → Task 4.1. ✓
- Spec §10 (tests + recette) → tests Task 1.1 ; recettes Tasks 1.5/2.x/3.x/4.1. ✓
- Spec §11 (phasage) → P0→P4. ✓

**Risques d'exécution** : line numbers indicatifs (lire le site avant d'éditer) ; cellules `EXP` du test à recalculer-main en cas de divergence (le test fige la géométrie, la recette tranche le miroir global) ; P3 = refactor structurel à recette visuelle avant/après.
