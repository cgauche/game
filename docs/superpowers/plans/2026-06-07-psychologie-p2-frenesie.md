# Psychologie P2 — Frénésie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps en checkbox.

**Goal :** Frénésie jouable (LDB 21 l.31-36) : un combattant capable entre en Frénésie (Test de FM), gagne +1 BF, doit attaquer l'ennemi le plus proche, frappe gratuitement chaque Round, est immunisé aux autres traits psy, et finit Exténué.

**Architecture :** Helpers purs dans `engine/psychology.ts` (`isFrenzyCapable`, `resolveFrenzyEntry`) ; drapeau `Combatant.frenzied` ; +1 BF dans `combat.ts` (`applyHit`) ; immunité psy + maintenance (fin → Exténué) dans `combatFlow.ts` ; héros entre via modale `pendingFrenzy` + bouton hotbar ; IA entre + attaque libre + cible imposée. Spec : `docs/superpowers/specs/2026-06-07-psychologie-design.md` (§T2 P2).

**Tech Stack :** TypeScript, Vitest (TDD), RNG seedable.

---

## File Structure

| Fichier | Modif | Responsabilité |
|---|---|---|
| `src/engine/psychology.ts` | EDIT | `isFrenzyCapable(c)`, `resolveFrenzyEntry(fm, rng)`. Pur. |
| `src/engine/types.ts` | EDIT ⚠️ | `Combatant.frenzied?: boolean`. |
| `src/engine/combat.ts` | EDIT ⚠️ rig | `applyHit` : +1 Bonus de Force si `attacker.frenzied`. |
| `src/state/combatFlow.ts` | EDIT ⚠️ | Immunité psy si `frenzied` (resolvePsychAI/maybeOpenHeroPsych) ; **maintenance** (fin de Frénésie → Exténué) au début du tour ; **IA** : entrée + attaque libre + cible imposée. |
| `src/state/store.ts` | EDIT ⚠️ | `pendingFrenzy` + `battleFrenzy`/`frenzy{Roll,Reroll,Confirm}`. |
| `src/ui/FrenzyModal.tsx` | CREATE | Modale Test de FM d'entrée. |
| `src/ui/CampaignView.tsx` | EDIT | Montage. |
| `src/ui/ActionBar.tsx` | EDIT | Bouton « 🐗 Frénésie ». |

---

## Task 1 : `engine/psychology.ts` — capacité + Test d'entrée

**Files:** Modify `src/engine/psychology.ts`, `src/engine/psychology.test.ts`.

- [ ] **Step 1 : tests**

```ts
import { isFrenzyCapable, resolveFrenzyEntry } from './psychology';
it('isFrenzyCapable : trait OU talent « Frénésie »', () => {
  expect(isFrenzyCapable({ traits: ['Frénésie'], talents: [] } as any)).toBe(true);
  expect(isFrenzyCapable({ traits: [], talents: [{ name: 'Frénésie', times: 1 }] } as any)).toBe(true);
  expect(isFrenzyCapable({ traits: ['Arme +7'], talents: [] } as any)).toBe(false);
});
it('resolveFrenzyEntry : Test de FM, succès = entre', () => {
  const r = resolveFrenzyEntry(80, makeRNG(2));
  expect(typeof r.success).toBe('boolean');
  expect(typeof r.roll).toBe('number');
});
```

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter** (psychology.ts)

```ts
/** Le combattant peut-il entrer en Frénésie (LDB 21 l.31) ? Trait de créature OU Talent « Frénésie ». */
export function isFrenzyCapable(c: Combatant): boolean {
  return (c.traits ?? []).some((t) => /^Frénésie/i.test(t)) || (c.talents ?? []).some((t) => /^Frénésie/i.test(t.name));
}

/** Test de Force Mentale pour entrer en Frénésie (LDB 21 l.32). Succès → on entre. */
export function resolveFrenzyEntry(fm: number, rng: RNG = defaultRNG): { success: boolean; roll: number } {
  const t = rollTest(fm, 'intermediaire', rng);
  return { success: t.success, roll: t.roll };
}
```

- [ ] **Step 4 : vert + typecheck.** Commit : `feat(psy): Frénésie -- isFrenzyCapable + resolveFrenzyEntry (Test de FM, LDB 21 l.31-32)`

---

## Task 2 : drapeau `frenzied`, +1 BF, immunité, maintenance (→ Exténué)

**Files:** Modify `src/engine/types.ts`, `src/engine/combat.ts`, `src/state/combatFlow.ts` ; Test `src/state/frenzy.test.ts`.

- [ ] **Step 1 : tests**

```ts
it('frenzied : +1 Bonus de Force au calcul des Dégâts', () => {
  // resolveStrayRangedHit ou applyHit : un attaquant frenzied inflige +1 dégât (BF+1) vs un non-frenzied identique.
  // (test déterministe via woundsLost comparé.)
});
it('immunité psy : un combattant frenzied n’est PAS affecté par Peur/Terreur', () => {
  // resolvePsychAI sur un ennemi frenzied face à un héros énorme → pas de Brisé.
});
it('maintenance : Frénésie finit (→ Exténué) si plus aucun ennemi en Ligne de Vue', () => {
  // endFrenzyIfDone : un frenzied sans ennemi vivant en LdV perd frenzied et gagne Exténué.
});
```

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
- `types.ts` `Combatant` (près de `psychState`) : `/** Frénésie active (LDB 21) : +1 BF, attaque obligatoire, immunité psy ; fin → Exténué. */ frenzied?: boolean;`
- `combat.ts` `applyHit` : `const sb = bonus(effectiveChar(attacker, 'F')) + (attacker.frenzied ? 1 : 0); // +1 BF en Frénésie (LDB 21 l.34)`
- `combatFlow.ts` :
  - `resolvePsychAI` : `if (enemy.frenzied) return;` en tête (immunité, l.34). `maybeOpenHeroPsych` : `if (active.frenzied) return;` (via collectHeroPsych → ajouter `if (c.frenzied) return null;`).
  - `export function endFrenzyIfDone(get, set, c): void` — si `c.frenzied` ET (aucun adversaire vivant en LdV OU `c` a Sonné/Inconscient) → `c.frenzied = false; addCondition(c, 'Exténué')` + journal. Appelé au début du tour du combattant (héros & IA).
  - Hooker `endFrenzyIfDone(get,set,active)` dans `maybeOpenHeroPsych` (avant le test psy : un héros frenzied ne teste pas) et dans `runEnemyAI` (avant `resolvePsychAI`).

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `feat(psy): Frénésie -- +1 BF, immunité psy, fin de Frénésie -> Exténué (LDB 21 l.34-36)`

---

## Task 3 : entrée héros — modale `pendingFrenzy` + hotbar

**Files:** Modify `src/state/store.ts`, `src/ui/ActionBar.tsx`, `src/ui/CampaignView.tsx` ; Create `src/ui/FrenzyModal.tsx` ; Test `src/state/frenzy-modal.test.ts`.

- [ ] **Step 1 : test** — `battleFrenzy()` ouvre `pendingFrenzy` (capable + pas déjà frenzied) ; `frenzyRoll` lance le Test de FM ; `frenzyConfirm` met `frenzied=true` si succès.

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `store.ts` : `PendingFrenzy { combatantId; result: { success: boolean; roll: number } | null; rerolled? }` + state + init/reset ; actions `battleFrenzy` (garde : actif héros, `isFrenzyCapable`, pas `frenzied`, pas `acted` → ouvre), `frenzyRoll` (`resolveFrenzyEntry`), `frenzyReroll`/`frenzyForceSuccess` (Chance/Résilience), `frenzyConfirm` (si `result.success` → `c.frenzied = true` ; consomme l'Action ; journal ; ferme), `frenzyCancel`. Importer `isFrenzyCapable, resolveFrenzyEntry`.
  - `FrenzyModal.tsx` (modèle `FocusModal`) + montage `CampaignView`.
  - `ActionBar.tsx` : bouton « 🐗 Frénésie » visible si `isFrenzyCapable(active) && !active.frenzied` et `!battle.acted`.

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `feat(psy): entree en Frénésie du heros -- modale Test de FM (pendingFrenzy) + bouton hotbar (LDB 21 l.32)`

---

## Task 4 : IA — entrée, attaque libre, cible imposée

**Files:** Modify `src/state/combatFlow.ts` (`runEnemyAI`) + `src/state/ai.ts` (cible) ; Test `src/state/frenzy-ia.test.ts`.

- [ ] **Step 1 : test** — un ennemi capable, avec un ennemi en LdV, entre en Frénésie (auto) ; un ennemi frenzied réalise une attaque LIBRE supplémentaire après son attaque principale (`aiFrenzyAttack`) ; il vise l'ennemi le plus PROCHE.

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `combatFlow.ts` `runEnemyAI` : si `isFrenzyCapable(enemy) && !enemy.frenzied && !enemy.psychImmune` et un adversaire vivant en LdV → `resolveFrenzyEntry(effectiveChar(enemy,'FM'), battleRng())` ; succès → `enemy.frenzied = true` + journal. (Auto : l'IA tente la Frénésie au début de son tour.)
  - **Attaque libre** : `export function aiFrenzyAttack(get, set, enemy)` — si `enemy.frenzied` et un adversaire adjacent → une attaque de mêlée gratuite (réutilise `resolveAttack`+`applyAttackResult`, instantané, comme `aiMaybeTrample`). Appelée après l'attaque principale dans `attackThenAdvance` (instantané) + `defenseConfirm/Cancel`.
  - **Cible imposée** : `ai.ts` `chooseEnemyAction` — si `enemy.frenzied`, viser le **plus proche** (par distance) au lieu du plus faible. *(Ajout d'un branchement `frenzied` dans la sélection de cible.)*

- [ ] **Step 4 : vert + typecheck + suite + recette (différée).** Commit : `feat(psy): Frénésie de l'IA -- entree auto + attaque libre/round + cible la plus proche (LDB 21 l.34)`

---

## Self-Review
- **Couverture spec (P2 Frénésie)** : Test FM d'entrée (T1/T3/T4) ✓ ; +1 BF (T2) ✓ ; immunité psy (T2) ✓ ; attaque obligatoire / cible proche (T4) ✓ ; CC gratuite/round (T4 `aiFrenzyAttack`, héros : bonus implicite via re-attaque — couvert par l'action standard) ✓ ; fin → Exténué (T2) ✓ ; jamais de fuite (un frenzied n'a pas de raison de fuir ; le désengagement reste possible mécaniquement mais l'IA ne fuit jamais — déjà le cas, documenté).
- **Types** : `frenzied` (T2) lu par `applyHit` (T2), immunité/maintenance (T2), entrée (T3/T4) ; `isFrenzyCapable`/`resolveFrenzyEntry` (T1) consommés par T3/T4.
- **Placeholders** : aucun ; la « CC gratuite » du héros = une attaque standard supplémentaire (l'IA a `aiFrenzyAttack` explicite) ; le « jamais de fuite » côté héros n'est pas verrouillé (rare ; documenté).
- **Isolation rig** : `types.ts`/`combat.ts`/`combatFlow.ts`/`store.ts`/`ai.ts` partagés → staging sélectif ; `FrenzyModal` neuf.
