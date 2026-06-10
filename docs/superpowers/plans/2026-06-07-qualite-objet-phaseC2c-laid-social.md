# Phase C2c — `Laid` (−10 Sociabilité) — Plan d'implémentation

> REQUIRED SUB-SKILL: superpowers:executing-plans. Fichiers chauds (sessions //) → relire avant edit ; `git commit -- <chemins>`.

**Goal:** Un objet **Laid** ÉQUIPÉ par un héros impose **−10 à ses Tests de Sociabilité** (LDB 60 l.84-85 : « les Tests de Sociabilité associés peuvent subir −10 »). Câblé via le registre (`QualityDef.socMod`) + le même hook `testValue` que C2a/C2b.

**Architecture :** `QualityDef` gagne `socMod?: number` (Laid : −10). `dispatch.ts:qualitySocMod(carrier)` somme `socMod` ; `wearPenalty.ts:wornSocialMod(c)` somme sur les objets **équipés** ; `skills.ts:testValue` l'applique quand le Test est de caractéristique **Soc** (raw ou compétence Soc-based : Charme, Marchandage, Intimidation…).

**Hors périmètre / déjà fait :** `Volumineux` porté = Enc 1 **déjà implémenté** (`items.ts:82`) → juste un test de garde. `Volumineux` Fatigue ×2 **différé** : la Fatigue d'Encombrement (`travelFatigue`) est échelle-voyage, **non appliquée en combat** (`encumbrance.ts` l.15-17) → aucun consommateur ; la modéliser = inventer. `Raffiné` : aucun bonus chiffré RAW → rien (prix/dispo seulement, déjà couvert par craftEconomy).

---

## Task 1 : `socMod` registre + `qualitySocMod` (dispatch)

**Files:** Modify `src/engine/qualities/registry.ts`, `src/engine/qualities/dispatch.ts` ; Test `src/engine/qualities/dispatch.test.ts` (ou wearPenalty.test.ts).

- [ ] **Step 1 : Test qui échoue**
```ts
import { qualitySocMod } from './dispatch';
it('qualitySocMod somme socMod (Laid = -10)', () => {
  expect(qualitySocMod({ qualities: ['Laid'] })).toBe(-10);
  expect(qualitySocMod({ qualities: ['Précise'] })).toBe(0);
});
```
- [ ] **Step 2 : Lancer → échoue** (`qualitySocMod` absent).
- [ ] **Step 3 : `socMod` dans `QualityDef`** (registry.ts, après `damagesArmour?: boolean;`)
```ts
  damagesArmour?: boolean;
  /** Modificateur aux Tests de Sociabilité du porteur quand l'objet est équipé (Laid -10, LDB 60 l.85). */
  socMod?: number;
```
et sur l'entrée `Laid` :
```ts
  'Laid': { key: 'Laid', type: 'Défaut', subType: 'Objet', socMod: -10 }, // -10 Tests de Sociabilité (LDB 60 l.85)
```
- [ ] **Step 4 : `qualitySocMod` dans `dispatch.ts`** (mirroir de `craftTestDRAdjust`)
```ts
/** Somme des modificateurs de Sociabilité (Laid -10, LDB 60 l.85) des qualités du porteur. */
export function qualitySocMod(w: QualityCarrier | undefined): number {
  return resolveQualities(w).reduce((s, r) => s + (r.def.socMod ?? 0), 0);
}
```
- [ ] **Step 5 : Lancer → passe ; typecheck → 0 ; commit.**
```bash
git commit -- src/engine/qualities/registry.ts src/engine/qualities/dispatch.ts src/engine/qualities/dispatch.test.ts -m "feat(qualites): QualityDef.socMod + Laid -10 Soc (Phase C2c)"
```

---

## Task 2 : `wornSocialMod(c)` (wearPenalty.ts)

**Files:** Modify `src/engine/wearPenalty.ts`, `src/engine/wearPenalty.test.ts`.

- [ ] **Step 1 : Test qui échoue**
```ts
import { wornSocialMod } from './wearPenalty';
it('wornSocialMod somme les Laid équipés (-10), ignore les non équipés', () => {
  const c = { items: [
    { uid: 'a', name: 'Heaume hideux', kind: 'armor', qualities: ['Laid'], enc: 2, equipped: true },
    { uid: 'b', name: 'Babiole', kind: 'misc', qualities: ['Laid'], enc: 0, equipped: false },
  ] } as unknown as Combatant;
  expect(wornSocialMod(c)).toBe(-10);
});
```
- [ ] **Step 2 : Lancer → échoue.**
- [ ] **Step 3 : Implémenter** (wearPenalty.ts ; importer `qualitySocMod`)
```ts
import { hasQuality, qualitySocMod } from './qualities/dispatch';
// …
/** Somme des modificateurs de Sociabilité (≤ 0) des objets ÉQUIPÉS de `c` (Laid -10, LDB 60 l.85). */
export function wornSocialMod(c: Combatant): number {
  let total = 0;
  for (const piece of c.items ?? []) if (piece.equipped) total += qualitySocMod(piece);
  return total;
}
```
- [ ] **Step 4 : Lancer → passe ; commit.**
```bash
git commit -- src/engine/wearPenalty.ts src/engine/wearPenalty.test.ts -m "feat(qualites): wornSocialMod (objets Laid equipes) (Phase C2c)"
```

---

## Task 3 : Hook `testValue` (Tests de Sociabilité)

**Files:** Modify `src/engine/skills.ts` ; Test `src/engine/wearPenalty.test.ts`.

- [ ] **Step 1 : Tests qui échouent**
```ts
import { testValue } from './skills';
it('testValue : un objet Laid équipé impose -10 aux Tests Soc (raw)', () => {
  const c = { characteristics: { Soc: 40 }, skills: [], items: [{ uid: 'a', name: 'X', kind: 'armor', qualities: ['Laid'], enc: 1, equipped: true }] } as unknown as Combatant;
  expect(testValue(c, undefined, 'Soc')).toBe(30);
});
it('testValue : -10 sur une compétence Soc-based (Charme), pas sur une compétence non-Soc', () => {
  const c = { characteristics: { Soc: 40, Ag: 40 }, skills: [{ name: 'Charme', characteristic: 'Soc', advances: 0 }, { name: 'Discrétion', characteristic: 'Ag', advances: 0 }], items: [{ uid: 'a', name: 'X', kind: 'armor', qualities: ['Laid'], enc: 1, equipped: true }] } as unknown as Combatant;
  expect(testValue(c, 'Charme')).toBe(30);     // Soc 40 − 10
  expect(testValue(c, 'Discrétion')).toBe(40); // non-Soc → inchangé (pas de pénalité d'armure ici)
});
```
- [ ] **Step 2 : Lancer → échouent.**
- [ ] **Step 3 : Hook** (skills.ts). Importer `wornSocialMod`. Dans `testValue` :
  - branche `if (characteristic)` :
```ts
  if (characteristic) return (c.characteristics[characteristic] ?? 0) + (characteristic === 'Soc' ? wornSocialMod(c) : 0);
```
  - branche `if (skill)` (après calcul de `ck`), ajouter au retour :
```ts
    return base + (sk?.advances ?? 0) + wornArmourPenalty(c, skill) + (ck === 'Soc' ? wornSocialMod(c) : 0);
```
- [ ] **Step 4 : Lancer → passent ; `npm test` complet (hook partagé) ; typecheck → 0 ; commit.**
```bash
git commit -- src/engine/skills.ts src/engine/wearPenalty.test.ts -m "feat(qualites): testValue applique Laid -10 sur les Tests de Sociabilite (Phase C2c)"
```

---

## Task 4 : Vérification finale + garde Volumineux

- [ ] **Test de garde** (Volumineux porté = Enc 1, déjà implémenté) — dans `items.test.ts` ou `wearPenalty.test.ts` :
```ts
import { totalEncumbrance } from './items';
it('Volumineux porté = Enc 1 (déjà câblé items.ts)', () => {
  const c = { items: [{ uid: 'a', name: 'Plastron lourd', kind: 'armor', qualities: ['Volumineux'], enc: 3, equipped: true }] } as unknown as Combatant;
  expect(totalEncumbrance(c)).toBe(1); // porté Volumineux = 1 (LDB 60 l.91)
});
```
- [ ] `npm test` + `npm run typecheck` verts, golden intact. Commit le test de garde s'il est dans un fichier à moi.

## Self-review
- Couverture : socMod registre + qualitySocMod (T1), wornSocialMod équipés (T2), hook testValue raw+skill Soc (T3), garde Volumineux + régression (T4). RAW LDB 60 l.85. ✓
- Décisions : **somme** des socMod (cohérent avec wornArmourPenalty ; 2 Laid = −20, rare) ; Soc détecté via `characteristic==='Soc'` OU `skillCharKey(skill)==='Soc'`. Volumineux-Fatigue **différé** (pas de consommateur, modéliser = inventer). ✓
- Risque : `testValue` partagé → `npm test` complet en T3.
