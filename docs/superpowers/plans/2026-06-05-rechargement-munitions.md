# Rechargement & munitions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Munitions = équipement (`kind 'ammo'`, `subType`/`qty`) avec choix du joueur ; le tir combine arme + munition (Dégâts + Atouts, ex. Empaleuse de la Flèche) ; rechargement via le défaut « Recharge N » = **Test étendu de Projectiles** (état chargé/déchargé, action Recharger **par modale** — cumul de DR jusqu'à l'Indice). **Héros uniquement** — les ennemis restent abstraits (tirent librement).

**Architecture :** helpers purs dans `items.ts` (`weaponWithAmmo`, `compatibleAmmo`, parse `subType`/`qty`/`reload`) ; le store centralise la combinaison arme+munition dans `firedWeapon`, gate le tir sur chargé+munition, consomme à l'application, et expose un flux de rechargement **par modale** (`pendingReload` : `battleReload`/`reloadRoll`/`reloadReroll`/`reloadBonusSL`/`reloadConfirm`/`reloadCancel`) + `battleSelectAmmo` ; UI dans `ActionBar` (slot Recharger qui ouvre la modale + sous‑liste munitions) + `ReloadModal`.

**Tech Stack :** Vite + TS + React, Zustand, Vitest. Données : `src/data/trappings.json` (armes : qualité « Recharge N » ; munitions : `type 'ammunition'`, `subType`, préfixe `(N)`).

**Décision de périmètre (affinée vs spec) :** munitions + rechargement s'appliquent aux **héros** ; les **ennemis** tirent librement (gear abstrait) → aucune régression sur le tir ennemi existant, pas de spawn de munitions ni d'IA de rechargement.

**Commandes :** `npx vitest run <fichier>` ; `npm test` + `npm run typecheck`.

---

## Task 1 : Types

**Files:**
- Modify: `src/engine/types.ts`

- [ ] **Step 1 : `ItemInstance`** — après `desc?: string | null;` :
```ts
  /** Munition : famille compatible (Arc/Arbalète/Poudre noire) — correspond à `Weapon.subType`. */
  subType?: string;
  /** Quantité (paquet de munitions, ex. « (12) » → 12). */
  qty?: number;
```

- [ ] **Step 2 : `Weapon`** — après `qualities: string[];` :
```ts
  /** Famille d'arme (pour la compatibilité des munitions). */
  subType?: string;
  /** Rechargement : nombre d'Actions pour recharger (0 = aucun, tire chaque Round). */
  reload?: number;
```

- [ ] **Step 3 : `Combatant`** — après `outOfRencontre?: boolean;` :
```ts
  /** Munition sélectionnée pour l'arme à distance (uid d'un ItemInstance `kind 'ammo'`). */
  ammoUid?: string;
  /** Arme à distance chargée ? (Arc : toujours ; Recharge N : faux après un tir). */
  loaded?: boolean;
  /** DR cumulés du Test étendu de Projectiles vers `Weapon.reload` (Indice DR), pas un compteur d'Actions. */
  reloadProgress?: number;
```

- [ ] **Step 4 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/engine/types.ts
git commit -m "feat(combat): champs munitions/rechargement (ItemInstance subType/qty, Weapon subType/reload, Combatant ammo/loaded)"
```

---

## Task 2 : `items.ts` — parse, `weaponWithAmmo`, `compatibleAmmo`, `reload`

**Files:**
- Modify: `src/engine/items.ts`
- Test: `src/engine/items.test.ts` (ajouts)

- [ ] **Step 1 : Écrire les tests (échec attendu)** — ajouter à `src/engine/items.test.ts` :
```ts
import { itemFromTrapping, weaponWithAmmo, compatibleAmmo, recomputeLoadout } from './items';
import type { Combatant, Weapon } from './types';

describe('Munitions & rechargement', () => {
  it('itemFromTrapping lit subType + qty (préfixe) pour une munition', () => {
    const fleche = itemFromTrapping('Flèche')!;
    expect(fleche.kind).toBe('ammo');
    expect(fleche.subType).toBe('Arc');
    expect(fleche.qty).toBe(12);
    expect(fleche.qualities).toContain('Empaleuse');
  });
  it('weaponWithAmmo combine Dégâts (somme) et fusionne les Atouts', () => {
    const arc: Weapon = { name: 'Arc', type: 'ranged', damage: '+9', range: 60, qualities: [], subType: 'Arc', reload: 0 };
    const fleche = itemFromTrapping('Flèche')!;
    const w = weaponWithAmmo(arc, fleche);
    expect(w.qualities).toContain('Empaleuse');
    // Dégâts concaténés : parseWeaponDamage somme — ici pas de modif de la Flèche, reste +9.
    expect(w.damage).toBe('+9');
  });
  it('compatibleAmmo filtre par subType et qty>0', () => {
    const c = { items: [itemFromTrapping('Flèche'), itemFromTrapping('Carreau')] } as unknown as Combatant;
    const arc: Weapon = { name: 'Arc', type: 'ranged', damage: '+9', qualities: [], subType: 'Arc', reload: 0 };
    const list = compatibleAmmo(c, arc);
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Flèche');
  });
  it('recomputeLoadout dérive reload depuis « Recharge N »', () => {
    const c = {
      items: [{ ...itemFromTrapping('Tromblon')!, equipped: true }],
      weapons: [], armour: emptyArmour(),
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    } as unknown as Combatant;
    recomputeLoadout(c);
    const tromblon = c.weapons.find((w) => w.name === 'Tromblon')!;
    expect(tromblon.reload).toBe(2);
    expect(tromblon.subType).toBe('Poudre noire');
  });
});
```
(importer `emptyArmour` depuis `./items` dans ce fichier de test s'il ne l'est pas déjà.)

- [ ] **Step 2 : Lancer → échec** (`weaponWithAmmo`/`compatibleAmmo` manquants, subType/qty/reload non dérivés).

Run: `npx vitest run src/engine/items.test.ts`
Expected: FAIL.

- [ ] **Step 3 : `itemFromTrapping` — parser subType + qty.** Remplacer le `return { … }` final par une version qui ajoute `subType`/`qty` :
```ts
  const qtyMatch = (t.prefix ?? '').match(/\((\d+)\)/); // « (12) » → 12
  return {
    uid: newUid(),
    name: t.label,
    kind,
    damage: t.damage ?? undefined,
    reach: t.reach,
    range: kind === 'ranged' ? Number(t.reach) || null : null,
    qualities: t.qualities ?? [],
    pa: t.pa ?? undefined,
    locs: locs && locs.length ? locs : undefined,
    enc: t.enc ?? 0,
    equipped: false,
    desc: t.desc,
    subType: t.subType ?? undefined,
    qty: kind === 'ammo' ? (qtyMatch ? parseInt(qtyMatch[1], 10) : 1) : undefined,
  };
```
> Vérifier que le type du trapping (`findTrapping`) expose `prefix` et `subType` ; ils existent dans `trappings.json`. Si le type TS ne les déclare pas, les ajouter à l'interface du trapping (data) ou caster `(t as any).prefix`/`(t as any).subType`.

- [ ] **Step 4 : `recomputeLoadout` — dériver `subType` + `reload`.** Dans la boucle qui construit `weapons`, remplacer le `push` :
```ts
    if (it.kind === 'melee' || it.kind === 'ranged') {
      const reloadQ = it.qualities.find((q) => /^recharge/i.test(q)); // « Recharge 2 »
      const reload = reloadQ ? parseInt(reloadQ.match(/\d+/)?.[0] ?? '0', 10) : 0;
      weapons.push({ name: it.name, type: it.kind, damage: it.damage ?? '+BF', reach: it.reach, range: it.range, qualities: it.qualities, subType: it.subType, reload });
    }
```

- [ ] **Step 5 : Ajouter `weaponWithAmmo` + `compatibleAmmo`** (à la fin de `items.ts`) :
```ts
/** Munitions de l'inventaire compatibles avec une arme à distance (même famille, qty>0). */
export function compatibleAmmo(c: Combatant, weapon: Weapon): ItemInstance[] {
  if (weapon.type !== 'ranged') return [];
  return (c.items ?? []).filter((i) => i.kind === 'ammo' && (i.qty ?? 0) > 0 && i.subType === weapon.subType);
}

/** Arme à distance « augmentée » par la munition tirée : Dégâts combinés (concaténés — parseWeaponDamage
 *  somme les nombres) et Atouts fusionnés (ex. Empaleuse de la Flèche). */
export function weaponWithAmmo(weapon: Weapon, ammo: ItemInstance): Weapon {
  const extra = ammo.damage ?? '';
  const qualities = [...weapon.qualities];
  for (const q of ammo.qualities) if (!qualities.includes(q)) qualities.push(q);
  return { ...weapon, damage: `${weapon.damage}${extra}`, qualities };
}
```

- [ ] **Step 6 : Lancer → succès.**

Run: `npx vitest run src/engine/items.test.ts`
Expected: PASS.

- [ ] **Step 7 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/engine/items.ts src/engine/items.test.ts
git commit -m "feat(combat): items — parse munition (subType/qty), reload depuis « Recharge N », weaponWithAmmo/compatibleAmmo"
```

---

## Task 3 : Store — tir avec munition (gate+combine+consume) + rechargement par MODALE (Test étendu de Projectiles) + sélection (héros)

> **Corrigé 2026-06-05 :** recharger n'est PAS « N Actions silencieuses » mais un **Test étendu de Projectiles** (`63 - Armures.md` l.28-29 + `12 - Tests.md` l.199-211) → **un jet → une modale** (`pendingReload`). `reloadProgress` = DR cumulés.

**Files:**
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)** — ajouter un `describe` à `store.test.ts` :
```ts
describe('Munitions & rechargement (héros, LDB Armes/Tests)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function archer() {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    H.weapons = [{ name: 'Arbalète', type: 'ranged', damage: '+9', range: 60, qualities: ['Recharge 1'], subType: 'Arbalète', reload: 1 }];
    H.items = [{ uid: 'am1', name: 'Carreau', kind: 'ammo', qualities: ['Empaleuse'], enc: 0, equipped: false, subType: 'Arbalète', qty: 2 } as ItemInstance];
    H.loaded = true;
    H.pos = { x: 0, y: 0 };
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0'; E.name = 'Cible'; E.kind = 'enemy'; E.pos = { x: 4, y: 0 }; E.items = []; E.weapons = [{ name: 'Mains nues', type: 'melee', damage: '+BF', qualities: [] }];
    const battle: BattleState = {
      combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: 'attack', selectedSpell: null,
      reachable: new Map(), moved: true, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8), pendingReload: null, pendingAttack: null });
    return { H, E };
  }

  it('tirer consomme 1 munition et décharge une arme à Recharge', () => {
    const { H, E } = archer();
    useGame.getState().seedRng(2);
    useGame.getState().battleClickEntity(E.id); // ouvre la modale d'attaque (chargé + munition OK)
    expect(useGame.getState().pendingAttack).not.toBeNull();
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.items ?? []).find((i) => i.uid === 'am1')!.qty).toBe(1); // 2 → 1
    expect(h.loaded).toBe(false); // Recharge 1 → déchargé
  });

  it('arme déchargée : tir refusé (modale non ouverte)', () => {
    const { H, E } = archer();
    H.loaded = false;
    useGame.getState().battleClickEntity(E.id);
    expect(useGame.getState().pendingAttack).toBeNull();
  });

  it('battleReload OUVRE la modale (Test de Projectiles, Action pas encore consommée)', () => {
    const { H } = archer();
    H.loaded = false; H.reloadProgress = 0;
    useGame.getState().battleReload();
    const pr = useGame.getState().pendingReload;
    expect(pr).not.toBeNull();
    expect(pr!.reload).toBe(1);        // Indice DR
    expect(pr!.roll).toBeNull();       // pas encore lancé
    expect(useGame.getState().battle!.acted).toBe(false); // l'Action n'est consommée qu'à Appliquer
  });

  it('reloadRoll + reloadConfirm : cumule le DR (Test étendu), recharge à ≥ Indice, consomme l’Action', () => {
    const { H } = archer();
    H.loaded = false; H.reloadProgress = 0;
    useGame.getState().seedRng(2);
    useGame.getState().battleReload();
    useGame.getState().reloadRoll();
    const pr = useGame.getState().pendingReload!;
    expect(pr.roll).not.toBeNull();
    const expected = Math.max(0, 0 + pr.sl); // formule du Test étendu (clamp à 0)
    useGame.getState().reloadConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    if (expected >= 1) { expect(h.loaded).toBe(true); expect(h.reloadProgress).toBe(0); }
    else { expect(h.loaded).toBe(false); expect(h.reloadProgress).toBe(expected); }
    expect(useGame.getState().battle!.acted).toBe(true);
    expect(useGame.getState().pendingReload).toBeNull();
  });

  it('reloadConfirm : un DR insuffisant (Recharge 2) laisse l’arme déchargée et garde le progrès', () => {
    const { H } = archer();
    H.weapons = [{ name: 'Arbalète lourde', type: 'ranged', damage: '+9', range: 100, qualities: ['Recharge 2'], subType: 'Arbalète', reload: 2 }];
    H.loaded = false; H.reloadProgress = 0;
    useGame.getState().seedRng(2);
    useGame.getState().battleReload();
    useGame.getState().reloadRoll();
    const pr = useGame.getState().pendingReload!;
    const expected = Math.max(0, 0 + pr.sl);
    useGame.getState().reloadConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.reloadProgress).toBe(Math.min(expected, 2) >= 2 ? 0 : expected);
    expect(h.loaded).toBe(expected >= 2);
  });

  it('battleReload refusé si l’Action est déjà consommée', () => {
    const { H } = archer();
    H.loaded = false;
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    useGame.getState().battleReload();
    expect(useGame.getState().pendingReload).toBeNull();
  });

  it('plus de munitions : tir refusé', () => {
    const { H, E } = archer();
    (H.items![0] as ItemInstance).qty = 0;
    useGame.getState().battleClickEntity(E.id);
    expect(useGame.getState().pendingAttack).toBeNull();
  });

  it('battleSelectAmmo change la munition utilisée', () => {
    const { H } = archer();
    H.items!.push({ uid: 'am2', name: 'Carreau perçant', kind: 'ammo', qualities: ['Perforante'], enc: 0, equipped: false, subType: 'Arbalète', qty: 3 } as ItemInstance);
    useGame.getState().battleSelectAmmo('am2');
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.ammoUid).toBe('am2');
  });
});
```

- [ ] **Step 2 : Lancer → échec** (`pendingReload`/`battleReload`/`reloadRoll`/`reloadConfirm`/`battleSelectAmmo` manquants, pas de gate ammo).

Run: `npx vitest run src/state/store.test.ts` — Expected: FAIL.

- [ ] **Step 3 : Imports + types + déclarations.**
  - Import `../engine/items` : ajouter `weaponWithAmmo, compatibleAmmo`. (`rollTest`, `canReroll`, `Difficulty` déjà importés.)
  - Interface `PendingReload` (près de `PendingTest`) :
```ts
export interface PendingReload {
  actorId: string;
  actorName: string;
  weaponName: string;
  reload: number;          // Indice DR cible
  progressBefore: number;  // DR déjà cumulés (Test étendu)
  skillValue: number;      // combatValue(active,'ranged')
  difficulty: Difficulty;  // 'intermediaire' (canon silencieux)
  roll: number | null;     // null tant que pas lancé
  target: number;          // cible effective (pour Chance)
  sl: number;              // DR du jet
  success: boolean;
  rerolled?: boolean;
}
```
  - `GameState` : `pendingReload: PendingReload | null;` + déclarations `battleReload/reloadRoll/reloadReroll/reloadBonusSL/reloadConfirm/reloadCancel/battleSelectAmmo`. Init `pendingReload: null` dans l'état + dans tous les resets (`reset`, `startCombat`, `startScene`…).
  - Étendre l'union `BattleState.action` et `battleSelectAction` avec `| 'ammo'`.

- [ ] **Step 4 : Helpers module `selectedAmmo` + `firedWeapon`** (près de `resolveAttack`) :
```ts
function selectedAmmo(attacker: Combatant, weapon: Weapon): ItemInstance | undefined {
  const compat = compatibleAmmo(attacker, weapon);
  return compat.find((a) => a.uid === attacker.ammoUid) ?? compat[0];
}
/** Arme effectivement tirée : mêlée au contact / distance sinon, AUGMENTÉE de la munition pour un héros. */
function firedWeapon(attacker: Combatant, target: Combatant): Weapon {
  const adj = chebyshev(attacker.pos!, target.pos!) <= 1;
  const w = attackWeapon(attacker.weapons, adj);
  if (w.type === 'ranged' && attacker.kind === 'hero') {
    const ammo = selectedAmmo(attacker, w);
    if (ammo) return weaponWithAmmo(w, ammo);
  }
  return w;
}
```

- [ ] **Step 5 : `resolveAttack` utilise `firedWeapon`** (centralise la combinaison) :
```ts
function resolveAttack(attacker, target, location) {
  const adj = chebyshev(attacker.pos!, target.pos!) <= 1;
  const weapon = firedWeapon(attacker, target);
  if (!adj && weapon.type === 'melee') return null;
  const res = weapon.type === 'ranged'
    ? resolveRanged(attacker, target, weapon, battleRng, chebyshev(attacker.pos!, target.pos!), location)
    : resolveMelee(attacker, target, weapon, battleRng, { defense: bestDefenseMode(target), location });
  return { res, weapon };
}
```

- [ ] **Step 6 : `attackBonusSL` + `attackConfirm` utilisent `firedWeapon`** (sinon l'arme tirée ≠ `weapons[0]` casse Empaleuse + consommation) :
  - `attackBonusSL` : remplacer `const weapon = attackWeapon(attacker.weapons, adj);` par `const weapon = firedWeapon(attacker, target);`.
  - `attackConfirm` : remplacer `attacker.weapons[0]` par `firedWeapon(attacker, target)`.

- [ ] **Step 7 : Gate du tir dans `battleClickEntity`** (branche `'attack'` ranged héros, après la vérif de portée de mêlée, avant `set({ pendingAttack })`) :
```ts
    const adj = chebyshev(active.pos!, target.pos!) <= 1;
    const w = attackWeapon(active.weapons, adj);
    if (w.type === 'ranged' && active.kind === 'hero') {
      if (!active.loaded) { get().log(`${active.name} doit recharger ${w.name}.`); return; }
      if (!selectedAmmo(active, w)) { get().log(`${active.name} n'a plus de munitions pour ${w.name}.`); return; }
    }
```

- [ ] **Step 8 : Consommation + interruption dans `applyAttackResult`.** Après le bloc Dégâts/critique :
```ts
  // Munition héros : consommée à l'application ; arme à Recharge → déchargée (Test étendu requis pour recharger).
  if (weapon.type === 'ranged' && attacker.kind === 'hero') {
    const used = selectedAmmo(attacker, weapon);
    if (used && (used.qty ?? 0) > 0) {
      used.qty = (used.qty ?? 0) - 1;
      if (used.qty <= 0) attacker.items = (attacker.items ?? []).filter((i) => i.uid !== used.uid);
    }
    if ((weapon.reload ?? 0) > 0) { attacker.loaded = false; attacker.reloadProgress = 0; }
  }
  // Interruption (63-Armures l.29) : un héros touché en plein rechargement recommence à zéro.
  if (res.hit && res.woundsLost && target.kind === 'hero' && (target.reloadProgress ?? 0) > 0) target.reloadProgress = 0;
```
(`weapon` passé est désormais l'arme augmentée — porte `reload`/`subType`.)

- [ ] **Step 9 : `battleReload` (modale) + `reloadRoll/Reroll/BonusSL/Confirm/Cancel` + `battleSelectAmmo`** (près de `battleDefendTotal`) :
```ts
  battleReload: () => {
    const { battle } = get();
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !canTakeAction(active)) return;
    const w = active.weapons.find((x) => x.type === 'ranged');
    if (!w || (w.reload ?? 0) <= 0 || active.loaded) return; // rien à recharger
    const skillValue = combatValue(active, 'ranged');
    set({ pendingReload: {
      actorId: active.id, actorName: active.name, weaponName: w.name,
      reload: w.reload ?? 0, progressBefore: active.reloadProgress ?? 0,
      skillValue, difficulty: 'intermediaire', roll: null,
      target: skillValue + DIFFICULTY_MODIFIERS.intermediaire, sl: 0, success: false,
    } });
  },
  reloadRoll: () => {
    const pr = get().pendingReload;
    if (!pr || pr.roll != null) return;
    const res = rollTest(pr.skillValue, pr.difficulty, battleRng);
    set({ pendingReload: { ...pr, roll: res.roll, target: res.target, sl: res.sl, success: res.success } });
  },
  reloadReroll: () => {
    const { battle, pendingReload: pr } = get();
    if (!battle || !pr || pr.roll == null) return;
    if (!canReroll(pr.roll > pr.target, !!pr.rerolled)) return;
    const a = activeCombatant(battle);
    if (!a || (a.fortune ?? 0) <= 0) return;
    a.fortune = (a.fortune ?? 0) - 1;
    const res = rollTest(pr.skillValue, pr.difficulty, battleRng);
    set({ pendingReload: { ...pr, roll: res.roll, target: res.target, sl: res.sl, success: res.success, rerolled: true }, battle: { ...battle } });
  },
  reloadBonusSL: () => {
    const { battle, pendingReload: pr } = get();
    if (!battle || !pr || pr.roll == null) return;
    const a = activeCombatant(battle);
    if (!a || (a.fortune ?? 0) <= 0) return;
    a.fortune = (a.fortune ?? 0) - 1;
    set({ pendingReload: { ...pr, sl: pr.sl + 1 }, battle: { ...battle } });
  },
  reloadConfirm: () => {
    const { battle, pendingReload: pr } = get();
    if (!battle || !pr || pr.roll == null) return;
    const a = activeCombatant(battle);
    set({ pendingReload: null });
    if (!a) return;
    let progress = Math.max(0, pr.progressBefore + pr.sl); // Test étendu : cumul, plancher 0 (recommence)
    let log: string;
    if (progress >= pr.reload) { a.loaded = true; a.reloadProgress = 0; log = `${a.name} a rechargé ${pr.weaponName}.`; }
    else { a.reloadProgress = progress; log = `${a.name} recharge ${pr.weaponName} (${progress}/${pr.reload} DR).`; }
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, log] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  reloadCancel: () => set({ pendingReload: null }), // avant le jet : aucun coût
  battleSelectAmmo: (uid) => {
    const { battle } = get();
    if (!battle) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    active.ammoUid = uid;
    set({ battle: { ...battle } });
    bus.emit(EVT.SCENE_DIRTY);
  },
```

- [ ] **Step 10 : Init au début du combat (`startCombat`).** Remplacer le `party.map((h, i) => ({ … }))` par une forme qui initialise chargé + munition :
```ts
    const heroes = party.map((h, i) => {
      const c = { ...JSON.parse(JSON.stringify(h)), pos: { x: Math.max(0, partyPos.x - 1), y: Math.min(scene.dimensions.h - 1, partyPos.y + i) }, advantage: 0, conditions: [], engagedWith: [], meleeThisRound: [], wounds: { ...h.wounds } } as Combatant;
      const rw = c.weapons.find((w) => w.type === 'ranged');
      c.loaded = true; c.reloadProgress = 0;
      if (rw) c.ammoUid = compatibleAmmo(c, rw)[0]?.uid;
      return c;
    }) as Combatant[];
```

- [ ] **Step 11 : Lancer → succès + régression.**

Run: `npx vitest run src/state/store.test.ts` puis `npm test`.
Expected: PASS. Vérifier que le tir **ennemi** existant (embuscade tromblon) reste inchangé (gate/consommation = héros uniquement).

- [ ] **Step 12 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(combat): tir héros munition (arme+munition) + Recharger = Test étendu de Projectiles (modale) + sélection ; init au combat"
```

---

## Task 4 : UI — slot Recharger (ouvre la modale) + `ReloadModal` + sous‑liste munitions

**Files:**
- Modify: `src/ui/ActionBar.tsx`, `src/ui/CampaignView.tsx`
- Create: `src/ui/ReloadModal.tsx`

- [ ] **Step 1 : `ReloadModal.tsx`** (calqué sur `TestModal`/`RollModal`, fortune lue depuis `battle.combatants`) :
```tsx
import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';

/** Rechargement = Test étendu de Projectiles (LDB 63-Armures l.28-29) : Lancer → DR → Chance → Appliquer. */
export function ReloadModal() {
  const pr = useGame((s) => s.pendingReload);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.reloadRoll);
  const reroll = useGame((s) => s.reloadReroll);
  const bonusSL = useGame((s) => s.reloadBonusSL);
  const confirm = useGame((s) => s.reloadConfirm);
  const cancel = useGame((s) => s.reloadCancel);
  if (!pr || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === pr.actorId);
  const fortune = actor?.fortune ?? 0;
  const rolled = pr.roll != null;
  const rerollable = rolled && pr.roll != null && canReroll(pr.roll > pr.target, !!pr.rerolled);
  const after = Math.max(0, pr.progressBefore + pr.sl);
  const done = after >= pr.reload;
  return (
    <div className="modal-overlay">
      <div className="modal test-modal">
        <h3>Recharger — {pr.weaponName}</h3>
        <p className="test-actor"><strong>{pr.actorName}</strong> — Projectiles, cible {pr.target} · {pr.progressBefore}/{pr.reload} DR</p>
        {!rolled ? (
          <div className="modal-actions">
            <button className="btn" onClick={cancel}>Annuler</button>
            <button className="btn btn-primary" onClick={roll}>🎲 Lancer</button>
          </div>
        ) : (
          <>
            <div className={`test-result ${pr.success ? 'ok' : 'fail'}`}>
              <span className="dice">{pr.roll === 100 ? '00' : String(pr.roll).padStart(2, '0')}</span>
              <span className="vs">/ {pr.target}</span>
              <span className="verdict">{pr.success ? 'Réussite' : 'Échec'} ({pr.sl >= 0 ? '+' : ''}{pr.sl} DR) → {done ? 'rechargé ✓' : `${after}/${pr.reload} DR`}</span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <button className="btn btn-primary" onClick={confirm}>Appliquer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Monter la modale** dans `CampaignView.tsx` (import + `<ReloadModal />` à côté de `<RollModal />`).

- [ ] **Step 3 : ActionBar — hooks + données.**
```ts
  const reload = useGame((s) => s.battleReload);
  const selectAmmo = useGame((s) => s.battleSelectAmmo);
```
`import { compatibleAmmo } from '../engine/items';`. Après `groundItems` (héros) :
```ts
  const rangedW = isHero ? active.weapons.find((w) => w.type === 'ranged') : undefined;
  const needsReload = !!rangedW && (rangedW.reload ?? 0) > 0 && !active.loaded;
  const ammoChoices = isHero && rangedW ? compatibleAmmo(active, rangedW) : [];
```

- [ ] **Step 4 : Sous‑liste munitions (mode `'ammo'`)** — après la sous‑liste `pickup` :
```tsx
      {ammoChoices.length > 0 && battle.action === 'ammo' && (
        <div className="ab-spells">
          {ammoChoices.map((a) => (
            <div key={a.uid} className="ab-spell-row">
              <button className={`btn btn-sm ${active.ammoUid === a.uid ? 'btn-primary' : ''}`} onClick={() => selectAmmo(a.uid)} title={(a.qualities ?? []).join(', ')}>
                🏹 {a.name} ×{a.qty}
              </button>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 5 : Slots hotbar** — avant « Fin du tour », ajouter Recharger (ouvre la modale) + Munition :
```tsx
            {needsReload && (
              <button className="ab-slot" disabled={battle.acted || stunned} onClick={reload} title="Recharger l'arme à distance (Test étendu de Projectiles — coûte l'Action)">
                <span className="ab-ico">🔄</span>
                <span className="ab-lbl">Recharger{active.reloadProgress ? ` (${active.reloadProgress}/${rangedW!.reload} DR)` : ''}</span>
              </button>
            )}
            {ammoChoices.length > 1 && (
              <button className={`ab-slot ${battle.action === 'ammo' ? 'on' : ''}`} onClick={() => selectAction(battle.action === 'ammo' ? null : 'ammo')} title="Choisir la munition à tirer">
                <span className="ab-ico">🏹</span>
                <span className="ab-lbl">Munition</span>
              </button>
            )}
```

- [ ] **Step 6 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/ui/ActionBar.tsx src/ui/ReloadModal.tsx src/ui/CampaignView.tsx
git commit -m "feat(ui): hotbar Recharger → modale de Test de Projectiles (ReloadModal) + sélecteur de munition (héros)"
```

---

## Task 5 : ROADMAP + vérification finale

- [ ] **Step 1 :** `npm test` (vert), `npm run typecheck` (0 erreur), `npm run build` (OK).
- [ ] **Step 2 : ROADMAP** — « Combat — reste » / Jalon 1 : marquer **rechargement + munitions ✅** (héros : munitions = équipement avec choix, tir = arme+munition, Recharge N) ; restes : ligne de vue / couvert, Maladresses, munitions ennemies/achat/récupération (Jalon 5).
- [ ] **Step 3 : Commit** `docs(roadmap): rechargement & munitions (héros) livrés`.
- [ ] **Step 4 : Recette navigateur (MANUELLE — utilisateur)** : équiper une arbalète + carreaux, tirer (consomme 1, décharge), Recharger, re‑tirer ; changer de munition via le sélecteur (Atouts du tir varient) ; arme vide → tir refusé.

---

## Auto-revue du plan (effectuée + révision 2026-06-05)

- **Correction majeure (feedback utilisateur) :** recharger demande **un jet** → le plan initial (« N Actions silencieuses ») était faux. Sourcé : `63 - Armures.md` l.28-29 (*Recharge (Indice)* = **Test étendu de Projectiles**, cumul de **Indice DR**, interruption → recommence) + `12 - Tests.md` l.199-211 (cumul DR, plancher 0). Invariante projet : **si y'a un jet, y'a la modale** → flux `pendingReload` complet (Lancer→DR→Chance→Appliquer) + `ReloadModal`.
- **Couverture spec :** types (Task 1) · parse subType/qty + reload + weaponWithAmmo/compatibleAmmo (Task 2) · tir héros (combine via `firedWeapon`+gate+consume) + rechargement modale (Task 3) · UI + ReloadModal (Task 4) · ROADMAP (Task 5). ✓
- **Décalage assumé vs spec :** munitions/rechargement = **héros uniquement** (ennemis abstraits, tirent librement) — zéro régression sur le tir ennemi.
- **Bug latent corrigé :** `attackConfirm`/`attackBonusSL` passaient `attacker.weapons[0]` (≠ arme tirée si la distance n'est pas en `[0]`) → la consommation de munition et l'Empaleuse échouaient. `firedWeapon(attacker, target)` centralise la sélection+augmentation et est utilisé par `resolveAttack`, `attackBonusSL`, `attackConfirm`.
- **Risque :** modif de `resolveAttack`/`applyAttackResult` (chemin commun héros+ennemi) — gate `attacker.kind === 'hero'` partout ; régression `npm test` à la Task 3 Step 11.
