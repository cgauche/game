# Phase 0 — Registre de qualités d'objet (fondation) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les ~7 checks `hasQ()`/regex de qualités d'arme éparpillés dans `combat.ts` (+ `Incassable` dans `weaponDamage.ts`) par un **registre de qualités unifié** + dispatcher pur, **sans changer le comportement** (garanti par un golden-master), pour que les futures qualités (artisanat, armure) s'ajoutent en **une entrée de registre**.

**Architecture :** Nouveau dossier `src/engine/qualities/` : `registry.ts` (table `QualityDef` keyée par label FR, une entrée par qualité avec ses champs d'effet) + `dispatch.ts` (helpers purs `hasQuality`/`qualitySum`/`qualityCritTriggered`/`parryDRAdjust`/`isUnbreakable` qui lisent le registre). `combat.ts` et `weaponDamage.ts` appellent ces helpers au lieu de tester des chaînes en dur. Un test golden-master (snapshot de combats seedés) prouve l'iso-comportement à chaque étape.

**Tech Stack :** TypeScript, Vitest (`makeRNG(seed)` pour le déterminisme), moteur pur (aucune dépendance store/UI).

**Périmètre / coordination :** ce plan ne touche QUE des fichiers hors du WIP parallèle : `src/engine/combat.ts`, `src/engine/weaponDamage.ts`, et les nouveaux `src/engine/qualities/*` + tests. Les sites dans `src/state/combatFlow.ts` (Incassable l.538, Assommante l.472), `src/engine/items.ts` (Recharge l.95) et `src/engine/oups.ts` (Poudre noire l.25) sont **différés** à une suite (cf. §Fin), car `combatFlow.ts` est dans le working tree de l'utilisateur.

**Commandes :**
- Tests ciblés : `npx vitest run src/engine/qualities src/engine/golden-combat.test.ts src/engine/engine.test.ts`
- Suite complète : `npm test`
- Types : `npm run typecheck`

**Commits :** uniquement mes fichiers via `git commit -- <chemins>` (WIP parallèle de l'utilisateur dans le même arbre).

---

## File Structure

- **Create** `src/engine/qualities/registry.ts` — types `QualityDef`/`QualityCtx` + table `QUALITIES` (une entrée par qualité d'arme implémentée).
- **Create** `src/engine/qualities/dispatch.ts` — helpers purs lisant le registre (remplacent `hasQ`/`isUnbreakable`).
- **Create** `src/engine/qualities/dispatch.test.ts` — tests unitaires des helpers (parité avec l'ancien `hasQ`, sommes, critTrigger, préséance).
- **Create** `src/engine/golden-combat.test.ts` — golden-master : snapshot de résultats de combat seedés × combinaisons de qualités (filet anti-régression).
- **Modify** `src/engine/combat.ts` — `attackModifiers`/`woundsFromHit`/`applyHit`/`finishMelee`/`canFireWhileEngaged` passent par le dispatcher ; suppression du `hasQ` privé.
- **Modify** `src/engine/weaponDamage.ts` — `isUnbreakable` délègue au dispatcher (suppression du regex local).

---

## Task 1: Golden-master du combat (filet anti-régression)

Établit une référence du comportement de combat ACTUEL. Écrit AVANT toute migration ; doit rester vert à chaque étape suivante.

**Files:**
- Create: `src/engine/golden-combat.test.ts`

- [ ] **Step 1: Écrire le test golden-master (capture le comportement courant)**

```ts
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { resolveMelee, resolveRanged } from './combat';
import type { Characteristics, Combatant, Weapon } from './types';

/** Fixture combattant déterministe (pas d'aléa de création). */
function mk(name: string, chars: Partial<Characteristics>, weapon: Weapon, armourCorps = 0): Combatant {
  const base: Characteristics = { CC: 40, CT: 40, F: 35, E: 35, I: 30, Ag: 35, Dex: 30, Int: 30, FM: 30, Soc: 30 };
  return {
    id: name, name, kind: 'enemy',
    characteristics: { ...base, ...chars },
    wounds: { current: 25, max: 25 },
    advantage: 0, conditions: [],
    weapons: [weapon],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: armourCorps, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Sérialisation compacte et stable d'un résultat d'attaque (champs déterministes). */
const ser = (r: ReturnType<typeof resolveMelee>) =>
  [r.hit, r.attackerRoll, r.defenderRoll ?? null, r.netSL, r.location ?? null, r.damage ?? null, r.woundsLost ?? null, r.critical, r.advantageTo].join('|');

// Combinaisons de qualités d'arme couvrant TOUS les sites migrés.
const QSETS: string[][] = [[], ['Précise'], ['Perforante'], ['Pointue'], ['Empaleuse'], ['Défensive'], ['À Enroulement'], ['Pistolet'], ['Précise', 'Pointue', 'Perforante'], ['Empaleuse', 'Pointue']];

describe('Golden master — combat (iso-comportement du registre de qualités)', () => {
  it('mêlée : Parade/Esquive/Subir × qualités × seeds — snapshot stable', () => {
    const out: string[] = [];
    for (const q of QSETS) {
      for (const defense of ['parade', 'esquive', 'none'] as const) {
        for (let seed = 1; seed <= 25; seed++) {
          const atk = mk('A', { CC: 55, F: 40 }, { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: q });
          const def = mk('D', { CC: 45, E: 35 }, { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: ['Défensive'] }, 2);
          out.push(`${q.join(',')}|${defense}|${seed}=${ser(resolveMelee(atk, def, atk.weapons[0], makeRNG(seed), { defense }))}`);
        }
      }
    }
    expect(out).toMatchSnapshot();
  });

  it('distance : portée × qualités × seeds — snapshot stable', () => {
    const out: string[] = [];
    for (const q of [[], ['Perforante'], ['Pointue'], ['Empaleuse']]) {
      for (let seed = 1; seed <= 25; seed++) {
        const atk = mk('A', { CT: 55 }, { name: 'Arc', type: 'ranged', damage: '+9', range: 50, qualities: q });
        const def = mk('D', { E: 35 }, { name: 'Épée', type: 'melee', damage: '+BF', qualities: [] }, 2);
        out.push(`${q.join(',')}|${seed}=${ser(resolveRanged(atk, def, atk.weapons[0], makeRNG(seed), 10))}`);
      }
    }
    expect(out).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Exécuter pour écrire le snapshot de référence**

Run: `npx vitest run src/engine/golden-combat.test.ts`
Expected: PASS — « 2 passed », un fichier `src/engine/__snapshots__/golden-combat.test.ts.snap` est créé (référence du comportement ACTUEL).

- [ ] **Step 3: Commit**

```bash
git add src/engine/golden-combat.test.ts src/engine/__snapshots__/golden-combat.test.ts.snap
git commit -- src/engine/golden-combat.test.ts src/engine/__snapshots__/golden-combat.test.ts.snap -m "test(qualities): golden-master du combat (filet iso-comportement Phase 0)"
```

---

## Task 2: Registre + dispatcher

**Files:**
- Create: `src/engine/qualities/registry.ts`
- Create: `src/engine/qualities/dispatch.ts`
- Test: `src/engine/qualities/dispatch.test.ts`

- [ ] **Step 1: Écrire les tests du dispatcher (échouent : modules absents)**

```ts
import { describe, it, expect } from 'vitest';
import type { Weapon } from '../types';
import { QUALITIES } from './registry';
import { hasQuality, qualitySum, qualityCritTriggered, parryDRAdjust, isUnbreakable } from './dispatch';

const w = (qualities: string[], over: Partial<Weapon> = {}): Weapon => ({ name: 'W', type: 'melee', damage: '+BF', qualities, ...over });

describe('dispatch — parité avec hasQ (startsWith, insensible casse, ignore Indice)', () => {
  it('hasQuality reconnaît le label exact, la casse et l’Indice', () => {
    expect(hasQuality(w(['Précise']), 'Précise')).toBe(true);
    expect(hasQuality(w(['précise']), 'Précise')).toBe(true);
    expect(hasQuality(w(['Solide 3']), 'Solide')).toBe(true); // ignore l'Indice
    expect(hasQuality(w(['Perforante']), 'Précise')).toBe(false);
    expect(hasQuality(undefined, 'Précise')).toBe(false);
  });
});

describe('dispatch — sommes numériques depuis le registre', () => {
  it('attackMod : Précise = +10', () => {
    expect(qualitySum(w(['Précise']), 'attackMod')).toBe(10);
    expect(qualitySum(w([]), 'attackMod')).toBe(0);
  });
  it('armourReduction : Perforante = 1', () => {
    expect(qualitySum(w(['Perforante']), 'armourReduction')).toBe(1);
  });
  it('damageDR : Pointue = +1', () => {
    expect(qualitySum(w(['Pointue']), 'damageDR')).toBe(1);
  });
});

describe('dispatch — Empaleuse (critTrigger sur multiple de 10)', () => {
  it('déclenche un Critique si le jet est multiple de 10', () => {
    expect(qualityCritTriggered(w(['Empaleuse']), 20)).toBe(true);
    expect(qualityCritTriggered(w(['Empaleuse']), 23)).toBe(false);
    expect(qualityCritTriggered(w([]), 20)).toBe(false);
  });
});

describe('dispatch — parade (Défensive +1 défenseur, À Enroulement -1 attaquant)', () => {
  it('Défensive +1, À Enroulement -1, combinés', () => {
    expect(parryDRAdjust(w(['Défensive']), w([]))).toBe(1);
    expect(parryDRAdjust(w([]), w(['À Enroulement']))).toBe(-1);
    expect(parryDRAdjust(w(['Défensive']), w(['À Enroulement']))).toBe(0);
    expect(parryDRAdjust(undefined, w([]))).toBe(0);
  });
});

describe('dispatch — Incassable', () => {
  it('isUnbreakable vrai seulement avec l’Atout Incassable', () => {
    expect(isUnbreakable(w(['Incassable']))).toBe(true);
    expect(isUnbreakable(w([]))).toBe(false);
  });
});

describe('registry — entrées attendues', () => {
  it('contient les qualités d’arme implémentées', () => {
    for (const k of ['Précise', 'Perforante', 'Pointue', 'Empaleuse', 'Défensive', 'À Enroulement', 'Pistolet', 'Incassable', 'Inoffensive']) {
      expect(QUALITIES[k]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/engine/qualities/dispatch.test.ts`
Expected: FAIL — « Failed to resolve import './registry' » / « './dispatch' ».

- [ ] **Step 3: Écrire `registry.ts`**

```ts
/**
 * Registre des qualités d'objet (arme / armure / artisanat) — source UNIQUE des effets.
 * Ajouter une qualité = AJOUTER UNE ENTRÉE ici (plus de `hasQ` éparpillé). Les helpers
 * de `dispatch.ts` lisent ce registre ; combat.ts/items.ts l'appellent aux moments de jeu.
 */
import type { Combatant, HitLocation, Weapon } from '../types';

/** Contexte (lecture seule) passé aux hooks fonctionnels ; un hook RENVOIE des données, ne mute pas. */
export interface QualityCtx {
  weapon?: Weapon;
  attacker?: Combatant;
  defender?: Combatant;
  location?: HitLocation;
  /** d100 du toucher (pour les déclencheurs de Critique). */
  roll?: number;
}

export interface QualityDef {
  /** Label FR canonique (correspond au début de la chaîne sur l'objet, insensible casse). */
  key: string;
  type?: 'Atout' | 'Défaut';
  subType?: 'Arme' | 'Armure' | 'Objet';
  /** Préséance : cette qualité l'emporte sur les `beats` si toutes deux présentes (ex. Imprécise > Précise). */
  beats?: string[];
  // --- Effets « moment » (tous optionnels) ---
  /** +X au Test d'ATTAQUE (Précise +10, LDB Armes l.304). */
  attackMod?: number;
  /** Réduit de X les PA de la cible à la mitigation (Perforante 1, l.316). */
  armourReduction?: number;
  /** +X DR aux Dégâts sur une touche (Pointue +1, l.301). */
  damageDR?: number;
  /** +X DR à la PARADE du défenseur quand l'arme est la sienne (Défensive +1, l.273). */
  defenderParryDR?: number;
  /** +X DR à la parade adverse quand l'arme est celle de l'ATTAQUANT (À Enroulement -1, l.259). */
  attackerParryDR?: number;
  /** Déclenche un Coup Critique si vrai (Empaleuse : jet multiple de 10, l.282). */
  critTrigger?: (ctx: QualityCtx) => boolean;
  /** Arme à distance pouvant tirer au contact (Pistolet, l.297-298). */
  canFireWhileEngaged?: boolean;
  /** Objet insensible aux dégâts/destruction (Incassable, l.310). */
  unbreakable?: boolean;
}

/** Table des qualités. Clé = label FR canonique. */
export const QUALITIES: Record<string, QualityDef> = {
  'Précise': { key: 'Précise', type: 'Atout', subType: 'Arme', attackMod: 10 },
  'Perforante': { key: 'Perforante', type: 'Atout', subType: 'Arme', armourReduction: 1 },
  'Pointue': { key: 'Pointue', type: 'Atout', subType: 'Arme', damageDR: 1 },
  'Empaleuse': { key: 'Empaleuse', type: 'Atout', subType: 'Arme', critTrigger: (c) => (c.roll ?? -1) % 10 === 0 },
  'Défensive': { key: 'Défensive', type: 'Atout', subType: 'Arme', defenderParryDR: 1 },
  'À Enroulement': { key: 'À Enroulement', type: 'Atout', subType: 'Arme', attackerParryDR: -1 },
  'Pistolet': { key: 'Pistolet', type: 'Atout', subType: 'Arme', canFireWhileEngaged: true },
  'Incassable': { key: 'Incassable', type: 'Atout', subType: 'Arme', unbreakable: true },
  // Inoffensive : posé sur une arme usée à +0 (effectiveWeapon) ; effet « PA doublés » non encore
  // modélisé (dette, cf. ROADMAP). Enregistrée pour la parité (clé connue).
  'Inoffensive': { key: 'Inoffensive', type: 'Défaut', subType: 'Arme' },
};
```

- [ ] **Step 4: Écrire `dispatch.ts`**

```ts
/**
 * Dispatcher PUR des qualités d'objet : lit le registre (`registry.ts`) et expose des helpers
 * que combat.ts/items.ts appellent au lieu de tester des chaînes en dur. Aucune mutation.
 */
import type { Weapon } from '../types';
import { QUALITIES, QualityDef, QualityCtx } from './registry';

/** Une chaîne d'objet « Solide 3 »/« précise » correspond-elle au label `key` ? (startsWith, casse-insensible). */
const matches = (raw: string, key: string): boolean => raw.toLowerCase().startsWith(key.toLowerCase());

/** L'objet possède-t-il la qualité `key` ? (remplace l'ancien `hasQ`, parité exacte). */
export function hasQuality(w: Weapon | undefined, key: string): boolean {
  return !!w && w.qualities.some((q) => matches(q, key));
}

/** QualityDef présentes sur l'arme (résolues depuis le registre, qualités inconnues ignorées). */
export function defsOf(w: Weapon | undefined): QualityDef[] {
  if (!w) return [];
  const out: QualityDef[] = [];
  for (const def of Object.values(QUALITIES)) {
    if (w.qualities.some((q) => matches(q, def.key))) out.push(def);
  }
  return out;
}

/** Somme d'un champ numérique du registre sur les qualités présentes (0 si aucune). */
export function qualitySum(w: Weapon | undefined, field: 'attackMod' | 'armourReduction' | 'damageDR'): number {
  return defsOf(w).reduce((s, d) => s + (d[field] ?? 0), 0);
}

/** Une qualité de l'arme déclenche-t-elle un Critique pour ce jet ? (Empaleuse multiple de 10). */
export function qualityCritTriggered(w: Weapon | undefined, roll: number): boolean {
  const ctx: QualityCtx = { weapon: w, roll };
  return defsOf(w).some((d) => d.critTrigger?.(ctx) ?? false);
}

/** Ajustement de DR de la PARADE (Test opposé) : Défensive (arme du défenseur) +1, À Enroulement (arme de l'attaquant) -1. */
export function parryDRAdjust(defenderWeapon: Weapon | undefined, attackerWeapon: Weapon | undefined): number {
  const def = defsOf(defenderWeapon).reduce((s, d) => s + (d.defenderParryDR ?? 0), 0);
  const atk = defsOf(attackerWeapon).reduce((s, d) => s + (d.attackerParryDR ?? 0), 0);
  return def + atk;
}

/** L'arme peut-elle tirer au Combat rapproché (Atout Pistolet) ? */
export function canFireWhileEngaged(w: Weapon | undefined): boolean {
  return !!w && w.type === 'ranged' && defsOf(w).some((d) => d.canFireWhileEngaged);
}

/** L'objet est-il insensible aux dégâts/destruction (Incassable) ? (remplace les regex /incassable/i). */
export function isUnbreakable(w: Weapon | undefined): boolean {
  return defsOf(w).some((d) => d.unbreakable);
}
```

- [ ] **Step 5: Exécuter les tests du dispatcher**

Run: `npx vitest run src/engine/qualities/dispatch.test.ts`
Expected: PASS — tous verts.

- [ ] **Step 6: Commit**

```bash
git add src/engine/qualities/registry.ts src/engine/qualities/dispatch.ts src/engine/qualities/dispatch.test.ts
git commit -- src/engine/qualities/registry.ts src/engine/qualities/dispatch.ts src/engine/qualities/dispatch.test.ts -m "feat(qualities): registre de qualités d'objet + dispatcher pur (Phase 0)"
```

---

## Task 3: Migrer `combat.ts` vers le dispatcher

Remplace les checks `hasQ()` par les helpers du registre. **Iso-comportement** — le golden-master et `engine.test.ts` doivent rester verts.

**Files:**
- Modify: `src/engine/combat.ts`

- [ ] **Step 1: Importer le dispatcher (en tête de fichier)**

Ajouter après la ligne `import { SIZE_RANGED_MOD, SIZE_LABEL, sizeGap, effectiveSize } from './size';` :

```ts
import { qualitySum, qualityCritTriggered, parryDRAdjust, canFireWhileEngaged as qCanFireWhileEngaged } from './qualities/dispatch';
```

- [ ] **Step 2: Migrer `attackModifiers` (Précise)**

Remplacer (combat.ts ~171) :

```ts
  if (hasQ(weapon, 'Précise')) out.push({ label: 'Précise', value: 10 });
```

par :

```ts
  const precise = qualitySum(weapon, 'attackMod');
  if (precise) out.push({ label: 'Précise', value: precise });
```

- [ ] **Step 3: Migrer `woundsFromHit` (Perforante)**

Remplacer (combat.ts ~214) :

```ts
  const ap = Math.max(0, (target.armour[location] ?? 0) - (hasQ(weapon, 'Perforante') ? 1 : 0));
```

par :

```ts
  const ap = Math.max(0, (target.armour[location] ?? 0) - qualitySum(weapon, 'armourReduction'));
```

- [ ] **Step 4: Migrer `canFireWhileEngaged` (Pistolet)**

Remplacer le corps de la fonction (combat.ts ~221-223) :

```ts
export function canFireWhileEngaged(weapon: Weapon): boolean {
  return weapon.type === 'ranged' && hasQ(weapon, 'Pistolet');
}
```

par :

```ts
export function canFireWhileEngaged(weapon: Weapon): boolean {
  return qCanFireWhileEngaged(weapon);
}
```

- [ ] **Step 5: Migrer `finishMelee` (Défensive / À Enroulement)**

Remplacer (combat.ts ~292) :

```ts
  const drAdjust = defenseMode === 'parade' ? (hasQ(defender.weapons[0], 'Défensive') ? 1 : 0) - (hasQ(weapon, 'À Enroulement') ? 1 : 0) : 0;
```

par :

```ts
  const drAdjust = defenseMode === 'parade' ? parryDRAdjust(defender.weapons[0], weapon) : 0;
```

- [ ] **Step 6: Migrer `applyHit` (Pointue + Empaleuse)**

Remplacer (combat.ts ~456) :

```ts
  const effDR = dr + (hasQ(weapon, 'Pointue') ? 1 : 0); // Atout Pointue : +1 DR sur une touche (l.301)
```

par :

```ts
  const effDR = dr + qualitySum(weapon, 'damageDR'); // Atout Pointue : +1 DR sur une touche (l.301)
```

Puis remplacer (combat.ts ~464) :

```ts
  const empale = hasQ(weapon, 'Empaleuse') && atkBd.roll % 10 === 0;
```

par :

```ts
  const empale = qualityCritTriggered(weapon, atkBd.roll);
```

- [ ] **Step 7: Supprimer le `hasQ` privé désormais inutilisé**

Supprimer le bloc (combat.ts ~202-204) :

```ts
/** Une arme possède-t-elle l'Atout/Défaut `q` (insensible à la casse ; ignore l'Indice). */
const hasQ = (w: Weapon | undefined, q: string): boolean =>
  !!w && w.qualities.some((x) => x.toLowerCase().startsWith(q.toLowerCase()));
```

- [ ] **Step 8: Vérifier l'iso-comportement (golden-master + suite + types)**

Run: `npx vitest run src/engine/golden-combat.test.ts src/engine/engine.test.ts`
Expected: PASS — snapshot INCHANGÉ (aucun `obsolete`/diff), `engine.test.ts` vert.

Run: `npm run typecheck`
Expected: 0 erreur (notamment : plus aucune référence à `hasQ` dans `combat.ts`).

- [ ] **Step 9: Commit**

```bash
git add src/engine/combat.ts
git commit -- src/engine/combat.ts -m "refactor(qualities): combat.ts via le registre (Précise/Perforante/Pointue/Empaleuse/Défensive/À Enroulement/Pistolet) — iso-comportement"
```

---

## Task 4: Migrer `weaponDamage.ts` (Incassable)

Supprime le regex `/incassable/i` local au profit du dispatcher (source unique).

**Files:**
- Modify: `src/engine/weaponDamage.ts`

- [ ] **Step 1: Remplacer `isUnbreakable` par une délégation au dispatcher**

Remplacer (weaponDamage.ts 8-10) :

```ts
function isUnbreakable(w: Weapon): boolean {
  return w.qualities.some((q) => /incassable/i.test(q));
}
```

par :

```ts
import { isUnbreakable } from './qualities/dispatch';
```

…en plaçant cet import sous `import { Weapon } from './types';` (ligne 6), et en **supprimant** la fonction locale `isUnbreakable`. Les appels existants `isUnbreakable(w)` (dans `damageWeapon`/`destroyWeapon`) restent inchangés (même signature).

- [ ] **Step 2: Vérifier (tests d'arme + golden-master + types)**

Run: `npx vitest run src/engine/weaponDamage.test.ts src/engine/golden-combat.test.ts`
Expected: PASS — snapshot inchangé.

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/engine/weaponDamage.ts
git commit -- src/engine/weaponDamage.ts -m "refactor(qualities): weaponDamage.ts utilise isUnbreakable du registre (dédup regex)"
```

---

## Task 5: Test de parité + validation finale

Verrouille l'invariant « plus de check de qualité en dur » et confirme la suite complète.

**Files:**
- Modify: `src/engine/qualities/dispatch.test.ts` (ajout d'un test de parité)

- [ ] **Step 1: Ajouter un test de parité (registre ⊇ qualités d'arme du jeu)**

Ajouter à la fin de `src/engine/qualities/dispatch.test.ts` :

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('parité — toute qualité d’ARME des données est connue du registre (ou allowlist explicite)', () => {
  // Qualités d'arme présentes en data mais volontairement NON implémentées en code (dette ROADMAP).
  const NON_IMPLEMENTED = new Set([
    'Assommante', 'À poudre noire', 'À répétition', 'Dévastatrice', 'À explosion', 'Immobilisante',
    'Percutante', 'Perturbante', 'Piège-lame', 'Protectrice', 'Rapide', 'Lente', 'Dangereuse',
    'Épuisante', 'Imprécise', 'Recharge',
  ]);
  it('chaque Atout/Défaut d’arme de qualities.json est dans QUALITIES ou dans NON_IMPLEMENTED', () => {
    const path = fileURLToPath(new URL('../../data/qualities.json', import.meta.url));
    const all = JSON.parse(readFileSync(path, 'utf8')) as { label: string; subType?: string }[];
    const armes = all.filter((q) => (q.subType ?? '').toLowerCase().startsWith('arme'));
    const known = new Set(Object.keys(QUALITIES));
    const missing = armes.map((q) => q.label).filter((l) => !known.has(l) && !NON_IMPLEMENTED.has(l));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Exécuter le test de parité**

Run: `npx vitest run src/engine/qualities/dispatch.test.ts`
Expected: PASS. Si `missing` est non vide → soit la qualité est implémentée (l'ajouter à `QUALITIES`), soit c'est de la dette (l'ajouter à `NON_IMPLEMENTED`). Ajuster `NON_IMPLEMENTED` selon les libellés EXACTS de `qualities.json` jusqu'au vert.

- [ ] **Step 3: Suite complète + types**

Run: `npm test`
Expected: PASS — tous verts (≥ 681 + nouveaux), **golden-master inchangé**.

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add src/engine/qualities/dispatch.test.ts
git commit -- src/engine/qualities/dispatch.test.ts -m "test(qualities): parité registre ⊇ qualités d'arme des données (allowlist dette explicite)"
```

---

## Fin — différé (suites de la Phase 0) et suite (Phase A)

**Différé à une suite Phase 0** (fichiers dans le WIP parallèle de l'utilisateur — à migrer après coordination) :
- `src/state/combatFlow.ts:538` (Incassable dans `wearActiveWeapon`) → `isUnbreakable` du registre.
- `src/state/combatFlow.ts:472` (Assommante) → hook `onHit` (Test opposé Force/Résistance → Sonné) ; nécessite un `QualityCtx` enrichi (RNG au call-site).
- `src/engine/items.ts:95` (Recharge) → `reload` typé depuis le registre (fin du `parseInt`).
- `src/engine/oups.ts:25` (Poudre noire) → entrée `firearm` du registre.

**Suite (Phase A — nouveau plan)** : sur cette fondation, ajouter le champ `ItemInstance.craft`, le catalogue des 8 qualités d'artisanat **comme entrées de `QUALITIES`** (subType `Objet`), et les fonctions économiques pures (`craftPriceFactor`/`craftAvailabilityShift`/`qualityClass`). Réf. spec §4-5 : `docs/superpowers/specs/2026-06-07-qualite-objet-fabrication-design.md`.

---

## Self-review (writing-plans)

- **Couverture spec §3.1 (Phase 0)** : registre + dispatcher (Task 2), migration des checks épars (Task 3-4), golden-master (Task 1), parité (Task 5), garde-fou de périmètre (en-tête : ne touche que combat.ts/weaponDamage.ts + nouveaux ; le reste différé). ✓
- **Placeholders** : aucun — chaque étape porte le code exact et la commande + sortie attendue. ✓
- **Cohérence des types** : `hasQuality`/`qualitySum`/`qualityCritTriggered`/`parryDRAdjust`/`canFireWhileEngaged`/`isUnbreakable` définis en Task 2, utilisés tels quels en Task 3-4 (mêmes signatures). `QualityDef` champs (`attackMod`/`armourReduction`/`damageDR`/`defenderParryDR`/`attackerParryDR`/`critTrigger`/`canFireWhileEngaged`/`unbreakable`) cohérents entre `registry.ts` et `dispatch.ts`. ✓
- **Risque clé** : le snapshot golden-master doit rester identique → tout diff = régression à corriger avant commit. Le test de parité dépend des libellés EXACTS de `qualities.json` (ajuster `NON_IMPLEMENTED` à l'exécution). ✓
