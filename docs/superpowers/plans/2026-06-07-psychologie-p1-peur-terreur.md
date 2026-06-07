# Psychologie P1 — Peur / Terreur (+ Taille T5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps en checkbox.

**Goal :** Peur (Indice) et Terreur (Indice) jouables au combat, déclenchées par la Taille (T5) et par le statbloc, avec Test de Calme en modale (héros) / instantané (IA), État Brisé, −1 DR, Immunité Psychologie.

**Architecture :** Cœur pur `engine/psychology.ts` (types + parsing + déclenchement + résolution) ; champs `Combatant` + dérivation au spawn ; orchestration au début du tour d'un combattant dans `combatFlow` (héros → modale `pendingPsych` façon `pendingFocus` ; IA → instantané + révélation) ; −1 DR via `attackModifiers`. Spec : `docs/superpowers/specs/2026-06-07-psychologie-design.md`.

**Tech Stack :** TypeScript, Vitest (TDD), RNG seedable. Source : `21 - Psychologie.md` + `85` (Taille).

---

## File Structure

| Fichier | Modif | Responsabilité |
|---|---|---|
| `src/engine/psychology.ts` | CREATE | Pur : `PsychType`/`PsychTrait`, `parsePsychTraits`, `peurTerreurFromSize`, `psychSourcesInLoS`, `resolvePeurTest`, `resolveTerreurTest`, `calmeValue`. |
| `src/engine/psychology.test.ts` | CREATE | Tests purs. |
| `src/engine/types.ts` | EDIT ⚠️ partagé | `Combatant` : `causesPeur?`, `causesTerreur?`, `psychImmune?`, `psychState?` (+ `groups?`/`psychTraits?` posés pour P3). |
| `src/state/spawn.ts` | EDIT | Dérive `causesPeur/Terreur/psychImmune` (parse traits + surcharge statbloc). |
| `src/engine/combat.ts` | EDIT ⚠️ rig | `attackModifiers` : −10 (−1 DR) si l'attaquant a une Peur dont la source = la cible. |
| `src/state/combatFlow.ts` | EDIT ⚠️ partagé | Évaluation psy au début du tour : IA instantané (Brisé + révélation) ; héros → ouvre `pendingPsych`. |
| `src/state/store.ts` | EDIT ⚠️ partagé | `pendingPsych` + actions (`psychRoll/Reroll/BonusSL/ForceSuccess/Confirm`) ; gèle les actions héros. |
| `src/ui/PsychModal.tsx` | CREATE | Modale Test de Calme (étendu pour Peur). |
| `src/ui/CampaignView.tsx` | EDIT | Montage `<PsychModal/>`. |
| `src/state/roll-modal-invariant.test.ts` | EDIT | Whitelist des résolveurs `psych*`. |

---

## Task 1 : `engine/psychology.ts` — cœur pur

**Files:** Create `src/engine/psychology.ts`, `src/engine/psychology.test.ts`.

- [ ] **Step 1 : tests** (`psychology.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { parsePsychTraits, peurTerreurFromSize, resolvePeurTest, resolveTerreurTest } from './psychology';
import { makeRNG } from './dice';

describe('Psychologie (pur)', () => {
  it('parsePsychTraits : « Peur N » / « Terreur N » / Immunité', () => {
    expect(parsePsychTraits(['Peur 4', 'Arme +7'])).toEqual({ causesPeur: 4 });
    expect(parsePsychTraits(['Terreur 3'])).toEqual({ causesTerreur: 3 });
    expect(parsePsychTraits(['Immunité (Psychologie)'])).toEqual({ psychImmune: true });
    expect(parsePsychTraits(['Arme +7'])).toEqual({});
  });
  it('peurTerreurFromSize : écart ≥1 → Peur ; ≥2 → Terreur (Indice = écart)', () => {
    expect(peurTerreurFromSize('grande', 'moyenne')).toEqual({ kind: 'peur', indice: 1 });
    expect(peurTerreurFromSize('enorme', 'moyenne')).toEqual({ kind: 'terreur', indice: 2 });
    expect(peurTerreurFromSize('moyenne', 'moyenne')).toBeNull();
    expect(peurTerreurFromSize('petite', 'grande')).toBeNull(); // plus petit ne fait pas peur
  });
  it('resolvePeurTest : cumule le DR jusqu’à l’Indice (vaincue)', () => {
    const r = resolvePeurTest(80, 2, 0, makeRNG(2)); // FM 80 → réussite probable
    expect(r.dr).toBeGreaterThanOrEqual(0);
    expect(typeof r.calmeDR).toBe('number');
    expect(typeof r.vaincue).toBe('boolean');
    expect(r.calmeDR >= 2).toBe(r.vaincue); // vaincue ⟺ DR cumulé ≥ Indice
  });
  it('resolveTerreurTest : échec → Brisé = Indice + |DR négatifs|, puis Peur', () => {
    const r = resolveTerreurTest(1, 3, makeRNG(2)); // FM 1 → échec quasi sûr
    if (!r.success) expect(r.brise).toBeGreaterThanOrEqual(3);
    expect(r.devientPeur).toBe(3); // la Terreur devient Peur(Indice)
  });
});
```

- [ ] **Step 2 : lancer → échec** — `npx vitest run src/engine/psychology.test.ts`.

- [ ] **Step 3 : implémenter** `src/engine/psychology.ts`

```ts
/**
 * Psychologie WFRP4 (LDB `21 - Psychologie.md`). Cœur PUR : déclenchement et résolution des Tests
 * de Calme/Psychologie. Sans MJ : difficulté par défaut Intermédiaire (+0). P1 = Peur/Terreur.
 */
import { Combatant } from './types';
import { RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { effectiveChar } from './characteristics';
import { SizeCategory, sizeGap } from './size';

export type PsychType = 'peur' | 'terreur' | 'frenesie' | 'animosite' | 'haine' | 'prejuge' | 'amour' | 'camaraderie' | 'phobie' | 'trauma';
export interface PsychTrait { type: PsychType; cible?: string; indice?: number; }

/** Affliction psychologique ACTIVE en combat (posée après un Test raté). */
export interface PsychAffliction { type: PsychType; sourceId?: string; cible?: string; calmeDR?: number; }

/** Parse les traits de données (`creatures.json`) en propriétés psy. P1 : Peur/Terreur/Immunité. */
export function parsePsychTraits(traits: string[]): { causesPeur?: number; causesTerreur?: number; psychImmune?: boolean } {
  const out: { causesPeur?: number; causesTerreur?: number; psychImmune?: boolean } = {};
  for (const t of traits) {
    const peur = t.match(/^Peur\s+(\d+)/i);
    const terreur = t.match(/^Terreur\s+(\d+)/i);
    if (peur) out.causesPeur = Number(peur[1]);
    if (terreur) out.causesTerreur = Number(terreur[1]);
    if (/Immunit[ée].*Psychologie/i.test(t)) out.psychImmune = true;
  }
  return out;
}

/** Peur/Terreur inspirée par la Taille (LDB 85 l.317-318) du point de vue de `self` face à `foe`. */
export function peurTerreurFromSize(foe?: SizeCategory, self?: SizeCategory): { kind: 'peur' | 'terreur'; indice: number } | null {
  const gap = sizeGap(foe, self); // foe plus grand → gap > 0
  if (gap >= 2) return { kind: 'terreur', indice: gap };
  if (gap >= 1) return { kind: 'peur', indice: gap };
  return null;
}

/** Valeur de Calme d'un combattant : FM effective + avances de la compétence Calme (Sang-froid). */
export function calmeValue(c: Combatant): number {
  const adv = c.skills.find((s) => s.name.toLowerCase().startsWith('calme'))?.advances ?? 0;
  return effectiveChar(c, 'FM') + adv;
}

/** Un Round de Test ÉTENDU de Calme contre la Peur : cumule le DR. `prevDR` = DR déjà accumulé. */
export function resolvePeurTest(calme: number, indice: number, prevDR: number, rng: RNG = defaultRNG): { dr: number; calmeDR: number; vaincue: boolean; roll: number } {
  const t = rollTest(calme, 'intermediaire', rng);
  const dr = t.success ? Math.max(0, t.sl) : 0;
  const calmeDR = prevDR + dr;
  return { dr, calmeDR, vaincue: calmeDR >= indice, roll: t.roll };
}

/** Test de Terreur (1ʳᵉ rencontre) : échec → Brisé = Indice + |DR négatifs| ; devient ensuite Peur(Indice). */
export function resolveTerreurTest(calme: number, indice: number, rng: RNG = defaultRNG): { success: boolean; brise: number; devientPeur: number; roll: number } {
  const t = rollTest(calme, 'intermediaire', rng);
  const brise = t.success ? 0 : indice + Math.max(0, -t.sl);
  return { success: t.success, brise, devientPeur: indice, roll: t.roll };
}
```

- [ ] **Step 4 : vert + `npm run typecheck`.** Commit : `git commit -m "feat(psy): coeur pur psychology.ts -- parse Peur/Terreur/Immunite, declenchement Taille, Test de Calme/Terreur (LDB 21+85)" -- src/engine/psychology.ts src/engine/psychology.test.ts`

---

## Task 2 : champs `Combatant` + dérivation au spawn

**Files:** Modify `src/engine/types.ts`, `src/state/spawn.ts` ; Test `src/state/spawn-psych.test.ts`.

- [ ] **Step 1 : test** (`spawn-psych.test.ts`)

```ts
it('statbloc « Terreur 2 » → causesTerreur ; « Immunité (Psychologie) » → psychImmune', () => {
  const c = statblockToCombatant({ name: 'X', char: { F: 30, E: 30, FM: 30 }, traits: ['Terreur 2', 'Immunité (Psychologie)'] }, 'x', { x: 0, y: 0 });
  expect(c.causesTerreur).toBe(2);
  expect(c.psychImmune).toBe(true);
});
```

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
- `types.ts`, dans `Combatant` (près de `size?`) :
```ts
  /** Indice de Peur/Terreur INSPIRÉ (statbloc) ; Immunité Psychologie (LDB 85 l.143-144). */
  causesPeur?: number;
  causesTerreur?: number;
  psychImmune?: boolean;
  /** Afflictions psy ACTIVES en combat (Peur en cours, etc.). */
  psychState?: import('./psychology').PsychAffliction[];
  /** Groupes d'appartenance + traits psy possédés (matching des Cibles — utilisés en P3). */
  groups?: string[];
  psychTraits?: import('./psychology').PsychTrait[];
```
- `spawn.ts` : dans `statblockToCombatant` ET `creatureToCombatant`, après le calcul des traits, fusionner `parsePsychTraits(traits)` dans le combattant (surcharge statbloc explicite si présente). Importer `parsePsychTraits`.
```ts
  const psy = parsePsychTraits(sb.traits ?? []);
  // ... dans l'objet retourné : ...psy,
```

- [ ] **Step 4 : vert + typecheck.** Commit : `feat(psy): champs Combatant (causesPeur/Terreur/psychImmune/psychState) + derivation au spawn (parse traits)`.

---

## Task 3 : −1 DR sous Peur (`attackModifiers`)

**Files:** Modify `src/engine/combat.ts` (`attackModifiers`) ; Test `src/engine/combat-breakdown.test.ts`.

- [ ] **Step 1 : test** — un attaquant sous Peur dont la source = la cible subit −10 (−1 DR).

```ts
it('Peur : −1 DR (−10) quand l’attaquant vise sa source de Peur (LDB 21 l.29)', () => {
  const a = mk({ psychState: [{ type: 'peur', sourceId: 'B', calmeDR: 0 }] as any });
  const b = mk({ id: 'B' });
  const mods = attackModifiers(a, b, sword, { kind: 'melee' });
  expect(mods.some((m) => m.label === 'Peur' && m.value === -10)).toBe(true);
});
```

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter** — dans `attackModifiers`, après les pénalités d'État :
```ts
  // Peur : -1 DR aux Tests liés à la source (LDB 21 l.29). DR = pas de 10 sur la valeur cible.
  if (target && (attacker.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === target.id))
    out.push({ label: 'Peur', value: -10 });
```

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `feat(psy): -1 DR quand l'attaquant vise sa source de Peur (attackModifiers, LDB 21 l.29)`.

---

## Task 4 : résolution IA au début du tour (Brisé + révélation)

**Files:** Modify `src/state/combatFlow.ts` ; Test `src/state/psych-ia.test.ts`.

- [ ] **Step 1 : test** — un ENNEMI dont le tour commence face à une source de Terreur (héros plus grand OU `causesTerreur`) en LdV : résolution instantanée → s'il rate, gagne Brisé + une révélation est poussée ; un combattant `psychImmune` n'est pas affecté.

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter** — helper `resolvePsychFor(get, set, c)` (combatFlow) :
  - Si `c.psychImmune` → return.
  - Sources = pour chaque adversaire vivant **en Ligne de Vue** (`lineOfSightCover(...).blocked === false`) : `peurTerreurFromSize(foe.size, c.size)` ∪ (`foe.causesTerreur`→terreur, `foe.causesPeur`→peur). Prendre le **max** Indice par source ; Terreur prime Peur.
  - Pour chaque source non déjà gérée (`c.psychState` ne contient pas déjà une Peur vaincue de cette source) :
    - **Terreur** non testée → `resolveTerreurTest(calmeValue(c), indice, battleRng())` : si échec `addCondition(c, 'Brisé', brise)` ; pose `psychState` Peur(indice, sourceId) (la Terreur devient Peur) ; `pushReveal` (kind 'calme', titre « Terreur ») si héros témoin pertinent — pour l'IA, révélation aussi (le joueur voit l'ennemi terrifié).
    - **Peur** en cours → `resolvePeurTest(calmeValue(c), indice, prevDR, battleRng())` : maj `calmeDR` ; si `vaincue` retire l'affliction.
  - Appelé pour un ENNEMI dans `maybeRunEnemyTurn`/`runEnemyAI` AVANT l'action (instantané).

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `feat(psy): resolution Peur/Terreur de l'IA au debut de son tour (Brisé + revelation, LDB 21)`.

---

## Task 5 : modale héros `pendingPsych` (Test étendu de Calme) + garde-fou

**Files:** Modify `src/state/store.ts`, `src/state/combatFlow.ts` (héros → ouvre la modale), `src/state/roll-modal-invariant.test.ts` ; Create `src/ui/PsychModal.tsx`, `src/ui/CampaignView.tsx` (montage) ; Test `src/state/psych-modal.test.ts`.

- [ ] **Step 1 : test** — au début du tour d'un héros face à une source de Peur, `pendingPsych` s'ouvre ; `psychRoll` lance le Test de Calme ; `psychConfirm` applique (Peur vaincue si DR cumulé ≥ Indice, sinon persiste ; Terreur → Brisé). Les actions héros sont gelées tant que `pendingPsych` est ouvert.

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `store.ts` : `PendingPsych { combatantId; type: 'peur'|'terreur'; sourceId; indice; prevDR; result: { roll; dr; calmeDR?; brise?; vaincue?; success? } | null; rerolled? }` + `pendingPsych` state + init/reset.
  - Actions `psychRoll` (`resolvePeurTest`/`resolveTerreurTest`), `psychReroll`/`psychBonusSL`/`psychForceSuccess` (Chance, motif `focus*`), `psychConfirm` (applique : maj `psychState`/`calmeDR`, `addCondition Brisé`, Terreur→Peur ; ferme ; **enchaîne** la source suivante s'il en reste, file `pendingPsych`). Modèle = `pendingFocus`.
  - `combatFlow` : à l'activation d'un HÉROS (dans `advanceTurn`/`resolveRoundBoundary`), si des sources psy non résolues → `set({ pendingPsych: ... })` (au lieu de résoudre). Les modales existantes gèlent déjà les actions ; vérifier que `battleSelectAction`/`battleClickEntity` no-op si `pendingPsych`.
  - `PsychModal.tsx` : modèle `FocusModal` (Lancer → DR/cumul → Chance → Appliquer).
  - `CampaignView` : monter `<PsychModal/>`.
  - `roll-modal-invariant.test.ts` : la résolution psy passe par `psych*` (suffixes `Roll/Confirm` déjà whitelistés) ; vérifier qu'aucune action n'appelle `resolvePeurTest`/`resolveTerreurTest` en ligne hors `psych*`.

- [ ] **Step 4 : vert + typecheck + suite (garde-fou inclus).** Commit : `feat(psy): modale heros Test de Calme/Terreur (pendingPsych, Test etendu de Peur) + garde-fou`.

---

## Task 6 : approche sous Peur

**Files:** Modify `src/state/store.ts` (déplacement héros) + `src/state/combatFlow.ts` (IA / source qui s'approche) ; Test `src/state/psych-approche.test.ts`.

- [ ] **Step 1 : test** — un héros sous Peur ne peut pas se déplacer vers la source sans réussir un Calme +0 ; si la source (IA) s'approche, le héros teste Calme +0 ou gagne Brisé (révélation).

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
  - `battleClickTile` (déplacement héros) : si l'actif a une Peur et que la case cible **réduit** la distance à la source → ouvrir un Test de Calme +0 (réutilise `pendingPsych` avec un mode « approche » ; échec = mouvement refusé) OU bloquer + log si déjà testé ce tour. *(Garder simple : un Test d'approche par tentative, échec = mouvement annulé.)*
  - `runEnemyAI` (après le déplacement d'un ennemi qui est source de Peur d'un héros) : si la distance au héros a diminué → le héros teste Calme +0 sinon `addCondition('Brisé')` + `pushReveal`.

- [ ] **Step 4 : vert + typecheck + suite + recette (différée).** Commit : `feat(psy): approche sous Peur -- test de Calme pour avancer / quand la source s'approche (LDB 21 l.29)`.

---

## Self-Review
- **Couverture spec (P1)** : modèle + parsing (T1/T2) ✓ ; Taille T5 (T1 `peurTerreurFromSize`, T4/T5 conso) ✓ ; statbloc (T2) ✓ ; Test étendu Calme modale (T5) ✓ ; Brisé/−1 DR/approche (T3/T4/T6) ✓ ; Immunité (T1/T4) ✓.
- **Types cohérents** : `PsychAffliction`/`PsychTrait` (T1) consommés par `Combatant.psychState` (T2), `attackModifiers` (T3), résolution (T4/T5) ; `pendingPsych` (T5) lu par `PsychModal`.
- **Placeholders** : aucun bloquant ; l'approche (T6) volontairement simple (un test par tentative).
- **Frontière** : `psychology.ts` pur ; orchestration (modale/IA/déplacement) en state.
- **Isolation rig** : `types.ts`/`combat.ts`/`combatFlow.ts`/`store.ts` partagés → staging sélectif ; `psychology.ts`/`PsychModal.tsx` neufs.
