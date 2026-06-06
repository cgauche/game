# Plan A — Persistance des conséquences de combat (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En fin de combat, réécrire vers le groupe (`party`) l'état persistant de chaque héros — Blessures, Blessures critiques cumulées, **mort** (`dead`/`outOfRencontre`), et **États persistants** (RAW) — et le ré-importer au combat suivant ; les états de combat transitoires sont jetés.

**Architecture :** Un module moteur **pur** (`engine/persistence.ts`) définit le classement RAW des États persistants et extrait l'état à reporter. Le store l'appelle (1) en fin de combat (`checkBattleOver` → `finalizeBattle`) pour écrire vers `party`, et (2) au lancement d'un combat (`startCombat`) pour le carry-in (ne pas instancier les morts, importer les États persistants, réinitialiser le transitoire).

**Tech Stack :** TypeScript, Zustand (`useGame`), Vitest. Source RAW : `16 - États.md`.

---

## Contexte (à lire avant de commencer)

- **Le trou** : `src/state/store.ts` ~l.647 (corps de `startCombat`) clone chaque héros du groupe
  avec `conditions: []` et `wounds: { ...h.wounds }` ; `checkBattleOver` (~l.2143) termine le combat
  (`over: 'victory' | 'defeat'`) **sans rien réécrire** vers `party`. Les héros repartent frais.
- **Classement RAW des États** (source `Source/Warhammer v4 - Livre de base version corrigée/16 - États.md`) :
  - **Transitoires** (retirés en/par le combat — NON persistés) : `Assourdi` (l.32), `À Terre` (l.41),
    `Aveuglé` (l.48), `Surpris` (l.136), `Sonné` (l.125), `Empêtré` (l.61). Plus l'état de combat `Engagé`.
  - **Persistants** (repos/Guérison/Tests hors combat — persistés) : `Brisé` (l.57-59), `Empoisonné`
    (l.70), `En flammes` (l.77), `Exténué` (l.91 « il faut du repos »), `Hémorragique` (l.107),
    `Inconscient` (l.116).
- **Champs `Combatant` persistants** (existants, `engine/types.ts:122`) : `wounds`, `conditions`,
  `criticalWounds`, `roundsAtZero`, `dead`, `outOfRencontre`. (`traumas`/`damageTaken` = Plans B/C, pas ici.)
- **Conventions** : moteur pur + testé ; FR ; commits de **mes seuls fichiers** (`git commit -- <chemins>`,
  working tree partagé avec la session rig). Runners via Bash natif (RTK). `npm test`, `npm run typecheck`.

---

## Task 1 : Module de persistance (pur)

**Files:**
- Create: `src/engine/persistence.ts`
- Test: `src/engine/persistence.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/engine/persistence.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { PERSISTENT_CONDITIONS, carryOverState } from './persistence';
import type { Combatant } from './types';

function baseCombatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h1', name: 'Test', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 3, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
    ...over,
  } as Combatant;
}

describe('persistence — classement RAW des États', () => {
  it('classe les États persistants (LDB 16-États)', () => {
    expect(PERSISTENT_CONDITIONS.has('Hémorragique')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('Empoisonné')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('En flammes')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('Exténué')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('Brisé')).toBe(true);
    expect(PERSISTENT_CONDITIONS.has('Inconscient')).toBe(true);
  });
  it('exclut les États transitoires', () => {
    for (const n of ['Surpris', 'À Terre', 'Sonné', 'Aveuglé', 'Assourdi', 'Empêtré']) {
      expect(PERSISTENT_CONDITIONS.has(n)).toBe(false);
    }
  });
});

describe('persistence — carryOverState', () => {
  it('conserve Blessures, critiques, mort et les États persistants ; jette le transitoire', () => {
    const c = baseCombatant({
      wounds: { current: 4, max: 12 },
      conditions: [{ name: 'Hémorragique', value: 2 }, { name: 'Surpris', value: 1 }, { name: 'Exténué', value: 1 }],
      criticalWounds: 1, roundsAtZero: 0, dead: false, outOfRencontre: false,
    });
    const s = carryOverState(c);
    expect(s.wounds.current).toBe(4);
    expect(s.criticalWounds).toBe(1);
    expect(s.conditions.find((x) => x.name === 'Hémorragique')?.value).toBe(2);
    expect(s.conditions.some((x) => x.name === 'Exténué')).toBe(true);
    expect(s.conditions.some((x) => x.name === 'Surpris')).toBe(false);
  });
  it('reporte la mort (dead / outOfRencontre)', () => {
    expect(carryOverState(baseCombatant({ dead: true })).dead).toBe(true);
    expect(carryOverState(baseCombatant({ outOfRencontre: true })).outOfRencontre).toBe(true);
  });
  it('ne partage pas les références de conditions (copie défensive)', () => {
    const c = baseCombatant({ conditions: [{ name: 'Hémorragique', value: 1 }] });
    const s = carryOverState(c);
    s.conditions[0].value = 99;
    expect(c.conditions[0].value).toBe(1);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- src/engine/persistence.test.ts`
Expected: FAIL — « Cannot find module './persistence' » / `carryOverState` non défini.

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `src/engine/persistence.ts` :

```ts
/**
 * Persistance des conséquences de combat — ce qui suit le héros d'un combat au suivant.
 * Les États persistants sont sourcés du Livre de base (16-États.md) : ils exigent repos,
 * Compétence Guérison, Sort/Prière ou Tests hors combat — par opposition aux états de combat
 * transitoires (Surpris/À Terre/Sonné/Aveuglé/Assourdi/Empêtré), retirés en/par le combat.
 * La récupération elle-même (temps, repos, Guérison, Chirurgie) reste hors périmètre (Jalon 5).
 */
import { Combatant, ConditionInstance } from './types';

/** États qui persistent après le combat (LDB 16-États : Brisé l.57, Empoisonné l.70,
 *  En flammes l.77, Exténué l.91, Hémorragique l.107, Inconscient l.116). */
export const PERSISTENT_CONDITIONS: ReadonlySet<string> = new Set([
  'Brisé', 'Empoisonné', 'En flammes', 'Exténué', 'Hémorragique', 'Inconscient',
]);

/** État persistant d'un combattant à reporter vers le groupe (fin de combat) ou à ré-importer
 *  (combat suivant). N'inclut QUE ce qui survit hors combat ; le transitoire est omis. Copie défensive. */
export function carryOverState(c: Combatant): {
  wounds: { current: number; max: number };
  conditions: ConditionInstance[];
  criticalWounds: number;
  roundsAtZero: number;
  dead: boolean;
  outOfRencontre: boolean;
} {
  return {
    wounds: { current: c.wounds.current, max: c.wounds.max },
    conditions: c.conditions.filter((x) => PERSISTENT_CONDITIONS.has(x.name)).map((x) => ({ ...x })),
    criticalWounds: c.criticalWounds ?? 0,
    roundsAtZero: c.roundsAtZero ?? 0,
    dead: c.dead === true,
    outOfRencontre: c.outOfRencontre === true,
  };
}

/** États persistants seuls (pour le carry-in au spawn d'un combat). Copie défensive. */
export function persistentConditions(c: Combatant): ConditionInstance[] {
  return c.conditions.filter((x) => PERSISTENT_CONDITIONS.has(x.name)).map((x) => ({ ...x }));
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- src/engine/persistence.test.ts`
Expected: PASS (les 5 tests verts).

- [ ] **Step 5 : Commit**

```bash
git add src/engine/persistence.ts src/engine/persistence.test.ts
git commit -- src/engine/persistence.ts src/engine/persistence.test.ts -m "feat(engine): persistence -- classement RAW des Etats + carryOverState (pur+teste)"
```

---

## Task 2 : Writeback en fin de combat (`finalizeBattle`)

**Files:**
- Modify: `src/state/store.ts` (import en tête ; nouvelle fn `finalizeBattle` ; appels dans `checkBattleOver` ~l.2143)
- Test: `src/state/store.test.ts` (nouveau test)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `src/state/store.test.ts`, à l'intérieur du `describe('Boucle de jeu (store)', …)` (par ex. après le test « le trigger de la route déclenche l'embuscade ») :

```ts
it('persiste Blessures + critiques + États persistants vers le groupe en fin de combat (victoire)', () => {
  const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(tome1Intro);
  useGame.getState().startCombat('enc-mutants');
  vi.clearAllTimers(); // purge le timer d'IA armé par startCombat — on pilote l'ordre nous-mêmes

  const b = useGame.getState().battle!;
  // Héros blessé + 1 État persistant + 1 transitoire + 1 critique ; tous les ennemis hors de combat.
  const combatants = b.combatants.map((c) =>
    c.kind === 'hero'
      ? { ...c, wounds: { ...c.wounds, current: 4 }, criticalWounds: 1,
          conditions: [{ name: 'Hémorragique', value: 2 }, { name: 'Surpris', value: 1 }] }
      : { ...c, dead: true },
  );
  const heroId = combatants.find((c) => c.kind === 'hero')!.id;
  const enemyIds = combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
  // Ordre = ennemis puis héros ; on se place juste AVANT le héros pour que le prochain tour soit le sien
  // (évite un franchissement de Round, donc pas de tick Hémorragique pendant le test).
  const order = [...enemyIds, heroId];
  useGame.setState({ battle: { ...b, combatants, order, turn: order.length - 2 } });

  useGame.getState().battleEndTurn(); // → advanceTurn → prochain acteur = héros → checkBattleOver → victoire → writeback

  const st = useGame.getState();
  expect(st.battle?.over).toBe('victory');
  const h = st.party[0];
  expect(h.wounds.current).toBe(4);                                              // Blessures persistées
  expect(h.criticalWounds).toBe(1);                                             // critiques persistés
  expect(h.conditions.find((x) => x.name === 'Hémorragique')?.value).toBe(2);    // persistant conservé
  expect(h.conditions.some((x) => x.name === 'Surpris')).toBe(false);            // transitoire jeté
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- src/state/store.test.ts -t "fin de combat"`
Expected: FAIL — `h.wounds.current` vaut 12 (max, non persisté) et `Surpris` encore présent.

- [ ] **Step 3 : Écrire l'implémentation**

Dans `src/state/store.ts`, ajouter l'import près des autres imports moteur (vers le haut du fichier, où `engine/conditions` est importé) :

```ts
import { carryOverState, persistentConditions } from '../engine/persistence';
```

Ajouter la fonction `finalizeBattle` juste **au-dessus** de `function checkBattleOver(` :

```ts
/** Fin de combat : réécrit l'état persistant de chaque héros (Blessures, critiques, mort, États
 *  persistants) vers `party`. Idempotent ; les champs non persistants du membre party sont conservés. */
function finalizeBattle(get: () => GameState, set: any): void {
  const { battle, party } = get();
  if (!battle) return;
  const newParty = party.map((h) => {
    const c = battle.combatants.find((x) => x.id === h.id && x.kind === 'hero');
    return c ? { ...h, ...carryOverState(c) } : h;
  });
  set({ party: newParty });
}
```

Modifier `checkBattleOver` pour appeler `finalizeBattle` dès qu'une issue est posée (victoire **et** défaite) :

```ts
function checkBattleOver(get: () => GameState, set: any): boolean {
  const battle = get().battle;
  if (!battle || battle.over) return true;
  const heroesAlive = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c));
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !isOutOfAction(c));
  if (!enemiesAlive) {
    finalizeBattle(get, set); // writeback AVANT onVictory (qui ajoute XP/butin au groupe)
    set({ battle: { ...get().battle!, over: 'victory', log: [...battle.log, 'Victoire !'] } });
    if (battle.onVictory) applyEffects(get, set, battle.onVictory);
    return true;
  }
  if (!heroesAlive) {
    finalizeBattle(get, set);
    set({ battle: { ...get().battle!, over: 'defeat', log: [...battle.log, 'Défaite…'] } });
    return true;
  }
  return false;
}
```

> Note : on relit `get().battle!` dans le `set` de l'issue car `finalizeBattle` n'a touché que
> `party` (pas `battle`) — `battle` est inchangé, mais relire évite toute capture périmée si la fn évolue.

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- src/state/store.test.ts -t "fin de combat"`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -- src/state/store.ts src/state/store.test.ts -m "feat(store): finalizeBattle -- writeback de l'etat persistant des heros en fin de combat"
```

---

## Task 3 : Carry-in au lancement d'un combat (`startCombat`)

**Files:**
- Modify: `src/state/store.ts` (corps de `startCombat`, ~l.642-663 : spawn des héros)
- Test: `src/state/store.test.ts` (deux nouveaux tests)

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `src/state/store.test.ts` (même `describe`) :

```ts
it('ré-importe les États persistants du groupe au lancement du combat (carry-in)', () => {
  const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
  // Le membre du groupe porte un État persistant (Hémorragique) et un transitoire (À Terre).
  useGame.setState({ party: [{ ...hero, conditions: [{ name: 'Hémorragique', value: 1 }, { name: 'À Terre', value: 1 }] }] });
  useGame.getState().startScene(tome1Intro);
  useGame.getState().startCombat('enc-mutants');
  vi.clearAllTimers();
  const h = useGame.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
  expect(h.conditions.find((x) => x.name === 'Hémorragique')?.value).toBe(1); // persistant ré-importé
  expect(h.conditions.some((x) => x.name === 'À Terre')).toBe(false);          // transitoire ignoré
});

it("n'instancie pas un héros mort/éjecté au combat suivant", () => {
  const a = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
  const b = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'B', rng: makeRNG(2) });
  useGame.setState({ party: [a, { ...b, dead: true }] });
  useGame.getState().startScene(tome1Intro);
  useGame.getState().startCombat('enc-mutants');
  vi.clearAllTimers();
  const heroes = useGame.getState().battle!.combatants.filter((c) => c.kind === 'hero');
  expect(heroes.length).toBe(1);
  expect(heroes[0].name).toBe('A');
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npm test -- src/state/store.test.ts -t "carry-in"` puis `-t "mort"`
Expected: FAIL — l'État persistant n'est pas ré-importé (`conditions: []` forcé) ; le héros mort EST instancié.

- [ ] **Step 3 : Écrire l'implémentation**

Dans `src/state/store.ts`, corps de `startCombat`, remplacer le bloc de spawn des héros (actuellement
`const heroes = party.map((h, i) => { … conditions: [], … });`) par :

```ts
    // Carry-in : on n'instancie pas les morts/éjectés ; on ré-importe les États PERSISTANTS du
    // groupe (Hémorragique, Empoisonné…) et on réinitialise tout l'état de combat transitoire.
    const livingParty = party.filter((h) => !h.dead && !h.outOfRencontre);
    const heroes = livingParty.map((h, i) => {
      const c = {
        ...JSON.parse(JSON.stringify(h)),
        pos: { x: Math.max(0, partyPos.x - 1), y: Math.min(scene.dimensions.h - 1, partyPos.y + i) },
        advantage: 0,
        conditions: persistentConditions(h), // États persistants seuls (le transitoire est jeté)
        activeEffects: [],                    // buffs en Rounds : ne survivent pas entre combats
        engagedWith: [], // pas d'Engagement hérité d'un combat précédent
        meleeThisRound: [],
        roundsAtZero: 0, // l'horloge de mort lente repart à neuf
        wounds: { ...h.wounds },
      } as Combatant;
      // Munition par défaut + arme à distance chargée au début du combat (le `loaded` ne sert qu'aux armes à Recharge).
      const rw = c.weapons.find((w) => w.type === 'ranged');
      c.loaded = true;
      c.reloadProgress = 0;
      if (rw) c.ammoUid = compatibleAmmo(c, rw)[0]?.uid;
      return c;
    });
```

> `persistentConditions` est déjà importé en Task 2. Si `engagedWith`/`meleeThisRound` n'existent pas
> sur `Combatant`, garder exactement les clés présentes dans le code d'origine (ne pas en inventer).

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test -- src/state/store.test.ts -t "carry-in"` puis `-t "mort"`
Expected: PASS (les deux).

- [ ] **Step 5 : Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -- src/state/store.ts src/state/store.test.ts -m "feat(store): carry-in -- Etats persistants reimportes, morts non instancies au combat"
```

---

## Task 4 : Vérification globale (suite + typecheck)

**Files:** aucun (vérification).

- [ ] **Step 1 : Suite complète**

Run: `npm test`
Expected: tous les tests verts (les nouveaux + aucune régression sur les ~existants store/engine).

- [ ] **Step 2 : Typecheck**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 3 : (si rouge) diagnostiquer**

Si un test existant casse à cause du writeback (ex. un test qui enchaîne des combats et supposait des
héros « frais »), lire l'assertion : soit le test encodait l'ancien bug (à corriger pour refléter la
persistance), soit le carry-in/writeback a un effet de bord non voulu (corriger l'implémentation). Ne
pas masquer un échec en relâchant une assertion sans comprendre.

---

## Task 5 : Vérification navigateur (recette)

**Files:** aucun (recette manuelle Playwright/dev).

- [ ] **Step 1 : Lancer le dev** — `npm run dev` (http://localhost:5173), hard reload (HMR souvent périmé).
- [ ] **Step 2 : Scénario** — via « 🧪 Tests — scénarios », charger un scénario à **deux rencontres**
  (carte multi-encounters type Chapitre 2 « Du Sang Sur la Route ») ; mener la 1re rencontre en se
  faisant blesser (PB réduits, idéalement un État Hémorragique).
- [ ] **Step 3 : Vérifier la persistance** — au déclenchement de la 2e rencontre, le héros blessé
  **démarre avec ses Blessures réduites** (pas à plein) et son État persistant ; un héros mis hors de
  combat à la 1re (mort) **n'apparaît pas** dans la 2e. Console = 0 erreur.
- [ ] **Step 4 : Capturer** un screenshot avant/après pour la trace.

---

## Self-review (déjà passée à la rédaction)

- **Couverture spec (Plan A)** : writeback (Task 2), carry-in + mort non instanciée (Task 3),
  classement RAW des États (Task 1, sourcé `16-États`), vérif (Tasks 4-5). ✅
- **Placeholders** : aucun — code complet à chaque étape, commandes exactes. ✅
- **Cohérence des types** : `carryOverState`/`persistentConditions`/`PERSISTENT_CONDITIONS` définis en
  Task 1, consommés tels quels en Tasks 2-3 ; `finalizeBattle(get, set)` signature unique. ✅
- **Hors périmètre** (rappel) : `traumas`/`damageTaken` (Plans B/C) ne sont PAS persistés ici (champs
  inexistants) — `carryOverState` sera étendu quand ils existeront ; récupération/soins = Jalon 5.
