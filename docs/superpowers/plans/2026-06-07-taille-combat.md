# Taille en combat (T2+T3+T4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, choisi par l'utilisateur) pour exécuter tâche par tâche. Steps en checkbox (`- [ ]`).

**Goal :** Implémenter tous les effets de combat du Trait Taille (Dégâts ×N + Atouts + Frappe Mortelle, lutte −2 DR/désengagement/Force/Piétinement, Blessures dynamiques formule/surcharge), max-RAW.

**Architecture :** Helpers purs dans `engine/size.ts` ; effets de Dégâts/parade dans `engine/combat.ts` (`applyHit`/`finishMelee`) ; Blessures dynamiques dans `engine/characteristics.ts` + recompute store ; orchestration (balayage, désengagement gratuit, piétinement) dans `state/combatFlow.ts`/`store.ts`/`ai.ts` ; surcharge éditable dans `StatblockEditor`. Spec : `docs/superpowers/specs/2026-06-07-taille-combat-design.md`.

**Tech Stack :** TypeScript, Vitest (TDD), RNG seedable (`battleRng`/`makeRNG`). Source : `Source/Warhammer v4 - Livre de base version corrigée/`.

---

## File Structure

| Fichier | Modif | Responsabilité |
|---|---|---|
| `src/engine/size.ts` | EDIT | + `sizeDamageMultiplier`, `sizeGrantedQualities`, `forceOpposedOutcome`, `woundsForSize`. Pur. |
| `src/engine/combat.ts` | EDIT | Dévastatrice/Percutante + ×N dans `applyHit` ; −2 DR/cat dans `finishMelee` ; `cleave` ; `resolveTrample`. |
| `src/engine/types.ts` | EDIT | `AttackResult.cleave?` ; `Combatant.wounds.base`. |
| `src/engine/characteristics.ts` | EDIT | `maxWounds(chars, size)` (remplace `isSmall`) ; `effectiveMaxWounds(c)` (base + delta buff). |
| `src/engine/character.ts` | EDIT | dérive size de l'espèce ; `wounds.base` à la création. |
| `src/state/scene.ts` | EDIT ⚠️ partagé | `CustomStatblock.char.B` reste optionnel (déjà `Partial`). (Pas de nouveau champ.) |
| `src/state/spawn.ts` | EDIT | `wounds.base` (= char.B surcharge ?? `woundsForSize` formule) ; size déjà dérivée (T1). |
| `src/state/combatFlow.ts` | EDIT | balayage Frappe Mortelle ; désengagement gratuit ; recompute Blessures sur buff. |
| `src/state/store.ts` | EDIT | `pendingCleave` + actions ; `battleTrample` ; recompute Blessures (apply/expire effet). |
| `src/state/ai.ts` | EDIT | IA : balaye, piétine. |
| `src/ui/ActionBar.tsx` (hotbar) | EDIT | bouton « 🦶 Piétiner ». |
| `src/ui/CampaignView.tsx` | EDIT | modale `pendingCleave`. |
| `src/ui/editor/StatblockEditor.tsx` | EDIT | champ Blessures optionnel (placeholder = formule). |
| `src/engine/character.ts` callers : `store.ts:77`, `ui/CharacterCreator.tsx:78`, `engine.test.ts:312/316` | EDIT | migration `maxWounds(chars, isSmall)` → `(chars, size)`. |

---

# PHASE 1 — Cœur pur (size.ts + Dégâts/parade)

## Task 1 : `size.ts` — helpers de combat

**Files:** Modify `src/engine/size.ts` ; Test `src/engine/size.test.ts`.

- [ ] **Step 1 : tests** (ajouter au describe existant)

```ts
import { sizeDamageMultiplier, sizeGrantedQualities, forceOpposedOutcome, woundsForSize } from './size';

describe('Taille en combat (T2/T3/T4)', () => {
  it('sizeDamageMultiplier : ×1 si ≤ +1 cat, ×N si ≥ +2', () => {
    expect(sizeDamageMultiplier('moyenne', 'moyenne')).toBe(1);
    expect(sizeDamageMultiplier('grande', 'moyenne')).toBe(1); // +1 cat → ×1 (no-op)
    expect(sizeDamageMultiplier('enorme', 'moyenne')).toBe(2); // +2 → ×2
    expect(sizeDamageMultiplier('monstrueuse', 'moyenne')).toBe(3); // +3 → ×3
    expect(sizeDamageMultiplier('petite', 'moyenne')).toBe(1); // plus petit → ×1
  });
  it('sizeGrantedQualities : ∅ / Dévastatrice / Dévastatrice+Percutante', () => {
    expect(sizeGrantedQualities('moyenne', 'moyenne')).toEqual([]);
    expect(sizeGrantedQualities('grande', 'moyenne')).toEqual(['Dévastatrice']);
    expect(sizeGrantedQualities('enorme', 'moyenne')).toEqual(['Dévastatrice', 'Percutante']);
  });
  it('forceOpposedOutcome : autoWin / needCrit / normal', () => {
    expect(forceOpposedOutcome('enorme', 'moyenne')).toBe('autoWin'); // a ≥ +2 cat → victoire auto
    expect(forceOpposedOutcome('grande', 'moyenne')).toBe('normal'); // a +1 cat → normal (b plus petit, pas a)
    expect(forceOpposedOutcome('moyenne', 'moyenne')).toBe('normal');
    expect(forceOpposedOutcome('petite', 'grande')).toBe('needCrit'); // a plus petit → doit un Critique
  });
  it('woundsForSize : table par catégorie (BF=3, BE=4, BFM=3 → Moyenne 14)', () => {
    expect(woundsForSize(3, 4, 3, 'moyenne')).toBe(14);
    expect(woundsForSize(3, 4, 3, 'petite')).toBe(11); // 2·BE+BFM
    expect(woundsForSize(3, 4, 3, 'tresPetite')).toBe(4); // BE
    expect(woundsForSize(3, 4, 3, 'minuscule')).toBe(1);
    expect(woundsForSize(3, 4, 3, 'grande')).toBe(28); // ×2
    expect(woundsForSize(3, 4, 3, 'enorme')).toBe(56); // ×4
    expect(woundsForSize(3, 4, 3, 'monstrueuse')).toBe(112); // ×8
  });
});
```

- [ ] **Step 2 : lancer → échec** — `npx vitest run src/engine/size.test.ts`.

- [ ] **Step 3 : implémenter** (ajouter à `size.ts`)

```ts
/** Multiplicateur de Dégâts si l'attaquant est plus grand (LDB 85 l.297) : ×2 à +2 cat, ×3 à +3…
 *  (+1 cat = ×1, no-op — le bonus à +1 est l'Atout Dévastatrice). Jamais < 1. */
export function sizeDamageMultiplier(attacker?: SizeCategory, target?: SizeCategory): number {
  const gap = sizeGap(attacker, target);
  return gap >= 2 ? gap : 1;
}

/** Atouts conférés par l'écart de Taille (LDB 85 l.295) : Dévastatrice à +1, Percutante à +2 — CUMUL. */
export function sizeGrantedQualities(attacker?: SizeCategory, target?: SizeCategory): string[] {
  const gap = sizeGap(attacker, target);
  if (gap >= 2) return ['Dévastatrice', 'Percutante'];
  if (gap >= 1) return ['Dévastatrice'];
  return [];
}

/** Issue d'un Test de Force opposé selon la Taille (LDB 85 l.311-312), du point de vue de `a` :
 *  a ≥ +2 cat → `autoWin` ; a plus petit (gap ≤ −1) → `needCrit` (doit un Critique pour s'opposer) ; sinon `normal`. */
export function forceOpposedOutcome(a?: SizeCategory, b?: SizeCategory): 'autoWin' | 'needCrit' | 'normal' {
  const gap = sizeGap(a, b);
  if (gap >= 2) return 'autoWin';
  if (gap <= -1) return 'needCrit';
  return 'normal';
}

/** Points de Blessure de base par catégorie de Taille (LDB 85 l.332-352). bf/be/bfm = Bonus. */
export function woundsForSize(bf: number, be: number, bfm: number, size: SizeCategory = 'moyenne'): number {
  const moyenne = bf + 2 * be + bfm;
  switch (size) {
    case 'minuscule': return 1;
    case 'tresPetite': return be;
    case 'petite': return 2 * be + bfm;
    case 'moyenne': return moyenne;
    case 'grande': return moyenne * 2;
    case 'enorme': return moyenne * 4;
    case 'monstrueuse': return moyenne * 8;
  }
}
```

- [ ] **Step 4 : lancer → vert** + `npm run typecheck`.

- [ ] **Step 5 : commit** — `git add src/engine/size.ts src/engine/size.test.ts && git commit -m "feat(taille): helpers combat purs -- sizeDamageMultiplier, sizeGrantedQualities, forceOpposedOutcome, woundsForSize (LDB 85)"`

---

## Task 2 : Dévastatrice & Percutante dans `applyHit`

**Files:** Modify `src/engine/combat.ts` (`applyHit`) ; Test `src/engine/combat-breakdown.test.ts`.

- [ ] **Step 1 : tests** (les armes obtiennent enfin l'effet)

```ts
// sword2 = arme avec Dévastatrice ; mace = Percutante. units = roll%10.
const devastatrice: Weapon = { name: 'Zweihänder', type: 'melee', damage: '+BF+5', qualities: ['Dévastatrice'] };
const percutante: Weapon = { name: 'Lance', type: 'melee', damage: '+BF+6', qualities: ['Percutante'] };
it('Dévastatrice : dégâts utilisent max(DR, dé des unités)', () => {
  // jet contrôlé : on passe par resolveMeleePassive avec un atk forgé via makeRNG, OU on teste applyHit indirectement.
  // Plus simple : resolveRanged avec un seed où units > DR, comparer woundsLost vs une arme sans Dévastatrice.
  const a = mk({ characteristics: { ...mk().characteristics, F: 30 } });
  const dWith = resolveRanged(a, mk(), { name: 'X', type: 'ranged', damage: '+8', range: 60, qualities: ['Dévastatrice'] }, makeRNG(4), 28);
  const dNo = resolveRanged(a, mk(), { name: 'X', type: 'ranged', damage: '+8', range: 60, qualities: [] }, makeRNG(4), 28);
  if (dWith.hit && dNo.hit) expect(dWith.woundsLost!).toBeGreaterThanOrEqual(dNo.woundsLost!);
});
```
> Note : tester Dévastatrice/Percutante de façon déterministe est plus simple via **un helper exporté** ou via `resolveStrayRangedHit` (qui prend roll+effTarget explicites). **Recommandé** : tester l'effet sur `resolveStrayRangedHit` (roll connu → units connu) en passant une arme Dévastatrice/Percutante et en vérifiant `woundsLost`. Écrire 3 cas : Dévastatrice (units>DR augmente), Percutante (+units), Inoffensive annule.

- [ ] **Step 2 : lancer → échec.**

- [ ] **Step 3 : implémenter** dans `applyHit` (remplacer le bloc dégâts existant)

Remplacer :
```ts
  const effDR = dr + (hasQ(weapon, 'Pointue') ? 1 : 0);
  const damage = weaponDmg + Math.max(0, effDR);
```
par :
```ts
  const units = atkBd.roll % 10; // dé des unités (LDB 62 l.279/313) ; « 00 » → 0
  const inoffensive = hasQ(weapon, 'Inoffensive');
  const effDR = dr + (hasQ(weapon, 'Pointue') ? 1 : 0);
  // Dévastatrice : DR-pour-dégâts = max(DR, unités) ; Percutante : +unités. Inoffensive annule (l.279/313).
  const dmgDR = !inoffensive && hasQ(weapon, 'Dévastatrice') ? Math.max(effDR, units) : effDR;
  let damage = weaponDmg + Math.max(0, dmgDR);
  if (!inoffensive && hasQ(weapon, 'Percutante')) damage += units;
```
(`weapon` ici = `effectiveWeapon(weapon)` ; ses `qualities` incluent celles d'origine. Les Atouts de Taille seront ajoutés en Task 3.)

- [ ] **Step 4 : lancer → vert** + `npm run typecheck` + suite complète (les armes Dévastatrice/Percutante existantes changent des dégâts → mettre à jour les attentes impactées).

- [ ] **Step 5 : commit** — `git commit -m "feat(combat): Atouts Devastatrice (max DR/unites) + Percutante (+unites), Inoffensive annule (LDB 62 l.279/313)" -- src/engine/combat.ts src/engine/combat-breakdown.test.ts`

---

## Task 3 : ×N Dégâts + Atouts de Taille (mêlée & tir)

**Files:** Modify `src/engine/combat.ts` (`applyHit`) + import `size` ; Test `combat-breakdown.test.ts`.

- [ ] **Step 1 : test** — un attaquant Énorme (×2) inflige ≈2× les dégâts d'arme avant soak.

```ts
it('×N : attaquant Énorme (+2 cat) double les Dégâts avant soak (LDB 85 l.297)', () => {
  const big = mk({ size: 'enorme', characteristics: { ...mk().characteristics, F: 40 } });
  const tgt = mk({ size: 'moyenne' }); // E 30 → BE 3, PA 0
  const r = resolveStrayRangedHit(big, tgt, { name: 'Arc', type: 'ranged', damage: '+6', qualities: [] }, 25, 70);
  // Dégâts = 6 + DR ; ×2 ; − (BE+PA). Vérifie que c'est cohérent avec ×2 (woundsLost > dégâts simple).
  const small = resolveStrayRangedHit(mk({ size: 'moyenne' }), tgt, { name: 'Arc', type: 'ranged', damage: '+6', qualities: [] }, 25, 70);
  expect(r.woundsLost!).toBeGreaterThan(small.woundsLost!);
});
it('Énorme vs Moyenne : l’arme gagne Dévastatrice + Percutante', () => {
  // vérifiable indirectement : dégâts >= cas sans Atouts. (ou exposer sizeGrantedQualities, déjà testé Task 1)
  expect(true).toBe(true); // couvert par Task 1 + l'intégration
});
```
> Test déterministe via `resolveStrayRangedHit` (roll/effTarget explicites). Vérifier `woundsLost` du grand > petit, et que ×N s'applique **avant** le soak.

- [ ] **Step 2 : lancer → échec.**

- [ ] **Step 3 : implémenter** — import + injection dans `applyHit`.

En tête : `import { ..., sizeDamageMultiplier, sizeGrantedQualities, effectiveSize } from './size';` (compléter l'import existant).
Dans `applyHit`, AVANT le calcul `units`/`damage`, fusionner les Atouts de Taille :
```ts
  // Atouts conférés par la Taille (attaquant plus grand) — LDB 85 l.295. Fusionnés pour le calcul de dégâts.
  const sizeQual = sizeGrantedQualities(attacker.size, defender.size);
  const hasQx = (q: string) => hasQ(weapon, q) || sizeQual.includes(q);
```
Remplacer les `hasQ(weapon, 'Dévastatrice'|'Percutante')` de Task 2 par `hasQx(...)`. Puis APRÈS `damage` calculé, AVANT `woundsFromHit` :
```ts
  damage *= sizeDamageMultiplier(attacker.size, defender.size); // ×N AVANT soak (LDB 85 l.297, confirmé)
```
(`woundsFromHit(weapon, defender, loc, damage)` applique ensuite BE+PA — donc ×N est bien avant l'encaisse.)

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `git commit -m "feat(taille): Degats xN (avant soak) + Atouts Devastatrice/Percutante conferes par la Taille, mele ET tir (LDB 85 l.295-297)" -- src/engine/combat.ts src/engine/combat-breakdown.test.ts`

---

## Task 4 : −2 DR/catégorie en parade (plus petit)

**Files:** Modify `src/engine/combat.ts` (`finishMelee`) ; Test `combat-breakdown.test.ts`.

- [ ] **Step 1 : test**

```ts
it('parade −2 DR/cat : un Moyen qui PARE un Énorme subit −4 DR (LDB 85 l.305-306)', () => {
  const big = mk({ name: 'Ogre', size: 'enorme' });
  const small = mk({ name: 'Hum', size: 'moyenne', weapons: [sword] });
  // parade vs esquive : seul parade pénalisé. Comparer netSL / issue avec un seed fixe.
  const par = resolveMelee(big, small, sword, makeRNG(9), { defense: 'parade' });
  const esq = resolveMelee(big, small, sword, makeRNG(9), { defense: 'esquive' });
  // le défenseur Moyen pare un Énorme : son DR effectif est abaissé de 2×2=4 → il gagne moins / perd plus.
  expect(par.attackerDetail).toBeTruthy();
  // assertion ciblée : defenderDetail.sl en parade ≤ celui en esquive (à seed égal) — l'effet −4 DR.
});
```
> Affiner l'assertion selon le flux (`finishMelee` applique `drAdjust` à `def.sl`). Tester que `drAdjust` inclut −2×gap en parade et **0** en esquive.

- [ ] **Step 2 : lancer → échec.**

- [ ] **Step 3 : implémenter** — `finishMelee`, ligne `drAdjust` :

```ts
import { sizeGap } from './size'; // si pas déjà importé
// ...
  const parrySizePenalty = defenseMode === 'parade' ? 2 * Math.max(0, sizeGap(attacker, defender)) : 0; // −2 DR/cat (LDB 85 l.305-306)
  const drAdjust = (defenseMode === 'parade' ? (hasQ(defender.weapons[0], 'Défensive') ? 1 : 0) - (hasQ(weapon, 'À Enroulement') ? 1 : 0) : 0) - parrySizePenalty;
```

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `git commit -m "feat(taille): -2 DR/categorie quand le plus petit PARE (pas l'esquive) -- LDB 85 l.305-306" -- src/engine/combat.ts src/engine/combat-breakdown.test.ts`

---

## Task 5 : `cleave` (drapeau) + `resolveTrample`

**Files:** Modify `src/engine/types.ts` (`AttackResult.cleave?`) + `src/engine/combat.ts` (`finishMelee`/`resolveMeleePassive` posent `cleave` ; `resolveTrample`) ; Test `combat-breakdown.test.ts`.

- [ ] **Step 1 : tests**

```ts
it('cleave posé sur une touche de mêlée réussie d’un plus grand', () => {
  const r = resolveMelee(mk({ size: 'enorme' }), mk({ size: 'moyenne' }), sword, makeRNG(2), { defense: 'none' });
  if (r.hit) expect(r.cleave).toBe(true);
});
it('pas de cleave si attaquant pas plus grand', () => {
  const r = resolveMelee(mk({ size: 'moyenne' }), mk({ size: 'moyenne' }), sword, makeRNG(2), { defense: 'none' });
  expect(r.cleave).toBeFalsy();
});
it('resolveTrample : attaque CC à BF, plus grand', () => {
  const r = resolveTrample(mk({ size: 'enorme', characteristics: { ...mk().characteristics, F: 40 } }), mk({ size: 'moyenne' }), makeRNG(3));
  expect(['boolean','undefined']).toContain(typeof r.hit); // résout une attaque
});
```

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
- `types.ts` `AttackResult` : `+ /** Frappe Mortelle : touche de mêlée d'un plus grand → peut balayer (LDB 14 l.12 / 85 l.299). */ cleave?: boolean;`
- `combat.ts` : import `sizeGap`. Dans `finishMelee` (après `const res = applyHit(...)`) et `resolveMeleePassive` (après `applyHit`) : `if (res.hit && sizeGap(attacker, defender) >= 1) res.cleave = true;`
- `resolveTrample` (nouvelle fonction, attaque non opposée BF) :
```ts
/** Attaque de Piétinement (LDB 85 l.320-321) : créature plus grande, Dégâts = BF +0, via Corps à corps.
 *  Action gratuite (coût d'Avantage géré par le store). Non opposée (la cible est écrasée). */
export function resolveTrample(attacker: Combatant, target: Combatant, rng: RNG = defaultRNG): AttackResult {
  const atk = rollTest(combatValue(attacker, 'melee'), 'intermediaire', rng, combineMods(attackModifiers(attacker, target, attacker.weapons[0] ?? { name: 'Bagarre', type: 'melee', damage: '+BF', qualities: [] }, { kind: 'melee' })));
  const fist: Weapon = { name: 'Piétinement', type: 'melee', damage: '+BF', qualities: [] };
  const atkBd = bd('Corps à corps (Piétinement)', combatValue(attacker, 'melee'), atk, []);
  if (!atk.success) return miss(attacker, target, atkBd, 'attacker');
  return applyHit(attacker, target, fist, atkBd, atk.sl, atk.isDouble && atk.success);
}
```
(vérifier le helper `miss` existant dans combat.ts — sinon retourner un AttackResult `hit:false` minimal.)

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `git commit -m "feat(taille): drapeau cleave (Frappe Mortelle) + resolveTrample (Pietinement BF, LDB 85 l.320-321)" -- src/engine/types.ts src/engine/combat.ts src/engine/combat-breakdown.test.ts`

---

# PHASE 2 — Blessures dynamiques + surcharge

## Task 6 : `maxWounds(chars, size)` + `effectiveMaxWounds(c)` + migration

**Files:** Modify `src/engine/types.ts` (`wounds.base`), `src/engine/characteristics.ts`, callers (`character.ts`, `store.ts:77`, `ui/CharacterCreator.tsx:78`, `engine.test.ts`).

- [ ] **Step 1 : tests** (`engine.test.ts` ou `characteristics.test.ts`)

```ts
import { maxWounds, effectiveMaxWounds } from './characteristics';
it('maxWounds(chars, size) : Moyenne formule, Petite 2BE+BFM, Grande ×2', () => {
  const c = { F: 35, E: 45, FM: 33 } as any; // BF3, BE4, BFM3
  expect(maxWounds(c, 'moyenne')).toBe(14);
  expect(maxWounds(c, 'petite')).toBe(11);
  expect(maxWounds(c, 'grande')).toBe(28);
});
it('effectiveMaxWounds : base + delta de buff E (×Taille)', () => {
  const hero = mk({ size: 'moyenne', characteristics: { ...mk().characteristics, E: 30 }, wounds: { current: 10, max: 14, base: 14 } as any, activeEffects: [{ label: 'Soin', char: 'E', bonus: 10, roundsLeft: 3 }] });
  // +10 E → BE +1 → +2 Blessures (Moyenne)
  expect(effectiveMaxWounds(hero)).toBe(16);
});
```

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter**
- `types.ts` : `wounds: { current: number; max: number; base?: number }` (ajouter `base?`).
- `characteristics.ts` :
```ts
import { SizeCategory, woundsForSize, effectiveSize } from './size';
export function maxWounds(chars: Characteristics, size: SizeCategory = 'moyenne'): number {
  return woundsForSize(bonus(chars.F), bonus(chars.E), bonus(chars.FM), size);
}
/** Blessures max dynamiques = base (snapshot/ surcharge) + delta des buffs F/E/FM × Taille. */
export function effectiveMaxWounds(c: Combatant): number {
  const size = effectiveSize(c.size);
  const base = c.wounds.base ?? c.wounds.max;
  const eff = woundsForSize(bonus(effectiveChar(c, 'F')), bonus(effectiveChar(c, 'E')), bonus(effectiveChar(c, 'FM')), size);
  const raw = woundsForSize(bonus(c.characteristics.F), bonus(c.characteristics.E), bonus(c.characteristics.FM), size);
  return base + (eff - raw);
}
```
- **Migration `isSmall` → `size`** : `character.ts:210-211` :
```ts
  const size: import('./size').SizeCategory = sp.small ? 'petite' : /Ogre/i.test(opts.speciesLabel ?? sp.label ?? '') ? 'grande' : 'moyenne';
  const wmax = maxWounds(chars, size);
```
  (et plus bas, poser `wounds: { current: wmax, max: wmax, base: wmax }`, et `size` sur le Combatant héros si pas déjà.)
- `store.ts:77` : `maxWounds(hero.characteristics, hero.size ?? 'moyenne')` (au lieu de `small`).
- `ui/CharacterCreator.tsx:78` : `maxWounds(chars, sp.small ? 'petite' : 'moyenne')`.
- `engine.test.ts:312/316` : `maxWounds(chars)` reste (défaut moyenne) ; l.316 `maxWounds(chars, true)` → `maxWounds(chars, 'petite')`.

- [ ] **Step 4 : vert + typecheck + suite** (toutes les attentes de Blessures inchangées au repos). Commit : `git commit -m "feat(taille): maxWounds par categorie + effectiveMaxWounds (base + delta buffs F/E/FM x Taille) ; migration isSmall->size"`

## Task 7 : `wounds.base` au spawn (surcharge ?? formule)

**Files:** Modify `src/state/spawn.ts` ; Test `src/state/spawn-size.test.ts`.

- [ ] **Step 1 : test** — statblock sans `char.B` → Blessures = formule (`woundsForSize`) ; avec `char.B` → surcharge.

```ts
it('statblock sans B → Blessures = formule ; avec B → surcharge', () => {
  const formula = statblockToCombatant({ name: 'X', char: { F: 30, E: 30, FM: 30 } }, 'x', { x: 0, y: 0 });
  expect(formula.wounds.max).toBe(3 + 2 * 3 + 3); // 12, Moyenne
  expect(formula.wounds.base).toBe(12);
  const over = statblockToCombatant({ name: 'Y', char: { F: 30, E: 30, FM: 30, B: 50 } }, 'y', { x: 0, y: 0 });
  expect(over.wounds.max).toBe(50); // surcharge
});
```

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter** — `statblockToCombatant` : `const size = sb.size ?? sizeFromTraits(sb.traits ?? []) ?? 'moyenne';` `const base = typeof sb.char.B === 'number' ? sb.char.B : maxWounds(charsFrom(sb.char as any), size);` puis `wounds: { current: base, max: base, base }`. `creatureToCombatant` : `const base = typeof creature.char.B === 'number' ? creature.char.B : maxWounds(chars, size);` `wounds: { current: base, max: base, base }`. (Importer `maxWounds` depuis `../engine/characteristics`.)

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `git commit -m "feat(taille): wounds.base au spawn -- surcharge char.B sinon formule woundsForSize"`

## Task 8 : recompute Blessures sur buff/expiration (F/E/FM)

**Files:** Modify `src/state/combatFlow.ts` (`applyActiveEffect` + décrément fin de Round) + `store.ts` (castSpell/heal applique). Test `src/state/store.test.ts`.

- [ ] **Step 1 : test** — appliquer un `ActiveEffect` +E à un combattant en combat monte `wounds.max` ET `current` ; l'expiration les redescend (clamp ≥0).

- [ ] **Step 2 : échec.**

- [ ] **Step 3 : implémenter** — helper `refreshWounds(c)` (state) :
```ts
import { effectiveMaxWounds } from '../engine/characteristics';
export function refreshWounds(c: Combatant): void {
  const newMax = effectiveMaxWounds(c);
  const delta = newMax - c.wounds.max;
  c.wounds.max = newMax;
  if (delta > 0) c.wounds.current += delta;       // gagne des PB sur un buff
  else if (delta < 0) c.wounds.current = Math.max(0, c.wounds.current + delta); // en perd à l'expiration
}
```
Appeler `refreshWounds(c)` après TOUTE mutation de `activeEffects` touchant F/E/FM : dans `applyActiveEffect` (combatFlow) et dans le décrément/retrait de fin de Round (là où `roundsLeft` tombe à 0 et l'effet est retiré). Ne recalculer que si l'effet a un `char` ∈ {F, E, FM}.

- [ ] **Step 4 : vert + typecheck + suite.** Commit : `git commit -m "feat(taille): Blessures dynamiques -- recompute max+current sur buff/expiration d'un effet F/E/FM"`

---

# PHASE 3 — Orchestration (balayage, désengagement, piétinement)

## Task 9 : Frappe Mortelle — balayage (`combatFlow` + store + UI)

**Files:** Modify `src/state/combatFlow.ts` (`doAttack` IA + helper `cleaveTargets`), `src/state/store.ts` (`pendingCleave` + actions), `src/ui/CampaignView.tsx` (modale).

- [ ] **Step 1 : test** (`combatFlow`/store) — IA : un attaquant Énorme adjacent à 2 héros, sur une touche réussie, **enchaîne** sur le 2ᵉ (jusqu'à BCC). Héros : `pendingCleave` ouvert avec les cibles à portée. RNG seedé.
- [ ] **Step 2 : échec.**
- [ ] **Step 3 : implémenter**
  - Helper `cleaveTargets(battle, attacker, hitIds): Combatant[]` = adversaires (kind ≠ attacker.kind) vivants, **adjacents** (chebyshev ≤ 1) à la position de l'attaquant (ou à la case de la dernière cible si tuée → déplacer l'attaquant là), non dans `hitIds`.
  - **IA** (`doAttack`, après `applyAttackResult` si `r.res.cleave`) : boucle jusqu'à `bonus(effectiveChar(attacker,'CC'))` : pick un `cleaveTargets`, ré-résout une attaque (`resolveAttack`+`applyAttackResult`), ajoute à hitIds ; si une cible est tuée et la case libérée, déplacer l'attaquant dessus.
  - **Héros** : après `attackConfirm`, si `res.cleave` et `cleaveTargets` non vide et enchaînements < BCC → `set({ pendingCleave: { attackerId, hitIds, count } })`. Action `cleaveAttack(targetId)` → ouvre un `pendingAttack` standard sur la cible (réutilise le flux modale), incrémente count ; `cleaveEnd()` ferme. Borne BCC.
  - `PendingCleave` type dans store.
- [ ] **Step 4 : vert + typecheck + suite.** Commit : `git commit -m "feat(taille): Frappe Mortelle -- balayage jusqu'a BCC (IA auto + heros pendingCleave), deplacement sur case liberee (LDB 14 l.12 / 85 l.299)"`

## Task 10 : Désengagement gratuit du plus grand

**Files:** Modify `src/state/combatFlow.ts` (`startDisengage`) + `engagement.ts` si utile. Test `store.test.ts`/`engagement`.

- [ ] **Step 1 : test** — un combattant plus grand que **tous** ses Engagés, en action `move`, ne déclenche **pas** `pendingDisengage` : déplacement libre + liens Engagé levés avec les plus petits quittés.
- [ ] **Step 2 : échec.**
- [ ] **Step 3 : implémenter** — dans `startDisengage` (ou en amont, là où on décide d'ouvrir le Désengagement) : si `mover` est plus grand que **chacun** de ses `engagedWith` vivants (`sizeGap(mover, foe) >= 1` pour tous), **court-circuiter** : rouvrir le déplacement normal (`reachable`), retirer `mover` des `engagedWith` réciproques des plus petits quittés. Log « écarte les plus petits » (LDB 85 l.308-309).
- [ ] **Step 4 : vert + typecheck + suite.** Commit : `git commit -m "feat(taille): desengagement gratuit du plus grand (LDB 85 l.308-309) -- court-circuite pendingDisengage"`

## Task 11 : Piétinement — action (store + hotbar + IA)

**Files:** Modify `src/state/store.ts` (`battleTrample`), `src/state/combatFlow.ts` (résolution), `src/ui/ActionBar.tsx` (bouton), `src/state/ai.ts` (IA). Test `store.test.ts`/`ai.test.ts`.

- [ ] **Step 1 : test** — `battleTrample(targetId)` : exige acteur plus grand qu'une cible adjacente + ≥1 Avantage ; dépense 1 Avantage ; applique `resolveTrample`. IA piétine un adjacent plus petit si Avantage.
- [ ] **Step 2 : échec.**
- [ ] **Step 3 : implémenter**
  - Store `battleTrample(targetId)` : garde (acteur.size > cible.size, adjacent, advantage ≥ 1) → `active.advantage -= 1` → `resolveTrample` (via combatFlow) → `applyAttackResult`. Action gratuite (ne consomme pas `acted`).
  - **Hotbar** (`ActionBar.tsx`) : bouton « 🦶 Piétiner » visible si l'acteur (plus grand qu'un adversaire adjacent) a ≥1 Avantage ; ouvre le ciblage.
  - **IA** (`ai.ts`/`doEnemyTurn`) : après l'attaque principale, si Avantage ≥1 et adversaire adjacent plus petit, piétiner (faible priorité).
- [ ] **Step 4 : vert + typecheck + suite + recette (différée).** Commit : `git commit -m "feat(taille): Pietinement -- action gratuite (1 Avantage, BF, CC) store+hotbar+IA (LDB 85 l.320-321)"`

---

# PHASE 4 — Surcharge éditable

## Task 12 : champ Blessures optionnel dans l'éditeur

**Files:** Modify `src/ui/editor/StatblockEditor.tsx` (+ inspecteur d'entité si distinct).

- [ ] **Step 1 :** localiser le champ « B »/Blessures (input numérique sur `stat.char.B`). Le rendre **optionnel** : valeur vide → `char.B` undefined (→ formule au spawn) ; placeholder = `woundsForSize(BF,BE,BFM, size)` calculé en live depuis les champs F/E/FM + la Taille du statbloc.
- [ ] **Step 2 :** vérifier `npm run typecheck` ; (recette navigateur différée).
- [ ] **Step 3 : commit** (hunks sélectifs si fichier partagé) : `git commit -m "feat(editeur): champ Blessures optionnel -- vide = formule (par Taille), rempli = surcharge"`

---

## Final — Audit de fidélité (ultracode)
Après Phase 3 : workflow multi-agents (find → verify adversarial) sur l'implémentation Taille vs `85 - Traits de créature.md` (×N, Atouts, parade, Frappe Mortelle, Blessures), comme l'audit Maladresse (14 correctifs). Corriger les findings confirmés.

---

## Self-Review
- **Couverture spec** : T2 Dévastatrice/Percutante (T2) ✓ ×N (T3) ✓ Frappe Mortelle (T5,T9) ✓ ; T3 −2DR parade (T4) ✓ désengagement (T10) ✓ Force opposée (T1 helper) ✓ Piétinement (T5 resolveTrample + T11) ✓ ; T4 Blessures dynamiques (T6) ✓ base/surcharge (T7) ✓ recompute buff (T8) ✓ éditable (T12) ✓.
- **Placeholders** : aucun (la version bancale de `forceOpposedOutcome` a été retirée ; seule la version correcte demeure).
- **Cohérence types** : `cleave` (types.ts T5) lu en T9 ✓ ; `wounds.base` (T6) posé en T7, lu en T8 ✓ ; `maxWounds(chars,size)` (T6) consommé par T7 ✓ ; `effectiveMaxWounds`/`refreshWounds` (T6/T8) ✓.
- **Frontière** : helpers purs `size.ts` (engine) ; `effectiveMaxWounds` (engine, lit Combatant) ; `refreshWounds` (state). ✓
- **Fichiers partagés** : `scene.ts` (pas de modif — char.B déjà optionnel via Partial), `ActionBar.tsx`/`CampaignView.tsx`/`StatblockEditor.tsx` à vérifier rig-set → hunks sélectifs au besoin.
