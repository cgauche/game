# Plan C — Dégâts d'arme (Implementation Plan)

> REQUIRED SUB-SKILL: superpowers:executing-plans. Steps en checkbox `- [ ]`.

**Goal:** Modéliser les Dégâts d'arme (LDB `62-Les armes` l.177-180) : chaque point reçu réduit les Dégâts de l'arme de 1 ; à +0 (BF+0) l'arme devient improvisée ; l'Atout **Incassable** (l.310) exempte ; une arme détruite (Incident de Tir, Plan D) est inutilisable.

**Architecture :** Module pur `engine/weaponDamage.ts` (réduction des Dégâts, seuil improvisé, `damageWeapon`/`destroyWeapon` respectant Incassable). `combat.ts` lit les Dégâts effectifs ; `recomputeLoadout` propage `ItemInstance.damageTaken/destroyed` → `Weapon`. Producteurs (Oups! 21-40, Incident de Tir) = Plan D. Persistance du `damageTaken` d'`ItemInstance` = Plan A (déjà : clone JSON au spawn ; writeback non requis car l'objet vit dans `items`).

**Décisions :** « Atouts ignorés quand improvisée » et « arme détruite non sélectionnable en plein combat » sont journalisés/délégués à D (multi-sites de qualités ; sélection d'arme) — C livre le cœur : réduction des Dégâts + seuil improvisé + helpers + propagation loadout.

---

## Task C1 : Module `engine/weaponDamage.ts` + champs types

**Files:** Modify `src/engine/types.ts` (Weapon + ItemInstance) ; Create `src/engine/weaponDamage.ts` ; Test `src/engine/weaponDamage.test.ts`.

- [ ] **Step 1 : test** — `src/engine/weaponDamage.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { effectiveWeaponDamage, isImprovised, damageWeapon, destroyWeapon } from './weaponDamage';
import type { Weapon } from './types';

const sword = (over: Partial<Weapon> = {}): Weapon => ({ name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [], ...over });
const bow = (over: Partial<Weapon> = {}): Weapon => ({ name: 'Arc', type: 'ranged', damage: '+9', qualities: [], range: 30, ...over });

describe('effectiveWeaponDamage (LDB 62 l.178)', () => {
  it('réduit les Dégâts de damageTaken', () => {
    expect(effectiveWeaponDamage(sword({ damageTaken: 2 }), 3)).toBe(5); // BF3 + (4-2)
    expect(effectiveWeaponDamage(bow({ damageTaken: 3 }), 3)).toBe(6);   // 9-3, pas de BF
  });
  it('plancher +0 (BF+0) → improvisée, ne descend pas sous BF', () => {
    expect(effectiveWeaponDamage(sword({ damageTaken: 9 }), 3)).toBe(3); // BF+0
    expect(isImprovised(sword({ damageTaken: 4 }))).toBe(true);
    expect(isImprovised(sword({ damageTaken: 3 }))).toBe(false);
    expect(isImprovised(bow({ damageTaken: 9 }))).toBe(true);
  });
  it("préserve une arme non endommagée (mains nues +BF-2 inchangées)", () => {
    const fists: Weapon = { name: 'Mains nues', type: 'melee', damage: '+BF-2', qualities: [] };
    expect(effectiveWeaponDamage(fists, 3)).toBe(1); // 3 - 2
  });
});

describe('damageWeapon / destroyWeapon', () => {
  it('incrémente damageTaken', () => { const w = sword(); damageWeapon(w); expect(w.damageTaken).toBe(1); });
  it('Incassable exempte des dégâts ET de la destruction', () => {
    const w = sword({ qualities: ['Incassable'] });
    damageWeapon(w); expect(w.damageTaken ?? 0).toBe(0);
    destroyWeapon(w); expect(w.destroyed).toBeFalsy();
  });
  it('destroyWeapon marque détruite', () => { const w = bow(); destroyWeapon(w); expect(w.destroyed).toBe(true); });
});
```

- [ ] **Step 2 : run** — `npm test -- src/engine/weaponDamage.test.ts` → FAIL (module absent).

- [ ] **Step 3 : implémenter**

`src/engine/types.ts` — ajouter à `Weapon` (après `reload?`) et à `ItemInstance` (après `qty?`) :

```ts
  /** Dégâts subis par l'arme (LDB 62 l.178) : réduit les Dégâts de 1/point ; à +0 → improvisée. */
  damageTaken?: number;
  /** Arme détruite (Incident de Tir, LDB 14) : inutilisable. */
  destroyed?: boolean;
```

Créer `src/engine/weaponDamage.ts` :

```ts
/**
 * Dégâts d'arme — Livre de base, « Les armes » (62-Les armes.md l.177-180). Chaque point de Dégât
 * reçu réduit les Dégâts de l'arme de 1 ; à +0 (ou BF +0) l'arme est improvisée. L'Atout Incassable
 * (l.310) exempte de tout dégât/corrosion/destruction. Réparation = hors combat (Jalon 5).
 */
import { Weapon } from './types';

function isUnbreakable(w: Weapon): boolean {
  return w.qualities.some((q) => /incassable/i.test(q));
}

/** Composante fixe (signée) des Dégâts, hors BF. Ex. '+BF+4' → 4, '+9' → 9, '+BF-2' → -2. */
function flatDamage(damage: string): number {
  const rest = (damage ?? '').replace(/BF/gi, '');
  return (rest.match(/[+-]?\d+/g) ?? []).reduce((s, n) => s + parseInt(n, 10), 0);
}

/** Dégâts d'arme effectifs après réduction par `damageTaken` (la composante fixe positive est
 *  réduite, plancher 0 → BF+0 improvisée ; une composante négative — mains nues — est préservée). */
export function effectiveWeaponDamage(w: Weapon, strengthBonus: number): number {
  const usesBF = /BF/i.test(w.damage ?? '');
  const flat = flatDamage(w.damage ?? '');
  const dt = w.damageTaken ?? 0;
  const reduced = flat >= 0 ? Math.max(0, flat - dt) : flat;
  return Math.max(0, (usesBF ? strengthBonus : 0) + reduced);
}

/** L'arme est-elle réduite à l'état improvisé (bonus de Dégâts à +0 par usure) ? */
export function isImprovised(w: Weapon): boolean {
  const flat = flatDamage(w.damage ?? '');
  return flat >= 0 && flat - (w.damageTaken ?? 0) <= 0;
}

/** Inflige 1 point de Dégât à l'arme (sauf Incassable). */
export function damageWeapon(w: Weapon): void {
  if (isUnbreakable(w)) return;
  w.damageTaken = (w.damageTaken ?? 0) + 1;
}

/** Détruit l'arme (sauf Incassable) — inutilisable. */
export function destroyWeapon(w: Weapon): void {
  if (isUnbreakable(w)) return;
  w.destroyed = true;
}
```

- [ ] **Step 4 : run** — PASS.
- [ ] **Step 5 : commit**

```bash
git add src/engine/types.ts src/engine/weaponDamage.ts src/engine/weaponDamage.test.ts
git commit -m "feat(engine): degats d'arme -- effectiveWeaponDamage/isImprovised/damageWeapon (pur+teste)" -- src/engine/types.ts src/engine/weaponDamage.ts src/engine/weaponDamage.test.ts
```

---

## Task C2 : Câblage combat + recomputeLoadout

**Files:** Modify `src/engine/combat.ts` (applyHit l.385) ; Modify `src/engine/items.ts` (recomputeLoadout l.90-97) ; Test `src/engine/items.test.ts` (ou weaponDamage.test.ts).

- [ ] **Step 1 : test** — ajouter dans `src/engine/weaponDamage.test.ts` :

```ts
import { recomputeLoadout } from './items';
import type { Combatant } from './types';

function hero(items: Combatant['items']): Combatant {
  return {
    id: 'h', name: 'T', kind: 'hero',
    characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items,
  } as Combatant;
}

describe('recomputeLoadout — propagation des Dégâts d\'arme', () => {
  it('propage damageTaken de l\'ItemInstance vers le Weapon actif', () => {
    const c = hero([{ uid: 'w1', name: 'Épée', kind: 'melee', damage: '+BF+4', qualities: [], enc: 1, equipped: true, damageTaken: 2 }]);
    recomputeLoadout(c);
    const sword = c.weapons.find((w) => w.name === 'Épée');
    expect(sword?.damageTaken).toBe(2);
  });
  it('une arme détruite n\'est pas équipée (repli mains nues)', () => {
    const c = hero([{ uid: 'w1', name: 'Épée', kind: 'melee', damage: '+BF+4', qualities: [], enc: 1, equipped: true, destroyed: true }]);
    recomputeLoadout(c);
    expect(c.weapons.some((w) => w.name === 'Épée')).toBe(false);
    expect(c.weapons.some((w) => w.name === 'Mains nues')).toBe(true);
  });
});
```

- [ ] **Step 2 : run** → FAIL.

- [ ] **Step 3 : implémenter**

`src/engine/combat.ts` — importer puis remplacer l.385 :
```ts
import { effectiveWeaponDamage } from './weaponDamage';
```
```ts
  const weaponDmg = effectiveWeaponDamage(weapon, sb);
```

`src/engine/items.ts` — dans `recomputeLoadout`, boucle des armes :
```ts
    if (it.kind === 'melee' || it.kind === 'ranged') {
      if (it.destroyed) continue; // arme détruite : inutilisable (LDB 14 — Incident de Tir)
      const reloadQ = it.qualities.find((q) => /^recharge/i.test(q));
      const reload = reloadQ ? parseInt(reloadQ.match(/\d+/)?.[0] ?? '0', 10) : 0;
      weapons.push({ name: it.name, type: it.kind, damage: it.damage ?? '+BF', reach: it.reach, range: it.range, qualities: it.qualities, subType: it.subType, reload, damageTaken: it.damageTaken });
    }
```

- [ ] **Step 4 : run** — `npm test -- src/engine/weaponDamage.test.ts` → PASS. Puis `npm test -- src/engine/combat.test.ts` (non-régression).
- [ ] **Step 5 : commit**

```bash
git add src/engine/combat.ts src/engine/items.ts src/engine/weaponDamage.test.ts
git commit -m "feat(engine): combat lit les Degats d'arme effectifs + recomputeLoadout propage damageTaken/destroyed" -- src/engine/combat.ts src/engine/items.ts src/engine/weaponDamage.test.ts
```

---

## Task C3 : Vérification

- [ ] `npm test` → tous verts (hors fichiers session rig). `npm run typecheck` → 0 erreur dans mes fichiers.
