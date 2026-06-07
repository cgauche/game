# « Un jet = une modale » exhaustif + garde-fou — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, choisi par l'utilisateur). Steps en checkbox.

**Goal :** Aucun jet aléatoire pertinent pour le joueur ne se résout en silence ; un test statique empêche la régression.

**Architecture :** Modales différées interactives (`pending*` data-only + Chance) pour les jets que le héros LANCE (Piétinement, Focalisation) ; **file de révélation** témoin unifiée (`pendingReveals: RevealEntry[]` + `RevealModal`, post-hoc, sans Chance) pour les jets SUBIS/sur table (Colère, Fuite, puis Critique/Assommante/entretien). Garde-fou : test statique qui scanne les actions du store. Spec : `docs/superpowers/specs/2026-06-07-jets-modale-exhaustif-design.md`.

**Tech Stack :** TypeScript, Vitest (TDD), Zustand, RNG seedable (`battleRng`/`seedBattleRng`).

---

## File Structure

| Fichier | Modif | Responsabilité |
|---|---|---|
| `src/state/roll-modal-invariant.test.ts` | CREATE | Garde-fou statique : aucune action store non-whitelistée ne résout un jet en ligne. |
| `src/state/store.ts` | EDIT ⚠️ partagé | États `pendingTrample`/`pendingFocus`/`pendingReveals` + actions (Roll/Reroll/BonusSL/ForceSuccess/Confirm/Cancel + dismissReveal). Refacto `battleTrample`/`battleFocusSpell`/`disengageFlee`. |
| `src/state/combatFlow.ts` | EDIT ⚠️ partagé | `applyMiscast` pousse une révélation (Colère) ; (Lot B) `applyAttackResult` pousse Critique/Assommante ; `advanceTurn`/`maybeRunEnemyTurn` gèlent sur `pendingReveals` (Lot B). |
| `src/ui/TrampleModal.tsx` | CREATE | Modale interactive Piétinement. |
| `src/ui/FocusModal.tsx` | CREATE | Modale interactive Focalisation. |
| `src/ui/RevealModal.tsx` | CREATE | Modale témoin unique (file). |
| `src/ui/CampaignView.tsx` | EDIT | Montage des 3 modales. |
| `src/ui/ActionBar.tsx` | EDIT | (déjà) bouton Piétiner ouvre la modale via `battleTrample`. |
| `src/state/{trample,focus,miscast,flee,reveal}.test.ts` | CREATE | Tests comportementaux par jet. |

---

# LOT A — garde-fou + jets héros/conséquences (pushé)

## Task 1 : Garde-fou statique (whitelist temporaire des violations actuelles)

**Files:** Create `src/state/roll-modal-invariant.test.ts`.

- [ ] **Step 1 : écrire le test** (lit le texte de `store.ts`, extrait les actions, flague les primitives en ligne)

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STORE = readFileSync(fileURLToPath(new URL('./store.ts', import.meta.url)), 'utf8');

// Primitives de résolution : un appel direct dans une action = résolution en ligne (jet muet).
const PRIMITIVES = [
  'battleRng(', 'rollTest(', 'rollOups(', 'rollMiscast(', 'rollCritical(',
  'resolveTrample(', 'resolveFocus(', 'resolveBackstabAttack(', 'resolveMelee(',
  'resolveRanged(', 'resolveCasting(', 'resolveMagicMissile(', 'opposedTest(',
  'applyAttackResult(', 'applyTrample(', 'applyMiscast(', 'focusSpell(',
];
// Actions AUTORISÉES à résoudre (les étapes « Lancer/Appliquer » d'une modale) : par convention de
// suffixe + extras explicites.
const RESOLVER = /(Roll|Reroll|BonusSL|ForceSuccess|Confirm|Cancel)$/;
const EXTRA_OK = new Set(['resolveTest', 'disengageConfirmA', 'disengageFlee', 'dismissReveal']);
// Dette temporaire (Lot A en cours) — à VIDER au fil des tâches.
const TODO_LOT_A = new Set(['battleTrample', 'battleFocusSpell']);

/** Extrait les blocs `name: (args) => { ... }` ou `name: (args) => expr,` du store (corps direct). */
function storeActions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /^  (\w+):\s*\([^)]*\)\s*=>\s*(\{)?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (m[2]) {
      // corps en bloc : équilibre des accolades
      let depth = 1, i = re.lastIndex;
      while (i < src.length && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
      out.push({ name, body: src.slice(re.lastIndex, i) });
    } else {
      out.push({ name, body: src.slice(re.lastIndex, src.indexOf('\n', re.lastIndex)) });
    }
  }
  return out;
}

describe('Invariante « un jet = une modale » — aucune action ne résout en ligne', () => {
  const actions = storeActions(STORE);

  it('extrait un nombre plausible d’actions du store', () => {
    expect(actions.length).toBeGreaterThan(30);
  });

  for (const { name, body } of storeActions(STORE)) {
    const offenders = PRIMITIVES.filter((p) => body.includes(p));
    const allowed = RESOLVER.test(name) || EXTRA_OK.has(name) || TODO_LOT_A.has(name);
    it(`${name} ne résout pas de jet en ligne`, () => {
      if (allowed) return; // whitelisté (résolveur légitime ou dette TODO)
      expect(offenders, `${name} appelle ${offenders.join(', ')} — ouvre une modale pending* au lieu de résoudre en ligne`).toEqual([]);
    });
  }
});
```

- [ ] **Step 2 : lancer → vert** (les violations actuelles `battleTrample`/`battleFocusSpell` sont dans `TODO_LOT_A` ; `disengageFlee` est dans `EXTRA_OK`). `npx vitest run src/state/roll-modal-invariant.test.ts`.

- [ ] **Step 3 : commit** — `git commit -m "test(modale): garde-fou statique 'un jet = une modale' (dette Lot A whitelistee)" -- src/state/roll-modal-invariant.test.ts`

---

## Task 2 : File de révélation (infrastructure témoin)

**Files:** Modify `store.ts` (`pendingReveals`, `dismissReveal`) ; Create `src/ui/RevealModal.tsx`, `src/ui/CampaignView.tsx` (montage), `src/state/reveal.test.ts`.

- [ ] **Step 1 : test** (`reveal.test.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
beforeEach(() => useGame.setState({ pendingReveals: [] }));
it('dismissReveal dépile la tête de la file', () => {
  useGame.setState({ pendingReveals: [
    { kind: 'miscast', title: 'A', dice: 11, lines: ['x'] },
    { kind: 'critical', title: 'B', lines: ['y'] },
  ] });
  useGame.getState().dismissReveal();
  expect(useGame.getState().pendingReveals.map((r) => r.title)).toEqual(['B']);
  useGame.getState().dismissReveal();
  expect(useGame.getState().pendingReveals).toEqual([]);
  useGame.getState().dismissReveal(); // no-op sur file vide
  expect(useGame.getState().pendingReveals).toEqual([]);
});
```

- [ ] **Step 2 : échec** (type/action absents).

- [ ] **Step 3 : implémenter** dans `store.ts` :
  - Type : `export interface RevealEntry { kind: 'miscast' | 'critical' | 'assommante' | 'backstab' | 'calme' | 'round'; title: string; dice?: number; lines: string[]; }`
  - `GameState` : `pendingReveals: RevealEntry[];` + signature `dismissReveal: () => void;`
  - État initial : `pendingReveals: [],` (et dans les resets de transition/startCombat).
  - Action : `dismissReveal: () => set((s) => ({ pendingReveals: s.pendingReveals.slice(1) })),`
  - Helper export pour les producteurs : `export function pushReveal(set: any, entry: RevealEntry) { set((s: GameState) => ({ pendingReveals: [...s.pendingReveals, entry] })); }` *(placé près des autres helpers ; utilisé par combatFlow)*.
  - `RevealModal.tsx` : affiche `pendingReveals[0]` (titre + dé `dice` si présent + `lines`), bouton **Continuer** → `dismissReveal`. Modèle = `FumbleModalView` (classe `.test-modal`, `.dice`, `.test-result`).
  - `CampaignView.tsx` : importer + monter `<RevealModal />` AVANT les autres (priorité haute).

- [ ] **Step 4 : vert + typecheck.** Commit : `git commit -m "feat(modale): file de revelation temoin (pendingReveals + RevealModal + dismissReveal)" -- src/state/store.ts src/ui/RevealModal.tsx src/ui/CampaignView.tsx src/state/reveal.test.ts`

---

## Task 3 : Piétinement — modale interactive (`pendingTrample`)

**Files:** Modify `store.ts` ; Create `src/ui/TrampleModal.tsx`, `src/state/trample-modal.test.ts`. Retirer `battleTrample` de `TODO_LOT_A`.

- [ ] **Step 1 : test** (`trample-modal.test.ts`)

```ts
// setup : héros 'grande' adjacent à un ennemi 'moyenne', advantage 2, action 'trample'.
it('battleTrample ouvre pendingTrample SANS tirer ; trampleRoll tire ; trampleConfirm applique (gratuit, -1 Avantage)', () => {
  // ... setup via startCombat enc-mutants (cf. trample.test.ts existant) ...
  useGame.getState().seedRng(2);
  useGame.getState().battleTrample(E.id);
  expect(useGame.getState().pendingTrample).toBeTruthy();
  expect(useGame.getState().pendingTrample!.result).toBeNull(); // pas encore lancé
  useGame.getState().trampleRoll();
  expect(useGame.getState().pendingTrample!.result).toBeTruthy(); // jet figé
  const before = /* PB de E */ 0;
  useGame.getState().trampleConfirm();
  expect(useGame.getState().pendingTrample).toBeNull();
  // E a perdu des PB (si touche) ; acted reste false (gratuit) ; advantage du héros = 2 -1 (+1 si touche)
});
```

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `PendingTrample { attackerId: string; targetId: string; result: AttackResult | null; rerolled?: boolean }` + `pendingTrample` dans GameState + init/reset null.
  - `battleTrample(targetId)` (REMPLACE l'instantané) : garde (hero, advantage≥1, `trampleTarget` valide) → `set({ pendingTrample: { attackerId: active.id, targetId, result: null }, battle: { ...battle, action: null } })`. **N'appelle plus `applyTrample`.**
  - `trampleRoll()` : `result == null` → `resolveTrample(attacker, target, battleRng())` → set result.
  - `trampleReroll()`/`trampleBonusSL()`/`trampleForceSuccess()` : modèle `attackReroll`/`attackBonusSL`/`attackForceSuccess` mais via `resolveTrample` (Reroll relance ; BonusSL/ForceSuccess re-dérivent le résultat avec +1 DR / réussite forcée — réutiliser le helper si simple, sinon Reroll seul + commentaire).
  - `trampleConfirm()` : `attacker.advantage = Math.max(0, attacker.advantage - 1)` ; `applyAttackResult(get, set, attacker, target, TRAMPLE_WEAPON, result)` ; restaurer `acted` (action gratuite) ; `set({ pendingTrample: null })`.
  - `trampleCancel()` : `set({ pendingTrample: null })`.
  - Exporter `TRAMPLE_WEAPON` est déjà fait (combatFlow).
  - `TrampleModal.tsx` : modèle `RollModal`/`DisengageModal` (Lancer → résultat dé + log → `ChanceButtons` → Appliquer / Annuler).
  - `CampaignView.tsx` : monter `<TrampleModal />`.
  - `roll-modal-invariant.test.ts` : retirer `'battleTrample'` de `TODO_LOT_A`.

- [ ] **Step 4 : vert (trample-modal + garde-fou + suite) + typecheck.** Commit (hunks sélectifs store.ts) : `feat(modale): Pietinement en modale differee (pendingTrample, Lancer/Chance/Appliquer)`.

---

## Task 4 : Focalisation — modale interactive (`pendingFocus`)

**Files:** Modify `store.ts` ; Create `src/ui/FocusModal.tsx`, `src/state/focus-modal.test.ts`. Retirer `battleFocusSpell` de `TODO_LOT_A`. Supprimer/replier `focusSpell` (combatFlow).

- [ ] **Step 1 : test** — `battleFocusSpell(label)` ouvre `pendingFocus` (result null) ; `focusRoll()` tire (`resolveFocus`) ; `focusConfirm()` cumule le DR sur `caster.focus` + consomme l'Action.

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `PendingFocus { casterId: string; spellLabel: string; result: FocusResult | null; rerolled?: boolean }` + state + init/reset.
  - `battleFocusSpell(label)` (REMPLACE) : garde (hero, !acted, sort Arcane focalisable) → `set({ pendingFocus: { casterId: active.id, spellLabel: label, result: null } })`. **N'appelle plus `focusSpell`.**
  - `focusRoll()` : `resolveFocus(caster, spell, battleRng())` → set result.
  - `focusReroll()`/`focusBonusSL()` : Chance (modèle attaque), via `resolveFocus`.
  - `focusConfirm()` : `const prev = caster.focus?.spell === label ? caster.focus.dr : 0; caster.focus = { spell: label, dr: prev + result.dr };` ; log NI atteint/partiel ; **si `result.isFumble`** → `applyMiscast(get, set, caster, 'majeure')` (qui pousse la révélation, cf. Task 5) ; `set({ battle: { ...battle, acted: true, action: null, selectedSpell: null }, pendingFocus: null })` ; `checkBattleOver`.
  - `focusCancel()` : `set({ pendingFocus: null })`.
  - Supprimer `focusSpell` de combatFlow (et son export/import dans store) — son rôle est repris par `battleFocusSpell`+`focusRoll`+`focusConfirm`.
  - `FocusModal.tsx` (modèle RollModal) + montage CampaignView.
  - Garde-fou : retirer `'battleFocusSpell'` de `TODO_LOT_A` ; retirer `'focusSpell('` des PRIMITIVES devient inutile (fonction supprimée) — laisser, inoffensif.

- [ ] **Step 4 : vert + typecheck.** Commit (hunks sélectifs) : `feat(modale): Focalisation en modale differee (pendingFocus) ; retrait du focusSpell instantane`.

---

## Task 5 : Colère des dieux / Incantation Imparfaite → révélation

**Files:** Modify `combatFlow.ts` (`applyMiscast` pousse une révélation) + sites d'appel ; Test `src/state/miscast.test.ts`.

- [ ] **Step 1 : test** — un Sort/Prière d'un HÉROS en Maladresse pousse une `RevealEntry` (kind 'miscast') ET applique les effets (Blessures ignorant BE+PA / États). Un ennemi : pas de révélation (instantané).

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `applyMiscast` : signature `(get, set, caster, severity, sinPoints=0): string[]`. Après le tirage `m = rollMiscast(...)` et l'application des effets, si `caster.kind === 'hero'` : `pushReveal(set, { kind: 'miscast', title: severity === 'colere' ? 'Colère des dieux' : 'Incantation Imparfaite', dice: m.roll, lines: [m.log, ...effetsJournalisés] })`. Retourne les lignes (inchangé pour le log).
  - Mettre à jour les appels : `applyCast` (Prière→'colere', Sort→'mineure'), `focusConfirm` (→'majeure'), `applyMiscast` dans le projectile — passer `(get, set, ...)`.
  - `rollMiscast` expose-t-il `roll` ? Si non, l'ajouter au retour (`MiscastResult.roll`). Vérifier `engine/miscast.ts`.

- [ ] **Step 4 : vert + typecheck.** Commit : `feat(modale): Colere des dieux / Incantation Imparfaite revelee (file temoin)`.

---

## Task 6 : Fuite — coup dans le dos + Test de Calme → révélations  ⇒ FIN LOT A → PUSH

**Files:** Modify `store.ts` (`disengageFlee` pousse 2 révélations) ; Test `src/state/flee.test.ts`.

- [ ] **Step 1 : test** — `disengageFlee` pousse une révélation « coup dans le dos » (dé) et, si touché, une « Test de Calme » (dé, État Brisé éventuel) ; effets appliqués.

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter** — dans `disengageFlee`, après `resolveBackstabAttack` : `pushReveal(set, { kind: 'backstab', title: 'Fuite — coup dans le dos', dice: res.attackerRoll, lines: [res.log] })` ; et après le `rollTest(calme…)` : `pushReveal(set, { kind: 'calme', title: 'Test de Calme', dice: ct.roll, lines: [ct.success ? 'Sang-froid gardé.' : \`Panique : \${broken} Brisé.\`] })`. (`disengageFlee` reste whitelisté `EXTRA_OK` : il résout-et-révèle délibérément.)

- [ ] **Step 4 : vert + typecheck + suite complète.** Commit : `feat(modale): Fuite -- coup dans le dos + Test de Calme reveles (file temoin)`.
- [ ] **Step 5 : recette navigateur LOT A** (Playwright/Chrome, différable) puis **`git push`**.

---

# LOT B — conséquences d'attaque + entretien (enchaîné)

## Task 7 : Coup Critique + Assommante → révélation (+ gel IA)

**Files:** Modify `combatFlow.ts` (`applyAttackResult`/`applyCriticalToTarget` poussent ; `advanceTurn`/`maybeRunEnemyTurn`/`resumeEnemyTurn` gèlent sur `pendingReveals`) + `store.ts` (`dismissReveal` reprend l'IA). Test `src/state/reveal-combat.test.ts`.

- [ ] **Step 1 : test** — une attaque qui inflige un Critique pousse une `RevealEntry` (kind 'critical', dé de localisation/critique) ; idem Assommante. `dismissReveal` reprend l'IA quand la file se vide.
- [ ] **Step 2 : échec.**
- [ ] **Step 3 : implémenter**
  - `applyCriticalToTarget(target, loc, isCoupCritique, overkill, log)` : ajouter `set` (ou retourner les infos) pour `pushReveal(set, { kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines: [crit.log, ...] })`. (Vérifier que `rollCritical` expose le `roll` ; sinon l'ajouter.)
  - Assommante (dans `applyAttackResult`) : sur le Test opposé, `pushReveal(set, { kind: 'assommante', title: 'Assommante', lines: [\`\${target.name} est Sonné.\`] })` si Sonné infligé.
  - **Gel IA** : `advanceTurn`, `maybeRunEnemyTurn`, `resumeEnemyTurn`, `resolveRoundBoundary` : ajouter `|| get().pendingReveals.length` à la garde de sortie. `dismissReveal` : quand la file se vide ET un combat est en cours avec l'IA active → `setTimeout(() => advanceTurn(get, set), 0)` (reprise). *(Conserver le comportement héros : si c'est le tour du héros, ne pas avancer.)*
- [ ] **Step 4 : vert + typecheck + suite.** Commit : `feat(modale): Coup Critique + Assommante reveles ; gel de l'IA sur la file de revelation`.

## Task 8 : Entretien de Round groupé (initiative + hémorragie + mort)

**Files:** Modify `combatFlow.ts` (`advanceTurn` franchissement de Round pousse UNE révélation bilan) + `store.ts` (`startCombat` pousse l'initiative). Test `src/state/upkeep-reveal.test.ts`.

- [ ] **Step 1 : test** — un franchissement de Round avec un combattant Hémorragique pousse UNE `RevealEntry` (kind 'round') listant les jets d'entretien ; le début de combat pousse une révélation « Initiative ».
- [ ] **Step 2 : échec.**
- [ ] **Step 3 : implémenter** — collecter les lignes de `endOfRound`/`tickDeath` (déjà journalisées) dans une seule `RevealEntry { kind: 'round', title: 'Fin de Round — N', lines }` poussée si non vide. `startCombat` : après le tirage d'initiative, `pushReveal(set, { kind: 'round', title: 'Initiative', lines: ordreInitiative })`.
- [ ] **Step 4 : vert + typecheck + suite.** Commit : `feat(modale): entretien de Round groupe (initiative + hemorragie + mort) en revelation`.
- [ ] **Step 5 :** mettre à jour la ROADMAP (Jalon dédié « Jets en modale exhaustifs » livré) ; `git push`.

---

## Self-Review
- **Couverture spec** : interactif (Piétinement T3 ✓, Focalisation T4 ✓) ; témoin (Colère T5 ✓, Fuite T6 ✓, Critique/Assommante T7 ✓, entretien T8 ✓) ; file de révélation (T2 ✓) ; garde-fou statique (T1 ✓, resserré T3/T4). Gel IA (T7 ✓).
- **Types cohérents** : `RevealEntry`/`pushReveal` (T2) consommés par T5-T8 ; `PendingTrample`/`PendingFocus` (T3/T4) ; `FocusResult` (existant) ; `MiscastResult.roll`/`crit.roll` à vérifier (T5/T7, ajouter si absent).
- **Placeholders** : aucun bloquant ; BonusSL/ForceSuccess de Piétinement/Focalisation = « modèle attaque » (re-dérivation), Reroll suffit au minimum vital (commenté).
- **Isolation rig** : `store.ts`/`combatFlow.ts` partagés → staging sélectif de hunks ; modales = fichiers neufs.
- **Push** : après Lot A (T6) puis après Lot B (T8).
