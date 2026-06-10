# Gabarits corporels — Phase A : fondation + quadrupède production — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** transformer le proto quadrupède en gabarit corporel de production, branché de bout en bout (combat + exploration + éditeur), avec vrai facing 8-dir, démarche/attaque/mort, recolor — via une fondation `BodyPlan` qui unifie le dispatch SANS toucher le rig héros.

**Architecture :** un registre `bodyPlan.ts` expose des plans (`biped`/`quadruped`) qui produisent tous des `ResolvedBone[]` (os + matrice + parts tokenisées), rendus par UN composant partagé `RigSprite` et animés par UN wrapper `AnimatedBodyToken` (facing + démarche + attaque/coup via le bus + mort). Le `bipedPlan` enveloppe `resolveRig` existant (zéro régression). Le `quadrupedPlan` industrialise le proto. `IsoStage` choisit le plan via `bodyPlanOf(name)`.

**Tech Stack :** Vite + TypeScript + React, Vitest, SVG, resvg (QC headless). Aucune dépendance ajoutée.

**Lire avant :** `docs/superpowers/specs/2026-06-05-gabarits-corporels-design.md`, `src/gameIso/rig/composeRig.tsx`, `src/gameIso/AnimatedRigToken.tsx`, `src/gameIso/rig/quadruped/quadruped.ts` (proto), `src/gameIso/rig/PART-CONTRACT.md`.

**Règles :** aucune invention de règles (rendu cosmétique pur, engine intact) ; vérif **headless uniquement, jamais navigateur** ; commits de chemins explicites uniquement (working tree partagé avec l'autre session) ; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` ; `npm test 2>&1 | grep -E "Tests "` doit être vert AVANT tout déploiement.

---

## File Structure

Créés :
- `src/gameIso/rig/bodyPlan.ts` — `BodyPlan`, `BodyPlanId`, `bodyPlanOf`, `planById` (+ `bodyPlan.test.ts`).
- `src/gameIso/rig/quadruped/quadSkeleton.ts` — os, `QUAD_SPECIES`, `buildQuadSkeleton`, `groundQuad`.
- `src/gameIso/rig/quadruped/quadParts.ts` — parts paramétriques tokenisées, **multi-vues** (front/profile/back).
- `src/gameIso/rig/quadruped/quadPose.ts` — `QUAD_REST`, `quadWalkPose`, `quadBitePose`, `QUAD_DEATH`.
- `src/gameIso/rig/quadruped/composeQuad.ts` — `resolveQuad(...): ResolvedBone[]` + `quadrupedPlan`.
- `src/gameIso/AnimatedBodyToken.tsx` — wrapper d'anim générique (facing + clips du plan + bus).
- `scripts/_qc-quad.mts` — planche QC production (8 dir × espèces × {repos/marche/attaque/mort/recolor}).

Modifiés :
- `src/gameIso/rig/composeRig.tsx` — exporte `ResolvedBone` (déjà) + `renderBones()` partagé.
- `src/gameIso/rig/enemyProfile.ts` — `CREATURE_RE` perd les quadrupèdes ; `bodyPlanOf` les capte.
- `src/gameIso/IsoStage.tsx` — dispatch par `bodyPlanOf` (combat + exploration).
- `src/ui/editor/MonsterPartsFields.tsx` — sélecteur plan='quadruped' → espèce + taille + couleurs.
- `src/gameIso/creatureSprites.json` / `creatureViews.json` — retrait des entrées couvertes.

Supprimés (proto remplacé) :
- `src/gameIso/rig/quadruped/quadruped.ts` (éclaté dans les 4 fichiers ci-dessus), `scripts/_qc-quad-proto.mts`.

---

## Task A1 — Registre `BodyPlan` + classifieur

**Files:** Create `src/gameIso/rig/bodyPlan.ts`, `src/gameIso/rig/bodyPlan.test.ts`

- [ ] **Step 1 : Test (échec attendu)**

```ts
// src/gameIso/rig/bodyPlan.test.ts
import { describe, it, expect } from 'vitest';
import { bodyPlanOf, planById } from './bodyPlan';

describe('bodyPlanOf', () => {
  it('quadrupèdes → quadruped', () => {
    for (const n of ['Cheval', 'Loup', 'Sanglier', 'Rat géant', 'Ours']) expect(bodyPlanOf(n)).toBe('quadruped');
  });
  it('humanoïdes → biped', () => {
    for (const n of ['Soldat', 'Bandit', 'Mendiant']) expect(bodyPlanOf(n)).toBe('biped');
  });
  it('exotiques sans plan → monolithic', () => {
    for (const n of ['Araignée géante', 'Serpent']) expect(bodyPlanOf(n)).toBe('monolithic');
  });
});

describe('planById', () => {
  it('quadruped rend des os non vides avec pieds au sol', () => {
    const bones = planById('quadruped').resolve('Cheval', 'profile', {});
    expect(bones.length).toBeGreaterThan(8);
    const footY = Math.max(...bones.filter((b) => b.id.startsWith('pied')).map((b) => b.matrix[5]));
    expect(footY).toBeGreaterThan(120); // pieds vers le bas de la boîte
  });
  it('walkPose diffère du repos', () => {
    expect(planById('quadruped').walkPose(0.25)).not.toEqual(planById('quadruped').restPose());
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — `npm test -- bodyPlan` → FAIL (module introuvable).
- [ ] **Step 3 : Implémenter `bodyPlan.ts`**

```ts
// src/gameIso/rig/bodyPlan.ts
import type { ResolvedBone } from './composeRig';
import type { View } from './facing';
import type { Palette } from './palette';
import { quadrupedPlan } from './quadruped/composeQuad';
import { bipedPlan } from './bipedPlan';

export type BodyPlanId = 'biped' | 'quadruped' | 'winged';
export interface ResolveOpts { colors?: Palette; career?: string; equip?: unknown; appearance?: unknown; }
export interface BodyPlan {
  id: BodyPlanId;
  resolve(species: string, view: View, pose: Record<string, number>, opts?: ResolveOpts): ResolvedBone[];
  speciesNames(): string[];
  restPose(): Record<string, number>;
  walkPose(phase: number): Record<string, number>;
  attackPose(phase: number): Record<string, number>;
  deathPose(): Record<string, number>;
  hasView(species: string, view: View): boolean;
}

const PLANS: Record<BodyPlanId, BodyPlan> = { biped: bipedPlan, quadruped: quadrupedPlan, winged: quadrupedPlan /* placeholder Phase C */ };
export function planById(id: BodyPlanId): BodyPlan { return PLANS[id]; }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const QUAD_RE = /\b(cheval|chevaux|destrier|poney|loup|louve|chien|mâtin|matin|dogue|charognard|sanglier|laie|ours|rat geant|grand rat|felin|panthere|lion|tigre|sanglochon)\b/;
/** Plan corporel d'un nom de créature (cosmétique). 'monolithic' = pas (encore) de plan. */
export function bodyPlanOf(name: string): BodyPlanId | 'monolithic' {
  const n = norm(name);
  if (QUAD_RE.test(n)) return 'quadruped';
  // Délègue au classifieur humanoïde existant : 'rig' → biped, 'creature' → monolithic (tant
  // que les bipèdes monstrueux ne sont pas rapatriés en Phase B).
  // (import dynamique évité : on réutilise la même regex via enemyProfile en Phase B.)
  return bipedOrMono(n);
}
```

> `bipedOrMono` : réutiliser `classifyEnemy` de `enemyProfile.ts` (`'rig'→'biped'`, `'creature'→'monolithic'`). Importer `classifyEnemy` et écrire `const bipedOrMono = (n: string) => classifyEnemy(n) === 'rig' ? 'biped' : 'monolithic';`. **Attention import circulaire** : `bodyPlan` → `enemyProfile` ne doit pas réimporter `bodyPlan`. Garder `classifyEnemy` sans dépendance à `bodyPlan`.

- [ ] **Step 4 : Stub `bipedPlan` et `quadrupedPlan`** pour compiler (détaillés A2/A4). Renvoyer `resolve` minimal.
- [ ] **Step 5 : `npm test -- bodyPlan`** → PASS. **Step 6 : commit** `git add src/gameIso/rig/bodyPlan.ts src/gameIso/rig/bodyPlan.test.ts && git commit -m "feat(rig): registre BodyPlan + bodyPlanOf (fondation gabarits)"`.

---

## Task A2 — Éclater le proto quad en modules + genoux pliés

**Files:** Create `quadruped/{quadSkeleton,quadParts,quadPose}.ts` ; Delete `quadruped/quadruped.ts`

- [ ] **Step 1** : déplacer types/`QUAD_SPECIES`/`buildQuadSkeleton`/`groundQuad` du proto → `quadSkeleton.ts` (export). Inchangé fonctionnellement.
- [ ] **Step 2** : déplacer les drawers (`barrel/rump/neck/head/tail/legParts/hoof/cap`) → `quadParts.ts`, mais signature **multi-vues** : `quadParts(p, view)` renvoie les SVG adaptés à la vue (profile = actuel ; front/back = A3).
- [ ] **Step 3** : déplacer poses → `quadPose.ts`. **Plier les genoux à la démarche** : dans `quadWalkPose`, donner au segment `bas*` un delta négatif quand la patte avance (flexion) :

```ts
export function quadWalkPose(phase: number): QuadPose {
  const swing = (ph: number) => Math.sin(ph * Math.PI * 2) * 16;
  const knee = (ph: number) => -Math.max(0, Math.sin(ph * Math.PI * 2)) * 22; // flexion en phase avancée
  return {
    hautAvD: swing(phase), basAvD: knee(phase), hautArG: swing(phase), basArG: knee(phase),
    hautAvG: swing(phase + 0.5), basAvG: knee(phase + 0.5), hautArD: swing(phase + 0.5), basArD: knee(phase + 0.5),
    tete: swing(phase) * 0.2, encolure: swing(phase) * 0.1,
  };
}
export function quadBitePose(phase: number): QuadPose { // morsure : encolure plonge + gueule
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { encolure: 18 * k, tete: 26 * k, hautAvD: -10 * k, hautAvG: -8 * k };
}
```

- [ ] **Step 4 : test** `quadPose.test.ts` : `quadWalkPose(0.25).basAvD < 0` (genou plié), `quadWalkPose(0)` ≈ neutre. PASS.
- [ ] **Step 5** : supprimer `quadruped.ts`. **Commit** chemins explicites.

---

## Task A3 — Vrai art face/dos quadrupède (8-dir réel)

**Files:** Modify `quadruped/quadParts.ts` (vues front/back) ; Create `scripts/_qc-quad.mts`

Le proto faisait un squish horizontal (tête de profil → faux). Ici, parts DÉDIÉES par vue :
- **front** (vu de face, tête vers nous) : poitrail large, 2 pattes avant visibles écartées, tête frontale (2 yeux, museau court), encolure raccourcie ; pattes arrière cachées derrière le corps.
- **back** (croupe vers nous) : fesses + queue centrale, 2 pattes arrière, pas de tête (ou nuque).

- [ ] **Step 1** : dans `quadSkeleton.ts`, exposer `quadSkeletonForView(p, view)` : en front/back, rapprocher les pattes G/D de l'axe (comme `profileNarrow` mais frontal) et raccourcir l'encolure (`encolure.length *= 0.3`) pour le raccourci.
- [ ] **Step 2** : dans `quadParts.ts`, brancher `head(p,'front')` (tête frontale : 2 yeux + naseaux/truffe + oreilles symétriques) et `head(p,'back')` (nuque/oreilles de dos), `barrel(p,'front')` (poitrail), `rump(p,'back')` (croupe + queue centrale).
- [ ] **Step 3 : QC headless** `scripts/_qc-quad.mts` : pour chaque espèce, 8 directions (front/profil/back × miroir implicite) + colonnes repos/marche/attaque/mort/recolor → `public/qc/quad.png`. `npx tsx scripts/_qc-quad.mts`.
- [ ] **Step 4 : vérif** — lire `public/qc/quad.png` (rendu image), corriger jusqu'à silhouette reconnaissable de FACE et de DOS (pas de tête de profil sur la vue front). Itérer art-only. **Pas de navigateur.**
- [ ] **Step 5 : reconnaissance aveugle** (optionnel mais recommandé, cf. mémoire QC) : agents identifient l'espèce + la direction sans le label ; corriger les ratés. **Commit**.

---

## Task A4 — Espèces quadrupèdes + `quadrupedPlan`

**Files:** Modify `quadruped/quadSkeleton.ts` (espèces), Create `quadruped/composeQuad.ts`

- [ ] **Step 1** : ajouter à `QUAD_SPECIES` : `Chien`/`Mâtin` (≈loup trapu), `Rat géant` (museau pointu, queue nue longue, dos voûté, petit), `Ours` (massif, debout-bas, sans crinière), `Charognard` (chien-loup décharné). Couleurs `stored` par espèce.
- [ ] **Step 2 : `resolveQuad(species, view, pose, colors): ResolvedBone[]`** (remplace le `composeQuad→string`) :

```ts
// src/gameIso/rig/quadruped/composeQuad.ts
import type { ResolvedBone } from '../composeRig';
import { worldTransformsG, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap, type Palette } from '../palette';
import { QUAD_SPECIES, buildQuadSkeleton, groundQuad, quadSkeletonForView, type QuadBoneId } from './quadSkeleton';
import { quadParts } from './quadParts';
import { QUAD_REST, quadWalkPose, quadBitePose, QUAD_DEATH } from './quadPose';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';

export function resolveQuad(species: string, view: View = 'profile', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  const p = QUAD_SPECIES[species] ?? QUAD_SPECIES.Cheval;
  const sk = groundQuad(quadSkeletonForView(buildQuadSkeleton(p), view), pose);
  const world = worldTransformsG(sk, pose) as Record<QuadBoneId, Matrix>;
  const parts = quadParts(p, view);
  const tmap = buildTokenMap(p.stored, colors ?? {});
  return (Object.keys(parts) as QuadBoneId[])
    .filter((id) => parts[id])
    .map((id) => {
      const b = sk[id];
      const sx = id.startsWith('haut') || id.startsWith('bas') ? b.thickness / 9 : 1;
      return { id, matrix: world[id], scale: [sx, 1] as [number, number], z: b.z, parts: [{ svg: applyTokenMap(parts[id]!, tmap), layer: 0 }] };
    })
    .sort((a, b) => a.z - b.z);
}

export const quadrupedPlan: BodyPlan = {
  id: 'quadruped',
  resolve: (sp, view, pose, opts) => resolveQuad(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(QUAD_SPECIES),
  restPose: () => QUAD_REST,
  walkPose: quadWalkPose,
  attackPose: quadBitePose,
  deathPose: () => QUAD_DEATH,
  hasView: () => true,
};
```

- [ ] **Step 3** : adapter `bodyPlan.ts` pour importer le vrai `quadrupedPlan`. `npm test -- bodyPlan quadPose` → PASS.
- [ ] **Step 4** : re-render `public/qc/quad.png` (7 espèces) ; vérif image ; **commit**.

---

## Task A5 — Renderer partagé + `AnimatedBodyToken` + dispatch IsoStage

**Files:** Modify `composeRig.tsx` (exposer renderer), Create `AnimatedBodyToken.tsx`, Create `bipedPlan.ts`, Modify `IsoStage.tsx`

- [ ] **Step 1** : dans `composeRig.tsx`, extraire le rendu de `ResolvedBone[]` → `RigSprite` accepte `bones?: ResolvedBone[]` (sinon calcule via `resolveRig`). Aucune régression : héros sans `bones` → chemin actuel.
- [ ] **Step 2 : `bipedPlan.ts`** enveloppe `resolveRig` (mappe `opts.appearance/equip/career` → `resolveRig(...)`), `walkPose`=clip de marche bipède existant, `deathPose`=`CORPSE_POSE` (déplacé depuis `RigToken`), `attackPose`= clip d'attaque par défaut.
- [ ] **Step 3 : `AnimatedBodyToken`** : props `{ plan: BodyPlan, species, colors?, view, mirror, id, anim?, dead? }`. Calcule `pose` = `dead ? plan.deathPose() : addPhasePose(plan, phase)` ; rend `<RigSprite bones={plan.resolve(species, view, pose, {colors})}/>` dans un `<g transform={mirror?…}>` + bascule mort. S'abonne au bus par `id` (ANIM_ATTACK→attackPose, ANIM_MOVE→walk phase, ANIM_IMPACT→recoil) — réutilise la logique de `AnimatedRigToken`.
- [ ] **Step 4 : IsoStage** — dans la boucle combat ET exploration, remplacer le branchement actuel par :

```ts
const plan = bodyPlanOf(c.name); // ou ent.ref
if (plan === 'quadruped' || plan === 'winged') {
  const f = creatureFacing[c.id] ?? { view: 'front', mirror: false };
  el = tokenNode(c.id, wp.x, wp.y,
    <AnimatedBodyToken plan={planById(plan)} species={quadSpeciesFromName(c.name)} colors={c.appearance?.colors}
       view={f.view} mirror={f.mirror} id={c.id} anim={creatureFx[c.id]} dead={isOutOfAction(c)} />,
    0.6, ring, isOutOfAction(c), wp.walking);
} else if (plan === 'biped' || isHero) { /* chemin AnimatedRigToken actuel */ }
else { /* monolithic : creatureView actuel (legacy) */ }
```

- [ ] **Step 5 : test** `bodyToken.test.ts` (rendu headless smoke via renderToStaticMarkup) : un quad `dead` contient la bascule ; un quad vivant rend des `data-bone`. **Step 6 : commit**.

---

## Task A6 — Reroute : sortir les quadrupèdes du monolithique

**Files:** Modify `src/gameIso/rig/enemyProfile.ts`

- [ ] **Step 1** : retirer de `CREATURE_RE` les tokens couverts par `QUAD_RE` (`loup`, `ours`, `chien`, `charognard`, `sanglier`, `cheval`, + `rat` ambigu : garder `rat`/`skaven` côté creature jusqu'à B, mais router « Rat géant » animal via `QUAD_RE` qui passe AVANT). Vérifier l'ordre : `bodyPlanOf` teste `QUAD_RE` d'abord.
- [ ] **Step 2 : test** `enemyProfile.test.ts` : `classifyEnemy('Loup')` n'est plus forcé creature de façon à casser ; `bodyPlanOf('Loup')==='quadruped'`, `bodyPlanOf('Skaven')==='monolithic'` (jusqu'à B).
- [ ] **Step 3** : `npm test` complet vert (hors test combat-mort préexistant de l'autre session — vérifier qu'il reste le SEUL rouge et qu'il ne m'appartient pas). **Commit**.

---

## Task A7 — Éditeur : ajouter un quadrupède

**Files:** Modify `src/ui/editor/MonsterPartsFields.tsx` (+ scène si besoin : champ plan/species)

- [ ] **Step 1** : ajouter un sélecteur « Type de corps » (Humanoïde / Quadrupède) qui, en Quadrupède, affiche un `<select>` d'espèce (`quadrupedPlan.speciesNames()`) + les `ColorPalettePickers` (avec `corps`/`accent` exposés pour ce type) + un curseur Taille (échelle).
- [ ] **Step 2** : stocker le choix dans `EntityAppearance` (réutiliser `appearance.monster`/`ref` ou ajouter `appearance.bodyPlan?`+`appearance.species?`). L'aperçu WYSIWYG de l'éditeur rend le quad via le même `AnimatedBodyToken`/`bodyPlanOf`.
- [ ] **Step 3 : vérif headless** d'un export de scène (entité Cheval) → rendu attendu. **Step 4 : commit**.

---

## Task A8 — Retrait du legacy couvert

**Files:** Modify `creatureSprites.json`, `creatureViews.json`

- [ ] **Step 1** : lister les entrées monolithiques désormais rendues par le quad (Cheval, Loup, Chien, Sanglier, Ours, Charognard, Rat géant si animal).
- [ ] **Step 2** : les SUPPRIMER (pas vider) des deux JSON. Vérifier qu'aucun fallback ne casse (`bodyPlanOf` route avant `creatureView`).
- [ ] **Step 3** : `node scripts/gen-gallery.mjs` + `npx tsx scripts/_qc-quad.mts` ; vérif images ; `npm test` vert. **Commit**.
- [ ] **Step 4 : clôture** — `npm run typecheck` 0 erreur ; `npm test 2>&1 | grep -E "Tests "` vert ; déployer SEULEMENT si l'utilisateur le demande et si le test combat-mort de l'autre session est résolu/désamorcé.

---

## Self-review (couverture spec)

- A1-A2 = fondation + démarche pliée ; A3 = vrai 8-dir (le vrai coût restant identifié) ; A4 = espèces + plan ;
  A5 = renderer partagé + anim générique + dispatch ; A6 = reroute ; A7 = éditeur (règle « l'éditeur sait faire ») ;
  A8 = legacy rétréci. Couvre A1-A8 de la spec.
- Non-régression héros : `bipedPlan` enveloppe `resolveRig`, `RigSprite` sans `bones` = chemin actuel.
- Phases B (bipèdes monstrueux), C (ailés), D (passe qualité tous modèles + exotiques) = plans dédiés à venir.
