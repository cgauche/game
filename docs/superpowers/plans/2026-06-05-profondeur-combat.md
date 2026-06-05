# Profondeur combat — Chance (relance/+1 DR), Détermination, Ramasser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger la dépense de Chance (relance **1×/Test** et **seulement sur un d100 propre raté**), ajouter les usages canon **+1 DR** (Chance) et **Détermination** (retirer un État, +1 PB si À Terre), et une action **Ramasser** un objet au sol **un à la fois** pendant un Round — le tout sourcé du Livre de base FR, moteur pur testé.

**Architecture :** moteur pur (`src/engine`) → store Zustand (`src/state/store.ts`) → UI React (`src/ui`). La relance/+1 DR se branchent sur les 5 flux à jet différé existants (`pendingTest/Attack/Defense/Disengage/Cast`). Le **+1 DR** re‑dérive l'issue **depuis le jet figé** (incrémental : +1 DR sur le DR courant du joueur, jamais de nouveau d100) en réutilisant `finishMelee`/`resolveOpposed`/un helper passif + un helper d'incantation. Détermination et Ramasser sont des actions de hotbar.

**Tech Stack :** Vite + TypeScript + React, Zustand, Vitest. RNG seedable (`makeRNG`). Tests engine via fixtures `Combatant` minimales ; tests store via `useGame.setState` + `seedRng` + `vi.useFakeTimers`.

**Conventions de fidélité (sources, à citer dans les commentaires de code) :**
- Chance, 3 usages — LDB `17 - Destin et Résistance.md` l.22‑28 : relancer un Test **échoué**, **+1 DR** après le jet, choix d'initiative (non modélisé).
- Relance = **1×/Test** — LDB `12 - Tests.md` l.56.
- Échec d'un Test = **d100 > cible** — LDB `12 - Tests.md` l.29‑31 (gate **indépendant** du Test opposé).
- Détermination — LDB ch.17 l.62‑66 : seul **« Retirer un État »** est branché (+1 PB si À Terre) ; Psychologie/Critique non modélisés → laissés au MJ.
- Ramasser — LDB `13 - Combat.md` l.115‑116 (le MJ décide ; si Test requis → Action) : on **consomme l'Action**, **un objet à la fois**, **pas d'auto‑équipe** ; pas de drop auto.

**Commandes :**
- Test ciblé : `npx vitest run <fichier>`
- Suite + typecheck : `npm test` puis `npm run typecheck`

---

## Phase 1 — Correctifs de la relance (bug : multi‑relance + relance hors échec)

### Task 1 : Helper pur `canReroll`

**Files:**
- Create: `src/engine/fortune.ts`
- Test: `src/engine/fortune.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

`src/engine/fortune.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { canReroll } from './fortune';

describe('canReroll — Chance : relance 1×/Test sur jet propre raté (LDB ch.12 l.56 + ch.12 l.29-31)', () => {
  it('jet raté, pas encore relancé → relance possible', () => {
    expect(canReroll(true, false)).toBe(true);
  });
  it('jet raté mais déjà relancé → impossible (1 relance max, l.56)', () => {
    expect(canReroll(true, true)).toBe(false);
  });
  it('jet réussi → impossible (relance réservée aux Tests échoués, l.24)', () => {
    expect(canReroll(false, false)).toBe(false);
  });
  it('jet réussi et déjà relancé → impossible', () => {
    expect(canReroll(false, true)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npx vitest run src/engine/fortune.test.ts`
Expected: FAIL — `canReroll` introuvable / module manquant.

- [ ] **Step 3 : Implémenter**

`src/engine/fortune.ts` :
```ts
/**
 * Dépense d'un Point de Chance — Livre de base, « Destin et Résistance » (ch.17 l.22-28).
 * La RELANCE est réservée aux Tests qui se sont conclus par un ÉCHEC (l.24) et ne peut être
 * faite qu'UNE FOIS par Test (règle générale de relance, ch.12 l.56 : « une fois qu'une relance
 * a été effectuée […] il n'est plus possible de le relancer »). L'« échec » d'un Test est défini
 * par TON propre jet (d100 > cible, ch.12 l.29-31), indépendamment d'un éventuel Test opposé.
 */
export function canReroll(ownRollFailed: boolean, alreadyRerolled: boolean): boolean {
  return ownRollFailed && !alreadyRerolled;
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `npx vitest run src/engine/fortune.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/engine/fortune.ts src/engine/fortune.test.ts
git commit -m "feat(combat): helper pur canReroll (Chance : relance 1x/Test sur jet raté, LDB ch.12 l.56)"
```

---

### Task 2 : Flag `rerolled` + gate d'échec sur les 5 relances du store

**Files:**
- Modify: `src/state/store.ts` (interfaces `PendingTest`/`PendingAttack`/`PendingDefense`/`PendingDisengage`/`PendingCast` l.96‑158 ; actions `testReroll` l.1004, `attackReroll` l.794, `defenseReroll` l.835, `disengageReroll` l.913, `castReroll` l.668 ; import l.39)
- Test: `src/state/store.test.ts` (ajouts)

- [ ] **Step 1 : Écrire les tests de régression (échec attendu)**

Ajouter dans `src/state/store.test.ts`, à la fin (nouveau `describe`) :
```ts
describe('Chance : relance 1×/Test et seulement sur jet propre raté (LDB ch.12 l.56 + l.29-31)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    reset();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('testReroll : refusée si le d100 propre est réussi (roll ≤ cible)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 2;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 0, target: 50, roll: 20, success: true, sl: 3, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testReroll();
    expect(useGame.getState().party[0].fortune).toBe(2); // rien dépensé (jet réussi)
    expect(useGame.getState().pendingTest!.roll).toBe(20); // jet inchangé
  });

  it('testReroll : autorisée une seule fois sur un jet raté', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 2;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 5, difficulty: 'intermediaire',
        requireSL: 0, target: 5, roll: 95, success: false, sl: -9, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testReroll(); // 1re relance OK (jet raté)
    expect(useGame.getState().party[0].fortune).toBe(1);
    expect(useGame.getState().pendingTest!.rerolled).toBe(true);
    useGame.getState().testReroll(); // 2e relance refusée (déjà relancé)
    expect(useGame.getState().party[0].fortune).toBe(1); // pas de 2e dépense
  });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL — `rerolled` absent du type ; `testReroll` dépense quand même / relance deux fois.

- [ ] **Step 3 : Ajouter `rerolled?: boolean` aux 5 interfaces pending**

Dans `src/state/store.ts`, ajouter une ligne `rerolled?: boolean;` (relance déjà effectuée — 1 max/Test) à chaque interface :
- `PendingTest` (après `sl: number;` l.108)
- `PendingAttack` (après `result: AttackResult | null;` l.117)
- `PendingDefense` (après `result: AttackResult | null;` l.132)
- `PendingDisengage` (après `result: ... | null;` l.143)
- `PendingCast` (après `result: ... | null;` l.157)

Exemple pour `PendingAttack` :
```ts
  result: AttackResult | null; // null = pas encore lancé
  /** Relance par Chance déjà effectuée (LDB ch.12 l.56 : 1 relance max par Test). */
  rerolled?: boolean;
  fromCharge?: boolean;
```

- [ ] **Step 4 : Importer `canReroll`**

Modifier l'import tests l.39 :
```ts
import { rollTest, TestResult, opposedTest, resolveOpposed } from '../engine/tests';
import { canReroll } from '../engine/fortune';
```

- [ ] **Step 5 : Gater `testReroll` (l.1004‑1016)**

Remplacer le corps par :
```ts
  testReroll: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return;
    // Relance réservée à un d100 propre RATÉ (roll > cible), une seule fois (LDB ch.12 l.56 + l.29-31).
    if (!canReroll(pt.roll > pt.target, !!pt.rerolled)) return;
    const party = get().party;
    const actor = party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.fortune ?? 0) <= 0) return;
    actor.fortune = (actor.fortune ?? 0) - 1;
    const res: TestResult = rollTest(pt.skillValue, pt.difficulty);
    set({
      pendingTest: { ...pt, roll: res.roll, sl: res.sl, success: res.success && res.sl >= pt.requireSL, rerolled: true },
      party: [...party],
    });
  },
```

- [ ] **Step 6 : Gater `attackReroll` (l.794‑803)**

Remplacer le corps par :
```ts
  attackReroll: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result) return;
    // Relance si le jet d'attaque propre est raté (succès du d100 de l'attaquant), 1× max.
    if (!canReroll(!pa.result.attackerDetail?.success, !!pa.rerolled)) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target || (attacker.fortune ?? 0) <= 0) return;
    attacker.fortune = (attacker.fortune ?? 0) - 1; // Dépense d'un point de Chance : relance le jet (LDB ch.17 l.24)
    const r = resolveAttack(attacker, target, pa.location ?? undefined);
    if (r) set({ pendingAttack: { ...pa, result: r.res, rerolled: true }, battle: { ...battle } });
  },
```

- [ ] **Step 7 : Gater `defenseReroll` (l.835‑846)**

Remplacer la garde (après `if (!battle || !pd || !pd.result) return;`) — ajouter la condition d'échec/1× sur le jet de défense propre (`pd.def`) :
```ts
  defenseReroll: () => {
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result) return;
    if (!canReroll(!pd.def?.success, !!pd.rerolled)) return; // défense propre ratée, 1× max
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender || (defender.fortune ?? 0) <= 0) return;
    defender.fortune = (defender.fortune ?? 0) - 1; // le jet d'attaque (pd.atk) reste figé
    const def = rollMeleeDefender(defender, pd.mode, battleRng);
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def, pd.mode, pd.location ?? undefined);
    set({ pendingDefense: { ...pd, def, result: res, rerolled: true }, battle: { ...battle } });
  },
```

- [ ] **Step 8 : Gater `disengageReroll` (l.913‑922)**

```ts
  disengageReroll: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || !pd.result) return;
    if (!canReroll(!pd.def?.success, !!pd.rerolled)) return; // Esquive propre ratée, 1× max
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover || (mover.fortune ?? 0) <= 0) return;
    mover.fortune = (mover.fortune ?? 0) - 1;
    const def = rollMeleeDefender(mover, 'esquive', battleRng);
    const opp = resolveOpposed(def, pd.atk!);
    set({ pendingDisengage: { ...pd, def, result: disengageOutcome(opp.winner), rerolled: true }, battle: { ...battle } });
  },
```

- [ ] **Step 9 : Gater `castReroll` (l.668‑680)**

```ts
  castReroll: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    // Échec d'incantation = d100 propre > cible (roll > target), 1× max.
    if (!canReroll(pc.result.roll > pc.result.target, !!pc.rerolled)) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1; // Chance : relance le jet d'incantation
    const res = pc.missile
      ? resolveMagicMissile(caster, target, spell, battleRng, pc.focused)
      : resolveCasting(caster, spell, battleRng, 'intermediaire', pc.focused);
    set({ pendingCast: { ...pc, result: res, rerolled: true }, battle: { ...battle } });
  },
```

- [ ] **Step 10 : Vérifier les tests existants + nouveaux**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS — y compris les tests existants « la Chance relance la défense » et « disengageReroll » (leurs fixtures posent `def` raté `success: false` ou un jet attaquant figé ; vérifier qu'ils passent encore — sinon ajuster la fixture pour un jet propre raté).

> NB : le test existant « défense réactive : … Chance relance la défense » utilise une défense dont l'issue dépend du seed ; si la défense propre est *réussie* avec ce seed, la relance sera désormais refusée. Si ce test casse, fixer son `seedRng`/fixture pour garantir une défense ratée, OU poser explicitement `pendingDefense.def = { roll: 90, target: 40, success: false, sl: -5, isDouble: false }` puis `result` via `defenseRoll`. Documenter le changement.

- [ ] **Step 11 : Typecheck**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 12 : Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "fix(combat): Chance — relance 1x/Test et seulement sur d100 propre raté (LDB ch.12 l.56, l.29-31)"
```

---

### Task 3 : UI — masquer la relance hors échec / après usage (5 modales)

**Files:**
- Modify: `src/ui/RollModal.tsx`, `src/ui/DefenseModal.tsx`, `src/ui/CastModal.tsx`, `src/ui/TestModal.tsx`, `src/ui/DisengageModal.tsx`

Chaque modale calcule `canReroll` (jet propre raté **et** pas déjà relancé) et masque le bouton « 🍀 Chance » quand il ne s'applique pas. Pas de test unitaire UI (couvert par la recette navigateur + la garde store) ; vérifier le typecheck.

- [ ] **Step 1 : `RollModal.tsx`** — importer le helper et gater le bouton.

En tête (après les imports existants) :
```ts
import { canReroll } from '../engine/fortune';
```
Dans le rendu, juste avant le `return`, ajouter (après `const fortune = attacker.fortune ?? 0;`) :
```ts
  const rerollable = !!res && canReroll(!res.attackerDetail?.success, !!pa.rerolled);
```
Remplacer la condition du bouton Chance `{fortune > 0 && (` par `{fortune > 0 && rerollable && (`.

- [ ] **Step 2 : `DefenseModal.tsx`** — idem.

Import `import { canReroll } from '../engine/fortune';`. Après `const fortune = defender.fortune ?? 0;` :
```ts
  const rerollable = !!res && canReroll(!pd.def?.success, !!pd.rerolled);
```
Bouton Chance : `{fortune > 0 && rerollable && (`.

- [ ] **Step 3 : `CastModal.tsx`** — idem.

Import `import { canReroll } from '../engine/fortune';`. Après `const fortune = caster.fortune ?? 0;` :
```ts
  const rerollable = !!res && canReroll(res.roll > res.target, !!pc.rerolled);
```
Bouton Chance : `{fortune > 0 && rerollable && (`.

- [ ] **Step 4 : `TestModal.tsx`** — idem.

Import `import { canReroll } from '../engine/fortune';`. Après `const fortune = party.find((c) => c.id === pt.actorId)?.fortune ?? 0;` :
```ts
  const rerollable = rolled && pt.roll != null && canReroll(pt.roll > pt.target, !!pt.rerolled);
```
Bouton Chance : `{fortune > 0 && rerollable && (`.

- [ ] **Step 5 : `DisengageModal.tsx`** — idem.

Import `import { canReroll } from '../engine/fortune';`. Après `const fortune = mover.fortune ?? 0;` :
```ts
  const rerollable = pd.phase === 'esquive' && canReroll(!pd.def?.success, !!pd.rerolled);
```
Bouton Chance : `{fortune > 0 && rerollable && (`.

- [ ] **Step 6 : Typecheck + commit**

Run: `npm run typecheck`
Expected: 0 erreur.
```bash
git add src/ui/RollModal.tsx src/ui/DefenseModal.tsx src/ui/CastModal.tsx src/ui/TestModal.tsx src/ui/DisengageModal.tsx
git commit -m "fix(ui): bouton Chance masqué hors d'un jet raté et après une relance (5 modales)"
```

---

## Phase 2 — « +1 DR » par Chance (RAW pur, cumulable)

### Task 4 : Helpers de re‑dérivation purs (moteur)

**Files:**
- Modify: `src/engine/combat.ts` (ajout `rederivePassiveAttack`)
- Modify: `src/engine/magic.ts` (factoriser `evaluateCasting`/`evaluateMissile` + ajout `rederiveCastSL`)
- Test: `src/engine/fortune.test.ts` (ajouts), `src/engine/combat-breakdown.test.ts` ou nouveau bloc

- [ ] **Step 1 : Écrire les tests (échec attendu)**

Ajouter à `src/engine/fortune.test.ts` :
```ts
import { evaluateTest } from './tests';
import { rederivePassiveAttack } from './combat';
import type { Combatant, Weapon } from './types';

const ranger = (CT = 50): Combatant =>
  ({
    name: 'Tir', characteristics: { CC: 40, CT, F: 35, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    advantage: 0, conditions: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    wounds: { current: 10, max: 10 }, skills: [],
  }) as unknown as Combatant;
const cible = (E = 30): Combatant =>
  ({
    name: 'Cible', characteristics: { CC: 30, CT: 30, F: 30, E, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    advantage: 0, conditions: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    wounds: { current: 10, max: 10 }, skills: [],
  }) as unknown as Combatant;
const bow: Weapon = { name: 'Arc', type: 'ranged', damage: '+9', range: 60, qualities: [] };

describe('rederivePassiveAttack — +1 DR (re-dérive un tir figé sans relancer)', () => {
  it('+1 DR augmente les Dégâts d’un tir réussi (BE+PA constants)', () => {
    const a = ranger(); const d = cible(30); // BE(30)=3, PA=0
    const atk = evaluateTest(20, 50); // réussi, DR = 5-2 = 3
    const r0 = rederivePassiveAttack(a, d, bow, atk, 'ranged');
    const r1 = rederivePassiveAttack(a, d, bow, { ...atk, sl: atk.sl + 1 }, 'ranged');
    expect(r0.hit).toBe(true);
    expect(r1.woundsLost!).toBe(r0.woundsLost! + 1); // +1 DR = +1 dégât = +1 Blessure
  });
  it('+1 DR ne fabrique pas une touche sur un tir raté (succès = d100, inchangé)', () => {
    const atk = evaluateTest(80, 50); // d100 raté
    const r = rederivePassiveAttack(ranger(), cible(), bow, { ...atk, sl: atk.sl + 1 }, 'ranged');
    expect(r.hit).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer → échec**

Run: `npx vitest run src/engine/fortune.test.ts`
Expected: FAIL — `rederivePassiveAttack` introuvable.

- [ ] **Step 3 : Ajouter `rederivePassiveAttack` à `src/engine/combat.ts`**

À la fin du fichier (après `initiativeOrder`), ajouter :
```ts
/**
 * Re-dérive une attaque NON opposée (tir OU mêlée passive) à partir d'un jet d'attaque DÉJÀ figé
 * — pour la Chance « +1 DR » (ch.17 l.26) : le DR voulu est porté par `atk.sl`, on NE relance PAS
 * le d100 (le succès reste celui du jet propre) et on recalcule uniquement les Dégâts.
 */
export function rederivePassiveAttack(
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  atk: TestResult,
  kind: 'melee' | 'ranged',
  location?: HitLocation,
): AttackResult {
  const atkBd = bd(kind === 'ranged' ? 'Projectiles' : 'Corps à corps', combatValue(attacker, kind), atk);
  if (!atk.success) {
    return {
      hit: false,
      attackerRoll: atk.roll,
      attackerDetail: atkBd,
      netSL: atk.sl,
      critical: false,
      advantageTo: kind === 'ranged' ? null : 'defender',
      defenderDefeated: false,
      log: kind === 'ranged' ? `${attacker.name} manque sa cible.` : `${attacker.name} manque ${defender.name}.`,
    };
  }
  return applyHit(attacker, defender, weapon, atkBd, atk.sl, atk.isDouble && atk.success, location);
}
```
(`bd`, `applyHit`, `combatValue` sont déjà définis dans ce module.)

- [ ] **Step 4 : Lancer → succès**

Run: `npx vitest run src/engine/fortune.test.ts`
Expected: PASS.

- [ ] **Step 5 : Test du +1 DR d'incantation (échec attendu)**

Ajouter à `src/engine/fortune.test.ts` :
```ts
import { rederiveCastSL, type SpellLike } from './magic';

const mage = (Int = 30): Combatant =>
  ({
    name: 'Mage', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int, FM: 35, Soc: 30 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, wounds: { current: 10, max: 10 },
    skills: [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 1 }],
  }) as unknown as Combatant;
const dart: SpellLike = { label: 'Fléchette', type: 'Sort des Arcanes', cn: 3, desc: 'Projectile magique. Dégâts +4.' };

describe('rederiveCastSL — +1 DR sur une incantation figée', () => {
  it('+1 DR fait franchir le seuil NI (DR < NI → cast)', () => {
    // d100 = 28 ≤ cible 31 (Int30+1) → succès ; DR brut = 3-2 = 1 < NI 3 → pas lancé.
    const cur = { cast: false, roll: 28, target: 31, sl: 1, isCritical: false, isFumble: false, log: '' };
    const r2 = rederiveCastSL(mage(30), mage(30), dart, cur, false, false, 2); // +2 DR → DR 3 ≥ NI 3
    expect(r2.cast).toBe(true);
  });
});
```

- [ ] **Step 6 : Lancer → échec**

Run: `npx vitest run src/engine/fortune.test.ts`
Expected: FAIL — `rederiveCastSL` introuvable.

- [ ] **Step 7 : Factoriser `magic.ts` + ajouter `rederiveCastSL`**

Dans `src/engine/magic.ts` :

a) Élargir l'import tests (l.~24) :
```ts
import { rollTest, evaluateTest, TestResult } from './tests';
```

b) Extraire `evaluateCasting` — remplacer le corps de `resolveCasting` (après le `knowsCastingSkill`) par un appel, et ajouter la fonction exportée. Concrètement, dans `resolveCasting`, remplacer tout ce qui suit `const value = castingValue(...)` par :
```ts
  const value = castingValue(caster, info.skill, info.spec);
  const t = rollTest(value, difficulty, rng);
  return evaluateCasting(caster, spell, t, focusedNI0);
}

/** Évalue un résultat d'incantation à partir d'un jet DÉJÀ obtenu (rejouable pour la Chance). */
export function evaluateCasting(
  caster: Combatant,
  spell: SpellLike,
  t: TestResult,
  focusedNI0 = false,
): CastResult {
  const info = castInfo(spell);
  const ni = focusedNI0 ? 0 : spell.cn ?? 0;
  const cast = t.success && (!info.requireNI || t.sl >= ni);
  const isCritical = t.isDouble && t.success;
  const isFumble = t.isDouble && !t.success;
  let log: string;
  if (!t.success) log = `${caster.name} échoue à incanter ${spell.label}.`;
  else if (!cast) log = `${caster.name} incante ${spell.label} mais sans assez de puissance (DR ${t.sl} < NI ${ni}).`;
  else log = `${caster.name} lance ${spell.label} (DR ${t.sl}).`;
  return { cast, roll: t.roll, target: t.target, sl: t.sl, isCritical, isFumble, log };
}
```

c) Extraire `evaluateMissile` — remplacer le corps de `resolveMagicMissile` par un appel et ajouter la fonction (réutilise tel quel le calcul des Dégâts existant) :
```ts
export function resolveMagicMissile(
  caster: Combatant,
  target: Combatant,
  spell: SpellLike,
  rng: RNG = defaultRNG,
  focusedNI0 = false,
): MissileResult {
  const cr = resolveCasting(caster, spell, rng, 'intermediaire', focusedNI0);
  return evaluateMissile(caster, target, spell, cr);
}

/** Re-dérive les Dégâts d'un Projectile magique depuis un résultat d'incantation déjà obtenu. */
export function evaluateMissile(
  caster: Combatant,
  target: Combatant,
  spell: SpellLike,
  cr: CastResult,
): MissileResult {
  if (!cr.cast) return { ...cr, hit: false, defenderDefeated: false };
  const loc = hitLocation(reverseRoll(cr.roll));
  const spellDmg = parseSpellDamage(spell.desc);
  const bfm = bonus(effectiveChar(caster, 'FM'));
  const damage = (spellDmg?.damage ?? 0) + Math.max(0, cr.sl) + bfm;
  const tb = spellDmg?.ignoreBE ? 0 : bonus(effectiveChar(target, 'E'));
  const ap = spellDmg?.ignorePA ? 0 : target.armour[loc] ?? 0;
  const woundsLost = Math.max(1, damage - (tb + ap));
  const defeated = target.wounds.current - woundsLost <= 0;
  const mitLabel =
    [spellDmg?.ignoreBE ? null : 'BE', spellDmg?.ignorePA ? null : 'PA'].filter(Boolean).join('+') || 'rien';
  return {
    ...cr,
    hit: true,
    location: loc,
    damage,
    woundsLost,
    defenderDefeated: defeated,
    log:
      `${caster.name} lance ${spell.label} sur ${target.name} : ` +
      `${damage} dégâts − ${tb + ap} (${mitLabel}) = ${woundsLost} Blessures` +
      (cr.isCritical ? ' — CRITIQUE !' : '') +
      '.',
  };
}
```

d) Ajouter `rederiveCastSL` (à la suite) :
```ts
/**
 * Re-dérive une incantation figée avec un bonus de DR (Chance « +1 DR », ch.17 l.26) : on ne
 * relance pas le d100 — le succès reste celui du jet propre ; on recalcule cast/NI et, pour un
 * Projectile magique, les Dégâts.
 */
export function rederiveCastSL(
  caster: Combatant,
  target: Combatant,
  spell: SpellLike,
  current: CastResult & Partial<MissileResult>,
  missile: boolean,
  focusedNI0 = false,
  bonusSL = 1,
): CastResult & Partial<MissileResult> {
  const t: TestResult = {
    roll: current.roll,
    target: current.target,
    success: current.roll <= current.target,
    sl: current.sl + bonusSL,
    isDouble: current.roll === 100 || current.roll % 11 === 0,
  };
  const cr = evaluateCasting(caster, spell, t, focusedNI0);
  return missile ? evaluateMissile(caster, target, spell, cr) : cr;
}
```

- [ ] **Step 8 : Lancer les tests moteur**

Run: `npx vitest run src/engine/fortune.test.ts src/engine/magic` (et la suite magie existante si présente)
Expected: PASS. Lancer aussi `npx vitest run src/state/store.test.ts` (resolveCasting/resolveMagicMissile inchangés en comportement).

- [ ] **Step 9 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/engine/combat.ts src/engine/magic.ts src/engine/fortune.test.ts
git commit -m "feat(combat): helpers purs de +1 DR (rederivePassiveAttack, rederiveCastSL + evaluate* magie)"
```

---

### Task 5 : Actions store « +1 DR » (5 flux)

**Files:**
- Modify: `src/state/store.ts` (import combat l.9‑23 ; déclarations `GameState` ; nouvelles actions)
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)**

Ajouter dans le `describe('Chance : relance 1×/Test …')` (Task 2) :
```ts
  it('testBonusSL : +1 DR fait passer un Test à requireSL, et est cumulable', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.fortune = 3;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 2, target: 50, roll: 45, success: false, sl: 0, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testBonusSL(); // DR 0 → 1 (< 2)
    expect(useGame.getState().party[0].fortune).toBe(2);
    expect(useGame.getState().pendingTest!.success).toBe(false);
    useGame.getState().testBonusSL(); // DR 1 → 2 (≥ requireSL 2) → succès
    expect(useGame.getState().party[0].fortune).toBe(1);
    expect(useGame.getState().pendingTest!.sl).toBe(2);
    expect(useGame.getState().pendingTest!.success).toBe(true);
  });
```

- [ ] **Step 2 : Lancer → échec** (`testBonusSL` introuvable).

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Ajouter `rederivePassiveAttack` à l'import combat (l.9‑23)** et `rederiveCastSL` à l'import magic (l.25‑37) :
```ts
  finishMelee,
  resolveMeleePassive,
  attackWeapon,
  rederivePassiveAttack,
  AttackResult,
} from '../engine/combat';
```
```ts
  buffDurationRounds,
  rederiveCastSL,
  type CastResult,
```

- [ ] **Step 4 : Déclarer les 5 actions dans l'interface `GameState`**

Après `testReroll: () => void;` (l.221), ajouter `testBonusSL: () => void;`.
Après `castReroll: () => void;` (l.234) : `castBonusSL: () => void;`.
Après `attackReroll: () => void;` (l.246) : `attackBonusSL: () => void;`.
Après `defenseReroll: () => void;` (l.253) : `defenseBonusSL: () => void;`.
Après `disengageReroll: () => void;` (l.260) : `disengageBonusSL: () => void;`.

- [ ] **Step 5 : Implémenter les 5 actions** (placer chacune juste après l'action `*Reroll` correspondante dans l'objet du store).

`testBonusSL` (après `testReroll`) :
```ts
  /** Chance « +1 DR » (LDB ch.17 l.26) : ajoute un Degré de Réussite au Test figé, cumulable. */
  testBonusSL: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return;
    const party = get().party;
    const actor = party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.fortune ?? 0) <= 0) return;
    actor.fortune = (actor.fortune ?? 0) - 1;
    const sl = pt.sl + 1;
    set({ pendingTest: { ...pt, sl, success: pt.roll <= pt.target && sl >= pt.requireSL }, party: [...party] });
  },
```

`attackBonusSL` (après `attackReroll`) :
```ts
  /** Chance « +1 DR » : +1 DR au jet d'attaque figé, re-dérive l'issue (sans relancer). */
  attackBonusSL: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result || !pa.result.attackerDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target || (attacker.fortune ?? 0) <= 0) return;
    attacker.fortune = (attacker.fortune ?? 0) - 1;
    const r = pa.result;
    const ad = r.attackerDetail!;
    const atk2: TestResult = { roll: ad.roll, target: ad.target, success: ad.success, sl: ad.sl + 1, isDouble: ad.roll === 100 || ad.roll % 11 === 0 };
    const adj = chebyshev(attacker.pos!, target.pos!) <= 1;
    const weapon = attackWeapon(attacker.weapons, adj);
    let res: AttackResult;
    if (r.defenderDetail) {
      const dd = r.defenderDetail;
      const def: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl, isDouble: dd.roll === 100 || dd.roll % 11 === 0 };
      res = finishMelee(attacker, target, weapon, atk2, def, bestDefenseMode(target), pa.location ?? undefined);
    } else {
      res = rederivePassiveAttack(attacker, target, weapon, atk2, weapon.type === 'ranged' ? 'ranged' : 'melee', pa.location ?? undefined);
    }
    set({ pendingAttack: { ...pa, result: res }, battle: { ...battle } });
  },
```

`defenseBonusSL` (après `defenseReroll`) :
```ts
  /** Chance « +1 DR » du défenseur : +1 DR à SA défense figée (le jet d'attaque reste figé). */
  defenseBonusSL: () => {
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result || !pd.result.defenderDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender || (defender.fortune ?? 0) <= 0) return;
    defender.fortune = (defender.fortune ?? 0) - 1;
    const dd = pd.result.defenderDetail!;
    const def2: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl + 1, isDouble: dd.roll === 100 || dd.roll % 11 === 0 };
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def2, pd.mode, pd.location ?? undefined);
    set({ pendingDefense: { ...pd, def: def2, result: res }, battle: { ...battle } });
  },
```

`disengageBonusSL` (après `disengageReroll`) :
```ts
  /** Chance « +1 DR » du mover : +1 DR à l'Esquive figée (le jet du foe reste figé). */
  disengageBonusSL: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || !pd.result || !pd.def) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover || (mover.fortune ?? 0) <= 0) return;
    mover.fortune = (mover.fortune ?? 0) - 1;
    const def2: TestResult = { ...pd.def, sl: pd.def.sl + 1 };
    const opp = resolveOpposed(def2, pd.atk!);
    set({ pendingDisengage: { ...pd, def: def2, result: disengageOutcome(opp.winner) }, battle: { ...battle } });
  },
```

`castBonusSL` (après `castReroll`) :
```ts
  /** Chance « +1 DR » : +1 DR à l'incantation figée (peut franchir le NI), cumulable. */
  castBonusSL: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1;
    const res = rederiveCastSL(caster, target, spell, pc.result, pc.missile, pc.focused, 1);
    set({ pendingCast: { ...pc, result: res }, battle: { ...battle } });
  },
```

- [ ] **Step 6 : Lancer → succès + suite**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS.

- [ ] **Step 7 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(combat): dépense de Chance « +1 DR » cumulable sur les 5 flux (LDB ch.17 l.26)"
```

---

### Task 6 : UI — composant partagé `ChanceButtons` (relance + +1 DR) dans les 5 modales

**Files:**
- Create: `src/ui/ChanceButtons.tsx`
- Modify: `src/ui/RollModal.tsx`, `DefenseModal.tsx`, `CastModal.tsx`, `TestModal.tsx`, `DisengageModal.tsx`

Plutôt que de dupliquer les boutons Chance dans 5 modales (legacy : chacune avait son bloc inline), on extrait **un composant partagé** rendant la relance **et** le « +1 DR », et on remplace le bouton « 🍀 Chance » inline (gaté à la Task 3) par ce composant dans chaque modale.

- [ ] **Step 1 : Créer `src/ui/ChanceButtons.tsx`**

```tsx
/**
 * Boutons de dépense de Chance partagés par les modales de jet (LDB « Destin et Résistance »
 * ch.17 l.22-28) : « Relancer » (uniquement si le jet propre est raté et pas déjà relancé) et
 * « +1 DR » (cumulable). Rien ne s'affiche s'il ne reste aucun Point de Chance.
 */
export function ChanceButtons({
  fortune,
  rerollable,
  onReroll,
  onBonusSL,
}: {
  fortune: number;
  rerollable: boolean;
  onReroll: () => void;
  onBonusSL: () => void;
}) {
  if (fortune <= 0) return null;
  return (
    <>
      {rerollable && (
        <button className="btn" onClick={onReroll} title="Dépense un point de Chance pour relancer le jet (LDB Destin)">
          🍀 Relancer ({fortune})
        </button>
      )}
      <button className="btn" onClick={onBonusSL} title="Dépense un point de Chance pour ajouter +1 DR (LDB Destin)">
        ➕ +1 DR ({fortune})
      </button>
    </>
  );
}
```

- [ ] **Step 2 : `RollModal.tsx`** — importer le composant + l'action, remplacer le bloc inline.

Imports : `import { ChanceButtons } from './ChanceButtons';`. Hook : `const bonusSL = useGame((s) => s.attackBonusSL);`.
Dans `.modal-actions` (phase résultat), remplacer le bloc `{fortune > 0 && rerollable && (<button …>🍀 Chance…</button>)}` (posé à la Task 3) par :
```tsx
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
```

- [ ] **Step 3 : `DefenseModal.tsx`** — `import { ChanceButtons } from './ChanceButtons';` ; `const bonusSL = useGame((s) => s.defenseBonusSL);` ; remplacer le bloc Chance inline par `<ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />`.

- [ ] **Step 4 : `CastModal.tsx`** — `import { ChanceButtons } from './ChanceButtons';` ; `const bonusSL = useGame((s) => s.castBonusSL);` ; même remplacement.

- [ ] **Step 5 : `TestModal.tsx`** — `import { ChanceButtons } from './ChanceButtons';` ; `const bonusSL = useGame((s) => s.testBonusSL);` ; même remplacement.

- [ ] **Step 6 : `DisengageModal.tsx`** — `import { ChanceButtons } from './ChanceButtons';` ; `const bonusSL = useGame((s) => s.disengageBonusSL);` ; même remplacement (phase 'esquive').

- [ ] **Step 7 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/ui/ChanceButtons.tsx src/ui/RollModal.tsx src/ui/DefenseModal.tsx src/ui/CastModal.tsx src/ui/TestModal.tsx src/ui/DisengageModal.tsx
git commit -m "feat(ui): composant partagé ChanceButtons (relance + « +1 DR ») dans les 5 modales"
```

---

## Phase 3 — Détermination (retirer un État)

### Task 7 : Action store `battleSpendResolve` + types

**Files:**
- Modify: `src/state/store.ts` (union `BattleState.action` l.165 + signature `battleSelectAction` l.228 ; l.591 ; déclaration `GameState` ; nouvelle action)
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)**

Ajouter un `describe` :
```ts
describe('Détermination (Resolve) — retirer un État (LDB ch.17 l.62-66)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  const mkBattle = (h: Combatant, over = {}): BattleState => ({
    combatants: [h], order: [h.id], turn: 0, round: 1, action: null, selectedSpell: null,
    reachable: new Map(), moved: false, acted: false, log: [], over: null, ...over,
  });

  it('retire un État et ne consomme pas l’Action ; décrémente la Détermination', () => {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    h.resolve = 2;
    h.conditions = [{ name: 'Aveuglé', value: 1 }];
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleSpendResolve('Aveuglé');
    const b = useGame.getState().battle!;
    expect(b.combatants[0].conditions.find((c) => c.name === 'Aveuglé')).toBeUndefined();
    expect(b.combatants[0].resolve).toBe(1);
    expect(b.acted).toBe(false); // ne coûte pas l'Action
  });

  it('retirer À Terre fait regagner 1 PB (l.66)', () => {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    h.resolve = 1;
    h.conditions = [{ name: 'À Terre', value: 1 }];
    h.wounds = { current: 5, max: 12 };
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleSpendResolve('À Terre');
    const c0 = useGame.getState().battle!.combatants[0];
    expect(c0.conditions.find((c) => c.name === 'À Terre')).toBeUndefined();
    expect(c0.wounds.current).toBe(6); // +1 PB
  });

  it('sans Détermination : aucun effet', () => {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    h.resolve = 0;
    h.conditions = [{ name: 'Aveuglé', value: 1 }];
    useGame.setState({ mode: 'battle', battle: mkBattle(h) });
    useGame.getState().battleSpendResolve('Aveuglé');
    expect(useGame.getState().battle!.combatants[0].conditions.find((c) => c.name === 'Aveuglé')).toBeTruthy();
  });
});
```

- [ ] **Step 2 : Lancer → échec** (`battleSpendResolve` introuvable).

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Étendre l'union `BattleState.action`** (l.165) :
```ts
  action: 'move' | 'attack' | 'cast' | 'focus' | 'charge' | 'use' | 'resolve' | 'pickup' | null;
```
Et la signature `battleSelectAction` dans `GameState` (l.228) :
```ts
  battleSelectAction: (a: 'move' | 'attack' | 'cast' | 'focus' | 'charge' | 'use' | 'resolve' | 'pickup' | null) => void;
```

- [ ] **Step 4 : Autoriser le mode `resolve` même Sonné** — modifier `battleSelectAction` l.591 :
```ts
    // Sonné : pas d'Action (attaque/incantation) ; déplacement ET Détermination restent possibles
    // (la Détermination ne coûte pas l'Action et peut retirer le Sonné lui-même, LDB ch.17 l.62-66).
    if (a !== 'move' && a !== 'resolve' && a !== null && !canTakeAction(active)) return;
```

- [ ] **Step 5 : Déclarer l'action dans `GameState`** (après `battleDefendTotal` l.242) :
```ts
  /** Détermination (Resolve, LDB ch.17 l.62-66) : retire un État de l'actif (+1 PB si À Terre).
   *  Ne consomme PAS l'Action. */
  battleSpendResolve: (conditionName: string) => void;
```

- [ ] **Step 6 : Implémenter** (placer après `battleDefendTotal`, l.~772) :
```ts
  battleSpendResolve: (conditionName) => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || (active.resolve ?? 0) <= 0) return;
    if (!active.conditions.some((c) => c.name === conditionName)) return;
    active.resolve = (active.resolve ?? 0) - 1;
    removeCondition(active, conditionName, 1); // « Retirez un État » (un pion), LDB ch.17 l.64
    let extra = '';
    if (conditionName === 'À Terre') {
      active.wounds.current = Math.min(active.wounds.max, active.wounds.current + 1); // +1 PB en se relevant (l.66)
      extra = ' (+1 PB en se relevant)';
    }
    set({ battle: { ...battle, action: null, log: [...battle.log, `${active.name} puise dans sa Détermination : retire l'État ${conditionName}${extra}.`] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
```

- [ ] **Step 7 : Lancer → succès + suite**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS.

- [ ] **Step 8 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(combat): Détermination — retirer un État (+1 PB si À Terre), action gratuite (LDB ch.17 l.62-66)"
```

---

### Task 8 : UI — slot « Détermination » + sous‑liste d'États (hotbar)

**Files:**
- Modify: `src/ui/ActionBar.tsx`

- [ ] **Step 1 : Hooks + données.** Dans `ActionBar`, ajouter le hook et la dispo :
```ts
  const spendResolve = useGame((s) => s.battleSpendResolve);
```
Après `const usableGroups = ...` :
```ts
  const resolve = isHero ? active.resolve ?? 0 : 0;
  const removableConditions = isHero && resolve > 0 ? active.conditions : [];
```

- [ ] **Step 2 : Sous‑liste (mode `resolve`)** — après le bloc `usableGroups.length > 0 && battle.action === 'use'` :
```tsx
      {removableConditions.length > 0 && battle.action === 'resolve' && (
        <div className="ab-spells">
          {removableConditions.map((c) => (
            <div key={c.name} className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => spendResolve(c.name)} title="Dépense un point de Détermination pour retirer cet État (LDB Destin)">
                ✊ Retirer {c.name}{c.value > 1 ? ` (${c.value})` : ''}
              </button>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 3 : Slot hotbar** — dans `.ab-slots`, juste avant le slot « Se désengager »/« Fin du tour » :
```tsx
            {removableConditions.length > 0 && (
              <button
                className={`ab-slot ${battle.action === 'resolve' ? 'on' : ''}`}
                onClick={() => selectAction(battle.action === 'resolve' ? null : 'resolve')}
                title="Détermination : retirer un État (ne coûte pas l'Action) — LDB Destin"
              >
                <span className="ab-ico">✊</span>
                <span className="ab-lbl">Détermination ({resolve})</span>
              </button>
            )}
```

- [ ] **Step 4 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/ui/ActionBar.tsx
git commit -m "feat(ui): slot hotbar « Détermination » (retirer un État, gaté sur Resolve & États présents)"
```

---

## Phase 4 — Ramasser un objet au sol (un à la fois)

### Task 9 : Action store `battlePickup` + types

**Files:**
- Modify: `src/state/store.ts` (union `action` déjà élargie Task 7 ; déclaration `GameState` ; nouvelle action + helper module `entityPickables`)
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)**

Ajouter un `describe` :
```ts
describe('Ramasser un objet au sol en combat (un à la fois, LDB ch.13 l.115-116)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setupAmbush() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    const scene = emptyScene(8, 8);
    scene.id = 'pickup-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({ id: 'corps', kind: 'objet', pos: { x: 1, y: 0 }, label: 'Cocher',
      search: [{ type: 'journal', text: 'Son tromblon repose à côté.' }, { type: 'giveTrapping', trapping: 'Dague' }, { type: 'giveTrapping', trapping: 'Tromblon' }] });
    scene.encounters.push({ id: 'enc', enemies: [{ ref: 'Mutant', pos: { x: 6, y: 6 } }] } as never);
    useGame.getState().startScene(scene);
    useGame.getState().seedRng(3);
    useGame.getState().startCombat('enc');
    vi.clearAllTimers();
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    H.pos = { x: 0, y: 0 }; // adjacent à corps (1,0)
    const turn = st.battle!.order.indexOf(H.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'pickup', moved: false, acted: false } });
    return H;
  }

  it('ramasse UN objet : il arrive dans l’inventaire du héros (battle + party), consomme l’Action', () => {
    const H = setupAmbush();
    useGame.getState().battlePickup('corps', 'trap:2'); // l'index 2 du search = Tromblon
    const st = useGame.getState();
    const bH = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect((bH.items ?? []).some((i) => i.name === 'Tromblon')).toBe(true); // utilisable ce combat
    expect((st.party[0].items ?? []).some((i) => i.name === 'Tromblon')).toBe(true); // persiste
    expect((bH.items ?? []).some((i) => i.name === 'Dague')).toBe(false); // un seul objet
    expect(st.battle!.acted).toBe(true); // coûte l'Action
    // le giveTrapping consommé est retiré du pool de l'entité
    const corps = st.scene!.entities.find((e) => e.id === 'corps')!;
    expect((corps.search ?? []).some((e) => e.type === 'giveTrapping' && e.trapping === 'Tromblon')).toBe(false);
    expect((corps.search ?? []).some((e) => e.type === 'giveTrapping' && e.trapping === 'Dague')).toBe(true);
  });

  it('refusé si l’Action est déjà consommée', () => {
    const H = setupAmbush();
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    useGame.getState().battlePickup('corps', 'trap:2');
    const bH = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((bH.items ?? []).some((i) => i.name === 'Tromblon')).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer → échec** (`battlePickup` introuvable).

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Déclarer l'action dans `GameState`** (après `battleSpendResolve`) :
```ts
  /** Ramasser UN objet au sol pendant un Round (LDB ch.13 l.115-116) : applique au combattant
   *  actif un item ramassable d'une entité `objet` adjacente. Consomme l'Action, pas d'auto-équipe.
   *  `key` = `trap:<index dans search>` ou `loot:<index dans loot>`. */
  battlePickup: (entityId: string, key: string) => void;
```

- [ ] **Step 4 : Helper module + implémentation** — ajouter un helper près des autres (avant `useGame`, à côté de `removeEntity`) :
```ts
/** Items ramassables d'une entité `objet` : noms de `loot` + trappings du `search`.
 *  `key` = `loot:<i>` (nom dans inventaire de groupe) ou `trap:<i>` (vrai objet à stats). */
function entityPickables(ent: { loot?: string[]; search?: Effect[] }): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  (ent.loot ?? []).forEach((name, i) => out.push({ key: `loot:${i}`, label: name }));
  (ent.search ?? []).forEach((e, i) => {
    if (e.type === 'giveTrapping') out.push({ key: `trap:${i}`, label: e.trapping });
  });
  return out;
}
```
Exporter pour l'UI :
```ts
export { entityPickables };
```
Implémenter l'action (placer après `battleSpendResolve`) :
```ts
  battlePickup: (entityId, key) => {
    const { battle, scene } = get();
    if (!battle || battle.over || battle.acted || !scene) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !canTakeAction(active)) return; // ramasser = une Action
    if (get().flags[`__fouille_${entityId}`]) return; // déjà entièrement fouillé en exploration
    const ent = scene.entities.find((e) => e.id === entityId && e.kind === 'objet');
    if (!ent || !active.pos || chebyshev(active.pos, ent.pos) > 1) return; // doit être adjacent/sur la case
    const [kind, idxStr] = key.split(':');
    const idx = Number(idxStr);
    let label = '';
    if (kind === 'loot') {
      const name = (ent.loot ?? [])[idx];
      if (!name) return;
      label = name;
      ent.loot = (ent.loot ?? []).filter((_, i) => i !== idx); // consommé du pool
      set((s) => ({ inventory: [...s.inventory, name] }));
    } else if (kind === 'trap') {
      const eff = (ent.search ?? [])[idx];
      if (!eff || eff.type !== 'giveTrapping') return;
      const it = itemFromTrapping(eff.trapping);
      if (!it) { get().log(`Objet inconnu : « ${eff.trapping} ».`); return; }
      label = it.name;
      // ajout NON équipé au combattant actif (clone battle) ET au membre party (persiste).
      active.items = [...(active.items ?? []), it];
      recomputeLoadout(active);
      ent.search = (ent.search ?? []).filter((_, i) => i !== idx); // retire du pool partagé
      set((s) => ({
        party: s.party.map((h) => {
          if (h.id !== active.id) return h;
          const clone: Combatant = JSON.parse(JSON.stringify(h));
          clone.items = [...(clone.items ?? []), itemFromTrapping(eff.trapping)!];
          recomputeLoadout(clone);
          return clone;
        }),
      }));
    } else return;
    set({ scene: { ...scene }, battle: { ...battle, acted: true, action: null, log: [...battle.log, `${active.name} ramasse : ${label}.`] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
```

- [ ] **Step 5 : Lancer → succès + suite**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS.

- [ ] **Step 6 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(combat): action Ramasser un objet au sol (un à la fois, persiste party, consomme l'Action)"
```

---

### Task 10 : UI — slot « Ramasser » + sous‑liste d'objets au sol

**Files:**
- Modify: `src/ui/ActionBar.tsx`

- [ ] **Step 1 : Hooks + données.** Ajouter :
```ts
import { entityPickables, useGame, activeCombatant } from '../state/store';
```
(fusionner avec l'import existant `useGame, activeCombatant`). Ajouter le hook scène + flags + l'action :
```ts
  const scene = useGame((s) => s.scene);
  const flags = useGame((s) => s.flags);
  const pickup = useGame((s) => s.battlePickup);
```
Après `removableConditions` :
```ts
  // Objets au sol ramassables sur/adjacents à la case du combattant actif.
  const groundItems = isHero && active.pos
    ? (scene?.entities ?? [])
        .filter((e) => e.kind === 'objet' && Math.max(Math.abs(e.pos.x - active.pos!.x), Math.abs(e.pos.y - active.pos!.y)) <= 1 && !flags[`__fouille_${e.id}`])
        .flatMap((e) => entityPickables(e).map((p) => ({ entityId: e.id, ...p })))
    : [];
```

- [ ] **Step 2 : Sous‑liste (mode `pickup`)** — après la sous‑liste `resolve` :
```tsx
      {groundItems.length > 0 && battle.action === 'pickup' && (
        <div className="ab-spells">
          {groundItems.map((g) => (
            <div key={`${g.entityId}:${g.key}`} className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => pickup(g.entityId, g.key)} title="Ramasser cet objet (coûte l'Action) — LDB Combat">
                ✋ {g.label}
              </button>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 3 : Slot hotbar** — avant « Fin du tour » :
```tsx
            {groundItems.length > 0 && (
              <button
                className={`ab-slot ${battle.action === 'pickup' ? 'on' : ''}`}
                disabled={battle.acted || stunned}
                onClick={() => selectAction(battle.action === 'pickup' ? null : 'pickup')}
                title="Ramasser un objet au sol adjacent (coûte l'Action) — LDB Combat"
              >
                <span className="ab-ico">✋</span>
                <span className="ab-lbl">Ramasser{battle.acted && ' ✓'}</span>
              </button>
            )}
```

- [ ] **Step 4 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/ui/ActionBar.tsx
git commit -m "feat(ui): slot hotbar « Ramasser » + sous-liste des objets au sol adjacents"
```

---

## Task 11 : Finalisation — suite complète, ROADMAP, recette navigateur

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1 : Suite + typecheck + lint complets**

Run: `npm test`
Expected: tous verts.
Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 2 : Recette navigateur (Playwright)** — `npm run dev`, charger `localhost:5173`, « 🧪 Test rapide », puis Chapitre 2 (ambuscade). Vérifier (console 0 erreur, screenshots) :
  1. Héros adjacent au **second cocher** → slot **Ramasser** → choisir **Tromblon** (seul) ; l'Action passe à « ✓ », le Tromblon est à l'inventaire (fiche), la Chemise reste ramassable.
  2. Une attaque ratée (d100 > cible) : « 🍀 Chance » présent **une fois** ; après relance, il disparaît ; sur un jet réussi il n'apparaît pas.
  3. « ➕ +1 DR » : sur une attaque, le DR net et les dégâts augmentent ; sur une incantation marginale, franchit le NI.
  4. **Détermination** : poser « À Terre » sur un héros (ou attendre un Critique) → slot **Détermination** → retirer « À Terre » → +1 PB, Action **non** consommée.
  *(Hard reload pour purger un HMR périmé.)*

- [ ] **Step 3 : Mettre à jour `ROADMAP.md`** — section « Dette technique connue » : retirer/cocher « action “ramasser” en plein combat », « Détermination & ajout direct de DR », et noter le fix de relance. Exemple, remplacer la puce « Combat — reste » :
```md
- **Combat — reste** : ✅ **« ramasser » en plein combat** (un objet au sol à la fois, réutilise `objet`/`search`, persiste party) ; ✅ **Chance étendue** : relance **1×/Test sur jet propre raté** (fix), **+1 DR** cumulable, **Détermination** = retirer un État (+1 PB si À Terre). Reste : **tables de Critiques & Maladresses** (LDB p.172+, laissées au MJ) ; ligne de vue / couvert / rechargement / munitions ; Destin/Résilience sacrifiés.
```
Et la puce « ✅ Dépense de Chance en jeu … Reste : Détermination, ajout direct de DR » → « ✅ Dépense de Chance : relance (1×, sur échec), **+1 DR** et **Détermination** (retirer un État). »

- [ ] **Step 4 : Commit ROADMAP**

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): profondeur combat — Chance (relance fix/+1 DR), Détermination, Ramasser"
```

---

## Auto‑revue du plan (effectuée)

- **Couverture spec :** relance 1×/échec (Tasks 1‑3) · +1 DR cumulable (Tasks 4‑6) · Détermination retirer un État +1 PB (Tasks 7‑8) · Ramasser un à la fois, persiste party, pas d'auto‑équipe (Tasks 9‑10) · ROADMAP + recette (Task 11). ✓
- **Décalage assumé vs spec :** pas de `applyBonusSL` séparé — le +1 DR est **incrémental** (on bumpe le DR courant et on rejoue `finishMelee`/`resolveOpposed`/helpers), ce qui rend le cumul trivial et évite de stocker `bonusSL`. La relance **réinitialise** le DR acheté (nouveau jet). ✓
- **Cohérence des types :** `rerolled?: boolean` ajouté aux 5 pending ; `BattleState.action` + signature `battleSelectAction` étendues de `'resolve' | 'pickup'` ; nouvelles actions déclarées dans `GameState` ; helpers exportés `rederivePassiveAttack`, `rederiveCastSL`, `evaluateCasting`, `evaluateMissile`, `entityPickables`. ✓
- **Pièges traités :** persistance party au ramassage (les clones `battle` ne sont jamais resync) ; `battleSelectAction` l.591 whiteliste `'resolve'` (utilisable Sonné) ; le test de relance de défense existant peut nécessiter une fixture à défense ratée (noté Task 2 Step 10). ✓
- **Simplifications documentées :** IA ne dépense ni Chance ni Détermination ; Détermination #1/#2 non branchés ; pas de drop auto ; dépense de Chance/Resolve en combat mutée sur le clone (gap persistance Jalon 5, comme les relances existantes).
