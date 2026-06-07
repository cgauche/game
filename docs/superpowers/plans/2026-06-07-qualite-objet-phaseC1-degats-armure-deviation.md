# Phase C1 — Dégâts d'armure + Déviation Critique (synchrone) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Modéliser les **dégâts d'armure** (LDB 63 l.52-55), la qualité d'arme **Taille** (endommage l'armure frappée, l.8), **Bâclé sur armure** (casse sur Critique, LDB 60 l.82), et la **Déviation Critique AUTO des ennemis** (LDB 63 l.63-66 ; décision utilisateur : l'ennemi dévie toujours s'il a de la PA). **Tout est synchrone.**

**Architecture / découverte clé :** les **héros** dérivent `Combatant.armour` (PA par localisation) de leurs `ItemInstance` (`kind:'armor'`) via `recomputeLoadout` ; les **ennemis** ont un `armour` **plat** (statblock, pas d'items). Donc :
- PA effective d'une pièce = `pa − damageTaken` ; `recomputeLoadout` agrège la PA **nette** par localisation (max des pièces).
- `c.armour[loc] > 0` = « a de l'armure utilisable ici » — **valable héros ET ennemis** (héros : net dérivé ; ennemi : plat).
- `damageArmour(c, loc)` : héros → endommage la pièce (`damageTaken+1`) + `recomputeLoadout` ; ennemi (pas d'items) → décrément direct de `c.armour[loc]`.

**Hors périmètre (→ C1b, plan suivant) :** la **modale de Déviation côté JOUEUR** (héros attaqué par un ennemi) — elle doit suspendre `applyAttackResult` en plein milieu (le Critique n'est connu qu'après résolution), ce qui exige un refacto suspend/resume invasif (cf. infra modale `pendingDefense`). Le cas FRÉQUENT (le joueur crite un ennemi → déviation auto) est couvert ici.

**Périmètre fichiers :** `src/engine/items.ts` + `src/engine/qualities/registry.ts` (miens) ; `src/state/combatFlow.ts` (WIP utilisateur — vérifier le diff avant commit).

**Commandes :** `npx vitest run src/engine/items.test.ts src/engine/golden-combat.test.ts src/engine/qualities` · `npm test` · `npm run typecheck`.

---

## Task 1 : Modèle de dégâts d'armure (items.ts)

**Files:** Modify `src/engine/items.ts` ; Test `src/engine/items.test.ts`.

- [ ] **Step 1 : Test (échoue)**

Ajouter à `src/engine/items.test.ts` (le helper `item()` existe déjà) :

```ts
import { recomputeLoadout, totalEncumbrance, maxEncumbrance, itemFromTrapping, weaponWithAmmo, compatibleAmmo, emptyArmour, damageArmour } from './items';
// (étendre l'import existant avec `damageArmour`)

describe('Dégâts d’armure (LDB 63 l.52-55)', () => {
  const heroWith = (items: ItemInstance[]): Combatant =>
    ({ characteristics: { F: 30, E: 30 }, items, armour: emptyArmour() } as unknown as Combatant);

  it('recomputeLoadout dérive la PA NETTE des dégâts (pa − damageTaken, plancher 0)', () => {
    const c = heroWith([item({ kind: 'armor', pa: 3, locs: ['corps'], equipped: true, damageTaken: 1 })]);
    recomputeLoadout(c);
    expect(c.armour.corps).toBe(2); // 3 − 1
  });
  it('pièce réduite à 0 (damageTaken ≥ pa) → n’apporte plus de PA', () => {
    const c = heroWith([item({ kind: 'armor', pa: 2, locs: ['corps'], equipped: true, damageTaken: 5 })]);
    recomputeLoadout(c);
    expect(c.armour.corps).toBe(0);
  });
  it('damageArmour (héros) : endommage la pièce la plus solide à la localisation + re-dérive', () => {
    const c = heroWith([item({ kind: 'armor', pa: 3, locs: ['corps'], equipped: true })]);
    recomputeLoadout(c);
    expect(damageArmour(c, 'corps')).toBe(true);
    expect(c.armour.corps).toBe(2); // 3 → 2
  });
  it('damageArmour (ennemi sans items : armure plate du statblock) : décrément direct', () => {
    const enemy = { armour: { ...emptyArmour(), tete: 2 } } as unknown as Combatant; // pas d'items
    expect(damageArmour(enemy, 'tete')).toBe(true);
    expect(enemy.armour.tete).toBe(1);
  });
  it('damageArmour : pas d’armure utilisable → false', () => {
    expect(damageArmour({ armour: emptyArmour() } as unknown as Combatant, 'corps')).toBe(false);
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `npx vitest run src/engine/items.test.ts`
Expected: FAIL (`damageArmour` absent ; PA non nette).

- [ ] **Step 3 : `recomputeLoadout` dérive la PA nette + `damageArmour`**

Dans `src/engine/items.ts`, remplacer l'agrégation d'armure de `recomputeLoadout` :

```ts
  const armour = emptyArmour();
  for (const it of items) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa || !it.locs) continue;
    for (const l of it.locs) armour[l] = Math.max(armour[l], it.pa);
  }
```

par :

```ts
  const armour = emptyArmour();
  for (const it of items) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa || !it.locs) continue;
    const net = Math.max(0, it.pa - (it.damageTaken ?? 0)); // PA nette des dégâts (LDB 63 l.53)
    for (const l of it.locs) armour[l] = Math.max(armour[l], net);
  }
```

Puis ajouter, après `recomputeLoadout` (avant `damageScore` ou en fin de section armure) :

```ts
/** Endommage de 1 PA l'armure de `c` à la localisation `loc` (LDB 63 l.52-55). Héros : endommage la
 *  pièce la plus solide (damageTaken+1) puis re-dérive ; ennemi/figurant (armure plate, sans items) :
 *  décrément direct. RETOURNE true si une PA a été retirée. */
export function damageArmour(c: Combatant, loc: HitLocation): boolean {
  const pieces = (c.items ?? []).filter(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (pieces.length) {
    const piece = pieces.sort((a, b) => ((b.pa ?? 0) - (b.damageTaken ?? 0)) - ((a.pa ?? 0) - (a.damageTaken ?? 0)))[0];
    piece.damageTaken = (piece.damageTaken ?? 0) + 1;
    recomputeLoadout(c);
    return true;
  }
  // Pas d'ItemInstance d'armure : armure plate du statblock (ennemi/figurant).
  if ((c.armour?.[loc] ?? 0) > 0) {
    c.armour[loc] = c.armour[loc] - 1;
    return true;
  }
  return false;
}
```

- [ ] **Step 4 : Vérifier (items + golden-master)**

Run: `npx vitest run src/engine/items.test.ts src/engine/golden-combat.test.ts`
Expected: PASS — golden-master inchangé (les fixtures n'ont pas d'armure endommagée).

Run: `npm run typecheck` → 0.

- [ ] **Step 5 : Commit**

```bash
git diff --stat src/engine/items.ts
git add src/engine/items.ts src/engine/items.test.ts
git commit -- src/engine/items.ts src/engine/items.test.ts -m "feat(qualities): degats d'armure -- PA nette derivee + damageArmour (heros pieces / ennemis plat)"
```

---

## Task 2 : Qualité d'arme `Taille` au registre

**Files:** Modify `src/engine/qualities/registry.ts` ; Modify `src/engine/qualities/dispatch.test.ts`.

- [ ] **Step 1 : Champ + entrée**

Dans `registry.ts`, ajouter à `QualityDef` (après `testFailDR?: number;`) :

```ts
  /** Arme qui endommage l'armure/le bouclier frappé sur une touche réussie (Taille, LDB 63 l.8). */
  damagesArmour?: boolean;
```

Puis ajouter l'entrée (près des qualités d'arme, ex. après `'À Explosion'`) :

```ts
  'Taille': { key: 'Taille', type: 'Atout', subType: 'Arme', damagesArmour: true },
```

- [ ] **Step 2 : Retirer `Taille` de l'allowlist de parité**

Dans `src/engine/qualities/dispatch.test.ts`, dans `NON_DANS_REGISTRE`, **supprimer** `'Taille',` (désormais enregistrée).

- [ ] **Step 3 : Vérifier**

Run: `npx vitest run src/engine/qualities/dispatch.test.ts`
Expected: PASS (parité OK, Taille connue).

- [ ] **Step 4 : Commit**

```bash
git add src/engine/qualities/registry.ts src/engine/qualities/dispatch.test.ts
git commit -- src/engine/qualities/registry.ts src/engine/qualities/dispatch.test.ts -m "feat(qualities): Taille (arme) enregistree -- endommage l'armure (LDB 63 l.8)"
```

---

## Task 3 : combatFlow — Déviation auto (ennemi) + Taille + Bâclé-armure

**Files:** Modify `src/state/combatFlow.ts` (WIP utilisateur — vérifier le diff avant commit).

- [ ] **Step 1 : Imports**

Ajouter `damageArmour` à l'import items (`import { recomputeLoadout, itemFromTrapping, weaponWithAmmo, compatibleAmmo } from '../engine/items';` → ajouter `damageArmour`), et `woundsFromHit` est déjà importé de `'../engine/combat'`. Ajouter `hasQuality` est déjà importé.

- [ ] **Step 2 : Helper de déviation (au-dessus de `applyAttackResult`)**

Insérer avant `export function applyAttackResult(` :

```ts
/** Déviation Critique (LDB 63 l.63-66) : sacrifie 1 PA à `loc` pour IGNORER le Critique ; la cible
 *  subit quand même les Blessures normales recalculées avec la PA réduite (probable +1 Blessure). */
function deviateArmour(target: Combatant, weapon: Weapon, res: AttackResult, log: string[]): void {
  damageArmour(target, res.location ?? 'corps');
  const extra = Math.max(0, woundsFromHit(weapon, target, res.location ?? 'corps', res.damage ?? 0) - (res.woundsLost ?? 0));
  if (extra) target.wounds.current = Math.max(0, target.wounds.current - extra);
  log.push(`${target.name} dévie le coup sur son armure (−1 PA, Critique ignoré).`);
}
```

- [ ] **Step 3 : Brancher la déviation ennemie + Taille + Bâclé-armure dans `applyAttackResult`**

Remplacer le bloc (combatFlow.ts ~455-464) :

```ts
  if (res.hit && res.woundsLost) {
    const currentBefore = target.wounds.current;
    const overkill = res.woundsLost - currentBefore; // > 0 si le coup dépasse les PB COURANTS (LDB 18 l.30)
    target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
    if (res.critical || overkill > 0) {
      const lethal = applyCriticalToTarget(target, res.location ?? 'corps', !!res.critical, Math.max(0, overkill), critLog);
      if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore); // mort directe ou pause Destin
    } else if (target.wounds.current <= 0) {
      applyZeroWounds(target); // 0 PB sans critique → À Terre (LDB 18 l.28)
    }
  }
```

par :

```ts
  if (res.hit && res.woundsLost) {
    const currentBefore = target.wounds.current;
    const overkill = res.woundsLost - currentBefore; // > 0 si le coup dépasse les PB COURANTS (LDB 18 l.30)
    target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
    const loc = res.location ?? 'corps';
    // Bâclé : une armure Bâclée casse si un Coup Critique frappe sa localisation (LDB 60 l.82).
    if (res.critical) breakBacleArmour(target, loc, critLog);
    if (res.critical && target.kind === 'enemy' && (target.armour[loc] ?? 0) > 0) {
      // Déviation Critique AUTO de l'ennemi (décision utilisateur : dévie toujours s'il a de la PA).
      deviateArmour(target, weapon, res, critLog);
    } else if (res.critical || overkill > 0) {
      const lethal = applyCriticalToTarget(target, loc, !!res.critical, Math.max(0, overkill), critLog);
      if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore); // mort directe ou pause Destin
    } else if (target.wounds.current <= 0) {
      applyZeroWounds(target); // 0 PB sans critique → À Terre (LDB 18 l.28)
    }
  }
```

- [ ] **Step 4 : Helper Bâclé-armure (au-dessus de `applyAttackResult`)**

Insérer (à côté de `deviateArmour`) :

```ts
/** Une armure Bâclée frappée par un Coup Critique à sa localisation casse (LDB 60 l.82) — héros (pièces). */
function breakBacleArmour(target: Combatant, loc: HitLocation, log: string[]): void {
  const piece = (target.items ?? []).find(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && hasQuality(i, 'Bâclé') && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (!piece) return;
  piece.damageTaken = piece.pa ?? 0; // inutilisable
  recomputeLoadout(target);
  log.push(`L'armure Bâclée de ${target.name} (${loc}) se brise sous le Coup Critique.`);
}
```

- [ ] **Step 5 : Taille — l'arme endommage l'armure sur une touche réussie**

Après le bloc de Blessures (après l'accolade fermante du `if (res.hit && res.woundsLost)`), insérer :

```ts
  // Taille (arme) : sur une touche réussie, endommage de 1 PA l'armure frappée (LDB 63 l.8).
  if (res.hit && hasQuality(weapon, 'Taille')) damageArmour(target, res.location ?? 'corps');
```

*(Note : si `damageArmour` est appelé après une déviation, il endommage une 2e PA — conforme : Taille + Critique dévié peuvent cumuler. Acceptable.)*

- [ ] **Step 6 : Vérifier (suite complète + golden + types)**

Run: `npm test`
Expected: PASS — golden-master matched (les combats seedés n'ont ni Taille ni armure ennemie endommageable critique).

Run: `npm run typecheck` → 0.

- [ ] **Step 7 : Vérifier le diff (hors WIP) + Commit**

```bash
git diff --stat src/state/combatFlow.ts   # confirmer que seules mes lignes changent
git add src/state/combatFlow.ts
git commit -- src/state/combatFlow.ts -m "feat(qualites): deviation Critique auto (ennemi) + Taille endommage l'armure + Bacle-armure casse (LDB 63/60)"
```

---

## Fin — différé

- **C1b — Modale de Déviation côté JOUEUR** (héros critiqué par un ennemi) : suspend `applyAttackResult` (nouveau `pendingDeviation`, store+UI, façon `pendingDefense`) → choix *Dévier (−1 PA)* / *Subir*. Refacto suspend/resume + recette navigateur. Plan séparé.
- **Réparation d'armure** (10 %/PA — LDB 63 l.97) = service Marchand (#2).
- **C2** : Pratique/Peu Fiable hors combat (`itemUid`), pénalités de port d'armure + Laid (-10 Soc).
- **C3** : Atouts/Défauts d'armure intrinsèques (Flexible/Impénétrable/Partielle/Points Faibles).

## Self-review

- **Couverture** : dégâts d'armure (Task 1), Taille (Task 2+3.5), Déviation auto ennemi (Task 3.3), Bâclé-armure (Task 3.4). Modale joueur explicitement différée (C1b). ✓
- **Placeholders** : aucun — code exact + commandes. ✓
- **Types** : `damageArmour`/`woundsFromHit`/`hasQuality` réutilisés ; `damagesArmour` ajouté au `QualityDef` (Task 2) lu via `hasQuality(weapon,'Taille')` (Task 3). `c.armour[loc]` unifie héros (net dérivé) et ennemi (plat). ✓
- **Risque** : `combatFlow.ts` est le WIP utilisateur → vérifier le diff (Task 3.7). Le golden-master garde l'iso-comportement (aucune fixture n'a Taille/armure-ennemie-critique). ✓
