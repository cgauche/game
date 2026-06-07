# Phase A — Qualité d'objet (artisanat) : données & économie — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enregistrer les 8 qualités d'artisanat (LDB 60) comme entrées de registre + fournir les **fonctions économiques pures** (prix ×2/÷2, Disponibilité ∓1 cran, classe de qualité) et l'effet d'**encombrement** (Léger −1 / Volumineux +1) — le socle moteur que le **Marchand (#2)** consommera.

**Architecture :** Sur la fondation Phase 0 (`src/engine/qualities/`), les qualités d'objet sont des entrées `subType: 'Objet'`. Un nouveau module **pur** `craftEconomy.ts` calcule prix/dispo/classe à partir des qualités résolues (filtrées `Objet`). `items.ts:totalEncumbrance` applique le délta d'Enc. Aucun effet COMBAT ici (Solide/Bâclé/Pratique/Peu Fiable/Laid = plans B/C suivants) ; aucun affichage (plan UI suivant) ; identification/révélation = plan #2 (Marchand).

**Tech Stack :** TypeScript, Vitest, moteur pur. **Périmètre hors WIP** : `src/engine/qualities/` (mien) + `src/engine/items.ts` (mien). Si `items.ts` porte du WIP parallèle à la migration, committer via `git commit -- <chemins>` après vérif du diff.

**Commandes :** ciblé `npx vitest run src/engine/qualities src/engine/items.test.ts` · suite `npm test` · types `npm run typecheck`.

---

## File Structure

- **Modify** `src/engine/qualities/registry.ts` — +`encDelta?: number` sur `QualityDef` ; +7 entrées d'artisanat (Solide déjà présent).
- **Create** `src/engine/qualities/craftEconomy.ts` — fonctions pures : comptage Atouts/Défauts d'objet, `craftPriceFactor`, `craftEncDelta`, `shiftAvailability`, `qualityClass`.
- **Create** `src/engine/qualities/craftEconomy.test.ts` — tests (exemples canon LDB 60).
- **Modify** `src/engine/items.ts` — `totalEncumbrance` applique `craftEncDelta` + règle Volumineux-porté.
- **Create/Modify** `src/engine/items.test.ts` — tests d'encombrement d'artisanat (créer le fichier s'il n'existe pas).

---

## Task 1 : Enregistrer les 8 qualités d'artisanat

**Files:**
- Modify: `src/engine/qualities/registry.ts`
- Test: `src/engine/qualities/dispatch.test.ts` (ajout)

- [ ] **Step 1 : Ajouter le champ `encDelta` à `QualityDef`**

Dans `registry.ts`, après la ligne `onHit?: { ... };` (fin de l'interface, avant le `}` fermant de `QualityDef`), ajouter :

```ts
  /** Encombrement : délta dû à l'artisanat (Léger -1 / Volumineux +1, LDB 60 l.56/91). */
  encDelta?: number;
```

- [ ] **Step 2 : Enregistrer les 7 qualités manquantes (Solide existe déjà)**

Dans `registry.ts`, juste après l'entrée `'Solide': { key: 'Solide', type: 'Atout', subType: 'Objet' },`, insérer :

```ts
  // --- Qualités d'OBJET (artisanat, LDB 60 l.43-92). Économie : chaque Atout ×2 prix / -1 dispo,
  //     chaque Défaut ÷2 prix / +1 dispo (couche pure craftEconomy.ts). Effets COMBAT = plans B/C. ---
  'Léger': { key: 'Léger', type: 'Atout', subType: 'Objet', encDelta: -1 }, // -1 Enc (l.56)
  'Pratique': { key: 'Pratique', type: 'Atout', subType: 'Objet' }, // +1 DR à un test raté (effet = Phase B/C)
  'Raffiné': { key: 'Raffiné', type: 'Atout', subType: 'Objet' }, // signe de statut, cumulable (l.61) — pas d'effet de test
  'Bâclé': { key: 'Bâclé', type: 'Défaut', subType: 'Objet' }, // casse sur test raté-double (effet = Phase B/C)
  'Laid': { key: 'Laid', type: 'Défaut', subType: 'Objet' }, // -10 Tests de Sociabilité (effet = Phase C)
  'Peu Fiable': { key: 'Peu Fiable', type: 'Défaut', subType: 'Objet' }, // -1 DR à un test raté (effet = Phase B/C)
  'Volumineux': { key: 'Volumineux', type: 'Défaut', subType: 'Objet', encDelta: 1 }, // +1 Enc ; porté = Enc 1 (l.91)
```

- [ ] **Step 3 : Ajouter un test de présence (dispatch.test.ts)**

Dans `src/engine/qualities/dispatch.test.ts`, dans le `describe('registry — entrées attendues', ...)`, étendre la boucle `for (const k of [...])` pour inclure les 8 qualités d'artisanat. Remplacer la ligne :

```ts
    for (const k of ['Précise', 'Perforante', 'Pointue', 'Empaleuse', 'Défensive', 'À Enroulement', 'Pistolet', 'Incassable', 'Inoffensive', 'Dévastatrice', 'Percutante']) {
```

par :

```ts
    for (const k of ['Précise', 'Perforante', 'Pointue', 'Empaleuse', 'Défensive', 'À Enroulement', 'Pistolet', 'Incassable', 'Inoffensive', 'Dévastatrice', 'Percutante',
      'Léger', 'Pratique', 'Raffiné', 'Solide', 'Bâclé', 'Laid', 'Peu Fiable', 'Volumineux']) {
```

- [ ] **Step 4 : Vérifier**

Run: `npx vitest run src/engine/qualities/dispatch.test.ts`
Expected: PASS (toutes les entrées présentes).

- [ ] **Step 5 : Commit**

```bash
git add src/engine/qualities/registry.ts src/engine/qualities/dispatch.test.ts
git commit -- src/engine/qualities/registry.ts src/engine/qualities/dispatch.test.ts -m "feat(qualities): enregistre les 8 qualités d'artisanat (Objet) + champ encDelta"
```

---

## Task 2 : Fonctions économiques pures (`craftEconomy.ts`)

**Files:**
- Create: `src/engine/qualities/craftEconomy.ts`
- Test: `src/engine/qualities/craftEconomy.test.ts`

- [ ] **Step 1 : Écrire les tests (échouent : module absent)**

```ts
import { describe, it, expect } from 'vitest';
import { craftPriceFactor, craftEncDelta, shiftAvailability, qualityClass, craftAtoutCount, craftDefautCount } from './craftEconomy';

const it_ = (qualities: string[]) => ({ qualities });

describe('craftEconomy — comptage & prix (LDB 60 l.47/75)', () => {
  it('compte les Atouts/Défauts d’OBJET seulement (ignore les qualités d’arme)', () => {
    expect(craftAtoutCount(it_(['Raffiné', 'Solide 3', 'Empaleuse']))).toBe(2); // Empaleuse = Arme, ignorée
    expect(craftDefautCount(it_(['Volumineux', 'Peu Fiable']))).toBe(2);
  });
  it('prix : chaque Atout ×2, chaque Défaut ÷2', () => {
    expect(craftPriceFactor(it_([]))).toBe(1);
    expect(craftPriceFactor(it_(['Raffiné', 'Solide 1']))).toBe(4); // 2 Atouts → ×4 (exemple pelle, l.53)
    expect(craftPriceFactor(it_(['Volumineux', 'Peu Fiable']))).toBe(0.25); // 2 Défauts → ¼ (exemple cotte, l.79)
  });
});

describe('craftEconomy — Disponibilité (LDB 60 l.47/75/77, échelle Commune<Limitée<Rare<Exotique)', () => {
  it('Atouts rendent plus RARE, Défauts plus COURANT', () => {
    expect(shiftAvailability('Commune', it_(['Raffiné', 'Solide 1']))).toBe('Rare'); // +2 (pelle Commune→Rare)
    expect(shiftAvailability('Rare', it_(['Volumineux', 'Peu Fiable']))).toBe('Commune'); // -2 (cotte Rare→Commune)
  });
  it('Exotique non rendu plus courant par un Défaut (l.77)', () => {
    expect(shiftAvailability('Exotique', it_(['Bâclé']))).toBe('Exotique');
  });
  it('plafonné aux bornes', () => {
    expect(shiftAvailability('Commune', it_(['Bâclé', 'Laid']))).toBe('Commune'); // déjà au plus courant
    expect(shiftAvailability('Rare', it_(['Raffiné', 'Solide 1', 'Léger']))).toBe('Exotique'); // +3 plafonné
  });
  it('option Guilde : Défauts réduisent la dispo, 1er Atout ne la réduit pas (l.69-72)', () => {
    expect(shiftAvailability('Rare', it_(['Volumineux']), { guild: true })).toBe('Limitée'); // Défaut -1
    expect(shiftAvailability('Limitée', it_(['Raffiné']), { guild: true })).toBe('Limitée'); // 1er Atout : pas de réduction
    expect(shiftAvailability('Limitée', it_(['Raffiné', 'Solide 1']), { guild: true })).toBe('Rare'); // 2e Atout réduit
  });
});

describe('craftEncDelta (Léger -1 / Volumineux +1, LDB 60 l.56/91)', () => {
  it('somme les déltas d’Enc des qualités d’artisanat', () => {
    expect(craftEncDelta(it_(['Léger']))).toBe(-1);
    expect(craftEncDelta(it_(['Volumineux']))).toBe(1);
    expect(craftEncDelta(it_(['Léger', 'Volumineux']))).toBe(0);
    expect(craftEncDelta(it_(['Empaleuse']))).toBe(0); // qualité d'arme : pas de délta
  });
});

describe('qualityClass (LDB 60 l.44/46/74)', () => {
  it('Haute Qualité = 0 Défaut ET plus d’Atouts que l’Enc', () => {
    expect(qualityClass(it_(['Raffiné', 'Solide 1', 'Léger']), 2)).toBe('Haute Qualité'); // 3 Atouts > Enc 2, 0 Défaut
    expect(qualityClass(it_(['Raffiné', 'Solide 1']), 2)).toBe('Qualité'); // 2 Atouts = Enc 2 (pas >)
  });
  it('Qualité / Défectueuse / Standard', () => {
    expect(qualityClass(it_(['Raffiné']), 5)).toBe('Qualité'); // plus d'Atouts
    expect(qualityClass(it_(['Bâclé', 'Laid']), 5)).toBe('Défectueuse'); // plus de Défauts
    expect(qualityClass(it_(['Raffiné', 'Bâclé']), 5)).toBe('Standard'); // égalité
    expect(qualityClass(it_([]), 5)).toBe('Standard');
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `npx vitest run src/engine/qualities/craftEconomy.test.ts`
Expected: FAIL — « Failed to resolve import './craftEconomy' ».

- [ ] **Step 3 : Écrire `craftEconomy.ts`**

```ts
/**
 * Couche ÉCONOMIQUE des qualités d'OBJET (artisanat, LDB 60 l.43-92). Pure, sans état :
 * renvoie des FACTEURS / déltas que le Marchand (#2) applique aux prix/disponibilités catalogue.
 * N'agit que sur les qualités `subType: 'Objet'` (les qualités d'arme/armure n'altèrent pas le prix).
 */
import { resolveQualities } from './dispatch';

export type Availability = 'Commune' | 'Limitée' | 'Rare' | 'Exotique';
/** Échelle du plus COURANT au plus RARE (LDB 59). */
export const AVAILABILITY_LADDER: Availability[] = ['Commune', 'Limitée', 'Rare', 'Exotique'];

type Carrier = { qualities: string[] };

const craftDefs = (c: Carrier | undefined) => resolveQualities(c).filter((r) => r.def.subType === 'Objet');

/** Nombre d'Atouts d'objet (multiplicité = répétition dans la liste). */
export function craftAtoutCount(c: Carrier | undefined): number {
  return craftDefs(c).filter((r) => r.def.type === 'Atout').length;
}
/** Nombre de Défauts d'objet. */
export function craftDefautCount(c: Carrier | undefined): number {
  return craftDefs(c).filter((r) => r.def.type === 'Défaut').length;
}

/** Facteur multiplicatif du prix : chaque Atout ×2, chaque Défaut ÷2 (LDB 60 l.47/75). */
export function craftPriceFactor(c: Carrier | undefined): number {
  return 2 ** craftAtoutCount(c) * 0.5 ** craftDefautCount(c);
}

/** Délta d'Encombrement dû à l'artisanat (Léger -1 / Volumineux +1, LDB 60 l.56/91). */
export function craftEncDelta(c: Carrier | undefined): number {
  return resolveQualities(c).reduce((s, r) => s + (r.def.encDelta ?? 0), 0);
}

/**
 * Disponibilité après modification par l'artisanat : chaque Atout rend +1 cran plus RARE, chaque
 * Défaut +1 cran plus COURANT (LDB 60 l.47/75). Exception : Exotique n'est pas rendu plus courant
 * par un Défaut (l.77). Option Guilde (l.69-72) : les Défauts RÉDUISENT la dispo et le 1er Atout ne
 * la réduit pas.
 */
export function shiftAvailability(base: Availability, c: Carrier | undefined, opts: { guild?: boolean } = {}): Availability {
  const atouts = craftAtoutCount(c);
  const defauts = craftDefautCount(c);
  let idx = AVAILABILITY_LADDER.indexOf(base);
  if (idx < 0) return base;
  if (opts.guild) {
    idx += Math.max(0, atouts - 1); // le 1er Atout ne réduit pas la dispo
    idx -= defauts; // les Défauts réduisent la dispo
  } else {
    idx += atouts;
    if (base !== 'Exotique') idx -= defauts; // Exotique : non rendu plus courant par un Défaut
  }
  return AVAILABILITY_LADDER[Math.max(0, Math.min(AVAILABILITY_LADDER.length - 1, idx))];
}

/**
 * Classe de qualité (LDB 60 l.44/46/74) : **Haute Qualité** = aucun Défaut ET plus d'Atouts que
 * l'Encombrement ; **Qualité** = plus d'Atouts que de Défauts ; **Défectueuse** = l'inverse ;
 * sinon **Standard**. `enc` = Encombrement de base de l'objet.
 */
export function qualityClass(c: Carrier | undefined, enc: number): 'Haute Qualité' | 'Qualité' | 'Défectueuse' | 'Standard' {
  const a = craftAtoutCount(c);
  const d = craftDefautCount(c);
  if (d === 0 && a > enc) return 'Haute Qualité';
  if (a > d) return 'Qualité';
  if (d > a) return 'Défectueuse';
  return 'Standard';
}
```

- [ ] **Step 4 : Vérifier**

Run: `npx vitest run src/engine/qualities/craftEconomy.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/engine/qualities/craftEconomy.ts src/engine/qualities/craftEconomy.test.ts
git commit -- src/engine/qualities/craftEconomy.ts src/engine/qualities/craftEconomy.test.ts -m "feat(qualities): couche économique pure d'artisanat (prix/dispo/classe) — prête pour le Marchand"
```

---

## Task 3 : Encombrement — Léger / Volumineux

**Files:**
- Modify: `src/engine/items.ts`
- Test: `src/engine/items.test.ts`

- [ ] **Step 1 : Écrire le test (échoue : effet non appliqué)**

Créer (ou ajouter à) `src/engine/items.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { totalEncumbrance } from './items';
import type { Combatant, ItemInstance } from './types';

const item = (over: Partial<ItemInstance>): ItemInstance => ({ uid: 'u', name: 'x', kind: 'misc', qualities: [], enc: 0, equipped: false, ...over });
const withItems = (items: ItemInstance[]): Combatant => ({ items } as unknown as Combatant);

describe('totalEncumbrance — qualités d’artisanat (LDB 60 l.56/91)', () => {
  it('Léger réduit l’Enc de 1 (plancher 0)', () => {
    expect(totalEncumbrance(withItems([item({ kind: 'misc', enc: 2, qualities: ['Léger'] })]))).toBe(1);
    expect(totalEncumbrance(withItems([item({ kind: 'misc', enc: 1, qualities: ['Léger'] })]))).toBe(0);
  });
  it('Volumineux augmente l’Enc de 1 (objet NON porté)', () => {
    expect(totalEncumbrance(withItems([item({ kind: 'melee', enc: 2, qualities: ['Volumineux'] })]))).toBe(3);
  });
  it('armure portée : -1 (règle existante) ; Volumineux portée = Enc 1 (l.91)', () => {
    expect(totalEncumbrance(withItems([item({ kind: 'armor', enc: 2, equipped: true })]))).toBe(1); // 2 - 1 (inchangé)
    expect(totalEncumbrance(withItems([item({ kind: 'armor', enc: 2, equipped: true, qualities: ['Volumineux'] })]))).toBe(1); // forcé à 1
    expect(totalEncumbrance(withItems([item({ kind: 'armor', enc: 3, equipped: true, qualities: ['Léger'] })]))).toBe(1); // (3-1) -1 porté = 1
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `npx vitest run src/engine/items.test.ts`
Expected: FAIL (Volumineux/Léger non pris en compte → valeurs erronées).

- [ ] **Step 3 : Appliquer `craftEncDelta` + règle Volumineux-porté dans `totalEncumbrance`**

Dans `src/engine/items.ts`, ajouter l'import sous la ligne `import { indiceOf } from './qualities/normalize';` :

```ts
import { craftEncDelta } from './qualities/craftEconomy';
import { hasQuality } from './qualities/dispatch';
```

Puis remplacer le corps de `totalEncumbrance` :

```ts
export function totalEncumbrance(c: Combatant): number {
  return (c.items ?? []).reduce((s, i) => {
    const worn = !!i.equipped && i.kind === 'armor';
    return s + Math.max(0, (i.enc || 0) - (worn ? 1 : 0));
  }, 0);
}
```

par :

```ts
export function totalEncumbrance(c: Combatant): number {
  return (c.items ?? []).reduce((s, i) => {
    const enc = (i.enc || 0) + craftEncDelta(i); // Léger -1 / Volumineux +1 (LDB 60 l.56/91)
    const worn = !!i.equipped && i.kind === 'armor';
    // Objet porté : -1 (LDB Enc l.22) ; une armure Volumineux portée vaut Enc 1 (LDB 60 l.91).
    const eff = worn ? (hasQuality(i, 'Volumineux') ? 1 : enc - 1) : enc;
    return s + Math.max(0, eff);
  }, 0);
}
```

- [ ] **Step 4 : Vérifier (test ciblé + golden-master + suite)**

Run: `npx vitest run src/engine/items.test.ts src/engine/golden-combat.test.ts`
Expected: PASS (golden-master inchangé — l'encombrement n'affecte pas les combats seedés sans items d'artisanat).

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 5 : Vérifier le diff (items.ts hors WIP) puis Commit**

```bash
git diff --stat src/engine/items.ts   # doit ne montrer QUE cet ajout
git add src/engine/items.ts src/engine/items.test.ts
git commit -- src/engine/items.ts src/engine/items.test.ts -m "feat(qualities): encombrement d'artisanat (Léger -1 / Volumineux +1, porté = 1)"
```

---

## Validation finale

- [ ] `npm test` → tout vert (golden-master matched, +nouveaux tests d'artisanat).
- [ ] `npm run typecheck` → 0.

---

## Fin — suites (plans ultérieurs)

- **Phase A-UI** : afficher la classe de qualité + badges Atouts/Défauts d'objet dans `CharacterSheet.tsx` (`itemStats`), + « qualité inconnue » (dépend du flag d'identification de #2).
- **Phase B** : effets COMBAT des qualités d'artisanat sur ARMES — Solide(N) (absorption + sauvegarde 9+ via `qualityIndice`), Bâclé (casse sur maladresse), Pratique/Peu Fiable (±1 DR sur attaque ratée) — comme hooks de registre (cf. `onHit`/`qualityDamageStep`).
- **Phase C1** : dégâts d'armure (réutiliser `ItemInstance.damageTaken`) + Déviation Critique (l'IA dévie toujours) + Taille/Bâclé sur armure.
- **Phase C2/C3** : `itemUid` sur `Effect.test` (Pratique/Peu Fiable hors combat), pénalités de port d'armure + Laid (-10 Soc), Atouts/Défauts d'armure intrinsèques (Flexible/Impénétrable/Partielle/Points Faibles).
- **#2 — Marchand** : consomme `craftPriceFactor`/`shiftAvailability`/`qualityClass` ; génère des items d'artisanat ; identification/révélation par Évaluation. Réf. spec `docs/superpowers/specs/2026-06-07-qualite-objet-fabrication-design.md`.

## Self-review (writing-plans)

- **Couverture spec §4-5 (Phase A « Données & économie »)** : registre des 8 qualités (Task 1), économie pure prix/dispo/classe (Task 2), encombrement Léger/Volumineux + réconciliation porté/Volumineux=1 (Task 3). Identification + affichage explicitement reportés (Fin). ✓
- **Placeholders** : aucun — code exact + commandes + sorties attendues à chaque étape. ✓
- **Cohérence des types** : `craftAtoutCount`/`craftDefautCount`/`craftPriceFactor`/`craftEncDelta`/`shiftAvailability`/`qualityClass`/`Availability` définis en Task 2, utilisés tels quels (Task 3 importe `craftEncDelta`). `encDelta` ajouté à `QualityDef` (Task 1) lu par `craftEncDelta` (Task 2). `resolveQualities` (Phase 0) filtré `subType==='Objet'`. ✓
- **Risque** : `shiftAvailability` doit reproduire les 2 exemples canon (pelle Commune→Rare, cotte Rare→Commune) — couverts par les tests. `items.ts` peut porter du WIP parallèle → vérifier le diff avant commit (Task 3 Step 5). ✓
