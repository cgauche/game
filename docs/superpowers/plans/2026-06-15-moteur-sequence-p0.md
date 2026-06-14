# Moteur de séquence généralisé — P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Généraliser le moteur cascade (`src/state/cascade.ts`) en étapes mixtes **jet / choix / affichage**, pur + testé, **zéro combat** ; la cascade de nuit migre dessus sans changement visible.

**Architecture:** Type d'interaction **inféré des champs** d'une `CascadeStep` (`target`→jet, `options`→choix, sinon→affichage). Deux helpers purs (`stepInteraction`, `stepReady`) factorisent la garde, partagée par les trois pilotes (`advanceCascade`, `resolveRemainingCascade`, `runCascadeImmediate`). Nouvelle action `cascadeChoose` (analogue de `cascadeRoll`). Couche **additive** : nouveaux champs optionnels, gardes en surensemble du comportement actuel — aucun fichier combat touché.

**Tech Stack:** TypeScript, Zustand (store `src/state/store.ts`), Vitest. RNG seedable (`battleRng`). Outil shell = **PowerShell** (`Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'` en préfixe).

Spec : `docs/superpowers/specs/2026-06-15-moteur-sequence-consequences-design.md`.

---

### Task 1 : Champs d'étape + helpers d'interaction (purs)

**Files:**
- Modify: `src/state/pendings.ts` (interface `CascadeStep`, après `outcome?: string[]`)
- Modify: `src/state/cascade.ts` (helpers après `registerCascadeApplier`, ~ligne 59)
- Test: `src/state/cascade.test.ts`

- [ ] **Step 1 : Test qui échoue** — ajouter dans `cascade.test.ts`, et étendre l'import ligne 5 :

```ts
import { startCascade, registerCascadeApplier, stepInteraction, stepReady, setCascadeChoice } from './cascade';
```

Puis ajouter ce test (à l'intérieur du `describe`) :

```ts
  it('stepInteraction / stepReady : type d’interaction inféré des champs', () => {
    const jet: CascadeStep = { id: 'j', kind: 'tally', actorId: 'x', rollLabel: 'R', base: 30, target: 30, result: null, interactive: true };
    const choix: CascadeStep = { id: 'c', kind: 'pick', actorId: 'x', options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], interactive: true };
    const aff: CascadeStep = { id: 'd', kind: 'note', actorId: 'x', interactive: true };
    expect(stepInteraction(jet)).toBe('jet');
    expect(stepInteraction(choix)).toBe('choix');
    expect(stepInteraction(aff)).toBe('affichage');
    expect(stepReady(jet)).toBe(false);
    expect(stepReady({ ...jet, result: { roll: 10, target: 30, sl: 2, success: true } })).toBe(true);
    expect(stepReady(choix)).toBe(false);
    expect(stepReady({ ...choix, chosen: 'a' })).toBe(true);
    expect(stepReady(aff)).toBe(true);
  });
```

- [ ] **Step 2 : Lancer → échec** (compile error : `stepInteraction` / `options` inconnus)

Run: `Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; npx vitest run cascade`
Expected: FAIL (export/champ absent).

- [ ] **Step 3 : Ajouter les champs** dans `src/state/pendings.ts`, juste avant le `}` qui ferme `CascadeStep` (après la ligne `outcome?: string[];`) :

```ts
  /** Étape « choix » : options présentées au joueur (l'option retenue pilote la conséquence). */
  options?: { key: string; label: string; detail?: string }[];
  /** Option retenue (clé) — analogue de `result` pour une étape « choix ». */
  chosen?: string;
  /** Clé choisie d'office par « Tout lancer » / résolution immédiate (défaut = `options[0]`). */
  defaultChoice?: string;
```

- [ ] **Step 4 : Ajouter les helpers** dans `src/state/cascade.ts`, juste après `registerCascadeApplier` (après la ligne 59 `}`) :

```ts
/** Type d'INTERACTION d'une étape, inféré de ses champs (zéro migration des étapes-jet existantes) :
 *  un Test (`target`), un choix du joueur (`options`), ou un pur affichage (ni l'un ni l'autre). */
export function stepInteraction(step: CascadeStep): 'jet' | 'choix' | 'affichage' {
  if (step.target != null) return 'jet';
  if (step.options != null) return 'choix';
  return 'affichage';
}

/** L'étape est-elle prête à être validée ? jet → lancée (`result`) ; choix → tranchée (`chosen`) ;
 *  affichage → toujours (rien à résoudre avant la conséquence). */
export function stepReady(step: CascadeStep): boolean {
  switch (stepInteraction(step)) {
    case 'jet': return !!step.result;
    case 'choix': return step.chosen != null;
    case 'affichage': return true;
  }
}
```

- [ ] **Step 5 : Lancer → vert** (le test des helpers passe ; `setCascadeChoice` encore absent fera échouer l'import → on l'ajoute en Task 2. Pour isoler, lancer juste ce test) :

Run: `Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; npx vitest run cascade -t "stepInteraction"`
Expected: l'import échoue encore (`setCascadeChoice`). **Donc : ne pas committer avant Task 2** — l'import partagé couple Task 1 et Task 2. Continuer directement.

> Note : Task 1 et Task 2 partagent la ligne d'import (`setCascadeChoice`). On les COMMITTE ensemble à la fin de Task 2.

---

### Task 2 : `cascadeChoose` + garde généralisée d'`advanceCascade`

**Files:**
- Modify: `src/state/cascade.ts` (`setCascadeChoice` ; garde `advanceCascade` ligne 100)
- Modify: `src/state/store.ts` (import ; interface ~ligne 676 ; impl ~ligne 1845)
- Test: `src/state/cascade.test.ts`

- [ ] **Step 1 : Tests qui échouent** — ajouter ces deux tests dans `cascade.test.ts` :

```ts
  it('étape « choix » : no-op sans choix, puis l’option pilote la conséquence + insertion', () => {
    const h = hero();
    registerCascadeApplier('pick', (_g, _s, step) => {
      applied.push({ kind: step.kind, success: step.chosen === 'devier' });
      return step.chosen === 'devier' ? { insert: [{ id: 'suite', kind: 'note', actorId: h.id, interactive: true }] } : {};
    });
    registerCascadeApplier('note', (_g, _s, step) => { applied.push({ kind: step.kind, success: true }); return { journal: [`${step.id}`] }; });
    const choix: CascadeStep = { id: 'c', kind: 'pick', actorId: h.id, options: [{ key: 'devier', label: 'Dévier' }, { key: 'subir', label: 'Subir' }], interactive: true };
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [choix] });
    useGame.getState().cascadeNext(); // pas de choix → no-op
    expect(applied).toHaveLength(0);
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
    useGame.getState().cascadeChoose('c', 'devier');
    expect(useGame.getState().pendingCascade!.participants[0].chosen).toBe('devier');
    useGame.getState().cascadeNext(); // valide → applier voit 'devier' + insère 'suite'
    expect(applied[0]).toEqual({ kind: 'pick', success: true });
    expect(useGame.getState().pendingCascade!.participants).toHaveLength(2);
    expect(useGame.getState().pendingCascade!.cursor).toBe(1);
  });

  it('étape « affichage » : validée sans jet ni choix', () => {
    const h = hero();
    registerCascadeApplier('note', (_g, _s, step) => { applied.push({ kind: 'note', success: true }); return { journal: [`${step.id}`] }; });
    const aff: CascadeStep = { id: 'd', kind: 'note', actorId: h.id, interactive: true };
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [aff] });
    useGame.getState().cascadeNext(); // affichage → acquitté directement, cascade finalisée
    expect(applied).toEqual([{ kind: 'note', success: true }]);
    expect(useGame.getState().pendingCascade).toBeNull();
  });
```

- [ ] **Step 2 : Lancer → échec** (`cascadeChoose` absent du store)

Run: `Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; npx vitest run cascade`
Expected: FAIL (`cascadeChoose is not a function`).

- [ ] **Step 3a : `setCascadeChoice`** dans `src/state/cascade.ts`, juste avant `function commitStep` (~ligne 76) :

```ts
/** Pose le choix du joueur sur l'étape « choix » COURANTE (valide que `key ∈ options`). Analogue de
 *  `cascadeRoll` côté jet : prépare l'étape ; la VALIDATION (conséquence) reste à `advanceCascade`. */
export function setCascadeChoice(get: Get, set: Set, stepId: string, key: string): void {
  const p = get().pendingCascade;
  if (!p) return;
  const cur = p.participants[p.cursor];
  if (!cur || cur.id !== stepId) return;
  if (!cur.options?.some((o) => o.key === key)) return;
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === p.cursor ? { ...x, chosen: key } : x)) } });
}
```

- [ ] **Step 3b : Garde généralisée** dans `advanceCascade` — remplacer la ligne 100 :

```ts
  if (cur && cur.target != null && !cur.result) return null; // jet requis d'abord
```

par :

```ts
  if (cur && !stepReady(cur)) return null; // jet non lancé / choix non tranché → la modale force d'abord
```

- [ ] **Step 3c : Action store** — dans `src/state/store.ts` : (1) étendre l'import depuis `./cascade` (ligne 139) en ajoutant `setCascadeChoice` ; (2) déclarer l'action dans l'interface, juste après `cascadeSetForcedRoll` (~ligne 676) :

```ts
  /** « Choix » d'une étape de séquence (analogue de cascadeRoll côté jet) : pose l'option retenue. */
  cascadeChoose: (pid: string, key: string) => void;
```

(3) l'implémenter juste après `cascadeSetForcedRoll: ...` (~ligne 1845) :

```ts
  cascadeChoose: (pid, key) => setCascadeChoice(get, set, pid, key),
```

L'import devient :

```ts
import { advanceCascade, resolveRemainingCascade, finalizeCascade, setCascadeChoice } from './cascade';
```

- [ ] **Step 4 : Lancer → vert**

Run: `Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; npx vitest run cascade; npm run typecheck`
Expected: cascade PASS, typecheck EXIT 0.

- [ ] **Step 5 : Commit** (Task 1 + Task 2 ensemble — import couplé)

```
Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; git commit -m "feat(cascade): étapes choix/affichage (P0) — modèle + garde + cascadeChoose" -- src/state/pendings.ts src/state/cascade.ts src/state/store.ts src/state/cascade.test.ts
```

---

### Task 3 : Résolution d'office généralisée (choix par défaut, affichage acquitté)

**Files:**
- Modify: `src/state/cascade.ts` (`resolveRemainingCascade` ~ligne 123-129 ; `runCascadeImmediate` ~ligne 154-159)
- Test: `src/state/cascade.test.ts`

- [ ] **Step 1 : Test qui échoue** — ajouter dans `cascade.test.ts` :

```ts
  it('« Tout lancer » résout une séquence MIXTE (jet roulé, choix par défaut, affichage) → bilan', () => {
    useGame.getState().seedRng(7);
    const h = hero();
    registerCascadeApplier('pick', (_g, _s, step) => { applied.push({ kind: 'pick', success: step.chosen === 'a' }); return {}; });
    registerCascadeApplier('note', (_g, _s) => { applied.push({ kind: 'note', success: true }); return {}; });
    const steps: CascadeStep[] = [
      step('s1', h.id), // jet (tally)
      { id: 'c', kind: 'pick', actorId: h.id, options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], interactive: true }, // défaut = 'a'
      { id: 'd', kind: 'note', actorId: h.id, interactive: true }, // affichage
    ];
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps });
    useGame.getState().cascadeResolveAll();
    expect(applied.map((a) => a.kind)).toEqual(['tally', 'pick', 'note']);
    expect(applied[1]).toEqual({ kind: 'pick', success: true }); // défaut = 1ʳᵉ option 'a'
    expect(useGame.getState().pendingCascade!.cursor).toBe(3); // bilan (curseur en fin)
    useGame.getState().cascadeFinish();
    expect(useGame.getState().pendingCascade).toBeNull();
  });
```

- [ ] **Step 2 : Lancer → échec** (le `pick` non roulé n'est jamais résolu → `applied` n'a pas `'pick'`)

Run: `Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; npx vitest run cascade`
Expected: FAIL sur l'assertion `applied.map(...)`.

- [ ] **Step 3a : Généraliser `resolveRemainingCascade`** — remplacer, dans la boucle, les lignes 124-129 :

```ts
    const st = steps[i];
    if (st.target != null && !st.result) {
      const t = rollTest(st.target, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target, sl: t.sl, success: t.success };
      steps = steps.map((x, k) => (k === i ? { ...x, result } : x));
    }
```

par :

```ts
    const st = steps[i];
    if (stepInteraction(st) === 'jet' && !st.result) {
      const t = rollTest(st.target!, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target!, sl: t.sl, success: t.success };
      steps = steps.map((x, k) => (k === i ? { ...x, result } : x));
    } else if (stepInteraction(st) === 'choix' && st.chosen == null) {
      const key = st.defaultChoice ?? st.options![0]?.key;
      if (key != null) steps = steps.map((x, k) => (k === i ? { ...x, chosen: key } : x));
    } // affichage : rien à résoudre avant la conséquence
```

- [ ] **Step 3b : Généraliser `runCascadeImmediate`** — remplacer, dans sa boucle, les lignes 154-159 :

```ts
    const st = cur[i];
    if (st.target != null && !st.result) {
      const t = rollTest(st.target, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target, sl: t.sl, success: t.success };
      cur = cur.map((x, k) => (k === i ? { ...x, result } : x));
    }
```

par :

```ts
    const st = cur[i];
    if (stepInteraction(st) === 'jet' && !st.result) {
      const t = rollTest(st.target!, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target!, sl: t.sl, success: t.success };
      cur = cur.map((x, k) => (k === i ? { ...x, result } : x));
    } else if (stepInteraction(st) === 'choix' && st.chosen == null) {
      const key = st.defaultChoice ?? st.options![0]?.key;
      if (key != null) cur = cur.map((x, k) => (k === i ? { ...x, chosen: key } : x));
    } // affichage : rien à résoudre avant la conséquence
```

- [ ] **Step 4 : Lancer → vert**

Run: `Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; npx vitest run cascade; npm run typecheck`
Expected: cascade PASS, typecheck EXIT 0.

- [ ] **Step 5 : Commit**

```
Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; git commit -m "feat(cascade): Tout lancer/immédiat gèrent choix (défaut) + affichage (P0)" -- src/state/cascade.ts src/state/cascade.test.ts
```

---

### Task 4 : Intent coop + régression complète

**Files:**
- Modify: `src/net/intents.ts` (ligne 45, liste cascade)
- Verify: suites cascade/nuit + intents + typecheck

- [ ] **Step 1 : Ajouter l'intent** — dans `src/net/intents.ts`, remplacer la ligne 45 :

```ts
  'cascadeForceSuccess', 'cascadeSetForcedRoll', 'cascadeNext', 'cascadeResolveAll', 'cascadeFinish',
```

par :

```ts
  'cascadeForceSuccess', 'cascadeSetForcedRoll', 'cascadeNext', 'cascadeResolveAll', 'cascadeFinish', 'cascadeChoose',
```

- [ ] **Step 2 : Vérifier l'allowlist** (`intents.test.ts` exige que `cascadeChoose` existe dans le store — ajouté en Task 2)

Run: `Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; npx vitest run intents`
Expected: PASS.

- [ ] **Step 3 : Régression — nuit + invariant + moteur**

Run: `Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; npx vitest run cascade rest-flow upkeep-cascade roll-modal-invariant disease trauma provisions; npm run typecheck`
Expected: TOUT vert, typecheck EXIT 0. (La cascade de nuit, jets-only, est inchangée → aucune régression.)

- [ ] **Step 4 : Commit**

```
Set-Location 'C:\Users\gauch\PhpstormProjects\Foundry\Game'; git commit -m "feat(cascade): intent coop cascadeChoose (P0)" -- src/net/intents.ts
```

---

## Self-Review (à faire après écriture)

- **Couverture spec** : modèle d'étape (Task 1) ✓ ; garde généralisée + `cascadeChoose` (Task 2) ✓ ; résolution d'office choix/affichage (Task 3) ✓ ; intent coop (Task 4) ✓ ; migration nuit sans changement (régression Task 4) ✓ ; `describe` inchangé ✓ ; pas de renommage ✓ ; aucun fichier combat ✓.
- **Pas de placeholder** : chaque step porte le code exact.
- **Cohérence des noms** : `stepInteraction`/`stepReady`/`setCascadeChoice` (cascade.ts) ↔ `cascadeChoose` (store) ↔ `'cascadeChoose'` (intent) — alignés. Champs `options`/`chosen`/`defaultChoice` identiques entre pendings.ts, helpers, et tests.
