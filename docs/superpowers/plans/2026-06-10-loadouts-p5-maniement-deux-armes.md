# Loadouts — Plan #5 : talent « Maniement de deux armes »

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps en checkbox (`- [ ]`).
> **RISK-GATE** : touche le cœur d'attaque (applyAttackResult, file de modales, défense). TDD strict ; moteur
> PUR d'abord ; suite verte + tsc clean après CHAQUE task. Committer mes seuls fichiers (pathspec, arbre partagé).

**Goal:** Le héros qui a le talent **Maniement de deux armes** et tient 2 armes de mêlée à 1 main peut, **pour son
Action**, frapper de la main directrice puis — si elle touche — d'une 2ᵉ attaque de la main secondaire contre une
cible au choix (d100 **inversé** + pénalité de main 2nde, **nouvelle défense**, exception Critique), avec **−10 à
toutes ses défenses jusqu'à son prochain Tour** et **Avantage seulement si les deux touchent**.

**Architecture:** Le talent devient une entrée du registre `combatFeatures/` exposant le hook `attackModes`
(seam prévu §4.3). La 2ᵉ attaque est résolue par `resolveDualSecond` (combatFlow.ts) qui réutilise
`attackEnv`/`attackModifiers`/`finishMelee` avec un **jet d'attaquant imposé** (inversé/critique) et un **jet de
défense frais**. Le flux : attaque-Action normale en mode dual → à la confirmation, si la main directrice touche,
ouverture d'un sélecteur de 2ᵉ cible (`pendingDualStrike`, calqué sur `pendingCleave`) → 2ᵉ attaque (pendingAttack
pré-résolu) → application. L'Avantage de l'attaquant est **différé** sur les deux attaques puis accordé seulement
si les deux touchent. Le −10 défensif est un flag **par combattant** (`dualStrikeDefensePenalty`) posé à la
confirmation de l'Action dual et purgé au début du Tour de ce combattant.

**Tech Stack:** TS, React, Zustand, Vitest. Réf RAW : **LDB 10 l.638** (« Maniement de Deux Armes », Maxi = Bonus
d'Agilité) ; off-hand penalty LDB 14 l.181 ; Ambidextre LDB 10 l.30-32. Spec : `…/specs/2026-06-10-loadouts-deux-armes-design.md` §5.5.
**Commandes :** `npx vitest run <fichier>` ; `npm test` ; `npm run typecheck`.

---

## Cadre RAW (LDB 10 l.638 — cité)

> « Quand vous êtes équipé de deux armes, vous pouvez attaquer avec les deux **pour votre Action**. Effectuez un
> lancer pour toucher avec l'arme tenue par votre **main principale**. Si vous touchez, déterminez les Dégâts
> normalement, mais **conservez votre lancer de dés**. Si la première frappe est réussie, **une fois résolue**,
> l'arme dans votre main secondaire peut viser **un adversaire disponible de votre choix** en utilisant **le même
> lancer, mais inversé** (34 → 43). Modifiez ce second lancer avec la **pénalité de mauvaise main** (−20 sauf
> Ambidextre). Cette seconde attaque est opposée à **un nouveau lancer de défense** ; Dégâts normaux. **Exception
> Critique** : si la première est un Critique, utilisez **le lancer du tableau des Critiques** comme jet de la
> seconde. **−10 à tous vos lancers défensifs jusqu'au début de votre prochain Tour.** Vous **ne gagnez pas
> d'Avantage** … **sauf si les deux attaques touchent**. »

**Décisions de bornage (figées, spec §3/§5.5/§5.6) :**
- **Mode proposé seulement** : attaquant héros + talent présent + **2 armes de MÊLÉE à 1 main** (main `hand:'main'`,
  off `hand:'off'`, toutes deux `type:'melee'`, `hands===1`) + c'est l'**attaque-Action** (jamais une attaque
  GRATUITE : pas de Frénésie/cleave/Piétinement, pas d'enchaînement `pa.cleave`, pas de `pa.free`).
- **Ranged hors v1** : pas de deux pistolets (le « nouveau lancer de défense » est une mécanique de mêlée). Documenté.
- La 2ᵉ attaque est **optionnelle** (« peut viser ») : le sélecteur offre **Renoncer**. Sans cible dispo → pas de 2ᵉ.
- Le **−10 défensif** s'applique dès qu'on **choisit** d'attaquer des deux armes (à la confirmation de l'Action),
  que la main directrice touche ou non.

---

## Phase 0 — Registre : hook `attackModes` + entrée « Maniement de deux armes »

### Task 1 : `attackModes` dans le registre de capacités

**Files:**
- Modify: `src/engine/combatFeatures/types.ts`
- Modify: `src/engine/combatFeatures/registry.ts`
- Modify: `src/engine/combatFeatures/dispatch.ts`
- Test: `src/engine/combatFeatures/dispatch.test.ts`

- [ ] **Step 1 : test qui échoue** — ajouter à `src/engine/combatFeatures/dispatch.test.ts` :
```ts
import { attackModesFor } from './dispatch';
// … dans le describe existant :
it('attackModesFor : héros avec Maniement de deux armes → contient "dual-wield"', () => {
  const c = { talents: [{ name: 'Maniement de deux armes', times: 1 }] } as any;
  expect(attackModesFor(c)).toContain('dual-wield');
});
it('attackModesFor : sans le talent → vide', () => {
  expect(attackModesFor({ talents: [] } as any)).toEqual([]);
});
```

- [ ] **Step 2 : lancer → FAIL** : `npx vitest run src/engine/combatFeatures/dispatch.test.ts` (attackModesFor absent).

- [ ] **Step 3 : hook dans `types.ts`** — ajouter à `interface CombatFeature` (après `modifyOffHandPenalty?`) :
```ts
  /** Modes d'attaque ajoutés par la capacité (Maniement de deux armes → 'dual-wield'). */
  attackModes?: (ctx: CombatFeatureCtx) => string[];
```

- [ ] **Step 4 : entrée registre** (`registry.ts`, dans `COMBAT_FEATURES`, après `Ambidextre`) :
```ts
  // Maniement de deux armes (LDB 10 l.638) : ajoute le mode d'attaque « des deux armes » (frappe off-hand
  // conditionnelle, d100 inversé). Maxi = Bonus d'Agilité (le niveau ne change pas l'effet → binaire).
  'Maniement de deux armes': {
    key: 'Maniement de deux armes',
    kind: 'talent',
    attackModes: () => ['dual-wield'],
  },
```

- [ ] **Step 5 : dispatch** (`dispatch.ts`, après `offHandPenalty`) :
```ts
/** Modes d'attaque conférés par les capacités du combattant (ex. 'dual-wield' via Maniement de deux armes). */
export function attackModesFor(c: Combatant): string[] {
  const out: string[] = [];
  for (const { def, ctx } of featuresOf(c)) if (def.attackModes) out.push(...def.attackModes(ctx));
  return out;
}
```

- [ ] **Step 6 : lancer → PASS** ; `npm run typecheck` → 0 ; `npm test` → PASS.

- [ ] **Step 7 : commit**
```
git add src/engine/combatFeatures/types.ts src/engine/combatFeatures/registry.ts src/engine/combatFeatures/dispatch.ts src/engine/combatFeatures/dispatch.test.ts
git commit -m "feat(combat): hook attackModes + entrée Maniement de deux armes (registre combatFeatures)"
```

---

## Phase A — Résolution PURE de la 2ᵉ attaque (off-hand, jet imposé)

### Task 2 : `resolveDualSecond` (jet inversé + pénalité main 2nde + défense fraîche)

**Files:**
- Modify: `src/state/combatFlow.ts` (nouvelle fonction exportée `resolveDualSecond`)
- Test: `src/state/dual-wield.test.ts` (nouveau)

`resolveDualSecond` reconstruit la 2ᵉ attaque à partir du jet de la 1ʳᵉ. Le `target` (valeur à toucher) est
calculé via le **même** `attackEnv`+`attackModifiers` que `previewAttack` (la pénalité de main secondaire est déjà
incluse car l'arme off porte `hand:'off'`, cf. plan #1). Le jet d'attaquant est **imposé** (inversé ou valeur du
tableau des Critiques) ; le défenseur fait un **jet frais** via `rollMeleeDefender`.

- [ ] **Step 1 : test qui échoue** (`src/state/dual-wield.test.ts`) :
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { resolveDualSecond } from './combatFlow';
import { reverseRoll } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';

const W = (uid: string, hand: 'main' | 'off'): Weapon =>
  ({ uid, name: hand === 'main' ? 'Épée' : 'Dague', type: 'melee', damage: '+BF', qualities: [], hand, hands: 1 });
const mkHero = (): Combatant => ({
  id: 'h', name: 'H', kind: 'hero', pos: { x: 0, y: 0 }, size: 3,
  characteristics: { CC: 50, CT: 30, F: 35, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
  skills: [], talents: [], advantage: 0, wounds: { base: 12, max: 12, current: 12 },
  weapons: [W('m', 'main'), W('o', 'off')], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);
const mkFoe = (id: string, x: number): Combatant => ({
  id, name: id, kind: 'enemy', pos: { x, y: 0 }, size: 3,
  characteristics: { CC: 30, CT: 20, F: 30, E: 30, I: 20, Ag: 20, Dex: 20, Int: 20, FM: 20, Soc: 20 },
  skills: [], talents: [], advantage: 0, wounds: { base: 10, max: 10, current: 10 },
  weapons: [{ name: 'Griffe', type: 'melee', damage: '+BF', qualities: [] }],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);

describe('resolveDualSecond : 2ᵉ attaque du Maniement de deux armes', () => {
  beforeEach(() => {
    const h = mkHero(); const f1 = mkFoe('f1', 1); const f2 = mkFoe('f2', 1);
    useGame.setState({
      battle: { combatants: [h, f1, f2], order: ['h', 'f1', 'f2'], turn: 0, round: 1, log: [],
        acted: false, movementUsed: 0, movedPreAction: false, loadoutSwapped: false, reachable: new Map() } as any,
      pendingReveals: [],
    });
  });
  it('utilise le jet INVERSÉ de la main directrice comme jet de la 2ᵉ attaque', () => {
    const b = useGame.getState().battle!;
    const h = b.combatants.find((c) => c.id === 'h')!;
    const f2 = b.combatants.find((c) => c.id === 'f2')!;
    const off = h.weapons.find((w) => w.hand === 'off')!;
    const res = resolveDualSecond(useGame.getState, h, f2, off, 34); // 34 → 43
    expect(res.attackerRoll).toBe(reverseRoll(34)); // 43
  });
  it('exception Critique : utilise la valeur du tableau des Critiques, pas l’inversion', () => {
    const b = useGame.getState().battle!;
    const h = b.combatants.find((c) => c.id === 'h')!;
    const f2 = b.combatants.find((c) => c.id === 'f2')!;
    const off = h.weapons.find((w) => w.hand === 'off')!;
    const res = resolveDualSecond(useGame.getState, h, f2, off, 11, { critValue: 56 });
    expect(res.attackerRoll).toBe(56);
  });
});
```

- [ ] **Step 2 : lancer → FAIL** : `npx vitest run src/state/dual-wield.test.ts` (resolveDualSecond absent).

- [ ] **Step 3 : implémenter `resolveDualSecond`** dans `src/state/combatFlow.ts` (près de `resolveAttack`).
Vérifier les imports en tête de fichier : `evaluateTest` (depuis `../engine/tests`), `reverseRoll`, `finishMelee`,
`rollMeleeDefender`, `combatValue`, `attackModifiers`, `bestDefenseMode`, `combineMods` — les ajouter aux imports
existants s'ils manquent (`reverseRoll` déjà importé l.27 ; `finishMelee`/`rollMeleeDefender`/`combatValue`/
`attackModifiers` sont du même module `../engine/combat` — confirmer et compléter l'import).
```ts
/** 2ᵉ attaque du Maniement de deux armes (LDB 10 l.638). Jet d'attaquant IMPOSÉ : `reverseRoll(mainRoll)`,
 *  ou `critValue` (valeur du tableau des Critiques) si la 1ʳᵉ frappe était un Critique. Le `target` (valeur à
 *  toucher) inclut déjà la pénalité de main secondaire (l'arme `off` porte `hand:'off'`). Le défenseur fait un
 *  NOUVEAU jet de défense. Pur (déterministe sur le RNG de combat). */
export function resolveDualSecond(
  get: () => GameState,
  attacker: Combatant,
  target: Combatant,
  offWeapon: Weapon,
  mainRoll: number,
  opts?: { critValue?: number; location?: HitLocation },
): AttackResult {
  const { env } = attackEnv(get, attacker, target, offWeapon, {});
  const mods = attackModifiers(attacker, target, offWeapon, { kind: 'melee', location: opts?.location, env });
  const toHit = combatValue(attacker, 'melee', offWeapon) + combineMods(mods);
  const atkRoll = opts?.critValue != null ? opts.critValue : reverseRoll(mainRoll);
  const atk = evaluateTest(atkRoll, toHit); // { roll, target, success, sl, isDouble }
  const mode = bestDefenseMode(target);
  if (mode === 'none') return resolveMeleePassive(attacker, target, offWeapon, atk, opts?.location, env);
  const def = rollMeleeDefender(target, mode, battleRng()); // NOUVEAU jet de défense (LDB 10 l.638)
  return finishMelee(attacker, target, offWeapon, atk, def, mode, opts?.location, env);
}
```
(Vérifier que `resolveMeleePassive` et `evaluateTest` sont importés — `resolveMeleePassive` de `../engine/combat`,
`evaluateTest` de `../engine/tests`. `HitLocation` est déjà importé.)

- [ ] **Step 4 : lancer → PASS** ; `npm run typecheck` → 0 ; `npm test` → PASS.

- [ ] **Step 5 : commit**
```
git add src/state/combatFlow.ts src/state/dual-wield.test.ts
git commit -m "feat(combat): resolveDualSecond -- 2e attaque du Maniement (jet inverse/critique + defense fraiche)"
```

---

## Phase B — Câblage store (état, chaînage, −10 défense, Avantage gating)

### Task 3 : état — `dualMode`/`dualSecond`, `PendingDualStrike`, `dualStrikeDefensePenalty`, defer Avantage

**Files:**
- Modify: `src/state/pendings.ts` (champs `PendingAttack` + nouvelle interface `PendingDualStrike`)
- Modify: `src/engine/types.ts` (`Combatant.dualStrikeDefensePenalty?`)
- Modify: `src/state/combatFlow.ts` (`applyAttackResult` : param `deferAttackerAdvantage`)
- Test: `src/state/dual-wield.test.ts` (defer Avantage)

- [ ] **Step 1 : champs `PendingAttack`** (`pendings.ts`, dans `interface PendingAttack`) :
```ts
  /** Attaque-Action en mode « des deux armes » (main directrice) : chaîne une 2ᵉ attaque si elle touche. */
  dualMode?: boolean;
  /** Cette attaque EST la 2ᵉ frappe (off-hand) d'un Maniement de deux armes : jet imposé, pas de relance. */
  dualSecond?: boolean;
```

- [ ] **Step 2 : `PendingDualStrike`** (`pendings.ts`, après `PendingCleave`) :
```ts
/** Sélection de la 2ᵉ cible du Maniement de deux armes (LDB 10 l.638), après une 1ʳᵉ frappe RÉUSSIE.
 *  Calqué sur PendingCleave : le joueur clique une cible (ou renonce). `mainRoll` = jet conservé de la 1ʳᵉ
 *  frappe ; `critValue` = valeur du tableau des Critiques si la 1ʳᵉ était un Critique ; `mainAdvantage` =
 *  l'Avantage différé de la 1ʳᵉ frappe (accordé seulement si la 2ᵉ touche aussi). */
export interface PendingDualStrike {
  attackerId: string;
  offWeaponUid: string;
  mainRoll: number;
  critValue?: number;
  mainAdvantage: boolean;
}
```
Puis l'exporter depuis `store.ts` si le motif y ré-exporte les Pending* (suivre `PendingCleave`).

- [ ] **Step 3 : `Combatant.dualStrikeDefensePenalty?`** (`src/engine/types.ts`, dans `interface Combatant`, près
des autres flags transitoires de combat type `defensiveStance`) :
```ts
  /** Maniement de deux armes (LDB 10 l.638) : −10 à TOUTES ses défenses jusqu'au début de son prochain Tour. */
  dualStrikeDefensePenalty?: boolean;
```

- [ ] **Step 4 : test defer Avantage** (ajouter à `dual-wield.test.ts`) :
```ts
import { applyAttackResult } from './combatFlow';
it('applyAttackResult(deferAttackerAdvantage) : n’incrémente PAS l’Avantage de l’attaquant', () => {
  const b = useGame.getState().battle!;
  const h = b.combatants.find((c) => c.id === 'h')!;
  const f1 = b.combatants.find((c) => c.id === 'f1')!;
  const res = { hit: true, attackerRoll: 10, netSL: 2, critical: false, advantageTo: 'attacker',
    defenderDefeated: false, woundsLost: 0, location: 'corps', log: 'x' } as any;
  h.advantage = 0;
  applyAttackResult(useGame.getState, useGame.setState, h, f1, h.weapons[0], res, undefined, undefined, true);
  expect(h.advantage).toBe(0); // différé
});
```

- [ ] **Step 5 : param `deferAttackerAdvantage`** (`combatFlow.ts`, signature `applyAttackResult`) — ajouter en
**dernier** paramètre :
```ts
  prerolledCrit?: CriticalResolved,
  deferAttackerAdvantage?: boolean, // Maniement de deux armes : l'Avantage de l'attaquant est accordé à part (si les deux touchent)
): boolean {
```
puis garder le bloc `res.advantageTo === 'attacker'` (l.982-985) :
```ts
  if (res.advantageTo === 'attacker' && !deferAttackerAdvantage) {
    attacker.advantage += 1;
    attacker.gainedAdvThisRound = true;
  }
```
(NE PAS toucher les branches `defender` ni la perte d'Avantage sur Blessure — le RAW ne diffère QUE le gain de
l'attaquant.)

- [ ] **Step 6 : lancer → PASS** ; `npm run typecheck` → 0 ; `npm test` → PASS.

- [ ] **Step 7 : commit**
```
git add src/state/pendings.ts src/engine/types.ts src/state/combatFlow.ts src/state/dual-wield.test.ts
git commit -m "feat(combat): etat dual-wield (dualMode/dualSecond/PendingDualStrike/penalite defense) + defer Avantage"
```

### Task 4 : −10 à toutes les défenses (jet ET affichage) + purge au Tour

**Files:**
- Modify: `src/engine/combat.ts` (`rollMeleeDefender` l.381 ; `defenseModifiers` l.296)
- Modify: `src/state/combatFlow.ts` (purge dans l'avance de Tour, l.2007)
- Test: `src/state/dual-wield.test.ts`

- [ ] **Step 1 : test qui échoue** (ajouter à `dual-wield.test.ts`) :
```ts
import { rollMeleeDefender } from './combatFlow'; // ré-exporté ; sinon depuis '../engine/combat'
import { makeRNG } from '../engine/rng';
it('−10 défense : un défenseur avec le flag pare 10 plus bas qu’un défenseur sans', () => {
  const b = useGame.getState().battle!;
  const base = b.combatants.find((c) => c.id === 'f1')!; // CC 30, parade base
  const withPen = { ...base, dualStrikeDefensePenalty: true } as any;
  const a = rollMeleeDefender(base, 'parade', makeRNG(1));
  const c = rollMeleeDefender(withPen, 'parade', makeRNG(1));
  expect(a.target - c.target).toBe(10); // la cible (valeur à atteindre) baisse de 10
});
```
(NB : `rollTest(defVal, …, mod)` intègre `mod` dans `target`. Le test compare la valeur cible avec/sans flag.)

- [ ] **Step 2 : lancer → FAIL**.

- [ ] **Step 3 : `rollMeleeDefender`** (`combat.ts` l.381) — ajouter le terme au modificateur EN LIGNE
(« tous vos lancers défensifs », donc parade ET esquive) :
```ts
  const dualPen = defender.dualStrikeDefensePenalty ? -10 : 0; // Maniement de deux armes (LDB 10 l.638)
  return rollTest(defVal, 'intermediaire', rng, defender.advantage * 10 + combatTestPenalty(defender) + (defender.defensiveStance ? 20 : 0) + snow + offHand + dualPen);
```

- [ ] **Step 4 : `defenseModifiers`** (`combat.ts` l.296, parité d'AFFICHAGE) — avant le `return out` :
```ts
  if (defender.dualStrikeDefensePenalty) out.push({ label: 'Maniement deux armes', value: -10 });
```

- [ ] **Step 5 : purge au début du Tour** (`combatFlow.ts`, dans le bloc `if (newActive)` ~l.2007, à côté de
`newActive.defensiveStance = false`) :
```ts
    newActive.dualStrikeDefensePenalty = false; // expire « au début de votre prochain Tour » (LDB 10 l.638)
```
**Test de timing** (ajouter à `dual-wield.test.ts`) — vérifie que le flag survit aux tours adverses puis est
purgé au début du tour de son porteur :
```ts
it('le −10 est purgé au DÉBUT du prochain Tour du porteur (pas avant)', () => {
  const b = useGame.getState().battle!;
  const h = b.combatants.find((c) => c.id === 'h')!;
  h.dualStrikeDefensePenalty = true;
  useGame.setState({ battle: { ...b, turn: 0 } });
  useGame.getState().battleEndTurn(); // → tour de f1 : le flag de h DOIT rester
  expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(true);
  // … boucler jusqu'au prochain tour de h (turn revient à 0, nouveau round) → purgé
  useGame.getState().battleEndTurn(); // f2
  useGame.getState().battleEndTurn(); // fin de round → retour à h (après confirmRoundStart si nécessaire)
  // si une pause de début de round s'ouvre, la lever :
  if (useGame.getState().pendingRoundStart) useGame.getState().confirmRoundStart?.();
  expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(false);
});
```
> ⚠️ Si ce test révèle que l'avance de fin-de-Round (round boundary) ne passe PAS par le bloc `newActive` l.2007,
> ajouter la purge aussi au démarrage du Tour 0 (là où `defensiveStance`/per-tour est réinitialisé pour le
> combattant `order[0]`). La purge DOIT se faire au **Tour** du porteur, pas au début du Round (sinon un ennemi
> agissant avant lui au round suivant ne profiterait plus du −10). Faire passer le test avant de committer.

- [ ] **Step 6 : lancer → PASS** ; `npm run typecheck` → 0 ; `npm test` → PASS.

- [ ] **Step 7 : commit**
```
git add src/engine/combat.ts src/state/combatFlow.ts src/state/dual-wield.test.ts
git commit -m "feat(combat): -10 a toutes les defenses du dual-wield (jet+affichage) purge au prochain Tour"
```

### Task 5 : actions store — chaînage de l'Action dual & 2ᵉ attaque

**Files:**
- Modify: `src/state/store.ts` (`attackConfirm` ; nouvelles actions `dualStrikeAttack`, `dualStrikeSkip` ; type +
  `pendingDualStrike` dans l'état ; `attackReroll` borne `dualSecond` ; reset `pendingDualStrike` dans `reset()`)
- Test: `src/state/dual-wield.test.ts`

- [ ] **Step 1 : déclarer l'état** — dans l'interface du store (près de `pendingCleave: PendingCleave | null;`) :
```ts
  pendingDualStrike: PendingDualStrike | null;
  dualStrikeAttack: (targetId: string) => void;
  dualStrikeSkip: () => void;
```
initialiser `pendingDualStrike: null` partout où `pendingCleave: null` est initialisé (état initial **et**
`reset()`/`getInitialState` — suivre `pendingCleave`). Importer `PendingDualStrike`, `resolveDualSecond`,
`attackModesFor` (depuis `../engine/combatFeatures/dispatch`), `firedWeapon`.

- [ ] **Step 2 : `attackConfirm` — poser le −10 et chaîner** (`store.ts` ~l.1921). Juste APRÈS
`applyAttackResult(get, set, attacker, victim, weapon, pa.result)` et la gestion Maladresse/cleave, insérer le
bloc dual (le mode dual est exclusif d'un enchaînement cleave) :
```ts
      // Maniement de deux armes (LDB 10 l.638). La main directrice vient d'être appliquée ; on diffère son
      // Avantage (accordé à part si la 2ᵉ touche aussi) → re-jouer l'application avec defer si dualMode.
      // (Plus simple : on a appliqué SANS defer ci-dessus ; voir Step 3 pour l'application AVEC defer.)
```
> ⚠️ Pour respecter le defer Avantage, l'application de la main directrice en mode dual DOIT passer
> `deferAttackerAdvantage = true`. Restructurer `attackConfirm` ainsi (remplacer l'appel unique
> `applyAttackResult(get, set, attacker, victim, weapon, pa.result)` par une version qui passe le defer en mode dual) :
```ts
    if (attacker && target && victim) {
      const weapon = firedWeapon(attacker, target, pa.weaponUid);
      const prevActed = battle.acted;
      const isDualMain = !!pa.dualMode && !pa.dualSecond && attacker.kind === 'hero';
      const isDualSecond = !!pa.dualSecond;
      applyAttackResult(get, set, attacker, victim, weapon, pa.result, undefined, undefined, isDualMain || isDualSecond);
      // … (bloc Maladresse héros INCHANGÉ) …
      // … (maybeHeroCleave INCHANGÉ, mais ne PAS l'appeler en mode dual : un dual ne balaie pas) …
```
Concrètement, garder le `if (attacker.kind === 'hero' && attackerFumbled(pa.result)) { … } else { … }` mais
n'appeler `maybeHeroCleave` que si `!isDualMain && !isDualSecond`. Puis, à la fin du `if`, AVANT la gestion
Frénésie/heldGround, ajouter :
```ts
      // Action « des deux armes » : on a CHOISI d'attaquer des deux → −10 défense jusqu'au prochain Tour.
      if (isDualMain) {
        attacker.dualStrikeDefensePenalty = true;
        const mainRoll = pa.result.attackerDetail?.roll;
        const off = attacker.weapons.find((w) => w.hand === 'off' && w.type === 'melee' && (w.hands ?? 1) === 1);
        const mainAdvantage = pa.result.advantageTo === 'attacker';
        // 2ᵉ frappe SEULEMENT si la 1ʳᵉ a touché ET qu'une 2ᵉ arme existe (LDB 10 l.638 « si la première est réussie »).
        if (pa.result.hit && mainRoll != null && off) {
          // Exception Critique : récupérer la valeur du tableau des Critiques (révélation poussée par applyAttackResult).
          const critRev = get().pendingReveals.find((r) => r.kind === 'critical');
          const critValue = pa.result.critical ? critRev?.dice : undefined;
          set({ pendingDualStrike: { attackerId: attacker.id, offWeaponUid: off.uid!, mainRoll, critValue, mainAdvantage } });
        }
        set({ battle: { ...get().battle! } });
      }
      // Fin d'une 2ᵉ frappe : accorder l'Avantage si les DEUX ont touché, puis fermer.
      if (isDualSecond) {
        const ds = pendingDualBefore; // capturé avant set({pendingAttack:null}) — cf. Step 3
        const bothHit = !!ds && pa.result.hit; // ds n'existe que si la 1ʳᵉ a touché
        if (bothHit) {
          if (ds!.mainAdvantage) { attacker.advantage += 1; attacker.gainedAdvThisRound = true; }
          if (pa.result.advantageTo === 'attacker') { attacker.advantage += 1; attacker.gainedAdvThisRound = true; }
        }
        set({ pendingDualStrike: null, battle: { ...get().battle! } });
      }
```

- [ ] **Step 3 : capturer `pendingDualStrike` avant le reset** — en haut de `attackConfirm`, avant
`set({ pendingAttack: null })`, ajouter `const pendingDualBefore = get().pendingDualStrike;` (pour la branche
`isDualSecond` ci-dessus).

- [ ] **Step 4 : action `dualStrikeAttack`** (calquée sur `cleaveAttack`) :
```ts
  dualStrikeAttack: (targetId) => {
    const { battle, pendingDualStrike: ds } = get();
    if (!battle || !ds) return;
    const attacker = battle.combatants.find((c) => c.id === ds.attackerId);
    const target = battle.combatants.find((c) => c.id === targetId);
    if (!attacker || !target || isOutOfAction(target)) return;
    const off = attacker.weapons.find((w) => w.uid === ds.offWeaponUid);
    if (!off) { set({ pendingDualStrike: null }); return; }
    const res = resolveDualSecond(get, attacker, target, off, ds.mainRoll, { critValue: ds.critValue });
    set({ pendingAttack: { attackerId: attacker.id, targetId, location: res.location ?? null, result: res, dualSecond: true, weaponUid: off.uid } });
  },
  dualStrikeSkip: () => set({ pendingDualStrike: null }), // « peut viser » = optionnel (LDB 10 l.638) ; pas de 2ᵉ → pas d'Avantage
```

- [ ] **Step 5 : borner la relance** (`attackReroll`, début) — le jet de la 2ᵉ est imposé (inversé) :
```ts
    if (pa.dualSecond) return; // jet imposé (d100 inversé / tableau des Critiques) : pas de relance de Chance
```

- [ ] **Step 6 : test de bout-en-bout (chaînage)** (ajouter à `dual-wield.test.ts`) — main touche → pendingDualStrike
ouvert → `dualStrikeAttack` → pendingAttack `dualSecond` pré-résolu → `attackConfirm` → Avantage selon both-hit.
Utiliser une graine RNG déterministe et un héros à forte CC pour fiabiliser la touche. Schéma :
```ts
it('chaîne : main touche → sélecteur 2ᵉ cible → 2ᵉ frappe → fermeture', () => {
  // construire battle avec h (CC élevé, 2 armes mêlée, talent), f1 adjacent, f2 adjacent ;
  // pendingAttack { attackerId:h, targetId:f1, dualMode:true, result:<touche>, location:'corps' } ;
  // attackConfirm() → pendingDualStrike défini, attaquant.dualStrikeDefensePenalty===true ;
  // dualStrikeAttack('f2') → pendingAttack.dualSecond===true && result!=null ;
  // attackConfirm() → pendingDualStrike===null.
});
```
(Implémenter le corps avec les helpers `mkHero/mkFoe` ; forcer la touche en posant un `result` à la main pour la
1ʳᵉ — réutiliser le motif `useGame.setState({ pendingAttack })` des tests fumble/store.)

- [ ] **Step 7 : lancer → PASS** ; `npm run typecheck` → 0 ; `npm test` → PASS.

- [ ] **Step 8 : commit**
```
git add src/state/store.ts src/state/dual-wield.test.ts
git commit -m "feat(combat): chainage Maniement de deux armes -- pendingDualStrike + 2e frappe + Avantage si les deux touchent"
```

---

## Phase C — UI (toggle de mode + sélecteur de 2ᵉ cible)

### Task 6 : toggle « Des deux armes » dans la modale d'attaque

**Files:**
- Modify: `src/ui/RollModal.tsx`
- Modify: `src/state/store.ts` (action `attackSetDualMode`)
- Modify: `src/ui/styles.css` (réutiliser `.rm-loc-inline` ; pas de nouveau style obligatoire)

- [ ] **Step 1 : action `attackSetDualMode`** (`store.ts`, près de `attackSetWeapon`) :
```ts
  attackSetDualMode: (on: boolean) => void;
```
impl :
```ts
  attackSetDualMode: (on) => {
    const pa = get().pendingAttack;
    if (!pa || pa.result) return; // choix avant le jet
    set({ pendingAttack: { ...pa, dualMode: on } });
  },
```
(déclarer la signature dans l'interface du store).

- [ ] **Step 2 : éligibilité + toggle dans RollModal** (dans le bloc avant le jet, `!res`). Importer
`attackModesFor` (`../engine/combatFeatures/dispatch`). Calculer :
```tsx
  const setDual = useGame((s) => s.attackSetDualMode);
  const main = attacker.weapons.find((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1);
  const off = attacker.weapons.find((w) => w.hand === 'off' && w.type === 'melee' && (w.hands ?? 1) === 1);
  // Action seulement (jamais une attaque gratuite/enchaînée) :
  const dualEligible = attacker.kind === 'hero' && attackModesFor(attacker).includes('dual-wield')
    && !!main && !!off && !pa.cleave && !pa.dualSecond;
```
et le rendu (près du sélecteur d'arme d'attaque) :
```tsx
            {dualEligible && (
              <label className="rm-loc-inline" title="Frapper des deux armes (LDB 10) : 2ᵉ frappe main secondaire si la 1ʳᵉ touche ; −10 à vos défenses jusqu’à votre prochain Tour ; Avantage seulement si les deux touchent.">
                <input type="checkbox" checked={!!pa.dualMode} onChange={(e) => setDual(e.target.checked)} />
                <span className="mini-title">Des deux armes</span>
              </label>
            )}
```
> En mode dual, l'attaque utilise la **main directrice** : ne pas laisser le sélecteur d'arme choisir l'arme off
> en même temps. Si `pa.dualMode`, forcer le `weaponUid` sur la main (`main.uid`) à l'activation du toggle
> (dans `attackSetDualMode`, quand `on===true`, faire `weaponUid: <uid main>` — sinon laisser tel quel). Ajuster :
```ts
  attackSetDualMode: (on) => {
    const pa = get().pendingAttack; if (!pa || pa.result) return;
    const b = get().battle; const a = b?.combatants.find((c) => c.id === pa.attackerId);
    const mainUid = a?.weapons.find((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1)?.uid;
    set({ pendingAttack: { ...pa, dualMode: on, weaponUid: on ? (mainUid ?? pa.weaponUid) : pa.weaponUid } });
  },
```

- [ ] **Step 3 : typecheck + suite + commit**
```
git add src/state/store.ts src/ui/RollModal.tsx
git commit -m "feat(ui): toggle 'Des deux armes' dans la modale d'attaque (eligibilite talent + 2 armes melee)"
```

### Task 7 : sélecteur de 2ᵉ cible (`pendingDualStrike`)

**Files:**
- Modify: `src/ui/CampaignView.tsx` (ou le composant qui gère `pendingCleave` : bannière + ciblage) — repérer
  où `pendingCleave`/`cleaveAttack` pilote le surlignage et la bannière, et reproduire pour `pendingDualStrike`.
- Modify: `src/gameIso/IsoStage.tsx` si le ciblage clic dépend d'un set d'ids éligibles (voir `pendingCleave`).
- Modify: `src/state/combatFlow.ts` (helper `dualStrikeTargetIds(get)` — cibles valides de la 2ᵉ frappe).

- [ ] **Step 1 : helper cibles éligibles** (`combatFlow.ts`, calqué sur `cleaveTargets`) :
```ts
/** Cibles VALIDES de la 2ᵉ frappe du Maniement de deux armes (LDB 10 l.638 : « un adversaire disponible de
 *  votre choix ») : adversaires actifs à portée de l'arme off (Allonge). Sans position connue → non filtré. */
export function dualStrikeTargetIds(get: () => GameState): Set<string> {
  const ids = new Set<string>();
  const battle = get().battle; const ds = get().pendingDualStrike;
  if (!battle || !ds) return ids;
  const a = battle.combatants.find((c) => c.id === ds.attackerId);
  const off = a?.weapons.find((w) => w.uid === ds.offWeaponUid);
  if (!a || !off) return ids;
  for (const c of battle.combatants) {
    if (c.kind === a.kind || isOutOfAction(c) || !c.pos || !a.pos) continue;
    if (combatDistance(a, c) <= reachTiles(off)) ids.add(c.id);
  }
  return ids;
}
```

- [ ] **Step 2 : bannière + ciblage UI** — là où `pendingCleave` affiche « Balayage : choisir une cible » et rend
les cibles cliquables (chercher `pendingCleave` dans `src/ui/` et `src/gameIso/`), ajouter le pendant
`pendingDualStrike` : bannière « Maniement de deux armes : choisir la cible de la 2ᵉ arme » + bouton **Renoncer**
(→ `dualStrikeSkip()`), clic sur une cible de `dualStrikeTargetIds` → `dualStrikeAttack(id)`. Réutiliser le même
mécanisme de surlignage que cleave (set d'ids éligibles).

- [ ] **Step 3 : recette navigateur** (Playwright MCP) reportée à la Task 9 globale. Ici : typecheck + suite.

- [ ] **Step 4 : commit**
```
git add src/ui src/gameIso src/state/combatFlow.ts
git commit -m "feat(ui): selecteur de 2e cible du Maniement de deux armes (banniere + ciblage + renoncer)"
```

---

## Phase D — Bornage & garde anti-régression

### Task 8 : le mode dual n'est JAMAIS proposé/déclenché sur une attaque gratuite

**Files:**
- Test: `src/state/dual-wield.test.ts`
- (Au besoin) Modify: `src/state/store.ts` / `combatFlow.ts` si une voie gratuite peut fixer `dualMode`.

- [ ] **Step 1 : test** — vérifier que l'attaque LIBRE de Frénésie d'un héros (et un enchaînement `pa.cleave`)
n'expose pas le mode dual et ne pose pas `pendingDualStrike`. Concrètement :
```ts
it('attaque gratuite (cleave) : pas de pendingDualStrike même avec le talent', () => {
  // héros avec le talent + 2 armes mêlée, pendingAttack { cleave: true, result:<touche> } ;
  // attackConfirm() → pendingDualStrike reste null (isDualMain exige !pa.cleave et !pa.dualSecond + dualMode).
});
```
(Le `dualMode` n'est posé que par le toggle UI, lui-même grisé si `pa.cleave`. La garde `isDualMain` inclut
`!!pa.dualMode` → une attaque gratuite sans `dualMode` ne chaîne jamais. Le test verrouille l'invariant.)

- [ ] **Step 2 : lancer → PASS** ; `npm run typecheck` → 0 ; `npm test` → PASS.

- [ ] **Step 3 : commit**
```
git add src/state/dual-wield.test.ts
git commit -m "test(combat): garde -- Maniement de deux armes jamais sur une attaque gratuite/enchainee"
```

### Task 9 : recette navigateur (Playwright MCP) — TOUT le flux

**Files:** aucun (vérification).

- [ ] Charger `localhost:5173` → menu « 🧪 Tests — scénarios » → un scénario avec un héros qui a le talent
  **Maniement de deux armes** et un loadout à 2 armes de mêlée (créer le scénario de test si absent :
  `src/scenes/test-scenarios/NN-maniement-deux-armes.ts`, héros pré-équipé, 2 ennemis adjacents).
- [ ] Vérifier : toggle « Des deux armes » présent et coché → la 1ʳᵉ frappe résout, le sélecteur de 2ᵉ cible
  s'ouvre, la 2ᵉ frappe utilise le jet inversé (lisible dans la modale/le journal), le −10 défense apparaît sur
  la prochaine défense du héros, l'Avantage n'est gagné que si les deux touchent. `console` : 0 erreur. Screenshot.
- [ ] Si un scénario de test est créé, le committer séparément.

---

## Auto-revue (couverture spec §5.5 / RAW LDB 10 l.638)

- Talent → mode d'attaque (registre `attackModes`) : Task 1. ✓
- Main directrice d'abord ; 2ᵉ seulement si elle touche : Task 5 (`if (pa.result.hit …)`). ✓
- « conserver le lancer » → 2ᵉ = `reverseRoll(mainRoll)` : Task 2 + capture `mainRoll` dans Task 5. ✓
- Pénalité de main secondaire sur la 2ᵉ : Task 2 (incluse via `hand:'off'` dans `attackModifiers`, plan #1). ✓
- 2ᵉ opposée à un **nouveau** jet de défense : Task 2 (`rollMeleeDefender` frais). ✓
- Exception Critique (valeur du tableau des Critiques) : Task 2 (`critValue`) + capture dans Task 5
  (`pendingReveals` `kind:'critical'` `.dice`). ✓
- −10 à TOUTES les défenses jusqu'au prochain Tour : Task 4 (jet + affichage + purge au Tour). ✓
- Avantage seulement si les deux touchent : Task 3 (defer) + Task 5 (gating both-hit). ✓
- Cible 2ᵉ = adversaire au choix, optionnel (« peut ») : Task 5/7 (`dualStrikeAttack`/`dualStrikeSkip`). ✓
- **Pour votre Action** — jamais sur attaque gratuite/enchaînée : Task 6 (éligibilité) + Task 8 (garde). ✓
- INVARIANT « un jet = une modale » : la 2ᵉ frappe passe par RollModal (résultat pré-résolu, Appliquer). ✓

## Hors périmètre (terrain préparé, pas implémenté)

- Dual-wield à distance (deux pistolets) — le « nouveau jet de défense » est une mécanique de mêlée. Documenté.
- IA ennemie dual-wield (le hook `attackModes` est prêt si on l'ouvre plus tard).
- Lâcher/amputation ↔ loadout = **plan #6** (§5.7).
