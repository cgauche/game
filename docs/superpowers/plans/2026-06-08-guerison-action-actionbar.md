# Action Guérison + désencombrement ActionBar — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter l'action Guérison (soin de PB + arrêt d'Hémorragie, en combat et hors-combat) et désencombrer l'ActionBar (catégories repliables + alertes visibles), 100 % fidèle au LDB.

**Architecture:** Moteur pur `engine/healing.ts` (calculs DR + mutateurs) ; store via un `PendingHeal` dédié (flux modale « un jet = une modale », pas de réutilisation de `pendingTest` pour éviter un désync Chance/Résilience entre `party` et `battle.combatants`) ; `HealModal.tsx` ; ActionBar restructurée (primaires directs / catégories Mouvement·Tir·Objets repliables / alerte Détermination visible). Compose avec le travail parallèle `outOfCombatUpkeep.ts` (qui fait *ticker* le saignement hors combat) : Guérison est l'antidote (arrêt d'Hémorragie) que son TODO « Premiers Secours / panser » réclame.

**Tech Stack:** Vite + TypeScript + React, Zustand (store), Vitest (moteur + store). RNG seedable (`battleRng`). Source de règles : `Source/Warhammer v4 - Livre de base version corrigée/` (09-Compétences, 16-États, 18-Traumatisme).

**Spec :** `docs/superpowers/specs/2026-06-07-guerison-action-actionbar-design.md`

---

## Coordination d'exécution (WIP parallèle)

Une autre session édite **`store.ts`, `types.ts`, `combatFlow.ts`** (feature `outOfCombatUpkeep`). Règles :

- **Re-lire** chaque fichier partagé juste avant de l'éditer (son contenu peut avoir changé).
- Faire des éditions **localisées** (nouvelle interface/champ/action ajoutés, pas de réécriture de blocs voisins).
- **Committer mes seuls fichiers** via `git commit -- <chemins>`. Les nouveaux fichiers (`engine/healing.ts`, `engine/healing.test.ts`, `ui/HealModal.tsx`, `state/heal.test.ts`) se committent seuls sans risque.
- Pour les fichiers partagés (`store.ts`, `types.ts`, `persistence.ts`, `ui/ActionBar.tsx`, `ui/CharacterSheet.tsx`, `ui/CampaignView.tsx`) : éditer, lancer les tests, puis committer en signalant en 1 ligne qu'ils peuvent embarquer des changements voisins de l'autre session si non encore committés.
- **Ne jamais** `git stash`/`git checkout` un fichier partagé (effacerait le WIP de l'autre session).

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
| --- | --- | --- |
| `src/engine/healing.ts` | Règles Guérison pures + mutateurs (gate compétence, cibles, deltas, application) | **Créer** |
| `src/engine/healing.test.ts` | Tests unitaires du moteur de soin | **Créer** |
| `src/engine/types.ts` | Champ `Combatant.soinRencontreUtilise` | **Modifier** |
| `src/engine/persistence.ts` | `carryOverState` reporte le flag combat→groupe | **Modifier** |
| `src/state/store.ts` | `PendingHeal` + état + actions `battleHeal`/`healAlly`/`healRoll`/`healReroll`/`healBonusSL`/`healForceSuccess`/`healConfirm`/`healCancel` ; reset `startCombat` ; union `battle.action` | **Modifier** |
| `src/state/heal.test.ts` | Flux combat + hors-combat + limite/rencontre + cibles inconscientes | **Créer** |
| `src/ui/HealModal.tsx` | Modale de jet Guérison (Lancer/Chance/+1 DR/Résilience/Appliquer) | **Créer** |
| `src/ui/CampaignView.tsx` | Monter `<HealModal/>` | **Modifier** |
| `src/ui/ActionBar.tsx` | Restructuration + slot Soigner + sous-panneaux | **Modifier (réécriture du rendu)** |
| `src/ui/CharacterSheet.tsx` | Bouton Soigner hors-combat | **Modifier** |
| `src/state/store.test.ts` | `reset()` helper : `pendingHeal: null` | **Modifier** |

---

## Task 1 : Moteur `engine/healing.ts` (pur + testé)

**Files:**
- Create: `src/engine/healing.ts`
- Test: `src/engine/healing.test.ts`

Règles (citées) : `LDB 09-Compétences l.226-243` (soin = BI+DR, 1/patient/rencontre, +0 en combat, échec BI+DR<0 → Blessures), `16-États l.104-109` (Hémorragique : retrait 1+DR, tous retirés → Exténué), `18-Traumatisme l.28` (1 PB lève l'inconscience).

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// src/engine/healing.test.ts
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import {
  hasHealSkill, isHealable, availableHealModes, healableTargets,
  healWoundsDelta, stopBleedOutcome, applyHealWounds, applyStopBleed,
} from './healing';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'Soigneur', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 38, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ name: 'Guérison', advances: 10 }], talents: [],
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

describe('engine/healing — gate compétence & cibles', () => {
  it('hasHealSkill : vrai si Compétence Guérison possédée, faux sinon (Avancée, LDB 09 l.226)', () => {
    expect(hasHealSkill(hero())).toBe(true);
    expect(hasHealSkill(hero({ skills: [] }))).toBe(false);
  });

  it('isHealable : blessé OU hémorragique ; pas mort/éjecté', () => {
    expect(isHealable(hero({ wounds: { current: 12, max: 12 }, conditions: [] }))).toBe(false);
    expect(isHealable(hero({ wounds: { current: 5, max: 12 } }))).toBe(true);
    expect(isHealable(hero({ wounds: { current: 12, max: 12 }, conditions: [{ name: 'Hémorragique', value: 1 }] }))).toBe(true);
    expect(isHealable(hero({ wounds: { current: 5, max: 12 }, dead: true }))).toBe(false);
  });

  it('availableHealModes : « wounds » bloqué si déjà soigné cette rencontre ; « bleed » indépendant', () => {
    const t = hero({ wounds: { current: 5, max: 12 }, conditions: [{ name: 'Hémorragique', value: 2 }] });
    expect(availableHealModes(t)).toEqual(['wounds', 'bleed']);
    expect(availableHealModes({ ...t, soinRencontreUtilise: true })).toEqual(['bleed']);
  });

  it('healableTargets (combat) : soi + alliés adjacents (Chebyshev ≤ 1), inconscient inclus', () => {
    const healer = hero({ pos: { x: 2, y: 2 } });
    const adj = hero({ id: 'a', wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], pos: { x: 3, y: 2 } });
    const far = hero({ id: 'f', wounds: { current: 1, max: 12 }, pos: { x: 8, y: 8 } });
    const ids = healableTargets(healer, [healer, adj, far], { adjacency: true }).map((c) => c.id);
    expect(ids).toContain('a');
    expect(ids).not.toContain('f');
    expect(ids).not.toContain('h'); // healer plein PB, pas hémorragique → pas soignable
  });
});

describe('engine/healing — calculs DR (purs)', () => {
  it('healWoundsDelta : succès = BI+DR (plancher 0) ; échec BI+DR<0 = perte ; échec BI+DR≥0 = 0', () => {
    expect(healWoundsDelta(3, 2, true)).toBe(5);
    expect(healWoundsDelta(3, -5, true)).toBe(0);   // succès ne blesse jamais
    expect(healWoundsDelta(1, -4, false)).toBe(-3); // échec, BI+DR<0 → -3
    expect(healWoundsDelta(3, -1, false)).toBe(0);  // échec mais BI+DR≥0 → rien
  });

  it('stopBleedOutcome : retire 1+DR borné aux pions ; Exténué quand tout retiré ; échec = rien', () => {
    expect(stopBleedOutcome(2, 5, true)).toEqual({ removed: 3, gainExtenue: false });
    expect(stopBleedOutcome(2, 2, true)).toEqual({ removed: 2, gainExtenue: true });
    expect(stopBleedOutcome(0, 3, true)).toEqual({ removed: 1, gainExtenue: false });
    expect(stopBleedOutcome(5, 3, false)).toEqual({ removed: 0, gainExtenue: false });
  });
});

describe('engine/healing — mutateurs', () => {
  it('applyHealWounds : +PB plafonné max, pose le flag, lève l’Inconscient quand on repasse >0 (LDB 18 l.28)', () => {
    const t = hero({ id: 't', wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }, { name: 'À Terre', value: 1 }], roundsAtZero: 3 });
    applyHealWounds(t, 5);
    expect(t.wounds.current).toBe(5);
    expect(t.soinRencontreUtilise).toBe(true);
    expect(t.conditions.find((c) => c.name === 'Inconscient')).toBeUndefined(); // reprend connaissance
    expect(t.conditions.find((c) => c.name === 'À Terre')).toBeTruthy();        // mais reste à terre
    expect(t.roundsAtZero).toBe(0);
  });

  it('applyHealWounds : delta négatif inflige des Blessures (loseWounds : −Avantage + À Terre à 0)', () => {
    const t = hero({ id: 't', wounds: { current: 2, max: 12 }, advantage: 3 });
    applyHealWounds(t, -4);
    expect(t.wounds.current).toBe(0);
    expect(t.advantage).toBe(0);
    expect(t.conditions.find((c) => c.name === 'À Terre')).toBeTruthy();
    expect(t.soinRencontreUtilise).toBeUndefined(); // pas de bénéfice → flag non posé
  });

  it('applyStopBleed : retire les pions ; Exténué quand le dernier part (LDB 16 l.109)', () => {
    const t = hero({ id: 't', conditions: [{ name: 'Hémorragique', value: 2 }] });
    applyStopBleed(t, 1); // 1+1 = 2 pions retirés
    expect(t.conditions.find((c) => c.name === 'Hémorragique')).toBeUndefined();
    expect(t.conditions.find((c) => c.name === 'Exténué')).toBeTruthy();
  });
});
```

- [ ] **Step 2 : Lancer le test → échec attendu**

Run: `npm test -- healing`
Expected: FAIL — « Cannot find module './healing' ».

- [ ] **Step 3 : Implémenter `engine/healing.ts`**

```ts
// src/engine/healing.ts
/**
 * Guérison — Compétence Avancée (Int). Soin de Blessures et arrêt d'Hémorragie.
 * Source : LDB 09-Compétences l.226-243 (skills.json), 16-États l.104-109, 18-Traumatisme l.28.
 * Pur + testé ; ne dépend que de types/characteristics/conditions (déjà purs).
 */
import { Combatant } from './types';
import { loseWounds, addCondition, removeCondition, hasCondition } from './conditions';

/** Pions d'un État (local — `stacks` n'est pas exporté par conditions.ts). */
const condStacks = (c: Combatant, name: string) => c.conditions.find((x) => x.name === name)?.value ?? 0;

/** Le combattant possède-t-il la Compétence (Avancée) Guérison ? Sans Augmentation, « aucune idée
 *  de comment soigner » (LDB 09-Compétences l.31, l.226). */
export function hasHealSkill(c: Combatant): boolean {
  return (c.skills ?? []).some((s) => s.name.toLowerCase().startsWith('guérison'));
}

/** Cible soignable : blessée (PB perdus) OU porteuse d'≥1 État Hémorragique ; ni morte ni éjectée.
 *  Les cibles Inconscientes/À Terre sont valides (1 PB lève l'inconscience, LDB 18 l.28). */
export function isHealable(c: Combatant): boolean {
  if (c.dead || c.outOfRencontre) return false;
  return c.wounds.current < c.wounds.max || condStacks(c, 'Hémorragique') > 0;
}

export type HealMode = 'wounds' | 'bleed';

/** Modes disponibles pour soigner `target`, compte tenu de la limite « 1 soin de Blessures / rencontre ». */
export function availableHealModes(target: Combatant): HealMode[] {
  const modes: HealMode[] = [];
  if (target.wounds.current < target.wounds.max && !target.soinRencontreUtilise) modes.push('wounds');
  if (condStacks(target, 'Hémorragique') > 0) modes.push('bleed');
  return modes;
}

/** Cibles soignables atteignables par `healer`. En combat : soi + adjacents (Chebyshev ≤ 1).
 *  Hors combat : tout le `pool`. */
export function healableTargets(healer: Combatant, pool: Combatant[], opts: { adjacency: boolean }): Combatant[] {
  return pool.filter((t) => {
    if (!isHealable(t)) return false;
    if (!opts.adjacency || t.id === healer.id) return true;
    if (!healer.pos || !t.pos) return false;
    return Math.max(Math.abs(healer.pos.x - t.pos.x), Math.abs(healer.pos.y - t.pos.y)) <= 1;
  });
}

/** Soin de Blessures (LDB 09 l.233) : succès ⇒ BI+DR (plancher 0) ; échec ⇒ si BI+DR<0, perte de
 *  |BI+DR| PB (sinon 0). Renvoie le delta de PB (positif = soin, négatif = dégât). */
export function healWoundsDelta(intBonus: number, dr: number, success: boolean): number {
  const total = intBonus + dr;
  if (success) return Math.max(0, total);
  return total < 0 ? total : 0;
}

/** Arrêt d'Hémorragie (LDB 09 l.235 / 16-États l.107-109) : succès ⇒ retire 1+DR pions (borné) ;
 *  tous retirés ⇒ Exténué. Échec ⇒ rien. */
export function stopBleedOutcome(dr: number, stacks: number, success: boolean): { removed: number; gainExtenue: boolean } {
  if (!success || stacks <= 0) return { removed: 0, gainExtenue: false };
  const removed = Math.min(stacks, 1 + Math.max(0, dr));
  return { removed, gainExtenue: removed >= stacks };
}

/** Applique un soin de Blessures (mutation). Lève l'Inconscient et remet l'horloge de mort à zéro
 *  quand on repasse > 0 PB (LDB 18 l.28). Renvoie un journal. */
export function applyHealWounds(target: Combatant, delta: number): string[] {
  if (delta < 0) {
    const lost = loseWounds(target, -delta); // perte centralisée (−Avantage + À Terre à 0)
    return [`${target.name} : le soin tourne mal — ${lost} Blessure(s) en plus.`];
  }
  if (delta === 0) return [`${target.name} : le soin n'apporte rien.`];
  const before = target.wounds.current;
  target.wounds.current = Math.min(target.wounds.max, target.wounds.current + delta);
  target.soinRencontreUtilise = true; // a bénéficié de SON soin de cette rencontre (LDB 09 l.233)
  const log = [`${target.name} : +${target.wounds.current - before} PB (${target.wounds.current}/${target.wounds.max}).`];
  if (target.wounds.current > 0 && hasCondition(target, 'Inconscient')) {
    removeCondition(target, 'Inconscient', condStacks(target, 'Inconscient')); // reprend connaissance (LDB 18 l.28)
    log.push(`${target.name} reprend connaissance.`);
  }
  if (target.wounds.current > 0) target.roundsAtZero = 0;
  return log;
}

/** Applique l'arrêt d'Hémorragie (mutation). `dr` = DR du Test réussi. */
export function applyStopBleed(target: Combatant, dr: number): string[] {
  const { removed, gainExtenue } = stopBleedOutcome(dr, condStacks(target, 'Hémorragique'), true);
  if (removed <= 0) return [`${target.name} : l'hémorragie ne cède pas.`];
  removeCondition(target, 'Hémorragique', removed);
  const log = [`${target.name} : ${removed} État(s) Hémorragique stoppé(s).`];
  if (gainExtenue) {
    addCondition(target, 'Exténué');
    log.push(`${target.name} est Exténué (après l'arrêt de l'hémorragie, LDB 16 l.109).`);
  }
  return log;
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `npm test -- healing`
Expected: PASS.

- [ ] **Step 5 : typecheck + commit (fichiers solo)**

```bash
npm run typecheck
git add src/engine/healing.ts src/engine/healing.test.ts
git commit -- src/engine/healing.ts src/engine/healing.test.ts -m "feat(engine): moteur Guérison pur (soin PB BI+DR, arrêt Hémorragie 1+DR, gate compétence Avancée)"
```

---

## Task 2 : Champ `soinRencontreUtilise` + report combat→groupe

**Files:**
- Modify: `src/engine/types.ts` (interface `Combatant`)
- Modify: `src/engine/persistence.ts` (`carryOverState`)
- Test: `src/engine/persistence.test.ts` (déjà existant)

- [ ] **Step 1 : Re-lire les fichiers (WIP parallèle), puis ajouter le test qui échoue**

Ajouter à `src/engine/persistence.test.ts` :

```ts
it('carryOverState reporte soinRencontreUtilise (limite 1 soin/rencontre survit au combat)', () => {
  const c = { name: 'X', wounds: { current: 4, max: 10 }, conditions: [], soinRencontreUtilise: true } as unknown as Combatant;
  expect(carryOverState(c).soinRencontreUtilise).toBe(true);
});
```

- [ ] **Step 2 : Lancer → échec**

Run: `npm test -- persistence`
Expected: FAIL — `soinRencontreUtilise` absent du type de retour.

- [ ] **Step 3 : Ajouter le champ au type `Combatant`** (`src/engine/types.ts`, à côté de `roundsAtZero`/`dead`)

```ts
  /** A déjà bénéficié d'un soin de Blessures (Guérison) cette rencontre (LDB 09-Compétences l.233).
   *  Réinitialisé au début de chaque combat (startCombat). N'affecte PAS l'arrêt d'Hémorragie. */
  soinRencontreUtilise?: boolean;
```

- [ ] **Step 4 : Reporter le flag dans `carryOverState`** (`src/engine/persistence.ts`)

Dans le type de retour, ajouter `soinRencontreUtilise: boolean;` ; dans l'objet retourné, ajouter :

```ts
    soinRencontreUtilise: c.soinRencontreUtilise === true,
```

- [ ] **Step 5 : Lancer → succès + typecheck + commit**

```bash
npm test -- persistence && npm run typecheck
git add src/engine/types.ts src/engine/persistence.ts src/engine/persistence.test.ts
git commit -- src/engine/types.ts src/engine/persistence.ts src/engine/persistence.test.ts -m "feat(engine): Combatant.soinRencontreUtilise + report par carryOverState (limite 1 soin/rencontre)"
```

---

## Task 3 : Store — `PendingHeal` + actions + reset

**Files:**
- Modify: `src/state/store.ts`
- Test: `src/state/heal.test.ts` (créer)

> ⚠️ Re-lire `store.ts` avant chaque édition (WIP parallèle). Toutes les éditions sont des **ajouts** (interface, champ d'état, bloc d'actions) — pas de réécriture de blocs voisins.

### 3a. Interface + état + union d'action

- [ ] **Step 1 : Ajouter l'interface `PendingHeal`** (après `PendingCast`, vers la l.288)

```ts
/** Soin de Guérison en attente (LDB 09-Compétences) : flux modale — « Lancer » (healRoll) → Chance
 *  (relance / +1 DR) → Résilience → « Appliquer » (healConfirm). `inCombat` choisit la collection
 *  (battle.combatants vs party) où trouver soigneur/cible. `intBonus` figé à l'ouverture. */
export interface PendingHeal {
  healerId: string;
  healerName: string;
  targetId: string;
  targetName: string;
  mode: HealMode; // 'wounds' | 'bleed'
  inCombat: boolean;
  intBonus: number; // Bonus d'Intelligence du soigneur
  skillValue: number; // testValue(soigneur, 'Guérison')
  difficulty: Difficulty; // 'intermediaire' (+0, LDB 09 l.243)
  target: number; // cible effective (affichage)
  roll: number | null; // null tant que pas lancé (Chance possible ensuite)
  success: boolean;
  sl: number; // DR
  rerolled?: boolean;
}
```

Importer `HealMode` : ajouter à l'import depuis `'../engine/healing'` (cf. 3b).

- [ ] **Step 2 : Ajouter le champ d'état** dans `interface GameState` (à côté de `pendingCast: PendingCast | null;`)

```ts
  pendingHeal: PendingHeal | null;
```

- [ ] **Step 3 : Valeur initiale** (dans l'objet d'état initial du store, là où `pendingCast: null,` apparaît)

```ts
  pendingHeal: null,
```

- [ ] **Step 4 : Étendre l'union `battle.action`** — DEUX endroits :

`interface BattleState` (champ `action`) ET la signature `battleSelectAction:` dans `GameState`. Remplacer `… | 'trample' | null` par :

```ts
… | 'trample' | 'heal' | 'mvt' | 'tir' | 'objets' | null
```

### 3b. Imports + helpers + actions

- [ ] **Step 5 : Imports** (en tête de `store.ts`, fusionner avec les imports existants)

```ts
import { bonus, effectiveChar } from '../engine/characteristics';
import { testValue, partyBest } from '../engine/skills';
import {
  hasHealSkill, availableHealModes, healableTargets, healWoundsDelta,
  applyHealWounds, applyStopBleed, type HealMode,
} from '../engine/healing';
```

(`rollTest` depuis `'../engine/tests'`, `canReroll` depuis `'../engine/fortune'`, `addCondition`/etc. : déjà importés — vérifier, ajouter si absent. `Difficulty` : déjà importé via types.)

- [ ] **Step 6 : Helper de collection** (fonction module-level, AVANT `export const useGame`, pour ne PAS être scanné par le garde-fou « un jet = une modale »)

```ts
/** Trouve soigneur/cible d'un PendingHeal dans la bonne collection (combat vs groupe). */
function healSubject(state: GameState, ph: PendingHeal, id: string): Combatant | undefined {
  return ph.inCombat ? state.battle?.combatants.find((c) => c.id === id) : state.party.find((c) => c.id === id);
}
```

- [ ] **Step 7 : Écrire le test du flux** `src/state/heal.test.ts`

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';
import { seedBattleRng } from './battleRng';

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', name: 'Doc', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 40, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ name: 'Guérison', advances: 30 }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle',
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpell: null, reachable: new Map(), moved: false, acted: false,
      log: [], over: null,
    } as any,
    pendingHeal: null,
  });
}

describe('Guérison — flux combat', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('battleHeal → healRoll → healConfirm : soigne et pose le flag, consomme l’Action', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const wounded = hero({ id: 'al', name: 'Blessé', wounds: { current: 3, max: 12 }, pos: { x: 2, y: 1 } });
    setBattle([doc, wounded], 'doc');
    useGame.getState().battleHeal('al', 'wounds');
    expect(useGame.getState().pendingHeal).not.toBeNull();
    useGame.getState().healRoll();
    expect(useGame.getState().pendingHeal!.roll).not.toBeNull();
    // forcer un succès reproductible : on fige le résultat avant Appliquer
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 2 } });
    useGame.getState().healConfirm();
    const al = useGame.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.wounds.current).toBe(3 + 4 + 2); // +BI(4)+DR(2)
    expect(al.soinRencontreUtilise).toBe(true);
    expect(useGame.getState().battle!.acted).toBe(true);
    expect(useGame.getState().pendingHeal).toBeNull();
  });

  it('limite 1/rencontre : 2e « wounds » indisponible, « bleed » reste possible', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 3, max: 12 }, conditions: [{ name: 'Hémorragique', value: 2 }], soinRencontreUtilise: true, pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    // wounds refusé (déjà soigné), bleed accepté
    useGame.getState().battleHeal('al', 'wounds');
    expect(useGame.getState().pendingHeal).toBeNull();
    useGame.getState().battleHeal('al', 'bleed');
    expect(useGame.getState().pendingHeal!.mode).toBe('bleed');
  });

  it('soigner un allié Inconscient le relève une fois > 0 PB (LDB 18 l.28)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const ko = hero({ id: 'ko', wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }, { name: 'À Terre', value: 1 }], pos: { x: 2, y: 1 } });
    setBattle([doc, ko], 'doc');
    useGame.getState().battleHeal('ko', 'wounds');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
    useGame.getState().healConfirm();
    const k = useGame.getState().battle!.combatants.find((c) => c.id === 'ko')!;
    expect(k.wounds.current).toBeGreaterThan(0);
    expect(k.conditions.find((c) => c.name === 'Inconscient')).toBeUndefined();
  });
});
```

- [ ] **Step 8 : Lancer → échec** : `npm test -- heal` → FAIL (`battleHeal`/`healRoll`/`healConfirm` absents).

- [ ] **Step 9 : Implémenter les actions** (dans l'objet d'actions du store, près des actions de combat)

```ts
  // ── Guérison (LDB 09-Compétences l.226-243) — soin de Blessures / arrêt d'Hémorragie ──

  /** Ouvre la modale de soin EN COMBAT : le héros actif soigne `targetId` (soi ou allié adjacent). */
  battleHeal: (targetId, mode) => {
    const { battle } = get();
    if (!battle) return;
    const healer = activeCombatant(battle);
    if (!healer || healer.kind !== 'hero' || !hasHealSkill(healer) || battle.acted || !canTakeAction(healer)) return;
    const target = battle.combatants.find((c) => c.id === targetId);
    if (!target || !availableHealModes(target).includes(mode)) return;
    const skillValue = testValue(healer, 'Guérison');
    set({
      pendingHeal: {
        healerId: healer.id, healerName: healer.name, targetId: target.id, targetName: target.name,
        mode, inCombat: true, intBonus: bonus(effectiveChar(healer, 'Int')),
        skillValue, difficulty: 'intermediaire', target: skillValue, roll: null, success: false, sl: 0,
      },
      battle: { ...battle, action: null },
    });
  },

  /** Ouvre la modale de soin HORS COMBAT : le meilleur soigneur du groupe soigne `targetId`. */
  healAlly: (targetId, mode) => {
    const party = get().party;
    const target = party.find((c) => c.id === targetId);
    if (!target || !availableHealModes(target).includes(mode)) return;
    const best = partyBest(party.filter(hasHealSkill), 'Guérison');
    if (!best) return;
    const healer = best.actor;
    set({
      pendingHeal: {
        healerId: healer.id, healerName: healer.name, targetId: target.id, targetName: target.name,
        mode, inCombat: false, intBonus: bonus(effectiveChar(healer, 'Int')),
        skillValue: best.value, difficulty: 'intermediaire', target: best.value, roll: null, success: false, sl: 0,
      },
    });
  },

  /** « Lancer » : effectue le jet de Guérison (Intermédiaire +0). */
  healRoll: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.roll != null) return;
    const res = rollTest(ph.skillValue, ph.difficulty, battleRng());
    set({ pendingHeal: { ...ph, roll: res.roll, sl: res.sl, success: res.success } });
  },

  /** Chance : relance le jet (1×, d100 propre raté seulement). */
  healReroll: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.roll == null || !canReroll(ph.roll > ph.target, !!ph.rerolled)) return;
    const healer = healSubject(get(), ph, ph.healerId);
    if (!healer || (healer.fortune ?? 0) <= 0) return;
    healer.fortune = (healer.fortune ?? 0) - 1;
    const res = rollTest(ph.skillValue, ph.difficulty, battleRng());
    set({
      pendingHeal: { ...ph, roll: res.roll, sl: res.sl, success: res.success, rerolled: true },
      ...(ph.inCombat ? { battle: { ...get().battle! } } : { party: [...get().party] }),
    });
  },

  /** Chance « +1 DR » (LDB ch.17 l.26) : le soin scale avec le DR. */
  healBonusSL: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.roll == null) return;
    const healer = healSubject(get(), ph, ph.healerId);
    if (!healer || (healer.fortune ?? 0) <= 0) return;
    healer.fortune = (healer.fortune ?? 0) - 1;
    set({
      pendingHeal: { ...ph, sl: ph.sl + 1, success: ph.roll <= ph.target },
      ...(ph.inCombat ? { battle: { ...get().battle! } } : { party: [...get().party] }),
    });
  },

  /** Résilience « Je ne faillirai pas ! » (LDB ch.17 l.72) : réussite garantie (DR ≥ 1). */
  healForceSuccess: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.roll == null) return;
    const healer = healSubject(get(), ph, ph.healerId);
    if (!healer || (healer.resilience ?? 0) <= 0) return;
    healer.resilience = (healer.resilience ?? 0) - 1;
    set({
      pendingHeal: { ...ph, success: true, sl: Math.max(ph.sl, 1) },
      ...(ph.inCombat ? { battle: { ...get().battle! } } : { party: [...get().party] }),
    });
  },

  /** « Appliquer » : applique le soin (le jet est déjà figé). Coûte l'Action en combat. */
  healConfirm: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.roll == null) return;
    set({ pendingHeal: null });
    const st = get();
    const target = healSubject(st, ph, ph.targetId);
    if (!target) return;
    const log = ph.mode === 'wounds'
      ? applyHealWounds(target, healWoundsDelta(ph.intBonus, ph.sl, ph.success))
      : ph.success ? applyStopBleed(target, ph.sl) : [`${target.name} : l'hémorragie ne cède pas.`];
    if (ph.inCombat && st.battle) {
      set({ battle: { ...st.battle, acted: true, action: null, log: [...st.battle.log, ...log] } });
      bus.emit(EVT.SCENE_DIRTY);
      checkBattleOver(get, set);
    } else {
      set({ party: [...st.party] });
      for (const l of log) get().log(l);
    }
  },

  /** Annule avant tout jet (aucun coût). */
  healCancel: () => set({ pendingHeal: null }),
```

Ajouter les signatures correspondantes dans `interface GameState` (à côté des autres actions de combat) :

```ts
  battleHeal: (targetId: string, mode: HealMode) => void;
  healAlly: (targetId: string, mode: HealMode) => void;
  healRoll: () => void;
  healReroll: () => void;
  healBonusSL: () => void;
  healForceSuccess: () => void;
  healConfirm: () => void;
  healCancel: () => void;
```

- [ ] **Step 10 : Reset au `startCombat`** (re-lire `startCombat` d'abord)

(a) Dans le `.map` des `heroes`, ajouter au littéral du combattant : `soinRencontreUtilise: false,` (à côté de `roundsAtZero: 0,`).
(b) Dans le `set({ … pendingFrenzy: null, pendingFumble: null })` du reset des modales, ajouter `pendingHeal: null,`.

- [ ] **Step 11 : `reset()` du test store** — ajouter `pendingHeal: null,` dans `src/state/store.test.ts` (helper `reset`, près des autres `pending*: null`).

- [ ] **Step 12 : Lancer → succès** : `npm test -- heal` puis `npm run typecheck`.

- [ ] **Step 13 : Vérifier le garde-fou « un jet = une modale »**

Run: `npm test -- roll-modal-invariant`
Expected: PASS sans édition (`healRoll`/`healReroll`/`healBonusSL`/`healForceSuccess`/`healConfirm`/`healCancel` matchent le suffixe résolveur ; `battleHeal`/`healAlly` n'appellent aucune primitive de jet).

- [ ] **Step 14 : Commit** (store.ts partagé — signaler)

```bash
npm test && npm run typecheck
git add src/state/store.ts src/state/heal.test.ts src/state/store.test.ts
git commit -- src/state/store.ts src/state/heal.test.ts src/state/store.test.ts -m "feat(state): PendingHeal + actions Guérison (combat & hors-combat), reset rencontre, garde-fou modale OK"
```

---

## Task 4 : Modale `HealModal.tsx`

**Files:**
- Create: `src/ui/HealModal.tsx`
- Modify: `src/ui/CampaignView.tsx`

- [ ] **Step 1 : Créer `src/ui/HealModal.tsx`** (calque `FrenzyModal`, + DR + « +1 DR » + aperçu du soin)

```tsx
import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { healWoundsDelta } from '../engine/healing';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Modale de soin (Guérison, LDB 09-Compétences) : « Lancer » jette le Test (Intermédiaire +0),
 * Chance (relance / +1 DR) et Résilience modulent, « Appliquer » applique. Invariante « un jet = une modale ».
 */
export function HealModal() {
  const ph = useGame((s) => s.pendingHeal);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.healRoll);
  const reroll = useGame((s) => s.healReroll);
  const bonusSL = useGame((s) => s.healBonusSL);
  const force = useGame((s) => s.healForceSuccess);
  const confirm = useGame((s) => s.healConfirm);
  const cancel = useGame((s) => s.healCancel);
  if (!ph) return null;
  const pool = ph.inCombat ? battle?.combatants ?? [] : party;
  const healer = pool.find((c) => c.id === ph.healerId);
  if (!healer) return null;
  const fortune = healer.fortune ?? 0;
  const rolled = ph.roll != null;
  const rerollable = rolled && canReroll(ph.roll! > ph.target, !!ph.rerolled) && fortune > 0;
  const wounds = ph.mode === 'wounds';
  const preview = wounds ? healWoundsDelta(ph.intBonus, ph.sl, ph.success) : null;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>{wounds ? '🩹 Soigner les Blessures' : '🩸 Arrêter l’Hémorragie'}</h3>
        <p className="rm-vs">
          <strong>{ph.healerName}</strong> soigne <strong>{ph.targetName}</strong>{' '}
          <span className="rm-weapon">(Guérison, Intermédiaire +0)</span>
        </p>
        {!rolled ? (
          <div className="modal-actions">
            <button className="btn" onClick={cancel}>Annuler</button>
            <button className="btn btn-primary" onClick={roll}>🎲 Lancer</button>
          </div>
        ) : (
          <>
            <div className={`test-result ${ph.success ? 'ok' : 'fail'}`}>
              <span className="dice">{ph.roll === 100 ? '00' : String(ph.roll).padStart(2, '0')}</span>
              <span className="verdict">
                {ph.success
                  ? wounds
                    ? `Réussi (+${ph.sl} DR) — +${preview} PB`
                    : `Réussi (+${ph.sl} DR) — ${1 + Math.max(0, ph.sl)} pion(s) d'Hémorragie stoppé(s)`
                  : wounds && ph.intBonus + ph.sl < 0
                    ? `Échec — le soin blesse (${ph.intBonus + ph.sl} PB)`
                    : 'Échec — sans effet'}
              </span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <ResilienceButton resilience={healer.resilience ?? 0} show={!ph.success} onForce={force} />
              <button className="btn btn-primary" onClick={confirm}>Appliquer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Monter la modale** — re-lire `CampaignView.tsx`, ajouter l'import et `<HealModal />` à côté de `<FrenzyModal />`.

```tsx
import { HealModal } from './HealModal';
// …dans le rendu, près des autres modales :
<HealModal />
```

- [ ] **Step 3 : Vérifier** : `npm run typecheck` → PASS. (Pas de test unitaire de modale ici ; couvert par le flux store Task 3 + recette navigateur Task 7.)

- [ ] **Step 4 : Commit**

```bash
git add src/ui/HealModal.tsx src/ui/CampaignView.tsx
git commit -- src/ui/HealModal.tsx src/ui/CampaignView.tsx -m "feat(ui): HealModal (jet de Guérison : Lancer/Chance/+1 DR/Résilience/Appliquer)"
```

---

## Task 5 : Bouton Soigner hors-combat (CharacterSheet)

**Files:**
- Modify: `src/ui/CharacterSheet.tsx`

Synergie `outOfCombatUpkeep` : ce bouton **n'avance pas le temps** → on peut stopper une hémorragie AVANT de faire passer l'horloge (sinon l'upkeep ferait ticker le saignement). C'est l'antidote au TODO « Premiers Secours / panser » de `outOfCombatUpkeep.ts`.

- [ ] **Step 1 : Re-lire `CharacterSheet.tsx`** (zone Blessures, ~l.146).

- [ ] **Step 2 : Imports** en tête :

```tsx
import { hasHealSkill, availableHealModes, isHealable } from '../engine/healing';
```

- [ ] **Step 3 : Sélecteurs + calcul** dans le composant (après `const hero = …`)

```tsx
  const party = useGame((s) => s.party);
  const healAlly = useGame((s) => s.healAlly);
  const inBattle = useGame((s) => !!s.battle);
  const canSoigner = !inBattle && !!hero && isHealable(hero) && party.some(hasHealSkill);
```

- [ ] **Step 4 : Boutons** juste après la ligne `Blessures <b>{hero.wounds.current}/{hero.wounds.max}</b>`

```tsx
  {canSoigner && (
    <span className="cs-heal-actions">
      {availableHealModes(hero).map((m) => (
        <button key={m} className="btn small" onClick={() => healAlly(hero.id, m)}
          title="Test de Guérison (Intermédiaire +0) par le meilleur soigneur du groupe (LDB 09-Compétences)">
          {m === 'wounds' ? '🩹 Soigner' : '🩸 Stopper hémorragie'}
        </button>
      ))}
    </span>
  )}
```

- [ ] **Step 5 : Vérifier** : `npm run typecheck` ; lancer la suite store (`npm test -- heal`) couvre `healAlly` via Task 3 (ajouter un cas hors-combat si besoin) :

```ts
// Ajouter à src/state/heal.test.ts
it('healAlly (hors combat) : meilleur soigneur, applique au groupe, respecte la limite', () => {
  const doc = hero({ id: 'doc', skills: [{ name: 'Guérison', advances: 30 }] });
  const al = hero({ id: 'al', name: 'Blessé', wounds: { current: 4, max: 12 }, skills: [] });
  useGame.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null });
  useGame.getState().healAlly('al', 'wounds');
  const ph = useGame.getState().pendingHeal!;
  expect(ph.inCombat).toBe(false);
  expect(ph.healerId).toBe('doc');
  useGame.getState().healRoll();
  useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
  useGame.getState().healConfirm();
  expect(useGame.getState().party.find((c) => c.id === 'al')!.wounds.current).toBeGreaterThan(4);
});
```

- [ ] **Step 6 : Commit**

```bash
npm test -- heal && npm run typecheck
git add src/ui/CharacterSheet.tsx src/state/heal.test.ts
git commit -- src/ui/CharacterSheet.tsx src/state/heal.test.ts -m "feat(ui): bouton Soigner hors-combat sur la fiche (Guérison via meilleur soigneur, n'avance pas le temps)"
```

---

## Task 6 : ActionBar — restructuration + slot Soigner

**Files:**
- Modify: `src/ui/ActionBar.tsx` (réécriture du rendu)

Structure cible : primaires directs (Déplacer · Attaquer · Incanter · 🩹 Soigner · Défensive) ; catégories repliables (🏃 Mouvement ▾ → Charger/Courir/Se relever/Se désengager ; 🏹 Tir ▾ → Viser/Recharger/Munition ; 🧪 Objets ▾ → potions + objets au sol) ; alerte visible ✊ Détermination ; contextuels rares 🐗 Frénésie · 🐾 Piétiner ; ⏭️ Fin du tour. Les feuilles réutilisent les handlers existants — **aucune règle dupliquée**.

- [ ] **Step 1 : Re-lire `ActionBar.tsx`** (WIP parallèle — il était `M` au départ).

- [ ] **Step 2 : Remplacer tout le contenu** par :

```tsx
import { useGame, activeCombatant, entityPickables, trampleTarget } from '../state/store';
import { findSpell } from '../data/index';
import { isArcaneSpell } from '../engine/magic';
import { canTakeAction, hasCondition } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzyCapable } from '../engine/psychology';
import { itemUse } from '../engine/consumables';
import { compatibleAmmo } from '../engine/items';
import { hasHealSkill, healableTargets, availableHealModes } from '../engine/healing';
import type { Combatant } from '../engine/types';

const RING = ['#4f8fe0', '#37c07a', '#e0b13f', '#b455c9'];
const bleedStacks = (c: Combatant) => c.conditions.find((x) => x.name === 'Hémorragique')?.value ?? 0;

/**
 * Barre d'action (hotbar) du combattant ACTIF. Primaires directs ; manœuvres situationnelles repliées
 * sous des catégories (Mouvement/Tir/Objets, idiome `ab-spells`) ; la Détermination reste une alerte
 * VISIBLE (États surgis à ne pas rater). Conçue pour s'étendre.
 */
export function ActionBar() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const selectAction = useGame((s) => s.battleSelectAction);
  const selectSpell = useGame((s) => s.battleSelectSpell);
  const focusSpell = useGame((s) => s.battleFocusSpell);
  const endTurn = useGame((s) => s.battleEndTurn);
  const defendTotal = useGame((s) => s.battleDefendTotal);
  const disengage = useGame((s) => s.battleDisengage);
  const useItem = useGame((s) => s.battleUseItem);
  const spendResolve = useGame((s) => s.battleSpendResolve);
  const frenzy = useGame((s) => s.battleFrenzy);
  const run = useGame((s) => s.battleRun);
  const standUp = useGame((s) => s.battleStandUp);
  const pickup = useGame((s) => s.battlePickup);
  const reload = useGame((s) => s.battleReload);
  const selectAmmo = useGame((s) => s.battleSelectAmmo);
  const aim = useGame((s) => s.battleAim);
  const heal = useGame((s) => s.battleHeal);
  const scene = useGame((s) => s.scene);
  const flags = useGame((s) => s.flags);
  if (!battle || battle.over) return null;
  const active = activeCombatant(battle);
  if (!active) return null;

  const isHero = active.kind === 'hero';
  const hasSpells = isHero && (active.spells?.length ?? 0) > 0;
  const stunned = !canTakeAction(active);
  const engaged = isHero && isEngaged(active);
  const prone = isHero && hasCondition(active, 'À Terre');
  const canCharge = isHero && !engaged && !prone && active.weapons[0]?.type === 'melee';
  const canRun = isHero && !engaged && !prone && !battle.moved && !battle.acted && !stunned;
  const canStandUp = prone && active.wounds.current > 0 && !battle.moved;
  const canTrample = isHero && active.advantage >= 1 && !!trampleTarget(battle, active);
  const canFrenzy = isHero && isFrenzyCapable(active) && !active.frenzied && !battle.acted && !stunned;
  const heroIdx = party.findIndex((h) => h.id === active.id);
  const ring = heroIdx >= 0 ? RING[heroIdx % RING.length] : '#c0392b';

  const usable = isHero ? (active.items ?? []).filter((it) => itemUse(it, active) != null) : [];
  const usableGroups = Object.values(
    usable.reduce<Record<string, { name: string; uids: string[]; desc?: string }>>((acc, it) => {
      (acc[it.name] ??= { name: it.name, uids: [], desc: it.desc ?? undefined }).uids.push(it.uid);
      return acc;
    }, {}),
  );

  const resolve = isHero ? active.resolve ?? 0 : 0;
  const removableConditions = isHero && resolve > 0 ? active.conditions : [];
  const groundItems =
    isHero && active.pos
      ? (scene?.entities ?? [])
          .filter(
            (e) =>
              e.kind === 'objet' &&
              Math.max(Math.abs(e.pos.x - active.pos!.x), Math.abs(e.pos.y - active.pos!.y)) <= 1 &&
              !flags[`__fouille_${e.id}`],
          )
          .flatMap((e) => entityPickables(e).map((p) => ({ entityId: e.id, ...p })))
      : [];

  const rangedW = isHero ? active.weapons.find((w) => w.type === 'ranged') : undefined;
  const needsReload = !!rangedW && (rangedW.reload ?? 0) > 0 && !active.loaded;
  const ammoChoices = isHero && rangedW ? compatibleAmmo(active, rangedW) : [];

  // Guérison : soi + alliés (héros) adjacents soignables, si le héros a la Compétence et peut agir.
  const canHeal = isHero && hasHealSkill(active) && !battle.acted && !stunned;
  const healTargets = canHeal ? healableTargets(active, battle.combatants.filter((c) => c.kind === 'hero'), { adjacency: true }) : [];

  const hasMvt = canCharge || canRun || canStandUp || engaged;
  const hasTir = !!rangedW;
  const hasObjets = usableGroups.length > 0 || groundItems.length > 0;

  const hint =
    battle.action === 'move' ? 'Cliquez une case bleue pour vous déplacer.'
    : battle.action === 'attack' ? "Cliquez un ennemi adjacent pour l'attaquer."
    : battle.action === 'charge' ? 'Cliquez un ennemi à charger (jusqu’à 2× le Mouvement).'
    : battle.action === 'cast' && battle.selectedSpell ? `Cliquez une cible pour lancer ${battle.selectedSpell}.`
    : battle.action === 'trample' ? 'Cliquez un adversaire adjacent plus petit à piétiner (coûte 1 Avantage).'
    : battle.action === 'heal' ? 'Choisissez la cible à soigner (soi ou allié adjacent).'
    : null;

  return (
    <div className="action-bar">
      {/* ── Sous-panneaux (au-dessus de la barre) ── */}
      {hasSpells && battle.action === 'cast' && (
        <div className="ab-spells">
          {active.spells!.map((label) => {
            const spell = findSpell(label);
            if (!spell) return null;
            const selected = battle.selectedSpell === label;
            const ni = spell.cn != null ? `NI ${spell.cn}` : 'Prière';
            const canFocus = isArcaneSpell(spell) && (spell.cn ?? 0) > 0;
            const focusDr = active.focus?.spell === label ? active.focus.dr : null;
            return (
              <div key={label} className="ab-spell-row">
                <button className={`btn btn-sm ${selected ? 'btn-primary' : ''}`} onClick={() => selectSpell(label)} title={spell.desc}>
                  {spell.label} <span className="bp-spell-ni">({ni})</span>
                </button>
                {canFocus && (
                  <button className="btn btn-sm" onClick={() => focusSpell(label)} title="Test étendu de Focalisation">
                    Focaliser{focusDr != null ? ` (${focusDr}/${spell.cn})` : ''}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {battle.action === 'heal' && (
        <div className="ab-spells">
          {healTargets.length === 0 && <div className="ab-hint">Aucune cible à portée.</div>}
          {healTargets.flatMap((t) =>
            availableHealModes(t).map((m) => (
              <div key={`${t.id}:${m}`} className="ab-spell-row">
                <button className="btn btn-sm" onClick={() => heal(t.id, m)} title="Test de Guérison Intermédiaire (+0) — coûte l'Action (LDB 09-Compétences)">
                  {m === 'wounds'
                    ? `🩹 Soigner ${t.name} (${t.wounds.current}/${t.wounds.max})`
                    : `🩸 Stopper l'hémorragie de ${t.name} (${bleedStacks(t)} pion)`}
                </button>
              </div>
            )),
          )}
        </div>
      )}
      {battle.action === 'mvt' && (
        <div className="ab-spells">
          {canCharge && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.moved || battle.acted || stunned} onClick={() => selectAction('charge')} title="Se ruer au contact (jusqu'à 2× le Mouvement) puis attaquer (LDB Charge)">🏃 Charger</button>
            </div>
          )}
          {canRun && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={run} title="Courir : Action + Test d'Athlétisme (+20) → déplacement étendu (LDB 15)">💨 Courir</button>
            </div>
          )}
          {canStandUp && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" onClick={standUp} title="Se relever de l'État À Terre — utilise le Mouvement (LDB 16)">🧍 Se relever</button>
            </div>
          )}
          {engaged && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted} onClick={disengage} title="Quitter le corps à corps (Esquive / sacrifice d'Avantage, LDB Désengagement)">🚪 Se désengager</button>
            </div>
          )}
        </div>
      )}
      {battle.action === 'tir' && (
        <div className="ab-spells">
          {rangedW && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned || active.aiming} onClick={aim} title="Viser : +20 (Accessible) au prochain tir — coûte l'Action (LDB Difficultés)">🎯 {active.aiming ? 'En joue ✓' : 'Viser'}</button>
            </div>
          )}
          {needsReload && (
            <div className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned} onClick={reload} title="Recharger (Test étendu de Projectiles — coûte l'Action)">🔄 Recharger{active.reloadProgress ? ` (${active.reloadProgress}/${rangedW!.reload} DR)` : ''}</button>
            </div>
          )}
          {ammoChoices.length > 1 && (
            <div className="ab-spell-row">
              <button className={`btn btn-sm ${battle.action === 'ammo' ? 'btn-primary' : ''}`} onClick={() => selectAction('ammo')} title="Choisir la munition à tirer">🏹 Munition</button>
            </div>
          )}
        </div>
      )}
      {battle.action === 'ammo' && (
        <div className="ab-spells">
          {ammoChoices.map((a) => (
            <div key={a.uid} className="ab-spell-row">
              <button className={`btn btn-sm ${active.ammoUid === a.uid ? 'btn-primary' : ''}`} onClick={() => selectAmmo(a.uid)} title={(a.qualities ?? []).join(', ')}>🏹 {a.name} ×{a.qty}</button>
            </div>
          ))}
        </div>
      )}
      {battle.action === 'objets' && (
        <div className="ab-spells">
          {usableGroups.map((g) => (
            <div key={g.name} className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned} onClick={() => useItem(g.uids[0])} title={g.desc}>🧪 {g.name}{g.uids.length > 1 ? ` ×${g.uids.length}` : ''}</button>
            </div>
          ))}
          {groundItems.map((g) => (
            <div key={`${g.entityId}:${g.key}`} className="ab-spell-row">
              <button className="btn btn-sm" disabled={battle.acted || stunned} onClick={() => pickup(g.entityId, g.key)} title="Ramasser cet objet au sol (coûte l'Action) — LDB Combat">✋ {g.label}</button>
            </div>
          ))}
        </div>
      )}
      {removableConditions.length > 0 && battle.action === 'resolve' && (
        <div className="ab-spells">
          {removableConditions.map((c) => (
            <div key={c.name} className="ab-spell-row">
              <button className="btn btn-sm" onClick={() => spendResolve(c.name)} title="Dépense un point de Détermination pour retirer cet État (LDB Destin)">✊ Retirer {c.name}{c.value > 1 ? ` (${c.value})` : ''}</button>
            </div>
          ))}
        </div>
      )}

      {stunned && isHero && <div className="ab-hint">Sonné : aucune Action ce tour (déplacement à demi-Mouvement).</div>}
      {hint && <div className="ab-hint">{hint}</div>}

      <div className="ab-bar">
        <div className="ab-actor">
          <span className="ab-portrait" style={{ borderColor: ring, color: ring }}>{active.name.charAt(0)}</span>
          <div className="ab-actor-info">
            <strong>{active.name}</strong>
            <span className="ab-meta">
              {active.career ?? (isHero ? '' : 'Ennemi')} · {active.wounds.current}/{active.wounds.max}
              {active.advantage > 0 && <span className="adv"> Av+{active.advantage}</span>}
            </span>
          </div>
        </div>

        {isHero ? (
          <div className="ab-slots">
            {/* ── Primaires directs ── */}
            <button className={`ab-slot ${battle.action === 'move' ? 'on' : ''}`} disabled={battle.moved || (engaged && battle.acted)} onClick={() => selectAction(battle.action === 'move' ? null : 'move')} title={engaged ? 'Engagé : « Déplacer » lance un Désengagement (Esquive ou sacrifice d’Avantage)' : undefined}>
              <span className="ab-ico">🦶</span><span className="ab-lbl">Déplacer{battle.moved && ' ✓'}</span>
            </button>
            <button className={`ab-slot ${battle.action === 'attack' ? 'on' : ''}`} disabled={battle.acted || stunned} onClick={() => selectAction(battle.action === 'attack' ? null : 'attack')}>
              <span className="ab-ico">⚔️</span><span className="ab-lbl">Attaquer{battle.acted && ' ✓'}</span>
            </button>
            {hasSpells && (
              <button className={`ab-slot ${battle.action === 'cast' ? 'on' : ''}`} disabled={battle.acted || stunned} onClick={() => selectAction(battle.action === 'cast' ? null : 'cast')}>
                <span className="ab-ico">✨</span><span className="ab-lbl">Incanter{battle.acted && ' ✓'}</span>
              </button>
            )}
            {canHeal && healTargets.length > 0 && (
              <button className={`ab-slot ${battle.action === 'heal' ? 'on' : ''}`} disabled={battle.acted || stunned} onClick={() => selectAction(battle.action === 'heal' ? null : 'heal')} title="Soigner (Compétence Guérison) : rend des PB ou stoppe une hémorragie — coûte l'Action (LDB 09-Compétences)">
                <span className="ab-ico">🩹</span><span className="ab-lbl">Soigner</span>
              </button>
            )}
            <button className="ab-slot" disabled={battle.acted || stunned} onClick={defendTotal} title="+20 à tous vos Tests de défense jusqu'à votre prochain tour">
              <span className="ab-ico">🛡️</span><span className="ab-lbl">Défensive{battle.acted && ' ✓'}</span>
            </button>

            {/* ── Catégories repliables ── */}
            {hasMvt && (
              <button className={`ab-slot ${battle.action === 'mvt' ? 'on' : ''}`} onClick={() => selectAction(battle.action === 'mvt' ? null : 'mvt')} title="Manœuvres de déplacement (Charger, Courir, Se relever, Se désengager)">
                <span className="ab-ico">🏃</span><span className="ab-lbl">Mouvement ▾</span>
              </button>
            )}
            {hasTir && (
              <button className={`ab-slot ${battle.action === 'tir' || battle.action === 'ammo' ? 'on' : ''}`} onClick={() => selectAction(battle.action === 'tir' || battle.action === 'ammo' ? null : 'tir')} title="Options de tir (Viser, Recharger, Munition)">
                <span className="ab-ico">🏹</span><span className="ab-lbl">Tir ▾</span>
              </button>
            )}
            {hasObjets && (
              <button className={`ab-slot ${battle.action === 'objets' ? 'on' : ''}`} onClick={() => selectAction(battle.action === 'objets' ? null : 'objets')} title="Objets : utiliser une potion, ramasser au sol">
                <span className="ab-ico">🧪</span><span className="ab-lbl">Objets ▾</span>
              </button>
            )}

            {/* ── Alerte visible (hors catégorie) ── */}
            {removableConditions.length > 0 && (
              <button className={`ab-slot ab-alert ${battle.action === 'resolve' ? 'on' : ''}`} onClick={() => selectAction(battle.action === 'resolve' ? null : 'resolve')} title="Détermination : retirer un État (ne coûte pas l'Action) — LDB Destin">
                <span className="ab-ico">✊</span><span className="ab-lbl">Détermination ({resolve})</span>
              </button>
            )}

            {/* ── Contextuels rares ── */}
            {canFrenzy && (
              <button className="ab-slot" onClick={frenzy} title="Entrer en Frénésie : Test de Force Mentale — coûte l'Action (LDB 21)">
                <span className="ab-ico">🐗</span><span className="ab-lbl">Frénésie</span>
              </button>
            )}
            {canTrample && (
              <button className={`ab-slot ${battle.action === 'trample' ? 'on' : ''}`} onClick={() => selectAction(battle.action === 'trample' ? null : 'trample')} title="Piétiner un adversaire adjacent plus petit : action gratuite à 1 Avantage (LDB Taille)">
                <span className="ab-ico">🐾</span><span className="ab-lbl">Piétiner</span>
              </button>
            )}

            <button className="ab-slot ab-end" onClick={endTurn}>
              <span className="ab-ico">⏭️</span><span className="ab-lbl">Fin du tour</span>
            </button>
          </div>
        ) : (
          <div className="ab-enemy">⚔️ Tour de l'ennemi…</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Autoriser l'ouverture des conteneurs quand Sonné** (re-lire `battleSelectAction` dans `store.ts`)

Remplacer la garde Sonné :

```ts
    if (a !== 'move' && a !== 'resolve' && a !== null && !canTakeAction(active)) return;
```

par (les conteneurs Mouvement/Tir/Objets restent ouvrables — leurs feuilles portent leur propre `disabled` ; `heal`/`attack`/`cast` restent bloqués) :

```ts
    if (a !== 'move' && a !== 'resolve' && a !== 'mvt' && a !== 'tir' && a !== 'objets' && a !== null && !canTakeAction(active)) return;
```

- [ ] **Step 4 : typecheck + suite UI/state**

Run: `npm run typecheck && npm test`
Expected: PASS. Vérifier qu'aucun `switch` exhaustif sur `battle.action` n'explose ailleurs (notamment `IsoStage.tsx` : les nouveaux modes `heal`/`mvt`/`tir`/`objets` ne déclenchent pas de clic-case → no-op attendu ; corriger si un `default` lève).

- [ ] **Step 5 : Commit**

```bash
git add src/ui/ActionBar.tsx src/state/store.ts
git commit -- src/ui/ActionBar.tsx src/state/store.ts -m "feat(ui): ActionBar désencombrée (Mouvement/Tir/Objets repliables, Détermination en alerte, Soigner direct)"
```

---

## Task 7 : Vérification finale + recette navigateur

**Files:** aucun (validation).

- [ ] **Step 1 : Suite complète + typecheck**

Run: `npm test && npm run typecheck`
Expected: tout vert (dont `roll-modal-invariant`, `heal`, `healing`, `persistence`, `store`).

- [ ] **Step 2 : Recette navigateur** (Playwright MCP — cf. CLAUDE.md « Vérification »)

1. `npm run dev`, charger `localhost:5173`, menu **« 🧪 Tests — scénarios »** → un scénario de combat avec un héros possédant **Guérison** et un allié blessé/hémorragique adjacent. Si aucun scénario adapté : en créer un dans `src/scenes/test-scenarios/` (cf. `docs/test-scenarios.md`).
2. Vérifier la barre : primaires + **Mouvement ▾ / Tir ▾ / Objets ▾** repliés, **Détermination** visible si État retirable, **🩹 Soigner** présent.
3. Cliquer **Soigner** → sous-panneau cibles → choisir « Soigner Blessures » → modale → Lancer → Appliquer → PB de la cible montent, l'Action est consommée.
4. Cas hémorragie : allié avec Hémorragique → « Stopper l'hémorragie » → pions retirés (et Exténué si dernier).
5. Cas inconscient : allié à 0 PB Inconscient adjacent → Soigner Blessures réussi → il reprend connaissance (Inconscient retiré, reste À Terre).
6. Hors-combat : ouvrir la fiche d'un héros blessé → **🩹 Soigner** → modale → applique sans avancer l'horloge.
7. `console` : 0 erreur. Screenshot de la barre désencombrée.

- [ ] **Step 3 : Mémoire** — écrire une note mémoire « game-guerison-action » (sous-système Guérison livré : combat+hors-combat, limite 1/rencontre, compose avec `outOfCombatUpkeep`) et lier `[[game-consequences-combat-persistantes]]`, `[[game-jet-modale-exhaustif]]`.

- [ ] **Step 4 : Commit final éventuel** (scénario de test ajouté) puis pousser si demandé.

---

## Self-Review (couverture spec)

- **Soin BI+DR, 1/rencontre, +0 combat** → Task 1 (`healWoundsDelta`, `availableHealModes`) + Task 2/3 (flag, reset). ✓
- **Arrêt Hémorragie 1+DR, Exténué** → Task 1 (`stopBleedOutcome`, `applyStopBleed`). ✓
- **Échec BI+DR<0 → Blessures** → Task 1 (`applyHealWounds` delta<0). ✓
- **Compétence Avancée → gate** → Task 1 (`hasHealSkill`) + Task 6 (slot conditionnel). ✓
- **Combat : soi + allié adjacent, inconscients inclus** → Task 1 (`healableTargets`) + Task 3 (tests KO). ✓
- **Hors-combat (meilleur soigneur)** → Task 3 (`healAlly`) + Task 5 (bouton). ✓
- **« un jet = une modale »** → Task 3 (PendingHeal + résolveurs nommés `*Roll/*Confirm/…`) + Task 4 (HealModal) ; garde-fou vérifié Step 13. ✓
- **Désencombrement (catégories + Détermination visible, Piétiner/Frénésie contextuels)** → Task 6. ✓
- **Infection sur Échec Stupéfiant** → hors scope (pas de système de maladie) ; non implémenté, conforme spec §8. ✓
- **Compose avec `outOfCombatUpkeep`** → Task 5 (pas d'avance de temps) + section Coordination. ✓
