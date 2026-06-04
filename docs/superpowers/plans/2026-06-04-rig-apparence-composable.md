# Rig squelettique & apparence composable (sous-projet A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux personnages un sprite composé par un rig squelettique SVG, paramétré par espèce/sexe/morphologie, dont les parts (armes, bouclier, armure par emplacement) sont **résolues depuis l'équipement porté**, avec la tenue de carrière en défaut.

**Architecture:** Nouvelle couche de rendu pure `src/gameIso/rig/` (jamais importée par `src/engine`, mais lit ses *types*). Un squelette = `Record<BoneId, Bone>`. La cinématique directe (FK) compose les transforms par matrices affines. `resolveParts` choisit une part par slot selon la priorité **override éditeur > équipement > carrière > générique**. `RigSprite` (React) émet un `<g data-bone>` par os (transformable → futures animations C/postures D). Les créatures restent en `innerHTML` (inchangées) ; les héros passent toujours par le rig.

**Tech Stack:** Vite + TypeScript + React, Vitest (tests du moteur/rendu pur), Zustand (store), SVG dessiné-main. RNG seedable `makeRNG` (`src/engine/dice.ts`).

**Conventions de commit :** chaque commit termine par le trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (omis ci-dessous pour la lisibilité). L'utilisateur code en parallèle dans le même working tree → **toujours `git add` des chemins explicites**, jamais `git add -A`.

**Lire avant de commencer :** `docs/superpowers/specs/2026-06-04-rig-apparence-composable-design.md` (le spec validé).

---

## File Structure

Créés (`src/gameIso/rig/`) :
- `bones.ts` — `BoneId`, `Bone`, `Skeleton`, `Slot`, `SLOT_BONES`, `SLOT_LAYER`.
- `kinematics.ts` — `Matrix`, helpers affines, `worldTransforms`.
- `skeletons.ts` — `baseSpeciesOf`, `baseSkeleton`, `applyBuild`.
- `poses.ts` — `Pose`, `POSE_REPOS`.
- `appearance.ts` — `Appearance`, `defaultAppearance`.
- `parts/types.ts` — `Part`.
- `parts/cosmetic.ts` — `cosmeticPart` (visage/cheveux).
- `parts/generic.ts` — `genericPart` (fallback par slot).
- `parts/equipment.ts` — `EquipCtx`, `equipFromCombatant`, `weaponPart`, `shieldPart`, `armourPart`.
- `parts/career.ts` — `careerClass`, `careerTenue`.
- `parts/human.ts` — parts issues du découpage des 5 SVG héros existants.
- `parts/resolve.ts` — `resolveParts` (le résolveur de priorité).
- `composeRig.tsx` — `ResolvedBone`, `resolveRig`, `RigSprite`.
- `*.test.ts` — tests par module.

Modifiés :
- `src/engine/types.ts` — `Combatant.appearance?: Appearance`.
- `src/gameIso/sprites.ts` — suppression des fonctions héros JS ; ré-export rig si besoin.
- `src/gameIso/IsoStage.tsx` — token héros via `<RigSprite>` + variante `token()` à enfants React.
- `src/data/pregens.ts` — `appearance` par défaut sur les pré-tirés.
- `src/ui/editor/Editor.tsx` + créateur — panneau d'apparence héros.

---

## Task 1: Types du rig & registre de slots

**Files:**
- Create: `src/gameIso/rig/bones.ts`
- Test: `src/gameIso/rig/bones.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/gameIso/rig/bones.test.ts
import { describe, it, expect } from 'vitest';
import { BONE_IDS, SLOT_BONES, SLOT_LAYER, type Slot } from './bones';

describe('bones registry', () => {
  it('chaque slot pointe vers des os connus', () => {
    const known = new Set<string>(BONE_IDS);
    for (const bones of Object.values(SLOT_BONES))
      for (const b of bones) expect(known.has(b)).toBe(true);
  });

  it('chaque slot a un ordre de calque défini', () => {
    for (const slot of Object.keys(SLOT_BONES) as Slot[])
      expect(typeof SLOT_LAYER[slot]).toBe('number');
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/gameIso/rig/bones.test.ts`
Expected: FAIL — `Cannot find module './bones'`.

- [ ] **Step 3: Implémenter `bones.ts`**

```ts
// src/gameIso/rig/bones.ts
/** Os du squelette humanoïde (boîte locale 120×150, pieds en (60,150)). */
export type BoneId =
  | 'bassin' | 'torse' | 'cou' | 'tete'
  | 'epauleG' | 'avantBrasG' | 'mainG'
  | 'epauleD' | 'avantBrasD' | 'mainD'
  | 'cuisseG' | 'tibiaG' | 'piedG'
  | 'cuisseD' | 'tibiaD' | 'piedD'
  | 'arme' | 'bouclier';

export const BONE_IDS: BoneId[] = [
  'bassin', 'torse', 'cou', 'tete',
  'epauleG', 'avantBrasG', 'mainG',
  'epauleD', 'avantBrasD', 'mainD',
  'cuisseG', 'tibiaG', 'piedG',
  'cuisseD', 'tibiaD', 'piedD',
  'arme', 'bouclier',
];

export interface Bone {
  id: BoneId;
  parent: BoneId | null;
  /** attache dans le repère LOCAL du parent. */
  pivot: { x: number; y: number };
  /** longueur/épaisseur (morphologie). */
  length: number;
  thickness: number;
  /** angle au repos (degrés), surchargé par la Pose. */
  angle: number;
  /** tri inter-os (peintre) : plus grand = devant. */
  z: number;
}

export type Skeleton = Record<BoneId, Bone>;

/** Parts visuelles interchangeables. */
export type Slot =
  | 'visage' | 'cheveux'
  | 'tete' | 'bras' | 'torse' | 'jambes'
  | 'arme' | 'bouclier';

/** Os porteur(s) d'un slot. Le 2e os d'une paire (…D) est rendu en miroir. */
export const SLOT_BONES: Record<Slot, BoneId[]> = {
  visage: ['tete'], cheveux: ['tete'], tete: ['tete'],
  torse: ['torse'],
  bras: ['epauleG', 'epauleD'],
  jambes: ['cuisseG', 'cuisseD'],
  arme: ['arme'], bouclier: ['bouclier'],
};

/** Ordre de calque d'un slot À L'INTÉRIEUR d'un même os (petit = dessous). */
export const SLOT_LAYER: Record<Slot, number> = {
  jambes: 0, torse: 1, bras: 2,
  visage: 0, cheveux: 1, tete: 2,
  bouclier: 0, arme: 0,
};
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run src/gameIso/rig/bones.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/rig/bones.ts src/gameIso/rig/bones.test.ts
git commit -m "feat(rig): types d'os & registre de slots"
```

---

## Task 2: Matrices affines & cinématique directe (FK)

**Files:**
- Create: `src/gameIso/rig/kinematics.ts`
- Test: `src/gameIso/rig/kinematics.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/gameIso/rig/kinematics.test.ts
import { describe, it, expect } from 'vitest';
import { translate, rotate, mul, apply, worldTransforms } from './kinematics';
import type { Skeleton } from './bones';

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('affine', () => {
  it('translate déplace un point', () => {
    const p = apply(translate(10, 5), { x: 0, y: 0 });
    close(p.x, 10); close(p.y, 5);
  });
  it('rotate 90° envoie (1,0) sur (0,1)', () => {
    const p = apply(rotate(90), { x: 1, y: 0 });
    close(p.x, 0); close(p.y, 1);
  });
  it('mul compose dans l’ordre parent∘local', () => {
    // translate puis rotate : on tourne d'abord, puis on translate
    const m = mul(translate(10, 0), rotate(90));
    const p = apply(m, { x: 1, y: 0 });
    close(p.x, 10); close(p.y, 1);
  });
});

describe('worldTransforms', () => {
  // squelette synthétique à 2 os pour vérifier la composition.
  const sk = {
    a: { id: 'a', parent: null, pivot: { x: 10, y: 0 }, length: 0, thickness: 0, angle: 0, z: 0 },
    b: { id: 'b', parent: 'a', pivot: { x: 0, y: 5 }, length: 0, thickness: 0, angle: 90, z: 0 },
  } as unknown as Skeleton;

  it('origine d’un os enfant = transform monde composé', () => {
    const w = worldTransforms(sk, {});
    // a : translate(10,0). b : a ∘ translate(0,5) ∘ rotate(90). origine de b = (10,5).
    const ob = apply(w['b' as keyof typeof w], { x: 0, y: 0 });
    close(ob.x, 10); close(ob.y, 5);
    // un point (1,0) dans b subit rotate(90) → (0,1), puis +(10,5) = (10,6).
    const pb = apply(w['b' as keyof typeof w], { x: 1, y: 0 });
    close(pb.x, 10); close(pb.y, 6);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/gameIso/rig/kinematics.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `kinematics.ts`**

```ts
// src/gameIso/rig/kinematics.ts
import { BONE_IDS, type BoneId, type Skeleton } from './bones';
import type { Pose } from './poses';

/** Matrice affine SVG : [a,b,c,d,e,f] → x'=ax+cy+e, y'=bx+dy+f. */
export type Matrix = [number, number, number, number, number, number];

export const identity = (): Matrix => [1, 0, 0, 1, 0, 0];
export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export function rotate(deg: number): Matrix {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}
/** Compose A∘B (applique B puis A). */
export function mul(A: Matrix, B: Matrix): Matrix {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}
export function apply(m: Matrix, p: { x: number; y: number }) {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}
export const toSvg = (m: Matrix): string => `matrix(${m.map((n) => +n.toFixed(4)).join(' ')})`;

/** Transform monde de chaque os (FK, racine = os sans parent). */
export function worldTransforms(sk: Skeleton, pose: Pose): Record<BoneId, Matrix> {
  const out = {} as Record<BoneId, Matrix>;
  const world = (id: BoneId): Matrix => {
    if (out[id]) return out[id];
    const b = sk[id];
    const ang = pose[id] ?? b.angle;
    const local = mul(translate(b.pivot.x, b.pivot.y), rotate(ang));
    out[id] = b.parent ? mul(world(b.parent), local) : local;
    return out[id];
  };
  for (const id of BONE_IDS) if (sk[id]) world(id);
  return out;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run src/gameIso/rig/kinematics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/rig/kinematics.ts src/gameIso/rig/kinematics.test.ts
git commit -m "feat(rig): matrices affines + cinematique directe"
```

---

## Task 3: Squelettes (presets espèce × sexe) + morphologie

**Files:**
- Create: `src/gameIso/rig/skeletons.ts`
- Test: `src/gameIso/rig/skeletons.test.ts`

> Les nombres ci-dessous sont un **point de départ** ; l'alignement visuel fin est ajusté à la recette navigateur (Task 13). Les tests vérifient des **propriétés** (proportions distinctes, build monotone), pas des pixels.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/gameIso/rig/skeletons.test.ts
import { describe, it, expect } from 'vitest';
import { baseSpeciesOf, baseSkeleton, applyBuild } from './skeletons';

describe('baseSpeciesOf', () => {
  it('normalise les variantes régionales', () => {
    expect(baseSpeciesOf('Humains (Reiklander)')).toBe('Humain');
    expect(baseSpeciesOf('Nains (Norse)')).toBe('Nain');
    expect(baseSpeciesOf('Halflings (Cendreplaine)')).toBe('Halfling');
    expect(baseSpeciesOf('Hauts Elfes')).toBe('Haut-Elfe');
    expect(baseSpeciesOf('Elfes sylvains')).toBe('Elfe sylvain');
  });
});

describe('baseSkeleton', () => {
  it('un Nain a des jambes plus courtes qu’un Humain', () => {
    const h = baseSkeleton('Humain', 'M');
    const n = baseSkeleton('Nain', 'M');
    expect(n.cuisseG.length).toBeLessThan(h.cuisseG.length);
  });
  it('un Haut-Elfe est plus élancé (membres plus longs) qu’un Humain', () => {
    const h = baseSkeleton('Humain', 'M');
    const e = baseSkeleton('Haut-Elfe', 'M');
    expect(e.cuisseG.length).toBeGreaterThan(h.cuisseG.length);
  });
  it('M et F diffèrent en proportions sans être identiques', () => {
    const m = baseSkeleton('Humain', 'M');
    const f = baseSkeleton('Humain', 'F');
    expect(f.epauleG.pivot.x).not.toBe(m.epauleG.pivot.x);
  });
  it('espèce inconnue retombe sur Humain', () => {
    const u = baseSkeleton('Inconnu', 'M');
    const h = baseSkeleton('Humain', 'M');
    expect(u.torse.length).toBe(h.torse.length);
  });
});

describe('applyBuild', () => {
  it('build élevé épaissit le torse de façon monotone', () => {
    const sk = baseSkeleton('Humain', 'M');
    const thin = applyBuild(sk, 0).torse.thickness;
    const mid = applyBuild(sk, 0.5).torse.thickness;
    const fat = applyBuild(sk, 1).torse.thickness;
    expect(thin).toBeLessThan(mid);
    expect(mid).toBeLessThan(fat);
  });
  it('ne mute pas l’entrée', () => {
    const sk = baseSkeleton('Humain', 'M');
    const before = sk.torse.thickness;
    applyBuild(sk, 1);
    expect(sk.torse.thickness).toBe(before);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/gameIso/rig/skeletons.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `skeletons.ts`**

```ts
// src/gameIso/rig/skeletons.ts
import { BONE_IDS, type BoneId, type Bone, type Skeleton } from './bones';

/** Squelette HUMAIN mâle de référence (boîte 120×150, pieds ~y=150). Point de départ. */
const HUMAIN_M: Skeleton = mk({
  bassin:     { parent: null,        pivot: { x: 60, y: 96 }, length: 0,  thickness: 18, angle: 0,   z: 5 },
  torse:      { parent: 'bassin',    pivot: { x: 0,  y: -2 }, length: 34, thickness: 20, angle: 0,   z: 5 },
  cou:        { parent: 'torse',     pivot: { x: 0,  y: -34 }, length: 6, thickness: 6,  angle: 0,   z: 6 },
  tete:       { parent: 'cou',       pivot: { x: 0,  y: -6 }, length: 14, thickness: 14, angle: 0,   z: 7 },
  epauleG:    { parent: 'torse',     pivot: { x: -16, y: -28 }, length: 18, thickness: 7, angle: 20,  z: 4 },
  avantBrasG: { parent: 'epauleG',   pivot: { x: 0,  y: 18 }, length: 18, thickness: 6,  angle: 10,  z: 4 },
  mainG:      { parent: 'avantBrasG', pivot: { x: 0, y: 18 }, length: 6,  thickness: 6,  angle: 0,   z: 4 },
  epauleD:    { parent: 'torse',     pivot: { x: 16, y: -28 }, length: 18, thickness: 7, angle: 20,  z: 8 },
  avantBrasD: { parent: 'epauleD',   pivot: { x: 0,  y: 18 }, length: 18, thickness: 6,  angle: 10,  z: 8 },
  mainD:      { parent: 'avantBrasD', pivot: { x: 0, y: 18 }, length: 6,  thickness: 6,  angle: 0,   z: 8 },
  cuisseG:    { parent: 'bassin',    pivot: { x: -9, y: 4 }, length: 26, thickness: 9,   angle: 4,   z: 3 },
  tibiaG:     { parent: 'cuisseG',   pivot: { x: 0,  y: 26 }, length: 24, thickness: 7,  angle: 2,   z: 3 },
  piedG:      { parent: 'tibiaG',    pivot: { x: 0,  y: 24 }, length: 10, thickness: 6,  angle: 0,   z: 3 },
  cuisseD:    { parent: 'bassin',    pivot: { x: 9,  y: 4 }, length: 26, thickness: 9,   angle: 4,   z: 6 },
  tibiaD:     { parent: 'cuisseD',   pivot: { x: 0,  y: 26 }, length: 24, thickness: 7,  angle: 2,   z: 6 },
  piedD:      { parent: 'tibiaD',    pivot: { x: 0,  y: 24 }, length: 10, thickness: 6,  angle: 0,   z: 6 },
  arme:       { parent: 'mainD',     pivot: { x: 0,  y: 4 }, length: 0,  thickness: 0,   angle: 0,   z: 9 },
  bouclier:   { parent: 'mainG',     pivot: { x: 0,  y: 4 }, length: 0,  thickness: 0,   angle: 0,   z: 4 },
});

function mk(spec: Record<BoneId, Omit<Bone, 'id'>>): Skeleton {
  const sk = {} as Skeleton;
  for (const id of BONE_IDS) sk[id] = { id, ...spec[id] };
  return sk;
}

/** Échelle (longueur, épaisseur) appliquée à tout le squelette. */
function scaleSkeleton(sk: Skeleton, sl: number, st: number): Skeleton {
  const out = {} as Skeleton;
  for (const id of BONE_IDS) {
    const b = sk[id];
    out[id] = {
      ...b,
      pivot: { x: b.pivot.x * st, y: b.pivot.y * sl },
      length: b.length * sl,
      thickness: b.thickness * st,
    };
  }
  // re-pose les pieds vers le bas de la boîte (cosmétique ; ajusté en recette).
  return out;
}

/** Variantes régionales → espèce de base. */
export function baseSpeciesOf(species: string): string {
  const s = species.toLowerCase();
  if (s.startsWith('haut')) return 'Haut-Elfe';
  if (s.includes('sylvain')) return 'Elfe sylvain';
  if (s.startsWith('elf')) return 'Elfe sylvain';
  if (s.startsWith('nain')) return 'Nain';
  if (s.startsWith('halfling')) return 'Halfling';
  if (s.startsWith('gnome')) return 'Gnome';
  if (s.startsWith('ogre')) return 'Ogre';
  return 'Humain';
}

/** Facteurs (longueur globale, épaisseur globale, longueur jambes) par espèce. */
const PROPS: Record<string, { sl: number; st: number; legs: number }> = {
  Humain:         { sl: 1.0,  st: 1.0,  legs: 1.0 },
  Halfling:       { sl: 0.66, st: 1.05, legs: 0.7 },
  Nain:           { sl: 0.74, st: 1.25, legs: 0.62 },
  Gnome:          { sl: 0.5,  st: 1.0,  legs: 0.66 },
  Ogre:           { sl: 1.35, st: 1.7,  legs: 0.8 },
  'Haut-Elfe':    { sl: 1.08, st: 0.92, legs: 1.12 },
  'Elfe sylvain': { sl: 1.05, st: 0.9,  legs: 1.12 },
};

export function baseSkeleton(species: string, sex: 'M' | 'F'): Skeleton {
  const base = baseSpeciesOf(species);
  const p = PROPS[base] ?? PROPS.Humain;
  let sk = scaleSkeleton(HUMAIN_M, p.sl, p.st);
  // jambes spécifiques (Nain/Halfling courtes, Elfe longues)
  for (const id of ['cuisseG', 'tibiaG', 'cuisseD', 'tibiaD'] as BoneId[])
    sk[id] = { ...sk[id], length: sk[id].length * p.legs };
  if (sex === 'F') sk = feminize(sk);
  return sk;
}

/** Proportions féminines : épaules plus étroites, hanches un peu plus larges. */
function feminize(sk: Skeleton): Skeleton {
  const out = { ...sk };
  out.epauleG = { ...sk.epauleG, pivot: { x: sk.epauleG.pivot.x * 0.85, y: sk.epauleG.pivot.y } };
  out.epauleD = { ...sk.epauleD, pivot: { x: sk.epauleD.pivot.x * 0.85, y: sk.epauleD.pivot.y } };
  out.torse = { ...sk.torse, thickness: sk.torse.thickness * 0.92 };
  out.cuisseG = { ...sk.cuisseG, pivot: { x: sk.cuisseG.pivot.x * 1.08, y: sk.cuisseG.pivot.y } };
  out.cuisseD = { ...sk.cuisseD, pivot: { x: sk.cuisseD.pivot.x * 1.08, y: sk.cuisseD.pivot.y } };
  return out;
}

/** Morphologie continue : build 0..1 → épaississement (torse/membres). Pur. */
export function applyBuild(sk: Skeleton, build: number): Skeleton {
  const b = Math.max(0, Math.min(1, build));
  const k = 0.7 + b * 0.7; // 0.7..1.4
  const out = {} as Skeleton;
  for (const id of BONE_IDS)
    out[id] = { ...sk[id], thickness: sk[id].thickness * k, length: sk[id].length * (1 + (b - 0.5) * 0.05) };
  return out;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run src/gameIso/rig/skeletons.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/rig/skeletons.ts src/gameIso/rig/skeletons.test.ts
git commit -m "feat(rig): squelettes par espece/sexe + morphologie (build)"
```

---

## Task 4: Poses

**Files:**
- Create: `src/gameIso/rig/poses.ts`

- [ ] **Step 1: Implémenter `poses.ts` (pas de test dédié — type + constante triviale, couvert par Task 8)**

```ts
// src/gameIso/rig/poses.ts
import type { BoneId } from './bones';

/** Override d'angles d'os (degrés). Cible des animations (C) et postures (D). */
export type Pose = Partial<Record<BoneId, number>>;

/** Pose de repos : aucun override (les angles au repos du squelette s'appliquent). */
export const POSE_REPOS: Pose = {};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (0 erreur).

- [ ] **Step 3: Commit**

```bash
git add src/gameIso/rig/poses.ts
git commit -m "feat(rig): type Pose + POSE_REPOS"
```

---

## Task 5: Modèle de part + parts cosmétiques + génériques

**Files:**
- Create: `src/gameIso/rig/parts/types.ts`, `src/gameIso/rig/parts/generic.ts`, `src/gameIso/rig/parts/cosmetic.ts`
- Test: `src/gameIso/rig/parts/cosmetic.test.ts`

> Les SVG ci-dessous sont volontairement **simples** (formes lisibles, gradients partagés de `DEFS`). Ils servent de socle ; l'enrichissement est en Task 14. Chaque part est dessinée dans le **repère local de son os** : origine au pivot, l'os s'étend vers +y (`length`), épaisseur ≈ `thickness`.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/gameIso/rig/parts/cosmetic.test.ts
import { describe, it, expect } from 'vitest';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';

describe('cosmeticPart', () => {
  it('renvoie un fragment SVG non vide pour visage', () => {
    expect(cosmeticPart('visage', 'Humain', 'M', 0).svg).toContain('<');
  });
  it('cheveux varie selon l’index (déterministe)', () => {
    const a = cosmeticPart('cheveux', 'Humain', 'M', 0).svg;
    const b = cosmeticPart('cheveux', 'Humain', 'M', 1).svg;
    expect(a).not.toBe(b);
  });
  it('index hors-bornes retombe sur la 1re variante', () => {
    const a = cosmeticPart('cheveux', 'Humain', 'M', 0).svg;
    const big = cosmeticPart('cheveux', 'Humain', 'M', 999).svg;
    expect(big).toBe(a);
  });
});

describe('genericPart', () => {
  it('fournit un fallback pour chaque slot de corps', () => {
    for (const s of ['tete', 'torse', 'bras', 'jambes', 'arme'] as const)
      expect(genericPart(s).svg).toContain('<');
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/gameIso/rig/parts/cosmetic.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter `parts/types.ts`**

```ts
// src/gameIso/rig/parts/types.ts
/** Fragment SVG dessiné dans le repère LOCAL de l'os porteur (origine au pivot). */
export interface Part { svg: string; }
```

- [ ] **Step 4: Implémenter `parts/generic.ts`**

```ts
// src/gameIso/rig/parts/generic.ts
import type { Slot } from '../bones';
import type { Part } from './types';

/** Fallback neutre par slot (toujours quelque chose à rendre). */
export function genericPart(slot: Slot): Part {
  switch (slot) {
    case 'tete':    return { svg: '' }; // pas de couvre-chef par défaut
    case 'visage':  return { svg: `<circle cx="0" cy="7" r="9" fill="#e2b48c"/>` };
    case 'cheveux': return { svg: `<path d="M-9 6 Q0 -6 9 6 Q4 0 0 0 Q-4 0 -9 6Z" fill="#5a4427"/>` };
    case 'torse':   return { svg: `<path d="M-12 0 Q0 -4 12 0 L10 34 Q0 38 -10 34Z" fill="#6a5a3a"/>` };
    case 'bras':    return { svg: `<rect x="-3" y="0" width="6" height="36" rx="3" fill="#6a5a3a"/>` };
    case 'jambes':  return { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#4c3a26"/>` };
    case 'arme':    return { svg: '' };
    case 'bouclier':return { svg: '' };
  }
}
```

- [ ] **Step 5: Implémenter `parts/cosmetic.ts`**

```ts
// src/gameIso/rig/parts/cosmetic.ts
import type { Part } from './types';

const eye = (cx: number) =>
  `<ellipse cx="${cx}" cy="7" rx="1.4" ry="2" fill="url(#g_eye)"/><circle cx="${cx}" cy="7" r="0.8" fill="#140a06"/>`;

const VISAGE: Record<string, string[]> = {
  default: [
    `<circle cx="0" cy="7" r="9" fill="#e2b48c"/>${eye(-3)}${eye(3)}`,
    `<circle cx="0" cy="7" r="9" fill="#d9a87e"/>${eye(-3)}${eye(3)}`,
  ],
};

const CHEVEUX: Record<string, string[]> = {
  'Humain:M': [
    `<path d="M-9 6 Q0 -7 9 6 Q5 -1 0 -1 Q-5 -1 -9 6Z" fill="#5a4427"/>`,
    `<path d="M-9 7 Q-10 -8 0 -8 Q10 -8 9 7 Q4 -2 0 -2 Q-4 -2 -9 7Z" fill="#2f2418"/>`,
    `<path d="M-9 6 Q0 -6 9 6 L9 12 Q0 8 -9 12Z" fill="#7a4a22"/>`,
  ],
  'Humain:F': [
    `<path d="M-10 4 Q0 -8 10 4 L11 22 Q6 18 5 6 Q0 2 -5 6 Q-6 18 -11 22Z" fill="#3a2a18"/>`,
    `<path d="M-10 4 Q0 -9 10 4 L10 16 Q0 10 -10 16Z" fill="#9a6a2a"/>`,
  ],
};

function pick(table: Record<string, string[]>, key: string, fallbackKey: string, idx: number): string {
  const arr = table[key] ?? table[fallbackKey] ?? Object.values(table)[0];
  return arr[idx >= 0 && idx < arr.length ? idx : 0];
}

/** Part cosmétique (toujours espèce×sexe). slot ∈ {visage, cheveux}. */
export function cosmeticPart(slot: 'visage' | 'cheveux', species: string, sex: 'M' | 'F', idx: number): Part {
  if (slot === 'visage') return { svg: pick(VISAGE, `${species}:${sex}`, 'default', idx) };
  return { svg: pick(CHEVEUX, `${species}:${sex}`, 'Humain:M', idx) };
}
```

- [ ] **Step 6: Lancer le test (succès attendu)**

Run: `npx vitest run src/gameIso/rig/parts/cosmetic.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/gameIso/rig/parts/types.ts src/gameIso/rig/parts/generic.ts src/gameIso/rig/parts/cosmetic.ts src/gameIso/rig/parts/cosmetic.test.ts
git commit -m "feat(rig): part model + parts cosmetiques (visage/cheveux) + fallback generique"
```

---

## Task 6: Carrière → tenue + mapping d'équipement

**Files:**
- Create: `src/gameIso/rig/parts/career.ts`, `src/gameIso/rig/parts/equipment.ts`
- Test: `src/gameIso/rig/parts/career.test.ts`, `src/gameIso/rig/parts/equipment.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// src/gameIso/rig/parts/career.test.ts
import { describe, it, expect } from 'vitest';
import { careerClass, careerTenue } from './career';

describe('careerClass', () => {
  it('lit la classe depuis careers.json', () => {
    expect(careerClass('Soldat')).toBe('Guerriers');     // class réelle de Soldat
    expect(careerClass('Sorcier')).toBe('Lettrés');
  });
  it('carrière inconnue → Citadins (défaut neutre)', () => {
    expect(careerClass('Carrière imaginaire')).toBe('Citadins');
  });
});

describe('careerTenue', () => {
  it('fournit au moins torse + jambes pour chaque classe connue', () => {
    for (const c of ['Guerriers', 'Lettrés', 'Roublards', 'Ruraux', 'Citadins', 'Courtisans', 'Itinérants', 'Riverains']) {
      const t = careerTenue(c);
      expect(t.torse?.svg).toContain('<');
      expect(t.jambes?.svg).toContain('<');
    }
  });
});
```

```ts
// src/gameIso/rig/parts/equipment.test.ts
import { describe, it, expect } from 'vitest';
import { weaponPart, shieldPart, armourPart, equipFromCombatant } from './equipment';
import type { Combatant, Weapon, ItemInstance } from '../../../engine/types';

const wep = (name: string, type: 'melee' | 'ranged', q: string[] = []): Weapon =>
  ({ name, type, damage: '+4', qualities: q } as Weapon);

describe('weaponPart', () => {
  it('reconnaît une épée vs un arc (SVG différents)', () => {
    expect(weaponPart(wep('Épée', 'melee')).svg).not.toBe(weaponPart(wep('Arc court', 'ranged')).svg);
  });
  it('arme inconnue → part générique mêlée non vide', () => {
    expect(weaponPart(wep('Truc bizarre', 'melee')).svg).toContain('<');
  });
});

describe('armourPart', () => {
  const mail: ItemInstance = { uid: '1', name: 'Cotte de mailles', kind: 'armor', qualities: [], pa: 2, locs: ['corps'], enc: 1, equipped: true };
  it('mappe une pièce de corps sur le slot torse', () => {
    expect(armourPart(mail, 'torse')?.svg).toContain('<');
  });
  it('ne renvoie rien si la pièce ne couvre pas l’emplacement', () => {
    expect(armourPart(mail, 'jambes')).toBeNull();
  });
});

describe('shieldPart', () => {
  it('renvoie un SVG de bouclier non vide', () => {
    expect(shieldPart(wep('Bouclier', 'melee', ['Bouclier'])).svg).toContain('<');
  });
});

describe('equipFromCombatant', () => {
  it('extrait armes actives + pièces d’armure équipées + bouclier', () => {
    const c = {
      weapons: [wep('Épée', 'melee'), wep('Bouclier', 'melee', ['Bouclier'])],
      items: [
        { uid: 'a', name: 'Plastron', kind: 'armor', qualities: [], pa: 1, locs: ['corps'], enc: 1, equipped: true } as ItemInstance,
        { uid: 'b', name: 'Heaume', kind: 'armor', qualities: [], pa: 1, locs: ['tete'], enc: 0, equipped: false } as ItemInstance,
      ],
    } as unknown as Combatant;
    const e = equipFromCombatant(c);
    expect(e.armour.map((i) => i.name)).toEqual(['Plastron']); // 'Heaume' non équipé exclu
    expect(e.shield).toBeTruthy();
    expect(e.weapons.length).toBe(2);
  });
});
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

Run: `npx vitest run src/gameIso/rig/parts/career.test.ts src/gameIso/rig/parts/equipment.test.ts`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implémenter `parts/career.ts`**

```ts
// src/gameIso/rig/parts/career.ts
import careers from '../../../data/careers.json';
import type { Part } from './types';

type CareerRow = { label: string; class: string };
const BY_LABEL: Record<string, string> = {};
for (const row of careers as CareerRow[]) BY_LABEL[row.label] = row.class;

export function careerClass(career: string): string {
  return BY_LABEL[career] ?? 'Citadins';
}

/** Tenue par défaut d'une classe (torse/jambes, parfois bras/tete). Socle simple. */
const TENUES: Record<string, Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', Part>>> = {
  Guerriers: {
    torse: { svg: `<path d="M-13 0 Q0 -4 13 0 L11 34 Q0 38 -11 34Z" fill="url(#g_steel)" stroke="#3a4150"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#3a2c22"/>` },
  },
  Lettrés: {
    torse: { svg: `<path d="M-12 0 Q0 -4 12 0 L16 50 L-16 50Z" fill="url(#g_robe)"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="48" rx="3" fill="#171a36"/>` },
    tete: { svg: `<path d="M-9 -2 Q0 -22 9 -2 Q4 -4 0 -4 Q-4 -4 -9 -2Z" fill="url(#g_robe)"/>` },
  },
  Roublards: {
    torse: { svg: `<path d="M-12 0 Q0 -4 12 0 L10 34 Q0 38 -10 34Z" fill="url(#g_coat)"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="48" rx="3" fill="#1a140e"/>` },
  },
  Ruraux: {
    torse: { svg: `<path d="M-12 0 Q0 -4 12 0 L10 34 Q0 38 -10 34Z" fill="#6a5a3a"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="48" rx="3" fill="#5a4630"/>` },
  },
  Citadins: {
    torse: { svg: `<path d="M-12 0 Q0 -4 12 0 L10 34 Q0 38 -10 34Z" fill="#8a7048"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="48" rx="3" fill="#4c3a26"/>` },
  },
  Courtisans: {
    torse: { svg: `<path d="M-12 0 Q0 -4 12 0 L10 34 Q0 38 -10 34Z" fill="#7a3a6a"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="48" rx="3" fill="#3a2440"/>` },
  },
  Itinérants: {
    torse: { svg: `<path d="M-12 0 Q0 -4 12 0 L10 34 Q0 38 -10 34Z" fill="#5a6a3a"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="48" rx="3" fill="#46521f"/>` },
  },
  Riverains: {
    torse: { svg: `<path d="M-12 0 Q0 -4 12 0 L10 34 Q0 38 -10 34Z" fill="#3a5a6a"/>` },
    jambes: { svg: `<rect x="-4" y="0" width="8" height="48" rx="3" fill="#243a44"/>` },
  },
};

export function careerTenue(cls: string): Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', Part>> {
  return TENUES[cls] ?? TENUES.Citadins;
}
```

- [ ] **Step 4: Implémenter `parts/equipment.ts`**

```ts
// src/gameIso/rig/parts/equipment.ts
import type { Combatant, Weapon, ItemInstance, HitLocation } from '../../../engine/types';
import type { Slot } from '../bones';
import type { Part } from './types';

/** Contexte d'équipement extrait d'un Combatant (le rendu lit l'engine — direction permise). */
export interface EquipCtx {
  weapons: Weapon[];
  armour: ItemInstance[];           // pièces d'armure ÉQUIPÉES (locs renseignés)
  shield?: Weapon | ItemInstance;
}

const isShield = (x: { name: string; qualities?: string[] }) =>
  (x.qualities ?? []).some((q) => /bouclier/i.test(q)) || /bouclier/i.test(x.name);

export function equipFromCombatant(c: Combatant): EquipCtx {
  const weapons = c.weapons ?? [];
  const armour = (c.items ?? []).filter((i) => i.kind === 'armor' && i.equipped && (i.locs?.length ?? 0) > 0);
  const shield = weapons.find(isShield) ?? (c.items ?? []).find((i) => i.equipped && isShield(i));
  return { weapons, armour, shield };
}

/** Famille d'arme inférée du nom + type. */
function weaponFamily(w: Weapon): string {
  const n = w.name.toLowerCase();
  if (/arc/.test(n)) return 'arc';
  if (/arbal/.test(n)) return 'arbalete';
  if (/dague|couteau/.test(n)) return 'dague';
  if (/hache/.test(n)) return 'hache';
  if (/masse|marteau|gourdin|fléau|fleau/.test(n)) return 'masse';
  if (/lance|hallebarde|pique|épieu|epieu/.test(n)) return 'lance';
  if (/bâton|baton/.test(n)) return 'baton';
  if (/épée|epee|rapière|rapiere|sabre/.test(n)) return 'epee';
  return w.type === 'ranged' ? 'arc' : 'epee';
}

/** Parts d'arme (dessinées dans le repère local de l'os `arme`, manche à l'origine). */
const WEAPONS: Record<string, string> = {
  epee: `<rect x="-1.5" y="-2" width="3" height="6" fill="#5a3f24"/><rect x="-1" y="-30" width="2" height="28" fill="url(#g_steel)"/><rect x="-5" y="-2" width="10" height="2.5" fill="#caa64a"/>`,
  hache: `<rect x="-1.5" y="-2" width="3" height="30" fill="#4a2f17"/><path d="M-2 -28 q14 -10 14 12 q-14 -2 -14 -10z" fill="url(#g_axe)" stroke="#2a3038"/>`,
  masse: `<rect x="-1.5" y="-2" width="3" height="28" fill="#4a2f17"/><circle cx="0" cy="-28" r="6" fill="url(#g_steelD)"/>`,
  dague: `<rect x="-1.2" y="-1" width="2.4" height="4" fill="#4a2f17"/><rect x="-1" y="-15" width="2" height="14" fill="url(#g_steel)"/>`,
  lance: `<rect x="-1.2" y="-2" width="2.4" height="44" fill="#6a4a2a"/><path d="M0 -50 L4 -40 L-4 -40Z" fill="url(#g_steel)"/>`,
  baton: `<rect x="-1.6" y="-30" width="3.2" height="60" rx="1.5" fill="#6a4a2a"/><circle cx="0" cy="-30" r="4" fill="url(#g_glow)"/>`,
  arc: `<path d="M0 -26 Q14 0 0 26" stroke="#6a4a2a" stroke-width="2.4" fill="none"/><line x1="0" y1="-26" x2="0" y2="26" stroke="#d8d0c0" stroke-width="0.8"/>`,
  arbalete: `<rect x="-2" y="-4" width="4" height="20" fill="#5a3f24"/><path d="M-12 -4 H12" stroke="#3a2a18" stroke-width="3"/>`,
};

export function weaponPart(w: Weapon): Part {
  return { svg: WEAPONS[weaponFamily(w)] ?? WEAPONS.epee };
}

export function shieldPart(_x: Weapon | ItemInstance): Part {
  return { svg: `<ellipse cx="0" cy="6" rx="11" ry="15" fill="url(#g_steelD)" stroke="#3a2a18" stroke-width="1.5"/><ellipse cx="0" cy="6" rx="3" ry="3" fill="#caa64a"/>` };
}

/** Matériau inféré du nom (sinon palier de PA). */
function armourMaterial(item: ItemInstance): 'rembourre' | 'cuir' | 'maille' | 'plaque' {
  const n = item.name.toLowerCase();
  if (/plaque|plastron|harnois|heaume/.test(n)) return 'plaque';
  if (/maille|cotte|haubert/.test(n)) return 'maille';
  if (/cuir|jaque/.test(n)) return 'cuir';
  if (/rembourr|gambison|matelass/.test(n)) return 'rembourre';
  const pa = item.pa ?? 0;
  return pa >= 4 ? 'plaque' : pa >= 2 ? 'maille' : pa >= 1 ? 'cuir' : 'rembourre';
}

const MATERIAL_FILL: Record<string, string> = {
  rembourre: '#9a8a6a', cuir: '#6a4a2a', maille: 'url(#g_steelD)', plaque: 'url(#g_steel)',
};

/** Slot de corps couvert par cet item (via ses locs WFRP4) — null si pas ce slot. */
function coversSlot(item: ItemInstance, slot: Slot): boolean {
  const map: Partial<Record<Slot, HitLocation[]>> = {
    tete: ['tete'], torse: ['corps'], bras: ['brasG', 'brasD'], jambes: ['jambeG', 'jambeD'],
  };
  const locs = map[slot];
  return !!locs && (item.locs ?? []).some((l) => locs.includes(l));
}

export function armourPart(item: ItemInstance, slot: Slot): Part | null {
  if (!coversSlot(item, slot)) return null;
  const fill = MATERIAL_FILL[armourMaterial(item)];
  switch (slot) {
    case 'tete':   return { svg: `<path d="M-9 -2 Q0 -16 9 -2 L9 4 Q0 8 -9 4Z" fill="${fill}" stroke="#2a3038"/>` };
    case 'torse':  return { svg: `<path d="M-13 0 Q0 -4 13 0 L11 34 Q0 38 -11 34Z" fill="${fill}" stroke="#2a3038"/>` };
    case 'bras':   return { svg: `<rect x="-3.5" y="0" width="7" height="22" rx="3" fill="${fill}"/>` };
    case 'jambes': return { svg: `<rect x="-4.5" y="0" width="9" height="30" rx="3" fill="${fill}"/>` };
    default:       return null;
  }
}
```

- [ ] **Step 5: Lancer les tests (succès attendu)**

Run: `npx vitest run src/gameIso/rig/parts/career.test.ts src/gameIso/rig/parts/equipment.test.ts`
Expected: PASS. (Si `careerClass('Soldat')` n'est pas `'Guerriers'`, ajuste l'attente du test à la valeur réelle de `careers.json` — vérifier via `node -e "console.log(require('./src/data/careers.json').find(c=>c.label==='Soldat').class)"`.)

- [ ] **Step 6: Commit**

```bash
git add src/gameIso/rig/parts/career.ts src/gameIso/rig/parts/equipment.ts src/gameIso/rig/parts/career.test.ts src/gameIso/rig/parts/equipment.test.ts
git commit -m "feat(rig): tenue par classe de carriere + mapping armes/bouclier/armure"
```

---

## Task 7: `resolveParts` — le résolveur de priorité (cœur de A)

**Files:**
- Create: `src/gameIso/rig/parts/resolve.ts`
- Test: `src/gameIso/rig/parts/resolve.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/gameIso/rig/parts/resolve.test.ts
import { describe, it, expect } from 'vitest';
import { resolveParts } from './resolve';
import { careerTenue } from './career';
import { armourPart } from './equipment';
import type { EquipCtx } from './equipment';
import type { ItemInstance, Weapon } from '../../../engine/types';

const empty: EquipCtx = { weapons: [], armour: [] };
const wep = (name: string, type: 'melee' | 'ranged'): Weapon => ({ name, type, damage: '+4', qualities: [] } as Weapon);
const plastron: ItemInstance = { uid: '1', name: 'Plastron', kind: 'armor', qualities: [], pa: 4, locs: ['corps'], enc: 1, equipped: true };

describe('resolveParts — priorité', () => {
  it('sans rien : torse = tenue de la carrière', () => {
    const r = resolveParts('Humain', 'M', 'Soldat', empty, {}, 1);
    expect(r.torse?.svg).toBe(careerTenue('Guerriers').torse?.svg);
  });

  it('armure équipée sur le corps PRIME sur la tenue de carrière', () => {
    const equip: EquipCtx = { weapons: [], armour: [plastron] };
    const r = resolveParts('Humain', 'M', 'Soldat', equip, {}, 1);
    expect(r.torse?.svg).toBe(armourPart(plastron, 'torse')?.svg);
    expect(r.torse?.svg).not.toBe(careerTenue('Guerriers').torse?.svg);
  });

  it('arme et bouclier suivent l’équipement', () => {
    const equip: EquipCtx = { weapons: [wep('Hache', 'melee')], armour: [], shield: { name: 'Bouclier', qualities: ['Bouclier'] } as any };
    const r = resolveParts('Humain', 'M', 'Soldat', equip, {}, 1);
    expect(r.arme?.svg).toContain('<');
    expect(r.bouclier?.svg).toContain('<');
  });

  it('override éditeur (parts) PRIME sur l’équipement', () => {
    const equip: EquipCtx = { weapons: [], armour: [plastron] };
    // overrides.torse = 0 → on force la 1re variante de carrière (≠ armure)
    const r = resolveParts('Humain', 'M', 'Soldat', equip, { torse: 0 }, 1);
    expect(r.torse?.svg).not.toBe(armourPart(plastron, 'torse')?.svg);
  });

  it('visage et cheveux sont toujours présents', () => {
    const r = resolveParts('Humain', 'M', 'Soldat', empty, {}, 1);
    expect(r.visage?.svg).toContain('<');
    expect(r.cheveux?.svg).toContain('<');
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/gameIso/rig/parts/resolve.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `parts/resolve.ts`**

```ts
// src/gameIso/rig/parts/resolve.ts
import type { Slot } from '../bones';
import type { Part } from './types';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { careerClass, careerTenue } from './career';
import { armourPart, weaponPart, shieldPart, type EquipCtx } from './equipment';

const BODY_SLOTS: Slot[] = ['tete', 'bras', 'torse', 'jambes'];

/**
 * Choisit une part par slot, par priorité :
 *   override éditeur > équipement porté > tenue de carrière > générique.
 * visage/cheveux : toujours (cosmétique espèce×sexe), avec variante via overrides/seed.
 */
export function resolveParts(
  species: string,
  sex: 'M' | 'F',
  career: string | undefined,
  equip: EquipCtx,
  overrides: Partial<Record<Slot, number>>,
  seed: number,
): Record<Slot, Part | null> {
  const cls = career ? careerClass(career) : 'Citadins';
  const tenue = careerTenue(cls);
  const out = {} as Record<Slot, Part | null>;

  // Cosmétique (toujours). overrides priment, sinon variante dérivée du seed.
  out.visage = cosmeticPart('visage', species, sex, overrides.visage ?? seed % 2);
  out.cheveux = cosmeticPart('cheveux', species, sex, overrides.cheveux ?? (seed >> 2) % 3);

  // Corps : override → armure équipée → carrière → générique.
  for (const slot of BODY_SLOTS) {
    if (overrides[slot] != null) {
      out[slot] = tenue[slot as 'torse' | 'jambes' | 'bras' | 'tete'] ?? genericPart(slot);
      continue;
    }
    const armed = equip.armour.map((it) => armourPart(it, slot)).find((p) => p != null) ?? null;
    if (armed) { out[slot] = armed; continue; }
    out[slot] = tenue[slot as 'torse' | 'jambes' | 'bras' | 'tete'] ?? (slot === 'tete' ? { svg: '' } : genericPart(slot));
  }

  // Mains : arme (1re arme non-bouclier) + bouclier.
  const mainWeapon = equip.weapons.find((w) => !/bouclier/i.test(w.name));
  out.arme = mainWeapon ? weaponPart(mainWeapon) : { svg: '' };
  out.bouclier = equip.shield ? shieldPart(equip.shield) : { svg: '' };

  return out;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run src/gameIso/rig/parts/resolve.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/rig/parts/resolve.ts src/gameIso/rig/parts/resolve.test.ts
git commit -m "feat(rig): resolveParts — priorite override>equipement>carriere>generique"
```

---

## Task 8: `resolveRig` + composant `RigSprite`

**Files:**
- Create: `src/gameIso/rig/appearance.ts`, `src/gameIso/rig/composeRig.tsx`
- Test: `src/gameIso/rig/composeRig.test.ts`

- [ ] **Step 1: Implémenter `appearance.ts`**

```ts
// src/gameIso/rig/appearance.ts
import type { Slot } from './bones';
import type { Combatant } from '../../engine/types';
import { hashSeed } from '../appearance';

/** Descripteur d'apparence COSMÉTIQUE (type pur ; l'engine ne le lit jamais). */
export interface Appearance {
  species: string;
  sex: 'M' | 'F';
  build: number;                                   // 0..1
  parts?: Partial<Record<Slot, number>>;           // overrides éditeur
  seed?: number;
}

/** Apparence par défaut dérivée d'un Combatant (espèce + seed stable sur l'id). */
export function defaultAppearance(c: Combatant): Appearance {
  return {
    species: c.species ?? 'Humain',
    sex: 'M',
    build: 0.5,
    seed: hashSeed(c.id),
  };
}
```

- [ ] **Step 2: Écrire le test qui échoue**

```ts
// src/gameIso/rig/composeRig.test.ts
import { describe, it, expect } from 'vitest';
import { resolveRig } from './composeRig';
import type { Appearance } from './appearance';
import type { EquipCtx } from './parts/equipment';

const app: Appearance = { species: 'Humain', sex: 'M', build: 0.5, seed: 7 };
const equip: EquipCtx = { weapons: [], armour: [] };

describe('resolveRig', () => {
  it('produit des os triés par z croissant', () => {
    const bones = resolveRig(app, equip, {});
    for (let i = 1; i < bones.length; i++) expect(bones[i].z).toBeGreaterThanOrEqual(bones[i - 1].z);
  });
  it('attache la tenue de torse à l’os torse', () => {
    const bones = resolveRig(app, equip, {});
    const torse = bones.find((b) => b.id === 'torse');
    expect(torse?.parts.some((p) => p.svg.includes('<'))).toBe(true);
  });
  it('marque en miroir les parts du côté droit (slots symétriques)', () => {
    const bones = resolveRig(app, equip, {});
    const epauleD = bones.find((b) => b.id === 'epauleD');
    expect(epauleD?.parts.some((p) => p.mirror)).toBe(true);
  });
  it('déterministe : mêmes entrées → même sortie', () => {
    expect(JSON.stringify(resolveRig(app, equip, {}))).toBe(JSON.stringify(resolveRig(app, equip, {})));
  });
});
```

- [ ] **Step 3: Lancer le test (échec attendu)**

Run: `npx vitest run src/gameIso/rig/composeRig.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 4: Implémenter `composeRig.tsx`**

```tsx
// src/gameIso/rig/composeRig.tsx
import React from 'react';
import { BONE_IDS, SLOT_BONES, SLOT_LAYER, type BoneId, type Slot } from './bones';
import { baseSkeleton, applyBuild } from './skeletons';
import { worldTransforms, toSvg, type Matrix } from './kinematics';
import type { Pose } from './poses';
import type { Appearance } from './appearance';
import { resolveParts } from './parts/resolve';
import type { EquipCtx } from './parts/equipment';

export interface ResolvedBone {
  id: BoneId;
  matrix: Matrix;
  z: number;
  parts: { svg: string; layer: number; mirror?: boolean }[];
}

/** (apparence, équipement, pose, carrière?) → os résolus, triés z croissant (peintre). PUR. */
export function resolveRig(
  appearance: Appearance, equip: EquipCtx, pose: Pose, career?: string,
): ResolvedBone[] {
  const sk = applyBuild(baseSkeleton(appearance.species, appearance.sex), appearance.build);
  const world = worldTransforms(sk, pose);
  const parts = resolveParts(appearance.species, appearance.sex, career, equip, appearance.parts ?? {}, appearance.seed ?? 1);

  const boneParts: Record<BoneId, ResolvedBone['parts']> = {} as Record<BoneId, ResolvedBone['parts']>;
  for (const id of BONE_IDS) boneParts[id] = [];

  for (const slot of Object.keys(SLOT_BONES) as Slot[]) {
    const part = parts[slot];
    if (!part || !part.svg) continue;
    SLOT_BONES[slot].forEach((bid, idx) => {
      boneParts[bid].push({ svg: part.svg, layer: SLOT_LAYER[slot], mirror: idx === 1 });
    });
  }

  return BONE_IDS
    .map((id) => ({ id, matrix: world[id], z: sk[id].z, parts: boneParts[id].sort((a, b) => a.layer - b.layer) }))
    .filter((b) => b.parts.length > 0)
    .sort((a, b) => a.z - b.z);
}

/** Composant : un <g data-bone> par os, transformable individuellement (anim C / postures D). */
export function RigSprite({ appearance, equip, pose = {}, career }: {
  appearance: Appearance; equip: EquipCtx; pose?: Pose; career?: string;
}): JSX.Element {
  const bones = resolveRig(appearance, equip, pose, career);
  return (
    <g className="rig">
      {bones.map((b) => (
        <g key={b.id} data-bone={b.id} transform={toSvg(b.matrix)}>
          {b.parts.map((p, i) =>
            p.mirror ? (
              <g key={i} transform="scale(-1,1)" dangerouslySetInnerHTML={{ __html: p.svg }} />
            ) : (
              <g key={i} dangerouslySetInnerHTML={{ __html: p.svg }} />
            ),
          )}
        </g>
      ))}
    </g>
  );
}
```

> Note : `resolveRig(appearance, equip, pose, career?)` est la **signature finale** (career optionnel). Le test de Step 2 l'appelle en 3 args (career omis) — valide.

- [ ] **Step 5: Lancer le test + typecheck (succès attendu)**

Run: `npx vitest run src/gameIso/rig/composeRig.test.ts && npm run typecheck`
Expected: PASS + 0 erreur de type.

- [ ] **Step 6: Commit**

```bash
git add src/gameIso/rig/appearance.ts src/gameIso/rig/composeRig.tsx src/gameIso/rig/composeRig.test.ts
git commit -m "feat(rig): resolveRig + composant RigSprite (os nommes, miroir G/D, tri z)"
```

---

## Task 9: Champ `appearance` sur Combatant + pré-tirés

**Files:**
- Modify: `src/engine/types.ts` (interface `Combatant`, ~ligne 149)
- Modify: `src/data/pregens.ts`
- Test: `src/engine/types.test.ts` (ou un test existant des pregens si présent)

- [ ] **Step 1: Ajouter le champ pur sur `Combatant`**

Dans `src/engine/types.ts`, dans `interface Combatant`, après `initiative?: number;` :

```ts
  /** Apparence visuelle (cosmétique, ignorée par le moteur ; lue par le rendu). */
  appearance?: import('../gameIso/rig/appearance').Appearance;
```

> L'import `type-only` inline garde `src/engine` sans dépendance d'exécution vers le rendu (règle #3 : seule une référence de TYPE, élidée à la compilation).

- [ ] **Step 2: Vérifier que le moteur n'utilise jamais ce champ**

Run: `npx vitest run` (toute la suite moteur)
Expected: PASS — aucun test moteur ne dépend d'`appearance`.

- [ ] **Step 3: Doter les pré-tirés d'une apparence (démo M/F)**

`pregens.ts` décrit chaque pré-tiré via `PregenDef` puis construit le `Combatant` avec
`createHero` dans `makePregens()`. On ajoute un champ `sex` à `PregenDef`, on en marque
quelques-uns en `'F'`, et on pose `hero.appearance` dans la boucle.

Dans `interface PregenDef` (≈ ligne 10), ajouter :

```ts
  /** Sexe visuel (cosmétique ; aucune incidence de règles). Défaut 'M'. */
  sex?: 'M' | 'F';
  /** Morphologie 0..1 (cosmétique). Défaut 0.5. */
  build?: number;
```

Marquer au moins deux pré-tirés féminins (ex. Wilhelmina Faust et Rosa Brandt) en ajoutant
`sex: 'F'` à leur littéral dans `DEFS`.

Dans `makePregens()`, juste après `if (d.spells?.length) hero.spells = [...d.spells];` :

```ts
      hero.appearance = { species: d.species, sex: d.sex ?? 'M', build: d.build ?? 0.5 };
```

- [ ] **Step 4: Typecheck + tests**

Run: `npm run typecheck && npx vitest run`
Expected: PASS + 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/data/pregens.ts
git commit -m "feat(rig): Combatant.appearance (donnee pure) + apparences pre-tirees"
```

---

## Task 10: Migrer l'art des 5 héros existants en parts

**Files:**
- Create: `src/gameIso/rig/parts/human.ts`
- Modify: `src/gameIso/rig/parts/career.ts` (utiliser ces parts pour les tenues), `src/gameIso/rig/parts/cosmetic.ts` (têtes humaines)
- Reference (source de l'art) : `src/gameIso/sprites.ts:51-114` (`soldier/slayer/sorcier/halfling/witchHunter`)

> Méthode : pour chaque fonction héros existante, prendre les `<path>`/`<rect>` qui composent une zone (torse, jambes, tête, arme) et **re-origin** chaque coordonnée pour que le **pivot de l'os** soit à (0,0) dans la part. Concrètement : la boîte source a la tête vers y≈48, le torse vers y≈70-116, les pieds vers y≈150. Pour la part `torse` (os `torse`, pivot monde ≈ (60,62)), soustraire (60,62) des coordonnées du path de torse. Affiner l'alignement à la recette navigateur (Task 13).

- [ ] **Step 1: Créer `parts/human.ts` avec les parts extraites (exemple : torse du Soldat)**

```ts
// src/gameIso/rig/parts/human.ts
import type { Part } from './types';

// Extrait de soldier() (sprites.ts) : plastron + tabard, re-originé sur le pivot du torse.
// (coordonnées ajustées à l'œil à la recette ; valeurs de départ ci-dessous)
export const HUMAIN_TORSE_GUERRIER: Part = {
  svg: `<path d="M-16 8 Q0 -4 16 8 Q20 46 16 88 L-4 78 L-16 88 Q-20 46 -16 8Z" fill="url(#g_cloak)"/>
        <path d="M-16 8 Q0 -4 16 8 L20 54 Q0 64 -20 54Z" fill="url(#g_steel)" stroke="#3a4150" stroke-width="1.5"/>`,
};

// Extrait de sorcier() : robe.
export const HUMAIN_TORSE_ROBE: Part = {
  svg: `<path d="M-20 8 Q0 -2 20 8 L38 88 L-38 88Z" fill="url(#g_robe)"/>`,
};

// Tête nue humaine (de soldier) : visage + casque ouvert. (visage géré par cosmetic ;
// ici la calotte de casque, slot 'tete' pour la classe Guerriers).
export const HUMAIN_CASQUE_OUVERT: Part = {
  svg: `<path d="M-14 -2 Q0 -22 14 -2 L14 -10 Q0 -24 -14 -10Z" fill="url(#g_steel)" stroke="#3a4150"/>`,
};

// Hache du Tueur (slayer) : à placer sur l'os 'arme'.
export const HACHE_TUEUR: Part = {
  svg: `<rect x="-2" y="-2" width="4" height="40" fill="#4a2f17"/><path d="M-16 -2 q16 -14 16 14 q-16 -2 -16 -14z" fill="url(#g_axe)" stroke="#2a3038"/>`,
};
```

> Répéter l'extraction pour : jambes (Soldat → bottes/cuissardes), tenue Roublards (manteau du Répurgateur `witchHunter`), bâton+chapeau du Sorcier, gilet du Halfling. Une part par zone. **Montrer le code de chaque part** (pas de « idem »).

- [ ] **Step 2: Brancher ces parts dans `careerTenue` / `cosmetic`**

Dans `parts/career.ts`, remplacer les SVG provisoires de `Guerriers.torse`, `Lettrés.torse`, `Roublards.torse`, etc. par les imports de `human.ts` :

```ts
import { HUMAIN_TORSE_GUERRIER, HUMAIN_TORSE_ROBE, HUMAIN_CASQUE_OUVERT } from './human';
// …
Guerriers: { torse: HUMAIN_TORSE_GUERRIER, jambes: { /* bottes extraites */ svg: '…' }, tete: HUMAIN_CASQUE_OUVERT },
Lettrés:   { torse: HUMAIN_TORSE_ROBE, jambes: { svg: '…' }, tete: { /* chapeau sorcier */ svg: '…' } },
```

- [ ] **Step 3: Lancer les tests existants (non-régression)**

Run: `npx vitest run src/gameIso/rig`
Expected: PASS (les tests de `career`/`resolve` valident encore que torse/jambes existent).

- [ ] **Step 4: Commit**

```bash
git add src/gameIso/rig/parts/human.ts src/gameIso/rig/parts/career.ts src/gameIso/rig/parts/cosmetic.ts
git commit -m "feat(rig): art des 5 heros existants migre en parts (tenues humaines)"
```

---

## Task 11: Intégration dans IsoStage (rendu héros via rig) + suppression de l'ancien code

**Files:**
- Modify: `src/gameIso/IsoStage.tsx` (token : `:120-153`)
- Modify: `src/gameIso/sprites.ts` (supprimer `soldier/slayer/sorcier/halfling/witchHunter`, `HERO_BY_CAREER`, `heroSprite`)
- Reference : `IsoStage.tsx:141` (`heroSprite(c)`), `:152` (leader)

- [ ] **Step 1: Ajouter une variante de `token()` acceptant des enfants React**

Dans `IsoStage.tsx`, repérer `token(...)` (≈ ligne 116-132) qui fait `dangerouslySetInnerHTML={{ __html: inner }}`. Ajouter à côté une fonction qui accepte des enfants :

```tsx
function tokenNode(
  key: string, x: number, y: number, child: React.ReactNode,
  scale: number, ringColor?: string, dim?: boolean,
) {
  const { cx, cy } = tileCenter(x, y, dims);
  return (
    <g key={key} transform={`translate(${cx},${cy})`} opacity={dim ? 0.4 : 1}>
      <ellipse cx={0} cy={0} rx={16 * scale + 5} ry={(16 * scale + 5) / 2} fill="#000" opacity={0.33} />
      {ringColor && <ellipse cx={0} cy={0} rx={18 * scale} ry={9 * scale} fill="none" stroke={ringColor} strokeWidth={2.5} />}
      <g transform={`translate(${-60 * scale},${-150 * scale}) scale(${scale})`}>{child}</g>
    </g>
  );
}
```

> Le `<g>` interne reproduit exactement le placement du chemin `innerHTML` (`:130`) : `translate(-60*scale,-150*scale) scale(scale)`. Le rig dessine dans la même boîte 120×150.

- [ ] **Step 2: Rendre les héros via `RigSprite`**

Remplacer, dans la boucle des combattants (≈ `:139-142`) :

```tsx
const isHero = c.kind === 'hero';
const ring = isHero ? HERO_RING[hi++ % HERO_RING.length] : '#c0392b';
if (isHero) {
  const appearance = c.appearance ?? defaultAppearance(c);
  const equip = equipFromCombatant(c);
  objs.push({ d: depth(c.pos.x, c.pos.y) + 0.5, el: tokenNode(c.id, c.pos.x, c.pos.y,
    <RigSprite appearance={appearance} equip={equip} career={c.career} />, 0.62, ring, isOutOfAction(c)) });
} else {
  const inner = enemySprite(c.name, hashSeed(c.id));
  objs.push({ d: depth(c.pos.x, c.pos.y) + 0.5, el: token(c.id, c.pos.x, c.pos.y, inner, 0.62, ring, isOutOfAction(c)) });
}
```

Et pour le leader du groupe (≈ `:151-153`) :

```tsx
const leader = party[0];
const leaderNode = leader
  ? <RigSprite appearance={leader.appearance ?? defaultAppearance(leader)} equip={equipFromCombatant(leader)} career={leader.career} />
  : null;
objs.push({ d: depth(partyPos.x, partyPos.y) + 0.5, el: leaderNode
  ? tokenNode('__party', partyPos.x, partyPos.y, leaderNode, 0.6, HERO_RING[0])
  : token('__party', partyPos.x, partyPos.y, pnjSprite(), 0.6, HERO_RING[0]) });
```

Ajouter les imports en tête d'`IsoStage.tsx` :

```tsx
import { RigSprite } from './rig/composeRig';
import { defaultAppearance } from './rig/appearance';
import { equipFromCombatant } from './rig/parts/equipment';
```

- [ ] **Step 3: Supprimer l'ancien code héros de `sprites.ts`**

Supprimer les fonctions `soldier`, `slayer`, `sorcier`, `halfling`, `witchHunter`, l'objet `HERO_BY_CAREER` et `export function heroSprite`. Retirer l'import `heroSprite` d'`IsoStage.tsx`. Conserver `enemySprite`, `pnjSprite`, `entitySprite`, `placeSprite`, `DEFS`, etc.

> Avant de supprimer : `grep -rn "heroSprite" src/` pour recenser les appelants et tous les corriger.

- [ ] **Step 4: Typecheck + build + tests**

Run: `npm run typecheck && npx vitest run`
Expected: PASS + 0 erreur (aucune référence résiduelle à `heroSprite`).

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/IsoStage.tsx src/gameIso/sprites.ts
git commit -m "refactor(rig): heros rendus via RigSprite; suppression des fonctions sprite figees"
```

---

## Task 12: Panneau d'apparence (créateur + éditeur)

**Files:**
- Create: `src/ui/AppearancePanel.tsx`
- Modify: `src/ui/editor/Editor.tsx` (intégrer le panneau pour un héros sélectionné), créateur de personnage (là où l'espèce/carrière est choisie)

- [ ] **Step 1: Créer le panneau réutilisable**

```tsx
// src/ui/AppearancePanel.tsx
import React from 'react';
import { RigSprite } from '../gameIso/rig/composeRig';
import { DEFS } from '../gameIso/sprites';
import type { Appearance } from '../gameIso/rig/appearance';
import type { EquipCtx } from '../gameIso/rig/parts/equipment';

export function AppearancePanel({ value, equip, career, onChange }: {
  value: Appearance; equip: EquipCtx; career?: string; onChange: (a: Appearance) => void;
}) {
  const set = (patch: Partial<Appearance>) => onChange({ ...value, ...patch });
  return (
    <div className="ed-field">
      <span>Apparence</span>
      <label className="ed-subfield">Sexe
        <select value={value.sex} onChange={(e) => set({ sex: e.target.value as 'M' | 'F' })}>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </select>
      </label>
      <label className="ed-subfield">Morphologie
        <input type="range" min={0} max={1} step={0.05} value={value.build}
          onChange={(e) => set({ build: Number(e.target.value) })} />
      </label>
      <button className="btn small" onClick={() => set({ seed: (value.seed ?? 0) + 1 })}>🎲</button>
      <svg viewBox="0 0 120 150" width={96} height={120} style={{ background: '#1d2230', borderRadius: 6 }}>
        <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
        <g transform="translate(0,0)"><RigSprite appearance={value} equip={equip} career={career} /></g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Intégrer dans le créateur de personnage**

Au point où l'utilisateur choisit espèce + carrière, instancier une `Appearance` (`{ species, sex:'M', build:0.5 }`) dans l'état du créateur et afficher `<AppearancePanel value={app} equip={equipFromCombatant(draftCombatant)} career={career} onChange={setApp} />`. À la création finale, écrire `combatant.appearance = app`.

- [ ] **Step 3: Intégrer dans l'éditeur (héros sélectionné)**

Dans `Editor.tsx`, quand l'entité/combattant sélectionné est un héros, afficher `<AppearancePanel ... />` lié à son `appearance`. (Réutilise la convention de `updateSel`.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/AppearancePanel.tsx src/ui/editor/Editor.tsx
git commit -m "feat(rig): panneau d'apparence (sexe/morpho/apercu) — createur + editeur"
```

---

## Task 13: Recette navigateur (Playwright MCP)

**Files:** aucune modification de code (validation). Si un bug visuel est trouvé, le corriger dans le fichier concerné et re-commiter.

- [ ] **Step 1: Lancer le serveur de dev**

Run (background) : `npm run dev`
Attendre `http://localhost:5173`.

- [ ] **Step 2: Charger le jeu et déclencher le « 🧪 Test rapide »**

Via Playwright MCP : naviguer sur `localhost:5173`, cliquer « 🧪 Test rapide » (équipe pré-tirée + scène). Vérifier la **console : 0 erreur**.

- [ ] **Step 3: Vérifier le rendu rig in-game**

- Les 4 héros s'affichent avec un corps articulé (pas l'ancien sprite figé).
- M et F visuellement distincts ; un Nain plus trapu, un Elfe plus élancé.
- Screenshot `rig-ingame.png`.

- [ ] **Step 4: Vérifier le pilotage par l'équipement**

Dans l'éditeur ou via le créateur : équiper une **arme** (ex. hache) puis une **pièce d'armure** (ex. plastron) sur un héros → le sprite doit **changer** (arme visible en main, torse en armure). Sans armure sur les jambes → tenue de carrière conservée. Screenshot `rig-equipement.png`.

> Piège connu (CLAUDE.md) : si un clic change l'état React puis qu'on agit dans le MÊME `evaluate`, on lit l'ancien état. Séparer en deux appels.

- [ ] **Step 5: Si tout est vert, commit éventuel des ajustements**

```bash
git add <fichiers ajustés>
git commit -m "fix(rig): ajustements d'alignement post-recette navigateur"
```

---

## Task 14: Backlog d'enrichissement de l'art (itératif, non bloquant)

> A est **fonctionnel et testable** après Task 13 (le rig rend toujours, parts génériques si manquantes). Cette tâche est un **backlog d'art** mené par lots, méthode **best-of-2 par planches** (barre qualité bestiaire, cf. mémoire projet), réfs `art-ref/ldb/mapping.json`. Chaque lot = 1 commit, `npm run typecheck` vert, recette navigateur sur les nouveaux assets.

- [ ] Têtes/cheveux par espèce×sexe (Nain : barbes ; Elfe : visages fins ; Halfling : joues rondes).
- [ ] Armures par matériau × emplacement (rembourré/cuir/maille/plaque) dessinées proprement.
- [ ] Familles d'armes complètes (épée/hache/masse/dague/lance/fléau/arc/arbalète/bâton) + boucliers variés.
- [ ] Tenues spécifiques aux carrières distinctives (Répurgateur, Tueur, Sorcier, Médecin…).
- [ ] Proportions Ogre/Gnome affinées (silhouette lisible sur 1 tuile).
- [ ] `node scripts/gen-gallery.mjs` étendu pour une galerie QC du rig (espèces × sexe × classes).

---

## Self-review (rempli par l'auteur du plan)

- **Couverture du spec** : §3.1 slots→Task1 ; §3.2 squelettes/build→Task3 ; §3.3 Pose→Task4 ; §3.4 résolution équipement+carrière→Tasks5/6/7 ; §3.5 Appearance→Task8 ; §4 resolveRig/RigSprite→Task8 ; §5 intégration→Tasks9/11 ; §6 contenu→Tasks10/14 ; §7 UI→Task12 ; §9 tests/recette→tous + Task13. ✔
- **Pas de placeholder de logique** : tout le code pur est fourni ; les SVG d'art sont concrets (socle) avec enrichissement explicitement itératif (Task14) — pas un « TODO » caché mais une stratégie de contenu assumée.
- **Cohérence des types** : `Appearance`, `EquipCtx`, `Part`, `Slot`, `BoneId`, `Matrix`, `ResolvedBone`, `resolveParts(species,sex,career,equip,overrides,seed)`, `resolveRig(appearance,equip,pose,career?)`, `RigSprite({appearance,equip,pose?,career})`, `equipFromCombatant`, `defaultAppearance`, `careerClass`, `careerTenue` — noms identiques entre tâches. ✔ (Task8 termine sur la signature unique `resolveRig(…, career?)`.)
