# Apparence des créatures — Gabarits & Races (Sous-projet 1) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal :** rendre l'apparence d'un bipède entièrement exprimable en fichiers de registre (Gabarit + Race), dissoudre les tables centrales `PROPS`/`SPECIES_PALETTES`/`SPECIES_POSE`, faire que les parts de corps s'échelonnent à l'os, et prouver le tout en réparant/enrichissant l'Ogre.

**Architecture :** Créature = Plan × **Gabarit** (carrure, registre) × **Race** (peau/tête/traits/posture, registre) × Perso. Composition À PLAT par id, zéro héritage. Spec : `docs/superpowers/specs/2026-06-08-rig-races-gabarits-design.md`.

**Tech Stack :** TS pur, codegen `scripts/gen-registry.mjs`, rendu `src/gameIso/rig/composeRig.tsx`, tests Vitest, QC headless `@resvg/resvg-js` + workflow d'agents aveugles.

**Garde-fou central :** `composeRig` est partagé par TOUS les bipèdes ET les héros. Toute la migration (Phases A-B) doit être **iso-rendu**, prouvée par un **golden master** capturé en Task 1. Seuls l'Ogre + les races « tells » changent intentionnellement (Phases D-E), golden mis à jour + audit aveugle.

---

## File Structure

- `src/gameIso/rig/golden/biped-golden.test.ts` (Create) — snapshot du SVG résolu de chaque bipède ; barrière anti-régression.
- `src/gameIso/rig/gabarits/types.ts` (Create) — `GabaritDef`.
- `src/gameIso/rig/gabarits/defs/<id>.ts` (Create ×~10) — un gabarit par carrure.
- `src/gameIso/rig/gabarits/_registry.generated.ts` (codegen) + `src/gameIso/rig/gabarits/index.ts` (Create) — `GABARITS` dérivé.
- `src/gameIso/rig/races/types.ts` (Create) — `RaceDef`, `RaceFeature`.
- `src/gameIso/rig/races/defs/<Nom>.ts` (Create ×~20) — une race par espèce.
- `src/gameIso/rig/races/_registry.generated.ts` (codegen) + `src/gameIso/rig/races/index.ts` (Create) — `RACES` + `raceOf(name)`.
- `src/gameIso/rig/skeletons.ts` (Modify) — `baseSkeleton` lit un `GabaritDef` (plus `PROPS`/`baseSpeciesOf`).
- `src/gameIso/rig/composeRig.tsx` (Modify) — supprime `SPECIES_POSE` (→ race) ; applique `scaleOf[bone]` aux race-features ; palette via `RaceDef`.
- `src/gameIso/rig/enemyProfile.ts` (Modify) — `detectSpecies`→`raceOf` ; lit gabarit/race.
- `src/gameIso/rig/creatures/defs/<Nom>.ts` (Modify ×28) — `{ plan, race, gabarit?, perso }`.
- `scripts/gen-registry.mjs` (Modify) — +2 entrées (`GABARIT_DEFS`, `RACE_DEFS`).
- `scripts/_qc-creatures-rig.mts` (Create — déjà sur disque, à committer) — rastériseur QC rig.

---

## Phase A — Harnais + registre Gabarit (iso-rendu)

### Task 1 : Golden master des bipèdes (barrière anti-régression)

**Files:** Create `src/gameIso/rig/golden/biped-golden.test.ts`

- [ ] **Step 1 : Écrire le test golden** (snapshot du SVG résolu, front + profil, pour chaque espèce bipède connue + un héros)

```ts
import { describe, it, expect } from 'vitest';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import { entityRigProfile } from '../enemyProfile';
import type { View } from '../facing';

// Espèces bipèdes couvertes (noms tels que résolus par le registre) + un héros générique.
const NAMES = ['Humain', 'Nain', 'Halfling', 'Haut-Elfe', 'Elfe sylvain', 'Gnome', 'Ogre',
  'Skaven', 'Orc', 'Gobelin', 'Snotling', 'Homme-bête', 'Minotaure', 'Squelette', 'Zombie',
  'Goule', 'Troll', 'Vampire', 'Démon', 'Liche', 'Démonette', 'Fimir', 'Géant',
  'Guerrier du Chaos', 'Cultiste', 'Mutant'];
const VIEWS: View[] = ['front', 'profile'];

describe('golden master — rendu bipède (anti-régression migration gabarit/race)', () => {
  for (const name of NAMES)
    for (const view of VIEWS) {
      it(`${name} / ${view} stable`, () => {
        const prof = entityRigProfile(name, 7);
        const svg = prof ? bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.career, view, prof.overlays)) : '∅';
        expect(svg).toMatchSnapshot();
      });
    }
});
```

- [ ] **Step 2 : Générer le snapshot de référence**

Run: `npx vitest run src/gameIso/rig/golden/biped-golden.test.ts`
Expected: PASS, crée `__snapshots__/biped-golden.test.ts.snap` (état AVANT migration).

- [ ] **Step 3 : Commit**

```bash
git add src/gameIso/rig/golden/biped-golden.test.ts src/gameIso/rig/golden/__snapshots__
git commit -m "test(rig): golden master du rendu bipede (barriere migration gabarit/race)"
```

> Règle des Phases A-B : ce golden **ne doit pas bouger**. S'il bouge, la migration n'est pas iso-rendu → corriger jusqu'à identité. Il sera mis à jour DÉLIBÉRÉMENT en Phase D-E (Ogre + tells).

### Task 2 : Type + registre Gabarit (vide, câblé)

**Files:** Create `src/gameIso/rig/gabarits/types.ts`, `src/gameIso/rig/gabarits/index.ts` ; Modify `scripts/gen-registry.mjs`

- [ ] **Step 1 : Définir `GabaritDef`** (reprend les facteurs de `PROPS`)

```ts
// src/gameIso/rig/gabarits/types.ts
/** Carrure réutilisable : facteurs appliqués au squelette humain de référence (HUMAIN_M).
 *  Reprend EXACTEMENT les champs de l'ex-table PROPS (skeletons.ts). */
export interface GabaritDef {
  id: string;            // 'moyen', 'brute', 'courtaud'…
  sl: number;            // longueur globale
  st: number;            // épaisseur globale
  legs: number;          // facteur longueur de jambe
  arms?: number;         // facteur longueur de bras (défaut 1)
  head?: number;         // facteur taille de tête (défaut 1)
}
```

- [ ] **Step 2 : Ajouter l'entrée codegen** dans `scripts/gen-registry.mjs` (array `REGISTRIES`, après l'entrée `weapons`)

```js
  {
    // Gabarits (carrures réutilisables) : 1 carrure = 1 fichier defs/. Dissout PROPS.
    dir: 'src/gameIso/rig/gabarits/defs',
    out: 'src/gameIso/rig/gabarits/_registry.generated.ts',
    exportName: 'gabarit',
    arrayName: 'GABARIT_DEFS',
    type: 'GabaritDef',
    typeFrom: './types',
  },
```

- [ ] **Step 3 : Écrire l'index dérivé**

```ts
// src/gameIso/rig/gabarits/index.ts
import type { GabaritDef } from './types';
import { GABARIT_DEFS } from './_registry.generated';
export type { GabaritDef } from './types';
export const GABARITS: Record<string, GabaritDef> = Object.fromEntries(GABARIT_DEFS.map((g) => [g.id, g]));
export function gabaritById(id: string): GabaritDef { return GABARITS[id] ?? GABARITS.moyen; }
```

- [ ] **Step 4 : Régénérer (dossier vide → array vide, OK)** + typecheck

Run: `npm run gen && npm run typecheck`
Expected: `GABARIT_DEFS ← 0 fichiers` (dossier absent toléré), tsc 0 (l'index compile, `GABARITS` vide).

- [ ] **Step 5 : Commit**

```bash
git add src/gameIso/rig/gabarits scripts/gen-registry.mjs
git commit -m "feat(rig): registre Gabarit (vide, cable codegen) -- dissout PROPS a venir"
```

### Task 3 : Extraire `PROPS` en fichiers gabarit (1 carrure = 1 fichier)

**Files:** Create `src/gameIso/rig/gabarits/defs/<id>.ts` (×10)

- [ ] **Step 1 : Écrire les 10 fichiers gabarit** — valeurs reprises **verbatim** de `PROPS` (skeletons.ts), regroupées par carrure distincte. Exemples (écrire les 10) :

```ts
// defs/moyen.ts
import type { GabaritDef } from '../types';
export const gabarit: GabaritDef = { id: 'moyen', sl: 1.0, st: 1.0, legs: 1.0 };
// defs/brute.ts  (Ogre 1.35/1.7/0.8 ; Minotaure 1.32/1.7/0.9 ≈ ; on prend la valeur Ogre, override fin par race si besoin)
export const gabarit: GabaritDef = { id: 'brute', sl: 1.35, st: 1.7, legs: 0.82 };
// defs/courtaud.ts (Nain)
export const gabarit: GabaritDef = { id: 'courtaud', sl: 0.74, st: 1.25, legs: 0.62 };
// defs/elance.ts (Elfe/Vampire/Démon)
export const gabarit: GabaritDef = { id: 'elance', sl: 1.06, st: 0.92, legs: 1.1 };
// defs/gremlin.ts (Gobelin)
export const gabarit: GabaritDef = { id: 'gremlin', sl: 0.74, st: 0.92, legs: 0.78, head: 1.3 };
// defs/gremlin-mini.ts (Snotling)
export const gabarit: GabaritDef = { id: 'gremlin-mini', sl: 0.46, st: 1.05, legs: 0.66, head: 1.9 };
// defs/halfling.ts
export const gabarit: GabaritDef = { id: 'halfling', sl: 0.66, st: 1.05, legs: 0.7 };
// defs/gnome.ts
export const gabarit: GabaritDef = { id: 'gnome', sl: 0.5, st: 0.72, legs: 0.66 };
// defs/elance-voute.ts (Skaven)
export const gabarit: GabaritDef = { id: 'elance-voute', sl: 0.96, st: 0.84, legs: 0.92 };
// defs/trapu-massif.ts (Orc / Homme-bête : st élevé, jambes courtes)
export const gabarit: GabaritDef = { id: 'trapu-massif', sl: 1.04, st: 1.42, legs: 0.85 };
// defs/decharne.ts (Squelette)
export const gabarit: GabaritDef = { id: 'decharne', sl: 1.0, st: 0.74, legs: 1.0 };
// defs/trapu-voute.ts (Zombie/Goule)
export const gabarit: GabaritDef = { id: 'trapu-voute', sl: 0.97, st: 1.0, legs: 0.91 };
// defs/brute-bras-longs.ts (Troll : arms 1.6)
export const gabarit: GabaritDef = { id: 'brute-bras-longs', sl: 1.45, st: 1.55, legs: 0.7, arms: 1.6 };
```

> Note : là où deux espèces avaient des valeurs proches mais non identiques (Orc 1.5 vs Homme-bête 1.35 ; Vampire 0.96 vs Démon 0.92), on retient une valeur de carrure commune ; l'écart fin sera rattrapé par un **override de race** (Task 8) — c'est attendu et le golden l'attrapera (voir Task 8).

- [ ] **Step 2 : Régénérer + typecheck**

Run: `npm run gen && npm run typecheck`
Expected: `GABARIT_DEFS ← 13 fichiers`, tsc 0.

- [ ] **Step 3 : Commit**

```bash
git add src/gameIso/rig/gabarits/defs src/gameIso/rig/gabarits/_registry.generated.ts
git commit -m "feat(rig): carrures extraites de PROPS en fichiers gabarit"
```

### Task 4 : `baseSkeleton` lit un `GabaritDef` (au lieu de `PROPS`)

**Files:** Modify `src/gameIso/rig/skeletons.ts`

- [ ] **Step 1 : Remplacer la signature** `baseSkeleton(species, sex)` par `baseSkeleton(gabarit: GabaritDef, sex)` — le corps de la fonction reste identique mais `p` = le `GabaritDef` reçu (plus de `PROPS[baseSpeciesOf(species)]`). Supprimer la const `PROPS`. `referenceSkeleton()` appelle `baseSkeleton(gabaritById('moyen'), 'M')`.

```ts
import { gabaritById, type GabaritDef } from './gabarits';
export function baseSkeleton(p: GabaritDef, sex: 'M' | 'F'): Skeleton {
  let sk = scaleSkeleton(HUMAIN_M, p.sl, p.st);
  if (p.legs !== 1) { /* … inchangé … */ }
  const arms = p.arms ?? 1; if (arms !== 1) { /* … inchangé … */ }
  const head = p.head ?? 1; if (head !== 1) { /* … inchangé … */ }
  if (sex === 'F') sk = feminize(sk);
  return sk;
}
```

- [ ] **Step 2 : Adapter l'appelant `resolveRig`** (composeRig.tsx l.52) : `baseSkeleton(appearance.species, appearance.sex)` → `baseSkeleton(gabaritById(appearance.gabarit ?? 'moyen'), appearance.sex)`. Ajouter le champ `gabarit?: string` à l'`Appearance` (`rig/appearance.ts`). `entityRigProfile`/`enemyRigProfile` (Task 7) le renseigneront ; pour l'instant `?? 'moyen'`.

- [ ] **Step 3 : `baseSpeciesOf` conservé temporairement** (encore utilisé par SPECIES_POSE/palette jusqu'à Task 6) — ne pas supprimer ici.

- [ ] **Step 4 : typecheck + golden**

Run: `npm run typecheck && npx vitest run src/gameIso/rig/golden`
Expected: tsc 0 ; golden **PASS** seulement si `entityRigProfile` fournit le bon gabarit par espèce. → cette task est couplée à Task 7 (mapping espèce→gabarit). **Ordre d'exécution : faire Task 7 AVANT de relancer le golden** (le mapping espèce→gabarit vit dans les RaceDef ou un fallback). Voir Task 7 Step 4.

- [ ] **Step 5 : Commit** (après golden vert via Task 7)

```bash
git add src/gameIso/rig/skeletons.ts src/gameIso/rig/composeRig.tsx src/gameIso/rig/appearance.ts
git commit -m "refactor(rig): baseSkeleton lit un GabaritDef (PROPS dissoute)"
```

---

## Phase B — Registre Race (consolide peau + posture + tête + gabarit défaut)

### Task 5 : Types `RaceDef` / `RaceFeature` + registre (vide, câblé)

**Files:** Create `src/gameIso/rig/races/types.ts`, `src/gameIso/rig/races/index.ts` ; Modify `scripts/gen-registry.mjs`

- [ ] **Step 1 : Définir les types**

```ts
// src/gameIso/rig/races/types.ts
import type { BoneId } from '../bones';
import type { StoredPalette } from '../palette';

/** Trait de corps d'une race, ancré à un os, échelonnable à la taille de l'os. */
export interface RaceFeature {
  bone: BoneId;
  svg: string;                  // tokens @peau/@metal… (palette partagée)
  layer?: number;               // ordre peintre (défaut 50 ; <0 = derrière)
  scale?: 'bone' | 'fixed';     // 'bone' = suit (thickness,length) de l'os (gutplate qui remplit). Défaut 'fixed'.
}

export interface RaceDef {
  id: string;                   // 'Humain', 'Ogre', 'Skaven'…
  match?: string;               // regex nom→race (reprend l'ancien detectSpecies)
  matchPriority?: number;
  gabarit: string;              // id du gabarit par défaut
  gabaritOverride?: Partial<Pick<import('../gabarits/types').GabaritDef, 'sl' | 'st' | 'legs' | 'arms' | 'head'>>;
  palette?: StoredPalette;      // peau/cheveux/yeux (ex-SPECIES_PALETTES)
  head?: string;                // id de part de tête monstrueuse, sinon visage humain cosmétique
  features?: RaceFeature[];     // traits de corps (gut, barbe, queue, cornes…)
  pose?: Record<string, number>;// posture de repos (ex-SPECIES_POSE), front + profil
}
```

- [ ] **Step 2 : Entrée codegen** (`REGISTRIES`, après `gabarits`)

```js
  {
    // Races (peau/tête/traits/posture) : 1 race = 1 fichier defs/. Dissout SPECIES_PALETTES + SPECIES_POSE.
    dir: 'src/gameIso/rig/races/defs',
    out: 'src/gameIso/rig/races/_registry.generated.ts',
    exportName: 'race',
    arrayName: 'RACE_DEFS',
    type: 'RaceDef',
    typeFrom: './types',
  },
```

- [ ] **Step 3 : Index dérivé + matcher**

```ts
// src/gameIso/rig/races/index.ts
import type { RaceDef } from './types';
import { RACE_DEFS } from './_registry.generated';
import { norm } from '../../../lib/normalize';
export type { RaceDef, RaceFeature } from './types';
export const RACES: Record<string, RaceDef> = Object.fromEntries(RACE_DEFS.map((r) => [r.id, r]));
const MATCHERS = RACE_DEFS.filter((r) => r.match)
  .map((r) => ({ id: r.id, re: new RegExp(r.match!), pr: r.matchPriority ?? 100 }))
  .sort((a, b) => a.pr - b.pr);
/** Nom → race (regex+priorité), défaut 'Humain'. Remplace detectSpecies/baseSpeciesOf. */
export function raceOf(name: string): RaceDef {
  const n = norm(name);
  for (const m of MATCHERS) if (m.re.test(n)) return RACES[m.id];
  return RACES.Humain;
}
```

- [ ] **Step 4 : régénérer + typecheck** — Run: `npm run gen && npm run typecheck` ; Expected: `RACE_DEFS ← 0`, tsc 0.
- [ ] **Step 5 : Commit** — `git add src/gameIso/rig/races scripts/gen-registry.mjs && git commit -m "feat(rig): registre Race (vide, cable codegen)"`

### Task 6 : Écrire les fichiers race (consolidation iso-rendu)

**Files:** Create `src/gameIso/rig/races/defs/<Nom>.ts` (×~20) ; Modify `composeRig.tsx`, `enemyProfile.ts`

- [ ] **Step 1 : Écrire chaque RaceDef** en reprenant, pour chaque espèce, **les valeurs actuelles** : `match`/`matchPriority` (copiés des `creatures/defs/<Nom>.ts` bipèdes), `gabarit` (mapping ci-dessous), `palette` (copiée de `SPECIES_PALETTES` `parts/generated/speciesPalettes.ts`), `head` (copié de `biped.monster.tete` du def créature s'il existe), `pose` (copiée de `SPECIES_POSE` composeRig l.28-41), `features` (issues des overlays `monster.cornes/queue/ventre` — **scale:'fixed' pour rester iso-rendu à ce stade**).

Mapping espèce→gabarit (Task 3) :
`Humain→moyen · Nain→courtaud · Halfling→halfling · Haut-Elfe/Elfe sylvain→elance · Gnome→gnome · Ogre→brute · Skaven→elance-voute · Orc→trapu-massif(override st:1.5) · Gobelin→gremlin · Snotling→gremlin-mini · Homme-bête→trapu-massif(override st:1.35) · Minotaure→brute(override legs:0.9) · Squelette→decharne · Zombie→trapu-voute · Goule→trapu-voute(override) · Troll→brute-bras-longs · Vampire→elance(override st:0.96) · Démon→elance · Liche→decharne · Démonette→elance · Fimir→brute · Géant→brute`

Exemple (Skaven, iso-rendu) :
```ts
// src/gameIso/rig/races/defs/Skaven.ts
import type { RaceDef } from '../types';
export const race: RaceDef = {
  id: 'Skaven', match: 'skaven|homme.?rat|\\brat\\b|vermine|guerrier des clans|rat ogre', matchPriority: 18,
  gabarit: 'elance-voute', head: 'rat',
  palette: { /* copier SPECIES_PALETTES['Skaven:M']/['Skaven:F'] */ },
  pose: { torse: 15, cou: 11, tete: -9, epauleG: 4, epauleD: 4 }, // ex-SPECIES_POSE.Skaven
  features: [ /* queue rat : reprise de OV_QUEUE_RAT, bone:'bassin', layer:-2, scale:'fixed' */ ],
};
```

- [ ] **Step 2 : Rebrancher `composeRig.tsx`** : remplacer `SPECIES_POSE[baseSpeciesOf(...)]` par `raceOf(name).pose` (et l'appliquer front ET profil) ; la palette `SPECIES_PALETTES[speciesKey]` → `raceOf(name).palette` ; les overlays `monsterInjection` issus de `monster.cornes/queue/ventre` → `raceOf(name).features` (rendus en `scale:'fixed'` ici). Supprimer `SPECIES_POSE`. **`appearance` porte désormais `race` (id) + `gabarit` (résolu).**

- [ ] **Step 3 : Rebrancher `enemyProfile.ts`** : `detectSpecies(n)` → `raceOf(n).id` ; `appearance.gabarit = creatureDef.gabarit ?? raceOf(n).gabarit` ; appliquer `gabaritOverride`. Conserver la dérivation career/colors existante.

- [ ] **Step 4 : Golden master** — Run: `npm run gen && npm run typecheck && npx vitest run src/gameIso/rig/golden`
Expected: **identique** (iso-rendu). Si un snapshot bouge : un champ (palette/pose/gabarit) n'a pas été copié fidèlement → corriger jusqu'à identité. Mettre à jour le golden UNIQUEMENT si l'écart est compris et trivial (ex. arrondi de carrure dédoublonnée) — sinon c'est une régression.

- [ ] **Step 5 : Commit** — `git add src/gameIso/rig/races src/gameIso/rig/composeRig.tsx src/gameIso/rig/enemyProfile.ts && git commit -m "refactor(rig): SPECIES_PALETTES+SPECIES_POSE dissoutes dans les RaceDef (iso-rendu)"`

### Task 7 : Migrer les defs créature en `{ plan, race, gabarit?, perso }`

**Files:** Modify les 28 `src/gameIso/rig/creatures/defs/<Nom>.ts` (bipèdes) ; Modify `creatures/index.ts`

- [ ] **Step 1 : Pour chaque def bipède**, retirer `biped.monster.tete`/`career` (déplacés dans la Race) et ne garder que `{ name, plan:'biped', match, matchPriority, race:'<Id>', gabarit?, perso? }`. Les sous-espèces ajoutent un override : `Rat ogre` (def séparé si présent en data, sinon via perso de la créature data) = `race:'Skaven', gabarit:'brute'`. **Rétro-compat** : `bipedConfig` (index.ts) lit désormais `raceOf(name)` quand `biped` est absent.
- [ ] **Step 2 : Régénérer + golden** — Run: `npm run gen && npx vitest run src/gameIso/rig/golden` ; Expected: identique (la créature résout vers la même race/gabarit qu'avant).
- [ ] **Step 3 : Suite complète + typecheck** — Run: `npm run typecheck && npm test` ; Expected: vert (héros inclus).
- [ ] **Step 4 : Commit** — `git add src/gameIso/rig/creatures && git commit -m "refactor(rig): defs creature en {plan,race,gabarit,perso}"`

---

## Phase C — Race-features échelonnées à l'os

### Task 8 : `composeRig` applique `scaleOf[bone]` aux features `scale:'bone'`

**Files:** Modify `src/gameIso/rig/composeRig.tsx` ; Test `src/gameIso/rig/races/feature-scale.test.ts`

- [ ] **Step 1 : Écrire le test** (une feature `scale:'bone'` sur l'os `torse` d'un gabarit `brute` rend un SVG plus grand que sur `moyen`)

```ts
import { describe, it, expect } from 'vitest';
import { resolveRig } from '../composeRig';
import type { Appearance } from '../appearance';
const app = (gabarit: string): Appearance => ({ species: 'X', sex: 'M', build: 0.5, seed: 1, gabarit, race: 'X' } as any);
// race X = 1 feature scale:'bone' sur torse (fixture via un RaceDef de test injecté).
describe('race-feature scale:bone', () => {
  it("la feature suit l'échelle de l'os (brute > moyen)", () => {
    const bonesBrute = resolveRig(app('brute'), { weapons: [], armour: [] }, {}, undefined);
    const torseBrute = bonesBrute.find((b) => b.id === 'torse')!;
    const bonesMoyen = resolveRig(app('moyen'), { weapons: [], armour: [] }, {}, undefined);
    const torseMoyen = bonesMoyen.find((b) => b.id === 'torse')!;
    expect(torseBrute.scale[0]).toBeGreaterThan(torseMoyen.scale[0]); // l'os torse est plus épais → feature plus grande
  });
});
```

- [ ] **Step 2 : Run → FAIL** (les features n'existent pas encore comme concept distinct). `npx vitest run src/gameIso/rig/races/feature-scale.test.ts`
- [ ] **Step 3 : Implémenter** : dans `resolveRig`, après l'injection des features de race, pousser chaque `RaceFeature` dans `boneParts[f.bone]` avec son `layer` ; les features `scale:'bone'` héritent du `scaleOf[f.bone]` déjà calculé (rien à faire — `RigSprite` applique `b.scale` au groupe de l'os, donc une part sur cet os est déjà échelonnée). Pour `scale:'fixed'`, neutraliser : envelopper le svg dans un groupe `scale(1/sx,1/sy)` inverse. (Documenter : 'bone' = défaut naturel du rig ; 'fixed' = contre-échelle.)
- [ ] **Step 4 : Run → PASS** + golden (features de race passées en 'fixed' en Task 6 → golden inchangé). `npx vitest run src/gameIso/rig/races src/gameIso/rig/golden`
- [ ] **Step 5 : Commit** — `git add src/gameIso/rig/composeRig.tsx src/gameIso/rig/races && git commit -m "feat(rig): race-features echelonnees a l'os (scale:bone|fixed)"`

---

## Phase D — Pilote Ogre (changement intentionnel + QC)

### Task 9 : Committer le rastériseur QC rig

**Files:** `scripts/_qc-creatures-rig.mts` (déjà sur disque)

- [ ] **Step 1 : typecheck du script** — Run: `npm run typecheck` (le script est inclus). Expected: 0.
- [ ] **Step 2 : Commit** — `git add scripts/_qc-creatures-rig.mts && git commit -m "test(qc): rasteriseur rig->PNG des creatures (remplace l'ex-monolithique)"`

### Task 10 : Race Ogre enrichie (gut+gutplate échelonné, heaume, pauldrons)

**Files:** Modify `src/gameIso/rig/races/defs/Ogre.ts` ; (art via parts/monster si besoin)

- [ ] **Step 1 : Définir les features Ogre** : `gut` (os `torse`, `scale:'bone'`, grosse panse + plaque centrale @metal — repris/agrandi de `OV_VENTRE`), `gutplate` centré, `heaume cornu` (os `tete`, layer derrière), `pauldrons` (os `epauleG`/`epauleD`). L'art SVG est **généré via le workflow best-of-N + juge aveugle** (méthode `docs/qc-reconnaissabilite-sprites.md`), pas écrit à la main ici — chaque feature validée à l'aveugle ≥3 avant intégration. Race Ogre : `{ gabarit:'brute', head:'ogre', palette: peau ogre, pose: voûté léger, features:[gut(scale:bone), gutplate(scale:bone), heaume, pauldronG, pauldronD] }`. Créature `Ogre` def = `{ plan:'biped', race:'Ogre' }`.
- [ ] **Step 2 : Rendre + QC aveugle** — Run: `npx tsx scripts/_qc-creatures-rig.mts` puis workflow d'agents aveugles sur `public/qc/creatures-rig/<id Ogre>.png`. Critère : lu « ogre » avec confiance ≥ 3, le gutplate **remplit** le ventre (plus de disque flottant), bras = pauldrons (plus de dalle).
- [ ] **Step 3 : Mettre à jour le golden** (changement INTENTIONNEL de l'Ogre) — `npx vitest run src/gameIso/rig/golden -u` ; vérifier au diff que **seuls** les snapshots Ogre changent.
- [ ] **Step 4 : Suite + typecheck** — `npm run typecheck && npm test` vert.
- [ ] **Step 5 : Commit** — `git add src/gameIso/rig/races/defs/Ogre.ts src/gameIso/rig/golden src/gameIso/rig/parts && git commit -m "feat(rig): race Ogre enrichie (gutplate echelonne+heaume+pauldrons) -- fix du disque flottant"`

---

## Phase E — Rollout des races « tells » (Nain, Elfe, Chaos, Mutant)

### Task 11 : Tells par race (même méthode QC que l'Ogre)

**Files:** Modify `races/defs/Nain.ts`, `Haut-Elfe.ts`/`Elfe-sylvain.ts`, (Create `races/defs/GuerrierDuChaos.ts`), `enemyProfile.ts` (Mutant)

- [ ] **Step 1 : Nain** — feature `barbe` (os `tete`/`cou`, **ancrée à la mâchoire, pend SOUS le menton** — explicitement PAS depuis les yeux, cf. note utilisateur), + heaume nain optionnel. Art via workflow best-of-N + juge. Critère aveugle : lu « nain ».
- [ ] **Step 2 : Elfe** — feature oreilles pointues (os `tete`) + visage fin (la carrure `elance` est déjà là). Critère : « elfe » distinct d'« humain ».
- [ ] **Step 3 : Guerrier du Chaos** — race dédiée : `gabarit:'trapu-massif'`, heaume cornu sombre + armure de plaques sombre (PAS la tenue Soldat rayée par défaut). Critère : « guerrier du Chaos », pas « soldat humain ».
- [ ] **Step 4 : Mutant** — garantir des features de mutation **visibles** par défaut (cornes/œil/tentacule) au lieu de l'aléa actuel quasi-invisible. Critère : « mutant », pas « humain en haillons ».
- [ ] **Step 5 : QC aveugle global** — `npx tsx scripts/_qc-creatures-rig.mts` + workflow par lots de 5 (anti rate-limit, cf. session 2026-06-08). Mettre à jour le golden (changements intentionnels de ces races SEULEMENT). Commit par race (`git commit -m "feat(rig): tell de race <X>"`).

---

## Self-review (couverture spec)

- §2 (problème) → Tasks 4/6/8 (proportions, palette/pose, scaling). ✓
- §3 (registres gabarit/race) → Tasks 2-3 (gabarit), 5-6 (race). ✓
- §4 (scale-to-bone) → Task 8. ✓
- §5 (flux) → Tasks 4+6+7 (appearance porte gabarit+race). ✓
- §6 (pilote Ogre) → Task 10. ✓
- §7 (périmètre : migrer TOUS les bipèdes) → Tasks 3+6+7 (les 28 defs + ~20 races + 13 gabarits). ✓
- §8 (tests/golden) → Task 1 (golden), Task 8 (feature-scale), golden re-vérifié à chaque task de migration. ✓
- §11 (existant→axes) → la migration déplace colors→perso, monster.tete→race.head, overlays→race.features, PROPS→gabarit. ✓
- §12 (à plat) → tout par id (`race`/`gabarit` = strings ; `raceOf`/`gabaritById`), zéro héritage. ✓
- Quads/sous-espèces (hors périmètre) → non traités ici (SP2/SP3). ✓
