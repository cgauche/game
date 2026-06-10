# Loadouts & deux armes — Plan #1 : fondation moteur (Phase 0 + Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Poser le registre de capacités de combat (talents/traits) et le modèle mains/loadouts + la pénalité de
main secondaire (attaque & parade), sans rien casser de l'existant.

**Architecture:** Registre `src/engine/combatFeatures/` calqué sur `src/engine/qualities/` (entrée = 1 capacité ;
Ambidextre livré). Latéralité `hands:1|2` dérivée du marqueur `(2M)`. `Combatant.loadouts[]` + `activeLoadoutId`
pilotent `recomputeLoadout` (contrainte 2 mains, tag `hand`). **Invariant de compat : SANS loadout actif,
`recomputeLoadout` garde le comportement historique (toutes armes équipées, `hand:'main'`) → aucune pénalité,
tous les tests existants intacts.** La pénalité de main secondaire est un `ModLine` injecté dans
`attackModifiers` (mêlée) et `defenseModifiers` (parade), avec l'exception Corps à corps (Parade) + Défensive.

**Tech Stack:** TypeScript, Vitest. Moteur pur (`src/engine/`), aucune dépendance UI/store.

**Réf design :** `docs/superpowers/specs/2026-06-10-loadouts-deux-armes-design.md` (RAW vérifié).
**Périmètre de CE plan :** Phases 0-1. Les plans #2 (constructeur UI), #3 (combat), #4 (Maniement de deux armes)
suivront contre l'API concrète posée ici.

**Commande de test :** `npx vitest run <fichier>` (un fichier) ; `npm test` (suite complète). Sur cette
machine, lancer via le terminal natif.

---

## Task 1 : Registre de capacités de combat (Phase 0)

**Files:**
- Create: `src/engine/combatFeatures/types.ts`
- Create: `src/engine/combatFeatures/registry.ts`
- Create: `src/engine/combatFeatures/normalize.ts`
- Create: `src/engine/combatFeatures/dispatch.ts`
- Test: `src/engine/combatFeatures/dispatch.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

`src/engine/combatFeatures/dispatch.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { offHandPenalty } from './dispatch';
import type { Combatant } from '../types';

const mk = (talents: { name: string; times: number }[]): Combatant =>
  ({ id: 'c', name: 'X', kind: 'hero', talents, skills: [] } as unknown as Combatant);

describe('offHandPenalty (registre de capacités)', () => {
  it('sans Ambidextre : -20 (LDB 14 l.181)', () => {
    expect(offHandPenalty(mk([]))).toBe(-20);
  });
  it('Ambidextre 1x : -10 (LDB 10 l.32)', () => {
    expect(offHandPenalty(mk([{ name: 'Ambidextre', times: 1 }]))).toBe(-10);
  });
  it('Ambidextre 2x : 0', () => {
    expect(offHandPenalty(mk([{ name: 'Ambidextre', times: 2 }]))).toBe(0);
  });
  it('insensible a la casse du nom de talent', () => {
    expect(offHandPenalty(mk([{ name: 'ambidextre', times: 1 }]))).toBe(-10);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/engine/combatFeatures/dispatch.test.ts`
Expected: FAIL (`Cannot find module './dispatch'`).

- [ ] **Step 3 : Créer `types.ts`**

```ts
import type { Combatant } from '../types';

/** Contexte lecture seule d'un hook de capacite (level = times du talent / Indice du trait). */
export interface CombatFeatureCtx {
  combatant: Combatant;
  level: number;
}

/**
 * Une capacite de combat (talent ou trait de creature). Hooks optionnels, consommes par dispatch.ts.
 * Ce chantier cable `modifyOffHandPenalty` (Ambidextre). Hooks FUTURS, ajoutes avec leur 1er
 * consommateur (pas de dispatcher mort) : `attackModes` (Maniement de deux armes, plan #4),
 * `onWonDefense` (Riposte/Champion), `attackMods`/`defenseMods`.
 */
export interface CombatFeature {
  /** Nom FR canonique (Ambidextre, Maniement de deux armes, Riposte, Champion...). */
  key: string;
  kind: 'talent' | 'trait';
  /** Transforme la penalite de main secondaire (Ambidextre : -20 -> -10/0). */
  modifyOffHandPenalty?: (penalty: number, ctx: CombatFeatureCtx) => number;
}
```

- [ ] **Step 4 : Créer `registry.ts`**

```ts
import type { CombatFeature } from './types';

/** Registre des capacites de combat (talents + traits). 1 entree = 1 capacite ; cle = nom FR canonique. */
export const COMBAT_FEATURES: Record<string, CombatFeature> = {
  // Ambidextre (LDB 10 l.30-32) : penalite de main secondaire -20 -> -10 (1x) -> 0 (2x).
  Ambidextre: {
    key: 'Ambidextre',
    kind: 'talent',
    modifyOffHandPenalty: (penalty, { level }) => (level >= 2 ? 0 : Math.min(0, penalty + 10)),
  },
};
```

- [ ] **Step 5 : Créer `normalize.ts`**

```ts
import { COMBAT_FEATURES } from './registry';

/** Canonicalise un nom de talent/trait vers la cle du registre (insensible casse/espaces), ou null. */
export function featureKey(name: string): string | null {
  const n = name.trim().toLowerCase();
  return Object.keys(COMBAT_FEATURES).find((k) => k.toLowerCase() === n) ?? null;
}
```

- [ ] **Step 6 : Créer `dispatch.ts`**

```ts
import type { Combatant } from '../types';
import { COMBAT_FEATURES } from './registry';
import { featureKey } from './normalize';
import type { CombatFeature, CombatFeatureCtx } from './types';

/** Capacites du registre presentes sur le combattant (talents ; traits a brancher plus tard), avec niveau. */
export function featuresOf(c: Combatant): { def: CombatFeature; ctx: CombatFeatureCtx }[] {
  const out: { def: CombatFeature; ctx: CombatFeatureCtx }[] = [];
  for (const t of c.talents ?? []) {
    const k = featureKey(t.name);
    if (k) out.push({ def: COMBAT_FEATURES[k], ctx: { combatant: c, level: t.times ?? 1 } });
  }
  return out;
}

/** Penalite de main secondaire (LDB 14 l.181 : -20), transformee par les capacites (Ambidextre -> -10/0). */
export function offHandPenalty(c: Combatant): number {
  let pen = -20;
  for (const { def, ctx } of featuresOf(c)) {
    if (def.modifyOffHandPenalty) pen = def.modifyOffHandPenalty(pen, ctx);
  }
  return pen;
}
```

- [ ] **Step 7 : Lancer le test, vérifier le succès**

Run: `npx vitest run src/engine/combatFeatures/dispatch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8 : Commit**

```bash
git add src/engine/combatFeatures/
git commit -m "feat(combat): registre de capacites de combat (Phase 0) + Ambidextre (off-hand -10/0)"
```

---

## Task 2 : Latéralité fiable `weaponHands` + champ `hands` (Phase 1)

**Files:**
- Modify: `src/engine/types.ts` (ajouter `hands?` à `ItemInstance` et `Weapon`)
- Modify: `src/engine/items.ts` (`weaponHands`, `itemFromTrapping`, `isTwoHandedWeapon`)
- Test: `src/engine/items.test.ts` (ajouter un bloc)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `src/engine/items.test.ts` :
```ts
import { weaponHands } from './items';

describe('weaponHands (lateralite)', () => {
  const it_ = (p: Partial<ItemInstance>): ItemInstance =>
    ({ uid: 'w', name: 'X', kind: 'melee', qualities: [], enc: 0, equipped: false, ...p } as ItemInstance);

  it('arme (2M) -> 2 mains meme hors groupe Deux-mains (Hallebarde)', () => {
    expect(weaponHands(it_({ name: 'Hallebarde', subType: "Armes d'hast", hands: 2 }))).toBe(2);
  });
  it('arme simple / bouclier -> 1 main', () => {
    expect(weaponHands(it_({ name: 'Epee', subType: 'Base' }))).toBe(1);
    expect(weaponHands(it_({ name: 'Bouclier', subType: 'Base' }))).toBe(1);
  });
  it('arc / arbalete (non poing) -> 2 mains ; arbalete de poing -> 1', () => {
    expect(weaponHands(it_({ name: 'Arc', kind: 'ranged', subType: 'Arc' }))).toBe(2);
    expect(weaponHands(it_({ name: 'Arbalete', kind: 'ranged', subType: 'Arbalète' }))).toBe(2);
    expect(weaponHands(it_({ name: 'Arbalete de poing', kind: 'ranged', subType: 'Arbalète' }))).toBe(1);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/engine/items.test.ts`
Expected: FAIL (`weaponHands` is not a function).

- [ ] **Step 3 : Ajouter `hands?` aux types**

Dans `src/engine/types.ts`, interface `Weapon` (après `subType?`) :
```ts
  /** Nombre de mains requises (1 ou 2). Derive de `(2M)` / arc / arbalete. */
  hands?: 1 | 2;
  /** Main qui tient l'arme dans le loadout actif ('off' => penalite de main secondaire). */
  hand?: 'main' | 'off';
```
Dans `ItemInstance` (après `subType?`) :
```ts
  /** Nombre de mains requises (1 ou 2), pose a la creation par itemFromTrapping. */
  hands?: 1 | 2;
```

- [ ] **Step 4 : Implémenter `weaponHands` + brancher `itemFromTrapping` et `isTwoHandedWeapon`**

Dans `src/engine/items.ts`, ajouter (avant `isTwoHandedWeapon`) :
```ts
/** Latéralite d'une arme : 2 mains si marquee `(2M)` (prefix/nom) ou arc / arbalete (sauf « de poing ») ;
 *  sinon 1 main. Couvre les armes 2M hors groupe « Deux-mains » (hampes, fleaux, epee batarde). */
export function weaponHands(it: { hands?: 1 | 2; name: string; kind?: string; subType?: string }): 1 | 2 {
  if (it.hands === 1 || it.hands === 2) return it.hands;
  const st = (it.subType ?? '').toLowerCase();
  if ((it.kind ?? 'melee') === 'ranged') return st === 'arc' || (st === 'arbalète' && !/poing/i.test(it.name)) ? 2 : 1;
  if (/\(2m\)/i.test(it.name) || st === 'deux-mains') return 2;
  return 1;
}
```
Dans `itemFromTrapping`, calculer `hands` depuis le `prefix` du trapping et l'inclure dans l'objet retourné :
```ts
  const twoHandMark = /\(2m\)/i.test(t.prefix ?? '') || /\(2m\)/i.test(t.label);
```
puis dans l'objet retourné, ajouter (après `subType`) :
```ts
    hands: weaponHands({ name: t.label, kind, subType: t.subType ?? undefined, hands: kind === 'ranged' ? undefined : (twoHandMark ? 2 : 1) }),
```
Remplacer le corps de `isTwoHandedWeapon` par :
```ts
export function isTwoHandedWeapon(it: ItemInstance): boolean {
  return weaponHands(it) === 2;
}
```

- [ ] **Step 5 : Lancer les tests, vérifier le succès**

Run: `npx vitest run src/engine/items.test.ts`
Expected: PASS (dont le nouveau bloc).

- [ ] **Step 6 : Commit**

```bash
git add src/engine/types.ts src/engine/items.ts src/engine/items.test.ts
git commit -m "feat(combat): lateralite fiable weaponHands (marqueur 2M) + champ hands"
```

---

## Task 3 : Types Loadout + helper `activeLoadout`

**Files:**
- Modify: `src/engine/types.ts` (`WeaponLoadout`, champs `Combatant`)
- Modify: `src/engine/items.ts` (`activeLoadout`)
- Test: `src/engine/items.test.ts` (bloc `activeLoadout`)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `src/engine/items.test.ts` :
```ts
import { activeLoadout } from './items';

describe('activeLoadout', () => {
  const base = (over: Partial<Combatant>): Combatant =>
    ({ id: 'h', name: 'H', kind: 'hero', items: [], ...over } as unknown as Combatant);

  it('aucun loadout -> null (chemin legacy)', () => {
    expect(activeLoadout(base({}))).toBeNull();
  });
  it('renvoie le loadout actif par id', () => {
    const c = base({ loadouts: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], activeLoadoutId: 'b' });
    expect(activeLoadout(c)?.id).toBe('b');
  });
  it('id inconnu -> 1er loadout (repli)', () => {
    const c = base({ loadouts: [{ id: 'a', name: 'A' }], activeLoadoutId: 'zzz' });
    expect(activeLoadout(c)?.id).toBe('a');
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/engine/items.test.ts`
Expected: FAIL (`activeLoadout` is not a function ; type `WeaponLoadout` inconnu).

- [ ] **Step 3 : Ajouter les types**

Dans `src/engine/types.ts`, avant `interface Combatant` :
```ts
/** Set d'armes nomme (les 2 mains). `off` ignore si l'arme `main` est a 2 mains. uids -> ItemInstance. */
export interface WeaponLoadout {
  id: string;
  name: string;
  main?: string;
  off?: string;
}
```
Dans `interface Combatant` (après `skills` / `talents`) :
```ts
  /** Sets d'armes du heros (les ennemis n'en ont pas -> chemin legacy). */
  loadouts?: WeaponLoadout[];
  activeLoadoutId?: string;
```

- [ ] **Step 4 : Implémenter `activeLoadout`**

Dans `src/engine/items.ts`, ajouter (importer `WeaponLoadout` depuis `./types`) :
```ts
/** Loadout actif d'un combattant, ou null si aucun (chemin legacy = toutes armes equipees). */
export function activeLoadout(c: Combatant): WeaponLoadout | null {
  if (!c.loadouts?.length) return null;
  return c.loadouts.find((l) => l.id === c.activeLoadoutId) ?? c.loadouts[0];
}
```

- [ ] **Step 5 : Lancer les tests + typecheck**

Run: `npx vitest run src/engine/items.test.ts` → PASS
Run: `npm run typecheck` → 0 erreur

- [ ] **Step 6 : Commit**

```bash
git add src/engine/types.ts src/engine/items.ts src/engine/items.test.ts
git commit -m "feat(combat): types WeaponLoadout + helper activeLoadout"
```

---

## Task 4 : `recomputeLoadout` piloté par le loadout actif (contrainte 2 mains, tag `hand`)

**Files:**
- Modify: `src/engine/items.ts` (`recomputeLoadout`)
- Test: `src/engine/items.test.ts` (bloc `recomputeLoadout / loadout`)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `src/engine/items.test.ts` :
```ts
describe('recomputeLoadout pilote par loadout', () => {
  const heroWith = (items: ItemInstance[], lo?: { loadouts: any[]; activeLoadoutId: string }): Combatant =>
    ({ id: 'h', name: 'H', kind: 'hero', characteristics: { F: 30, E: 30 } as any, items,
       talents: [], skills: [], conditions: [], wounds: { current: 10, max: 10 }, advantage: 0, ...lo } as unknown as Combatant);
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, name, kind: 'melee', qualities: [], enc: 1, equipped: true, ...p } as ItemInstance);

  it('loadout 1 main + bouclier -> 2 armes taguees main/off + Mains nues', () => {
    const epee = w('e', 'Epee', { subType: 'Base', hands: 1 });
    const bouc = w('b', 'Bouclier', { subType: 'Base', hands: 1, qualities: ['Défensive'] });
    const c = heroWith([epee, bouc], { loadouts: [{ id: 'l1', name: 'EB', main: 'e', off: 'b' }], activeLoadoutId: 'l1' });
    recomputeLoadout(c);
    expect(c.weapons.map((x) => [x.name, x.hand])).toEqual([
      ['Epee', 'main'], ['Bouclier', 'off'], ['Mains nues', 'main'],
    ]);
  });

  it('loadout arme 2 mains -> slot off ignore', () => {
    const halle = w('h', 'Hallebarde', { subType: "Armes d'hast", hands: 2 });
    const bouc = w('b', 'Bouclier', { subType: 'Base', hands: 1 });
    const c = heroWith([halle, bouc], { loadouts: [{ id: 'l', name: 'H', main: 'h', off: 'b' }], activeLoadoutId: 'l' });
    recomputeLoadout(c);
    expect(c.weapons.map((x) => x.name)).toEqual(['Hallebarde', 'Mains nues']);
  });

  it('aucun loadout -> legacy : toutes armes equipees, hand main', () => {
    const a = w('a', 'A', { subType: 'Base', hands: 1 });
    const b = w('b', 'B', { subType: 'Base', hands: 1 });
    const c = heroWith([a, b]);
    recomputeLoadout(c);
    expect(c.weapons.map((x) => x.name)).toEqual(['A', 'B', 'Mains nues']);
    expect(c.weapons.every((x) => x.hand !== 'off')).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/engine/items.test.ts`
Expected: FAIL (les armes n'ont pas de `hand` ; loadout ignore).

- [ ] **Step 3 : Réécrire `recomputeLoadout`**

Remplacer la fonction `recomputeLoadout` (`src/engine/items.ts`) par :
```ts
/** Recalcule armes/armure actives + encombrement. Les ARMES viennent du loadout actif (contrainte 2 mains,
 *  tag `hand`) ; sans loadout = comportement historique (toutes armes equipees, `hand:'main'`). */
export function recomputeLoadout(c: Combatant): void {
  const items = c.items ?? [];
  const toWeapon = (it: ItemInstance, hand: 'main' | 'off'): Weapon | null => {
    if (it.destroyed) return null; // arme detruite : inutilisable (LDB 14)
    const hands = weaponHands(it);
    if (hands === 2 && cannotWieldTwoHanded(c)) return null; // amputation : pas d'arme 2 mains (LDB 18 l.352)
    const reload = indiceOf(it.qualities, 'Recharge') ?? 0;
    return { name: it.name, type: it.kind as 'melee' | 'ranged', damage: it.damage ?? '+BF', reach: it.reach,
      range: it.range, qualities: it.qualities, subType: it.subType, reload, damageTaken: it.damageTaken,
      skin: it.skin, hands, hand };
  };

  const weapons: Weapon[] = [];
  const lo = activeLoadout(c);
  if (lo) {
    const mainIt = lo.main ? items.find((i) => i.uid === lo.main && (i.kind === 'melee' || i.kind === 'ranged')) : undefined;
    const mainW = mainIt ? toWeapon(mainIt, 'main') : null;
    if (mainW) weapons.push(mainW);
    const mainTwoHanded = mainW?.hands === 2;
    let offUid: string | undefined;
    if (!mainTwoHanded && lo.off) {
      const offIt = items.find((i) => i.uid === lo.off && (i.kind === 'melee' || i.kind === 'ranged'));
      const offW = offIt ? toWeapon(offIt, 'off') : null;
      if (offW) { weapons.push(offW); offUid = offIt!.uid; }
    }
    // Synchronise `equipped` des ARMES sur le loadout (lecteurs legacy de weapon.equipped : marchand, etc.).
    for (const it of items) if (it.kind === 'melee' || it.kind === 'ranged') it.equipped = it.uid === lo.main || it.uid === offUid;
  } else {
    for (const it of items) {
      if (!it.equipped || (it.kind !== 'melee' && it.kind !== 'ranged')) continue;
      const w = toWeapon(it, 'main');
      if (w) weapons.push(w);
    }
  }

  if (items.some((i) => i.equipped && i.name === 'Crochet')) {
    weapons.push({ name: 'Crochet', type: 'melee', damage: '+BF+2', reach: 'Très courte', qualities: [], subType: 'Base', hands: 1, hand: 'main' });
  }
  weapons.push({ name: 'Mains nues', type: 'melee', damage: '+BF-2', reach: 'Très courte', qualities: [], hands: 1, hand: 'main' });

  const armour = emptyArmour();
  for (const it of items) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa || !it.locs) continue;
    const net = Math.max(0, it.pa - (it.damageTaken ?? 0));
    for (const l of it.locs) armour[l] = Math.max(armour[l], net);
  }

  c.weapons = weapons;
  c.armour = armour;
  c.encumbrance = totalEncumbrance(c);
}
```

- [ ] **Step 4 : Lancer les tests du fichier, vérifier le succès**

Run: `npx vitest run src/engine/items.test.ts`
Expected: PASS (tous, dont le nouveau bloc).

- [ ] **Step 5 : Lancer la suite complète (non-régression)**

Run: `npm test`
Expected: PASS (les Combatants construits sans loadout passent par le chemin legacy → inchangés). Si un test
échoue car il s'attendait à `c.weapons` sans champ `hand`/`hands`, corriger l'assertion (ajout de champ, pas
changement de comportement).

- [ ] **Step 6 : Commit**

```bash
git add src/engine/items.ts src/engine/items.test.ts
git commit -m "feat(combat): recomputeLoadout pilote par le loadout actif (contrainte 2 mains, tag hand)"
```

---

## Task 5 : Migration `ensureDefaultLoadout` (un set par défaut à la création)

**Files:**
- Modify: `src/engine/items.ts` (`ensureDefaultLoadout`)
- Modify: `src/engine/character.ts` (appel après `recomputeLoadout`)
- Test: `src/engine/items.test.ts` (bloc `ensureDefaultLoadout`)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `src/engine/items.test.ts` :
```ts
describe('ensureDefaultLoadout', () => {
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, name, kind: 'melee', qualities: [], enc: 1, equipped: true, damage: '+BF+4', ...p } as ItemInstance);
  const hero = (items: ItemInstance[]): Combatant =>
    ({ id: 'h', name: 'H', kind: 'hero', items } as unknown as Combatant);

  it('cree « Melee » = meilleure arme de melee en main, bouclier en secondaire', () => {
    const c = hero([
      w('e', 'Epee', { subType: 'Base', hands: 1, damage: '+BF+4' }),
      w('b', 'Bouclier', { subType: 'Base', hands: 1, damage: '+BF', qualities: ['Défensive'] }),
    ]);
    ensureDefaultLoadout(c);
    const lo = c.loadouts!.find((l) => l.name === 'Mêlée')!;
    expect(lo.main).toBe('e');
    expect(lo.off).toBe('b');
    expect(c.activeLoadoutId).toBe(lo.id);
  });

  it('arme distance presente -> loadout « Distance » en plus', () => {
    const c = hero([
      w('e', 'Epee', { subType: 'Base', hands: 1 }),
      w('arc', 'Arc', { kind: 'ranged', subType: 'Arc', hands: 2, equipped: true, damage: '+9' }),
    ]);
    ensureDefaultLoadout(c);
    expect(c.loadouts!.map((l) => l.name).sort()).toEqual(['Distance', 'Mêlée']);
    expect(c.loadouts!.find((l) => l.name === 'Distance')!.main).toBe('arc');
  });

  it('idempotent : ne recree pas si loadouts deja presents', () => {
    const c = hero([w('e', 'Epee', { subType: 'Base', hands: 1 })]);
    c.loadouts = [{ id: 'x', name: 'Custom', main: 'e' }];
    c.activeLoadoutId = 'x';
    ensureDefaultLoadout(c);
    expect(c.loadouts).toHaveLength(1);
    expect(c.activeLoadoutId).toBe('x');
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/engine/items.test.ts`
Expected: FAIL (`ensureDefaultLoadout` is not a function).

- [ ] **Step 3 : Implémenter `ensureDefaultLoadout`**

Dans `src/engine/items.ts` :
```ts
let loadoutCounter = 0;
/** Genere les loadouts par defaut d'un heros qui n'en a pas : « Melee » (meilleure arme de melee + bouclier/
 *  2e arme 1 main en secondaire) et « Distance » (1re arme a distance) si presentes. Idempotent. */
export function ensureDefaultLoadout(c: Combatant): void {
  if (c.loadouts?.length) return;
  const items = (c.items ?? []).filter((i) => i.equipped && (i.kind === 'melee' || i.kind === 'ranged'));
  const melee = items.filter((i) => i.kind === 'melee');
  const ranged = items.filter((i) => i.kind === 'ranged');
  const loadouts: WeaponLoadout[] = [];

  if (melee.length) {
    const main = [...melee].sort((a, b) => damageScore(b.damage) - damageScore(a.damage))[0];
    let off: ItemInstance | undefined;
    if (weaponHands(main) === 1) {
      off = melee.find((i) => i.uid !== main.uid && weaponHands(i) === 1); // 2e arme / bouclier 1 main
    }
    loadouts.push({ id: `lo-${++loadoutCounter}`, name: 'Mêlée', main: main.uid, off: off?.uid });
  }
  if (ranged.length) {
    loadouts.push({ id: `lo-${++loadoutCounter}`, name: 'Distance', main: ranged[0].uid });
  }
  if (!loadouts.length) return; // aucune arme equipee : pas de loadout (Mains nues suffisent via recompute)
  c.loadouts = loadouts;
  c.activeLoadoutId = loadouts[0].id;
}
```

- [ ] **Step 4 : Appeler à la création de personnage**

Dans `src/engine/character.ts`, ligne ~251 (`recomputeLoadout(hero)`), remplacer par :
```ts
  recomputeLoadout(hero); // dérive weapons/armour/encombrement de l'équipement
  ensureDefaultLoadout(hero); // un set d'armes par défaut (Mêlée / Distance) — LDB : 2 mains
  recomputeLoadout(hero); // re-dérive depuis le loadout actif
```
Ajouter `ensureDefaultLoadout` à l'import depuis `./items`.

- [ ] **Step 5 : Lancer le fichier + la suite complète**

Run: `npx vitest run src/engine/items.test.ts` → PASS
Run: `npm test` → PASS. Si `character.test.ts` ou des pregens vérifient `c.weapons` (ex. attendaient une arme
de distance ET de mêlée actives simultanément), ajuster : avec un loadout par défaut, seule la main (+secondaire)
est active. C'est le comportement voulu (2 mains) ; corriger l'assertion vers le loadout attendu.
Run: `npm run typecheck` → 0 erreur

- [ ] **Step 6 : Commit**

```bash
git add src/engine/items.ts src/engine/character.ts src/engine/items.test.ts
git commit -m "feat(combat): ensureDefaultLoadout (set Melee/Distance par defaut a la creation)"
```

---

## Task 6 : Pénalité de main secondaire à l'attaque (mêlée)

**Files:**
- Modify: `src/engine/combat.ts` (`attackModifiers`)
- Test: `src/engine/combat-breakdown.test.ts` (bloc `main secondaire`)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `src/engine/combat-breakdown.test.ts` (réutiliser le helper `mk` du fichier ; sinon créer un combattant minimal) :
```ts
import { attackModifiers } from './combat';

describe('attackModifiers : penalite de main secondaire (LDB 14 l.181)', () => {
  const atk = (talents: any[] = []): Combatant =>
    ({ id: 'a', name: 'A', kind: 'hero', advantage: 0, talents, skills: [], conditions: [],
       psychState: [], size: 3, weapons: [] } as unknown as Combatant);
  const tgt = (): Combatant => ({ id: 't', name: 'T', kind: 'enemy', advantage: 0, conditions: [], size: 3 } as unknown as Combatant);
  const off = (over: Partial<Weapon> = {}): Weapon => ({ name: 'W', type: 'melee', damage: '+BF', qualities: [], hand: 'off', hands: 1, ...over });
  const main = (over: Partial<Weapon> = {}): Weapon => ({ name: 'W', type: 'melee', damage: '+BF', qualities: [], hand: 'main', hands: 1, ...over });

  it('arme de main secondaire -> -20', () => {
    const mods = attackModifiers(atk(), tgt(), off(), { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-20);
  });
  it('Ambidextre 1x -> -10', () => {
    const mods = attackModifiers(atk([{ name: 'Ambidextre', times: 1 }]), tgt(), off(), { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-10);
  });
  it('arme de main principale -> aucune penalite', () => {
    const mods = attackModifiers(atk(), tgt(), main(), { kind: 'melee' });
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/engine/combat-breakdown.test.ts`
Expected: FAIL (pas de ModLine `Main secondaire`).

- [ ] **Step 3 : Injecter la pénalité dans `attackModifiers`**

Dans `src/engine/combat.ts`, importer en tête : `import { offHandPenalty } from './combatFeatures/dispatch';`
Dans `attackModifiers`, juste avant `if (opts.env) out.push(...opts.env);` :
```ts
  // Penalite de main secondaire (LDB 14 l.181 ; Ambidextre la reduit -> registre combatFeatures).
  if (weapon.hand === 'off') {
    const p = offHandPenalty(attacker);
    if (p) out.push({ label: 'Main secondaire', value: p });
  }
```

- [ ] **Step 4 : Lancer le fichier + la suite**

Run: `npx vitest run src/engine/combat-breakdown.test.ts` → PASS
Run: `npm test` → PASS (le `hand` reste `main`/indéfini partout sauf loadout avec secondaire → aucun mod nouveau).

- [ ] **Step 5 : Commit**

```bash
git add src/engine/combat.ts src/engine/combat-breakdown.test.ts
git commit -m "feat(combat): penalite de main secondaire a l'attaque (melee, via registre)"
```

---

## Task 7 : Pénalité de parade + exception Corps à corps (Parade) + Défensive

**Files:**
- Modify: `src/engine/combat.ts` (`parryPenalty`, `defenseModifiers`, appel dans `finishMelee`)
- Test: `src/engine/combat-breakdown.test.ts` (bloc `parade main secondaire`)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `src/engine/combat-breakdown.test.ts` :
```ts
import { defenseModifiers } from './combat';

describe('parade : penalite de main secondaire + exception Parade/Defensive (LDB 62 l.192)', () => {
  const def = (skills: any[] = [], talents: any[] = []): Combatant =>
    ({ id: 'd', name: 'D', kind: 'hero', advantage: 0, conditions: [], skills, talents } as unknown as Combatant);
  const offShield = (over: Partial<Weapon> = {}): Weapon => ({ name: 'Bouclier', type: 'melee', damage: '+BF', qualities: ['Défensive'], hand: 'off', hands: 1, ...over });
  const parrySpec = { name: 'Corps à corps', spec: 'Parade', characteristic: 'CC', advances: 0 };

  it('parade main secondaire avec bouclier Defensive + spe Parade -> AUCUNE penalite', () => {
    const mods = defenseModifiers(def([parrySpec]), 'parade', 0, offShield());
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
  });
  it('parade main secondaire SANS spe Parade -> -20', () => {
    const mods = defenseModifiers(def([]), 'parade', 0, offShield());
    expect(mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-20);
  });
  it('parade main principale -> aucune penalite', () => {
    const mods = defenseModifiers(def([]), 'parade', 0, { ...offShield(), hand: 'main' });
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/engine/combat-breakdown.test.ts`
Expected: FAIL (`defenseModifiers` ignore le 4e argument).

- [ ] **Step 3 : Implémenter `parryPenalty` + étendre `defenseModifiers`**

Dans `src/engine/combat.ts`, ajouter (importer `hasQuality` depuis `./qualities/dispatch` si pas déjà importé) :
```ts
/** Le defenseur possede-t-il une Spe de Corps a corps donnee (ex. 'Parade') ? */
function hasMeleeSpec(c: Combatant, spec: string): boolean {
  return (c.skills ?? []).some((s) => s.name.toLowerCase() === 'corps à corps' && (s.spec ?? '').toLowerCase() === spec.toLowerCase());
}

/** Penalite a la PARADE avec l'arme `weapon` (LDB 62 l.192) : 0 en main principale ; 0 si arme 1 main +
 *  Defensive + le defenseur a Corps a corps (Parade) ; sinon penalite de main secondaire (Ambidextre la reduit). */
export function parryPenalty(defender: Combatant, weapon: Weapon | undefined): number {
  if (!weapon || weapon.hand !== 'off') return 0;
  if (weapon.hands === 1 && hasQuality(weapon, 'Défensive') && hasMeleeSpec(defender, 'Parade')) return 0;
  return offHandPenalty(defender);
}
```
Modifier la signature et le corps de `defenseModifiers` :
```ts
export function defenseModifiers(defender: Combatant, mode: 'parade' | 'esquive', dodgeMod = 0, weapon?: Weapon): ModLine[] {
  const out: ModLine[] = [];
  const adv = defender.advantage * 10;
  if (adv) out.push({ label: 'Avantage', value: adv });
  const pen = combatTestPenalty(defender);
  if (pen) out.push({ label: 'État', value: pen });
  if (defender.defensiveStance) out.push({ label: 'Sur la défensive', value: 20 });
  if (mode === 'esquive' && dodgeMod) out.push({ label: 'Neige épaisse', value: dodgeMod });
  if (mode === 'parade') {
    const pp = parryPenalty(defender, weapon);
    if (pp) out.push({ label: 'Main secondaire', value: pp });
  }
  return out;
}
```
Dans `finishMelee` (`src/engine/combat.ts:398`), passer l'arme de parade à `defenseModifiers` :
```ts
  const defBd = bd(DEFENSE_LABEL[defenseMode], defenseValue(defender, defenseMode, defender.weapons[0]), def, defenseModifiers(defender, defenseMode, dodgeMod, defender.weapons[0]));
```

- [ ] **Step 4 : Lancer le fichier + la suite**

Run: `npx vitest run src/engine/combat-breakdown.test.ts` → PASS (dont l'ancien test `defenseModifiers parade -20 absent en parade` : `defender.weapons[0]` est `hand:'main'`/undefined → pas de pénalité → toujours vert).
Run: `npm test` → PASS
Run: `npm run typecheck` → 0 erreur

- [ ] **Step 5 : Commit**

```bash
git add src/engine/combat.ts src/engine/combat-breakdown.test.ts
git commit -m "feat(combat): penalite de parade main secondaire + exception Parade/Defensive (LDB 62 l.192)"
```

---

## Auto-revue (couverture spec Phases 0-1)

- Registre de capacités (§4.3) → Task 1. Ambidextre (offHandPenalty) → Task 1.
- Latéralité `hands` (§4.1) → Task 2 (marqueur `(2M)`).
- Modèle Loadout (§4.1) → Task 3. `recomputeLoadout` contrainte 2 mains + `hand` (§4.2) → Task 4.
- Migration loadout par défaut (§7) → Task 5.
- `offHandPenalty` câblé attaque (§4.4) → Task 6. Parade + exception Parade/Défensive (§4.4) → Task 7.
- Invariant compat (sans loadout = legacy, tests intacts) : Tasks 4/6/7 le préservent (hand `main`/undefined).
- HORS de ce plan (plans suivants) : constructeur UI (#2), choix d'arme attaque/parade + switch + verrou équipement
  (#3), Maniement de deux armes + hook `attackModes`/`onWonDefense` (#4). Aucun placeholder laissé pour eux ici.
