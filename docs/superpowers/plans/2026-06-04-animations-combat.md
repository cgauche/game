# Animations d'action de combat (sous-projet C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animer les actions de combat en interpolant les angles d'os du rig dans le temps (fente/tir/sort, esquive/parade/prise de coup, projectile, marche, chute), piloté par le bus d'événements, sans bloquer le tour par tour.

**Architecture:** Un moteur de tween `requestAnimationFrame` maison. Les **poses deviennent additives** (deltas d'angles sur le repos). Une couche PURE (`tween.ts` interpolation, `clips.ts` séquences keyframées + `sampleClip`) testable sans DOM, un hook React (`useRigClip`) qui anime via rAF, et un composant `AnimatedRigToken` abonné au bus. Anims **cosmétiques non bloquantes** (l'état du moteur reste la vérité ; un `onImpact` synchronise dégât flottant + recul).

**Tech Stack:** Vite + TypeScript + React, Vitest, SVG, bus d'événements (`src/state/bus.ts`). Aucune dépendance ajoutée.

**Lire avant de commencer :** `docs/superpowers/specs/2026-06-04-animations-combat-design.md` et `src/gameIso/rig/PART-CONTRACT.md`.

**Conventions de commit :** trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` ; `git add` de chemins explicites (WIP parallèle dans le tree).

---

## File Structure

Créés :
- `src/gameIso/rig/anim/tween.ts` — `Easing`, `ease`, `lerpPose` (pur).
- `src/gameIso/rig/anim/clips.ts` — `ClipStep`, `Clip`, `ClipName`, `CLIPS`, `clipDuration`, `sampleClip` (pur).
- `src/gameIso/rig/anim/useRigClip.ts` — hook rAF (état Pose + `play`/`hold`).
- `src/gameIso/AnimatedRigToken.tsx` — `<RigSprite pose>` + abonnement bus, 1 par combattant héros.
- `*.test.ts` (tween, clips, AnimatedRigToken).

Modifiés :
- `src/gameIso/rig/kinematics.ts` — `worldTransforms` : pose **additive** (`b.angle + (pose[id] ?? 0)`).
- `src/state/bus.ts` — `EVT.ANIM_IMPACT` + doc du payload `ANIM_ATTACK` enrichi.
- `src/state/store.ts` — `kind` + `defense` dans les 2 `bus.emit(EVT.ANIM_ATTACK)`.
- `src/gameIso/IsoStage.tsx` — héros via `<AnimatedRigToken>` ; float sur `ANIM_IMPACT` ; projectile ; anim légère des tokens créatures.

---

## Task 1 : Poses additives (deltas) dans la cinématique

**Files:** Modify `src/gameIso/rig/kinematics.ts` ; Test `src/gameIso/rig/kinematics.test.ts`

> Aujourd'hui `worldTransforms` fait `pose[id] ?? b.angle` (pose = angle ABSOLU). Pour
> l'animation, une pose doit être un **delta** ajouté au repos (un clip dit « lève le bras
> de −40° » indépendamment du repos). Aucune pose non vide n'est utilisée aujourd'hui → sûr.

- [ ] **Step 1 : Test (échec attendu)** — ajouter dans `kinematics.test.ts` :

```ts
import { baseSkeleton } from './skeletons';

describe('pose additive', () => {
  it('un delta de pose s’ajoute à l’angle de repos de l’os', () => {
    const sk = baseSkeleton('Humain', 'M');
    const rest = worldTransforms(sk, {});
    const moved = worldTransforms(sk, { epauleD: 30 });
    // l'os epauleD bouge quand on applique un delta ; les autres os non.
    expect(moved['epauleD']).not.toEqual(rest['epauleD']);
    expect(moved['cuisseG']).toEqual(rest['cuisseG']);
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run src/gameIso/rig/kinematics.test.ts`
Expected : FAIL (le delta n'est pas encore additif — `pose[id] ?? b.angle` ignore l'addition).

- [ ] **Step 3 : Rendre la pose additive** — dans `kinematics.ts`, `worldTransforms` :

```ts
  const world = (id: BoneId): Matrix => {
    if (out[id]) return out[id];
    const b = sk[id];
    const ang = b.angle + (pose[id] ?? 0); // pose = DELTA sur le repos
    const local = mul(translate(b.pivot.x, b.pivot.y), rotate(ang));
    out[id] = b.parent ? mul(world(b.parent), local) : local;
    return out[id];
  };
```

- [ ] **Step 4 : Lancer toute la suite rig (non-régression)**

Run: `npx vitest run src/gameIso/rig`
Expected : PASS (les poses existantes sont `{}` → `b.angle + 0` = inchangé).

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/rig/kinematics.ts src/gameIso/rig/kinematics.test.ts
git commit -m "feat(anim): poses additives (delta sur le repos) dans worldTransforms"
```

---

## Task 2 : `tween.ts` — easings + interpolation de pose

**Files:** Create `src/gameIso/rig/anim/tween.ts` ; Test `src/gameIso/rig/anim/tween.test.ts`

- [ ] **Step 1 : Test (échec attendu)**

```ts
// src/gameIso/rig/anim/tween.test.ts
import { describe, it, expect } from 'vitest';
import { ease, lerpPose } from './tween';

describe('ease', () => {
  it('borne les extrêmes', () => {
    for (const e of ['linear', 'easeOut', 'easeInOut'] as const) {
      expect(ease(e, 0)).toBeCloseTo(0);
      expect(ease(e, 1)).toBeCloseTo(1);
    }
  });
});

describe('lerpPose', () => {
  it('t=0 → from, t=1 → to', () => {
    expect(lerpPose({ epauleD: 0 }, { epauleD: 40 }, 0).epauleD).toBeCloseTo(0);
    expect(lerpPose({ epauleD: 0 }, { epauleD: 40 }, 1).epauleD).toBeCloseTo(40);
  });
  it('interpole au milieu', () => {
    expect(lerpPose({ epauleD: 0 }, { epauleD: 40 }, 0.5).epauleD).toBeCloseTo(20);
  });
  it('os absent d’un côté = delta 0', () => {
    expect(lerpPose({}, { epauleD: 40 }, 0.5).epauleD).toBeCloseTo(20);
    expect(lerpPose({ epauleD: 40 }, {}, 0.5).epauleD).toBeCloseTo(20);
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run src/gameIso/rig/anim/tween.test.ts`
Expected : FAIL — module introuvable.

- [ ] **Step 3 : Implémenter `tween.ts`**

```ts
// src/gameIso/rig/anim/tween.ts
import type { Pose } from '../poses';
import type { BoneId } from '../bones';

export type Easing = 'linear' | 'easeOut' | 'easeInOut' | 'easeOutBack';

export function ease(e: Easing, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  switch (e) {
    case 'linear': return x;
    case 'easeOut': return 1 - (1 - x) * (1 - x);
    case 'easeInOut': return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'easeOutBack': {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
  }
}

/** Interpole deux poses (deltas d'angles). Os absent d'un côté = 0. */
export function lerpPose(from: Pose, to: Pose, t: number): Pose {
  const out: Pose = {};
  const keys = new Set<BoneId>([...Object.keys(from), ...Object.keys(to)] as BoneId[]);
  for (const k of keys) {
    const a = from[k] ?? 0;
    const b = to[k] ?? 0;
    out[k] = a + (b - a) * t;
  }
  return out;
}
```

- [ ] **Step 4 : Lancer (succès attendu)**

Run: `npx vitest run src/gameIso/rig/anim/tween.test.ts`
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/rig/anim/tween.ts src/gameIso/rig/anim/tween.test.ts
git commit -m "feat(anim): tween — easings + lerpPose (interpolation de poses additives)"
```

---

## Task 3 : `clips.ts` — bibliothèque de clips + échantillonnage

**Files:** Create `src/gameIso/rig/anim/clips.ts` ; Test `src/gameIso/rig/anim/clips.test.ts`

> Les valeurs d'angles sont un **point de départ**, ajustées à la recette navigateur (Task 9).
> Les tests vérifient des **propriétés** (durées, `onImpact`, déterminisme), pas des angles.

- [ ] **Step 1 : Test (échec attendu)**

```ts
// src/gameIso/rig/anim/clips.test.ts
import { describe, it, expect } from 'vitest';
import { CLIPS, clipDuration, sampleClip, type ClipName } from './clips';

const NAMES: ClipName[] = ['melee', 'ranged', 'cast', 'dodge', 'parry', 'hit', 'fall', 'walk', 'idle'];

describe('CLIPS', () => {
  it('chaque clip existe et a une durée > 0', () => {
    for (const n of NAMES) {
      expect(CLIPS[n]).toBeTruthy();
      expect(clipDuration(CLIPS[n])).toBeGreaterThan(0);
    }
  });
  it('onImpact (si présent) ≤ durée totale', () => {
    for (const n of NAMES) {
      const c = CLIPS[n];
      if (c.onImpact != null) expect(c.onImpact).toBeLessThanOrEqual(clipDuration(c));
    }
  });
  it('melee/ranged/cast déclenchent un impact ; idle/walk bouclent', () => {
    expect(CLIPS.melee.onImpact).toBeGreaterThan(0);
    expect(CLIPS.idle.loop).toBe(true);
    expect(CLIPS.walk.loop).toBe(true);
  });
});

describe('sampleClip', () => {
  it('déterministe et borné', () => {
    const a = sampleClip(CLIPS.melee, 50);
    const b = sampleClip(CLIPS.melee, 50);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('clip non-bouclé : done=true après la durée', () => {
    expect(sampleClip(CLIPS.melee, clipDuration(CLIPS.melee) + 10).done).toBe(true);
  });
  it('clip bouclé : jamais done', () => {
    expect(sampleClip(CLIPS.idle, clipDuration(CLIPS.idle) * 3 + 5).done).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run src/gameIso/rig/anim/clips.test.ts`
Expected : FAIL — module introuvable.

- [ ] **Step 3 : Implémenter `clips.ts`** (angles initiaux à régler au navigateur)

```ts
// src/gameIso/rig/anim/clips.ts
import type { Pose } from '../poses';
import { ease, lerpPose, type Easing } from './tween';

export interface ClipStep { pose: Pose; ms: number; easing?: Easing; }
export interface Clip { steps: ClipStep[]; onImpact?: number; loop?: boolean; }
export type ClipName = 'melee' | 'ranged' | 'cast' | 'dodge' | 'parry' | 'hit' | 'fall' | 'walk' | 'idle';

const REST: Pose = {};

export const CLIPS: Record<ClipName, Clip> = {
  // Bras droit (arme) en arrière puis fente avant ; léger pivot du torse.
  melee: {
    steps: [
      { pose: { epauleD: -35, avantBrasD: -25, torse: -6 }, ms: 130, easing: 'easeOut' },
      { pose: { epauleD: 55, avantBrasD: 20, torse: 8, bassin: 4 }, ms: 90, easing: 'easeOutBack' },
      { pose: REST, ms: 200, easing: 'easeInOut' },
    ],
    onImpact: 200, // début du strike
  },
  // Bras tendu vers la cible, petite détente.
  ranged: {
    steps: [
      { pose: { epauleD: 70, avantBrasD: -10, torse: -4 }, ms: 160, easing: 'easeOut' },
      { pose: { epauleD: 60, avantBrasD: 5 }, ms: 70, easing: 'easeOut' },
      { pose: REST, ms: 180, easing: 'easeInOut' },
    ],
    onImpact: 180, // relâche
  },
  // Bras levés, canalisation.
  cast: {
    steps: [
      { pose: { epauleG: -60, epauleD: -60, avantBrasG: -30, avantBrasD: -30, tete: -6 }, ms: 220, easing: 'easeOut' },
      { pose: { epauleG: -70, epauleD: -70, torse: -4 }, ms: 160, easing: 'easeInOut' },
      { pose: REST, ms: 200, easing: 'easeInOut' },
    ],
    onImpact: 380,
  },
  // Bascule latérale rapide + retour.
  dodge: {
    steps: [
      { pose: { bassin: -16, torse: -10, tete: -6 }, ms: 110, easing: 'easeOut' },
      { pose: REST, ms: 220, easing: 'easeInOut' },
    ],
  },
  // Arme/bouclier levés en garde.
  parry: {
    steps: [
      { pose: { epauleG: -50, avantBrasG: -40, torse: 4 }, ms: 90, easing: 'easeOut' },
      { pose: REST, ms: 260, easing: 'easeInOut' },
    ],
  },
  // Recul du buste à l'impact.
  hit: {
    steps: [
      { pose: { torse: 14, tete: 12, bassin: 6 }, ms: 90, easing: 'easeOut' },
      { pose: REST, ms: 240, easing: 'easeInOut' },
    ],
  },
  // Chute vers une pose au sol (tenue par hold).
  fall: {
    steps: [
      { pose: { bassin: 30, torse: 40, tete: 30, cuisseG: 40, cuisseD: 30 }, ms: 320, easing: 'easeOut' },
    ],
  },
  // Cycle de marche (boucle) : jambes/bras alternés.
  walk: {
    steps: [
      { pose: { cuisseG: 18, cuisseD: -18, epauleG: -12, epauleD: 12, bassin: 1 }, ms: 200, easing: 'easeInOut' },
      { pose: { cuisseG: -18, cuisseD: 18, epauleG: 12, epauleD: -12, bassin: 1 }, ms: 200, easing: 'easeInOut' },
    ],
    loop: true,
  },
  // Respiration subtile (boucle) — remplace le « bob » perdu au passage au rig.
  idle: {
    steps: [
      { pose: { torse: 1.5, tete: 1 }, ms: 1500, easing: 'easeInOut' },
      { pose: REST, ms: 1500, easing: 'easeInOut' },
    ],
    loop: true,
  },
};

export function clipDuration(clip: Clip): number {
  return clip.steps.reduce((a, s) => a + s.ms, 0);
}

/** Pose échantillonnée à `elapsed` ms depuis le début (départ = repos). PUR. */
export function sampleClip(clip: Clip, elapsed: number): { pose: Pose; done: boolean } {
  const total = clipDuration(clip);
  if (clip.loop) {
    const e = elapsed % total;
    return { pose: sampleAt(clip, e), done: false };
  }
  if (elapsed >= total) return { pose: clip.steps[clip.steps.length - 1].pose, done: true };
  return { pose: sampleAt(clip, elapsed), done: false };
}

function sampleAt(clip: Clip, e: number): Pose {
  let t = 0;
  let prev: Pose = REST;
  for (const step of clip.steps) {
    if (e < t + step.ms) {
      const local = ease(step.easing ?? 'easeOut', (e - t) / step.ms);
      return lerpPose(prev, step.pose, local);
    }
    t += step.ms;
    prev = step.pose;
  }
  return prev;
}
```

- [ ] **Step 4 : Lancer (succès attendu)**

Run: `npx vitest run src/gameIso/rig/anim/clips.test.ts`
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/rig/anim/clips.ts src/gameIso/rig/anim/clips.test.ts
git commit -m "feat(anim): bibliotheque de clips + sampleClip (echantillonnage pur)"
```

---

## Task 4 : `useRigClip` — hook rAF

**Files:** Create `src/gameIso/rig/anim/useRigClip.ts`

> Hook fin (touche rAF/DOM) — pas de test unitaire (la logique pure est testée en Task 2/3) ;
> validé à la recette navigateur (Task 9).

- [ ] **Step 1 : Implémenter `useRigClip.ts`**

```ts
// src/gameIso/rig/anim/useRigClip.ts
import { useEffect, useRef, useState } from 'react';
import type { Pose } from '../poses';
import { CLIPS, clipDuration, sampleClip, type ClipName } from './clips';

interface Active { name: ClipName; start: number; onImpact?: () => void; impactDone: boolean; onDone?: () => void; hold: boolean; }

export function useRigClip() {
  const [pose, setPose] = useState<Pose>({});
  const active = useRef<Active>({ name: 'idle', start: 0, impactDone: true, hold: false });
  const raf = useRef(0);

  useEffect(() => {
    let mounted = true;
    if (active.current.start === 0) active.current.start = performance.now();
    const loop = (now: number) => {
      const a = active.current;
      const clip = CLIPS[a.name];
      const elapsed = now - a.start;
      const { pose: p, done } = sampleClip(clip, elapsed);
      setPose(p);
      if (!a.impactDone && clip.onImpact != null && elapsed >= clip.onImpact) {
        a.impactDone = true;
        a.onImpact?.();
      }
      if (done && !clip.loop && !a.hold) {
        a.onDone?.();
        active.current = { name: 'idle', start: now, impactDone: true, hold: false };
      }
      if (mounted) raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { mounted = false; cancelAnimationFrame(raf.current); };
  }, []);

  const play = (name: ClipName, opts?: { onImpact?: () => void; onDone?: () => void }) => {
    active.current = { name, start: performance.now(), onImpact: opts?.onImpact, onDone: opts?.onDone, impactDone: false, hold: false };
  };
  const hold = (name: ClipName) => {
    active.current = { name, start: performance.now(), impactDone: true, hold: true };
  };

  return { pose, play, hold };
}
```

- [ ] **Step 2 : Typecheck**

Run: `npm run typecheck`
Expected : PASS.

- [ ] **Step 3 : Commit**

```bash
git add src/gameIso/rig/anim/useRigClip.ts
git commit -m "feat(anim): hook useRigClip (boucle rAF, play/hold)"
```

---

## Task 5 : Enrichir le payload `ANIM_ATTACK` + `EVT.ANIM_IMPACT`

**Files:** Modify `src/state/bus.ts`, `src/state/store.ts` (`doAttack` ~`:538`, `castSpell` ~`:618`)

- [ ] **Step 1 : Ajouter l'événement + doc dans `bus.ts`**

Dans l'objet `EVT` :

```ts
  /** Phaser → React : jouer une animation d'attaque {from,to,result,kind,defense}. */
  ANIM_ATTACK: 'anim_attack',
  /** rig → React : impact d'attaque atteint (timing du dégât flottant) {to,result}. */
  ANIM_IMPACT: 'anim_impact',
```

- [ ] **Step 2 : Enrichir `doAttack`** — au `bus.emit(EVT.ANIM_ATTACK …)` (~`store.ts:538`) :

```ts
  const kind = weapon.type === 'ranged' ? 'ranged' : 'melee';
  const defense = bestDefenseMode(target); // déjà calculé plus haut pour resolveMelee
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind, defense });
```

> `bestDefenseMode(target)` est déjà appelé dans `doAttack` pour `resolveMelee` ; réutiliser
> la même valeur (l'extraire dans une const si besoin). Pour une attaque à distance, `defense`
> est ignoré côté anim (pas de parade/esquive sur un tir non opposé) → passer `'none'`.

```ts
  // variante distance : pas de défense opposée
  const defense = weapon.type === 'ranged' ? 'none' : bestDefenseMode(target);
```

- [ ] **Step 3 : Enrichir `castSpell`** — au `bus.emit(EVT.ANIM_ATTACK …)` (~`store.ts:618`) :

```ts
  bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', defense: 'none' });
```

- [ ] **Step 4 : Typecheck + tests moteur (non-régression)**

Run: `npm run typecheck && npx vitest run src/engine src/state`
Expected : PASS (payload élargi, aucune logique de règle changée).

> Si `src/state/store.test.ts` (WIP éventuel) échoue pour une raison hors sujet, vérifier
> que ce n'est pas lié à ces 3 lignes ; sinon ne pas s'en préoccuper.

- [ ] **Step 5 : Commit**

```bash
git add src/state/bus.ts src/state/store.ts
git commit -m "feat(anim): payload ANIM_ATTACK enrichi (kind+defense) + EVT.ANIM_IMPACT"
```

---

## Task 6 : `AnimatedRigToken` — composant animé par combattant

**Files:** Create `src/gameIso/AnimatedRigToken.tsx` ; Test `src/gameIso/AnimatedRigToken.test.tsx`

- [ ] **Step 1 : Test headless (échec attendu)**

```tsx
// src/gameIso/AnimatedRigToken.test.tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatedRigToken } from './AnimatedRigToken';
import type { Combatant } from '../engine/types';

const hero = { id: 'h1', name: 'Test', kind: 'hero', career: 'Soldat',
  appearance: { species: 'Humain', sex: 'M', build: 0.5 } } as unknown as Combatant;

describe('AnimatedRigToken', () => {
  it('rend le rig du combattant (os nommés)', () => {
    const html = renderToStaticMarkup(<svg><AnimatedRigToken combatant={hero} /></svg>);
    expect(html).toContain('data-bone=');
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run src/gameIso/AnimatedRigToken.test.tsx`
Expected : FAIL — module introuvable.

- [ ] **Step 3 : Implémenter `AnimatedRigToken.tsx`**

```tsx
// src/gameIso/AnimatedRigToken.tsx
import { useEffect } from 'react';
import { bus, EVT } from '../state/bus';
import { isOutOfAction } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { RigSprite } from './rig/composeRig';
import { defaultAppearance } from './rig/appearance';
import { equipFromCombatant } from './rig/parts/equipment';
import { useRigClip } from './rig/anim/useRigClip';
import type { ClipName } from './rig/anim/clips';

const CLIP_FOR_KIND: Record<string, ClipName> = { melee: 'melee', ranged: 'ranged', spell: 'cast' };

/** Token héros animé : rend RigSprite avec la pose courante, réagit au bus. */
export function AnimatedRigToken({ combatant }: { combatant: Combatant }) {
  const { pose, play, hold } = useRigClip();

  useEffect(() => {
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.from === combatant.id) {
        play(CLIP_FOR_KIND[d.kind] ?? 'melee', {
          onImpact: () => bus.emit(EVT.ANIM_IMPACT, { to: d.to, result: d.result }),
        });
      } else if (d.to === combatant.id && !d.result?.hit) {
        play(d.defense === 'parade' ? 'parry' : 'dodge'); // réaction immédiate sur un raté
      }
    });
    const offImpact = bus.on(EVT.ANIM_IMPACT, (d: any) => {
      if (d.to === combatant.id && d.result?.hit) play('hit'); // recul au bon timing
    });
    const offMove = bus.on(EVT.ANIM_MOVE, (d: any) => {
      if (d.id === combatant.id) play('walk');
    });
    return () => { offAttack(); offImpact(); offMove(); };
  }, [combatant.id, play]);

  // Chute tenue si hors d'action.
  useEffect(() => {
    if (isOutOfAction(combatant)) hold('fall');
  }, [combatant, hold]);

  return (
    <RigSprite
      appearance={combatant.appearance ?? defaultAppearance(combatant)}
      equip={equipFromCombatant(combatant)}
      career={combatant.career}
      pose={pose}
    />
  );
}
```

- [ ] **Step 4 : Lancer (succès attendu)**

Run: `npx vitest run src/gameIso/AnimatedRigToken.test.tsx && npm run typecheck`
Expected : PASS + 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/AnimatedRigToken.tsx src/gameIso/AnimatedRigToken.test.tsx
git commit -m "feat(anim): AnimatedRigToken (rig anime + abonnement bus)"
```

---

## Task 7 : Intégration IsoStage — héros animés + float sur impact + anim créatures

**Files:** Modify `src/gameIso/IsoStage.tsx`

- [ ] **Step 1 : Rendre les héros via `AnimatedRigToken`**

Dans la boucle combat (héros), remplacer le `<RigSprite …/>` passé à `tokenNode` par
`<AnimatedRigToken combatant={c} />`. Idem pour le leader du groupe (exploration). Ajouter
l'import :

```tsx
import { AnimatedRigToken } from './AnimatedRigToken';
```

Le `tokenNode(c.id, c.pos.x, c.pos.y, <AnimatedRigToken combatant={c} />, 0.62, ring, isOutOfAction(c))`
reste identique par ailleurs (ombre/anneau/échelle).

- [ ] **Step 2 : Déclencher le dégât flottant sur `ANIM_IMPACT` (au lieu de `ANIM_ATTACK`)**

Dans l'effet des floats (`IsoStage.tsx`, abonnement actuel à `EVT.ANIM_ATTACK`), changer
l'événement écouté en `EVT.ANIM_IMPACT` et lire `{ to, result }` :

```tsx
    const off = bus.on(EVT.ANIM_IMPACT, (d: any) => {
      const b = useGame.getState().battle;
      if (!b || !d?.result?.hit) return;
      const target = b.combatants.find((c) => c.id === d.to);
      if (!target?.pos) return;
      const key = ++floatId.current;
      setFloats((f) => [...f, { key, x: target.pos!.x, y: target.pos!.y, text: `-${d.result.woundsLost}`, crit: !!d.result.critical }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 850);
    });
```

- [ ] **Step 3 : Anim légère des créatures (tokens monolithiques)**

Pour les combattants non-héros (rendus par `enemySprite` via `token`), ajouter une classe CSS
de réaction. Dans `anim.css`, ajouter :

```css
@keyframes tok-lunge { 0%{transform:translateY(0)} 40%{transform:translate(0,-4px) scale(1.04)} 100%{transform:translateY(0)} }
@keyframes tok-recoil { 0%{transform:translateX(0)} 30%{transform:translateX(5px) rotate(3deg)} 100%{transform:translateX(0)} }
.tok-lunge { animation: tok-lunge 0.3s ease-out; }
.tok-recoil { animation: tok-recoil 0.32s ease-out; }
```

Gérer une classe transient par token créature : un état React `creatureFx: Record<id,'lunge'|'recoil'>` alimenté par les mêmes événements (`ANIM_ATTACK` from=créature → 'lunge' ; `ANIM_IMPACT` to=créature → 'recoil'), nettoyé après ~320 ms. Appliquer la classe au `<g>` du token créature.

> Détail d'API laissé à l'implémentation (état + setTimeout, sur le modèle des floats). Les
> créatures ne sont pas riggées → pas d'anim par os, seulement transform de token.

- [ ] **Step 4 : Typecheck + tests + build**

Run: `npm run typecheck && npx vitest run src/gameIso && npx vite build`
Expected : PASS + build OK.

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/IsoStage.tsx src/gameIso/anim.css
git commit -m "feat(anim): heros animes dans IsoStage + float sur impact + anim legere creatures"
```

---

## Task 8 : Projectile volant (distance + sort)

**Files:** Modify `src/gameIso/IsoStage.tsx` (état + rendu projectiles)

- [ ] **Step 1 : Émettre l'arc du projectile**

S'abonner à `EVT.ANIM_ATTACK` ; si `kind ∈ {ranged, spell}`, créer un projectile
`{ key, from: posFrom, to: posTo, kind, t0 }` dans un état `projectiles[]`. Interpoler sa
position via rAF/`setTimeout` (sur le modèle des floats) de `from` à `to` sur ~`onImpact` ms,
puis le retirer.

```tsx
type Proj = { key: number; fromTile: Pt; toTile: Pt; kind: string };
const [projs, setProjs] = useState<Proj[]>([]);
// dans l'effet bus :
const offP = bus.on(EVT.ANIM_ATTACK, (d: any) => {
  if (d.kind !== 'ranged' && d.kind !== 'spell') return;
  const b = useGame.getState().battle; if (!b) return;
  const from = b.combatants.find((c) => c.id === d.from)?.pos;
  const to = b.combatants.find((c) => c.id === d.to)?.pos;
  if (!from || !to) return;
  const key = ++projId.current;
  setProjs((p) => [...p, { key, fromTile: from, toTile: to, kind: d.kind }]);
  setTimeout(() => setProjs((p) => p.filter((x) => x.key !== key)), 320);
});
```

- [ ] **Step 2 : Rendre le projectile** — un petit élément SVG (flèche pour `ranged`, trait
lumineux `url(#g_glow)` pour `spell`) positionné par interpolation entre `tileCenter(from)` et
`tileCenter(to)` (animation CSS de translation de 320 ms, ou interpolation par frame). Ajouter
dans le rendu, au-dessus des tokens.

```tsx
{projs.map((p) => {
  const a = tileCenter(p.fromTile.x, p.fromTile.y, dims);
  const b = tileCenter(p.toTile.x, p.toTile.y, dims);
  const angle = (Math.atan2(b.cy - a.cy, b.cx - a.cx) * 180) / Math.PI;
  return (
    <g key={`p${p.key}`} className="proj" style={{ ['--ax' as any]: `${a.cx}px`, ['--ay' as any]: `${a.cy}px`, ['--bx' as any]: `${b.cx}px`, ['--by' as any]: `${b.cy}px` }}>
      {p.kind === 'spell'
        ? <circle r={5} fill="url(#g_glow)" />
        : <rect x={-7} y={-1} width={14} height={2} rx={1} fill="#caa882" transform={`rotate(${angle})`} />}
    </g>
  );
})}
```

Et dans `anim.css` une keyframe `@keyframes proj-fly { from{transform:translate(var(--ax),var(--ay))} to{transform:translate(var(--bx),var(--by))} } .proj{animation:proj-fly 0.3s linear forwards;}`.

> Alternative (si les CSS vars SVG posent souci) : interpoler la position par rAF dans l'état.
> L'important est le projectile from→to synchronisé avec `onImpact`.

- [ ] **Step 2b : Typecheck + build**

Run: `npm run typecheck && npx vite build`
Expected : PASS.

- [ ] **Step 3 : Commit**

```bash
git add src/gameIso/IsoStage.tsx src/gameIso/anim.css
git commit -m "feat(anim): projectile volant (fleche/trait magique) synchronise a l'impact"
```

---

## Task 9 : Recette navigateur (Playwright)

**Files:** aucune modif de code (validation ; corriger + recommiter si bug visuel).

- [ ] **Step 1 : Serveur de dev**

Run (background) : `npm run dev` → noter le port (souvent 5173, sinon 517x).

- [ ] **Step 2 : Lancer un combat**

Playwright : `localhost:<port>` → « 🧪 Test rapide » → engager le combat (déplacer un héros au contact, attaquer). Vérifier **console : 0 erreur**.

- [ ] **Step 3 : Vérifier les anims**

- Mêlée : fente de l'attaquant ; **recul de la cible au moment de l'impact** (pas avant) ; dégât flottant synchronisé.
- Distance : projectile (flèche) vole de l'archer à la cible.
- Sort : canalisation (bras levés) + trait magique.
- Raté : esquive ou parade de la cible.
- Mort : chute (`fall`) tenue.
- Marche : cycle de jambes pendant le déplacement.
- Idle : respiration subtile au repos.
Screenshots `anim-melee.png`, `anim-ranged.png`, `anim-cast.png`.

- [ ] **Step 4 : Régler les angles** — si une pose est moche, ajuster les valeurs dans
`clips.ts` (Task 3) et relancer la recette. Itérer clip par clip.

- [ ] **Step 5 : Commit éventuel des réglages**

```bash
git add src/gameIso/rig/anim/clips.ts
git commit -m "fix(anim): reglage des angles de clips (recette navigateur)"
```

---

## Self-review (rempli par l'auteur du plan)

- **Couverture du spec** : §2 moteur rAF→Tasks 2/3/4 ; §3 archi (tween/clips/hook/AnimatedRigToken)→Tasks 2-6 ; §4 clips→Task 3 ; §5 câblage+enrichissement→Tasks 5/6 ; §6 projectiles+impact→Tasks 7(float-impact)/8 ; §7 créatures→Task 7 ; §8 périmètre (postures hors C)→respecté (fall transitionnel seulement) ; §9 tests→tween/clips tests + Task 9. ✔ Pose additive (pré-requis non explicite du spec mais nécessaire à l'interpolation)→Task 1.
- **Placeholder scan** : code complet pour tween/clips/sampleClip/useRigClip/AnimatedRigToken ; les angles de clips sont des valeurs initiales explicitement réglées en Task 9 (pas un TODO caché) ; Task 7 Step 3 / Task 8 Step 2 laissent un détail d'état transient à l'implémentation, sur le modèle EXISTANT des floats (référencé), avec le code principal fourni.
- **Cohérence des types** : `Pose`, `Easing`, `ease`, `lerpPose`, `Clip`/`ClipStep`/`ClipName`, `CLIPS`, `clipDuration`, `sampleClip`, `useRigClip`→`{pose,play,hold}`, `AnimatedRigToken({combatant})`, `EVT.ANIM_IMPACT`, payload `{from,to,result,kind,defense}` — noms identiques entre tâches. ✔
