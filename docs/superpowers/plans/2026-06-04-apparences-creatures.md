# Apparences de créatures par calques + décors d'ambush — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à toute créature d'avoir plusieurs apparences (composées par calques, tirées au seed + override éditeur) et ajouter au catalogue les décors « ADN » d'`ambush.html` (cadavre, sang, cheval mort, épave de carrosse).

**Architecture:** Une couche d'apparence data-driven (`appearance.ts` + `creatureAppearances.ts`) compose un inner-SVG à partir de calques ; `creatureSprites.json` reste le fallback monolithique. Le rendu (`IsoStage`, éditeur) passe un seed stable (hash d'id) + des pins optionnels stockés sur `SceneEntity`. Décors = nouveaux `PROPS` du catalogue.

**Tech Stack:** TypeScript, Vite, React, Vitest. RNG seedable `makeRNG` (`src/engine/dice.ts`). Sprites = chaînes SVG en boîte locale 120×150, pieds en (60,150).

**Spec:** `docs/superpowers/specs/2026-06-04-apparences-creatures-design.md`

---

## File Structure

| Fichier | Responsabilité | Phase |
|---|---|---|
| `src/gameIso/appearance.ts` | **nouveau** — types `AppearanceLayer`/`CreatureAppearance`/`AppearancePins`, `hashSeed`, `composeAppearance`, `appearanceLayers` | A |
| `src/gameIso/appearance.test.ts` | **nouveau** — tests du moteur | A |
| `src/state/scene.ts` | `EntityAppearance` + `SceneEntity.appearance?` (optionnel) | A |
| `src/gameIso/sprites.ts` | `enemySprite(name, seed?, pins?)` délègue à `composeAppearance` puis fallback ; ajout gradients à `DEFS` | A/B/C |
| `src/gameIso/IsoStage.tsx` | seed + pins aux 2 points d'appel `enemySprite` | A |
| `src/gameIso/creatureAppearances.ts` | **nouveau** — specs calques (Mutant, Humain) | B |
| `src/gameIso/anim.css` | keyframes `chop/howl/feed` (B) ; `gush/fly` (C) | B/C |
| `src/ui/editor/Editor.tsx` | preview entité = `composeAppearance` ; section « Apparence » de l'inspecteur | A/B |
| `src/gameIso/catalog/decor.ts` | 4 nouveaux `PROPS` | C |
| `src/gameIso/catalog/decor.test.ts` | assertions sur les nouveaux props | C |

**Commandes de référence :** `npm test` (Vitest), `npm run typecheck` (tsc --noEmit), `npm run dev` (navigateur).

---

# PHASE A — Moteur d'apparence (variété au seed + fallback)

But : les créatures enrichies se composent par calques au seed ; tout le reste passe par le fallback monolithique inchangé. Aucune régression, aucune migration de données.

## Task A1 : Types + `hashSeed`

**Files:**
- Create: `src/gameIso/appearance.ts`
- Test: `src/gameIso/appearance.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue (hashSeed déterministe & varié)**

```ts
// src/gameIso/appearance.test.ts
import { describe, it, expect } from 'vitest';
import { hashSeed } from './appearance';

describe('hashSeed', () => {
  it('est déterministe pour une même chaîne', () => {
    expect(hashSeed('ent-1')).toBe(hashSeed('ent-1'));
  });
  it('diffère pour des chaînes différentes', () => {
    expect(hashSeed('ent-1')).not.toBe(hashSeed('ent-2'));
  });
  it('renvoie un entier non signé', () => {
    const h = hashSeed('xyz');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- appearance`
Expected: FAIL — `hashSeed` n'existe pas / module introuvable.

- [ ] **Step 3 : Implémentation minimale (types + hashSeed)**

```ts
// src/gameIso/appearance.ts
/**
 * Apparence d'une créature par calques. Une apparence = liste ordonnée de
 * calques ; chaque calque a N variantes (fragments SVG en boîte 120×150,
 * pieds en (60,150)). On en tire une par calque (seed) puis on concatène.
 * Le pool discret = 1 calque à N variantes. Le sprite monolithique actuel
 * (creatureSprites.json) reste le fallback — cf. sprites.ts.
 */
export interface AppearanceLayer {
  /** slot logique : 'pose' | 'peau' | 'tete' | 'gear' … (chaîne libre). */
  slot: string;
  /** chaque variante est un fragment SVG (<g>…</g>) dans la boîte 120×150. */
  variants: string[];
}

export interface CreatureAppearance {
  /** clé = nom de créature (= clé bestiaire), ex. 'Mutant'. */
  id: string;
  layers: AppearanceLayer[];
}

/** slot → index de variante forcé (override éditeur). */
export type AppearancePins = Record<string, number>;

/** Hash FNV-1a 32 bits → graine entière stable pour un id de token. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- appearance`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/appearance.ts src/gameIso/appearance.test.ts
git commit -m "feat(gameIso): apparence par calques — types + hashSeed"
```

## Task A2 : Registre des apparences + `composeAppearance` + `appearanceLayers`

**Files:**
- Create: `src/gameIso/creatureAppearances.ts`
- Modify: `src/gameIso/appearance.ts`
- Test: `src/gameIso/appearance.test.ts`

- [ ] **Step 1 : Registre vide initial (sera rempli en Phase B)**

```ts
// src/gameIso/creatureAppearances.ts
import type { CreatureAppearance } from './appearance';

/** Apparences enrichies par calques. Les créatures absentes retombent sur
 *  le sprite monolithique de creatureSprites.json (cf. sprites.ts). */
export const CREATURE_APPEARANCES: Record<string, CreatureAppearance> = {};
```

- [ ] **Step 2 : Écrire les tests qui échouent (compose + layers)**

Ajouter à `src/gameIso/appearance.test.ts` :

```ts
import { composeAppearance, appearanceLayers } from './appearance';
import { CREATURE_APPEARANCES } from './creatureAppearances';

describe('composeAppearance', () => {
  // Fixture local : on injecte une créature de test à 1 calque / 3 variantes.
  const KEY = '__TestCreature__';
  CREATURE_APPEARANCES[KEY] = {
    id: KEY,
    layers: [{ slot: 'pose', variants: ['<g id="A"/>', '<g id="B"/>', '<g id="C"/>'] }],
  };

  it('est déterministe pour un même seed', () => {
    expect(composeAppearance(KEY, 123)).toBe(composeAppearance(KEY, 123));
  });
  it('varie selon le seed sur une créature multi-variantes', () => {
    const looks = new Set([0, 1, 2, 3, 4, 5].map((s) => composeAppearance(KEY, s)));
    expect(looks.size).toBeGreaterThan(1);
  });
  it('un pin force la variante choisie', () => {
    expect(composeAppearance(KEY, 999, { pose: 2 })).toBe('<g id="C"/>');
  });
  it('un pin hors bornes est ignoré (retombe sur le tirage)', () => {
    expect(composeAppearance(KEY, 123, { pose: 99 })).toBe(composeAppearance(KEY, 123));
  });
  it('créature non enrichie → null (le fallback est géré par sprites.ts)', () => {
    expect(composeAppearance('CréatureInconnueXYZ', 1)).toBeNull();
  });
  it('appearanceLayers renvoie les calques connus, [] sinon', () => {
    expect(appearanceLayers(KEY).length).toBe(1);
    expect(appearanceLayers('CréatureInconnueXYZ')).toEqual([]);
  });
});
```

- [ ] **Step 3 : Lancer le test, vérifier l'échec**

Run: `npm test -- appearance`
Expected: FAIL — `composeAppearance` / `appearanceLayers` non définis.

- [ ] **Step 4 : Implémenter `composeAppearance` + `appearanceLayers`**

Ajouter à `src/gameIso/appearance.ts` :

```ts
import { makeRNG } from '../engine/dice';
import { CREATURE_APPEARANCES } from './creatureAppearances';

/** Calques d'une créature enrichie (pour l'inspecteur éditeur). */
export function appearanceLayers(name: string): AppearanceLayer[] {
  return CREATURE_APPEARANCES[name]?.layers ?? [];
}

/**
 * Compose l'inner-SVG d'une créature enrichie. Renvoie `null` si la créature
 * n'a pas d'apparence par calques (le fallback monolithique est appliqué par
 * l'appelant, cf. enemySprite dans sprites.ts).
 */
export function composeAppearance(
  name: string,
  seed: number,
  pins?: AppearancePins,
): string | null {
  const spec = CREATURE_APPEARANCES[name];
  if (!spec) return null;
  const rng = makeRNG(seed || 1);
  let out = '';
  for (const layer of spec.layers) {
    const n = layer.variants.length;
    if (n === 0) continue;
    const pin = pins?.[layer.slot];
    const tirage = rng.int(0, n - 1); // toujours consommé → tirage stable par calque
    const idx = pin != null && pin >= 0 && pin < n ? pin : tirage;
    out += layer.variants[idx];
  }
  return out;
}
```

Note de conception : on appelle `rng.int` pour **chaque** calque même si un pin l'override, afin que pinner un calque ne décale pas le tirage des calques suivants.

- [ ] **Step 5 : Lancer le test, vérifier le succès**

Run: `npm test -- appearance`
Expected: PASS (tous).

- [ ] **Step 6 : Commit**

```bash
git add src/gameIso/appearance.ts src/gameIso/creatureAppearances.ts src/gameIso/appearance.test.ts
git commit -m "feat(gameIso): composeAppearance + registre apparences (vide)"
```

## Task A3 : `enemySprite` délègue à `composeAppearance` (fallback monolithique préservé)

**Files:**
- Modify: `src/gameIso/sprites.ts:158-166`
- Test: `src/gameIso/appearance.test.ts`

État actuel (`sprites.ts:158-166`) :
```ts
const CREATURE_SPRITES = creatureSprites as Record<string, string>;
const CREATURE_BY_NORM: Record<string, string> = {};
for (const [k, v] of Object.entries(CREATURE_SPRITES)) CREATURE_BY_NORM[k.toLowerCase()] = v;

export function enemySprite(label: string): string {
  if (!label) return mutantStand();
  return CREATURE_SPRITES[label] ?? CREATURE_BY_NORM[label.toLowerCase()] ?? mutantStand();
}
```

- [ ] **Step 1 : Écrire le test de non-régression (fallback monolithique intact)**

Ajouter à `src/gameIso/appearance.test.ts` :

```ts
import { enemySprite } from './sprites';
import creatureSprites from './creatureSprites.json';

describe('enemySprite — fallback monolithique', () => {
  it('rend exactement le sprite JSON pour une créature non enrichie', () => {
    const json = (creatureSprites as Record<string, string>)['Zombie'];
    expect(enemySprite('Zombie')).toBe(json);
  });
  it('label vide → un sprite non vide (mutantStand)', () => {
    expect(enemySprite('').length).toBeGreaterThan(0);
  });
  it('label inconnu → un sprite non vide (mutantStand)', () => {
    expect(enemySprite('PasUneCréature').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec attendu**

Run: `npm test -- appearance`
Expected: les nouveaux cas peuvent déjà PASSER (signature `enemySprite(label)` inchangée). C'est volontaire — ils verrouillent la non-régression avant de toucher la signature à l'étape suivante.

- [ ] **Step 3 : Modifier `enemySprite` pour accepter seed + pins et déléguer**

Remplacer le bloc `sprites.ts:158-166` par :

```ts
const CREATURE_SPRITES = creatureSprites as Record<string, string>;
const CREATURE_BY_NORM: Record<string, string> = {};
for (const [k, v] of Object.entries(CREATURE_SPRITES)) CREATURE_BY_NORM[k.toLowerCase()] = v;

/** Sprite d'une créature : apparence par calques si enrichie (seed + pins),
 *  sinon sprite monolithique du bestiaire, sinon mutant générique. */
export function enemySprite(label: string, seed = 0, pins?: AppearancePins): string {
  if (!label) return mutantStand();
  const composed = composeAppearance(label, seed, pins);
  if (composed != null) return composed;
  return CREATURE_SPRITES[label] ?? CREATURE_BY_NORM[label.toLowerCase()] ?? mutantStand();
}
```

Ajouter en tête de `sprites.ts` (à côté des autres imports) :

```ts
import { composeAppearance, type AppearancePins } from './appearance';
```

⚠️ **Anti-cycle d'import :** `appearance.ts` n'importe PAS `sprites.ts` (le fallback monolithique reste côté `sprites.ts`). `sprites.ts` → `appearance.ts` → `creatureAppearances.ts` est un DAG. Ne pas importer `enemySprite`/`mutantStand` depuis `appearance.ts`.

- [ ] **Step 4 : Lancer les tests + typecheck**

Run: `npm test -- appearance && npm run typecheck`
Expected: PASS ; tsc sans erreur (les appels existants `enemySprite(x)` restent valides, seed/pins étant optionnels).

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/sprites.ts src/gameIso/appearance.test.ts
git commit -m "feat(gameIso): enemySprite delegue a composeAppearance (fallback preserve)"
```

## Task A4 : Champ `appearance` optionnel sur `SceneEntity`

**Files:**
- Modify: `src/state/scene.ts:28-43`

- [ ] **Step 1 : Ajouter le type `EntityAppearance` et le champ optionnel**

Dans `src/state/scene.ts`, juste avant `export interface SceneEntity` (ligne 28), ajouter :

```ts
/** Override d'apparence (sinon seed dérivé de l'id). pins : slot → index. */
export interface EntityAppearance {
  seed?: number;
  pins?: Record<string, number>;
}
```

Puis, dans `SceneEntity`, ajouter le champ (après `loot?`) :

```ts
  /** Apparence (calques) : override éditeur ; sinon auto-variée au seed de l'id. */
  appearance?: EntityAppearance;
```

- [ ] **Step 2 : Typecheck (pas de test unitaire — champ optionnel pur)**

Run: `npm run typecheck`
Expected: PASS — aucun appelant cassé (champ optionnel, aucune scène existante invalide).

- [ ] **Step 3 : Commit**

```bash
git add src/state/scene.ts
git commit -m "feat(scene): SceneEntity.appearance optionnel (seed + pins)"
```

## Task A5 : Câbler le seed + pins dans `IsoStage`

**Files:**
- Modify: `src/gameIso/IsoStage.tsx:140` et `:147` (+ import)

- [ ] **Step 1 : Importer `hashSeed`**

Dans le bloc d'import depuis `./sprites`/`./appearance` de `IsoStage.tsx`, ajouter :

```ts
import { hashSeed } from './appearance';
```

- [ ] **Step 2 : Combat (ligne 140) — seed par id de combattant**

Remplacer :
```ts
const inner = isHero ? heroSprite(c) : enemySprite(c.name);
```
par :
```ts
const inner = isHero ? heroSprite(c) : enemySprite(c.name, hashSeed(c.id));
```

- [ ] **Step 3 : Explore (ligne 147) — seed/pins depuis l'entité**

Remplacer la sous-expression `enemySprite(ent.ref ?? '')` par :
```ts
enemySprite(ent.ref ?? '', ent.appearance?.seed ?? hashSeed(ent.id), ent.appearance?.pins)
```

- [ ] **Step 4 : Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/IsoStage.tsx
git commit -m "feat(gameIso): IsoStage passe seed(+pins) a enemySprite"
```

## Task A6 : Preview éditeur cohérente avec l'apparence

**Files:**
- Modify: `src/ui/editor/Editor.tsx:81` (+ import)

- [ ] **Step 1 : Importer `hashSeed`**

Ajouter à l'import depuis `../../gameIso/appearance` (le créer si absent) :
```ts
import { hashSeed } from '../../gameIso/appearance';
```

- [ ] **Step 2 : Utiliser seed + pins dans la preview entité (ligne 81)**

Remplacer :
```ts
if (e.kind === 'ennemi') return enemySprite(e.ref ?? '');
```
par :
```ts
if (e.kind === 'ennemi') return enemySprite(e.ref ?? '', e.appearance?.seed ?? hashSeed(e.id), e.appearance?.pins);
```

- [ ] **Step 3 : Typecheck + build data non requis**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add src/ui/editor/Editor.tsx
git commit -m "feat(editeur): preview entite via apparence (seed+pins)"
```

**✅ Fin Phase A.** Vérif navigateur : `npm run dev`, ouvrir l'éditeur, poser plusieurs ennemis du même type → tant qu'aucune créature n'est enrichie, ils restent identiques (fallback). La variété apparaît en Phase B. `npm test` et `npm run typecheck` verts.

---

# PHASE B — Enrichir Mutant & Humain (poses depuis ambush)

But : remplir `CREATURE_APPEARANCES` avec des calques réels, ajouter les keyframes manquantes, exposer le choix d'apparence dans l'inspecteur.

## Task B1 : Gradients & keyframes nécessaires aux poses mutant

**Files:**
- Modify: `src/gameIso/sprites.ts` (constante `DEFS`)
- Modify: `src/gameIso/anim.css`

- [ ] **Step 1 : Ajouter les gradients d'ambush manquants à `DEFS`**

Dans `sprites.ts`, à la fin de la chaîne `DEFS` (avant le backtick fermant), ajouter les gradients utilisés par les poses portées (repris d'`ambush.html` lignes 32-41) :

```ts
  <linearGradient id="mut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c9152"/><stop offset="100%" stop-color="#39501f"/></linearGradient>
  <linearGradient id="mutDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5d7540"/><stop offset="100%" stop-color="#2a3c18"/></linearGradient>
  <linearGradient id="scale" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f8f54"/><stop offset="100%" stop-color="#3a4f2a"/></linearGradient>
  <linearGradient id="axe" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dfe6ef"/><stop offset="100%" stop-color="#6a7384"/></linearGradient>
  <radialGradient id="blood" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7e1212"/><stop offset="100%" stop-color="#360707"/></radialGradient>
  <radialGradient id="eye" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe14a"/><stop offset="70%" stop-color="#d88a1a"/><stop offset="100%" stop-color="#7a3a08"/></radialGradient>
```

⚠️ Vérifier d'abord par recherche qu'un id n'est pas déjà présent dans `DEFS`/`AMBIANCE_DEFS` (ex. `eye`, `blood`) pour éviter un doublon. Si présent, ne pas le redéclarer.

- [ ] **Step 2 : Ajouter les keyframes de poses à `anim.css`** (reprises d'`ambush.html` lignes 17, 16, 15)

```css
.chop {
  animation: chop 1.1s ease-in-out infinite;
  transform-box: fill-box;
}
.howl {
  animation: howl 2.4s ease-in-out infinite;
  transform-box: fill-box;
}
.feed {
  animation: feed 1.4s ease-in-out infinite;
  transform-box: fill-box;
}
@keyframes chop {
  0%, 100% { transform: rotate(-14deg); }
  55% { transform: rotate(20deg); }
}
@keyframes howl {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(7deg); }
}
@keyframes feed {
  0%, 100% { transform: translateY(0) rotate(0); }
  50% { transform: translateY(4px) rotate(-2deg); }
}
```

- [ ] **Step 3 : Typecheck (les CSS/DEFS n'ont pas de test unitaire)**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add src/gameIso/sprites.ts src/gameIso/anim.css
git commit -m "feat(gameIso): gradients + keyframes poses mutant (ex ambush)"
```

## Task B2 : Apparence « Mutant » (4 poses + 2 peaux)

**Files:**
- Modify: `src/gameIso/creatureAppearances.ts`
- Test: `src/gameIso/appearance.test.ts`

Chaque variante de pose est un fragment SVG en boîte 120×150. Les poses sont **portées d'`ambush.html`** : il faut prendre le contenu *interne* du groupe acteur (sans le `<ellipse>` d'ombre ni le `transform translate(...) scale(...)` de placement de scène, que `token()` gère déjà) et le **renormaliser** pour que les pieds tombent vers y≈150.

- [ ] **Step 1 : Écrire le test qui échoue (Mutant enrichi, 4 poses)**

Ajouter à `src/gameIso/appearance.test.ts` :

```ts
import { appearanceLayers as layersOf } from './appearance';

describe('apparence Mutant', () => {
  it('a un calque "pose" à 4 variantes', () => {
    const pose = layersOf('Mutant').find((l) => l.slot === 'pose');
    expect(pose?.variants.length).toBe(4);
  });
  it('chaque pose rend un fragment SVG non vide', () => {
    for (let i = 0; i < 4; i++) {
      expect(composeAppearance('Mutant', 0, { pose: i })!.length).toBeGreaterThan(20);
    }
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- appearance`
Expected: FAIL — `Mutant` pas encore dans `CREATURE_APPEARANCES`.

- [ ] **Step 3 : Remplir l'apparence Mutant**

Dans `creatureAppearances.ts`, définir les 4 poses. **Pose « hache » fournie verbatim** (portée d'`ambush.html:287-296`, groupe acteur interne, transform de scène retiré) :

```ts
import type { CreatureAppearance } from './appearance';

// Pose 1 — mutant à la hache (ambush.html:288-296, ombre + transform de scène retirés)
const mutantHache = `<g>
  <path d="M48 100 L42 150 L58 150 L60 104 Z" fill="url(#mutDark)"/><path d="M74 100 L84 150 L66 150 L62 104 Z" fill="url(#mutDark)"/>
  <path d="M42 96 L38 122 L52 114 L60 124 L70 114 L80 122 L76 96 Z" fill="#544c32"/>
  <path d="M28 92 Q24 46 60 42 Q100 40 98 84 Q94 106 62 110 Q38 110 28 92 Z" fill="url(#mut)"/>
  <g fill="#2a3c18" opacity="0.7"><ellipse cx="46" cy="62" rx="6" ry="4"/><ellipse cx="72" cy="56" rx="7" ry="5"/><ellipse cx="86" cy="78" rx="6" ry="4"/><ellipse cx="58" cy="86" rx="8" ry="5"/><ellipse cx="38" cy="80" rx="5" ry="3"/></g>
  <circle cx="60" cy="40" r="10" fill="url(#mut)"/><ellipse cx="56" cy="39" rx="2" ry="3" fill="url(#eye)"/><circle cx="56" cy="39" r="1.5" fill="#1a1a08"/><ellipse cx="64" cy="39" rx="2" ry="3" fill="url(#eye)"/><circle cx="64" cy="39" r="1.5" fill="#1a1a08"/>
  <path d="M53 46 q7 5 14 0" stroke="#2a160f" stroke-width="2" fill="none"/>
  <g class="chop" style="transform-origin:62% 88%">
    <path d="M86 64 Q122 44 120 4" stroke="url(#mut)" stroke-width="16" fill="none" stroke-linecap="round"/>
    <g transform="translate(120 2)"><rect x="-3" y="-16" width="6" height="42" fill="#4a2f17"/><path d="M-22 -16 q26 -10 26 18 q-26 0 -26 -18z" fill="url(#axe)" stroke="#2a3038"/><path d="M-6 24 l10 8" stroke="#7a1a1a" stroke-width="2"/></g>
  </g></g>`;

// Pose 2 — mutant griffe/fouet (ambush.html:321-326). PORTAGE : copier le contenu
//   interne du groupe acteur (les <path>/<ellipse>, sans l'ombre ni le transform de
//   scène), classe `.wrap` déjà définie dans anim.css.
const mutantGriffe = `<g> /* … porter ambush.html:321-326 … */ </g>`;

// Pose 3 — mutant homme-chien hurlant (ambush.html:351-371, groupe `rotate(6)` ext.
//   retiré). PORTAGE : conserver le sous-groupe `class="howl"`. Renormaliser pour
//   pieds ≈ y150.
const mutantChien = `<g> /* … porter ambush.html:351-371 … */ </g>`;

// Pose 4 — mutant charognard qui dévore (ambush.html:443-455, groupe `class="feed"`).
//   PORTAGE : conserver `class="feed"`. Renormaliser pour pieds ≈ y150.
const mutantCharognard = `<g> /* … porter ambush.html:443-455 … */ </g>`;

export const CREATURE_APPEARANCES: Record<string, CreatureAppearance> = {
  Mutant: {
    id: 'Mutant',
    layers: [
      { slot: 'pose', variants: [mutantHache, mutantGriffe, mutantChien, mutantCharognard] },
    ],
  },
};
```

> **Instruction de portage (pas un placeholder) :** pour `mutantGriffe`, `mutantChien`,
> `mutantCharognard`, ouvrir `public/ambush.html` aux lignes indiquées, copier le
> **contenu interne** du `<g transform="translate(...) scale(...)">` acteur (en excluant
> l'`<ellipse … fill="#000" opacity="0.4"/>` d'ombre et le transform de scène externe —
> `token()` applique déjà ombre + échelle + position des pieds). Vérifier visuellement
> (Step 5) que les pieds tombent vers y≈150 ; sinon, envelopper le fragment d'un
> `<g transform="translate(dx,dy)">` d'ajustement.

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- appearance && npm run typecheck`
Expected: PASS (les 4 variantes existent et rendent du SVG). Note : remplacer les commentaires `/* … */` par le SVG réel avant cette étape — un fragment vide ferait échouer l'assertion « > 20 caractères ».

- [ ] **Step 5 : Vérif navigateur**

Run: `npm run dev` → éditeur → poser 4 mutants. Attendu : poses variées (au moins 2 looks différents), hache qui s'anime (`chop`), homme-chien qui oscille (`howl`), 0 erreur console. Screenshot.

- [ ] **Step 6 : Commit**

```bash
git add src/gameIso/creatureAppearances.ts src/gameIso/appearance.test.ts
git commit -m "feat(gameIso): apparence Mutant — 4 poses (ex ambush)"
```

## Task B3 : Apparence « Humain » (variété de têtes/vêtements)

**Files:**
- Modify: `src/gameIso/creatureAppearances.ts`
- Test: `src/gameIso/appearance.test.ts`

- [ ] **Step 1 : Test qui échoue**

```ts
describe('apparence Humain', () => {
  it('expose au moins 2 variantes combinables', () => {
    const looks = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((s) => composeAppearance('Humain', s)));
    expect(looks.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npm test -- appearance`
Expected: FAIL — `Humain` non enrichi (compose → null → Set d'un seul `null`… ajuster : `.map((s)=>composeAppearance('Humain',s))` renvoie `null` partout → size 1 → FAIL attendu).

- [ ] **Step 3 : Définir l'apparence Humain (calque corps de base + calque tête)**

Repartir du sprite monolithique `Humain` de `creatureSprites.json` comme calque `corps` (1 variante), et ajouter un calque `tete` à 3 variantes (chevelure/coiffe simples, fragments SVG en haut de boîte ~y50-80). Dans `creatureAppearances.ts` :

```ts
import creatureSprites from './creatureSprites.json';

const humainCorps = (creatureSprites as Record<string, string>)['Humain'];

// 3 coiffes simples superposées au sommet du corps (boîte 120×150)
const teteBrun = `<g><path d="M44 60 q16 -14 32 0 q-4 -8 -16 -8 q-12 0 -16 8z" fill="#3a2616"/></g>`;
const teteBlond = `<g><path d="M44 60 q16 -14 32 0 q-4 -8 -16 -8 q-12 0 -16 8z" fill="#b9954f"/></g>`;
const teteCapuche = `<g><path d="M42 64 Q60 40 78 64 Q72 54 60 54 Q48 54 42 64 Z" fill="#4a4036"/></g>`;
```

Puis ajouter au registre :

```ts
  Humain: {
    id: 'Humain',
    layers: [
      { slot: 'corps', variants: [humainCorps] },
      { slot: 'tete', variants: [teteBrun, teteBlond, teteCapuche] },
    ],
  },
```

> **Instruction de portage :** ajuster les coordonnées des coiffes pour coïncider avec la
> tête du sprite `Humain` réel (vérifier en navigateur, Step 5). Les `y` ci-dessus sont
> indicatifs pour une tête vers le haut de la boîte ; corriger après observation.

- [ ] **Step 4 : Lancer le test + typecheck**

Run: `npm test -- appearance && npm run typecheck`
Expected: PASS.

- [ ] **Step 5 : Vérif navigateur**

Poser 4 « Humain » → coiffes/couleurs variées sur le même corps. Screenshot.

- [ ] **Step 6 : Commit**

```bash
git add src/gameIso/creatureAppearances.ts src/gameIso/appearance.test.ts
git commit -m "feat(gameIso): apparence Humain — coiffes variees"
```

## Task B4 : Section « Apparence » dans l'inspecteur éditeur

**Files:**
- Modify: `src/ui/editor/Editor.tsx` (après le bloc `sel.kind === 'ennemi'`, ~ligne 580 ; import)

- [ ] **Step 1 : Importer `appearanceLayers`**

Compléter l'import d'`../../gameIso/appearance` :
```ts
import { hashSeed, appearanceLayers } from '../../gameIso/appearance';
```

- [ ] **Step 2 : Ajouter le bloc UI « Apparence » après le `<select>` bestiaire**

Insérer juste après la fermeture `)}` du bloc `{sel.kind === 'ennemi' && ( … )}` (ligne ~580) :

```tsx
{sel.kind === 'ennemi' && appearanceLayers(sel.ref ?? '').length > 0 && (
  <div className="ed-field">
    <span>Apparence</span>
    {appearanceLayers(sel.ref ?? '').map((layer) => (
      <label key={layer.slot} className="ed-subfield">
        {layer.slot}
        <select
          value={sel.appearance?.pins?.[layer.slot] ?? -1}
          onChange={(e) => {
            const v = Number(e.target.value);
            const pins = { ...(sel.appearance?.pins ?? {}) };
            if (v < 0) delete pins[layer.slot];
            else pins[layer.slot] = v;
            updateSel({ appearance: { ...sel.appearance, pins } });
          }}
        >
          <option value={-1}>Aléatoire</option>
          {layer.variants.map((_, i) => (
            <option key={i} value={i}>
              variante {i + 1}
            </option>
          ))}
        </select>
      </label>
    ))}
    <button
      className="btn small"
      onClick={() =>
        updateSel({ appearance: { ...sel.appearance, seed: hashSeed(sel.id + ':' + Math.floor(performance.now())) } })
      }
    >
      🎲 Relancer
    </button>
  </div>
)}
```

> Note : `performance.now()` est utilisé uniquement comme source de variation du seed sur
> clic utilisateur (pas dans le rendu déterministe). Acceptable ici (action UI explicite).

- [ ] **Step 3 : Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4 : Vérif navigateur**

Sélectionner un mutant posé → section « Apparence » avec menu `pose` (Aléatoire + 4 variantes) ; choisir « variante 1 » fige la hache ; 🎲 Relancer change le tirage. Screenshot.

- [ ] **Step 5 : Commit**

```bash
git add src/ui/editor/Editor.tsx
git commit -m "feat(editeur): inspecteur — section Apparence (pins + reroll)"
```

**✅ Fin Phase B.** `npm test` + `npm run typecheck` verts ; mutants/humains variés et pilotables dans l'éditeur.

---

# PHASE C — Décors « ADN » d'ambush

But : ajouter au catalogue décor les placeables manquants pour reconstituer l'embuscade.

## Task C1 : Keyframes gore optionnelles

**Files:**
- Modify: `src/gameIso/anim.css`

- [ ] **Step 1 : Ajouter `gush` et `fly`** (repris d'`ambush.html:8,11,20,24`)

```css
.gush {
  animation: gush 1.6s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: 0 50%;
}
.fly { animation: orbit 1.1s linear infinite; }
.f1 { animation-delay: -.3s; } .f2 { animation-delay: -.6s; } .f3 { animation-delay: -.85s; }
@keyframes gush {
  0%, 100% { transform: scaleX(.7); opacity: .7; }
  50% { transform: scaleX(1.2); opacity: 1; }
}
@keyframes orbit {
  0% { transform: translate(9px,0); } 25% { transform: translate(0,-7px); }
  50% { transform: translate(-9px,0); } 75% { transform: translate(0,7px); }
  100% { transform: translate(9px,0); }
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/gameIso/anim.css
git commit -m "feat(gameIso): keyframes gore (gush/fly) ex ambush"
```

## Task C2 : 4 nouveaux décors (cadavre, mare-sang, cheval-mort, epave-carrosse)

**Files:**
- Modify: `src/gameIso/catalog/decor.ts`
- Test: `src/gameIso/catalog/decor.test.ts`

- [ ] **Step 1 : Étendre le test du catalogue**

Dans `decor.test.ts`, ajouter `'cadavre', 'mare-sang', 'cheval-mort', 'epave-carrosse'` à la liste des ids attendus du premier `it`, et ajouter :

```ts
  it('rend un SVG non vide pour les nouveaux décors d ambush', () => {
    for (const id of ['cadavre', 'mare-sang', 'cheval-mort', 'epave-carrosse'])
      expect(propSvg(id).length, id).toBeGreaterThan(20);
  });
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npm test -- decor`
Expected: FAIL — ids absents de `PROPS`.

- [ ] **Step 3 : Ajouter les 4 décors** (boîte 120×150, pieds en (60,150))

Dans `decor.ts`, ajouter ces fonctions et entrées. **`mare-sang` fournie verbatim** (ellipses gradient `blood`, gradient déjà ajouté en B1) :

```ts
const mareSang = () =>
  `<g><ellipse cx="60" cy="146" rx="34" ry="12" fill="url(#blood)" opacity="0.85"/><ellipse cx="44" cy="142" rx="12" ry="5" fill="url(#blood)" opacity="0.7"/><ellipse cx="78" cy="148" rx="9" ry="4" fill="url(#blood)" opacity="0.6"/></g>`;

// cadavre — porter ambush.html:277-286 (corps + crâne), retirer l'ombre/translate de
//   scène, recentrer pieds ≈ y146.
const cadavre = () =>
  `<g> /* … porter ambush.html:277-286 … */ </g>`;

// cheval-mort — porter ambush.html:303-320 (corps couché), passer l'encolure en
//   position abattue (pas de classe kick), pieds ≈ y148.
const chevalMort = () =>
  `<g> /* … porter ambush.html:303-320 … */ </g>`;

// epave-carrosse — porter ambush.html:394-407 (caisse + roues), simplifier dans la
//   boîte 120×150, gradient #coach (ajouter à DEFS si absent), pieds ≈ y148.
const epaveCarrosse = () =>
  `<g> /* … porter ambush.html:394-407 … */ </g>`;
```

Puis dans l'objet `PROPS`, ajouter :

```ts
  cadavre: { id: 'cadavre', label: 'Cadavre', render: cadavre },
  'mare-sang': { id: 'mare-sang', label: 'Mare de sang', render: mareSang },
  'cheval-mort': { id: 'cheval-mort', label: 'Cheval mort', render: chevalMort },
  'epave-carrosse': { id: 'epave-carrosse', label: 'Épave de carrosse', render: epaveCarrosse },
```

> **Instruction de portage :** remplacer les commentaires `/* … */` par le SVG réel issu
> des lignes d'`ambush.html` indiquées, en retirant l'`<ellipse>` d'ombre et le transform
> de scène externe. Si `epaveCarrosse` utilise `url(#coach)`/`url(#horse)`, ajouter ces
> gradients à `DEFS` (cf. B1, mêmes définitions qu'ambush:30-31). Le SVG ne doit pas être
> vide avant le Step 4 (sinon l'assertion « > 20 » échoue).

- [ ] **Step 4 : Lancer test + typecheck**

Run: `npm test -- decor && npm run typecheck`
Expected: PASS.

- [ ] **Step 5 : Vérif navigateur**

Éditeur → palette décor → les 4 nouveaux placeables sont listés ; les poser sur la carte. Screenshot.

- [ ] **Step 6 : Commit**

```bash
git add src/gameIso/catalog/decor.ts src/gameIso/catalog/decor.test.ts src/gameIso/sprites.ts
git commit -m "feat(gameIso): decors ambush — cadavre, sang, cheval mort, epave"
```

**✅ Fin Phase C.** Reconstituer une embuscade dans l'éditeur (route iso + sapins + carrosse/épave + mutants variés + sang/cadavres) et comparer à `ambush.html`. `npm test` + `npm run typecheck` verts.

---

## Self-Review (effectuée)

- **Couverture spec :** modèle calques (A1-A2) ✓ ; seed+override (A2,A4,A5,B4) ✓ ; fallback monolithique (A3) ✓ ; Mutant 4 poses + Humain (B2,B3) ✓ ; inspecteur apparence (B4) ✓ ; 4 décors (C2) ✓ ; gradients/keyframes (B1,C1) ✓ ; tests (A1-A3,B2,B3,C2) ✓ ; moteur engine non touché ✓ ; limite combat-pins documentée (spec, non implémentée — hors périmètre v1) ✓.
- **Placeholders :** les `/* … */` des fragments d'art sont des **instructions de portage avec références de lignes source exactes dans `public/ambush.html`** + contrainte de test (SVG non vide), pas des TODO vagues. Le code logique (Phase A) est complet.
- **Cohérence des types :** `AppearanceLayer`/`CreatureAppearance`/`AppearancePins`/`EntityAppearance` définis en A1/A4 et réutilisés tels quels ; `composeAppearance(name, seed, pins)` et `appearanceLayers(name)` signatures stables A2→B4 ; `enemySprite(label, seed?, pins?)` A3→A5/A6.
```
