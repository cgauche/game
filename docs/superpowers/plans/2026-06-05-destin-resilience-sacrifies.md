# Destin & Résilience sacrifiés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacrifices canon (LDB ch.17) : Destin (« Comment ça a pu rater ? » sur coup létal, « Meurs un autre jour » sur coup létal ET mort lente) via suspension `pendingFateSave` ; Résilience « Je ne faillirai pas ! » (réussite garantie, opposé +1 DR) dans les modales.

**Architecture :** un chokepoint `finalizeHeroDeath` (mort directe OU pause Destin selon `fate`) sur les deux sites de mort (`applyCriticalToTarget` retourne la létalité ; upkeep de fin de Round) ; `advanceTurn` scindé (`resolveRoundBoundary` résumable) pour suspendre en fin de Round ; gardes IA sur `pendingFateSave` (motif de la défense). Résilience = action store par flux + bouton modale.

**Tech Stack :** Vite + TS + React, Zustand, Vitest, RNG seedable. Source : `Source/Warhammer v4 - Livre de base version corrigée/17 - Destin et Résistance.md`.

**Décisions verrouillées (spec) :** déclencheur Destin = coup létal + mort lente ; « Comment ça a pu rater ? » = coup létal seulement (restaure les PB d'avant, criticalWounds−1) ; « Meurs un autre jour » → `outOfRencontre` (vivant, hors combat) ; « Je te renie ! » et choix de localisation de Critique = hors périmètre.

**Commandes :** `npx vitest run <fichier>` ; `npm test` + `npm run typecheck`.

---

## Task 1 : Moteur — `outOfRencontre`, `isOutOfAction`, `inDeathCondition`, `tickDeath` sans finalisation

**Files:**
- Modify: `src/engine/types.ts` (Combatant)
- Modify: `src/engine/conditions.ts`
- Test: `src/engine/death.test.ts` (ajouts)

- [ ] **Step 1 : Ajouter le champ** (`types.ts`, après `important?: boolean;`) :
```ts
  /** « Meurs un autre jour » (Destin) : éjecté de la rencontre — vivant mais hors de combat. */
  outOfRencontre?: boolean;
```

- [ ] **Step 2 : Écrire les tests (échec attendu)** — ajouter à `src/engine/death.test.ts` :
```ts
import { inDeathCondition } from './conditions';

describe('Destin — états dérivés', () => {
  const dying = (over = {}): Combatant => (mk as any)({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4, ...over }); // BE=3
  it('outOfRencontre = hors de combat (mais pas mort)', () => {
    const h = mk({ outOfRencontre: true });
    expect(isOutOfAction(h)).toBe(true);
    expect(h.dead ?? false).toBe(false);
  });
  it('inDeathCondition : Inconscient + 0 PB + critiques > BE', () => {
    expect(inDeathCondition(dying())).toBe(true);
    expect(inDeathCondition(mk({ wounds: { current: 5, max: 12 } }))).toBe(false); // pas à 0
    expect(inDeathCondition(dying({ dead: true }))).toBe(false); // déjà mort
    expect(inDeathCondition(dying({ outOfRencontre: true }))).toBe(false); // déjà éjecté
  });
  it('tickDeath ne finalise plus la mort (seulement 0 PB→Inconscient)', () => {
    const h = mk({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4 });
    tickDeath(h, makeRNG(1));
    expect(h.dead ?? false).toBe(false); // la finalisation est désormais portée par le store
  });
});
```
(`mk` est déjà défini en tête de `death.test.ts`.)

- [ ] **Step 3 : Lancer → échec** (`inDeathCondition` manquant + `tickDeath` met encore `dead`).

Run: `npx vitest run src/engine/death.test.ts`
Expected: FAIL.

- [ ] **Step 4 : Modifier `conditions.ts`.**

`isOutOfAction` — ajouter `outOfRencontre` :
```ts
export function isOutOfAction(c: Combatant): boolean {
  return c.dead === true || c.outOfRencontre === true || hasCondition(c, 'Inconscient') || (usesSuddenDeath(c) && c.wounds.current <= 0);
}
```

Ajouter `inDeathCondition` (avant `tickDeath`) :
```ts
/** Condition de mort lente (LDB 18 l.48-49) : Inconscient + 0 PB + (Blessures critiques > BE),
 *  et pas déjà mort/éjecté. */
export function inDeathCondition(c: Combatant): boolean {
  if (c.dead || c.outOfRencontre) return false;
  const be = bonus(effectiveChar(c, 'E'));
  return hasCondition(c, 'Inconscient') && c.wounds.current <= 0 && (c.criticalWounds ?? 0) > be;
}
```

`tickDeath` — RETIRER la finalisation de la mort (le bloc `if (hasCondition(c,'Inconscient') && (criticalWounds>be)) { c.dead = true; … }`). Nouveau corps :
```ts
export function tickDeath(c: Combatant, _rng: RNG = defaultRNG): string[] {
  const log: string[] = [];
  if (c.dead || c.outOfRencontre || usesSuddenDeath(c)) return log;
  const be = bonus(effectiveChar(c, 'E'));
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    return log;
  }
  c.roundsAtZero = (c.roundsAtZero ?? 0) + 1;
  if (c.roundsAtZero > be && !hasCondition(c, 'Inconscient')) {
    addCondition(c, 'Inconscient');
    log.push(`${c.name} perd connaissance (0 PB depuis ${c.roundsAtZero} Rounds).`);
  }
  return log; // la mort (dead) est finalisée par le store (avec sauvetage par Destin)
}
```

- [ ] **Step 5 : Lancer → succès + régression.**

Run: `npx vitest run src/engine/death.test.ts`
Expected: PASS.
> ⚠️ Le test store « héros Inconscient + 0 PB + critiques > BE → meurt en fin de Round » (Task 5 du socle précédent) va **échouer** maintenant que `tickDeath` ne tue plus : il sera corrigé à la Task 2 (la mort lente passe par `resolveRoundBoundary`). Ne pas lancer toute la suite ici.

- [ ] **Step 6 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/engine/types.ts src/engine/conditions.ts src/engine/death.test.ts
git commit -m "feat(combat): outOfRencontre + inDeathCondition ; tickDeath ne finalise plus la mort (→ store)"
```

---

## Task 2 : Store — suspension Destin (`pendingFateSave`) + scission `advanceTurn`

**Files:**
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)** — ajouter un `describe` à `store.test.ts` :
```ts
describe('Destin sacrifié (LDB ch.17 l.31-35)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function combat(heroOver: Partial<Combatant> = {}) {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(3) });
    H.fortune = 0; H.fate = 1; Object.assign(H, heroOver);
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0'; E.name = 'Brigand'; E.kind = 'enemy'; E.fortune = 0; E.fate = 0;
    const battle: BattleState = {
      combatants: [H, E], order: [E.id, H.id], turn: 1, round: 1, action: null, selectedSpell: null,
      reachable: new Map(), moved: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8) });
    return { H, E };
  }

  it('mort lente d’un héros à Destin en fin de Round → suspend (pendingFateSave source=slow), pas mort', () => {
    const { H } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4 }); // BE=3, fate=1
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn(); // H dernier → franchit le Round
    const st = useGame.getState();
    expect(st.pendingFateSave).not.toBeNull();
    expect(st.pendingFateSave!.source).toBe('slow');
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.dead ?? false).toBe(false);
  });

  it('« Meurs un autre jour » : éjecté vivant, Destin −1, le Round reprend', () => {
    const { H } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4, fate: 2 });
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn();
    useGame.getState().fateSurvive();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.dead ?? false).toBe(false);
    expect(h.outOfRencontre).toBe(true);
    expect(h.fate).toBe(1);
    expect(useGame.getState().pendingFateSave).toBeNull();
  });

  it('« Accepter le sort » : mort', () => {
    const { H } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4 });
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn();
    useGame.getState().fateAccept();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.dead).toBe(true);
  });

  it('héros SANS Destin : mort lente directe, pas de pause', () => {
    const { H } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4, fate: 0 });
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn();
    expect(useGame.getState().pendingFateSave).toBeNull();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.dead).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer → échec** (`pendingFateSave`/`fateSurvive`/`fateAccept` manquants).

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Déclarer l'état + les actions** (`GameState`) — après `pendingRoundStart: ...` :
```ts
  /** Sauvetage par le Destin en attente (LDB ch.17 l.31-35). */
  pendingFateSave: { heroId: string; source: 'hit' | 'slow'; restoreWounds?: number } | null;
```
Après `confirmRoundStart: () => void;` :
```ts
  /** « Comment ça a pu rater ? » (Destin, coup létal) : annule le coup. */
  fateNegate: () => void;
  /** « Meurs un autre jour » (Destin) : survit mais éjecté de la rencontre. */
  fateSurvive: () => void;
  /** « Accepter le sort » : le héros meurt. */
  fateAccept: () => void;
```
Init (bloc d'état initial, après `pendingRoundStart: null,`) : `pendingFateSave: null,`.
Reset des tests (`reset()` de `store.test.ts`, après `pendingRoundStart: null,`) : `pendingFateSave: null,`.

- [ ] **Step 4 : Helper `finalizeHeroDeath` + gardes IA.**

Ajouter (près de `applyCriticalToTarget`) :
```ts
/** Mort d'un combattant : pour un héros à Destin, suspend (pendingFateSave) au lieu de mourir ;
 *  sinon finalise la mort. */
function finalizeHeroDeath(get: () => GameState, set: any, hero: Combatant, source: 'hit' | 'slow', restoreWounds?: number): void {
  if (hero.kind === 'hero' && (hero.fate ?? 0) > 0) {
    set({ pendingFateSave: { heroId: hero.id, source, restoreWounds } });
  } else {
    hero.dead = true;
  }
}
```

Gardes : ajouter `|| get().pendingFateSave` aux retours en tête de `resumeEnemyTurn` (l.1834), `advanceTurn` (l.1840), `maybeRunEnemyTurn` (l.1885). Exemple `advanceTurn` :
```ts
function advanceTurn(get: () => GameState, set: any) {
  let battle = get().battle;
  if (!battle || battle.over || get().pendingFateSave) return;
```
(idem pour `resumeEnemyTurn` et `maybeRunEnemyTurn` : `if (!b || b.over || get().pendingFateSave) return;`).

- [ ] **Step 5 : `applyCriticalToTarget` retourne la létalité** (au lieu de poser `dead`). Modifier la signature et le corps : retourner `boolean` (létal), ne PLUS poser `target.dead`. Bloc actuel `if (crit.lethal) { target.dead = true; } else { … }` →
```ts
  if (crit.lethal) {
    log.push(crit.log);
    return true; // létal : la mort (ou le sauvetage par Destin) est finalisée par le caller
  }
  target.wounds.current = Math.max(0, target.wounds.current - crit.woundsLoss);
  for (const c of crit.conditions) addCondition(target, c.name, c.value);
  log.push(crit.log);
  if (crit.note) log.push(`  ↳ ${crit.note}`);
  return false;
```
Changer le type de retour de `applyCriticalToTarget` en `boolean` et le `void` du début. (Le cas Mort Subite figurant retourne `false` après avoir posé Inconscient.)

Dans `applyAttackResult`, le bloc qui appelle `applyCriticalToTarget` :
```ts
    if (res.critical || overkill > 0) {
      const lethal = applyCriticalToTarget(target, res.location ?? 'corps', !!res.critical, Math.max(0, overkill), critLog);
      if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore);
    } else if (target.wounds.current <= 0) {
      applyZeroWounds(target);
    }
```
Idem dans `applyCast` (branche missile) : capter le retour et `if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore);`.

- [ ] **Step 6 : Scinder `advanceTurn` → `resolveRoundBoundary`.** Remplacer le passage de Round (le bloc `if (turn >= battle.order.length) { … }` jusqu'à la fin de `advanceTurn`) par : à la détection du franchissement, faire l'upkeep (endOfRound + tickDeath progression), poser `turn=0/round`, puis déléguer à `resolveRoundBoundary` et `return`. Réécriture complète de `advanceTurn` + nouvelle fonction :
```ts
function advanceTurn(get: () => GameState, set: any) {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingFateSave) return;
  let turn = battle.turn;
  for (let i = 0; i < battle.order.length; i++) {
    turn += 1;
    if (turn >= battle.order.length) {
      // Franchissement de Round : upkeep, puis résolution (morts lentes + Destin) déléguée.
      const round = battle.round + 1;
      battle.log.push(`— Round ${round} —`);
      for (const c of battle.combatants) endOfRound(c, battleRng).forEach((l) => battle.log.push(l));
      for (const c of battle.combatants) tickDeath(c, battleRng).forEach((l) => battle.log.push(l)); // 0 PB→Inconscient
      set({ battle: { ...battle, turn: 0, round } });
      resolveRoundBoundary(get, set);
      return;
    }
    const next = battle.combatants.find((c) => c.id === battle.order[turn]);
    if (next && !isOutOfAction(next)) break;
  }
  // Tour suivant dans le MÊME Round.
  const newActive = battle.combatants.find((c) => c.id === battle.order[turn]);
  if (newActive) newActive.defensiveStance = false;
  set({ battle: { ...battle, turn, action: null, moved: false, acted: false, reachable: new Map() } });
  if (checkBattleOver(get, set)) return;
  bus.emit(EVT.SCENE_DIRTY);
  maybeRunEnemyTurn(get, set);
}

/** Fin de Round, résumable : (1) morts lentes (pause Destin par héros), (2) finalisation des morts
 *  restantes, (3) décrément d'Avantage + Engagement, (4) pré-emption d'initiative ou sélection. */
function resolveRoundBoundary(get: () => GameState, set: any): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  // (1) Un héros mourant à Destin non résolu → suspend (pendingFateSave 'slow').
  const dying = battle.combatants.find((c) => inDeathCondition(c) && c.kind === 'hero' && (c.fate ?? 0) > 0);
  if (dying) {
    set({ pendingFateSave: { heroId: dying.id, source: 'slow' } });
    return;
  }
  // (2) Finaliser les morts lentes restantes (héros sans Destin).
  for (const c of battle.combatants) if (inDeathCondition(c)) c.dead = true;
  // (3) Avantage + Engagement (une seule fois).
  for (const c of battle.combatants) {
    if (!isOutOfAction(c) && c.advantage > 0 && !c.gainedAdvThisRound) c.advantage -= 1;
    c.gainedAdvThisRound = false;
  }
  decayEngagement(battle.combatants);
  // (4) Pré-emption d'initiative (Chance, 3e usage) sinon sélection de l'acteur.
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !isOutOfAction(c));
  const heroCanPreempt = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c) && (c.fortune ?? 0) > 0);
  if (enemiesAlive && heroCanPreempt) {
    set({ battle: { ...battle, action: null, moved: false, acted: false, reachable: new Map() }, pendingRoundStart: { round: battle.round } });
    return;
  }
  let turn = 0;
  for (let i = 0; i < battle.order.length; i++) {
    const c = battle.combatants.find((x) => x.id === battle.order[i]);
    if (c && !isOutOfAction(c)) { turn = i; break; }
  }
  const active = battle.combatants.find((c) => c.id === battle.order[turn]);
  if (active) active.defensiveStance = false;
  set({ battle: { ...battle, turn, action: null, moved: false, acted: false, reachable: new Map() } });
  if (checkBattleOver(get, set)) return;
  bus.emit(EVT.SCENE_DIRTY);
  maybeRunEnemyTurn(get, set);
}
```
> `inDeathCondition` est importé depuis `../engine/conditions` (ajouter à l'import existant).

- [ ] **Step 7 : Implémenter les actions Destin** (dans l'objet store, près de `confirmRoundStart`) :
```ts
  fateNegate: () => {
    const { battle, pendingFateSave: p } = get();
    if (!battle || !p || p.source !== 'hit') return;
    const hero = battle.combatants.find((c) => c.id === p.heroId);
    set({ pendingFateSave: null });
    if (!hero) return;
    hero.fate = (hero.fate ?? 0) - 1;
    if (p.restoreWounds != null) hero.wounds.current = p.restoreWounds; // annule tout le coup
    hero.criticalWounds = Math.max(0, (hero.criticalWounds ?? 0) - 1);
    set({ battle: { ...battle, log: [...battle.log, `${hero.name} : « Comment ça a pu rater ? » — le coup fatal est évité (Destin −1).`] } });
    resumeEnemyTurn(get, set);
  },
  fateSurvive: () => {
    const { battle, pendingFateSave: p } = get();
    if (!battle || !p) return;
    const hero = battle.combatants.find((c) => c.id === p.heroId);
    const source = p.source;
    set({ pendingFateSave: null });
    if (!hero) return;
    hero.fate = (hero.fate ?? 0) - 1;
    hero.outOfRencontre = true; // éjecté, vivant
    if (!hero.conditions.some((c) => c.name === 'Inconscient')) addCondition(hero, 'Inconscient');
    set({ battle: { ...battle, log: [...battle.log, `${hero.name} : « Meurs un autre jour » — survit mais quitte le combat (Destin −1).`] } });
    if (source === 'slow') resolveRoundBoundary(get, set);
    else resumeEnemyTurn(get, set);
  },
  fateAccept: () => {
    const { battle, pendingFateSave: p } = get();
    if (!battle || !p) return;
    const hero = battle.combatants.find((c) => c.id === p.heroId);
    const source = p.source;
    set({ pendingFateSave: null });
    if (hero) { hero.dead = true; set({ battle: { ...battle, log: [...battle.log, `${hero.name} succombe.`] } }); }
    if (source === 'slow') resolveRoundBoundary(get, set);
    else resumeEnemyTurn(get, set);
  },
```

- [ ] **Step 8 : Corriger le test du socle précédent** qui supposait `tickDeath` mortel. Dans `store.test.ts`, le test « héros Inconscient + 0 PB + critiques > BE → meurt en fin de Round » : son héros a `fate` (createHero) → il déclenche désormais une pause. Lui mettre `fate: 0` dans le `combat({...})` (mort directe, pas de pause) pour préserver l'intention :
```ts
    const { H, E } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4, fate: 0 });
```
(ajouter `fate: 0` au heroOver de ce test précis.)

- [ ] **Step 9 : Lancer → succès + régression complète.**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS. Puis `npm test` (l'`advanceTurn` réécrit touche TOUT le combat — viser tout vert ; investiguer toute régression).

- [ ] **Step 10 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(combat): Destin — suspension pendingFateSave (coup létal + mort lente), advanceTurn scindé en resolveRoundBoundary"
```

---

## Task 3 : Store — Résilience « Je ne faillirai pas ! » (réussite garantie)

**Files:**
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)** — ajouter un `describe` :
```ts
describe('Résilience — « Je ne faillirai pas ! » (LDB ch.17 l.72)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('force un Test hors combat raté en succès, Résilience −1', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    hero.resilience = 1;
    useGame.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 30, difficulty: 'intermediaire',
        requireSL: 0, target: 30, roll: 95, success: false, sl: -6, rerolled: false, onSuccess: [], onFailure: [] },
    });
    useGame.getState().testForceSuccess();
    expect(useGame.getState().pendingTest!.success).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer → échec** (`testForceSuccess` manquant).

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Déclarer les 5 actions** (`GameState`, à côté des `*BonusSL`) :
```ts
  testForceSuccess: () => void;
  attackForceSuccess: () => void;
  defenseForceSuccess: () => void;
  castForceSuccess: () => void;
  disengageForceSuccess: () => void;
```

- [ ] **Step 4 : Implémenter** (chacune décrémente `resilience` du héros concerné et force l'issue favorable). Placer après les `*BonusSL` correspondants.

`testForceSuccess` :
```ts
  testForceSuccess: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return;
    const party = get().party;
    const actor = party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.resilience ?? 0) <= 0) return;
    actor.resilience = (actor.resilience ?? 0) - 1;
    const sl = Math.max(pt.sl, pt.requireSL, 1); // réussite garantie (LDB ch.17 l.72)
    set({ pendingTest: { ...pt, success: true, sl }, party: [...party] });
  },
```

`attackForceSuccess` (l'attaquant l'emporte avec DR +1) :
```ts
  attackForceSuccess: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result || !pa.result.attackerDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target || (attacker.resilience ?? 0) <= 0) return;
    attacker.resilience = (attacker.resilience ?? 0) - 1;
    const r = pa.result;
    const ad = r.attackerDetail!;
    // Touche garantie : DR attaquant = (DR défenseur + 1) si opposé, sinon ≥ 1.
    const defSL = r.defenderDetail?.sl ?? 0;
    const atk2: TestResult = { roll: ad.roll, target: ad.target, success: true, sl: Math.max(ad.sl, defSL + 1, 1), isDouble: ad.roll === 100 || ad.roll % 11 === 0 };
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

`defenseForceSuccess` (le défenseur l'emporte : pas touché) :
```ts
  defenseForceSuccess: () => {
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result || !pd.result.defenderDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender || (defender.resilience ?? 0) <= 0) return;
    defender.resilience = (defender.resilience ?? 0) - 1;
    const dd = pd.result.defenderDetail!;
    const atkSL = pd.atk.sl;
    const def2: TestResult = { roll: dd.roll, target: dd.target, success: true, sl: Math.max(dd.sl, atkSL + 1, 1), isDouble: dd.roll === 100 || dd.roll % 11 === 0 };
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def2, pd.mode, pd.location ?? undefined);
    set({ pendingDefense: { ...pd, def: def2, result: res }, battle: { ...battle } });
  },
```

`castForceSuccess` :
```ts
  castForceSuccess: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.resilience ?? 0) <= 0) return;
    caster.resilience = (caster.resilience ?? 0) - 1;
    const ni = pc.focused ? 0 : spell.cn ?? 0;
    // Réussite garantie : DR ≥ NI (incantation lancée). On rejoue via rederiveCastSL avec le bonus requis.
    const cur = pc.result;
    const bonusNeeded = Math.max(1, ni - cur.sl, (cur.roll > cur.target ? 1 : 0)); // au moins NI, au moins succès
    const res = rederiveCastSL(caster, target, spell, { ...cur, roll: Math.min(cur.roll, cur.target) }, pc.missile, pc.focused, bonusNeeded);
    set({ pendingCast: { ...pc, result: res }, battle: { ...battle } });
  },
```
> NB : on force aussi le d100 sous la cible (`Math.min(cur.roll, cur.target)`) pour garantir le succès propre, puis on ajoute le DR nécessaire pour franchir le NI.

`disengageForceSuccess` :
```ts
  disengageForceSuccess: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || !pd.result || !pd.def) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover || (mover.resilience ?? 0) <= 0) return;
    mover.resilience = (mover.resilience ?? 0) - 1;
    set({ pendingDisengage: { ...pd, result: 'success' }, battle: { ...battle } }); // l'emporte (LDB ch.17 l.72)
  },
```

- [ ] **Step 5 : Lancer → succès + suite.**

Run: `npx vitest run src/state/store.test.ts` puis `npm test`.
Expected: PASS.

- [ ] **Step 6 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(combat): Résilience « Je ne faillirai pas ! » — réussite garantie (opposé DR+1) sur les 5 flux"
```

---

## Task 4 : UI — `FateSaveModal` + bouton Résilience

**Files:**
- Create: `src/ui/FateSaveModal.tsx`, `src/ui/ResilienceButton.tsx`
- Modify: `src/ui/CampaignView.tsx`, les 5 modales de jet

- [ ] **Step 1 : `src/ui/FateSaveModal.tsx`** :
```tsx
import { useGame } from '../state/store';

/** Sauvetage par le Destin (LDB ch.17 l.31-35) : « Comment ça a pu rater ? » (coup létal),
 *  « Meurs un autre jour », ou accepter la mort. */
export function FateSaveModal() {
  const p = useGame((s) => s.pendingFateSave);
  const battle = useGame((s) => s.battle);
  const negate = useGame((s) => s.fateNegate);
  const survive = useGame((s) => s.fateSurvive);
  const accept = useGame((s) => s.fateAccept);
  if (!p || !battle) return null;
  const hero = battle.combatants.find((c) => c.id === p.heroId);
  if (!hero) return null;
  const fate = hero.fate ?? 0;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Le Destin de {hero.name}</h3>
        <p className="rm-log">
          {p.source === 'hit' ? 'Un coup fatal !' : 'Les blessures l’emportent…'} Sacrifier un Point de Destin ? (reste {fate})
        </p>
        <div className="modal-actions">
          {p.source === 'hit' && (
            <button className="btn" onClick={negate} title="Évite tout le coup, reste en combat (Destin −1)">
              🍀 Comment ça a pu rater ?
            </button>
          )}
          <button className="btn" onClick={survive} title="Survit mais quitte le combat (Destin −1)">
            🛟 Meurs un autre jour
          </button>
          <button className="btn btn-primary" onClick={accept} title="Le héros meurt">
            ☠️ Accepter le sort
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Monter dans `CampaignView.tsx`** — import `import { FateSaveModal } from './FateSaveModal';` ; placer `<FateSaveModal />` à côté de `<RoundStartModal />`.

- [ ] **Step 3 : `src/ui/ResilienceButton.tsx`** :
```tsx
/** Bouton « Je ne faillirai pas ! » (Résilience, LDB ch.17 l.72) : réussite garantie. */
export function ResilienceButton({ resilience, show, onForce }: { resilience: number; show: boolean; onForce: () => void }) {
  if (resilience <= 0 || !show) return null;
  return (
    <button className="btn" onClick={onForce} title="Sacrifie un Point de Résilience pour une réussite garantie (LDB Résilience)">
      🔥 Réussite garantie ({resilience})
    </button>
  );
}
```

- [ ] **Step 4 : Brancher dans les 5 modales** (à côté de `<ChanceButtons …/>`). Pour chacune, importer `ResilienceButton`, récupérer l'action `*ForceSuccess` et la réserve `resilience` du bon combattant, et calculer `show` (issue défavorable) :
  - `RollModal` : `const force = useGame((s) => s.attackForceSuccess);` ; `<ResilienceButton resilience={attacker.resilience ?? 0} show={!!res && !res.hit} onForce={force} />`.
  - `DefenseModal` : `const force = useGame((s) => s.defenseForceSuccess);` ; `show={!!res && res.hit}` (le héros est touché).
  - `CastModal` : `const force = useGame((s) => s.castForceSuccess);` ; `show={!!res && !res.cast}`.
  - `TestModal` : `const force = useGame((s) => s.testForceSuccess);` ; `resilience` du `party.find(actorId)` ; `show={rolled && !pt.success}`.
  - `DisengageModal` : `const force = useGame((s) => s.disengageForceSuccess);` ; `show={pd.phase === 'esquive' && pd.result !== 'success'}` ; `resilience={mover.resilience ?? 0}`.

- [ ] **Step 5 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/ui/FateSaveModal.tsx src/ui/ResilienceButton.tsx src/ui/CampaignView.tsx src/ui/RollModal.tsx src/ui/DefenseModal.tsx src/ui/CastModal.tsx src/ui/TestModal.tsx src/ui/DisengageModal.tsx
git commit -m "feat(ui): FateSaveModal (Destin) + bouton « Réussite garantie » (Résilience) dans les 5 modales"
```

---

## Task 5 : ROADMAP + vérification finale

- [ ] **Step 1 :** `npm test` (tout vert), `npm run typecheck` (0 erreur), `npm run build` (OK).
- [ ] **Step 2 : ROADMAP** — dans « Combat — reste » et le Jalon 1 : marquer **Destin/Résilience sacrifiés ✅** (« Comment ça a pu rater ? », « Meurs un autre jour », « Je ne faillirai pas ! ») ; restes : « Je te renie ! » (dépend de Corruption/mutations), choix de localisation de Critique, distance fine, Maladresses.
- [ ] **Step 3 : Commit** `docs(roadmap): Destin & Résilience sacrifiés livrés`.
- [ ] **Step 4 : Recette navigateur (MANUELLE — utilisateur)** : un coup létal sur un héros ouvre la modale Destin (annuler / meurs un autre jour / accepter) ; en mort lente, la modale apparaît en fin de Round ; « Réussite garantie » transforme un jet raté en succès dans les 5 modales.

---

## Auto-revue du plan (effectuée)

- **Couverture spec :** `outOfRencontre`/`inDeathCondition`/`tickDeath` (Task 1) · `pendingFateSave` + `finalizeHeroDeath` + scission `advanceTurn`/`resolveRoundBoundary` + gardes IA + actions Destin (Task 2) · Résilience force-success 5 flux (Task 3) · UI (Task 4) · ROADMAP (Task 5). ✓
- **Risque principal :** réécriture d'`advanceTurn` (cœur de la boucle) → régression `npm test` à la Task 2 Step 9 ; `resolveRoundBoundary` ré-entrant (Avantage/Engagement décrémentés une seule fois, *après* toutes les morts résolues). Le test du socle précédent est explicitement corrigé (Task 2 Step 8).
- **Cohérence des types :** `pendingFateSave{heroId,source,restoreWounds}` (Task 2) ↔ `fateNegate/Survive/Accept` (Task 2) ↔ `FateSaveModal` (Task 4) ; `*ForceSuccess` (Task 3) ↔ `ResilienceButton` (Task 4). `applyCriticalToTarget` retourne désormais `boolean` (létal) — caller appelle `finalizeHeroDeath`.
- **Décalages assumés :** « Je te renie ! » et choix de localisation de Critique différés ; l'IA ne dépense ni Destin ni Résilience.
