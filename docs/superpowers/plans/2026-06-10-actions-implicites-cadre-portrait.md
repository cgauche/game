# Actions de combat implicites + cadre portrait actif — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clic = déplacement par défaut, clic ennemi = attaque (move-then-attack / Charge implicite, tap aperçu → tap confirme), Charge stricte LDB 15 l.77, cap d'Avantage 10, cadre portrait actif à jauges crantées de taille fixe.

**Architecture:** Le `battle.action` perd ses modes `move`/`attack`/`charge` ; les clics en mode neutre (`action === null`) sont routés par `battleClickTile`/`battleClickEntity` avec un état d'aperçu `battle.preview` (tap 1 = aperçu, tap 2 = commit). La portée de Marche est dérivée à la demande (`computeMoveReach`), le `battle.reachable` stocké ne sert plus qu'aux budgets spéciaux (Course, post-Désengagement). Gains d'Avantage centralisés dans `gainAdvantage` (clamp 10). Le bloc portrait de l'ActionBar devient `ActiveFrame` (jauges crantées fixes).

**Tech Stack:** TypeScript + React + Zustand + Vitest. Spec : `docs/superpowers/specs/2026-06-10-actions-implicites-cadre-portrait-design.md`.

**Conventions d'exécution:** commits simples par tâche avec pathspec explicite (`git commit -- <fichiers>`) — d'autres sessions travaillent dans le même arbre. Runners (`npm test`, `npx vitest run`, `npm run typecheck`) via le shell natif. Tout le code/UI en FRANÇAIS.

---

### Task 1: Charge stricte (LDB 15 l.77 seul)

**Files:**
- Modify: `src/engine/engagement.ts:86-102` (chargeAdvantage)
- Modify: `src/engine/engagement.test.ts:64-81`
- Modify: `src/state/store.ts:1693-1705` (log de charge à +0)
- Modify: `src/state/store.test.ts:788-812` (attente +2 → +1)

- [ ] **Step 1: Mettre à jour les tests de chargeAdvantage (stricte)**

Dans `src/engine/engagement.test.ts`, remplacer le bloc `describe('chargeAdvantage …')` par :

```ts
describe('chargeAdvantage — +1 UNIQUEMENT si cible à ≥ M mètres (LDB 15-Dépl l.77 ; 1 case = 2 m)', () => {
  it('M4 : seuil ceil(4/2)=2 cases ; portée Course 2M=8 (arrivée adjacente → cible jusqu’à 9)', () => {
    expect(chargeAdvantage(4, 0)).toBe(0); // déjà au contact, pas de charge
    expect(chargeAdvantage(4, 1)).toBe(0); // contact direct : on n'a pas « foncé » → rien (l.77)
    expect(chargeAdvantage(4, 2)).toBe(1); // ≥ seuil → +1
    expect(chargeAdvantage(4, 8)).toBe(1); // pleine portée de Course → +1
    expect(chargeAdvantage(4, 9)).toBe(1); // 2M+1 : case d'arrivée (à 2M=8) encore atteignable → +1
    expect(chargeAdvantage(4, 10)).toBe(0); // arrivée hors de portée de Course → 0
  });
  it('M impair / autres valeurs', () => {
    expect(chargeAdvantage(3, 1)).toBe(0);
    expect(chargeAdvantage(3, 2)).toBe(1); // seuil ceil(3/2)=2
    expect(chargeAdvantage(3, 7)).toBe(1); // 2M+1
    expect(chargeAdvantage(3, 8)).toBe(0);
    expect(chargeAdvantage(5, 2)).toBe(0); // seuil 3 → dist 2 : rien
    expect(chargeAdvantage(5, 3)).toBe(1);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/engagement.test.ts`
Attendu : FAIL (les `toBe(0)`/`toBe(1)` contredisent l'implémentation +1/+2).

- [ ] **Step 3: Implémenter la lecture stricte**

Dans `src/engine/engagement.ts`, remplacer `chargeAdvantage` (et son docstring) par :

```ts
/**
 * Bonus d'Avantage d'une Charge, en CASES (distance chebyshev départ→cible AVANT déplacement).
 * Lecture STRICTE (décision utilisateur 2026-06-10) : +1 UNIQUEMENT si la cible était « au moins à
 * une distance, en mètres, égale à votre caractéristique de Mouvement » (LDB 15-Dépl l.77), dans la
 * portée de Course. 1 case = 2 m (l.55) → seuil = ceil(M/2) cases ; Course = 2M cases (Tableau des
 * Mouvements l.61-72). La charge ARRIVE sur une case ADJACENTE : cible valide jusqu'à 2M+1.
 */
export function chargeAdvantage(movementCases: number, distFromCases: number): 0 | 1 {
  const M = movementCases;
  if (distFromCases < 1 || distFromCases > M * 2 + 1) return 0;
  return distFromCases >= Math.ceil(M / 2) ? 1 : 0;
}
```

- [ ] **Step 4: Adapter le site héros (log à +0) et le test du store**

Dans `src/state/store.ts` (~l.1703-1705, bloc `battle.action === 'charge'`), le log ne doit plus annoncer « +0 Avantage » :

```ts
active.advantage += adv; // +1 si « fonçant » de ≥ M mètres (l.77) — lecture stricte
if (adv > 0) active.gainedAdvThisRound = true;
set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: 'attack', log: [...battle.log, ev('charge', `${active.name} charge ${target.name}${adv ? ` (+${adv} Avantage)` : ''}.`, active.id, target.id)] } });
```

Dans `src/state/store.test.ts` (~l.788-812), test « Charge : se ruer au contact depuis 2 cases » : le titre devient `donne +1 Avantage` et l'assertion `expect(Ha.advantage).toBe(2)` devient `toBe(1)` (M4, seuil 2, distance 2 → +1 strict).

- [ ] **Step 5: Vérifier le vert + suite complète**

Run: `npx vitest run src/engine/engagement.test.ts src/state/store.test.ts` puis `npm test`
Attendu : PASS. Si d'autres tests cassent sur des valeurs d'Avantage de charge (chercher `advantage` + `charge`), appliquer la même règle (+1/+2 → 0/+1).

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(combat): Charge stricte — +1 Avantage seulement si cible à >= M metres (LDB 15 l.77)" -- src/engine/engagement.ts src/engine/engagement.test.ts src/state/store.ts src/state/store.test.ts
```

---

### Task 2: Cap d'Avantage 10 (`gainAdvantage`)

**Files:**
- Create: `src/engine/advantage.ts`
- Create: `src/engine/advantage.test.ts`
- Modify: `src/state/combatFlow.ts:508,1085,1089,1964,2629`
- Modify: `src/state/store.ts:1703,2187,2658,2677,2695,2703`

- [ ] **Step 1: Test du helper**

Créer `src/engine/advantage.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { ADVANTAGE_CAP, gainAdvantage } from './advantage';
import type { Combatant } from './types';

const c = (advantage: number) => ({ advantage }) as Combatant;

describe('gainAdvantage — plafond 10 (Option RAW LDB 15-Dépl l.17)', () => {
  it('gagne n (défaut 1) et clampe au plafond', () => {
    const a = c(0); gainAdvantage(a); expect(a.advantage).toBe(1);
    const b = c(9); gainAdvantage(b, 2); expect(b.advantage).toBe(ADVANTAGE_CAP);
    const d = c(10); gainAdvantage(d); expect(d.advantage).toBe(10);
  });
  it('n ≤ 0 est sans effet (jamais une perte)', () => {
    const a = c(5); gainAdvantage(a, 0); gainAdvantage(a, -3); expect(a.advantage).toBe(5);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npx vitest run src/engine/advantage.test.ts` → FAIL (module absent).

- [ ] **Step 3: Implémenter**

Créer `src/engine/advantage.ts` :

```ts
import type { Combatant } from './types';

/** Plafond d'Avantage — Option RAW « Limiter les Avantages » (LDB 15-Dépl l.17 :
 *  « 10 fonctionne plutôt bien puisque vous pouvez facilement les comptabiliser avec 1d10 »). */
export const ADVANTAGE_CAP = 10;

/** Gain d'Avantage CENTRALISÉ (héros ET ennemis) : clamp au plafond. Les pertes et remises
 *  à zéro restent des affectations directes (LDB 15 l.40, 16 l.15…). Pure. */
export function gainAdvantage(c: Combatant, n = 1): void {
  if (n > 0) c.advantage = Math.min(ADVANTAGE_CAP, c.advantage + n);
}
```

- [ ] **Step 4: Vérifier le vert** — Run: `npx vitest run src/engine/advantage.test.ts` → PASS.

- [ ] **Step 5: Remplacer tous les GAINS par le helper**

Sites exacts (`Grep advantage \+=` hors tests pour contrôle) — importer `gainAdvantage` depuis `../engine/advantage` :
- `src/state/combatFlow.ts:508` (`applySonneMeleeAdvantage`) → `gainAdvantage(attacker);`
- `combatFlow.ts:1085` → `gainAdvantage(attacker);` ; `:1089` → `gainAdvantage(target);`
- `combatFlow.ts:1964` (sort même Domaine) → `gainAdvantage(caster);`
- `combatFlow.ts:2629` (charge IA) → `gainAdvantage(enemy, adv);`
- `store.ts:1703` (charge héros, Task 1) → `gainAdvantage(active, adv);`
- `store.ts:2187` (Maniement deux armes) → `gainAdvantage(attacker);`
- `store.ts:2658` (Esquive de désengagement réussie) → `gainAdvantage(mover);`
- `store.ts:2677`, `:2695`, `:2703` (foe : échec Esquive / Fuite / coup dans le dos) → `gainAdvantage(foe);`

Ne PAS toucher les pertes (`advantage = 0`, `Math.max(0, …)`) ni `conditions.ts`.

- [ ] **Step 6: Suite + commit**

Run: `npm test` → PASS.
```bash
git commit -m "feat(combat): cap d'Avantage a 10 via gainAdvantage (option RAW LDB 15 l.17)" -- src/engine/advantage.ts src/engine/advantage.test.ts src/state/combatFlow.ts src/state/store.ts
```

---

### Task 3: Portée de Marche dérivée + affichage permanent

**Files:**
- Modify: `src/state/combatFlow.ts` (nouveaux exports `computeMoveReach`, `displayedReach`)
- Modify: `src/gameIso/IsoStage.tsx:262`
- Test: `src/state/implicit-clicks.test.ts` (créé ici, complété Tasks 4-5)

- [ ] **Step 1: Test de la dérivation**

Créer `src/state/implicit-clicks.test.ts` (reprendre le `setup()` de `split-movement.test.ts:20-34` tel quel — héros seul en x6,y10, ennemis éloignés, tour du héros) :

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { computeMoveReach, displayedReach } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';
import { effectiveMovement } from '../engine/encumbrance';

// … setup() copié de split-movement.test.ts …

describe('computeMoveReach / displayedReach — portée de Marche dérivée (mode neutre)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingAttack: null }); });

  it('dérive la Marche restante sans passer par un mode', () => {
    const { H } = setup();
    const reach = computeMoveReach(useGame.getState);
    expect(reach.size).toBeGreaterThan(0);
    expect(Math.max(...reach.values())).toBe(effectiveMovement(H));
  });
  it('vide si Engagé, si M-A-M scellé, ou si Mouvement épuisé', () => {
    const { H } = setup();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    h.engagedWith = ['x']; expect(computeMoveReach(useGame.getState).size).toBe(0); h.engagedWith = [];
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true, movedPreAction: true } });
    expect(computeMoveReach(useGame.getState).size).toBe(0);
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false, movedPreAction: false, movementUsed: effectiveMovement(H) } });
    expect(computeMoveReach(useGame.getState).size).toBe(0);
  });
  it('displayedReach préfère le budget SPÉCIAL stocké (Course / post-Désengagement)', () => {
    setup();
    const special = new Map([['0,0', 1]]);
    useGame.setState({ battle: { ...useGame.getState().battle!, reachable: special } });
    expect(displayedReach(useGame.getState)).toBe(special);
    useGame.setState({ battle: { ...useGame.getState().battle!, reachable: new Map() } });
    expect(displayedReach(useGame.getState).size).toBeGreaterThan(0); // repli dérivé
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npx vitest run src/state/implicit-clicks.test.ts` → FAIL (exports absents).

- [ ] **Step 3: Implémenter dans combatFlow.ts**

Près de `bestAdjacentReachable` (l.839), avec les imports déjà présents du fichier (compléter si manquants : `reachable`, `sizeFootprint`, `movementRemaining`, `canMove`, `mountOf`, `occupied`, `hasCondition`, `chebyshev`, `isOutOfAction`, `activeCombatant`) :

```ts
/** Cases de Mouvement LIBRE cliquables MAINTENANT (héros actif, mode neutre) : Marche restante
 *  (mouvement décomposable), géométrie de la monture, règle M-A-M, filtre Brisé. Vide si Engagé
 *  (le déplacement passe par le Désengagement — LDB 15 l.84). Reprend la logique de l'ex-mode
 *  « Déplacer » (battleSelectAction) ; source unique pour l'affichage ET la validation des clics. */
export function computeMoveReach(get: () => GameState): Map<string, number> {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return new Map();
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || !active.pos) return new Map();
  if (isEngaged(active) || !canMove(battle, active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const blocked = occupied(battle, geom);
  let reach = reachable(scene, active.pos, movementRemaining(battle, active), blocked, sizeFootprint(geom.size));
  // Brisé (LDB 16 l.55) : fuir seulement — aucune case qui RAPPROCHE d'un ennemi.
  if (hasCondition(active, 'Brisé')) {
    const foes = battle.combatants.filter((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos);
    if (foes.length) {
      const distNow = Math.min(...foes.map((e) => chebyshev(active.pos!, e.pos!)));
      reach = new Map([...reach].filter(([k]) => {
        const [x, y] = k.split(',').map(Number);
        return Math.min(...foes.map((e) => chebyshev({ x, y }, e.pos!))) >= distNow;
      }));
    }
  }
  return reach;
}

/** Cases cliquables affichées/validées : budget SPÉCIAL stocké (Course, post-Désengagement)
 *  prioritaire, sinon Marche restante dérivée. */
export function displayedReach(get: () => GameState): Map<string, number> {
  const battle = get().battle;
  if (!battle) return new Map();
  return battle.reachable.size > 0 ? battle.reachable : computeMoveReach(get);
}
```

(La logique Brisé est DÉPLACÉE de `battleSelectAction` — la dupliquer ici d'abord, la branche mode sera supprimée en Task 6.)

- [ ] **Step 4: Afficher en permanence dans IsoStage**

`src/gameIso/IsoStage.tsx:262` : remplacer `for (const k of battle.reachable.keys())` par

```tsx
for (const k of displayedReach(useGame.getState).keys()) {
```

(import `displayedReach` depuis `../state/combatFlow` ; le `useMemo` dépend déjà de `battle`, la dérivation suit).

- [ ] **Step 5: Vert + commit**

Run: `npx vitest run src/state/implicit-clicks.test.ts` puis `npm test` → PASS.
```bash
git commit -m "feat(combat): portee de Marche derivee (computeMoveReach) affichee en permanence" -- src/state/combatFlow.ts src/gameIso/IsoStage.tsx src/state/implicit-clicks.test.ts
```

---

### Task 4: Aperçu `battle.preview` + clic-sol implicite

**Files:**
- Modify: `src/state/store.ts` (BattleState, `battleClickTile`, `cancelMove`)
- Modify: `src/state/combatFlow.ts:2225,2274` (purge au Tour/Round)
- Test: `src/state/implicit-clicks.test.ts`

- [ ] **Step 1: Tests du flux tap-aperçu → tap-confirme (sol)**

Ajouter à `implicit-clicks.test.ts` :

```ts
describe('clic-sol implicite — tap 1 aperçu, tap 2 déplace', () => {
  it('1er clic = aperçu (pas de déplacement), 2e clic même case = déplacement', () => {
    const { H } = setup();
    const before = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const dest = { x: before.x + 2, y: before.y };
    useGame.getState().battleClickTile(dest);
    let st = useGame.getState();
    expect(st.battle!.preview).toMatchObject({ kind: 'move', tile: dest });
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(before); // pas bougé
    useGame.getState().battleClickTile(dest);
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(dest);
    expect(st.battle!.movementUsed).toBe(2);
    expect(st.battle!.preview).toBeNull();
  });
  it('cliquer une AUTRE case remplace l’aperçu ; case hors de portée le purge', () => {
    const { H } = setup();
    const p = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos!;
    useGame.getState().battleClickTile({ x: p.x + 1, y: p.y });
    useGame.getState().battleClickTile({ x: p.x + 2, y: p.y });
    expect(useGame.getState().battle!.preview).toMatchObject({ kind: 'move', tile: { x: p.x + 2, y: p.y } });
    useGame.getState().battleClickTile({ x: p.x + 30, y: p.y }); // hors de portée
    expect(useGame.getState().battle!.preview).toBeNull();
  });
  it('{ confirm: true } court-circuite l’aperçu (compat tests)', () => {
    const { H } = setup();
    const p = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos!;
    useGame.getState().battleClickTile({ x: p.x + 1, y: p.y }, { confirm: true });
    expect(useGame.getState().battle!.movementUsed).toBe(1);
  });
  it('Engagé : le clic-sol ouvre le Désengagement (pas de déplacement libre)', () => {
    const { H } = setup();
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 1, y: h.pos!.y };
    h.engagedWith = [e.id]; e.engagedWith = [h.id];
    useGame.getState().battleClickTile({ x: h.pos!.x - 1, y: h.pos!.y });
    const st = useGame.getState();
    expect(st.pendingDisengage ?? null).not.toBeNull(); // menu A/B ouvert (Avantages égaux)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(h.pos);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npx vitest run src/state/implicit-clicks.test.ts` → FAIL (`preview` inexistant, clic-sol exige le mode `move`).

- [ ] **Step 3: Le type `preview` dans BattleState**

`src/state/store.ts` (~l.146, après `moveSnapshot`) :

```ts
  /** Aperçu « tap 1 » du modèle de clic implicite (tap aperçu → tap confirme). Purgé au commit,
   *  à chaque changement de Tour/Round, et remplacé par tout nouveau tap. */
  preview?:
    | { kind: 'move'; tile: Pt; path: Pt[]; cost: number }
    | { kind: 'attack'; targetId: string }
    | { kind: 'charge'; targetId: string; dest: Pt; path: Pt[]; adv: 0 | 1 }
    | { kind: 'moveAttack'; targetId: string; dest: Pt; path: Pt[]; cost: number }
    | null;
```

- [ ] **Step 4: Réécrire la branche déplacement de `battleClickTile`**

Signature : `battleClickTile: (pt: Pt, opts?: { confirm?: boolean }) => void` (mettre à jour l'interface GameState l.427). Remplacer le bloc `if (battle.action === 'move' && canMove(battle, active)) { … }` (l.1586-1627) par :

```ts
    if (battle.action !== null) return; // modes restants (cast traité plus haut, heal/ammo/trample/resolve…)
    // Engagé : pas de déplacement libre (LDB 15 l.84) → le clic-sol route vers le Désengagement.
    if (isEngaged(active)) { startDisengage(get, set, active); return; }
    if (!canMove(battle, active)) return;
    const reach = displayedReach(get);
    const k = `${pt.x},${pt.y}`;
    if (!reach.has(k)) {
      if (battle.preview) { set({ battle: { ...battle, preview: null } }); bus.emit(EVT.SCENE_DIRTY); }
      return;
    }
    const stepCost = reach.get(k) ?? 0;
    // … garde Peur EXISTANTE inchangée (l.1590-1600) …
    const geomP = mountOf(battle, active) ?? active;
    const blockedP = occupied(battle, geomP);
    // Tap 1 : APERÇU (chemin + coût), sauf confirmation directe ou re-tap de la même case.
    const prev = battle.preview;
    if (!opts?.confirm && !(prev?.kind === 'move' && prev.tile.x === pt.x && prev.tile.y === pt.y)) {
      const path = pathTo(scene, active.pos!, pt, blockedP, sizeFootprint(geomP.size));
      set({ battle: { ...battle, preview: { kind: 'move', tile: { ...pt }, path, cost: stepCost } } });
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
    // Tap 2 : COMMIT — corps actuel inchangé (snapshot, path, displaceSmaller, facing, ANIM_MOVE…)
    // … l.1601-1626 telles quelles, en ajoutant `preview: null` au set final :
    set({ battle: { ...battle, moveSnapshot: snapshot, movementUsed: (battle.movementUsed ?? 0) + stepCost, movedPreAction: battle.movedPreAction || !battle.acted, action: null, reachable: new Map(), preview: null } });
```

NOTE : la garde Peur reste AVANT l'aperçu (message immédiat dès le tap 1). `startDisengage` est déjà importé par store.ts ? Sinon l'importer depuis `./combatFlow`.

- [ ] **Step 5: Purges**

- `src/state/combatFlow.ts:2225` (changement de Tour) et `:2274` (début de Round) : ajouter `preview: null` aux deux `set({ battle: { … } })`.
- `src/state/store.ts` `cancelMove` (l.1644) : ajouter `preview: null`.
- `battleSelectAction` (l.1085) : ajouter `preview: null` au set (entrer dans un mode annule l'aperçu).

- [ ] **Step 6: Vert + suite + commit**

Run: `npx vitest run src/state/implicit-clicks.test.ts` puis `npm test`.
Les tests existants qui font `battleSelectAction('move')` + `battleClickTile(dest)` vont CASSER (tap 1 devenu aperçu) : dans `split-movement.test.ts` (l.45-104), `broken-restriction.test.ts`, `surprise.test.ts`, `store.test.ts`, remplacer chaque `battleClickTile(dest)` de déplacement par `battleClickTile(dest, { confirm: true })` et SUPPRIMER les `battleSelectAction('move')` devenus inutiles (la portée est dérivée). Les assertions `battle.reachable.size` après `battleSelectAction('move')` deviennent `computeMoveReach(useGame.getState).size` (import depuis `./combatFlow`).

```bash
git commit -m "feat(combat): clic-sol implicite - tap apercu puis tap deplace, Engage route vers Desengagement" -- src/state/store.ts src/state/combatFlow.ts src/state/implicit-clicks.test.ts src/state/split-movement.test.ts src/state/broken-restriction.test.ts src/state/surprise.test.ts src/state/store.test.ts
```

---

### Task 5: Clic-ennemi implicite (attaque / tir / Charge / rejoindre-et-attaquer)

**Files:**
- Modify: `src/state/combatFlow.ts` (nouvel export `attackPlan`)
- Modify: `src/state/store.ts:1649-1734` (`battleClickEntity`)
- Test: `src/state/implicit-clicks.test.ts`

- [ ] **Step 1: Tests du routage ennemi**

Ajouter à `implicit-clicks.test.ts` (le héros Soldat a une arme de mêlée ; positionner l'ennemi selon le cas) :

```ts
describe('clic-ennemi implicite', () => {
  it('cible adjacente : tap 1 aperçu attack, tap 2 ouvre la modale (pas de Charge → pas d’Avantage)', () => {
    const { H } = setup();
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 1, y: h.pos!.y };
    h.advantage = 0;
    useGame.getState().battleClickEntity(e.id);
    expect(useGame.getState().battle!.preview).toMatchObject({ kind: 'attack', targetId: e.id });
    expect(useGame.getState().pendingAttack).toBeNull();
    useGame.getState().battleClickEntity(e.id);
    const st = useGame.getState();
    expect(st.pendingAttack?.targetId).toBe(e.id);
    expect(st.pendingAttack?.fromCharge).toBeUndefined();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0);
  });
  it('cible à 2 cases, Mouvement intact : Charge implicite (+1 Av strict, M4 seuil 2)', () => {
    const { H } = setup();
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 2, y: h.pos!.y };
    h.advantage = 0;
    useGame.getState().battleClickEntity(e.id);
    expect(useGame.getState().battle!.preview).toMatchObject({ kind: 'charge', targetId: e.id, adv: 1 });
    useGame.getState().battleClickEntity(e.id);
    const st = useGame.getState();
    const hh = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(hh.advantage).toBe(1);
    expect(Math.max(Math.abs(hh.pos!.x - e.pos!.x), Math.abs(hh.pos!.y - e.pos!.y))).toBe(1); // au contact
    expect(st.pendingAttack?.fromCharge).toBe(true);
  });
  it('Mouvement entamé : pas de Charge — rejoindre dans la Marche restante puis attaquer, sans bonus', () => {
    const { H } = setup();
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 1, movedPreAction: true } });
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 2, y: h.pos!.y };
    h.advantage = 0;
    useGame.getState().battleClickEntity(e.id);
    expect(useGame.getState().battle!.preview).toMatchObject({ kind: 'moveAttack', targetId: e.id });
    useGame.getState().battleClickEntity(e.id);
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0);
    expect(st.pendingAttack?.targetId).toBe(e.id);
    expect(st.pendingAttack?.fromCharge).toBeUndefined();
    expect(st.battle!.movementUsed).toBe(2); // 1 (déjà fait) + 1 (rejoindre)
  });
  it('hors de portée de Charge (> 2M+1) : message, pas d’aperçu', () => {
    const { H } = setup();
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 12, y: h.pos!.y }; // M4 → 2M+1 = 9
    useGame.getState().battleClickEntity(e.id);
    const st = useGame.getState();
    expect(st.battle!.preview ?? null).toBeNull();
    expect(st.pendingAttack).toBeNull();
  });
  it('Action déjà prise (sans Frénésie) : le clic-ennemi est inerte', () => {
    const { H } = setup();
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    const e = useGame.getState().battle!.combatants.find((c) => c.kind === 'enemy')!;
    useGame.getState().battleClickEntity(e.id);
    expect(useGame.getState().pendingAttack).toBeNull();
    void H;
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npx vitest run src/state/implicit-clicks.test.ts` → FAIL.

- [ ] **Step 3: `attackPlan` dans combatFlow.ts**

À côté de `computeMoveReach` (mêmes imports + `combatDistance`, `meleeReachTiles`, `attackWeapon`, `chargeAdvantage`, `pathTo`) :

```ts
export type AttackPlan =
  | { kind: 'attack' }
  | { kind: 'charge'; dest: Pt; path: Pt[]; adv: 0 | 1 }
  | { kind: 'moveAttack'; dest: Pt; path: Pt[]; cost: number }
  | { kind: 'blocked'; reason: string };

/** Ce qu'un clic sur CET ennemi ferait : attaque directe (Allonge/tir), Charge implicite
 *  (non Engagé + Mouvement intact + mêlée, portée de Course — LDB 15 l.74-77), ou
 *  rejoindre-et-attaquer dans la Marche restante (pas une Charge → pas de bonus). Pure-store. */
export function attackPlan(get: () => GameState, active: Combatant, target: Combatant): AttackPlan {
  const battle = get().battle!;
  const scene = get().scene!;
  if (combatDistance(active, target) <= meleeReachTiles(active.weapons)) return { kind: 'attack' };
  // L'arme du SET ACTIF décide : une arme à distance présente → tir (les messages rechargement/
  // munitions restent gérés au commit par la logique d'attaque existante).
  if (attackWeapon(active.weapons, false).type === 'ranged') return { kind: 'attack' };
  // Mêlée hors d'Allonge :
  if (isEngaged(active)) return { kind: 'blocked', reason: 'Engagé : se désengager avant de rejoindre une autre cible.' };
  const geom = mountOf(battle, active) ?? active;
  const blocked = occupied(battle, geom);
  if (battle.movementUsed === 0 && !hasCondition(active, 'À Terre')) {
    // Charge (LDB 15 l.74-77) : manœuvre PLEINE, portée de Course (2M), arrivée adjacente la moins chère.
    const M = mountMovement(battle, active);
    const reach = reachable(scene, active.pos!, M * 2, blocked, sizeFootprint(geom.size));
    const dest = bestAdjacentReachable(reach, target.pos!);
    if (!dest) return { kind: 'blocked', reason: 'Cible hors de portée de Charge.' };
    return { kind: 'charge', dest, path: pathTo(scene, active.pos!, dest, blocked, sizeFootprint(geom.size)), adv: chargeAdvantage(M, chebyshev(active.pos!, target.pos!)) };
  }
  // Mouvement entamé (ou À Terre) : rejoindre dans la Marche restante.
  const reach = displayedReach(get);
  const dest = bestAdjacentReachable(reach, target.pos!);
  if (!dest) return { kind: 'blocked', reason: 'Cible hors de portée de mêlée.' };
  return { kind: 'moveAttack', dest, path: pathTo(scene, active.pos!, dest, blocked, sizeFootprint(geom.size)), cost: reach.get(`${dest.x},${dest.y}`)! };
}
```

- [ ] **Step 4: Réécrire `battleClickEntity`**

Signature : `battleClickEntity: (id: string, skipMountChoice?: boolean, opts?: { confirm?: boolean }) => void`. Structure (remplace les blocs `action === 'charge'` l.1680-1708 et la queue d'attaque l.1709-1733 ; les branches trample l.1655-1658 et cast l.1665-1669 restent EN L'ÉTAT) :

```ts
    // … gardes existantes (trample, freeFrenzyAttack, acted, cast) inchangées jusqu'à l.1669 …
    if (battle.action !== null && battle.action !== 'attack') return; // 'attack' n'existe plus après Task 6 ; transitoirement toléré
    if (target.kind === 'hero') return;
    if (!canTakeAction(active) || hasCondition(active, 'Brisé')) return; // Sonné/Brisé : pas d'attaque (parité boutons)
    const plan = attackPlan(get, active, target);
    // Frénésie libre post-Action : attaque DIRECTE seulement (pas de déplacement combiné).
    if (battle.acted && plan.kind !== 'attack') return;
    if (plan.kind === 'blocked') {
      get().log(plan.reason);
      if (battle.preview) set({ battle: { ...battle, preview: null } });
      return;
    }
    // Tap 1 : aperçu — sauf confirmation (tests) ou ré-entrée du choix cavalier/monture.
    const prev = battle.preview;
    const samePreview = prev && 'targetId' in prev && prev.targetId === id && prev.kind === plan.kind;
    if (!opts?.confirm && !skipMountChoice && !samePreview) {
      set({ battle: { ...battle, preview: plan.kind === 'attack' ? { kind: 'attack', targetId: id } : { ...plan, targetId: id } } });
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
    // Tap 2 : COMMIT. Choix cavalier/monture (LDB 14 l.219) AVANT toute résolution — bloc l.1672-1679 existant.
    // … bloc pendingMountTarget inchangé …
    set({ battle: { ...get().battle!, preview: null } });
    if (plan.kind === 'charge') {
      // corps du bloc charge EXISTANT (l.1683-1707) avec : dest/path/adv lus du plan,
      // gainAdvantage(active, plan.adv) au lieu de active.advantage += adv,
      // et plus de re-calcul reachable/bestAdjacentReachable (déjà dans le plan).
      // Le set final garde movementUsed: mountMovement(battle, active) (manœuvre pleine) et action: null.
      // pendingAttack: { …, fromCharge: true } inchangé.
      return;
    }
    if (plan.kind === 'moveAttack') {
      // Segment de Mouvement vers plan.dest : MÊMES mutations que le commit de battleClickTile
      // (pos, monture, displaceSmaller, faceFromPath, ANIM_MOVE, moveSnapshot, movementUsed += plan.cost,
      //  movedPreAction). Puis on enchaîne sur la queue d'attaque ci-dessous (cible désormais adjacente).
    }
    // … queue d'attaque EXISTANTE (l.1710-1733) : adj/attackWeapon/rechargement/munitions/pendingAttack …
```

IMPORTANT : relire `get().battle!`/l'actif APRÈS le segment moveAttack (les mutations ont eu lieu). Le `battle.action === 'attack'` du gate `freeFrenzyAttack` (l.1661) devient `battle.action === null`.

- [ ] **Step 5: Vert + adapter les tests existants de clic-ennemi**

Run: `npx vitest run src/state/implicit-clicks.test.ts` puis `npm test`.
Casse attendue : tests qui font `battleSelectAction('attack')`/`('charge')` + `battleClickEntity(id)` (store.test.ts l.779-833, frenzy-hero-free, cleave, stationary-fire, creatureFreeAttacks…) → remplacer par `battleClickEntity(id, undefined, { confirm: true })` et supprimer le `battleSelectAction`. Pour les tests Charge de `split-movement.test.ts:132-142` : remplacer les assertions sur `reachable.size` par le plan — `attackPlan` rend `blocked`/`charge` selon `movementUsed` (import depuis `./combatFlow`).

```bash
git commit -m "feat(combat): clic-ennemi implicite - attaque/tir/Charge/rejoindre-et-attaquer en tap apercu puis tap confirme" -- src/state/store.ts src/state/combatFlow.ts src/state/implicit-clicks.test.ts src/state/store.test.ts src/state/split-movement.test.ts src/state/frenzy-hero-free.test.ts src/state/cleave.test.ts src/state/stationary-fire.test.ts src/state/creatureFreeAttacks.test.ts
```

(Étendre le pathspec aux autres fichiers de tests réellement touchés.)

---

### Task 6: Retrait des modes `move`/`attack`/`charge` et des boutons

**Files:**
- Modify: `src/state/store.ts:118,347` (unions), `battleSelectAction` (l.1043-1082), `runConfirm` (l.2300)
- Modify: `src/state/combatFlow.ts:813` (startDisengage)
- Modify: `src/ui/ActionBar.tsx` (boutons Déplacer/Attaquer/Charger)
- Modify: `src/gameIso/IsoStage.tsx:247,281`

- [ ] **Step 1: Rétrécir les unions et purger battleSelectAction**

- `BattleState.action` (l.118) et `battleSelectAction` (l.347) : retirer `'move' | 'attack' | 'charge'` des unions.
- Dans `battleSelectAction` : supprimer la branche `a === 'move'` (l.1043-1075 — Désengagement au clic-sol désormais, logique Brisé déjà déplacée en Task 3) et la branche `a === 'charge'` (l.1076-1082).
- `runConfirm` (l.2300) : `action: 'move'` → `action: null` (le reachable étendu stocké reste : `displayedReach` le sert).
- `startDisengage` (combatFlow l.813) : `action: 'move'` → `action: null`.

- [ ] **Step 2: ActionBar — supprimer les 3 boutons**

Dans `src/ui/ActionBar.tsx` :
- Supprimer le bouton « Déplacer » (l.380-388) et le bouton « Attaquer » (l.400-408). « Annuler dépl. » (l.390-399) RESTE.
- Supprimer le bloc `canCharge` du sous-menu mvt (l.236-240) et la variable `canCharge` (l.115).
- Le hint d'aide : ajouter en tête de `.ab-bar` (ou en `title` du cadre) « Clic case = se déplacer · clic ennemi = attaquer » — UNE ligne discrète `<span className="ab-hint-implicit">`.
- Les références `battle.action === 'move'`/`'attack'` du fichier disparaissent avec les boutons.

- [ ] **Step 3: IsoStage — conditions neutres**

- l.247-250 (bandes de portée) : `battle.action === 'attack'` → `battle.action === null && !battle.preview` (toujours informatives pendant le tour du héros tireur).
- l.281 (anneaux de cibles valides) : `battle.action === 'attack'` → `battle.action === null && (!battle.acted || (activeC?.frenzied && !activeC.frenzyFreeUsed))`.

- [ ] **Step 4: Typecheck + suite + commit**

Run: `npm run typecheck` (chasse les usages restants des modes retirés — corriger chaque site signalé) puis `npm test`.
```bash
git commit -m "feat(combat): retrait des modes move/attack/charge et des boutons Deplacer/Attaquer/Charger" -- src/state/store.ts src/state/combatFlow.ts src/ui/ActionBar.tsx src/gameIso/IsoStage.tsx
```

---

### Task 7: Rendu de l'aperçu (chemin + arrivée + badge)

**Files:**
- Modify: `src/gameIso/IsoStage.tsx` (staticHighlights + touche Échap)
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Dessiner l'aperçu dans `staticHighlights`**

Après le bloc reachable (l.262-265), ajouter (import `tileCenter` depuis `./iso` s'il manque) :

```tsx
    // Aperçu tap-1 (modèle implicite) : chemin pointillé, case d'arrivée, badge de l'action du tap 2.
    const pv = battle.preview;
    if (pv) {
      const path = pv.kind === 'attack' ? [] : pv.path;
      if (path.length > 1) {
        const pts = path.map((p) => tileCenter(p.x, p.y, d)).map((p) => `${p.x},${p.y}`).join(' ');
        hl.push(<polyline key="pv-path" points={pts} fill="none" stroke="#ffd75e" strokeWidth={3} strokeDasharray="7 5" opacity={0.9} pointerEvents="none" />);
      }
      const tgt = 'targetId' in pv ? battle.combatants.find((c) => c.id === pv.targetId) : undefined;
      const dest = pv.kind === 'move' ? pv.tile : pv.kind === 'attack' ? tgt?.pos : pv.dest;
      if (dest) hl.push(<path key="pv-dest" d={diamondPath(dest.x, dest.y, d)} fill="none" stroke="#ffd75e" strokeWidth={3} opacity={0.95} pointerEvents="none" />);
      if (tgt?.pos) hl.push(<path key="pv-tgt" d={diamondPath(tgt.pos.x, tgt.pos.y, d)} fill="#ffd75e" opacity={0.18} pointerEvents="none" />);
      const lbl = pv.kind === 'move' ? `Aller (${pv.cost})` : pv.kind === 'charge' ? (pv.adv ? 'Charger (+1 Av)' : 'Charger') : pv.kind === 'moveAttack' ? 'Rejoindre + attaquer' : 'Attaquer';
      const at = dest ?? tgt?.pos;
      if (at) {
        const c0 = tileCenter(at.x, at.y, d);
        hl.push(<text key="pv-lbl" x={c0.x} y={c0.y - 28} textAnchor="middle" className="pv-badge" pointerEvents="none">{lbl} — re-cliquer pour confirmer</text>);
      }
    }
```

- [ ] **Step 2: Échap purge l'aperçu**

Dans IsoStage (à côté des effets existants) :

```tsx
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const st = useGame.getState();
      if (st.battle?.preview) useGame.setState({ battle: { ...st.battle, preview: null } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
```

- [ ] **Step 3: CSS du badge**

`src/ui/styles.css` :

```css
/* Badge d'aperçu tap-1 (modèle de clic implicite) */
.pv-badge { font: 700 13px system-ui, sans-serif; fill: #ffd75e; paint-order: stroke; stroke: #15100a; stroke-width: 3px; }
```

- [ ] **Step 4: Vérif manuelle + commit**

Run: `npm run typecheck` puis `npm test` → PASS. (La recette navigateur complète arrive en Task 9.)
```bash
git commit -m "feat(combat): rendu de l'apercu tap-1 (chemin, arrivee, badge Charger +1 Av) + Echap" -- src/gameIso/IsoStage.tsx src/ui/styles.css
```

---

### Task 8: Cadre portrait actif (`ActiveFrame`)

**Files:**
- Create: `src/ui/ActiveFrame.tsx`
- Modify: `src/ui/PortraitTile.tsx` (prop `showGauge`)
- Modify: `src/ui/ActionBar.tsx:336-375` (bloc ab-actor)
- Modify: `src/ui/styles.css`
- Test: `src/ui/ActiveFrame.test.tsx`

- [ ] **Step 1: Test SSR du cadre**

Créer `src/ui/ActiveFrame.test.tsx` (même idiome SSR-à-props que `PortraitTile.test.tsx`) :

```tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActiveFrame } from './ActiveFrame';
import type { Combatant } from '../engine/types';

const c = (over: Partial<Combatant>) => ({
  id: 'h', name: 'H', kind: 'hero', wounds: { current: 8, max: 12 }, conditions: [], advantage: 0,
  weapons: [], skills: [], items: [], movement: 4, ...over,
}) as unknown as Combatant;

describe('ActiveFrame — jauges crantées à taille fixe', () => {
  it('Avantage : toujours 10 crans, remplis = min(adv, 10)', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({ advantage: 13 })} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={2} moveMax={4} />);
    expect((html.match(/af-adv/g) ?? []).length).toBeGreaterThan(0);
    const adv = html.split('af-adv')[1].split('</span>')[0];
    expect((adv.match(/class="on"/g) ?? []).length).toBe(10); // clampé
    expect((adv.match(/class="(on|off)"/g) ?? []).length).toBe(10); // taille fixe
  });
  it('Mouvement : crans = budget du tour ; Action verticale présente pour un héros', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({})} ring="#fff" isHero actAvail={1} actMax={2} moveLeft={3} moveMax={5} />);
    const move = html.split('af-move')[1].split('</span>')[0];
    expect((move.match(/class="(on|off)"/g) ?? []).length).toBe(5);
    expect((move.match(/class="on"/g) ?? []).length).toBe(3);
    expect(html).toContain('af-action');
  });
  it('vie continue sous le portrait (af-hp), pas de jauge interne au portrait', () => {
    const html = renderToStaticMarkup(<ActiveFrame c={c({})} ring="#fff" isHero actAvail={1} actMax={1} moveLeft={0} moveMax={0} />);
    expect(html).toContain('af-hp');
    expect(html).not.toContain('ptile-gauge');
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npx vitest run src/ui/ActiveFrame.test.tsx` → FAIL.

- [ ] **Step 3: `showGauge` sur PortraitTile**

`src/ui/PortraitTile.tsx` : ajouter `showGauge = true` aux props (`/** Jauge de PV interne (bord gauche). Off dans l'ActiveFrame : la vie y est une barre externe. */ showGauge?: boolean;`) et conditionner le bloc `<i className="ptile-gauge">…` à `{showGauge && (…)}`.

- [ ] **Step 4: Implémenter ActiveFrame**

Créer `src/ui/ActiveFrame.tsx` :

```tsx
import { PortraitTile } from './PortraitTile';
import { hpColor } from '../gameIso/teamColors';
import { ADVANTAGE_CAP } from '../engine/advantage';
import type { Combatant } from '../engine/types';

/** Jauge CRANTÉE à taille fixe : N segments égaux dans une longueur constante (2 ou 150 points →
 *  même encombrement). `vertical` = colonne (remplie du bas vers le haut). */
function Notches({ kind, value, max, vertical, title }: { kind: string; value: number; max: number; vertical?: boolean; title: string }) {
  if (max <= 0) return null;
  return (
    <span className={`af-bar af-${kind} ${vertical ? 'af-v' : 'af-h'}`} title={title} aria-label={title}>
      {Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? 'on' : 'off'} />)}
    </span>
  );
}

/** Cadre du combattant ACTIF (barre d'action seulement) : Action verticale à gauche | portrait |
 *  Mouvement vertical à droite ; dessous : vie (continue) puis Avantage (10 crans — plafond RAW
 *  optionnel LDB 15-Dépl l.17). Pur à props (testable en SSR). */
export function ActiveFrame({ c, ring, isHero, actAvail, actMax, moveLeft, moveMax, title }: {
  c: Combatant; ring: string; isHero: boolean;
  actAvail: number; actMax: number; moveLeft: number; moveMax: number; title?: string;
}) {
  const ratio = c.wounds.max > 0 ? Math.max(0, Math.min(1, c.wounds.current / c.wounds.max)) : 0;
  return (
    <div className="aframe">
      {isHero && <Notches kind="action" vertical value={actAvail} max={actMax} title={`Action : ${actAvail}/${actMax}`} />}
      <div className="af-mid">
        <PortraitTile c={c} ring={ring} size={72} showGauge={false} title={title} />
        <span className="af-hp" title={`Blessures : ${c.wounds.current}/${c.wounds.max}`}>
          <b style={{ width: `${Math.round(ratio * 100)}%`, background: hpColor(ratio) }} />
          <span className="af-hp-n">{c.dead ? '☠️' : `${c.wounds.current}/${c.wounds.max}`}</span>
        </span>
        <Notches kind="adv" value={Math.min(c.advantage, ADVANTAGE_CAP)} max={ADVANTAGE_CAP} title={`Avantage : ${c.advantage}/${ADVANTAGE_CAP}`} />
      </div>
      {isHero && <Notches kind="move" vertical value={moveLeft} max={moveMax} title={`Mouvement : ${moveLeft}/${moveMax} case${moveMax > 1 ? 's' : ''}`} />}
    </div>
  );
}
```

- [ ] **Step 5: Brancher dans ActionBar et retirer l'ancien bloc**

`src/ui/ActionBar.tsx` (l.336-357) : remplacer `<PortraitTile … showPv …/>` et le bloc `.ab-stats` (les deux `<Gauge/>`) par :

```tsx
          <ActiveFrame
            c={active} ring={ring} isHero={isHero}
            actAvail={actAvail} actMax={actMax} moveLeft={moveLeft} moveMax={moveMax}
            title={active.career ? `${active.name} — ${active.career}` : active.name}
          />
```

Supprimer le composant local `Gauge` (l.20-32) et le chip `{active.advantage > 0 && <span className="adv">…}` (l.344 — l'Avantage est désormais la barre). `ab-name`/`ab-assailli`/commutateur de loadouts restent dans `.ab-actor-side`.

- [ ] **Step 6: CSS**

`src/ui/styles.css` — sous les styles `.ab-actor` existants (réutiliser les tokens de couleur du fichier ; breakpoints canon : rien à faire, le cluster reste ≤ ~110 px de large) :

```css
/* Cadre du combattant actif : jauges crantées TAILLE FIXE autour du portrait 72px */
.aframe { display: flex; align-items: flex-start; gap: 4px; }
.af-mid { display: flex; flex-direction: column; gap: 3px; width: 72px; }
.af-bar { display: flex; gap: 2px; }
.af-h { width: 72px; height: 8px; }
.af-v { flex-direction: column-reverse; width: 8px; height: 72px; }
.af-bar i { flex: 1 1 0; min-width: 0; min-height: 0; border-radius: 2px; background: #2a2f3a; }
.af-action i.on { background: #e7c14d; }
.af-move i.on { background: #4f8fe0; }
.af-adv i.on { background: #ff9b3d; }
.af-hp { position: relative; display: block; width: 72px; height: 10px; background: #2a2f3a; border-radius: 3px; overflow: hidden; }
.af-hp b { display: block; height: 100%; }
.af-hp-n { position: absolute; inset: 0; font-size: 8px; line-height: 10px; text-align: center; color: #fff; text-shadow: 0 0 2px #000; }
```

Supprimer les styles `.ab-g`/`.gp` devenus orphelins SI plus aucun usage (`Grep ab-g` avant).

- [ ] **Step 7: Vert + commit**

Run: `npx vitest run src/ui/ActiveFrame.test.tsx` puis `npm test` et `npm run typecheck` → PASS.
```bash
git commit -m "feat(hud): cadre portrait actif - jauges crantees taille fixe (Action/Mouvement/Avantage 10) + vie sous le portrait" -- src/ui/ActiveFrame.tsx src/ui/ActiveFrame.test.tsx src/ui/PortraitTile.tsx src/ui/ActionBar.tsx src/ui/styles.css
```

---

### Task 9: Vérification finale (suite, typecheck, recette navigateur)

**Files:** aucun nouveau (corrections éventuelles).

- [ ] **Step 1: Suite complète + typecheck** — Run: `npm test` puis `npm run typecheck` → 0 échec.

- [ ] **Step 2: Recette navigateur (Playwright MCP)**

`npm run dev` puis sur `localhost:5173`, menu « 🧪 Tests — scénarios », scénario de combat de mêlée (groupe fixé) :
1. Tour d'un héros : la portée de Marche est surlignée SANS cliquer de bouton.
2. Clic case : chemin pointillé + badge « Aller (N) » ; re-clic : le héros marche, jauge Mouvement décrémentée.
3. Clic ennemi à 2+ cases (arme de mêlée, Mouvement intact) : badge « Charger (+1 Av) » ; re-clic : déplacement + modale d'attaque ; vérifier +1 Avantage (barre crantée) et `fromCharge`.
4. Clic ennemi adjacent : badge « Attaquer » ; re-clic : modale directe, AUCUN Avantage gagné.
5. Engagé : clic-sol ouvre le Désengagement.
6. Cadre actif : vie sous le portrait, Mouvement vertical droite, Action verticale gauche, Avantage 10 crans.
7. Console : 0 erreur. Screenshot.

- [ ] **Step 3: Commit final (si corrections) + push**

```bash
git push
```
