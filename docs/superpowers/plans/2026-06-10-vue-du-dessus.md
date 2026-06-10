# Vue du dessus (mode bascule) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une vue du dessus (grille carrée, décor en vue de face, personnages en pion-portrait) en **mode bascule** à côté de l'isométrique, disponible dans le jeu **et** l'éditeur.

**Architecture:** La projection est isolée dans `src/gameIso/iso.ts`. On y ajoute un 2ᵉ axe `view: 'iso' | 'top'` à `Dims` (comme `rot`). La grille carrée, le picking, la taille de scène et la profondeur en héritent. Seuls les **acteurs** divergent : en `top` ils deviennent un disque-portrait (via `pickBackend` view-aware + un mode `flat` de `BodyToken`) ; le décor reste un billboard de face. Un bouton dans `ViewControls` (déjà partagé jeu↔éditeur) bascule l'état (`store.viewMode` côté jeu, `useEditorView.viewMode` côté éditeur).

**Tech Stack:** Vite + TypeScript + React, rendu SVG, Zustand (store), Vitest (`renderToStaticMarkup` pour les tests de rendu headless).

**Référence design:** `docs/superpowers/specs/2026-06-10-vue-du-dessus-design.md`

**Conventions de ce dépôt:**
- Commits par lots simples ; ne PAS sur-peaufiner. Working tree partagé avec d'autres sessions → committer par pathspec (`git commit -m "…" -- <chemins>`), jamais `--amend`.
- Tests/typecheck via les runners (`npx vitest run …`, `npm run typecheck`).
- UI/commentaires en **français**.

---

## File Structure

| Fichier | Rôle | Action |
| --- | --- | --- |
| `src/gameIso/iso.ts` | Projection (axe `view`) | Modifier |
| `src/gameIso/iso.test.ts` | Tests projection top-mode | Modifier |
| `src/gameIso/BodyToken.tsx` | Mode `flat` (disque) | Modifier |
| `src/gameIso/BodyToken.test.tsx` | Test du mode flat | Créer |
| `src/gameIso/pickBackend.tsx` | `view`-aware + cadrage visage | Modifier |
| `src/gameIso/pickBackend.test.tsx` | Test pickBackend top-mode | Créer |
| `src/ui/RigPortrait.tsx` | Consomme pickBackend top-mode | Modifier |
| `src/ui/RigPortrait.test.tsx` | Parité du portrait HUD | Créer |
| `src/state/store.ts` | `viewMode` + `toggleViewMode` + reset | Modifier |
| `src/state/store.test.ts` | Toggle + persistance au reset | Modifier |
| `src/ui/ViewControls.tsx` | Bouton bascule | Modifier |
| `src/ui/CampaignView.tsx` | Câblage du bouton (jeu) | Modifier |
| `src/gameIso/IsoStage.tsx` | `dims.view` + pions-portraits | Modifier |
| `src/ui/editor/useEditorView.ts` | `viewMode`/`setViewMode` (éditeur) | Modifier |
| `src/ui/editor/Editor.tsx` | `dims.view` + câblage bouton | Modifier |
| `src/gameIso/EntityToken.tsx` | Disque en top-mode | Modifier |
| `src/gameIso/BuildingSprite.tsx` | Empreinte à plat en top-mode | Modifier |

---

## Task 1: `iso.ts` — axe `view: 'top'` (géométrie)

**Files:**
- Modify: `src/gameIso/iso.ts`
- Test: `src/gameIso/iso.test.ts`

- [ ] **Step 1: Écrire les tests top-mode (échouent d'abord)**

D'abord étendre l'import existant (ligne 2) pour ajouter `CELL` et `diamondPath` :
```ts
import { rotTile, unrotTile, effDims, tileCenter, screenToTile, stageSize, depth, CELL, diamondPath, type Dims } from './iso';
```

Puis ajouter à la fin de `src/gameIso/iso.test.ts` :

```ts
describe('projection vue du dessus (view: top)', () => {
  const ROTS = [0, 1, 2, 3] as const;

  it('screenToTile inverse tileCenter (grille carrée) pour les 4 rotations', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot, view: 'top' };
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(screenToTile(cx, cy, dims)).toEqual({ x, y });
        }
    }
  });

  it('les cases voisines sont espacées de CELL (pas de skew iso)', () => {
    const dims: Dims = { w: 5, h: 5, view: 'top' };
    const a = tileCenter(2, 2, dims);
    const bx = tileCenter(3, 2, dims);
    const by = tileCenter(2, 3, dims);
    expect(bx.cx - a.cx).toBe(CELL);
    expect(bx.cy - a.cy).toBe(0); // même rangée → même cy (orthogonal, pas diagonal)
    expect(by.cy - a.cy).toBe(CELL);
    expect(by.cx - a.cx).toBe(0);
  });

  it('diamondPath est un carré axis-aligné de côté CELL', () => {
    const dims: Dims = { w: 3, h: 3, view: 'top' };
    const { cx, cy } = tileCenter(1, 1, dims);
    const h = CELL / 2;
    expect(diamondPath(1, 1, dims)).toBe(
      `M${cx - h},${cy - h} L${cx + h},${cy - h} L${cx + h},${cy + h} L${cx - h},${cy + h} Z`,
    );
  });

  it('toutes les cases tiennent dans stageSize (4 rotations)', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot, view: 'top' };
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

  it('depth suit la position écran (cy) en top-mode (4 rotations)', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 5, h: 5, rot, view: 'top' };
      const tiles: { d: number; cy: number }[] = [];
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++)
          tiles.push({ d: depth(x, y, dims), cy: tileCenter(x, y, dims).cy });
      const byDepth = [...tiles].sort((a, b) => a.d - b.d).map((t) => t.cy);
      for (let i = 1; i < byDepth.length; i++) expect(byDepth[i]).toBeGreaterThanOrEqual(byDepth[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Lancer — vérifier l'échec**

Run: `npx vitest run src/gameIso/iso.test.ts`
Expected: FAIL (`CELL` non exporté, `view` inconnu de `Dims`, projection iso pour `view:'top'`).

- [ ] **Step 3: Implémenter l'axe `view` dans `iso.ts`**

Dans `src/gameIso/iso.ts` :

a) Ajouter la constante (après `SPRITE_HEADROOM`, ligne 8) :
```ts
export const CELL = 56; // côté d'une case carrée (vue du dessus)
```

b) Étendre `Dims` (ajouter le champ `view`) :
```ts
export interface Dims {
  w: number;
  h: number;
  rot?: Rot; // orientation caméra (cran de 90° horaire) ; absent ⇒ 0
  view?: 'iso' | 'top'; // projection ; absent ⇒ 'iso'
}
```

c) Remplacer `originX` :
```ts
/** Marge à gauche pour que la case la plus à gauche reste visible (dimensions effectives). */
export function originX(dims: Dims) {
  if (dims.view === 'top') return CELL; // marge gauche = 1 case
  const ed = effDims(dims);
  return (ed.h - 1) * (TW / 2) + TW / 2;
}
```

d) Remplacer `tileCenter` :
```ts
/** Centre écran d'une case (x,y), en tenant compte de la rotation et de la projection. */
export function tileCenter(x: number, y: number, dims: Dims): { cx: number; cy: number } {
  const r = rotTile(x, y, dims);
  if (dims.view === 'top') {
    return { cx: originX(dims) + r.x * CELL, cy: originY() + r.y * CELL };
  }
  return {
    cx: originX(dims) + (r.x - r.y) * (TW / 2),
    cy: originY() + (r.x + r.y) * (TH / 2),
  };
}
```

e) Remplacer `stageSize` :
```ts
/** Taille totale du canvas SVG pour une carte donnée (dimensions effectives). */
export function stageSize(dims: Dims): { w: number; h: number } {
  const ed = effDims(dims);
  if (dims.view === 'top') {
    return { w: ed.w * CELL + 2 * CELL, h: ed.h * CELL + SPRITE_HEADROOM + CELL };
  }
  return {
    w: (ed.w + ed.h) * (TW / 2) + TW,
    h: (ed.w + ed.h) * (TH / 2) + SPRITE_HEADROOM + TH,
  };
}
```

f) Remplacer `screenToTile` :
```ts
/** Inverse : point écran (relatif au SVG) → coordonnées de case entières (dé-tourne). */
export function screenToTile(px: number, py: number, dims: Dims): { x: number; y: number } {
  if (dims.view === 'top') {
    const rx = Math.round((px - originX(dims)) / CELL);
    const ry = Math.round((py - originY()) / CELL);
    return unrotTile(rx, ry, dims);
  }
  const dx = px - originX(dims);
  const dy = py - originY();
  const a = dx / (TW / 2);
  const b = dy / (TH / 2);
  const rx = Math.round((a + b) / 2);
  const ry = Math.round((b - a) / 2);
  return unrotTile(rx, ry, dims);
}
```

g) Remplacer `diamondCorners` (en top-mode, les 4 « sommets » deviennent les 4 coins du carré — la base `groundTile` et `diamondPath` en héritent sans changement) :
```ts
/** Les 4 sommets (et le centre) de la case — losange en iso, carré en vue du dessus.
 *  En top-mode : top=NO, right=NE, bot=SE, left=SO (l'ordre compose avec groundTile/diamondPath). */
export function diamondCorners(x: number, y: number, dims: Dims) {
  const { cx, cy } = tileCenter(x, y, dims);
  if (dims.view === 'top') {
    const h = CELL / 2;
    return {
      cx,
      cy,
      top: [cx - h, cy - h] as [number, number],
      right: [cx + h, cy - h] as [number, number],
      bot: [cx + h, cy + h] as [number, number],
      left: [cx - h, cy + h] as [number, number],
    };
  }
  return {
    cx,
    cy,
    top: [cx, cy - TH / 2] as [number, number],
    right: [cx + TW / 2, cy] as [number, number],
    bot: [cx, cy + TH / 2] as [number, number],
    left: [cx - TW / 2, cy] as [number, number],
  };
}
```

h) Remplacer `depth` (tri par rangée écran en top-mode) :
```ts
/** Profondeur de tri (plus grand = devant). iso : diagonale r.x+r.y ; top : par rangée écran (r.y). */
export function depth(x: number, y: number, dims?: Dims) {
  const r = dims ? rotTile(x, y, dims) : { x, y };
  if (dims?.view === 'top') return r.y * (dims.w + dims.h) + r.x;
  return r.x + r.y;
}
```

`diamondPath` reste inchangé (il appelle `diamondCorners` → carré automatique en top).

- [ ] **Step 4: Lancer — vérifier le succès**

Run: `npx vitest run src/gameIso/iso.test.ts`
Expected: PASS (tous, iso + top).

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/iso.ts src/gameIso/iso.test.ts
git commit -m "feat(iso): axe view=top (grille carrée) dans la projection"
```

---

## Task 2: `BodyToken` — mode `flat` (disque-portrait)

**Files:**
- Modify: `src/gameIso/BodyToken.tsx`
- Test: `src/gameIso/BodyToken.test.tsx` (créer)

- [ ] **Step 1: Écrire le test (échoue d'abord)**

Créer `src/gameIso/BodyToken.test.tsx` :

```tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BodyToken } from './BodyToken';
import type { Dims } from './iso';

const dims: Dims = { w: 5, h: 5, view: 'top' };

describe('BodyToken — mode flat (disque)', () => {
  it('rend un disque clippé (cercle) au lieu du corps ancré aux pieds', () => {
    const html = renderToStaticMarkup(
      <svg>
        <BodyToken x={2} y={2} dims={dims} scale={0.6} flat portraitBox="42 28 38 38" discR={24} ring="#4f8fe0">
          <g data-bone="tete" />
        </BodyToken>
      </svg>,
    );
    expect(html).toContain('<clipPath');
    expect(html).toContain('<circle');
    expect(html).toContain('viewBox="42 28 38 38"');
    expect(html).not.toContain('rotate(78)'); // pas de bascule de mort en flat
  });

  it('en iso (non-flat) garde l’ancrage pieds (translate -150)', () => {
    const html = renderToStaticMarkup(
      <svg>
        <BodyToken x={2} y={2} dims={{ w: 5, h: 5 }} scale={0.6}>
          <g data-bone="tete" />
        </BodyToken>
      </svg>,
    );
    expect(html).toContain('translate(-36,-90)'); // -60*0.6 , -150*0.6
    expect(html).not.toContain('<clipPath');
  });
});
```

- [ ] **Step 2: Lancer — vérifier l'échec**

Run: `npx vitest run src/gameIso/BodyToken.test.tsx`
Expected: FAIL (`flat`/`portraitBox`/`discR` inconnus ; pas de `<clipPath>`).

- [ ] **Step 3: Implémenter le mode flat**

Dans `src/gameIso/BodyToken.tsx`, ajouter les imports et props, puis brancher le rendu.

a) Étendre l'import des couleurs (ligne 3) :
```tsx
import { hpColor, ACTIVE_RING } from './teamColors';
```

b) Ajouter dans la signature de props (après `active = false,`) :
```tsx
  /** Vue du dessus : rendre un disque-portrait centré sur la case (au lieu du corps ancré aux pieds). */
  flat = false,
  /** viewBox cadrant le visage/haut du corps (depuis pickBackend) — requis en flat. */
  portraitBox,
  /** Rayon du disque en px (calculé par l'appelant depuis l'empreinte) — requis en flat. */
  discR,
```
et dans le type :
```tsx
  active?: boolean;
  flat?: boolean;
  portraitBox?: string;
  discR?: number;
```

c) Remplacer le `return (…)` (lignes 65-95) par une version qui partage le wrapper de position + les badges et branche le visuel :
```tsx
  const R = discR ?? 22;
  const bodyTopY = flat ? -R : -150 * scale; // ancre haute (pour les badges)
  const clipId = `disc-${Math.round(cx)}-${Math.round(cy)}`;
  return (
    <g style={{ transform: `translate(${cx}px,${cy}px)`, transition: walking ? 'none' : 'transform 0.14s linear', opacity: dim ? (flat ? 0.5 : 0.82) : 1 }}>
      {flat ? (
        <>
          <ellipse cx={0} cy={R * 0.92} rx={R} ry={R * 0.32} fill="#000" opacity={0.28} />
          {active && <circle cx={0} cy={0} r={R + 4} fill="none" stroke={ACTIVE_RING} strokeWidth={3} opacity={0.85} />}
          <clipPath id={clipId}>
            <circle cx={0} cy={0} r={R} />
          </clipPath>
          <circle cx={0} cy={0} r={R} fill="#1b2030" />
          <g clipPath={`url(#${clipId})`}>
            <svg x={-R} y={-R} width={2 * R} height={2 * R} viewBox={portraitBox} preserveAspectRatio="xMidYMid slice">
              {children}
            </svg>
          </g>
          {veil && <circle cx={0} cy={0} r={R} fill={veil} opacity={0.16} pointerEvents="none" />}
          {ring && <circle cx={0} cy={0} r={R} fill="none" stroke={ring} strokeWidth={2.5} strokeDasharray={ringDash} />}
        </>
      ) : (
        <>
          <ellipse cx={0} cy={0} rx={16 * scale + 5} ry={(16 * scale + 5) / 2} fill="#000" opacity={0.33} />
          {active && <ellipse cx={0} cy={0} rx={20 * scale} ry={10 * scale} fill="#ffe066" opacity={0.2} />}
          {ring && <ellipse cx={0} cy={0} rx={18 * scale} ry={9 * scale} fill="none" stroke={ring} strokeWidth={2.5} strokeDasharray={ringDash} />}
          <g className={dim ? undefined : fx} transform={dim && !bakedDeath ? 'rotate(78)' : undefined}>
            <g transform={`translate(${-60 * scale},${-150 * scale}) scale(${scale})`}>{children}</g>
          </g>
          {veil && <ellipse cx={0} cy={-44 * scale} rx={17 * scale} ry={34 * scale} fill={veil} opacity={0.11} pointerEvents="none" />}
        </>
      )}
      {(hpRatio != null || nIcons > 0) && (
        <g transform={`translate(0,${bodyTopY - 8})`} pointerEvents="none">
          {nIcons > 0 && (
            <g>
              {iconList.map((ic, i) => (
                <text key={i} x={iconStart + i * 11} y={-3} fontSize={11} textAnchor="middle">{ic}</text>
              ))}
              {iconsMore > 0 && (
                <text x={iconStart + iconList.length * 11} y={-3} fontSize={8} fill="#cdb8d8" textAnchor="middle">+{iconsMore}</text>
              )}
            </g>
          )}
          {hpRatio != null && (
            <>
              <rect x={-13} y={0} width={26} height={4} rx={2} fill="#000" opacity={0.65} />
              <rect x={-13} y={0} width={26 * hpRatio} height={4} rx={2} fill={hpColor(hpRatio)} />
            </>
          )}
        </g>
      )}
    </g>
  );
```

- [ ] **Step 4: Lancer — vérifier le succès**

Run: `npx vitest run src/gameIso/BodyToken.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/BodyToken.tsx src/gameIso/BodyToken.test.tsx
git commit -m "feat(token): mode flat (disque-portrait) de BodyToken pour la vue du dessus"
```

---

## Task 3: `pickBackend` — conscient de `view` + cadrage visage

**Files:**
- Modify: `src/gameIso/pickBackend.tsx`
- Test: `src/gameIso/pickBackend.test.tsx` (créer)

- [ ] **Step 1: Écrire le test (échoue d'abord)**

Créer `src/gameIso/pickBackend.test.tsx` :

```tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { pickBackend } from './pickBackend';
import type { Combatant } from '../engine/types';
import type { SceneEntity } from '../state/scene';

const hero = { id: 'h1', kind: 'hero', name: 'Soldat', career: 'Soldat', appearance: { species: 'Humain', sex: 'M', build: 0.5, seed: 3 } } as unknown as Combatant;

describe('pickBackend — view top', () => {
  it('héros bipède : flat=true + portraitBox + corps en vue de face', () => {
    const r = pickBackend({ kind: 'combatant', combatant: hero }, 'top');
    expect(r.flat).toBe(true);
    expect(r.portraitBox).toMatch(/^[\d.\-]+ [\d.\-]+ [\d.\-]+ [\d.\-]+$/);
    const html = renderToStaticMarkup(<svg>{r.body}</svg>);
    expect(html).toContain('data-bone="tete"');
  });

  it('iso (défaut) : flat=false', () => {
    const r = pickBackend({ kind: 'combatant', combatant: hero });
    expect(r.flat).toBe(false);
  });

  it('décor (prop) : flat=false même en top', () => {
    const ent = { id: 'p1', kind: 'prop', ref: 'tonneau', pos: { x: 0, y: 0 } } as SceneEntity;
    const r = pickBackend({ kind: 'sceneEntity', ent }, 'top');
    expect(r.backend).toBe('sprite');
    expect(r.flat).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer — vérifier l'échec**

Run: `npx vitest run src/gameIso/pickBackend.test.tsx`
Expected: FAIL (`flat` n'existe pas ; `view` ignoré).

- [ ] **Step 3: Réécrire `pickBackend.tsx`**

Remplacer intégralement `src/gameIso/pickBackend.tsx` par :

```tsx
import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import type { SceneEntity } from '../state/scene';
import { isOutOfAction } from '../engine/conditions';
import { AnimatedRigToken } from './AnimatedRigToken';
import { AmbientRigToken } from './AmbientRigToken';
import { AnimatedPlanToken } from './AnimatedPlanToken';
import { enemyRigProfile, entityRigProfile, classifyEnemy } from './rig/enemyProfile';
import { bodyPlanOf } from './rig/bodyPlan';
import { bipedSpeciesScale, creatureSpeciesScale } from './rig/creatures';
import { entitySprite, pnjSprite } from './sprites';
import { hashSeed } from './appearance';
import { resolveRig, RigSprite } from './rig/composeRig';
import { defaultAppearance } from './rig/appearance';
import { equipFromCombatant } from './rig/parts/equipment';

export type TokenSubject =
  | { kind: 'combatant'; combatant: Combatant }
  | { kind: 'sceneEntity'; ent: SceneEntity }
  | { kind: 'partyLeader'; leader?: Combatant };

export interface PickedBackend {
  backend: 'rig' | 'plan' | 'sprite';
  body: ReactNode;
  speciesScale: number;
  id: string;
  portraitBox: string;
  /** Vue du dessus : ce sujet doit être rendu en disque-portrait centré (true) ou billboard ancré (false). */
  flat: boolean;
}

/** Gros plan VISAGE d'un humanoïde (tête centrée ~(60,46) dans la boîte 120×150). */
const FACE_BOX = '42 28 38 38';
/** Cadre PORTRAIT d'une créature non-bipède : haut-avant du corps. */
const CREATURE_BOX = '22 14 80 80';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Vue de face cadrée sur le visage (top-mode) — math partagée avec RigPortrait (HUD). PUR. */
function faceFrame(appearance: any, equip: any, career: any, overlays: any): { body: ReactNode; box: string } {
  const bones = resolveRig(appearance, equip, {}, career, 'front', overlays);
  const tete = bones.find((b) => b.id === 'tete');
  const m = tete?.matrix ?? [1, 0, 0, 1, 60, 54];
  const sy = tete?.scale[1] ?? 1;
  const cx = m[4];
  const cy = m[5] + 10 * sy;
  const S = 46 * Math.max(0.9, sy);
  return {
    body: <RigSprite appearance={appearance} equip={equip} career={career} view="front" overlays={overlays} />,
    box: `${(cx - S / 2).toFixed(1)} ${(cy - S / 2).toFixed(1)} ${S.toFixed(1)} ${S.toFixed(1)}`,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * CLASSIFIEUR UNIQUE : décide quel backend monter (rig humanoïde / plan non-bipède / sprite)
 * et produit le corps prêt à insérer. `view: 'top'` → les ACTEURS deviennent un disque-portrait
 * (vue de face cadrée, `flat: true`) ; le décor reste un billboard (`flat: false`).
 */
export function pickBackend(subject: TokenSubject, view: 'iso' | 'top' = 'iso'): PickedBackend {
  const top = view === 'top';

  if (subject.kind === 'combatant') {
    const c = subject.combatant;
    if (classifyEnemy(c.name) === 'rig') {
      const prof = c.kind === 'hero' ? null : enemyRigProfile(c);
      if (top) {
        const appearance = prof?.appearance ?? c.appearance ?? defaultAppearance(c);
        const equip = prof?.equip ?? equipFromCombatant(c);
        const career = prof?.career ?? c.career;
        const overlays = prof?.overlays ?? [];
        const f = faceFrame(appearance, equip, career, overlays);
        return { backend: 'rig', id: c.id, speciesScale: bipedSpeciesScale(c.name), portraitBox: f.box, flat: true, body: f.body };
      }
      return { backend: 'rig', id: c.id, speciesScale: bipedSpeciesScale(c.name), portraitBox: FACE_BOX, flat: false, body: <AnimatedRigToken combatant={c} profile={prof ?? undefined} /> };
    }
    return { backend: 'plan', id: c.id, speciesScale: creatureSpeciesScale(c.name), portraitBox: CREATURE_BOX, flat: top, body: <AnimatedPlanToken id={c.id} name={c.name} colors={c.appearance?.colors} dead={isOutOfAction(c)} /> };
  }

  if (subject.kind === 'partyLeader') {
    const leader = subject.leader;
    if (leader) {
      if (top) {
        const f = faceFrame(leader.appearance ?? defaultAppearance(leader), equipFromCombatant(leader), leader.career, []);
        return { backend: 'rig', id: '__party', speciesScale: 1, portraitBox: f.box, flat: true, body: f.body };
      }
      return { backend: 'rig', id: '__party', speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <AnimatedRigToken combatant={leader} /> };
    }
    return { backend: 'sprite', id: '__party', speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <g dangerouslySetInnerHTML={{ __html: pnjSprite() }} /> };
  }

  // sceneEntity (exploration + éditeur)
  const ent = subject.ent;
  const id = `e-${ent.id}`;
  const seed = ent.appearance?.seed ?? hashSeed(ent.id);
  const prof =
    ent.kind === 'personnage'
      ? entityRigProfile(ent.ref ?? ent.label ?? 'Villageois', seed, { career: ent.appearance?.career, monster: ent.appearance?.monster, weapon: ent.weapon, colors: ent.appearance?.colors, parts: ent.appearance?.parts, sex: ent.appearance?.sex, build: ent.appearance?.build })
      : null;
  if (prof) {
    if (top) {
      const f = faceFrame(prof.appearance, prof.equip, prof.career, prof.overlays ?? []);
      return { backend: 'rig', id, speciesScale: bipedSpeciesScale(ent.ref ?? ent.label ?? ''), portraitBox: f.box, flat: true, body: f.body };
    }
    return { backend: 'rig', id, speciesScale: bipedSpeciesScale(ent.ref ?? ent.label ?? ''), portraitBox: FACE_BOX, flat: false, body: <AmbientRigToken profile={prof} anim={ent.anim ?? ''} id={id} facing={ent.facing} /> };
  }
  const refName = ent.ref ?? ent.label ?? '';
  const planId = bodyPlanOf(refName);
  if (planId !== 'biped' && planId !== 'monolithic') {
    return { backend: 'plan', id, speciesScale: creatureSpeciesScale(refName), portraitBox: CREATURE_BOX, flat: top, body: <AnimatedPlanToken id={id} name={refName} colors={ent.appearance?.colors} facing={ent.facing} /> };
  }
  return { backend: 'sprite', id, speciesScale: 1, portraitBox: FACE_BOX, flat: false, body: <g dangerouslySetInnerHTML={{ __html: entitySprite(ent) }} /> };
}
```

> Note : `enemyRigProfile`/`entityRigProfile` exposent `appearance`/`equip`/`career`/`overlays` (déjà consommés par l'ancien `RigPortrait`). Si le typage de `prof.overlays` est absent, utiliser `prof.overlays ?? []`.

- [ ] **Step 4: Lancer — vérifier le succès**

Run: `npx vitest run src/gameIso/pickBackend.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/pickBackend.tsx src/gameIso/pickBackend.test.tsx
git commit -m "feat(token): pickBackend view-aware (disque-portrait + cadrage visage)"
```

---

## Task 4: `RigPortrait` — consomme pickBackend top-mode (dédup)

**Files:**
- Modify: `src/ui/RigPortrait.tsx`
- Test: `src/ui/RigPortrait.test.tsx` (créer)

- [ ] **Step 1: Écrire le test de parité (échoue d'abord)**

Créer `src/ui/RigPortrait.test.tsx` :

```tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RigPortrait } from './RigPortrait';
import type { Combatant } from '../engine/types';

const hero = { id: 'h1', kind: 'hero', name: 'Soldat', career: 'Soldat', appearance: { species: 'Humain', sex: 'M', build: 0.5, seed: 3 } } as unknown as Combatant;

describe('RigPortrait', () => {
  it('rend un svg avec viewBox cadré + le visage (tête) du rig', () => {
    const html = renderToStaticMarkup(<RigPortrait combatant={hero} ring="#4f8fe0" />);
    expect(html).toContain('class="rig-portrait"');
    expect(html).toContain('viewBox="');
    expect(html).toContain('data-bone="tete"');
  });
});
```

- [ ] **Step 2: Lancer — vérifier qu'il passe AVANT (référence) puis garder comme garde-fou**

Run: `npx vitest run src/ui/RigPortrait.test.tsx`
Expected: PASS (l'ancien `RigPortrait` rend déjà tête + viewBox). Ce test verrouille la parité après refactor.

- [ ] **Step 3: Réécrire `RigPortrait.tsx` sur pickBackend**

Remplacer intégralement `src/ui/RigPortrait.tsx` par :

```tsx
import { pickBackend } from '../gameIso/pickBackend';
import type { Combatant } from '../engine/types';

/**
 * Vignette-portrait d'un combattant : gros plan sur le VISAGE vu de FACE, bordure = couleur
 * d'identité/équipe. Le corps + le viewBox cadré viennent de `pickBackend(…, 'top')` — SOURCE
 * UNIQUE partagée avec le pion-portrait de la carte (vue du dessus). Pas d'initiales (playtest).
 */
export function RigPortrait({ combatant, size = 42, ring }: { combatant: Combatant; size?: number; ring?: string }) {
  const r = pickBackend({ kind: 'combatant', combatant }, 'top');
  // R9 (daltonisme) : la FORME du contour encode l'équipe — héros = plein, ennemi = tirets.
  const borderStyle = combatant.kind === 'hero' ? 'solid' : 'dashed';
  return (
    <span className="rig-portrait" style={{ width: size, height: size, borderColor: ring, borderStyle }}>
      <svg viewBox={r.portraitBox} width={size} height={size} preserveAspectRatio="xMidYMid slice">
        {r.body}
      </svg>
    </span>
  );
}
```

- [ ] **Step 4: Lancer — vérifier le succès (parité conservée)**

Run: `npx vitest run src/ui/RigPortrait.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/RigPortrait.tsx src/ui/RigPortrait.test.tsx
git commit -m "refactor(hud): RigPortrait consomme pickBackend top-mode (dédup du cadrage visage)"
```

---

## Task 5: Store jeu — `viewMode` + `toggleViewMode` + persistance au reset

**Files:**
- Modify: `src/state/store.ts:152-157` (type), `:560-561` (init), `:633-636` (reset)
- Test: `src/state/store.test.ts`

- [ ] **Step 1: Écrire le test (échoue d'abord)**

Ajouter à `src/state/store.test.ts` (dans un `describe` existant ou nouveau ; adapter l'import `useGame` au style du fichier) :

```ts
describe('viewMode (vue du dessus)', () => {
  it('toggleViewMode bascule iso ⇄ top', () => {
    useGame.setState({ viewMode: 'iso' });
    useGame.getState().toggleViewMode();
    expect(useGame.getState().viewMode).toBe('top');
    useGame.getState().toggleViewMode();
    expect(useGame.getState().viewMode).toBe('iso');
  });

  it('startScene PRÉSERVE viewMode (préférence de vue, comme zoom/camRot)', () => {
    const sc = { id: 's', nom: 's', dimensions: { w: 4, h: 4 }, tiles: new Array(16).fill('herbe'), entities: [], triggers: [], dialogues: [], encounters: [], flags: {} } as any;
    useGame.setState({ viewMode: 'top' });
    useGame.getState().startScene(sc);
    expect(useGame.getState().viewMode).toBe('top');
  });
});
```

- [ ] **Step 2: Lancer — vérifier l'échec**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL (`viewMode`/`toggleViewMode` absents ; reset l'écrase à 'iso').

- [ ] **Step 3: Implémenter dans `store.ts`**

a) Type (après `setZoom: (z: number) => void;`, ligne 153) :
```ts
  /** Projection de la carte (bascule) : 'iso' losange ou 'top' grille carrée — préférence de vue. */
  viewMode: 'iso' | 'top';
  toggleViewMode: () => void;
```

b) Init (après `setZoom: (z) => …`, ligne 561) :
```ts
  viewMode: 'iso',
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'iso' ? 'top' : 'iso' })),
```

c) Reset `startScene` — préserver `viewMode` (ligne 633 puis 636) :
```ts
    const { screen, party, camRot, zoom, viewMode, inspectEnabled } = get();
    set({
      ...(JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>),
      screen, party, camRot, zoom, viewMode, inspectEnabled,
```

- [ ] **Step 4: Lancer — vérifier le succès**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(store): viewMode + toggleViewMode (vue du dessus), préservé au reset"
```

---

## Task 6: `ViewControls` — bouton bascule (partagé) + câblage jeu

**Files:**
- Modify: `src/ui/ViewControls.tsx`
- Modify: `src/ui/CampaignView.tsx:102-109`

- [ ] **Step 1: Ajouter le bouton à `ViewControls`**

Dans `src/ui/ViewControls.tsx` :

a) Étendre l'interface (après `onRotateRight`) :
```tsx
  view: 'iso' | 'top';
  onToggleView: () => void;
```

b) Étendre la signature destructurée :
```tsx
export function ViewControls({ zoom, onZoomIn, onZoomOut, onZoomReset, onRotateLeft, onRotateRight, view, onToggleView }: ViewControlsProps) {
```

c) Ajouter le bouton en tête de la colonne (juste après l'ouverture du `<div className="view-controls" …>`, avant la rangée rotation) :
```tsx
      <button
        type="button"
        title={view === 'top' ? 'Vue isométrique' : 'Vue du dessus'}
        style={{ ...BTN, background: view === 'top' ? '#2a3550' : '#1c2230', borderColor: view === 'top' ? '#6f86c0' : '#3a4660' }}
        onPointerDown={stop(onToggleView)}
      >
        {view === 'top' ? '◇' : '▦'}
      </button>
```

- [ ] **Step 2: Câbler dans le jeu (`CampaignView.tsx`)**

a) Ajouter les sélecteurs du store (près de `rotateCam`, ligne 43) :
```tsx
  const viewMode = useGame((s) => s.viewMode);
  const toggleViewMode = useGame((s) => s.toggleViewMode);
```

b) Étendre l'appel `<ViewControls … />` (lignes 102-109) :
```tsx
        <ViewControls
          zoom={zoom}
          onZoomIn={() => setZoom(zoom + 0.3)}
          onZoomOut={() => setZoom(zoom - 0.3)}
          onZoomReset={() => setZoom(1)}
          onRotateLeft={() => rotateCam(-1)}
          onRotateRight={() => rotateCam(1)}
          view={viewMode}
          onToggleView={toggleViewMode}
        />
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npm run typecheck`
Expected: PASS (aucune erreur ; `ViewControls` exige désormais `view`/`onToggleView` → l'éditeur sera mis à jour en Task 8, qui doit suivre avant un build complet).

> Note : `Editor.tsx` consomme aussi `ViewControls` (Task 8). Le typecheck global échouera tant que Task 8 n'est pas faite. Pour valider Task 6 isolément, `npm run typecheck` peut signaler l'éditeur — c'est attendu et corrigé en Task 8. Enchaîner Task 6 → Task 8 sans build de prod entre les deux.

- [ ] **Step 4: Commit**

```bash
git add src/ui/ViewControls.tsx src/ui/CampaignView.tsx
git commit -m "feat(ui): bouton vue du dessus dans ViewControls + câblage jeu"
```

---

## Task 7: `IsoStage` — `dims.view` + pions-portraits (combat + exploration + leader)

**Files:**
- Modify: `src/gameIso/IsoStage.tsx`

- [ ] **Step 1: Lire le viewMode + l'injecter dans `dims`**

a) Ajouter le sélecteur (près de `camRot`, ligne 109) :
```tsx
  const viewMode = useGame((s) => s.viewMode);
```

b) Importer `CELL` (étendre l'import depuis `./iso`, lignes 16-25) :
```tsx
  CELL,
```

c) Modifier la construction de `dims` (ligne 163) :
```tsx
  const dims: Dims = { ...scene.dimensions, rot: shownRot, view: viewMode };
```

d) Ajouter un helper de rayon de disque (juste après `const size = stageSize(dims);`, ligne 164) :
```tsx
  const top = viewMode === 'top';
  const discR = (sz: Combatant['size']) => (sizeFootprint(sz) * CELL) / 2 * 0.85;
```

- [ ] **Step 2: Étendre `tokenNode` pour porter `flat`/`portraitBox`/`discR`**

Modifier `TokenExtras` et `tokenNode` (lignes 329-335) :
```tsx
  type TokenExtras = { hp?: { current: number; max: number }; icons?: string[]; iconsMore?: number; veil?: string; active?: boolean; ringDash?: string; flat?: boolean; portraitBox?: string; discR?: number };
  const tokenNode = (id: string, x: number, y: number, child: ReactNode, scale: number, ringColor?: string, dim?: boolean, walking?: boolean, extras?: TokenExtras) => (
    <BodyToken key={id} x={x} y={y} dims={dims} scale={scale} ring={ringColor} ringDash={extras?.ringDash} dim={dim} walking={walking} bakedDeath
      hp={extras?.hp} icons={extras?.icons} iconsMore={extras?.iconsMore} veil={extras?.veil} active={extras?.active}
      flat={extras?.flat} portraitBox={extras?.portraitBox} discR={extras?.discR}>
      {child}
    </BodyToken>
  );
```

- [ ] **Step 3: Combat — disque en top-mode + bypass monté**

a) Dans la boucle des combattants (lignes 359-384), remplacer les deux gardes monté pour qu'elles ne s'appliquent QU'en iso :
```tsx
      if (!top && isRider(c)) { if (isHero) hi++; continue; }
      if (!top && isMount(c)) continue;
```

b) Passer le backend au mode courant et ajouter les extras flat (remplacer lignes 370-382) :
```tsx
      const r = pickBackend({ kind: 'combatant', combatant: c }, viewMode);
      const off = (sizeFootprint(c.size) - 1) / 2;
      const cx = wp.x + off, cy = wp.y + off;
      const fxSum = summarizeEffects(c.conditions, c.activeEffects, 3, combatantFlags(c));
      const el = tokenNode(r.id, cx, cy, r.body, 0.62 * r.speciesScale * sizeTokenScale(c.size), ring, isOutOfAction(c), wp.walking, {
        hp: c.wounds,
        icons: fxSum.visible.map((v) => v.icon),
        iconsMore: fxSum.moreCount,
        veil: veilTint(isHero),
        active: c.id === activeC?.id,
        ringDash: teamShape(isHero),
        flat: top,
        portraitBox: r.portraitBox,
        discR: discR(c.size),
      });
      objs.push({ d: depth(cx, cy, dims) + 0.5, el });
```

c) La boucle « combat monté » (lignes 389-399) ne doit s'exécuter QU'en iso — préfixer la boucle par `if (!top) ` (le corps reste identique) :
```tsx
    if (!top) for (const mount of battle.combatants) {
      if (!isMount(mount) || !mount.pos) continue;
      const rider = riderOf(battle, mount);
      if (!rider) continue;
      const off = (sizeFootprint(mount.size) - 1) / 2;
      const wp = walkPosOf(mount.id, mount.pos.x, mount.pos.y);
      const cx = wp.x + off, cy = wp.y + off;
      const mountScale = 0.62 * pickBackend({ kind: 'combatant', combatant: mount }).speciesScale * sizeTokenScale(mount.size);
      const el = tokenNode(`${mount.id}-mtd`, cx, cy, <MountedToken mount={mount} rider={rider} />, mountScale, undefined, isOutOfAction(mount), wp.walking);
      objs.push({ d: depth(cx, cy, dims) + 0.5, el });
    }
```

- [ ] **Step 4: Exploration — entités personnages + leader en disque**

a) Entités de scène (else branch, lignes 401-416) — passer `viewMode` et les extras flat dans la branche non-sprite (remplacer lignes 405-415) :
```tsx
      const r = pickBackend({ kind: 'sceneEntity', ent }, viewMode);
      if (r.backend === 'sprite') {
        objs.push({ d: depth(ent.pos.x, ent.pos.y, dims), el: token(r.id, ent.pos.x, ent.pos.y, entitySprite(ent), 0.55, undefined, false, ent.anim) });
      } else {
        const base = r.backend === 'rig' ? 0.58 : 0.55;
        const dBoost = r.backend === 'rig' ? 0.1 : 0;
        const off = (sizeFootprint(entitySize(ent)) - 1) / 2;
        const ex = ent.pos.x + off, ey = ent.pos.y + off;
        objs.push({ d: depth(ex, ey, dims) + dBoost, el: tokenNode(r.id, ex, ey, r.body, base * r.speciesScale * sizeTokenScale(entitySize(ent)), undefined, false, false, { flat: top, portraitBox: r.portraitBox, discR: discR(entitySize(ent)) }) });
      }
```

b) Leader de groupe (lignes 419-426) — passer `viewMode` + extras :
```tsx
    const leader = party.find((h) => !h.dead && h.wounds.current > 0) ?? party[0];
    const wp = leader ? walkPosOf(leader.id, partyPos.x, partyPos.y) : { x: partyPos.x, y: partyPos.y, walking: false };
    const r = pickBackend({ kind: 'partyLeader', leader }, viewMode);
    const el =
      r.backend === 'sprite'
        ? token(r.id, partyPos.x, partyPos.y, pnjSprite(), 0.6, HERO_RING[0])
        : tokenNode(r.id, wp.x, wp.y, r.body, 0.6, HERO_RING[0], false, wp.walking, { flat: top, portraitBox: r.portraitBox, discR: discR(undefined) });
    objs.push({ d: depth(wp.x, wp.y, dims) + 0.5, el });
```

> `discR(undefined)` : une Taille indéfinie ⇒ `sizeFootprint` renvoie 1 ⇒ rayon d'une case (héros standard).

- [ ] **Step 5: Vérifier la compilation + lancer la suite gameIso**

Run: `npm run typecheck`
Expected: (l'éditeur peut encore manquer `view`/`onToggleView` — corrigé Task 8).
Run: `npx vitest run src/gameIso`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/gameIso/IsoStage.tsx
git commit -m "feat(iso): IsoStage en vue du dessus (pions-portraits combat/exploration/leader)"
```

---

## Task 8: Éditeur — `viewMode` + `dims.view` + bouton + `EntityToken` flat

**Files:**
- Modify: `src/ui/editor/useEditorView.ts`
- Modify: `src/ui/editor/Editor.tsx:62-65`, `:699-706`
- Modify: `src/gameIso/EntityToken.tsx`

- [ ] **Step 1: `useEditorView` — état `viewMode` local**

Dans `src/ui/editor/useEditorView.ts` :

a) Ajouter l'état (après la ligne `const [rot, setRot] = …`) :
```ts
  const [viewMode, setViewMode] = useState<'iso' | 'top'>('iso'); // projection éditeur (bascule, local)
```

b) Ajouter au `return` (objet final) :
```ts
  return { rot, setRot, viewMode, setViewMode, view, setView, zoomAt, spaceRef, panRef, canvasRef, stageRef };
```

- [ ] **Step 2: `Editor.tsx` — injecter `view` dans `dims` + câbler le bouton**

a) Étendre la destructuration (ligne 62) :
```tsx
  const { rot, setRot, viewMode, setViewMode, view, setView, zoomAt, spaceRef, panRef, canvasRef, stageRef } = useEditorView();
  const dims: Dims = { ...scene.dimensions, rot, view: viewMode };
```

b) Étendre l'appel `<ViewControls … />` (lignes 699-706) :
```tsx
            <ViewControls
              zoom={view.zoom}
              onZoomIn={() => zoomAt(1.2)}
              onZoomOut={() => zoomAt(1 / 1.2)}
              onZoomReset={() => setView({ zoom: 1, x: 0, y: 0 })}
              onRotateLeft={() => setRot((r) => (((r + 3) % 4) as 0 | 1 | 2 | 3))}
              onRotateRight={() => setRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3))}
              view={viewMode}
              onToggleView={() => setViewMode((v) => (v === 'iso' ? 'top' : 'iso'))}
            />
```

- [ ] **Step 3: `EntityToken` — disque en top-mode (lit `dims.view`)**

Remplacer intégralement `src/gameIso/EntityToken.tsx` par :

```tsx
import { CELL, type Dims } from './iso';
import { BodyToken } from './BodyToken';
import { pickBackend } from './pickBackend';
import { sizeTokenScale } from './sizeScale';
import { sizeFootprint } from '../state/footprint';
import { entitySize } from '../state/spawn';
import type { SceneEntity } from '../state/scene';

/**
 * Rendu d'une ENTITÉ de scène posée sur sa case — SOURCE UNIQUE partagée par le jeu (IsoStage)
 * et l'éditeur (WYSIWYG). Backend choisi par `pickBackend(subject, dims.view)` ; positionnement
 * par `BodyToken`. En vue du dessus (`dims.view==='top'`), un acteur devient un disque-portrait.
 */
export function EntityToken({ ent, dims, scale = 0.55 }: { ent: SceneEntity; dims: Dims; scale?: number }) {
  const top = dims.view === 'top';
  const r = pickBackend({ kind: 'sceneEntity', ent }, dims.view);
  const sz = entitySize(ent);
  const off = (sizeFootprint(sz) - 1) / 2;
  const discR = (sizeFootprint(sz) * CELL) / 2 * 0.85;
  return (
    <BodyToken
      x={ent.pos.x + off}
      y={ent.pos.y + off}
      dims={dims}
      scale={scale * sizeTokenScale(sz)}
      bakedDeath={r.backend !== 'sprite'}
      flat={top && r.flat}
      portraitBox={r.portraitBox}
      discR={discR}
    >
      {r.body}
    </BodyToken>
  );
}
```

> Le décor (`r.flat===false`) reste billboard même en top ⇒ `flat={top && r.flat}` est `false`.

- [ ] **Step 4: Vérifier la compilation + suite éditeur/iso**

Run: `npm run typecheck`
Expected: PASS (toutes les surfaces fournissent maintenant `view`/`onToggleView`).
Run: `npx vitest run src/gameIso src/ui`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/editor/useEditorView.ts src/ui/editor/Editor.tsx src/gameIso/EntityToken.tsx
git commit -m "feat(editor): vue du dessus dans l'éditeur (bouton + EntityToken en disque)"
```

---

## Task 9: Bâtiments — empreinte à plat en top-mode

**Files:**
- Modify: `src/gameIso/BuildingSprite.tsx`

- [ ] **Step 1: Brancher `buildingObj` sur une empreinte à plat en top-mode**

Dans `src/gameIso/BuildingSprite.tsx` :

a) Étendre l'import (ligne 4) :
```tsx
import { Dims, depth, diamondPath } from './iso';
```

b) Au début de `buildingObj` (avant `const L = buildingLayers(…)`), insérer :
```tsx
  if (dims.view === 'top') {
    const tiles: { x: number; y: number }[] = [];
    for (let dy = 0; dy < b.foot.h; dy++)
      for (let dx = 0; dx < b.foot.w; dx++) tiles.push({ x: b.foot.x + dx, y: b.foot.y + dy });
    return {
      d: buildingDepth(b, dims),
      el: (
        <g key={`b-${b.id}`} style={{ transition: 'opacity 0.25s' }} opacity={hideRoof ? 0.3 : 0.9}>
          {tiles.map((t) => (
            <path key={`bf-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims)} fill="#5b4f42" stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
          ))}
          {b.door && <path d={diamondPath(b.door.x, b.door.y, dims)} fill="#caa46a" stroke="#3a2c1c" strokeWidth={1} />}
        </g>
      ),
    };
  }
```

- [ ] **Step 2: Vérifier la compilation + suite**

Run: `npm run typecheck`
Expected: PASS.
Run: `npx vitest run src/gameIso`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/gameIso/BuildingSprite.tsx
git commit -m "feat(iso): bâtiments en empreinte à plat en vue du dessus"
```

---

## Task 10: Recette navigateur + vérification complète

**Files:** (aucune modif — vérification)

- [ ] **Step 1: Suite complète + typecheck**

Run: `npm test`
Expected: PASS (toute la suite verte).
Run: `npm run typecheck`
Expected: PASS (0 erreur).

- [ ] **Step 2: Recette jeu (Playwright MCP)**

1. `npm run dev` puis charger `http://localhost:5173`.
2. Menu **« 🧪 Tests — scénarios »** → lancer un scénario de combat.
3. Cliquer le bouton **▦** (haut-droite, sous rotation) → la scène passe en **grille carrée** ; héros/ennemis = **disques-portraits** avec anneau d'équipe, barre de PV, icônes ; décor = billboards de face sur cases carrées.
4. Vérifier : **zoom molette/+/−** fonctionne ; **rotation ⟲/⟳ (et Q/E)** fonctionne (la grille tourne) ; **clic sur une case** sélectionne/déplace correctement (picking carré) ; un **tir** affiche bandes de portée + réticule sur la grille carrée.
5. Re-cliquer **◇** → retour iso identique à avant.
6. `console` : **0 erreur**. Screenshot avant/après bascule.

- [ ] **Step 3: Recette éditeur (Playwright MCP)**

1. Menu → **Éditeur de niveau**.
2. Cliquer **▦** → grille carrée ; peindre des tuiles, poser une entité personnage (→ disque), poser un ennemi de rencontre, dessiner un trigger (zone carrée), poser un bâtiment (→ empreinte à plat).
3. Vérifier : **placement au bon endroit** (picking carré) ; **drag d'entité** ; **rotation Q/E** ; **zoom molette**.
4. **▶ Tester** → la scène se joue ; rebascule iso/top en jeu sans erreur.
5. `console` : **0 erreur**.

- [ ] **Step 4: Régler les marges si besoin**

Si un billboard est coupé à gauche/haut, ou si les disques sont trop petits/grands : ajuster `CELL` (56), `originX` (marge gauche) dans `iso.ts`, et le facteur `0.85` de `discR`. Re-lancer la recette. Commit si modif :
```bash
git add src/gameIso/iso.ts
git commit -m "fix(iso): marges/échelle de la vue du dessus (recette)"
```

- [ ] **Step 5: Mémoire (optionnel)**

Si la feature est livrée et poussée, écrire un mémo `game-vue-du-dessus.md` (DONE + points déférés : bâtiments fidélité fine, mounts en disques séparés) et l'indexer dans `MEMORY.md`.

---

## Notes de séquencement

- **Tasks 1→4** sont la fondation (géométrie + tokens) — autonomes, testables isolément.
- **Tasks 5→9** câblent le jeu puis l'éditeur ; le `typecheck` global ne repasse au vert qu'**après Task 8** (les deux consommateurs de `ViewControls` doivent fournir les nouvelles props). Ne pas builder la prod entre Task 6 et Task 8.
- **Task 10** = recette + réglages visuels.
- Décisions déjà tranchées (cf. spec) : `CELL≈56`, bâtiments à plat, pion qui glisse sans anim de membres, **mounts rendus en disques séparés** (pas de composite) en vue du dessus.
