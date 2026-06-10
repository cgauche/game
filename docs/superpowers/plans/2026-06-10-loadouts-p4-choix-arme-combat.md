# Loadouts — Plan #4 : choix d'arme d'attaque & de parade en combat (+ marchand)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps en checkbox (`- [ ]`).
> **RISK-GATE** : touche le cœur d'attaque (`firedWeapon` à 10 sites) — invariant de PARITÉ aperçu↔résolution↔
> affichage. TDD strict, suite verte après CHAQUE task.

**Goal:** Quand le loadout actif a ≥2 armes utilisables, le joueur CHOISIT l'arme d'attaque (main secondaire à
-20) et l'arme de parade (spé + -20 sauf Parade/Défensive). Réconcilier le marchand et tuer le shim `equipped`-sync.

**Architecture:** `Weapon.uid` (posé par `recomputeLoadout`) → `firedWeapon(attacker, target, weaponUid?)` honore
le choix, sinon auto. `PendingAttack.weaponUid` / `PendingDefense.parryWeaponUid`. Le `weaponUid` est threadé via
`resolveAttack`/`previewAttack` ; tous les sites JOUEUR passent `pa.weaponUid`, l'IA reste en auto (parité).

**Tech Stack:** TS, React, Zustand, Vitest. Réf : spec §4.4/§5.1/§5.2, plans #1-#3 livrés.
**Commande de test :** `npx vitest run <fichier>` ; `npm test` ; `npm run typecheck`.

---

## Task 1 : `Weapon.uid` + `firedWeapon(weaponUid?)` (cœur, parité)

**Files:**
- Modify: `src/engine/types.ts` (`Weapon.uid?`)
- Modify: `src/engine/items.ts` (`recomputeLoadout` → `uid` sur chaque Weapon dérivé)
- Modify: `src/state/combatFlow.ts` (`firedWeapon` 3ᵉ param `weaponUid?`)
- Modify: `src/state/pendings.ts` (`PendingAttack.weaponUid?`)
- Test: `src/state/preview-attack.test.ts` (ou un test dédié `firedWeapon`)

- [ ] **Step 1 : Écrire le test qui échoue** (`src/state/firedWeapon.test.ts`)
```ts
import { describe, it, expect } from 'vitest';
import { firedWeapon } from './combatFlow';
import type { Combatant, Weapon } from '../engine/types';

const W = (uid: string, name: string, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ uid, name, type, damage: '+BF', qualities: [], hand: uid === 'm' ? 'main' : 'off', hands: 1 });
const atk = (): Combatant =>
  ({ id: 'a', name: 'A', kind: 'hero', pos: { x: 0, y: 0 }, weapons: [W('m', 'Épée'), W('o', 'Dague')], size: 3 } as unknown as Combatant);
const tgt = (): Combatant => ({ id: 't', name: 'T', kind: 'enemy', pos: { x: 1, y: 0 }, size: 3 } as unknown as Combatant);

describe('firedWeapon : honore weaponUid', () => {
  it('sans weaponUid : auto-choix (1ʳᵉ mêlée au contact)', () => {
    expect(firedWeapon(atk(), tgt()).name).toBe('Épée');
  });
  it('weaponUid valide : renvoie l’arme choisie (main secondaire)', () => {
    expect(firedWeapon(atk(), tgt(), 'o').name).toBe('Dague');
  });
  it('weaponUid inconnu : repli auto', () => {
    expect(firedWeapon(atk(), tgt(), 'zzz').name).toBe('Épée');
  });
});
```

- [ ] **Step 2 : Lancer → FAIL** : `npx vitest run src/state/firedWeapon.test.ts` (3ᵉ arg ignoré).

- [ ] **Step 3 : `Weapon.uid`** (`src/engine/types.ts`, dans `interface Weapon`, après `hand?`) :
```ts
  /** uid de l'ItemInstance source (loadout) — pour matcher un choix d'arme. Absent pour Mains nues/Crochet. */
  uid?: string;
```

- [ ] **Step 4 : poser `uid` dans `recomputeLoadout`** (`src/engine/items.ts`, dans `toWeapon`) — ajouter `uid: it.uid,` à l'objet Weapon retourné.

- [ ] **Step 5 : `firedWeapon` honore `weaponUid`** (`src/state/combatFlow.ts:455`) :
```ts
export function firedWeapon(attacker: Combatant, target: Combatant, weaponUid?: string): Weapon {
  const adj = combatDistance(attacker, target) <= meleeReachTiles(attacker.weapons);
  // Choix explicite du joueur : l'arme du loadout actif portant cet uid (si présente) ; sinon auto.
  const chosen = weaponUid ? attacker.weapons.find((w) => w.uid === weaponUid) : undefined;
  const w = chosen ?? attackWeapon(attacker.weapons, adj);
  // … (suite INCHANGÉE : augmentation munition pour un héros à distance, etc.)
```
(Garder tout le bloc d'augmentation munition tel quel, juste remplacer la dérivation `const w = attackWeapon(...)` par la version ci-dessus.)

- [ ] **Step 6 : `PendingAttack.weaponUid?`** (`src/state/pendings.ts`, dans `interface PendingAttack`) :
```ts
  /** Arme choisie pour cette attaque (uid d'ItemInstance du loadout actif) ; absent = auto-choix. */
  weaponUid?: string;
```

- [ ] **Step 7 : Lancer → PASS** ; `npm run typecheck` → 0 erreur ; `npm test` → PASS (aucun appelant ne passe encore le 3ᵉ arg → comportement inchangé).

- [ ] **Step 8 : Commit**
```bash
git add src/engine/types.ts src/engine/items.ts src/state/combatFlow.ts src/state/pendings.ts src/state/firedWeapon.test.ts
git commit -m "feat(combat): Weapon.uid + firedWeapon(weaponUid) -- socle du choix d'arme (auto si absent)"
```

---

## Task 2 : Threader `weaponUid` (résolution + aperçu + sites joueur) — PARITÉ

**Files:**
- Modify: `src/state/combatFlow.ts` (`resolveAttack`, `previewAttack`)
- Modify: `src/state/store.ts` (sites joueur : attackRoll, attackReroll, attackBonusSL, attackForceSuccess, message hors-portée)
- Modify: `src/ui/RollModal.tsx` (`firedWeapon` d'affichage + appel `previewAttack`)
- Test: `src/state/preview-attack.test.ts` (parité : aperçu utilise l'arme choisie)

- [ ] **Step 1 : Étendre `resolveAttack` et `previewAttack`**

`resolveAttack` (`combatFlow.ts:584`) : ajouter un dernier paramètre `weaponUid?: string` et remplacer
`const weapon = firedWeapon(attacker, target);` (l.594) par `const weapon = firedWeapon(attacker, target, weaponUid);`.
`previewAttack` (`combatFlow.ts:640`) : ajouter `weaponUid?: string` à `opts` et remplacer `firedWeapon(attacker, target)`
(l.648) par `firedWeapon(attacker, target, opts?.weaponUid)`.

- [ ] **Step 2 : Écrire le test de parité**

Ajouter à `src/state/preview-attack.test.ts` : avec un attaquant à 2 armes (main faible dégât / off fort),
`previewAttack(get, a, t, undefined, { weaponUid: '<off>' })` rend `weapon.name` = l'arme off ET un mod
« Main secondaire -20 » (puisque off). Comparer à l'auto (main, pas de -20).

- [ ] **Step 3 : Threader les sites JOUEUR** (`src/state/store.ts`)

Repérer (`grep -n "firedWeapon(\|resolveAttack(" src/state/store.ts`) les sites du flux JOUEUR (qui ont `pa`)
et passer `pa.weaponUid` :
- `attackRoll` : `resolveAttack(get, attacker, target, pa.location ?? undefined, pa.fromCharge, pa.intoCrowd, pa.heldGround, pa.weaponUid)`
- `attackReroll` : idem (ajouter `pa.weaponUid` en dernier arg).
- `attackBonusSL` : `firedWeapon(attacker, target, pa.weaponUid)`.
- `attackForceSuccess` (RAW-1/2) : tout `firedWeapon(attacker, target)` → `…, pa.weaponUid)`.
- Message « hors de portée / pas de LdV » : `firedWeapon(attacker, target, pa.weaponUid)`.
NE PAS toucher les sites IA (combatFlow `doAttack`/LoS, qui n'ont pas de `pa`) ni les autres `firedWeapon` auto.

- [ ] **Step 4 : RollModal** (`src/ui/RollModal.tsx`)

`const weapon = firedWeapon(attacker, target);` → `firedWeapon(attacker, target, pa.weaponUid);`
`previewAttack(useGame.getState, attacker, target, pa.location ?? undefined, { intoCrowd: pa.intoCrowd, heldGround: pa.heldGround })`
→ ajouter `weaponUid: pa.weaponUid` aux opts.

- [ ] **Step 5 : Lancer parité + suite + typecheck**

Run: `npx vitest run src/state/preview-attack.test.ts` → PASS ; `npm run typecheck` → 0 ; `npm test` → PASS.

- [ ] **Step 6 : Commit**
```bash
git add src/state/combatFlow.ts src/state/store.ts src/ui/RollModal.tsx src/state/preview-attack.test.ts
git commit -m "feat(combat): threader weaponUid (resolution + apercu + sites joueur) -- parite preservee"
```

---

## Task 3 : `battleSetWeapon` + sélecteur d'arme dans la modale d'attaque

**Files:**
- Modify: `src/state/store.ts` (type + action `attackSetWeapon`)
- Modify: `src/ui/RollModal.tsx` (sélecteur d'arme avant le jet)

- [ ] **Step 1 : Action `attackSetWeapon`** (pattern `attackSetLocation`) :
```ts
  attackSetWeapon: (uid: string | null) => void;
```
impl :
```ts
  attackSetWeapon: (uid) => {
    const pa = get().pendingAttack;
    if (!pa || pa.result) return; // choix avant le jet seulement
    set({ pendingAttack: { ...pa, weaponUid: uid ?? undefined } });
  },
```

- [ ] **Step 2 : Sélecteur dans RollModal** (avant le jet, si ≥2 armes utilisables hors Mains nues)

Calculer les armes choisissables et, si ≥2, afficher un sélecteur compact. L'arme de main secondaire montre
« -20 » (l'aperçu `previewAttack` reflète déjà le mod). Code (dans le bloc `!res`, près de la Localisation) :
```tsx
  const pickable = attacker.weapons.filter((w) => w.name !== 'Mains nues' && !!w.uid);
  ...
            {pickable.length >= 2 && (
              <div className="rm-loc-inline">
                <span className="mini-title">Arme</span>
                <select className="rm-loc-select" value={pa.weaponUid ?? weapon.uid ?? ''} onChange={(e) => setWeapon(e.target.value || null)}>
                  {pickable.map((w) => (
                    <option key={w.uid} value={w.uid}>{w.name}{w.hand === 'off' ? ' (main 2nde -20)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
```
avec `const setWeapon = useGame((s) => s.attackSetWeapon);`.

- [ ] **Step 3 : typecheck + suite + recette**

Run: `npm run typecheck` → 0 ; `npm test` → PASS. Recette navigateur (si dispo) : dual-wield → sélecteur ;
l'aperçu de toucher/-20 change avec l'arme ; le jet résolu utilise l'arme choisie (parité).

- [ ] **Step 4 : Commit**
```bash
git add src/state/store.ts src/ui/RollModal.tsx
git commit -m "feat(ui): selecteur d'arme d'attaque (dual-wield) dans la modale -- main 2nde a -20"
```

---

## Task 4 : Choix d'arme de PARADE (moteur)

**Files:**
- Modify: `src/state/pendings.ts` (`PendingDefense.parryWeaponUid?`)
- Modify: `src/state/store.ts` (la résolution de défense joueur lit l'arme de parade choisie ; action `defenseSetParryWeapon`)
- Modify: `src/state/combatFlow.ts` (le calcul de défense joueur passe l'arme de parade)
- Test: `src/engine/combat-breakdown.test.ts` (parade avec arme choisie → spé + pénalité)

- [ ] **Step 1 : `PendingDefense.parryWeaponUid?`** (`pendings.ts`) :
```ts
  /** Arme de parade choisie par le défenseur (uid) ; absent = main principale (weapons[0]). */
  parryWeaponUid?: string;
```

- [ ] **Step 2 : Résolution de défense joueur honore l'arme**

Repérer où la défense JOUEUR est résolue (`grep -n "defenseValue(defender, mode\|defenseRoll\|finishMelee" src/state/store.ts src/state/combatFlow.ts`).
Là où `defender.weapons[0]` est passé à `defenseValue`/`defenseModifiers`/`finishMelee` pour une parade JOUEUR,
résoudre l'arme : `const parry = pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) ?? defender.weapons[0] : defender.weapons[0];`
et la passer. (Helper local `parryWeaponOf(defender, pd)`.)

- [ ] **Step 3 : Action `defenseSetParryWeapon`** (pattern `defenseSetMode`) :
```ts
  defenseSetParryWeapon: (uid: string | null) => void;
```
impl : `set({ pendingDefense: { ...pd, parryWeaponUid: uid ?? undefined } })` (avant le jet seulement).

- [ ] **Step 4 : Test** — un défenseur avec rapière (Escrime) + bouclier (Défensive, Parade) ; parer avec le
bouclier (off + Parade spé) → 0 pénalité (déjà couvert par `parryPenalty` Task plan #1) ; la VALEUR de défense
suit la spé de l'arme choisie. Vérifier `defenseValue(defender, 'parade', chosenWeapon)` change avec l'arme.

- [ ] **Step 5 : Commit**
```bash
git add src/state/pendings.ts src/state/store.ts src/state/combatFlow.ts src/engine/combat-breakdown.test.ts
git commit -m "feat(combat): choix de l'arme de parade (PendingDefense.parryWeaponUid) -- spe + penalite par arme"
```

---

## Task 5 : Sélecteur d'arme de parade dans la DefenseModal

**Files:**
- Modify: `src/ui/DefenseModal.tsx`

- [ ] **Step 1 : Sélecteur** (dans le bloc avant le jet, près des boutons Parade/Esquive)

Si le défenseur a ≥2 armes pour parer, afficher un sélecteur (visible quand mode='parade'). Code :
```tsx
  const setParry = useGame((s) => s.defenseSetParryWeapon);
  const parryPickable = defender.weapons.filter((w) => w.name !== 'Mains nues' && !!w.uid);
  ...
        {pd.mode === 'parade' && parryPickable.length >= 2 && (
          <div className="rm-loc-inline">
            <span className="mini-title">Parer avec</span>
            <select className="rm-loc-select" value={pd.parryWeaponUid ?? parryPickable[0].uid ?? ''} onChange={(e) => setParry(e.target.value || null)}>
              {parryPickable.map((w) => (
                <option key={w.uid} value={w.uid}>{w.name}{w.hand === 'off' ? ' (2nde)' : ''}</option>
              ))}
            </select>
          </div>
        )}
```

- [ ] **Step 2 : typecheck + suite + commit**
```bash
git add src/ui/DefenseModal.tsx
git commit -m "feat(ui): selecteur d'arme de parade dans la DefenseModal"
```

---

## Task 6 : Réconciliation marchand + suppression du shim `equipped`-sync

**Files:**
- Modify: `src/ui/MerchantPanel.tsx` (acheter une arme → proposer l'assignation à un loadout, ou au moins informer)
- Modify: `src/engine/equipCompare.ts` (comparer vs l'arme du loadout actif, pas `equipped`)
- Modify: `src/engine/items.ts` (retirer la resync `it.equipped` des ARMES dans recomputeLoadout) — APRÈS avoir
  migré les lecteurs de `weapon.equipped` (MerchantPanel `✓ équipé`, etc.) vers une notion loadout (`inLoadout`).

- [ ] **Step 1 : Recenser les lecteurs de `equipped` sur des ARMES**

`grep -n "\.equipped" src/ui/MerchantPanel.tsx src/engine/equipCompare.ts src/ui/CharacterSheet.tsx` — pour
chaque usage sur une arme (melee/ranged), remplacer par « appartient au loadout actif » (`activeLoadout` +
main/off). L'armure garde `equipped`.

- [ ] **Step 2 : Retirer la resync `equipped` des armes dans `recomputeLoadout`**

Supprimer la ligne `for (const it of items) if (it.kind === 'melee' || it.kind === 'ranged') it.equipped = …`
(le shim legacy). Vérifier qu'aucun test/loader ne dépend de `weapon.equipped` après coup (sinon migrer).

- [ ] **Step 3 : Marchand — assigner une arme achetée**

Au minimum : après achat d'une arme, un indice « à équiper via un set d'armes (fiche) ». Idéalement : un bouton
« → set » ouvrant l'assignation. (Scope minimal acceptable si le reste est lourd ; documenter le choix.)

- [ ] **Step 4 : typecheck + suite + recette + commit**

Run: `npm run typecheck` → 0 ; `npm test` → PASS (corriger les tests dépendant de `weapon.equipped`).
```bash
git add -A src/ui/MerchantPanel.tsx src/engine/equipCompare.ts src/engine/items.ts
git commit -m "refactor(combat): marchand reconcilie avec les loadouts ; suppression du shim equipped-sync des armes"
```

---

## Auto-revue (couverture)

- Choix d'arme d'ATTAQUE (uid, firedWeapon, threading parité, picker) → Tasks 1-3 (§5.1).
- Choix d'arme de PARADE (parryWeaponUid, résolution, picker) → Tasks 4-5 (§5.2).
- Marchand réconcilié + shim `equipped`-sync supprimé → Task 6 (dette du plan #2).
- INVARIANT : sans `weaponUid`/`parryWeaponUid`, comportement auto INCHANGÉ (parité testée).
- HORS scope : Maniement de deux armes (plan #5) ; lâcher/amputation (plan #6).
