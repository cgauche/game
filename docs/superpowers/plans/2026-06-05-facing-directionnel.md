# Facing directionnel (sous-projet E) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux héros riggés un facing 8 directions, en sélectionnant 1 de 3 vues d'art (front existante, back + profile nouvelles) + miroir G/D selon la direction du déplacement/de l'attaque.

**Architecture:** Une couche PURE `facing.ts` (octant écran → vue + miroir) ; une `VIEW_POSE` (pose de base par vue, profil = stance de côté) ; un type `PartArt = string | {front, back?, profile?}` avec `pickView()` (fallback `front` → zéro régression) threadé via `view` dans `resolveParts`/`resolveRig`/`RigSprite` ; `AnimatedRigToken` calcule et fait persister le facing. Tranche verticale (système + 1 archétype arté) avant l'art de masse (workflows).

**Tech Stack:** Vite + TypeScript + React, Vitest, SVG. Aucune dépendance ajoutée.

**Lire avant :** `docs/superpowers/specs/2026-06-05-facing-directionnel-design.md`, `src/gameIso/rig/PART-CONTRACT.md`.

**Commits :** trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` ; `git add` de chemins explicites.

---

## File Structure

Créés :
- `src/gameIso/rig/facing.ts` — `View`, `facingView`, `screenDir` (+ `facing.test.ts`).
- `src/gameIso/rig/viewPose.ts` — `VIEW_POSE`.
- `src/gameIso/rig/parts/slice-soldat.ts` — art back/profile du Soldat humain (slice).

Modifiés :
- `src/gameIso/rig/parts/types.ts` — `PartArt`, `pickView`.
- `src/gameIso/rig/parts/{cosmetic,career,equipment}.ts` — résolveurs renvoient `PartArt`.
- `src/gameIso/rig/parts/resolve.ts` — `view` threadé, `pickView` appliqué.
- `src/gameIso/rig/composeRig.tsx` — `view` dans `resolveRig`/`RigSprite` + compose `VIEW_POSE`.
- `src/gameIso/AnimatedRigToken.tsx` — état `facing` {view, mirror} depuis move/attack.

---

## Task 1 : `facing.ts` — octant écran → vue + miroir

**Files:** Create `src/gameIso/rig/facing.ts`, `src/gameIso/rig/facing.test.ts`

- [ ] **Step 1 : Test (échec attendu)**

```ts
// src/gameIso/rig/facing.test.ts
import { describe, it, expect } from 'vitest';
import { facingView, screenDir } from './facing';

describe('facingView', () => {
  it('vers le bas → front, vers le haut → back', () => {
    expect(facingView(0, 10).view).toBe('front');
    expect(facingView(0, -10).view).toBe('back');
  });
  it('latéral net → profile', () => {
    expect(facingView(10, 0).view).toBe('profile');
    expect(facingView(10, 1).view).toBe('profile'); // ax > 1.5*ay
  });
  it('miroir = regarde à gauche (dx < 0)', () => {
    expect(facingView(-10, 5).mirror).toBe(true);
    expect(facingView(10, 5).mirror).toBe(false);
  });
  it('diagonale basse → front, haute → back', () => {
    expect(facingView(5, 10).view).toBe('front');
    expect(facingView(5, -10).view).toBe('back');
  });
});

describe('screenDir', () => {
  it('delta écran iso (screenX ∝ x−y, screenY ∝ x+y)', () => {
    expect(screenDir({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ dx: 1, dy: 1 });
    expect(screenDir({ x: 0, y: 0 }, { x: 0, y: 1 })).toEqual({ dx: -1, dy: 1 });
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run src/gameIso/rig/facing.test.ts`
Expected : FAIL — module introuvable.

- [ ] **Step 3 : Implémenter `facing.ts`**

```ts
// src/gameIso/rig/facing.ts
export type View = 'front' | 'back' | 'profile';

/** Direction ÉCRAN (dx,dy px iso) → vue + miroir. PUR. */
export function facingView(dx: number, dy: number): { view: View; mirror: boolean } {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const view: View = ax > ay * 1.5 ? 'profile' : dy >= 0 ? 'front' : 'back';
  return { view, mirror: dx < 0 };
}

/** Vecteur direction ÉCRAN entre deux tuiles (iso : screenX ∝ x−y, screenY ∝ x+y). */
export function screenDir(from: { x: number; y: number }, to: { x: number; y: number }) {
  return { dx: to.x - to.y - (from.x - from.y), dy: to.x + to.y - (from.x + from.y) };
}
```

- [ ] **Step 4 : Lancer (succès attendu)** — `npx vitest run src/gameIso/rig/facing.test.ts` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/rig/facing.ts src/gameIso/rig/facing.test.ts
git commit -m "feat(facing): facingView (octant ecran -> vue+miroir) + screenDir"
```

---

## Task 2 : `viewPose.ts` — pose de base par vue

**Files:** Create `src/gameIso/rig/viewPose.ts`

> Valeurs initiales (profil) réglées à la recette navigateur (Task 6). `front`/`back` = repos.

- [ ] **Step 1 : Implémenter**

```ts
// src/gameIso/rig/viewPose.ts
import type { Pose } from './poses';
import type { View } from './facing';

/** Pose de base par vue (deltas d'angles, composés avec la pose d'anim). */
export const VIEW_POSE: Record<View, Pose> = {
  front: {},
  back: {},
  // Profil : membres ramenés vers l'axe (un bras/jambe devant l'autre), léger pivot.
  profile: { epauleG: 14, epauleD: -14, avantBrasG: 8, avantBrasD: -8, cuisseG: 10, cuisseD: -10, torse: 4 },
};
```

- [ ] **Step 2 : Typecheck** — `npm run typecheck` → PASS.

- [ ] **Step 3 : Commit**

```bash
git add src/gameIso/rig/viewPose.ts
git commit -m "feat(facing): VIEW_POSE (pose de base par vue ; profil = stance de cote)"
```

---

## Task 3 : Dimension de vue dans les parts + `view` dans composeRig

**Files:** Modify `parts/types.ts`, `parts/cosmetic.ts`, `parts/career.ts`, `parts/equipment.ts`, `parts/resolve.ts`, `composeRig.tsx` ; Test via `composeRig.test.ts`

> Modèle : `PartArt = string | {front, back?, profile?}`. Les données existantes (strings) = `front`
> pour TOUTES les vues → **zéro régression**. `view` défaut `'front'`.

- [ ] **Step 1 : `parts/types.ts` — PartArt + pickView**

```ts
// src/gameIso/rig/parts/types.ts
import type { View } from '../facing';

/** Fragment SVG dessiné dans le repère LOCAL de l'os porteur (origine au pivot). */
export interface Part { svg: string; }

/** Art d'une part : soit un seul SVG (= front pour toutes les vues), soit par vue. */
export type PartArt = string | { front: string; back?: string; profile?: string };

/** Choisit le SVG d'une vue, avec fallback sur front. */
export function pickView(art: PartArt | undefined | null, view: View): string {
  if (art == null) return '';
  if (typeof art === 'string') return art;
  return art[view] ?? art.front;
}
```

- [ ] **Step 2 : Résolveurs renvoient `PartArt` (changement de type, corps inchangés — un string EST un PartArt)**

Dans `parts/cosmetic.ts` : `cosmeticPart(...): Part` → renvoyer `PartArt`. Concrètement, retirer
l'emballage `{ svg }` et renvoyer directement la chaîne / l'entrée générée :

```ts
// parts/cosmetic.ts — signature + retour
import { pickView, type PartArt } from './types'; // (pickView non requis ici, mais Part plus utilisé)
// GENERATED_HEADS reste { visage?: PartArt; cheveux?: PartArt } (string = front, ou objet par vue)
export function cosmeticPart(slot: 'visage' | 'cheveux', species: string, sex: 'M' | 'F', idx: number): PartArt {
  const base = baseSpeciesOf(species);
  const gen = GENERATED_HEADS[`${base}:${sex}`];
  if (gen?.[slot] != null) return gen[slot]!; // PartArt (string ou {front,back,profile})
  if (slot === 'visage') return pick(VISAGE, `${base}:${sex}`, 'default', idx);
  return pick(CHEVEUX, `${base}:${sex}`, 'Humain:M', idx);
}
```

Dans `parts/career.ts` : `careerTenueFor(career): Partial<Record<'torse'|'jambes'|'bras'|'tete', PartArt>>`
(les `TENUES`/`GENERATED_CAREER_TENUES` valent désormais `PartArt`). Le corps est inchangé (il
renvoie déjà des chaînes ou les entrées générées) ; seul le type de retour passe à `PartArt`.

Dans `parts/equipment.ts` : `weaponPart(w): PartArt` (retourne `WEAPONS[fam] ?? WEAPONS.epee`, sans
`{svg}`), `shieldPart(x): PartArt`, `armourPart(item, slot): PartArt | null` (retourne le SVG/PartArt
sans `{svg}`). `genericPart(slot)` (dans `parts/generic.ts`) : renvoyer la chaîne (`PartArt`) au lieu
de `{ svg }`. Mettre les types des maps (`GENERATED_WEAPONS`, `GENERATED_ARMOUR`, `WEAPONS`,
`MATERIAL_FILL`-issus) en `PartArt` là où elles portent du SVG.

- [ ] **Step 3 : `parts/resolve.ts` — threader `view` + appliquer `pickView`**

```ts
import { pickView, type Part, type PartArt } from './types';
import type { View } from '../facing';
// ... imports inchangés ...

export function resolveParts(
  species: string, sex: 'M' | 'F', career: string | undefined,
  equip: EquipCtx, overrides: Partial<Record<Slot, number>>, seed: number,
  view: View = 'front',
): Record<Slot, Part | null> {
  const tenue = careerTenueFor(career);
  const out = {} as Record<Slot, Part | null>;
  const P = (art: PartArt | null | undefined): Part => ({ svg: pickView(art, view) }); // applique la vue

  out.visage = P(cosmeticPart('visage', species, sex, overrides.visage ?? seed % 2));
  out.cheveux = P(cosmeticPart('cheveux', species, sex, overrides.cheveux ?? (seed >> 2) % 3));

  const BODY: Slot[] = ['tete', 'bras', 'torse', 'jambes'];
  for (const slot of BODY) {
    const tenuePart = tenue[slot as 'torse' | 'jambes' | 'bras' | 'tete'];
    if (overrides[slot] != null) { out[slot] = P(tenuePart ?? genericPart(slot)); continue; }
    const armed = equip.armour.map((it) => armourPart(it, slot)).find((p) => p != null);
    if (armed != null) { out[slot] = P(armed); continue; }
    out[slot] = P(tenuePart ?? (slot === 'tete' ? '' : genericPart(slot)));
  }

  const mainWeapon = equip.weapons.find((w) => !isShield(w));
  out.arme = P(mainWeapon ? weaponPart(mainWeapon) : '');
  out.bouclier = P(equip.shield ? shieldPart(equip.shield) : '');
  return out;
}
```

- [ ] **Step 4 : `composeRig.tsx` — `view` + compose VIEW_POSE**

```tsx
import type { View } from './facing';
import { VIEW_POSE } from './viewPose';
// lerp/merge des poses : VIEW_POSE[view] + pose (somme des deltas)
function addPose(a: Pose, b: Pose): Pose {
  const out: Pose = { ...a };
  for (const k of Object.keys(b) as (keyof Pose)[]) out[k] = (out[k] ?? 0) + (b[k] ?? 0);
  return out;
}

export function resolveRig(
  appearance: Appearance, equip: EquipCtx, pose: Pose, career?: string, view: View = 'front',
): ResolvedBone[] {
  const sk = applyBuild(baseSkeleton(appearance.species, appearance.sex), appearance.build);
  const world = worldTransforms(sk, addPose(VIEW_POSE[view], pose)); // pose de vue + anim
  const parts = resolveParts(appearance.species, appearance.sex, career, equip, appearance.parts ?? {}, appearance.seed ?? 1, view);
  // ... reste inchangé (scaleOf, boneParts, tri z) ...
}

export function RigSprite({ appearance, equip, pose = {}, career, view = 'front' }: {
  appearance: Appearance; equip: EquipCtx; pose?: Pose; career?: string; view?: View;
}): JSX.Element {
  const bones = resolveRig(appearance, equip, pose, career, view);
  // ... rendu inchangé ...
}
```

- [ ] **Step 5 : Tests composeRig (ajouts)** — dans `composeRig.test.ts` :

```ts
import { CLIPS } from './anim/clips'; // si besoin ; sinon ignorer
it('view=profile change la pose de base (≠ front) et ne casse pas', () => {
  const front = resolveRig(app, equip, {}, undefined, 'front');
  const prof = resolveRig(app, equip, {}, undefined, 'profile');
  const epF = front.find((b) => b.id === 'epauleG')?.matrix.join(',');
  const epP = prof.find((b) => b.id === 'epauleG')?.matrix.join(',');
  expect(epP).not.toBe(epF); // VIEW_POSE.profile a bougé epauleG
});
it('view=back sans art back retombe sur le SVG front (jamais vide)', () => {
  const back = resolveRig(app, equip, {}, undefined, 'back');
  const torse = back.find((b) => b.id === 'torse');
  expect(torse?.parts.some((p) => p.svg.includes('<'))).toBe(true);
});
```

- [ ] **Step 6 : Lancer toute la suite rig (non-régression)** — `npx vitest run src/gameIso/rig && npm run typecheck`
Expected : PASS (front inchangé ; les données string = front pour toutes les vues).

- [ ] **Step 7 : Commit**

```bash
git add src/gameIso/rig/parts/types.ts src/gameIso/rig/parts/cosmetic.ts src/gameIso/rig/parts/career.ts src/gameIso/rig/parts/equipment.ts src/gameIso/rig/parts/generic.ts src/gameIso/rig/parts/resolve.ts src/gameIso/rig/composeRig.tsx src/gameIso/rig/composeRig.test.ts
git commit -m "feat(facing): dimension de vue (PartArt+pickView) + view dans resolveRig/RigSprite (fallback front)"
```

---

## Task 4 : `AnimatedRigToken` — état facing depuis move/attack

**Files:** Modify `src/gameIso/AnimatedRigToken.tsx`

- [ ] **Step 1 : Remplacer l'état `flip` par un état `facing` {view, mirror}**

```tsx
import { facingView, screenDir, type View } from './rig/facing';
// ...
const [facing, setFacing] = useState<{ view: View; mirror: boolean }>({ view: 'front', mirror: false });
```

- [ ] **Step 2 : Calculer le facing dans les handlers du bus** (remplace l'ancien `faceTowards`)

```tsx
    const face = (a?: { x: number; y: number }, b?: { x: number; y: number }) => {
      if (!a || !b) return;
      const { dx, dy } = screenDir(a, b);
      if (dx === 0 && dy === 0) return;
      setFacing(facingView(dx, dy));
    };
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.from === id) {
        const cs = useGame.getState().battle?.combatants;
        face(cs?.find((c) => c.id === d.from)?.pos, cs?.find((c) => c.id === d.to)?.pos);
        play(CLIP_FOR_KIND[d.kind] ?? 'melee', { onImpact: () => bus.emit(EVT.ANIM_IMPACT, { to: d.to, result: d.result }) });
      } else if (d.to === id && !d.result?.hit) {
        play(d.defense === 'parade' ? 'parry' : 'dodge');
      }
    });
    // offImpact inchangé
    const offMove = bus.on(EVT.ANIM_MOVE, (d: any) => {
      if (d.id !== id) return;
      const p = d.path;
      if (p && p.length > 1) face(p[0], p[p.length - 1]);
      play('walk');
      window.setTimeout(() => play('idle'), Math.max(1, (p?.length ?? 1)) * STEP_MS);
    });
```

- [ ] **Step 3 : Rendu — passer `view` + appliquer le miroir**

```tsx
  return (
    <g transform={facing.mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite
        appearance={combatant.appearance ?? defaultAppearance(combatant)}
        equip={equipFromCombatant(combatant)}
        career={combatant.career}
        pose={pose}
        view={facing.view}
      />
    </g>
  );
```

- [ ] **Step 4 : Typecheck + test du token** — `npm run typecheck && npx vitest run src/gameIso/AnimatedRigToken.test.tsx`
Expected : PASS (le test headless rend toujours `data-bone`).

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/AnimatedRigToken.tsx
git commit -m "feat(facing): AnimatedRigToken calcule la vue (front/back/profile)+miroir depuis move/attack, persistante"
```

---

## Task 5 : Tranche verticale — art back/profile du Soldat humain

**Files:** Create `src/gameIso/rig/parts/slice-soldat.ts` ; Modify `parts/career.ts`, `parts/cosmetic.ts`, `parts/equipment.ts` (brancher les vues du slice)

> Art initial dessiné main (silhouettes claires, contrat de part) — réglé à la recette (Task 6).
> But : valider le SYSTÈME, pas la beauté finale.

- [ ] **Step 1 : Parts back/profile du Soldat humain** (tête, tenue, épée)

```ts
// src/gameIso/rig/parts/slice-soldat.ts
import type { PartArt } from './types';

// Tête Humain M : arrière (pas de visage, cheveux/nuque) + profil.
export const HEAD_HUMAIN_M: { visage: PartArt; cheveux: PartArt } = {
  visage: {
    front: `<circle cx="0" cy="7" r="9" fill="#e2b48c"/><ellipse cx="-3" cy="7" rx="1.4" ry="2" fill="url(#g_eye)"/><ellipse cx="3" cy="7" rx="1.4" ry="2" fill="url(#g_eye)"/>`,
    back: `<circle cx="0" cy="7" r="9" fill="#d8a87c"/>`, // nuque, pas d'yeux
    profile: `<path d="M-2 -2 Q9 -2 9 7 Q9 16 -1 16 Q-3 10 -2 -2Z" fill="#e2b48c"/><ellipse cx="4" cy="7" rx="1.3" ry="2" fill="url(#g_eye)"/>`,
  },
  cheveux: {
    front: `<path d="M-9 6 Q0 -7 9 6 Q5 -1 0 -1 Q-5 -1 -9 6Z" fill="#5a4427"/>`,
    back: `<path d="M-9 6 Q0 -8 9 6 L9 14 Q0 12 -9 14Z" fill="#5a4427"/>`, // cheveux couvrant l'arrière
    profile: `<path d="M-3 6 Q-4 -7 6 -6 Q9 -2 8 6 Q3 0 -3 6Z" fill="#5a4427"/>`,
  },
};

// Tenue Soldat (Guerriers) : dos (cuirasse arrière + cape) + profil.
export const TENUE_SOLDAT: { torse: PartArt; jambes: PartArt } = {
  torse: {
    front: `<path d="M-14 -28 Q0 -33 14 -28 L13 4 L11 34 Q0 38 -11 34 L-13 4 Z" fill="url(#g_steel)" stroke="#3a4150"/>`,
    back: `<path d="M-14 -28 Q0 -33 14 -28 L13 4 L11 34 Q0 38 -11 34 L-13 4 Z" fill="#6a7384" stroke="#3a4150"/>`, // dos métal mat
    profile: `<path d="M-7 -28 Q4 -31 9 -26 L8 6 L7 34 Q0 37 -6 33 L-7 4 Z" fill="url(#g_steel)" stroke="#3a4150"/>`,
  },
  jambes: {
    front: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#3a2c22"/>`,
    back: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#2f241c"/>`,
    profile: `<rect x="-3" y="0" width="7" height="50" rx="3" fill="#3a2c22"/>`,
  },
};

// Épée : dos (vue de dos, lame derrière) + profil.
export const WEAPON_EPEE: PartArt = {
  front: `<rect x="-1.5" y="-2" width="3" height="6" fill="#5a3f24"/><rect x="-1" y="-30" width="2" height="28" fill="url(#g_steel)"/><rect x="-5" y="-2" width="10" height="2.5" fill="#caa64a"/>`,
  back: `<rect x="-1.5" y="-2" width="3" height="6" fill="#4a3320"/><rect x="-1" y="-30" width="2" height="28" fill="#6a7384"/>`,
  profile: `<rect x="-1.2" y="-2" width="2.4" height="6" fill="#5a3f24"/><rect x="-0.8" y="-30" width="1.6" height="28" fill="url(#g_steel)"/>`,
};
```

- [ ] **Step 2 : Brancher le slice** (les vues priment pour l'archétype) :
  - `parts/cosmetic.ts` : si `GENERATED_HEADS['Humain:M']` absent ou string-only, faire pointer
    `visage`/`cheveux` vers `HEAD_HUMAIN_M` (import du slice) pour Humain:M.
  - `parts/career.ts` : `TENUES.Guerriers` (ou l'entrée Soldat) → `torse`/`jambes` = `TENUE_SOLDAT`.
  - `parts/equipment.ts` : `WEAPONS.epee` → `WEAPON_EPEE`.

> Mécaniquement : remplacer les valeurs string par les `PartArt` du slice aux endroits concernés
> (les autres restent string = front-only).

- [ ] **Step 3 : Typecheck + tests** — `npm run typecheck && npx vitest run src/gameIso/rig`
Expected : PASS.

- [ ] **Step 4 : Galerie QC 8-dir** — étendre `scripts/gen-rig-gallery.mts` : rendre le Soldat humain
dans les 3 vues (`front`/`back`/`profile`) côte à côte (passer `view` à `<RigSprite>`), régénérer.

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/rig/parts/slice-soldat.ts src/gameIso/rig/parts/cosmetic.ts src/gameIso/rig/parts/career.ts src/gameIso/rig/parts/equipment.ts scripts/gen-rig-gallery.mts
git commit -m "feat(facing): tranche verticale — Soldat humain en front/back/profile (validation systeme)"
```

---

## Task 6 : Recette navigateur (slice)

**Files:** validation (corriger + recommiter si besoin : `viewPose.ts`, `slice-soldat.ts`).

- [ ] **Step 1 : Galerie** — `npx tsx scripts/gen-rig-gallery.mts`, ouvrir `http://localhost:<port>/rig-gallery.html` (lancer `npm run dev` si besoin). Vérifier que le Soldat a 3 silhouettes distinctes (face/dos/profil) cohérentes.

- [ ] **Step 2 : En jeu** — « 🧪 Test rapide ». Déplacer un héros Soldat dans les 8 directions :
  - bas/diagonales-bas → **face** ; haut/diagonales-haut → **dos** ; côtés → **profil** ; G/D miroité.
  - Vérifier via `evaluate` que `g.rig` reçoit `view` (la pose de base change) et que le wrapper
    porte le miroir quand on va à gauche. **0 erreur console.** Screenshots des orientations.

- [ ] **Step 3 : Régler** — ajuster `VIEW_POSE.profile` et les SVG du slice (`slice-soldat.ts`) jusqu'à
ce que le profil/dos lisent bien. Itérer.

- [ ] **Step 4 : Commit éventuel** — `git commit -m "fix(facing): reglages slice (viewPose profil + parts dos/profil)"`

---

## Task 7 : Art de masse (workflows) — back + profile de toutes les parts

> **Ne démarrer qu'après validation du slice (Task 6).** Réutilise le pattern des workflows d'art
> (lecture d'image officielle + contrat de part étendu aux conventions back/profil), best-of-2.

- [ ] **Step 1 : Étendre `PART-CONTRACT.md`** — conventions des vues `back` (arrière de tête sans
visage, cheveux/nuque, dos de tenue) et `profile` (silhouette de côté, un bras/jambe devant).

- [ ] **Step 2 : Workflow têtes** — pour chaque espèce×sexe (réf espèce), générer `back` + `profile`
de `visage`+`cheveux`. Ingestion → `GENERATED_HEADS[key]` devient `{visage:{front,back,profile}, …}`.

- [ ] **Step 3 : Workflow tenues** — pour chaque carrière (réf illustration), générer `back`+`profile`
de `torse`/`jambes`/(`tete`). Ingestion → `GENERATED_CAREER_TENUES_AUTO` par vue.

- [ ] **Step 4 : Workflow armes/armures** — `back`+`profile` des familles d'armes et des matériaux×
emplacements. Ingestion → `GENERATED_WEAPONS`/`GENERATED_ARMOUR` par vue.

- [ ] **Step 5 : Adapter `_ingest-rig-art.mjs`** — accepter une `view` par run (front/back/profile)
et fusionner dans la structure `PartArt` (sans écraser les autres vues). QC galerie 8-dir par lot.

> C'est un backlog d'art itératif (lots best-of-2). Tout manque de vue retombe sur `front` (le rig
> rend toujours). `log`/noter les parts encore mono-vue.

---

## Self-review (auteur du plan)

- **Couverture du spec** : §3 facing model→Task1 ; §4 vue=pose+parts→Tasks2/3 ; §5 view dans composeRig→Task3 ; §6 câblage AnimatedRigToken→Task4 ; §7 slice→Tasks5/6, masse→Task7 ; §8 périmètre (héros only, créatures miroir)→respecté (E ne touche pas le token créature) ; §9 tests→facing.test + composeRig + recette. ✔
- **Placeholders** : code complet pour facing/viewPose/pickView/resolveParts/composeRig/AnimatedRigToken ; le slice fournit des SVG concrets (réglés en Task 6) ; Task 7 est un backlog d'art explicitement itératif (pattern workflow déjà éprouvé), pas un TODO caché. Step 2 de Task 3 décrit le changement de type de chaque résolveur sans répéter des corps identiques (le corps ne change pas — seul le type de retour PartArt, surensemble de string).
- **Cohérence des types** : `View`, `facingView`, `screenDir`, `VIEW_POSE`, `PartArt`, `pickView`, `resolveParts(...,view)`, `resolveRig(appearance,equip,pose,career?,view?)`, `RigSprite({…view})`, `AnimatedRigToken` état `facing{view,mirror}` — noms cohérents entre tâches. ✔
