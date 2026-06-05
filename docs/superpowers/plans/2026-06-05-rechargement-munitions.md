# Rechargement & munitions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Munitions = équipement (`kind 'ammo'`, `subType`/`qty`) avec choix du joueur ; le tir combine arme + munition (Dégâts + Atouts, ex. Empaleuse de la Flèche) ; rechargement via la qualité « Recharge N » (état chargé/déchargé + action Recharger). **Héros uniquement** — les ennemis restent abstraits (tirent librement).

**Architecture :** helpers purs dans `items.ts` (`weaponWithAmmo`, `compatibleAmmo`, parse `subType`/`qty`/`reload`) ; le store augmente l'arme avec la munition choisie à la résolution, gate le tir sur chargé+munition, consomme à l'application, et expose `battleReload`/`battleSelectAmmo` ; UI dans `ActionBar` (slot Recharger + sous‑liste munitions).

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
  /** Actions de rechargement déjà accumulées (vers `Weapon.reload`). */
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

## Task 3 : Store — tir avec munition, rechargement, sélection (héros)

**Files:**
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)** — ajouter un `describe` à `store.test.ts` :
```ts
describe('Munitions & rechargement (héros, LDB Armes)', () => {
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
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8) });
    return { H, E };
  }

  it('tirer consomme 1 munition et décharge une arme à Recharge', () => {
    const { H, E } = archer();
    useGame.getState().seedRng(2);
    useGame.getState().battleClickEntity(E.id); // ouvre la modale (chargé + munition OK)
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

  it('battleReload : N Actions pour recharger', () => {
    const { H } = archer();
    H.loaded = false; H.reloadProgress = 0;
    useGame.getState().battleReload();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.loaded).toBe(true); // Recharge 1 → 1 Action suffit
    expect(useGame.getState().battle!.acted).toBe(true);
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

- [ ] **Step 2 : Lancer → échec** (`battleReload`/`battleSelectAmmo` manquants, pas de gate ammo).

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Imports + déclarations.** Ajouter à l'import `../engine/items` (l.52) : `weaponWithAmmo, compatibleAmmo`. Déclarer dans `GameState` (près de `battleSelectAction`) :
```ts
  /** Recharge l'arme à distance du combattant actif (coûte l'Action ; Recharge N). */
  battleReload: () => void;
  /** Sélectionne la munition à tirer (uid d'un item `kind 'ammo'`). */
  battleSelectAmmo: (uid: string) => void;
```
Étendre l'union `BattleState.action` et la signature `battleSelectAction` avec `| 'ammo'` (comme `'resolve'`/`'pickup'`).

- [ ] **Step 4 : Helper module `selectedAmmo` + gate du tir.** Ajouter (près de `resolveAttack`) :
```ts
/** Munition que le héros tirera : celle sélectionnée (ammoUid) si compatible, sinon la 1re compatible. */
function selectedAmmo(attacker: Combatant, weapon: Weapon): ItemInstance | undefined {
  const compat = compatibleAmmo(attacker, weapon);
  return compat.find((a) => a.uid === attacker.ammoUid) ?? compat[0];
}
```
Dans `resolveAttack`, après le choix de `weapon`, augmenter avec la munition pour un **héros** :
```ts
  let fireWeapon = weapon;
  if (weapon.type === 'ranged' && attacker.kind === 'hero') {
    const ammo = selectedAmmo(attacker, weapon);
    if (ammo) fireWeapon = weaponWithAmmo(weapon, ammo);
  }
  const res =
    fireWeapon.type === 'ranged'
      ? resolveRanged(attacker, target, fireWeapon, battleRng, chebyshev(attacker.pos!, target.pos!), location)
      : resolveMelee(attacker, target, fireWeapon, battleRng, { defense: bestDefenseMode(target), location });
  return { res, weapon: fireWeapon };
```
(remplacer l'ancien calcul de `res` + `return`).

- [ ] **Step 5 : Gate dans `battleClickEntity` (tir héros).** Dans la branche `battle.action === 'attack'` ranged, avant `set({ pendingAttack… })`, ajouter le contrôle chargé+munition. Repérer le bloc qui ouvre la modale d'attaque ; juste avant, insérer :
```ts
    const adj = chebyshev(active.pos!, target.pos!) <= 1;
    const w = attackWeapon(active.weapons, adj);
    if (w.type === 'ranged' && active.kind === 'hero') {
      if (!active.loaded) { get().log(`${active.name} doit recharger ${w.name}.`); return; }
      if (!selectedAmmo(active, w)) { get().log(`${active.name} n'a plus de munitions pour ${w.name}.`); return; }
    }
```
(placer après la vérif de portée de mêlée existante.)

- [ ] **Step 6 : Consommation à l'application (`applyAttackResult`).** Après le bloc de Dégâts/critique, ajouter (héros + arme à distance) :
```ts
  if (weapon.type === 'ranged' && attacker.kind === 'hero') {
    const ammo = (attacker.items ?? []).find((i) => i.uid === (selectedAmmoUid(attacker, weapon)));
    if (ammo && (ammo.qty ?? 0) > 0) {
      ammo.qty = (ammo.qty ?? 0) - 1;
      if (ammo.qty <= 0) attacker.items = (attacker.items ?? []).filter((i) => i.uid !== ammo.uid);
    }
    if ((weapon.reload ?? 0) > 0) { attacker.loaded = false; attacker.reloadProgress = 0; } // déchargé après le tir
  }
```
où `selectedAmmoUid(attacker, weapon)` = `selectedAmmo(attacker, weapon)?.uid`. (Définir un mini‑helper ou inliner `selectedAmmo(attacker, weapon)?.uid`.) NB : `weapon` ici est l'arme augmentée (porte `reload`/`subType`).

- [ ] **Step 7 : Implémenter `battleReload` + `battleSelectAmmo`** (dans l'objet store, près de `battleDefendTotal`) :
```ts
  battleReload: () => {
    const { battle } = get();
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !canTakeAction(active)) return;
    const w = active.weapons.find((x) => x.type === 'ranged');
    if (!w || (w.reload ?? 0) <= 0) return; // rien à recharger
    active.reloadProgress = (active.reloadProgress ?? 0) + 1;
    let log = `${active.name} recharge ${w.name} (${active.reloadProgress}/${w.reload}).`;
    if (active.reloadProgress >= (w.reload ?? 0)) {
      active.loaded = true;
      active.reloadProgress = 0;
      log = `${active.name} a rechargé ${w.name}.`;
    }
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, log] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
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

- [ ] **Step 8 : Init au début du combat (`startCombat`).** Dans la construction des `heroes` (le `party.map`), après le clone, initialiser chargé + munition :
```ts
    const heroes = party.map((h, i) => {
      const c = { ...JSON.parse(JSON.stringify(h)), pos: { x: Math.max(0, partyPos.x - 1), y: Math.min(scene.dimensions.h - 1, partyPos.y + i) }, advantage: 0, conditions: [], engagedWith: [], meleeThisRound: [], wounds: { ...h.wounds } } as Combatant;
      const rw = c.weapons.find((w) => w.type === 'ranged');
      c.loaded = true; // arme à distance supposée chargée au début du combat
      c.reloadProgress = 0;
      if (rw) c.ammoUid = compatibleAmmo(c, rw)[0]?.uid;
      return c;
    }) as Combatant[];
```
(remplace l'actuel `party.map((h, i) => ({ ...JSON.parse(...), … }))`).

- [ ] **Step 9 : Lancer → succès + régression.**

Run: `npx vitest run src/state/store.test.ts` puis `npm test`.
Expected: PASS. Vérifier que le tir **ennemi** existant (embuscade tromblon) reste inchangé (gate ammo = héros uniquement).

- [ ] **Step 10 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(combat): tir héros consomme une munition (arme+munition combinées) + Recharger + sélection ; init au combat"
```

---

## Task 4 : UI — slot Recharger + sous‑liste munitions

**Files:**
- Modify: `src/ui/ActionBar.tsx`

- [ ] **Step 1 : Hooks + données.** Ajouter les hooks :
```ts
  const reload = useGame((s) => s.battleReload);
  const selectAmmo = useGame((s) => s.battleSelectAmmo);
```
Importer le helper : `import { compatibleAmmo } from '../engine/items';`. Après `groundItems`, calculer (héros) :
```ts
  const rangedW = isHero ? active.weapons.find((w) => w.type === 'ranged') : undefined;
  const needsReload = !!rangedW && (rangedW.reload ?? 0) > 0 && !active.loaded;
  const ammoChoices = isHero && rangedW ? compatibleAmmo(active, rangedW) : [];
```

- [ ] **Step 2 : Sous‑liste munitions (mode `'ammo'`)** — après la sous‑liste `pickup` :
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

- [ ] **Step 3 : Slots hotbar** — avant « Fin du tour », ajouter Recharger + Munition :
```tsx
            {needsReload && (
              <button className="ab-slot" disabled={battle.acted || stunned} onClick={reload} title="Recharger l'arme à distance (coûte l'Action)">
                <span className="ab-ico">🔄</span>
                <span className="ab-lbl">Recharger{active.reloadProgress ? ` (${active.reloadProgress}/${rangedW!.reload})` : ''}</span>
              </button>
            )}
            {ammoChoices.length > 1 && (
              <button className={`ab-slot ${battle.action === 'ammo' ? 'on' : ''}`} onClick={() => selectAction(battle.action === 'ammo' ? null : 'ammo')} title="Choisir la munition à tirer">
                <span className="ab-ico">🏹</span>
                <span className="ab-lbl">Munition</span>
              </button>
            )}
```

- [ ] **Step 4 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/ui/ActionBar.tsx
git commit -m "feat(ui): hotbar — Recharger (Recharge N) + sélecteur de munition (héros)"
```

---

## Task 5 : ROADMAP + vérification finale

- [ ] **Step 1 :** `npm test` (vert), `npm run typecheck` (0 erreur), `npm run build` (OK).
- [ ] **Step 2 : ROADMAP** — « Combat — reste » / Jalon 1 : marquer **rechargement + munitions ✅** (héros : munitions = équipement avec choix, tir = arme+munition, Recharge N) ; restes : ligne de vue / couvert, Maladresses, munitions ennemies/achat/récupération (Jalon 5).
- [ ] **Step 3 : Commit** `docs(roadmap): rechargement & munitions (héros) livrés`.
- [ ] **Step 4 : Recette navigateur (MANUELLE — utilisateur)** : équiper une arbalète + carreaux, tirer (consomme 1, décharge), Recharger, re‑tirer ; changer de munition via le sélecteur (Atouts du tir varient) ; arme vide → tir refusé.

---

## Auto-revue du plan (effectuée)

- **Couverture spec :** types (Task 1) · parse subType/qty + reload + weaponWithAmmo/compatibleAmmo (Task 2) · tir héros (combine+gate+consume) + Recharger + sélection + init combat (Task 3) · UI (Task 4) · ROADMAP (Task 5). ✓
- **Décalage assumé vs spec :** munitions/rechargement = **héros uniquement** (ennemis abstraits, tirent librement) — évite le spawn de munitions ennemies + l'IA de rechargement, zéro régression sur le tir ennemi. À noter dans la ROADMAP.
- **Cohérence des types :** `ItemInstance.subType/qty`, `Weapon.subType/reload`, `Combatant.ammoUid/loaded/reloadProgress` (Task 1) ↔ `weaponWithAmmo`/`compatibleAmmo`/`selectedAmmo` (Tasks 2-3) ↔ `battleReload`/`battleSelectAmmo` + union `'ammo'` (Task 3) ↔ ActionBar (Task 4). `resolveAttack` retourne désormais l'arme **augmentée** (`fireWeapon`) — `applyAttackResult` la reçoit et lit `reload`.
- **Risque :** modif de `resolveAttack`/`applyAttackResult` (chemin commun héros+ennemi) — gate `attacker.kind === 'hero'` partout pour ne pas toucher les ennemis ; régression `npm test` à la Task 3 Step 9.
