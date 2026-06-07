# Table « Difficultés de Combat » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter fidèlement la table Difficultés de Combat du Livre de base (Ligne de Vue, Couvert, Combiner, obscurité/météo, tir dans la mêlée) + la fondation Taille (T0) et le size-to-hit (T1), en moteur pur testé, isolé de la session rig.

**Architecture :** Règles pures dans `src/engine` (`size.ts`, `combineMods`) ; géométrie/couvert lisant la Scène dans `src/state/lineOfSight.ts` (l'engine ne dépend jamais de `state`) ; les modificateurs dérivés de la scène (couvert/obscurité/météo/tir-mêlée) sont calculés côté `state` et **injectés** dans `attackModifiers` via `env: ModLine[]` ; les mods de Taille (types engine) sont calculés dans l'engine. Câblage dans `combatFlow`/`ai`/UI ; exposition éditeur (météo, empreinte) par hunks sélectifs sur les fichiers partagés.

**Tech Stack :** TypeScript, Vitest (TDD), Zustand (store), RNG seedable (`battleRng`). Source de vérité : `Source/Warhammer v4 - Livre de base version corrigée/`. Spec : `docs/superpowers/specs/2026-06-07-difficultes-combat-table-design.md`.

---

## File Structure

| Fichier | Création/Modif | Responsabilité |
|---|---|---|
| `src/engine/size.ts` | **NEW** | `SizeCategory`, `SIZE_ORDER`, `SIZE_RANGED_MOD`, `SIZE_LABEL`, `effectiveSize`, `sizeGap`, `parseSizeLabel`. Pur. |
| `src/engine/size.test.ts` | **NEW** | Tests parser (catégories + 5 plages → borne haute), mods, écart. |
| `src/state/lineOfSight.ts` | **NEW** | `tilesBetween`, `CoverClass`, `coverModifier`, classification décor/terrain/créature, `lineOfSightCover(scene, from, to)`. Lit la Scène. |
| `src/state/lineOfSight.test.ts` | **NEW** | Tests géométrie + couvert + LdV bloquée. |
| `src/engine/combat.ts` | MODIFY | `combineMods` ; `ModLine.uncapped?` ; `attackModifiers` (opts `env`, size-to-hit, +10 plus petit) ; `defenseModifiers` (météo neige) ; gate LdV via callers. |
| `src/engine/combat.test.ts` *(ou combat-breakdown.test.ts)* | MODIFY | `combineMods` (plafonds), mods cover/size injectés. |
| `src/engine/types.ts` | MODIFY | `Combatant.size?: SizeCategory`. |
| `src/state/scene.ts` | MODIFY ⚠️ partagé | `CustomStatblock.size?` ; `Scene.weather?` ; `SceneEntity.foot?: {w,h}`. |
| `src/state/sceneRules.ts` | **NEW** | `sceneCombatModifiers(scene)` (obscurité/météo) ; `entityBlockedAt(scene,x,y)` (empreinte décor). |
| `src/state/spawn.ts` | MODIFY | `sizeFromTraits(traits)` ; dérivation `size` dans `statblockToCombatant`/spawn créature. |
| `src/state/combatFlow.ts` | MODIFY | `resolveAttack` : gate LdV + `env` (cover/obscurité/météo/mouvement/tir-mêlée) ; redirection tir-mêlée. |
| `src/state/path.ts` | (lecture) | `chebyshev`, `Pt` réutilisés. `isWalkable` étendu via `entityBlockedAt`. |
| `src/state/ai.ts` | MODIFY | l'IA filtre ses cibles de tir par LdV. |
| `src/ui/RollModal.tsx` + ciblage | MODIFY | lignes cover/taille/obscurité/météo ; cibles hors-LdV refusées. |
| `src/ui/editor/*` | MODIFY ⚠️ partagé | `<select>` météo ; champs empreinte `w/h` (sous-composant dédié). |

**Note dépendances** : `state` peut importer `engine` (jamais l'inverse). `lineOfSight.ts`/`sceneRules.ts` sont en `state` car ils lisent `Scene`. `combatFlow` construit les `ModLine[]` dérivés de la scène et les passe à l'engine.

---

# PHASE 1 — Noyau pur (engine + géométrie), isolé, sans store

## Task 1 : `engine/size.ts` — modèle de Taille (T0 fondation)

**Files:**
- Create: `src/engine/size.ts`
- Test: `src/engine/size.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
// src/engine/size.test.ts
import { describe, it, expect } from 'vitest';
import { SIZE_ORDER, SIZE_RANGED_MOD, effectiveSize, sizeGap, parseSizeLabel } from './size';

describe('size — modèle de Taille (LDB 85 l.279-280 ; 14 l.151-170)', () => {
  it('ordonne les 7 catégories 0..6', () => {
    expect(SIZE_ORDER.minuscule).toBe(0);
    expect(SIZE_ORDER.moyenne).toBe(3);
    expect(SIZE_ORDER.monstrueuse).toBe(6);
  });
  it('mod d’à-toucher au tir : -30 (Minuscule) .. +60 (Monstrueuse)', () => {
    expect(SIZE_RANGED_MOD.minuscule).toBe(-30);
    expect(SIZE_RANGED_MOD.moyenne).toBe(0);
    expect(SIZE_RANGED_MOD.grande).toBe(20);
    expect(SIZE_RANGED_MOD.monstrueuse).toBe(60);
  });
  it('Taille effective par défaut = Moyenne (standard implicite, LDB 14 l.163)', () => {
    expect(effectiveSize(undefined)).toBe('moyenne');
    expect(effectiveSize('grande')).toBe('grande');
  });
  it('sizeGap > 0 si l’attaquant est plus grand', () => {
    expect(sizeGap('grande', 'moyenne')).toBe(1);
    expect(sizeGap('moyenne', 'enorme')).toBe(-2);
    expect(sizeGap(undefined, undefined)).toBe(0);
  });
  it('parseSizeLabel — catégories simples (accents/casse insensibles)', () => {
    expect(parseSizeLabel('Énorme')).toBe('enorme');
    expect(parseSizeLabel('tres petite')).toBe('tresPetite');
    expect(parseSizeLabel('Très Petite')).toBe('tresPetite');
    expect(parseSizeLabel('inconnu')).toBeNull();
  });
  it('parseSizeLabel — plages narratives → borne HAUTE (design documenté)', () => {
    expect(parseSizeLabel('de Petite à Énorme')).toBe('enorme');
    expect(parseSizeLabel('Minuscule-Énorme')).toBe('enorme');
    expect(parseSizeLabel('de Petite à Moyenne')).toBe('moyenne');
    expect(parseSizeLabel('Énorme-Monstrueuse')).toBe('monstrueuse');
  });
});
```

- [ ] **Step 2 : Lancer → échec** — `npm test -- size.test` → FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

```ts
// src/engine/size.ts
/**
 * Trait de créature **Taille** (LDB `85 - Traits de créature.md` l.279-280 : 7 catégories,
 * Minuscule → Monstrueuse). Modélisé en INDEX ordinal (0..6) car la mécanique est une
 * COMPARAISON d'écart entre combattants, pas une valeur testée. Mod d'à-toucher au TIR selon
 * la Taille de la CIBLE : `14 - _GoBack.md` l.151-170. « Moyenne » = standard implicite des
 * espèces jouables (l.163), sans Trait. Cf. analyse : docs/superpowers/specs/2026-06-07-taille-analyse-reference.md
 */
export type SizeCategory =
  | 'minuscule' | 'tresPetite' | 'petite' | 'moyenne' | 'grande' | 'enorme' | 'monstrueuse';

export const SIZE_ORDER: Record<SizeCategory, number> = {
  minuscule: 0, tresPetite: 1, petite: 2, moyenne: 3, grande: 4, enorme: 5, monstrueuse: 6,
};

export const SIZE_RANGED_MOD: Record<SizeCategory, number> = {
  minuscule: -30, tresPetite: -20, petite: -10, moyenne: 0, grande: 20, enorme: 40, monstrueuse: 60,
};

export const SIZE_LABEL: Record<SizeCategory, string> = {
  minuscule: 'Minuscule', tresPetite: 'Très Petite', petite: 'Petite', moyenne: 'Moyenne',
  grande: 'Grande', enorme: 'Énorme', monstrueuse: 'Monstrueuse',
};

/** Taille effective (défaut Moyenne : standard implicite, LDB 14 l.163). */
export const effectiveSize = (size?: SizeCategory): SizeCategory => size ?? 'moyenne';

/** Écart attaquant − défenseur (> 0 si l'attaquant est plus grand). */
export const sizeGap = (a?: SizeCategory, b?: SizeCategory): number =>
  SIZE_ORDER[effectiveSize(a)] - SIZE_ORDER[effectiveSize(b)];

const SIZE_BY_NORM: Record<string, SizeCategory> = {
  minuscule: 'minuscule', trespetite: 'tresPetite', petite: 'petite', moyenne: 'moyenne',
  grande: 'grande', enorme: 'enorme', monstrueuse: 'monstrueuse',
};
const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Catégorie depuis un libellé libre (« Énorme », « de Petite à Énorme »…). Plage → borne HAUTE
 *  (choix de design documenté : le RAW ne tranche pas). Null si aucune catégorie reconnue. */
export function parseSizeLabel(raw: string): SizeCategory | null {
  const tokens = stripAccents(raw.toLowerCase()).match(/minuscule|tres\s*petite|petite|moyenne|grande|enorme|monstrueuse/g);
  if (!tokens) return null;
  let best: SizeCategory | null = null;
  for (const tok of tokens) {
    const cat = SIZE_BY_NORM[tok.replace(/\s+/g, '')];
    if (cat && (best === null || SIZE_ORDER[cat] > SIZE_ORDER[best])) best = cat;
  }
  return best;
}
```

- [ ] **Step 4 : Lancer → vert** — `npm test -- size.test`. Puis `npm run typecheck`.

- [ ] **Step 5 : Commit** — `git add src/engine/size.ts src/engine/size.test.ts && git commit -m "feat(taille): modele de Taille pur (T0) -- 7 categories, SIZE_RANGED_MOD, parseSizeLabel (LDB 85/14)"`

---

## Task 2 : `Combatant.size` (type)

**Files:** Modify `src/engine/types.ts:144-235`

- [ ] **Step 1 : Ajouter le champ** (après `species?: string;` l.148, importer le type en tête)

En tête de fichier (après les imports existants, il n'y en a pas — ajouter) :
```ts
import type { SizeCategory } from './size';
```
Dans `interface Combatant`, après `career?: string;` :
```ts
  /** Catégorie de Taille (LDB 85). Optionnel ; défaut Moyenne au point de lecture (effectiveSize). */
  size?: SizeCategory;
```

- [ ] **Step 2 : typecheck** — `npm run typecheck` → PASS (champ optionnel, rien ne casse).

- [ ] **Step 3 : Commit** — `git add src/engine/types.ts && git commit -m "feat(taille): champ Combatant.size optionnel (T0)"`

---

## Task 3 : `combineMods` — Combiner les Difficultés (LDB 14 l.126-131)

**Files:** Modify `src/engine/combat.ts` (ajouter après `sumMods`, l.115) ; tests dans `src/engine/combat-breakdown.test.ts`.

- [ ] **Step 1 : Test qui échoue**

```ts
// dans src/engine/combat-breakdown.test.ts (ou nouveau combat-combine.test.ts)
import { combineMods } from './combat';
describe('combineMods — Combiner les Difficultés (LDB 14 l.126-131)', () => {
  it('plafonne la somme des malus à -30', () => {
    expect(combineMods([{label:'a',value:-20},{label:'b',value:-20}])).toBe(-30);
  });
  it('plafonne la somme des bonus à +60', () => {
    expect(combineMods([{label:'a',value:40},{label:'b',value:40}])).toBe(60);
  });
  it('mélange bonus + malus se somme (plafonds séparés)', () => {
    // +40 (cap +60 ok) puis -20 → +20
    expect(combineMods([{label:'a',value:40},{label:'b',value:-20}])).toBe(20);
  });
  it('Avantage est hors plafond (uncapped)', () => {
    // Avantage +70 hors cap, + malus -40 plafonné -30 → +40
    expect(combineMods([{label:'Avantage',value:70,uncapped:true},{label:'x',value:-20},{label:'y',value:-20}])).toBe(40);
  });
});
```

- [ ] **Step 2 : Lancer → échec** (`combineMods` non exporté).

- [ ] **Step 3 : Implémenter** (dans `combat.ts`, étendre `ModLine` + ajouter `combineMods`)

`ModLine` (l.62) gagne :
```ts
export interface ModLine {
  label: string;
  value: number;
  /** Hors du plafond Combiner les Difficultés (ex. Avantage — pas une entrée de la table). */
  uncapped?: boolean;
}
```
Nouvelle fonction (après `sumMods`) :
```ts
/**
 * Combiner les Difficultés (LDB `14 - _GoBack.md` l.126-131) : la somme des MALUS est plafonnée
 * à −30 (Très Difficile) et la somme des BONUS à +60 (Très Facile) ; un mélange se somme. Les
 * lignes `uncapped` (Avantage — hors table de Difficulté) s'ajoutent sans plafond.
 */
export function combineMods(mods: ModLine[]): number {
  let pos = 0, neg = 0, free = 0;
  for (const m of mods) {
    if (m.uncapped) free += m.value;
    else if (m.value >= 0) pos += m.value;
    else neg += m.value;
  }
  return free + Math.min(60, pos) + Math.max(-30, neg);
}
```

- [ ] **Step 4 : Basculer les sommes de combat sur `combineMods`** — remplacer `sumMods(...)` par `combineMods(...)` dans `rollMeleeAttacker` (l.211) et `resolveRanged` (l.365). Marquer la ligne Avantage `uncapped` dans `attackModifiers` (l.131) : `out.push({ label: 'Avantage', value: adv, uncapped: true });`. **Garder `sumMods`** pour tout usage hors-attaque éventuel (sinon le supprimer s'il devient orphelin).

- [ ] **Step 5 : Lancer toute la suite** — `npm test`. Mettre à jour les attentes impactées (les jets où la somme dépassait ±30/±60 changent — vérifier chaque échec, c'est une correction de fidélité). `npm run typecheck`.

- [ ] **Step 6 : Commit** — `git add src/engine/combat.ts src/engine/*combine*.test.ts && git commit -m "feat(combat): combineMods -- Combiner les Difficultes (-30/+60, Avantage hors plafond), LDB 14 l.126-131"`

---

## Task 4 : `state/lineOfSight.ts` — géométrie + Couvert + LdV

**Files:** Create `src/state/lineOfSight.ts` + `src/state/lineOfSight.test.ts`.

- [ ] **Step 1 : Tests qui échouent** (Scene minimale construite à la main)

```ts
// src/state/lineOfSight.test.ts
import { describe, it, expect } from 'vitest';
import { tilesBetween, coverModifier, lineOfSightCover } from './lineOfSight';
import { Scene } from './scene';

function scene(w: number, h: number, tiles?: Record<string, string>): Scene {
  const grid = new Array(w * h).fill('herbe');
  if (tiles) for (const [k, v] of Object.entries(tiles)) { const [x, y] = k.split(',').map(Number); grid[y * w + x] = v; }
  return { id: 's', name: 's', dimensions: { w, h }, ambiance: 'jour', tiles: grid, entities: [], buildings: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene;
}

describe('tilesBetween — cases strictement entre deux points', () => {
  it('horizontal', () => { expect(tilesBetween({x:0,y:0},{x:3,y:0})).toEqual([{x:1,y:0},{x:2,y:0}]); });
  it('diagonal', () => { expect(tilesBetween({x:0,y:0},{x:2,y:2})).toEqual([{x:1,y:1}]); });
  it('adjacent → aucune case intermédiaire', () => { expect(tilesBetween({x:0,y:0},{x:1,y:0})).toEqual([]); });
});

describe('coverModifier — valeurs canon (LDB 14 l.103/114/120)', () => {
  it('imparfaite -10, moyenne -20, totale -30, none 0', () => {
    expect(coverModifier('none')).toBe(0);
    expect(coverModifier('imparfaite')).toBe(-10);
    expect(coverModifier('moyenne')).toBe(-20);
    expect(coverModifier('totale')).toBe(-30);
  });
});

describe('lineOfSightCover', () => {
  it('ligne dégagée → aucun couvert, non bloquée', () => {
    expect(lineOfSightCover(scene(5,1), {x:0,y:0}, {x:4,y:0}, [])).toEqual({ blocked: false, cover: 'none' });
  });
  it('sous-bois (bois) sur la ligne → imparfaite', () => {
    const s = scene(5,1,{ '2,0':'bois' });
    expect(lineOfSightCover(s, {x:0,y:0}, {x:4,y:0}, [])).toEqual({ blocked: false, cover: 'imparfaite' });
  });
  it('mur à distance de la cible → pas de Ligne de Vue (bloqué)', () => {
    const s = scene(6,1,{ '2,0':'mur' });
    expect(lineOfSightCover(s, {x:0,y:0}, {x:5,y:0}, []).blocked).toBe(true);
  });
  it('mur ADJACENT à la cible → couverture totale -30, non bloqué', () => {
    const s = scene(5,1,{ '3,0':'mur' });
    const r = lineOfSightCover(s, {x:0,y:0}, {x:4,y:0}, []);
    expect(r).toEqual({ blocked: false, cover: 'totale' });
  });
  it('créature intercalée → couvert imparfait (extrapolation 14 l.75)', () => {
    const occ = [{ x: 2, y: 0 }];
    expect(lineOfSightCover(scene(5,1), {x:0,y:0}, {x:4,y:0}, occ)).toEqual({ blocked: false, cover: 'imparfaite' });
  });
});
```

- [ ] **Step 2 : Lancer → échec.**

- [ ] **Step 3 : Implémenter**

```ts
// src/state/lineOfSight.ts
/**
 * Ligne de Vue & Couvert (LDB `13 - Combat.md` l.123 ; `14 - _GoBack.md` l.103/114/120, l.75).
 * Lit la Scène (terrain, bâtiments, décors, occupants) — vit en `state` (l'engine ne dépend pas
 * de Scene). Le `coverModifier` numérique est injecté dans `attackModifiers` via `env: ModLine[]`.
 */
import { Scene, SceneEntity, tileAt } from './scene';
import { buildingBlockedAt } from './buildings';
import { Pt } from './path';

export type CoverClass = 'none' | 'imparfaite' | 'moyenne' | 'totale';
const COVER_MOD: Record<CoverClass, number> = { none: 0, imparfaite: -10, moyenne: -20, totale: -30 };
export const coverModifier = (c: CoverClass): number => COVER_MOD[c];
const worst = (a: CoverClass, b: CoverClass): CoverClass => (COVER_MOD[b] < COVER_MOD[a] ? b : a);

/** Terrains bloquant la vue (mur de pierre / porte fermée). `bois` ne bloque pas (couvert léger). */
const SIGHT_BLOCK_TERRAIN = new Set(['mur', 'porte']);
/** Classe de couvert d'un terrain partiel. */
const TERRAIN_COVER: Record<string, CoverClass> = { bois: 'imparfaite' };
/** Classe de couvert d'un décor (par id de catalogue, exemplaires canon `14` l.103/114/120 + l.75). */
const DECOR_COVER: Record<string, CoverClass> = {
  statue: 'totale',
  cloture: 'moyenne', charrette: 'moyenne', tonneau: 'moyenne', caisse: 'moyenne',
  'etal-marche': 'moyenne', 'epave-carrosse': 'moyenne', puits: 'moyenne', fontaine: 'moyenne',
  arbre: 'imparfaite', 'tas-foin': 'imparfaite', 'cheval-mort': 'imparfaite',
};
/** Décors bloquant la vue (couverture totale = opaque). */
const SIGHT_BLOCK_DECOR = new Set(['statue']);

/** Cases STRICTEMENT entre `a` et `b` (supercover simple sur grille carrée). */
export function tilesBetween(a: Pt, b: Pt): Pt[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const out: Pt[] = [];
  for (let i = 1; i < steps; i++) {
    out.push({ x: Math.round(a.x + (dx * i) / steps), y: Math.round(a.y + (dy * i) / steps) });
  }
  return out;
}

const adjacent = (p: Pt, q: Pt): boolean => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= 1;

/** Empreinte d'un décor : ses cases (1×1 par défaut, ou `foot {w,h}` ancré en pos). */
function entityTiles(e: SceneEntity): Pt[] {
  const w = e.foot?.w ?? 1, h = e.foot?.h ?? 1;
  const out: Pt[] = [];
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) out.push({ x: e.pos.x + xx, y: e.pos.y + yy });
  return out;
}

/**
 * Couvert + Ligne de Vue du tireur `from` vers la cible `to`. `occupants` = cases occupées par
 * d'autres combattants (couvert imparfait, extrapolation `14` l.75). `blocked:true` = pas de tir
 * (cible entièrement masquée, `13` l.123) ; un bloqueur ADJACENT à la cible = couverture totale −30.
 */
export function lineOfSightCover(scene: Scene, from: Pt, to: Pt, occupants: Pt[]): { blocked: boolean; cover: CoverClass } {
  let cover: CoverClass = 'none';
  const mid = tilesBetween(from, to);
  for (const t of mid) {
    const terr = tileAt(scene, t.x, t.y);
    const blocksTerr = SIGHT_BLOCK_TERRAIN.has(terr) || buildingBlockedAt(scene, t.x, t.y);
    const decor = scene.entities.find((e) => (e.kind === 'prop' || e.kind === 'objet') && entityTiles(e).some((p) => p.x === t.x && p.y === t.y));
    const blocksDecor = !!decor && SIGHT_BLOCK_DECOR.has(decor.ref ?? '');
    if (blocksTerr || blocksDecor) {
      if (adjacent(t, to)) { cover = worst(cover, 'totale'); continue; } // cible collée au couvert → −30
      return { blocked: true, cover: 'totale' }; // bloqueur à distance → pas de Ligne de Vue
    }
    if (TERRAIN_COVER[terr]) cover = worst(cover, TERRAIN_COVER[terr]);
    if (decor && DECOR_COVER[decor.ref ?? '']) cover = worst(cover, DECOR_COVER[decor.ref ?? '']);
    if (occupants.some((o) => o.x === t.x && o.y === t.y)) cover = worst(cover, 'imparfaite');
  }
  return { blocked: false, cover };
}
```

- [ ] **Step 4 : Lancer → vert** — `npm test -- lineOfSight.test`. `npm run typecheck`.

- [ ] **Step 5 : Commit** — `git add src/state/lineOfSight.ts src/state/lineOfSight.test.ts && git commit -m "feat(combat): Ligne de Vue + Couvert (tilesBetween/lineOfSightCover) -- LDB 13 l.123, 14 l.103-120/75"`

---

# PHASE 2 — Câblage combat (modificateurs, gate, tir-mêlée, météo)

## Task 5 : `attackModifiers` — env injecté + size-to-hit (T1)

**Files:** Modify `src/engine/combat.ts:123-149` + tests `combat-breakdown.test.ts`.

- [ ] **Step 1 : Tests qui échouent** — couvre : (a) `env` ajouté tel quel ; (b) tir → `SIZE_RANGED_MOD[target.size]` ; (c) `sizeGap<0` → +10 « plus petit ».

```ts
import { attackModifiers } from './combat';
// fabrique un Combatant minimal de test (helper local ou réutiliser l'existant du fichier)
it('tir : mod de Taille de la cible (Grande → +20)', () => {
  const mods = attackModifiers(atk, { ...def, size: 'grande' }, bow, { kind: 'ranged', distanceTiles: 3, env: [] });
  expect(mods.find(m => m.label.startsWith('Taille (cible)'))?.value).toBe(20);
});
it('tir : env injecté (Couvert -20) figure dans les mods', () => {
  const mods = attackModifiers(atk, def, bow, { kind: 'ranged', distanceTiles: 3, env: [{label:'Couvert (moyenne)', value:-20}] });
  expect(mods.find(m => m.label.startsWith('Couvert'))?.value).toBe(-20);
});
it('+10 au plus petit (attaquant Petite vs cible Moyenne)', () => {
  const mods = attackModifiers({ ...atk, size: 'petite' }, { ...def, size: 'moyenne' }, sword, { kind: 'melee', env: [] });
  expect(mods.find(m => m.label.startsWith('Taille (plus petit)'))?.value).toBe(10);
});
```

> ⚠️ **À vérifier verbatim AVANT d'implémenter le « +10 au plus petit »** : lire `Source/.../85 - Traits de créature.md` l.300-306. Confirmer (a) qu'il s'applique au plus PETIT, (b) mêlée seule ou mêlée+tir, (c) stacking avec `SIZE_RANGED_MOD`. Ajuster le test et le code en conséquence. Si ambigu → mêlée seulement, et le noter.

- [ ] **Step 2 : Lancer → échec.**

- [ ] **Step 3 : Implémenter** — étendre la signature `opts` et le corps :

```ts
import { SizeCategory, SIZE_RANGED_MOD, SIZE_LABEL, sizeGap, effectiveSize } from './size';
// ...
export function attackModifiers(
  attacker: Combatant,
  target: Combatant | null,
  weapon: Weapon,
  opts: { kind: 'melee' | 'ranged'; location?: HitLocation | null; distanceTiles?: number; env?: ModLine[] },
): ModLine[] {
  const out: ModLine[] = [];
  const adv = attacker.advantage * 10;
  if (adv) out.push({ label: 'Avantage', value: adv, uncapped: true });
  const pen = combatTestPenalty(attacker);
  if (pen) out.push({ label: 'État', value: pen });
  if (attacker.nextActionPenalty) out.push({ label: 'Maladresse (Round précédent)', value: -attacker.nextActionPenalty });
  if (opts.kind === 'ranged') {
    if (opts.distanceTiles != null && weapon.range) {
      const m = rangeBandModifier(opts.distanceTiles, weapon.range);
      const name = rangeBandName(opts.distanceTiles, weapon.range);
      if (m != null && m !== 0 && name) out.push({ label: name, value: m });
    }
    if (attacker.aiming) out.push({ label: 'Viser', value: 20 });
    if (target) {
      const sm = SIZE_RANGED_MOD[effectiveSize(target.size)];
      if (sm !== 0) out.push({ label: `Taille (cible) — ${SIZE_LABEL[effectiveSize(target.size)]}`, value: sm });
    }
  } else if (target) {
    const vuln = meleeAttackerBonus(target);
    if (vuln) out.push({ label: 'Cible vulnérable', value: vuln });
  }
  // +10 au plus petit (LDB 85 l.301-303 — scope confirmé verbatim en Step 1)
  if (target && sizeGap(attacker.size, target.size) < 0) out.push({ label: 'Taille (plus petit)', value: 10 });
  if (hasQ(weapon, 'Précise')) out.push({ label: 'Précise', value: 10 });
  if (opts.location) out.push({ label: 'Localisation visée', value: -10 });
  if (opts.env) out.push(...opts.env); // cover / obscurité / météo / mouvement / tir-mêlée (calculés côté state)
  return out;
}
```

- [ ] **Step 4 : Propager `env` dans les résolveurs** — `rollMeleeAttacker`, `resolveMelee`/`finishMelee`/`resolveMeleePassive`, `resolveRanged` acceptent et transmettent `env?: ModLine[]` (via leur `opts`/un paramètre) jusqu'à `attackModifiers`. Conserver les valeurs par défaut (`env = []`) pour ne rien casser.

- [ ] **Step 5 : Lancer suite + typecheck.** Commit : `git commit -m "feat(combat): attackModifiers -- env injecte + size-to-hit (T1) + bonus plus petit (LDB 14/85)"`

---

## Task 6 : `sceneRules.ts` — obscurité, météo, empreinte décor

**Files:** Create `src/state/sceneRules.ts` + `src/state/sceneRules.test.ts`. Modifie `src/state/scene.ts` (champ `Scene.weather?`).

- [ ] **Step 1 : Ajouter `Scene.weather?`** (`scene.ts`, **hunk sélectif**, près de `ambiance?`) :
```ts
  /** Météo (LDB 14 l.94-116). Orthogonal à `ambiance`. Défaut 'clair'. */
  weather?: 'clair' | 'pluie' | 'brouillard' | 'neige' | 'tempete';
```

- [ ] **Step 2 : Tests qui échouent** (`sceneRules.test.ts`)

```ts
import { sceneCombatModifiers } from './sceneRules';
it('brouillard → cible dissimulée -20 au tir (concealed)', () => {
  expect(sceneCombatModifiers({ ambiance:'jour', weather:'brouillard' } as any)).toEqual({ concealed:true, attackMod:0, dodgeMod:0, label:'Brouillard' });
});
it('nuit → concealed (obscurité -20 au tir)', () => {
  expect(sceneCombatModifiers({ ambiance:'nuit' } as any).concealed).toBe(true);
});
it('tempête → -20 attaque, esquive 0', () => {
  expect(sceneCombatModifiers({ ambiance:'jour', weather:'tempete' } as any)).toMatchObject({ attackMod:-20, dodgeMod:0 });
});
it('neige → -20 attaque ET -20 esquive (LDB 14 l.115-116)', () => {
  expect(sceneCombatModifiers({ ambiance:'jour', weather:'neige' } as any)).toMatchObject({ attackMod:-20, dodgeMod:-20 });
});
it('clair/pluie → aucun mod', () => {
  expect(sceneCombatModifiers({ ambiance:'jour', weather:'pluie' } as any)).toMatchObject({ concealed:false, attackMod:0, dodgeMod:0 });
});
```

- [ ] **Step 3 : Implémenter `sceneRules.ts`**

```ts
/** Modificateurs de combat dérivés de la SCÈNE (obscurité/météo) — LDB 14 l.94-116/107. Pur côté state. */
import { Scene, SceneEntity, tileAt } from './scene';
import { terrainWalkable } from './terrain';

export interface SceneCombatMods { concealed: boolean; attackMod: number; dodgeMod: number; label: string; }

export function sceneCombatModifiers(scene: Pick<Scene, 'ambiance' | 'weather'>): SceneCombatMods {
  const night = scene.ambiance === 'nuit';
  const w = scene.weather ?? 'clair';
  const concealed = night || w === 'brouillard';            // cible dissimulée −20 au tir (l.107)
  let attackMod = 0, dodgeMod = 0, label = '';
  if (w === 'tempete') { attackMod = -20; label = 'Tempête'; }           // mousson/ouragan/blizzard (l.108-109)
  else if (w === 'neige') { attackMod = -20; dodgeMod = -20; label = 'Neige épaisse'; } // attaque ET esquive (l.115-116)
  else if (w === 'brouillard') label = 'Brouillard';
  else if (night) label = 'Obscurité';
  return { concealed, attackMod, dodgeMod, label };
}

/** Une case est-elle couverte par l'empreinte d'un décor bloquant (`foot {w,h}`) ? Pour walkability. */
export function entityBlockedAt(scene: Scene, x: number, y: number): boolean {
  return scene.entities.some((e) => {
    if (e.kind !== 'prop' && e.kind !== 'objet') return false;
    if (!e.foot) return false; // 1×1 sans empreinte : ne bloque pas (comportement actuel)
    return x >= e.pos.x && x < e.pos.x + e.foot.w && y >= e.pos.y && y < e.pos.y + e.foot.h;
  });
}
```

- [ ] **Step 4 : Lancer → vert + typecheck.** Commit (hunk sélectif scene.ts + nouveaux fichiers) : `git add -p src/state/scene.ts` (choisir le seul hunk `weather?`) puis `git add src/state/sceneRules.ts src/state/sceneRules.test.ts && git commit -m "feat(combat): sceneRules -- obscurite/meteo (LDB 14 l.107-116) + entityBlockedAt (empreinte decor)"`

---

## Task 7 : empreinte décor bloquante (`isWalkable`)

**Files:** Modify `src/state/scene.ts` (`SceneEntity.foot?` + `isWalkable`) — **hunks sélectifs**.

- [ ] **Step 1 : Ajouter `SceneEntity.foot?`** (après `weapon?` l.107) :
```ts
  /** Empreinte multi-cases (décor statique : charrette 2×1, épave 2×2…). Défaut 1×1. */
  foot?: { w: number; h: number };
```
- [ ] **Step 2 : Test** (dans un test de scene/path) : un décor `foot {w:2,h:1}` rend ses 2 cases non-walkables.
- [ ] **Step 3 : Étendre `isWalkable`** (l.236) :
```ts
import { entityBlockedAt } from './sceneRules';
export function isWalkable(scene: Scene, x: number, y: number): boolean {
  if (buildingBlockedAt(scene, x, y)) return false;
  if (entityBlockedAt(scene, x, y)) return false;
  return terrainWalkable(tileAt(scene, x, y));
}
```
> ⚠️ Cycle d'import potentiel `scene.ts ↔ sceneRules.ts` : `sceneRules` importe `Scene` (type only) — OK si `import type`. Sinon, déplacer `entityBlockedAt` dans `scene.ts` directement.
- [ ] **Step 4 : Lancer suite + typecheck.** Commit hunks sélectifs : `git commit -m "feat(combat): empreinte multi-cases des decors statiques bloque la walkability (foot {w,h})"`

---

## Task 8 : `combatFlow.resolveAttack` — gate LdV + env + tir-mêlée

**Files:** Modify `src/state/combatFlow.ts:261-292` (`firedWeapon`/`resolveAttack`).

- [ ] **Step 1 : Test d'intégration store** (`store.test.ts`) — (a) cible de tir sans LdV (mur intercalé) → `resolveAttack` renvoie un résultat « pas de tir » / la cible est refusée ; (b) tir avec couvert → la modale/le résultat porte la ligne Couvert ; (c) tir-dans-la-mêlée : cible Engagée avec un allié → −20 et redirection vers l'allié sur échec-qui-aurait-touché (RNG seedé).

- [ ] **Step 2 : Implémenter dans `resolveAttack`** — calculer LdV/couvert/env et passer à `resolveRanged` (et le sous-ensemble météo/taille à `resolveMelee`) :

```ts
import { lineOfSightCover, coverModifier } from './lineOfSight';
import { sceneCombatModifiers } from './sceneRules';
import { ModLine } from '../engine/combat';
// ... dans resolveAttack(attacker, target, location) :
const scene = get().scene!;
const battle = get().battle!;
const occupants = battle.combatants
  .filter((c) => c.id !== attacker.id && c.id !== target.id && !isOutOfAction(c) && c.pos)
  .map((c) => c.pos!);
const sc = sceneCombatModifiers(scene);
const env: ModLine[] = [];
if (weapon.type === 'ranged') {
  const los = lineOfSightCover(scene, attacker.pos!, target.pos!, occupants);
  if (los.blocked) return null;                                  // pas de Ligne de Vue → pas de tir (13 l.123)
  if (los.cover !== 'none') env.push({ label: `Couvert (${los.cover})`, value: coverModifier(los.cover) });
  if (sc.concealed) env.push({ label: `Obscurité/${sc.label}`, value: -20 });
  if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod });
  if (attacker.movedThisTurn) env.push({ label: 'Tir en bougeant', value: -10 }); // mvt + tir même Round (l.101)
  // Tir dans la mêlée (l.134) : cible Engagée avec un allié du tireur
  const inMelee = (target.engagedWith ?? []).some((id) => { const a = battle.combatants.find((c) => c.id === id); return a && a.kind === attacker.kind; });
  if (inMelee) env.push({ label: 'Tir dans la mêlée', value: -20 });
} else if (sc.attackMod) {
  env.push({ label: sc.label, value: sc.attackMod }); // tempête/neige en mêlée aussi
}
```
Passer `env` via `opts` à `resolveRanged`/`resolveMelee` (Task 5). Pour l'esquive sous neige, passer `sc.dodgeMod` à `defenseModifiers` (cf. Task 9). **`movedThisTurn`** : flag sur le combattant posé par le store quand un Mouvement est dépensé ce tour — l'ajouter si absent (champ `Combatant.movedThisTurn?: boolean`, remis à false en début de tour).

- [ ] **Step 3 : Redirection « tir dans la mêlée »** — quand `inMelee` et que le tir échoue mais aurait réussi sans le −20 : recalculer/comparer et rediriger la touche vers un allié intercalé au hasard (`battleRng()`), résolu par le pipeline de touche. Implémenter dans `applyAttackResult`/`resolveAttack` selon le flux existant ; tester avec un RNG seedé.

- [ ] **Step 4 : Suite + typecheck.** Commit : `git commit -m "feat(combat): resolveAttack -- gate Ligne de Vue + env (couvert/obscurite/meteo/mouvement/tir-melee), LDB 13/14"`

---

## Task 9 : `defenseModifiers` (neige) + AI respecte la LdV

**Files:** Modify `src/engine/combat.ts:152-160` (`defenseModifiers`) ; `src/state/ai.ts`.

- [ ] **Step 1 : `defenseModifiers` accepte un `dodgeMod`** (météo neige −20 en esquive) :
```ts
export function defenseModifiers(defender: Combatant, mode: 'parade' | 'esquive', dodgeMod = 0): ModLine[] {
  const out: ModLine[] = [];
  const adv = defender.advantage * 10; if (adv) out.push({ label: 'Avantage', value: adv, uncapped: true });
  const pen = combatTestPenalty(defender); if (pen) out.push({ label: 'État', value: pen });
  if (defender.defensiveStance) out.push({ label: 'Sur la défensive', value: 20 });
  if (mode === 'esquive' && dodgeMod) out.push({ label: 'Neige épaisse', value: dodgeMod }); // LDB 14 l.115-116
  return out;
}
```
(propager `dodgeMod` depuis `finishMelee`/le flux de défense, source = `sceneCombatModifiers(scene).dodgeMod`).
- [ ] **Step 2 : AI — filtrer les cibles de tir par LdV** (`ai.ts`, `chooseEnemyAction`) : avant de retenir une cible pour un tir, écarter celles dont `lineOfSightCover(scene, self.pos, target.pos, occupants).blocked` est vrai. Test : un ennemi tireur derrière un mur ne choisit pas la cible masquée.
- [ ] **Step 3 : Suite + typecheck.** Commit : `git commit -m "feat(combat): esquive -20 sous la neige + IA respecte la Ligne de Vue au tir"`

---

# PHASE 3 — Exposition éditeur + UI (fichiers partagés → hunks sélectifs)

## Task 10 : dérivation `size` au spawn

**Files:** Modify `src/state/spawn.ts` (après `weaponFromTrait`, + `statblockToCombatant` l.100, + spawn créature l.89).

- [ ] **Step 1 : Test** — un statbloc avec trait `'Taille (Énorme)'` → `size: 'enorme'` ; sans trait → `'moyenne'` ; `CustomStatblock.size` explicite prioritaire.
- [ ] **Step 2 : `CustomStatblock.size?`** (`scene.ts`, hunk sélectif) : `size?: SizeCategory;` (importer le type).
- [ ] **Step 3 : `sizeFromTraits`** (spawn.ts) :
```ts
import { SizeCategory, parseSizeLabel } from '../engine/size';
export function sizeFromTraits(traits: string[]): SizeCategory | null {
  for (const t of traits) { const m = t.match(/^Taille\s*\(([^)]+)\)/i); if (m) { const c = parseSizeLabel(m[1]); if (c) return c; } }
  return null;
}
```
- [ ] **Step 4 : Brancher** — `statblockToCombatant` : `size: sb.size ?? sizeFromTraits(sb.traits ?? []) ?? 'moyenne'` ; spawn depuis creature.json : `size: sizeFromTraits(creature.traits) ?? 'moyenne'`. (Héros : rien — défaut Moyenne au point de lecture via `effectiveSize`.)
- [ ] **Step 5 : Suite + typecheck.** Commit : `git commit -m "feat(taille): derive size au spawn (sizeFromTraits + CustomStatblock.size), defaut Moyenne"`

## Task 11 : éditeur — météo + empreinte décor

**Files:** Modify `src/ui/editor/*` (réglages scène + inspecteur décor) — **sous-composant dédié, hunks sélectifs**.

- [ ] **Step 1 :** localiser le panneau de réglages de scène (là où `ambiance` est édité) et l'inspecteur de décor. Ajouter un `<select>` météo (clair/pluie/brouillard/neige/tempête → `scene.weather`) et deux champs `w`/`h` d'empreinte sur l'inspecteur de décor (`SceneEntity.foot`).
- [ ] **Step 2 :** recette navigateur (Playwright) : poser une charrette 2×1, vérifier blocage + couvert ; régler la météo, vérifier la pénalité dans la modale d'attaque.
- [ ] **Step 3 : Commit** (hunks sélectifs) : `git commit -m "feat(editeur): selecteur meteo + empreinte (foot) des decors"`

## Task 12 : UI modale + ciblage

**Files:** Modify `src/ui/RollModal.tsx` + le composant de ciblage d'attaque.

- [ ] **Step 1 :** les lignes `env` (Couvert/Taille/Obscurité/Météo) s'affichent déjà via `attackerDetail.mods` (rien à faire si le détail liste `mods`). Vérifier l'affichage du plafond Combiner.
- [ ] **Step 2 :** au ciblage d'un tir, griser/refuser les cibles hors-LdV (`lineOfSightCover(...).blocked`).
- [ ] **Step 3 :** recette navigateur. Commit : `git commit -m "feat(combat-ui): cibles hors Ligne de Vue refusees + detail couvert/taille dans la modale"`

---

## Self-Review (effectué)

- **Couverture spec** : A LdV (T4/T8) ✓ · B Couvert (T4) ✓ · C Combiner (T3) ✓ · D obscurité/mouvement (T6/T8) ✓ · E tir-mêlée (T8) ✓ · F Taille T0 (T1/T2/T10) ✓ · G Taille T1 (T5) ✓ · H météo (T6/T8/T9/T11) ✓ · I empreinte (T6/T7/T11) ✓.
- **À vérifier verbatim avant code** : « +10 au plus petit » (T5 Step 1, `85` l.300-306) — scope/stacking.
- **Cohérence des types** : `CoverClass`/`coverModifier` (state) ↔ `env: ModLine[]` (number) injecté dans engine ; `SizeCategory` (engine) ; `ModLine.uncapped` ajouté T3 et utilisé T5. ✓
- **Frontière engine/state** : `lineOfSight`/`sceneRules` en `state` (lisent Scene) ; `size`/`combineMods` en `engine`. ✓
- **Fichiers partagés** (`scene.ts`, `Editor.tsx`) : hunks sélectifs, jamais `git commit -- <fichier>`. ✓
- **Risque** : cycle d'import `scene.ts ↔ sceneRules.ts` → `import type` strict ou déplacer `entityBlockedAt` (noté T7).
