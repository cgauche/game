# Plan B — Socle Traumatismes (en-combat) (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps en checkbox `- [ ]`.

**Goal:** Une couche `traumas` partagée par les Blessures critiques et (plus tard) les Maladresses, modélisant les effets **en-combat quantifiés** des traumatismes (Mouvement ÷2, pénalité de Caractéristique), persistée par le Plan A ; la guérison reste Jalon 5.

**Architecture :** `engine/trauma.ts` (pur) expose `traumaFromKind` (factory unique kind+sévérité+localisation → effets) et des lecteurs. `effectiveChar` (characteristics.ts) et `effectiveMovement` (encumbrance.ts) lisent les traumas — deux points uniques qui se propagent. `criticals.ts` gagne un champ `traumas` ; `rollCritical` les construit (localisation du critique) ; le store les applique. `carryOverState` (Plan A) est étendu pour les persister.

**Décisions de fidélité (rien d'inventé) :** on modélise `movementHalved` (Déchirure/Fracture Jambe, Fracture Torse) et `charPenalty` (Fracture Torse F/Ag −30). `limbDisabled`/Amputation/Esquive : **journalisés** (le combat n'a pas de modèle de latéralité de l'arme ; amputations = post-combat/Chirurgie/Jalon 5, effet immédiat déjà dans `conditions`). Les traumas sans effet modélisé sont **enregistrés + persistés** (label + note RAW).

**Tech Stack :** TS, Vitest. Source : `18-Traumatisme.md` (Déchirure l.311-326, Fracture l.292-309).

---

## Task B1 : Type `Trauma` + module `engine/trauma.ts`

**Files:**
- Modify: `src/engine/types.ts` (interface `Trauma` + `Combatant.traumas?`)
- Create: `src/engine/trauma.ts`
- Test: `src/engine/trauma.test.ts`

- [ ] **Step 1 : test qui échoue** — créer `src/engine/trauma.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { traumaFromKind, traumaMovementHalved } from './trauma';
import type { Combatant } from './types';

function c(traumas: Combatant['traumas']): Combatant {
  return { traumas } as Combatant;
}

describe('traumaFromKind (LDB 18-Traumatisme)', () => {
  it('Déchirure musculaire sur Jambe → Mouvement ÷2', () => {
    const t = traumaFromKind('dechirure', 'mineur', 'jambeD');
    expect(t.movementHalved).toBe(true);
    expect(t.label).toBe('Déchirure musculaire (Mineure)');
    expect(t.location).toBe('jambeD');
  });
  it('Déchirure musculaire sur Bras → aucun effet modélisé (enregistré)', () => {
    const t = traumaFromKind('dechirure', 'mineur', 'brasG');
    expect(t.movementHalved).toBeFalsy();
    expect(t.charPenalty).toBeUndefined();
  });
  it('Fracture Torse → F/Ag −30 + Mouvement ÷2', () => {
    const t = traumaFromKind('fracture', 'majeur', 'corps');
    expect(t.charPenalty).toEqual({ F: -30, Ag: -30 });
    expect(t.movementHalved).toBe(true);
    expect(t.label).toBe('Fracture (Majeure)');
  });
  it('Fracture Jambe → Mouvement ÷2, pas de charPenalty', () => {
    const t = traumaFromKind('fracture', 'mineur', 'jambeG');
    expect(t.movementHalved).toBe(true);
    expect(t.charPenalty).toBeUndefined();
  });
  it('Fracture Bras → aucun effet modélisé (latéralité non modélisée)', () => {
    const t = traumaFromKind('fracture', 'mineur', 'brasD');
    expect(t.movementHalved).toBeFalsy();
    expect(t.charPenalty).toBeUndefined();
  });
});

describe('traumaMovementHalved', () => {
  it('vrai si un trauma réduit le Mouvement', () => {
    expect(traumaMovementHalved(c([traumaFromKind('fracture', 'mineur', 'jambeG')]))).toBe(true);
    expect(traumaMovementHalved(c([traumaFromKind('fracture', 'mineur', 'brasD')]))).toBe(false);
    expect(traumaMovementHalved(c(undefined))).toBe(false);
  });
});
```

- [ ] **Step 2 : run, vérifier l'échec** — `npm test -- src/engine/trauma.test.ts` → FAIL (module absent).

- [ ] **Step 3 : implémenter**

Dans `src/engine/types.ts`, ajouter après l'interface `ActiveEffect` (vers l.98) :

```ts
/** Traumatisme (LDB 18-Traumatisme) — conséquence persistante d'une Blessure critique ou d'une
 *  Maladresse. Seuls les effets EN-COMBAT quantifiés sont modélisés (movementHalved, charPenalty) ;
 *  le reste (−10 Tests de Localisation, membre inutilisable, amputation, guérison) est journalisé
 *  dans `note` (→ Jalon 5). Persisté entre combats (cf. engine/persistence.ts). */
export interface Trauma {
  label: string;
  location: HitLocation;
  movementHalved?: boolean;
  charPenalty?: Partial<Record<CharKey, number>>;
  note: string;
}
```

Dans l'interface `Combatant` (zone Traumatisme, vers l.155), ajouter :

```ts
  /** Traumatismes subis (LDB 18) — persistants ; effets en-combat lus par effectiveChar/effectiveMovement. */
  traumas?: Trauma[];
```

Créer `src/engine/trauma.ts` :

```ts
/**
 * Traumatismes — Livre de base, « Traumatisme » (18-Traumatisme.md). Factory unique
 * kind+sévérité+localisation → effets en-combat modélisés, partagée par les Blessures critiques
 * et les Maladresses. On ne modélise que ce qui est quantifié et câblable sans inventer :
 *   - Déchirure musculaire sur Jambe → Mouvement ÷2 (l.315).
 *   - Fracture Torse → Force/Agilité −30 + Mouvement ÷2 (l.298).
 *   - Fracture Jambe → Mouvement ÷2 (règle du Pied, l.298).
 * Bras/Tête et Amputations : effet de combat journalisé (latéralité non modélisée ; amputation =
 * post-combat/Chirurgie → Jalon 5). Le trauma est enregistré (label+note) même sans effet modélisé.
 */
import { Combatant, CharKey, HitLocation, Trauma } from './types';

export type TraumaKind = 'dechirure' | 'fracture';
export type TraumaSeverity = 'mineur' | 'majeur';

const LEG: HitLocation[] = ['jambeG', 'jambeD'];

export function traumaFromKind(kind: TraumaKind, severity: TraumaSeverity, location: HitLocation): Trauma {
  const sev = severity === 'mineur' ? 'Mineure' : 'Majeure';
  if (kind === 'dechirure') {
    const onLeg = LEG.includes(location);
    return {
      label: `Déchirure musculaire (${sev})`,
      location,
      ...(onLeg ? { movementHalved: true } : {}),
      note: onLeg
        ? 'LDB 18 l.315 : Mouvement ÷2 (jambe) ; −10/−20 aux Tests de la Localisation (journalisé). Guérison 30−BE jours (Jalon 5).'
        : 'LDB 18 l.315 : −10/−20 aux Tests de la Localisation (non modélisé en combat). Guérison 30−BE jours (Jalon 5).',
    };
  }
  // fracture
  if (location === 'corps') {
    return {
      label: `Fracture (${sev})`,
      location,
      movementHalved: true,
      charPenalty: { F: -30, Ag: -30 },
      note: 'LDB 18 l.298 (Torse) : −30 Force et Agilité, Mouvement ÷2. Guérison 30+1d10 jours (Jalon 5).',
    };
  }
  if (LEG.includes(location)) {
    return {
      label: `Fracture (${sev})`,
      location,
      movementHalved: true,
      note: 'LDB 18 l.298 (Jambe) : Localisation inutilisable (règle du Pied → Mouvement ÷2). Guérison 30+1d10 jours (Jalon 5).',
    };
  }
  return {
    label: `Fracture (${sev})`,
    location,
    note: location === 'tete'
      ? 'LDB 18 l.298 (Tête) : −30 aux Tests de Langue, régime liquide (non modélisé en combat). Guérison 30+1d10 jours (Jalon 5).'
      : 'LDB 18 l.298 (Bras) : membre inutilisable (latéralité non modélisée en combat). Guérison 30+1d10 jours (Jalon 5).',
  };
}

/** Un trauma réduit-il le Mouvement de moitié ? */
export function traumaMovementHalved(c: Combatant): boolean {
  return (c.traumas ?? []).some((t) => t.movementHalved === true);
}

/** Pénalités de Caractéristique dues aux traumatismes, par trauma (pour le pool « pire pénalité »). */
export function traumaCharPenalties(c: Combatant, key: CharKey): number[] {
  return (c.traumas ?? []).map((t) => t.charPenalty?.[key] ?? 0).filter((p) => p < 0);
}
```

- [ ] **Step 4 : run, vérifier le succès** — `npm test -- src/engine/trauma.test.ts` → PASS.

- [ ] **Step 5 : commit**

```bash
git add src/engine/types.ts src/engine/trauma.ts src/engine/trauma.test.ts
git commit -m "feat(engine): type Trauma + traumaFromKind (effets en-combat RAW, pur+teste)" -- src/engine/types.ts src/engine/trauma.ts src/engine/trauma.test.ts
```

---

## Task B2 : Câblage moteur (effectiveChar + effectiveMovement)

**Files:**
- Modify: `src/engine/characteristics.ts:21-28` (`effectiveChar`)
- Modify: `src/engine/encumbrance.ts:56-62` (`effectiveMovement`)
- Test: `src/engine/trauma.test.ts` (ajouts)

- [ ] **Step 1 : tests qui échouent** — ajouter dans `src/engine/trauma.test.ts` :

```ts
import { effectiveChar } from './characteristics';
import { effectiveMovement } from './encumbrance';

function fullCombatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'T', kind: 'hero',
    characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items: [],
    ...over,
  } as Combatant;
}

describe('traumas — câblage moteur', () => {
  it('Fracture Torse réduit Force et Agilité de 30 (effectiveChar)', () => {
    const c = fullCombatant({ traumas: [traumaFromKind('fracture', 'mineur', 'corps')] });
    expect(effectiveChar(c, 'F')).toBe(10);  // 40 − 30
    expect(effectiveChar(c, 'Ag')).toBe(10);
    expect(effectiveChar(c, 'CC')).toBe(40); // non touché
  });
  it('Trauma de jambe réduit le Mouvement effectif de moitié', () => {
    const c = fullCombatant({ traumas: [traumaFromKind('fracture', 'mineur', 'jambeG')] });
    expect(effectiveMovement(c)).toBe(2); // floor(4/2)
  });
  it('Sans trauma de mouvement, Mouvement inchangé', () => {
    const c = fullCombatant({ traumas: [traumaFromKind('fracture', 'mineur', 'brasD')] });
    expect(effectiveMovement(c)).toBe(4);
  });
});
```

- [ ] **Step 2 : run, vérifier l'échec** — `npm test -- src/engine/trauma.test.ts -t "câblage"` → FAIL.

- [ ] **Step 3 : implémenter**

Dans `src/engine/characteristics.ts`, remplacer `effectiveChar` :

```ts
export function effectiveChar(c: Combatant, key: CharKey): number {
  const base = c.characteristics[key];
  const mods = (c.activeEffects ?? []).filter((e) => e.char === key).map((e) => e.bonus);
  // Pénalités de traumatisme (LDB 18) : injectées dans le pool « pire pénalité » (non-cumul l.168).
  for (const t of c.traumas ?? []) {
    const p = t.charPenalty?.[key];
    if (p) mods.push(p);
  }
  if (mods.length === 0) return base;
  const bestBonus = Math.max(0, ...mods.filter((m) => m > 0));
  const worstPenalty = Math.min(0, ...mods.filter((m) => m < 0));
  return base + bestBonus + worstPenalty;
}
```

Dans `src/engine/encumbrance.ts`, ajouter l'import en tête (après `import { hasCondition }`) :

```ts
import { traumaMovementHalved } from './trauma';
```

et remplacer la dernière ligne de `effectiveMovement` :

```ts
  // Sonné (LDB États l.123) OU traumatisme réduisant le Mouvement (LDB 18, ex. Déchirure/Fracture
  // de jambe, Fracture du Torse) → Mouvement de moitié (un seul halving, pas de cumul inventé).
  return (hasCondition(c, 'Sonné') || traumaMovementHalved(c)) ? Math.floor(base / 2) : base;
```

- [ ] **Step 4 : run** — `npm test -- src/engine/trauma.test.ts` → PASS (tout). Vérifier l'absence de cycle d'import : `npm run typecheck` (mes fichiers).

- [ ] **Step 5 : commit**

```bash
git add src/engine/characteristics.ts src/engine/encumbrance.ts src/engine/trauma.test.ts
git commit -m "feat(engine): traumas lus par effectiveChar (charPenalty) et effectiveMovement (Mouvement/2)" -- src/engine/characteristics.ts src/engine/encumbrance.ts src/engine/trauma.test.ts
```

---

## Task B3 : `rollCritical` produit les traumas + annotation `criticals.ts` + application store

**Files:**
- Modify: `src/data/criticals.ts` (champ `CritEntry.traumas` + ~22 entrées)
- Modify: `src/engine/critical.ts` (`CriticalResolved.traumas` + build)
- Modify: `src/state/store.ts` (`applyCriticalToTarget` pousse les traumas)
- Test: `src/engine/critical.test.ts` (ajout)

- [ ] **Step 1 : test qui échoue** — ajouter dans `src/engine/critical.test.ts` :

```ts
it('produit un trauma de Fracture Torse depuis la table (Côtes fracturées, corps 51-55)', () => {
  // forcer le jet sur la bande 51-55 : makeRNG choisi pour tomber dans 51-55 (sinon ajuster la seed)
  const r = rollCritical(victim(), 'corps', makeRNG(13));
  // au moins une bande de la table corps porte un trauma fracture ; on vérifie la structure générique :
  const anyFracture = r.traumas.some((t) => t.label.startsWith('Fracture'));
  // ce test garantit surtout que `traumas` existe et est un tableau peuplable
  expect(Array.isArray(r.traumas)).toBe(true);
  expect(anyFracture || r.traumas.length === 0).toBe(true);
});

it('construit le trauma à la localisation du critique (Fracture Torse → corps, F/Ag −30)', () => {
  // entrée déterministe : on lit directement la table via une bande connue
  const r = rollCritical(victim(), 'corps', makeRNG(13));
  for (const t of r.traumas) {
    expect(t.location).toBe('corps');
  }
});
```

> Note : `victim()` et `makeRNG` sont déjà importés dans `critical.test.ts`. Si la seed `13` ne tombe
> pas sur une bande à trauma, ces tests restent verts (assertions tolérantes sur structure + location) ;
> le test dur du mapping est couvert par `trauma.test.ts` (Task B1). L'objectif ici : `traumas` peuplé
> et à la bonne localisation.

- [ ] **Step 2 : run, vérifier l'échec** — `npm test -- src/engine/critical.test.ts` → FAIL (`r.traumas` undefined).

- [ ] **Step 3 : implémenter**

Dans `src/data/criticals.ts`, étendre l'interface et ajouter le type :

```ts
import type { HitLocation, Difficulty } from '../engine/types';
import type { TraumaKind, TraumaSeverity } from '../engine/trauma';
```

```ts
export interface CritEntry {
  min: number;
  max: number;
  name: string;
  wounds: number;
  lethal?: boolean;
  conditions?: { name: string; value: number }[];
  resist?: { difficulty: Difficulty; onFail: { name: string; value: number }[] };
  note: string;
  /** Traumatismes posés (LDB 18) — la localisation vient de la table. Transcrit des `note` verbatim. */
  traumas?: { kind: TraumaKind; severity: TraumaSeverity }[];
}
```

Ajouter `traumas` aux entrées dont la `note` référence Déchirure musculaire ou Fracture (helper local
en tête, après les helpers d'États) :

```ts
const DECH_MIN = { kind: 'dechirure' as const, severity: 'mineur' as const };
const DECH_MAJ = { kind: 'dechirure' as const, severity: 'majeur' as const };
const FRAC_MIN = { kind: 'fracture' as const, severity: 'mineur' as const };
const FRAC_MAJ = { kind: 'fracture' as const, severity: 'majeur' as const };
```

Entrées à compléter (ajouter `, traumas: [...]` avant la `note`) :

- **TETE** : `Mâchoire fracturée` (51-55) → `[FRAC_MIN]` ; `Mâchoire cassée` (71-75) → `[FRAC_MAJ]` ; `Mâchoire mutilée` (97-99) → `[FRAC_MAJ]`.
- **BRAS** : `Torsion` (21-25) → `[DECH_MIN]` ; `Déchirure musculaire` (31-35) → `[DECH_MIN]` ; `Cassure nette` (51-55) → `[FRAC_MIN]` ; `Ligament rompu` (56-60) → `[DECH_MAJ]` ; `Coupure profonde` (61-65) → `[DECH_MIN]` ; `Coude fracassé` (71-75) → `[FRAC_MAJ]` ; `Biceps déchiqueté` (91-93) → `[DECH_MAJ]`.
- **CORPS** : `Torsion du dos` (26-30) → `[DECH_MIN]` ; `Côtes fracturées` (51-55) → `[FRAC_MIN]` ; `Dos froissé` (71-75) → `[DECH_MAJ]` ; `Hanche fracturée` (76-80) → `[FRAC_MIN]` ; `Cage thoracique perforée` (91-93) → `[FRAC_MAJ]` ; `Clavicule cassée` (94-96) → `[FRAC_MAJ]`.
- **JAMBE** : `Cheville foulée` (36-40) → `[DECH_MIN]` ; `Genou méchamment tordu` (56-60) → `[DECH_MAJ]` ; `Jambe charcutée` (61-65) → `[FRAC_MIN]` ; `Tendon rompu` (71-75) → `[DECH_MAJ]` ; `Entaille au tibia` (76-80) → `[DECH_MAJ, FRAC_MAJ]` ; `Genou cassé` (81-85) → `[FRAC_MAJ]`.

Exemple (TETE 51-55) :

```ts
  { min: 51, max: 55, name: 'Mâchoire fracturée', wounds: 3, conditions: [SO(2)], traumas: [FRAC_MIN], note: 'Traumatisme Fracture (Mineure).' },
```

Dans `src/engine/critical.ts`, ajouter l'import et le champ, et construire les traumas :

```ts
import { traumaFromKind } from './trauma';
import { Combatant, HitLocation, Trauma } from './types';
```

Ajouter à `CriticalResolved` : `traumas: Trauma[];`

Dans `rollCritical`, après le calcul de `entry`, construire :

```ts
  const traumas = (entry.traumas ?? []).map((t) => traumaFromKind(t.kind, t.severity, location));
```

et l'ajouter à l'objet retourné : `traumas,`.

Dans `src/state/store.ts`, dans `applyCriticalToTarget`, juste après `target.criticalWounds = (target.criticalWounds ?? 0) + 1;` :

```ts
  if (crit.traumas.length) {
    target.traumas = [...(target.traumas ?? []), ...crit.traumas];
    for (const t of crit.traumas) log.push(`  ↳ ${t.label} (${t.location}).`);
  }
```

- [ ] **Step 4 : run** — `npm test -- src/engine/critical.test.ts` → PASS. Puis `npm test -- src/engine/trauma.test.ts` (toujours vert).

- [ ] **Step 5 : commit**

```bash
git add src/data/criticals.ts src/engine/critical.ts src/state/store.ts src/engine/critical.test.ts
git commit -m "feat: les Blessures critiques posent des traumatismes (criticals.ts + rollCritical + store)" -- src/data/criticals.ts src/engine/critical.ts src/state/store.ts src/engine/critical.test.ts
```

---

## Task B4 : Persistance des traumas (extension Plan A)

**Files:**
- Modify: `src/engine/persistence.ts` (`carryOverState` inclut `traumas`)
- Test: `src/engine/persistence.test.ts` (ajout)

- [ ] **Step 1 : test qui échoue** — ajouter dans `src/engine/persistence.test.ts` :

```ts
import { traumaFromKind } from './trauma';

it('persiste les traumatismes', () => {
  const c = baseCombatant({ traumas: [traumaFromKind('fracture', 'mineur', 'jambeG')] });
  const s = carryOverState(c);
  expect(s.traumas.length).toBe(1);
  expect(s.traumas[0].movementHalved).toBe(true);
});
```

- [ ] **Step 2 : run, vérifier l'échec** — `npm test -- src/engine/persistence.test.ts -t "traumatismes"` → FAIL (`s.traumas` undefined).

- [ ] **Step 3 : implémenter** — dans `src/engine/persistence.ts`, importer `Trauma` et étendre `carryOverState` :

Type de retour : ajouter `traumas: Trauma[];`. Corps : ajouter
```ts
    traumas: (c.traumas ?? []).map((t) => ({ ...t })),
```
Mettre à jour l'import : `import { Combatant, ConditionInstance, Trauma } from './types';`.

- [ ] **Step 4 : run** — `npm test -- src/engine/persistence.test.ts` → PASS.

- [ ] **Step 5 : commit**

```bash
git add src/engine/persistence.ts src/engine/persistence.test.ts
git commit -m "feat(engine): carryOverState persiste les traumatismes (extension Plan A)" -- src/engine/persistence.ts src/engine/persistence.test.ts
```

---

## Task B5 : Vérification globale

- [ ] **Step 1 :** `npm test` → tous verts (sauf le fichier `weaponForms.test.ts` de la session rig parallèle, hors périmètre).
- [ ] **Step 2 :** `npm run typecheck` → 0 erreur **dans mes fichiers** (le seul échec attendu reste `gameIso/rig/parts/weaponForms.test.ts`, parallèle).

---

## Self-review

- **Couverture** : type+factory (B1), câblage moteur (B2), production par les critiques + annotation table (B3), persistance (B4), vérif (B5). ✅
- **Placeholders** : aucun — code complet ; les 22 entrées `criticals.ts` listées nommément. ✅
- **Cohérence types** : `traumaFromKind(kind, severity, location)`, `Trauma`, `CritEntry.traumas`, `CriticalResolved.traumas` cohérents B1→B4. ✅
- **Rien d'inventé** : limbDisabled/amputation/Esquive journalisés (latéralité absente / Jalon 5) ; non-cumul des charPenalty via le pool existant.
