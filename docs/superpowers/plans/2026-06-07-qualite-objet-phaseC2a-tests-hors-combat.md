# Phase C2a — Pratique / Peu Fiable / Bâclé HORS COMBAT — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (ou subagent-driven-development). Étapes en `- [ ]`.
> ⚠️ **Fichiers chauds** (`store.ts`, `combatFlow.ts`, `scene.ts`) édités par d'autres sessions Claude en // → relire avant chaque edit, committer **uniquement** ces fichiers via `git commit -- <chemins>`.

**Goal:** Un Test de compétence **hors combat** consulte l'**outil** du héros qui agit : un outil **Pratique** donne **+1 DR** / **Peu Fiable** **−1 DR** à un Test **raté** (LDB 60 l.59/88 — peut repêcher un échec qui n'a manqué que le seuil de DR `requireSL`, jamais transformer un d100 raté en réussite) ; un outil **Bâclé** se **brise** sur une **Maladresse** (échec + double). Authoring via `Effect.test.tool` (nom de l'objet).

**Architecture :** `Effect.test` gagne `tool?: string` (nom d'objet). Le handler `case 'test'` (combatFlow) résout ce nom vers l'uid de l'objet du héros choisi → `PendingTest.itemUid`, et capture `isDouble` du jet. `resolveTest` (store) lit l'outil, applique le helper **existant** `craftTestDRAdjust` (dispatch.ts) pour recalculer réussite-vs-`requireSL` **avant** de brancher, et casse un outil Bâclé sur Maladresse. **Aucune nouvelle entrée de registre** (Pratique/Peu Fiable/Bâclé existent déjà avec `testFailDR`).

**Tech Stack :** TypeScript, Zustand, Vitest.

---

## État actuel (vérifié 2026-06-07 — n° de ligne indicatifs, fichiers chauds)

- **Pas de champ `ItemInstance.craft`** : les qualités d'artisanat vivent dans le tableau plat `ItemInstance.qualities: string[]` (distinguées par `subType:'Objet'` dans le registre). Tout `QualityCarrier` (Weapon **ou** ItemInstance) passe dans les helpers de `dispatch.ts`.
- **`craftTestDRAdjust(carrier, success): number`** (`src/engine/qualities/dispatch.ts:76`) existe déjà : `return success ? 0 : Σ testFailDR`. Consommé **seulement** en combat (`combat.ts:298,300`). C2a le branche hors combat.
- Registre (`registry.ts`) : `Pratique testFailDR:+1`, `Peu Fiable testFailDR:-1`, `Bâclé` (Défaut, sans champ — la casse est un hook), `Laid`/`Volumineux` (hors C2a).
- `rollTest(skillValue, difficulty)` (`engine/tests.ts`) renvoie `{ roll, target, success, sl, isDouble }`. **`testRoll` jette `res.isDouble`** aujourd'hui.
- `ItemInstance` a `destroyed?: boolean` (« non équipable ») ; casse = `destroyed = true` (cf. `weaponDamage.ts:destroyWeapon`, respecte Incassable via `isUnbreakable`).
- `log(msg)` (`store.ts`) pousse dans `journal`. `Effect` : `{type:'setFlag'; flag; value?}`, `{type:'journal'; text}`.
- **RNG hors combat = non seedable** (cf. mémoire `game-roll-modal-pattern`) → les tests de `resolveTest` **injectent un `pendingTest` déterministe** via `setState` (pas de dépendance au dé).

## Décisions de conception (à valider en relecture)

1. **Référence outil par NOM** (`Effect.test.tool`), pas par uid : les uid d'objets sont générés au runtime, donc inauthorables en scène. Le handler résout `e.tool` → `best.actor.items.find(i => i.name === e.tool && !i.destroyed)?.uid` → `PendingTest.itemUid`. Si introuvable → `itemUid` undefined → aucun effet (dégradation propre).
2. **Pratique/Peu Fiable ne flippent que les Tests à seuil `requireSL > 0`** : un Test raté **au d100** (`roll > target`) reste raté (on ne transforme pas un dé raté en réussite) ; seul un Test qui a réussi le d100 mais manqué le seuil de DR peut être repêché par Pratique. RAW-cohérent et identique au comportement combat (`craftTestDRAdjust` ne s'applique qu'au jet raté).
3. **Périmètre C2a** : Pratique/Peu Fiable + Bâclé **hors combat** uniquement. **Hors périmètre** (plans suivants) : C2b pénalités de port d'armure (table FR LDB 63 à extraire), C2c `Laid` (−10 Soc) + `Volumineux` (porté=Enc 1, Fatigue ×2).

**Périmètre fichiers :** `src/state/scene.ts` (Effect.test +`tool`), `src/state/store.ts` (PendingTest +`itemUid`/`isDouble`, imports, `testRoll`/`testReroll`, `resolveTest`), `src/state/combatFlow.ts` (handler `case 'test'`), `src/ui/editor/EffectList.tsx` (champ outil), `src/state/store.test.ts` (tests).

---

## Task 1 : Schéma `tool`/`itemUid`/`isDouble` + threading dans le handler

**Files:**
- Modify: `src/state/scene.ts` (variant `test` du type `Effect`)
- Modify: `src/state/store.ts` (`PendingTest`)
- Modify: `src/state/combatFlow.ts` (`applyEffects` → `case 'test'`)
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Test qui échoue** — le handler résout `tool` (nom) → `pendingTest.itemUid`.

Ajouter dans `store.test.ts` (dans le `describe('Boucle de jeu (store)')`, importer `applyEffects` depuis `'./combatFlow'` en haut si absent) :

```ts
it('Effect.test : le nom d’outil est résolu vers pendingTest.itemUid (héros qui agit)', () => {
  const chars = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 55, Int: 30, FM: 30, Soc: 30 };
  const hero = {
    id: 'h1', name: 'Lest', kind: 'hero', characteristics: chars, wounds: { current: 10, max: 10 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [{ uid: 't1', name: 'Rossignols', kind: 'melee', qualities: ['Pratique'], enc: 0, equipped: false }],
  } as unknown as Combatant;
  useGame.setState({ party: [hero] });
  applyEffects(useGame.getState, useGame.setState, [
    { type: 'test', characteristic: 'Dex', tool: 'Rossignols', requireSL: 0, onSuccess: [], onFailure: [] },
  ]);
  const pt = useGame.getState().pendingTest!;
  expect(pt.itemUid).toBe('t1');
  expect(pt.isDouble).toBe(false); // amorcé à false (pas encore lancé)
});
```

- [ ] **Step 2 : Lancer le test → échoue** (champs/handler absents)

Run: `npx vitest run src/state/store.test.ts -t "résolu vers pendingTest.itemUid"`
Expected: FAIL (TS : `tool` inconnu sur Effect.test / `itemUid` absent de PendingTest).

- [ ] **Step 3 : Ajouter `tool` à `Effect.test`** (`scene.ts`, dans le variant `test`, après `label?: string;`)

```ts
      label?: string;
      /** Nom de l'objet/outil utilisé : sa qualité d'artisanat (Pratique/Peu Fiable/Bâclé) module le Test (Phase C2a). */
      tool?: string;
      onSuccess?: Effect[];
```

- [ ] **Step 4 : Ajouter `itemUid` + `isDouble` à `PendingTest`** (`store.ts`, après `target: number;`)

```ts
  target: number;
  /** Outil utilisé (uid résolu sur l'acteur) : sa qualité module l'issue/casse l'objet (Phase C2a). */
  itemUid?: string;
  /** Jet double (Maladresse si en plus c'est un échec) — pour casser un outil Bâclé. */
  isDouble?: boolean;
```

- [ ] **Step 5 : Threader `tool` → `itemUid` dans le handler** (`combatFlow.ts`, `case 'test'`)

Juste après `const best = partyBest(get().party, e.skill, e.characteristic);` et son `if (!best) break;`, ajouter la résolution, puis l'injecter dans l'objet `pendingTest` :

```ts
        const tool = e.tool ? best.actor.items?.find((i) => i.name === e.tool && !i.destroyed) : undefined;
```

et dans le littéral `pendingTest: { … }`, après `target,` :

```ts
            target,
            itemUid: tool?.uid,
            isDouble: false,
```

- [ ] **Step 6 : Lancer le test → passe**

Run: `npx vitest run src/state/store.test.ts -t "résolu vers pendingTest.itemUid"`
Expected: PASS.

- [ ] **Step 7 : Typecheck + commit**

Run: `npm run typecheck` → 0.
```bash
git commit -- src/state/scene.ts src/state/store.ts src/state/combatFlow.ts src/state/store.test.ts -m "feat(qualites): Effect.test.tool resolu vers pendingTest.itemUid (Phase C2a)"
```

---

## Task 2 : Capturer `isDouble` au lancer

**Files:** Modify `src/state/store.ts` (`testRoll`, `testReroll`) ; Test `src/state/store.test.ts`.

- [ ] **Step 1 : Test qui échoue** — après `testRoll`, le champ `isDouble` est peuplé (booléen).

```ts
it('testRoll peuple pendingTest.isDouble (booléen, pour la casse Bâclé)', () => {
  const hero = {
    id: 'h1', name: 'Lest', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 50, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  } as unknown as Combatant;
  useGame.setState({
    party: [hero],
    pendingTest: {
      actorId: 'h1', actorName: 'Lest', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
      requireSL: 0, target: 50, roll: null, success: false, sl: 0, isDouble: undefined,
      onSuccess: [], onFailure: [],
    },
  });
  useGame.getState().testRoll();
  expect(typeof useGame.getState().pendingTest!.isDouble).toBe('boolean');
});
```

- [ ] **Step 2 : Lancer → échoue** (`isDouble` reste `undefined`).

Run: `npx vitest run src/state/store.test.ts -t "peuple pendingTest.isDouble"`
Expected: FAIL (`typeof undefined === 'undefined'`).

- [ ] **Step 3 : Capturer `res.isDouble`** dans `testRoll` ET `testReroll`

`testRoll` — ajouter `isDouble: res.isDouble,` au `set` :
```ts
    set({ pendingTest: { ...pt, roll: res.roll, sl: res.sl, isDouble: res.isDouble, success: res.success && res.sl >= pt.requireSL } });
```
`testReroll` — idem dans son `set` (le 2e jet remplace le 1er) :
```ts
      pendingTest: { ...pt, roll: res.roll, sl: res.sl, isDouble: res.isDouble, success: res.success && res.sl >= pt.requireSL, rerolled: true },
```
*(`testBonusSL` ne relance pas le dé → `isDouble` inchangé, rien à faire.)*

- [ ] **Step 4 : Lancer → passe**

Run: `npx vitest run src/state/store.test.ts -t "peuple pendingTest.isDouble"`
Expected: PASS.

- [ ] **Step 5 : Typecheck + commit**

Run: `npm run typecheck` → 0.
```bash
git commit -- src/state/store.ts src/state/store.test.ts -m "feat(qualites): capture isDouble au lancer du Test hors combat (Phase C2a)"
```

---

## Task 3 : `resolveTest` — ±1 DR (Pratique/Peu Fiable) + casse Bâclé

**Files:** Modify `src/state/store.ts` (imports + `resolveTest`) ; Test `src/state/store.test.ts`.

- [ ] **Step 1 : 5 tests qui échouent** — comportement de `resolveTest` avec outil.

Helper + tests (les `pendingTest` sont injectés à la main → déterministes, sans RNG). `setFlag` dans les branches rend l'issue observable.

```ts
function mkToolTest(quality: string, over: Partial<import('./store').PendingTest>): Combatant {
  const hero = {
    id: 'h1', name: 'Lest', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 50, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [{ uid: 't1', name: 'Outil', kind: 'melee', qualities: quality ? [quality] : [], enc: 0, equipped: false }],
  } as unknown as Combatant;
  useGame.setState({
    party: [hero], flags: {}, journal: [],
    pendingTest: {
      actorId: 'h1', actorName: 'Lest', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
      requireSL: 1, target: 50, roll: 48, success: false, sl: 0, isDouble: false, itemUid: 't1',
      onSuccess: [{ type: 'setFlag', flag: 'reussi', value: true }],
      onFailure: [{ type: 'setFlag', flag: 'rate', value: true }],
      ...over,
    },
  });
  return hero;
}

it('resolveTest : Pratique (+1 DR) repêche un échec qui n’a manqué que le seuil requireSL', () => {
  mkToolTest('Pratique', {}); // roll 48 ≤ 50, sl 0 < requireSL 1 → +1 DR ⇒ sl 1 ≥ 1
  useGame.getState().resolveTest();
  expect(useGame.getState().flags['reussi']).toBe(true);
});

it('resolveTest : Pratique ne transforme PAS un d100 raté (roll > cible) en réussite', () => {
  mkToolTest('Pratique', { roll: 60, sl: -1, requireSL: 0 }); // roll 60 > 50 → raté au dé
  useGame.getState().resolveTest();
  expect(useGame.getState().flags['rate']).toBe(true);
});

it('resolveTest : Peu Fiable (−1 DR) ne repêche pas (échec aggravé)', () => {
  mkToolTest('Peu Fiable', {}); // sl 0 −1 = −1 < requireSL 1 → reste raté
  useGame.getState().resolveTest();
  expect(useGame.getState().flags['rate']).toBe(true);
});

it('resolveTest : outil Bâclé qui Maladresse (échec + double) se brise', () => {
  const hero = mkToolTest('Bâclé', { roll: 55, sl: -1, requireSL: 0, isDouble: true });
  useGame.getState().resolveTest();
  const item = useGame.getState().party[0].items!.find((i) => i.uid === 't1')!;
  expect(item.destroyed).toBe(true);
  expect(useGame.getState().journal.some((l) => l.includes('se brise'))).toBe(true);
  void hero;
});

it('resolveTest : sans outil, l’issue est inchangée (branche échec)', () => {
  mkToolTest('', { itemUid: undefined });
  useGame.getState().resolveTest();
  expect(useGame.getState().flags['rate']).toBe(true);
});
```

- [ ] **Step 2 : Lancer → échouent**

Run: `npx vitest run src/state/store.test.ts -t "resolveTest :"`
Expected: FAIL (l'issue n'est pas ajustée par l'outil ; l'outil Bâclé ne casse pas).

- [ ] **Step 3 : Imports dispatch** (`store.ts`, près des autres imports `../engine/…`)

```ts
import { craftTestDRAdjust, hasQuality, isUnbreakable } from '../engine/qualities/dispatch';
```

- [ ] **Step 4 : Réécrire `resolveTest`** (`store.ts`)

```ts
  /** Acquitte un test de compétence : applique la branche réussite/échec, modulée par l'outil. */
  resolveTest: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return; // pas d'acquittement avant le jet
    set({ pendingTest: null });
    const actor = get().party.find((c) => c.id === pt.actorId);
    const tool = pt.itemUid ? actor?.items?.find((i) => i.uid === pt.itemUid) : undefined;
    // Pratique/Peu Fiable : ±1 DR sur un Test RATÉ (LDB 60 l.59/88). Ne repêche qu'un échec qui a
    // réussi le d100 mais manqué le seuil requireSL (jamais un roll > cible → on ne crée pas une réussite).
    const drDelta = tool ? craftTestDRAdjust(tool, pt.success) : 0;
    const effSuccess = drDelta !== 0 ? pt.roll <= pt.target && pt.sl + drDelta >= pt.requireSL : pt.success;
    // Bâclé : un outil Bâclé qui Maladresse (échec + double) se brise (LDB 60, généralisé hors combat).
    if (tool && pt.isDouble && !pt.success && hasQuality(tool, 'Bâclé') && !isUnbreakable(tool)) {
      tool.destroyed = true;
      set({ party: [...get().party] }); // persiste la casse + re-render
      get().log(`${tool.name} (Bâclé) se brise sur la Maladresse de ${actor?.name ?? pt.actorName}.`);
    }
    const branch = effSuccess ? pt.onSuccess : pt.onFailure;
    if (branch && branch.length) applyEffects(get, set, branch);
  },
```

- [ ] **Step 5 : Lancer → passent**

Run: `npx vitest run src/state/store.test.ts -t "resolveTest :"`
Expected: PASS (5/5).

- [ ] **Step 6 : Typecheck + commit**

Run: `npm run typecheck` → 0.
```bash
git commit -- src/state/store.ts src/state/store.test.ts -m "feat(qualites): Pratique/Peu Fiable +/-1 DR + casse Bacle au Test hors combat (Phase C2a)"
```

---

## Task 4 : Éditeur — champ « Outil » sur l'effet `test`

**Files:** Modify `src/ui/editor/EffectList.tsx` (factory `case 'test'` + le bloc de rendu du test).

- [ ] **Step 1 : Lire le bloc actuel** du `test` dans `EffectList.tsx` (factory ~l.66, rendu ~l.150-172) pour caler l'edit sur le code courant (fichier potentiellement édité en //).

- [ ] **Step 2 : Ajouter un champ texte « Outil (nom) »** dans le rendu du `test`, à côté de l'entrée `DR≥`, qui met à jour `tool` :

```tsx
        <label className="ef-row">
          <span>Outil (nom)</span>
          <input
            type="text"
            value={(e as Extract<Effect, { type: 'test' }>).tool ?? ''}
            onChange={(ev) => update({ ...e, tool: ev.target.value || undefined })}
            placeholder="ex. Rossignols (qualité Pratique/Bâclé…)"
          />
        </label>
```
*(Adapter `update(...)` au nom réel du callback de mise à jour d'effet dans ce composant — repéré au Step 1.)*

- [ ] **Step 3 : Test de rendu** (`EffectList` existe-t-il déjà un test ? sinon, vérif manuelle) — a minima, `npm run typecheck` → 0, et l'éditeur charge sans erreur.

- [ ] **Step 4 : Commit**

```bash
git commit -- src/ui/editor/EffectList.tsx -m "feat(editeur): champ Outil sur l'effet Test (Phase C2a)"
```

---

## Task 5 : Vérification finale

- [ ] **Step 1 : Suite complète + typecheck**

Run: `npm test` (attendu : vert, incl. `golden-combat` inchangé — C2a ne touche pas la résolution de combat) ; `npm run typecheck` → 0.

- [ ] **Step 2 : Recette légère (optionnelle, si navigateur dispo)** — authoring d'un `Effect.test` avec `tool` dans un scénario, vérifier le repêchage Pratique / la casse Bâclé via le journal. *(Cœur logique déjà couvert par les tests store déterministes.)*

---

## Fin — suites (plans séparés)

- **C2b — Pénalités de port d'armure** : `TrappingData.wearPenalty` (table **FR LDB 63 l.73-95** à extraire+citer, « ne rien inventer ») appliquée aux Tests du porteur (`skills.ts:testValue` + `combat.ts:attackModifiers`) ; Pratique −1 niveau / Peu Fiable ×2 sur ces pénalités.
- **C2c — `Laid` (−10 Soc) + `Volumineux` (porté = Enc 1, Fatigue ×2)** : nouveau champ social sur `QualityDef` (aucun n'existe) consommé sur les Tests `Soc` du porteur ; ajustement encombrement porté.

## Self-review

- **Couverture spec §6.4 (sous-ensemble C2a)** : itemUid/`tool` (T1) ; isDouble (T2) ; Pratique/Peu Fiable ±1 DR + Bâclé hors combat (T3) ; authoring éditeur (T4) ; régression (T5). ✓ (port d'armure + Laid/Volumineux explicitement renvoyés à C2b/C2c.)
- **Pas de placeholder** : chaque step montre le code exact (champs, handler, `resolveTest`, 6 tests). ✓
- **Cohérence des types** : `tool` (Effect) → `itemUid`/`isDouble` (PendingTest) → lus dans `resolveTest` ; helper réutilisé `craftTestDRAdjust(carrier, success)` (signature existante, pas de nouvelle entrée de registre). ✓
- **Pièges** : RNG hors combat non seedable → `pendingTest` injecté (pas de dé) ; mutation `tool.destroyed` persistée via `set({ party })` ; Pratique ne flippe qu'un échec gated `requireSL` (jamais un d100 raté) ; `craftTestDRAdjust` renvoie 0 sur réussite → ne dégrade jamais une réussite. ✓
- **Risque résiduel** : fichiers chauds (`store.ts`/`combatFlow.ts`/`scene.ts`) en édition // → relire avant chaque edit, `git commit -- <chemins>` ciblé. `EffectList.tsx` (T4) : adapter au callback de mise à jour réel (Step 1).
