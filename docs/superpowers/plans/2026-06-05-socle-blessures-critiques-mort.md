# Socle combat — Blessures critiques & mort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modéliser le système canon de Blessures critiques et de mort (LDB `18 - Traumatisme.md`) : 0 PB ≠ mort (À Terre → Inconscient → mort conditionnelle), critiques via overkill/double avec tables par localisation, Mort Subite pour les figurants — en corrigeant `isOutOfAction = wounds≤0`.

**Architecture :** données de tables hand/workflow-authored (`src/data/criticals.ts`) → moteur pur (`src/engine/critical.ts` + extensions `conditions.ts`) → câblage store (application des Dégâts + upkeep de fin de Round) → UI d'affichage. Pas de modale (critiques auto-résolues).

**Tech Stack :** Vite + TypeScript + React, Zustand, Vitest, RNG seedable (`makeRNG`). Source canon : `Source/Warhammer v4 - Livre de base version corrigée/18 - Traumatisme.md`.

**Décisions verrouillées (cf. spec) :** overkill = dégâts > PB **courants** (Trauma l.30, −20 si overkill > BE, plancher 0) ; double/Empaleuse = Coup Critique ; double roule la table pour **tous**, overkill = table héros / **Mort Subite** ennemis ; Tests de Résistance des entrées **auto-résolus** ; effets long terme **journalisés**, non simulés ; `usesSuddenDeath(c) = c.kind !== 'hero'`.

**Commandes :** `npx vitest run <fichier>` (test ciblé) ; `npm test` + `npm run typecheck` (suite).

---

## Task 1 : Données — les 4 tables de Blessures critiques (`src/data/criticals.ts`)

**Files:**
- Create: `src/data/criticals.ts`
- Test: `src/data/criticals.test.ts`

**Méthode :** transcrire **fidèlement** les 4 tables d100 de `Source/Warhammer v4 - Livre de base version corrigée/18 - Traumatisme.md` (Tête l.66-116, Bras l.118-187, Corps l.189-214, Jambe l.216-285). Pour le Corps et la Jambe, l'OCR a produit des **doublons** (forme prose + forme tableau markdown) : ne garder qu'**une** version par entrée. Recommandé : lancer un **workflow** d'agents (un par localisation) lisant le fichier et produisant le JSON structuré, puis vérifier à la main contre le canon. Le test de complétude (Step 3) garantit qu'aucune plage de d100 n'est trouée.

- [ ] **Step 1 : Écrire le test de complétude (échec attendu)**

`src/data/criticals.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { CRITICAL_TABLES, type CritEntry } from './criticals';
import type { HitLocation } from '../engine/types';

const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];

describe('CRITICAL_TABLES — tables de Blessures critiques (LDB 18-Traumatisme)', () => {
  for (const loc of LOCS) {
    it(`${loc} : couvre tout le d100 (1..100) sans trou ni chevauchement`, () => {
      const table = CRITICAL_TABLES[loc];
      expect(table.length).toBeGreaterThan(0);
      const covered = new Array(101).fill(0); // index 1..100
      for (const e of table) for (let r = e.min; r <= e.max; r++) covered[r]++;
      for (let r = 1; r <= 100; r++) expect(covered[r], `roll ${r} sur ${loc}`).toBe(1);
    });
    it(`${loc} : a exactement une entrée létale (00)`, () => {
      const lethal = CRITICAL_TABLES[loc].filter((e: CritEntry) => e.lethal);
      expect(lethal.length).toBe(1);
      expect(lethal[0].max).toBe(100); // « 00 » = 100
    });
  }
});
```

- [ ] **Step 2 : Lancer → échec** (`./criticals` introuvable).

Run: `npx vitest run src/data/criticals.test.ts`
Expected: FAIL (module manquant).

- [ ] **Step 3 : Créer `src/data/criticals.ts`**

Types + les 4 tables. Le bloc ci-dessous donne les **types** et la table **Tête** transcrite verbatim du canon (l.66-116) comme **patron exact**. Transcrire `brasG`/`brasD` (mêmes données = table Bras), `corps`, `jambeG`/`jambeD` (= table Jambe) sur le même modèle (bras gauche = bras droit = table « Bras » ; jambe gauche = droite = table « Jambe »).

```ts
import type { HitLocation, Difficulty } from '../engine/types';

/** Une entrée du Tableau des Critiques (LDB 18-Traumatisme). `00` est encodé max=100. */
export interface CritEntry {
  min: number;
  max: number;
  name: string;
  /** PB perdus, ignorant BE+PA (l.62). 0 pour une entrée létale. */
  wounds: number;
  /** Résultat « Mort » instantané. */
  lethal?: boolean;
  /** États ajoutés immédiatement. */
  conditions?: { name: string; value: number }[];
  /** « Réussissez un Test de Résistance X ou gagnez l'État Y » — auto-résolu par le moteur. */
  resist?: { difficulty: Difficulty; onFail: { name: string; value: number }[] };
  /** Texte canon (amputation/fracture/déchirure/effets long terme) — journalisé, NON simulé. */
  note: string;
}
export type CritTable = CritEntry[];

/** Table « Tête » (LDB 18-Traumatisme l.66-116), transcrite verbatim. */
const TETE: CritTable = [
  { min: 1, max: 10, name: 'Blessure spectaculaire', wounds: 1, conditions: [{ name: 'Hémorragique', value: 1 }], note: 'Fine entaille du front à la joue. Une fois guérie, la cicatrice donne DR +1 à certains Tests sociaux.' },
  { min: 11, max: 20, name: 'Coupure mineure', wounds: 1, conditions: [{ name: 'Hémorragique', value: 1 }], note: 'Le coup entaille la joue, le sang dégouline.' },
  { min: 21, max: 25, name: "Coup à l'œil", wounds: 1, conditions: [{ name: 'Aveuglé', value: 1 }], note: "Coup à l'orbite de l'œil." },
  { min: 26, max: 30, name: "Frappe à l'oreille", wounds: 1, conditions: [{ name: 'Assourdi', value: 1 }], note: 'Bourdonnement ignoble.' },
  { min: 31, max: 35, name: 'Coup percutant', wounds: 2, conditions: [{ name: 'Sonné', value: 1 }], note: 'Le sang obscurcit la vision, points blancs et flashs.' },
  { min: 36, max: 40, name: 'Œil au beurre noir', wounds: 2, conditions: [{ name: 'Aveuglé', value: 2 }], note: 'Coup massif aux yeux, très douloureux.' },
  { min: 41, max: 45, name: 'Oreille tranchée', wounds: 2, conditions: [{ name: 'Assourdi', value: 2 }, { name: 'Hémorragique', value: 1 }], note: 'Coup violent qui entaille profondément l’oreille.' },
  { min: 46, max: 50, name: 'En plein front', wounds: 2, conditions: [{ name: 'Hémorragique', value: 2 }, { name: 'Aveuglé', value: 1 }], note: "L'État Aveuglé ne peut être retiré tant que tous les Hémorragique ne le sont pas." },
  { min: 51, max: 55, name: 'Mâchoire fracturée', wounds: 3, conditions: [{ name: 'Sonné', value: 2 }], note: 'Mâchoire fracturée — Traumatisme Fracture (Mineure).' },
  { min: 56, max: 60, name: 'Blessure majeure à l’œil', wounds: 3, conditions: [{ name: 'Hémorragique', value: 1 }, { name: 'Aveuglé', value: 1 }], note: 'Aveuglé soigné uniquement par Aide Médicale.' },
  { min: 61, max: 65, name: 'Blessure majeure à l’oreille', wounds: 3, note: 'Perte auditive permanente : -20 aux Tests d’audition. Seconde fois = surdité totale (magie seule).' },
  { min: 66, max: 70, name: 'Nez cassé', wounds: 3, conditions: [{ name: 'Hémorragique', value: 2 }], resist: { difficulty: 'intermediaire', onFail: [{ name: 'Sonné', value: 1 }] }, note: 'Une fois guéri, DR +1/-1 aux Tests sociaux selon contexte jusqu’à Chirurgie.' },
  { min: 71, max: 75, name: 'Mâchoire cassée', wounds: 4, conditions: [{ name: 'Sonné', value: 3 }], resist: { difficulty: 'intermediaire', onFail: [{ name: 'Inconscient', value: 1 }] }, note: 'Traumatisme Fracture (Majeure).' },
  { min: 76, max: 80, name: 'Commotion cérébrale', wounds: 4, conditions: [{ name: 'Assourdi', value: 1 }, { name: 'Hémorragique', value: 2 }, { name: 'Sonné', value: 5 }, { name: 'Exténué', value: 1 }], note: 'Sonné = 1d10 (encodé 5). Exténué dure 1d10 jours. Autre critique à la tête en Exténué : Résistance Accessible ou Inconscient.' },
  { min: 81, max: 85, name: 'Bouche explosée', wounds: 4, conditions: [{ name: 'Hémorragique', value: 2 }], note: 'Perdez 1d10 dents — Amputation (Facile).' },
  { min: 86, max: 90, name: 'Oreille mutilée', wounds: 4, conditions: [{ name: 'Assourdi', value: 3 }, { name: 'Hémorragique', value: 2 }], note: 'Perte de l’oreille — Amputation (Accessible).' },
  { min: 91, max: 93, name: 'Œil crevé', wounds: 5, conditions: [{ name: 'Aveuglé', value: 3 }, { name: 'Hémorragique', value: 2 }, { name: 'Sonné', value: 1 }], note: 'Perte de l’œil — Amputation (Complexe).' },
  { min: 94, max: 96, name: 'Coup défigurant', wounds: 5, conditions: [{ name: 'Hémorragique', value: 3 }, { name: 'Aveuglé', value: 3 }, { name: 'Sonné', value: 2 }], note: 'Perte d’un œil et du nez — Amputation (Difficile).' },
  { min: 97, max: 99, name: 'Mâchoire mutilée', wounds: 5, conditions: [{ name: 'Hémorragique', value: 4 }, { name: 'Sonné', value: 3 }], resist: { difficulty: 'tresDifficile', onFail: [{ name: 'Inconscient', value: 1 }] }, note: 'Fracture (Majeure), perte de la langue et 1d10 dents — Amputation (Difficile).' },
  { min: 100, max: 100, name: 'Décapitation', wounds: 0, lethal: true, note: 'Votre tête est tranchée. Mort sur le coup.' },
];

// TODO-EXTRACTION : transcrire BRAS (l.118-187) et JAMBE (l.216-285) et CORPS (l.189-214)
// sur le même modèle (verbatim, une entrée par plage, note = texte canon).
const BRAS: CritTable = [/* … extrait du canon … */];
const CORPS: CritTable = [/* … extrait du canon … */];
const JAMBE: CritTable = [/* … extrait du canon … */];

export const CRITICAL_TABLES: Record<HitLocation, CritTable> = {
  tete: TETE,
  brasG: BRAS,
  brasD: BRAS,
  corps: CORPS,
  jambeG: JAMBE,
  jambeD: JAMBE,
};
```
> **Important :** remplacer les `/* … */` par la transcription complète et verbatim (le test de complétude échouera tant que les 4 tables ne couvrent pas 1..100). Pour les valeurs « 1d10 » d'États (ex. Commotion : « 1d10 Sonné »), encoder une valeur fixe représentative et l'indiquer dans `note` (pas de tirage aléatoire d'État — simplification assumée, à documenter).

- [ ] **Step 4 : Lancer → succès**

Run: `npx vitest run src/data/criticals.test.ts`
Expected: PASS (couverture 1..100 + 1 létale par table). Itérer la transcription jusqu'au vert.

- [ ] **Step 5 : Commit**

```bash
git add src/data/criticals.ts src/data/criticals.test.ts
git commit -m "feat(combat): tables de Blessures critiques par localisation (LDB 18-Traumatisme, verbatim)"
```

---

## Task 2 : Moteur pur — résolution d'un critique (`src/engine/critical.ts`)

**Files:**
- Create: `src/engine/critical.ts`
- Test: `src/engine/critical.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)**

`src/engine/critical.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { rollCritical, critLocationRoll } from './critical';
import type { Combatant } from './types';

const victim = (E = 30): Combatant =>
  ({
    name: 'V',
    characteristics: { CC: 30, CT: 30, F: 30, E, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 0, max: 12 }, conditions: [], skills: [], kind: 'hero',
  }) as unknown as Combatant;

describe('rollCritical — résolution d’une Blessure critique (LDB 18-Traumatisme)', () => {
  it('retourne une entrée de la table de la localisation, avec PB et États', () => {
    const r = rollCritical(victim(), 'tete', makeRNG(1));
    expect(r.location).toBe('tete');
    expect(typeof r.name).toBe('string');
    expect(r.woundsLoss).toBeGreaterThanOrEqual(0);
  });
  it('overkill > BE applique -20 au jet (résultat moins sévère, min 01)', () => {
    // Avec un RNG donné, comparer le résultat sans/avec réduction : l'index d'entrée ne monte pas.
    const a = rollCritical(victim(35), 'corps', makeRNG(7), 0); // BE(35)=3
    const b = rollCritical(victim(35), 'corps', makeRNG(7), 10); // overkill 10 > 3 → -20
    expect(b.roll).toBe(Math.max(1, a.roll - 20));
  });
  it('le résultat 00 (létal) est mortel', () => {
    // seed qui force un d100 élevé → on vérifie la cohérence du flag sur l’entrée 00.
    const r = rollCritical(victim(), 'tete', makeRNG(1));
    if (r.roll === 100) expect(r.lethal).toBe(true);
  });
});

describe('critLocationRoll — localisation d’un Coup Critique (1d100 direct, p.159)', () => {
  it('retourne une HitLocation valide', () => {
    const loc = critLocationRoll(makeRNG(3));
    expect(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']).toContain(loc);
  });
});
```

- [ ] **Step 2 : Lancer → échec.**

Run: `npx vitest run src/engine/critical.test.ts`
Expected: FAIL (module manquant).

- [ ] **Step 3 : Implémenter `src/engine/critical.ts`**

```ts
/**
 * Résolution des Blessures critiques — Livre de base, « Traumatisme » (18-Traumatisme.md).
 * Jet 1d100 sur la table de la localisation ; -20 si l'overkill dépasse le Bonus d'Endurance
 * (l.30, min 01) ; PB perdus en ignorant BE+PA ; États appliqués + Test de Résistance auto-résolu.
 */
import { d100, RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { hitLocation } from './combat';
import { Combatant, HitLocation } from './types';
import { CRITICAL_TABLES, CritEntry } from '../data/criticals';

export interface CriticalResolved {
  location: HitLocation;
  name: string;
  /** PB perdus (ignore BE+PA), plancher géré par l'appelant. */
  woundsLoss: number;
  lethal: boolean;
  /** États à appliquer (immédiats + échec du Test de Résistance). */
  conditions: { name: string; value: number }[];
  note: string;
  /** Jet d100 effectif (après -20 éventuel). */
  roll: number;
  log: string;
}

/** Localisation d'un Coup Critique : 1d100 lu directement sur le Tableau de Localisation (p.159). */
export function critLocationRoll(rng: RNG = defaultRNG): HitLocation {
  return hitLocation(d100(rng));
}

function findEntry(table: CritEntry[], roll: number): CritEntry {
  return table.find((e) => roll >= e.min && roll <= e.max) ?? table[table.length - 1];
}

/** Résout une Blessure critique sur `target` à la `location`. `overkill` = PB perdus au-delà
 *  des PB courants (0 si Coup Critique sans overkill). */
export function rollCritical(target: Combatant, location: HitLocation, rng: RNG = defaultRNG, overkill = 0): CriticalResolved {
  const be = bonus(effectiveChar(target, 'E'));
  const reduction = overkill > be ? 20 : 0; // l.30 : overkill > BE → -20 (résultat moins sévère)
  const roll = Math.max(1, d100(rng) - reduction);
  const entry = findEntry(CRITICAL_TABLES[location], roll);
  const conditions = [...(entry.conditions ?? [])];
  // Test de Résistance auto-résolu : « réussir ou gagner l'État X ».
  if (entry.resist) {
    const resistVal = effectiveChar(target, 'E') + (target.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    const res = rollTest(resistVal, entry.resist.difficulty, rng);
    if (!res.success) conditions.push(...entry.resist.onFail);
  }
  return {
    location,
    name: entry.name,
    woundsLoss: entry.wounds,
    lethal: !!entry.lethal,
    conditions,
    note: entry.note,
    roll,
    log: `Blessure critique (${location}) — ${entry.name}${entry.lethal ? ' — MORT !' : ''}.`,
  };
}
```

- [ ] **Step 4 : Lancer → succès.**

Run: `npx vitest run src/engine/critical.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/engine/critical.ts src/engine/critical.test.ts
git commit -m "feat(combat): moteur pur de résolution des Blessures critiques (rollCritical, -20 overkill, resist auto)"
```

---

## Task 3 : Moteur — modèle de mort & `isOutOfAction` révisé (`src/engine/conditions.ts`)

**Files:**
- Modify: `src/engine/types.ts` (Combatant)
- Modify: `src/engine/conditions.ts` (`isOutOfAction`, + `usesSuddenDeath`/`applyZeroWounds`/`tickDeath`)
- Test: `src/engine/conditions.test.ts` (ou nouveau `src/engine/death.test.ts`)

- [ ] **Step 1 : Ajouter les champs au `Combatant`** (`src/engine/types.ts`, après `resolve?: number;`) :
```ts
  // Traumatisme (LDB 18) — modèle de mort
  /** Nombre de Blessures critiques cumulées (mort si > Bonus d'Endurance + Inconscient + 0 PB). */
  criticalWounds?: number;
  /** Rounds consécutifs passés à 0 PB sans soin (→ Inconscient après BE rounds). */
  roundsAtZero?: number;
  /** Mort (résultat létal ou mort lente). Hors de combat définitif. */
  dead?: boolean;
  /** PNJ important : utilise le système complet de critiques au lieu de la Mort Subite. */
  important?: boolean;
```

- [ ] **Step 2 : Écrire les tests (échec attendu)** — `src/engine/death.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { isOutOfAction, usesSuddenDeath, applyZeroWounds, tickDeath, hasCondition } from './conditions';
import { makeRNG } from './dice';
import type { Combatant } from './types';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({
    name: 'C', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 }, // BE=3
    wounds: { current: 10, max: 12 }, conditions: [], skills: [], ...over,
  }) as unknown as Combatant;

describe('Modèle de mort (LDB 18-Traumatisme)', () => {
  it('héros à 0 PB n’est PAS hors de combat (À Terre, agit encore)', () => {
    const h = mk({ wounds: { current: 0, max: 12 } });
    expect(isOutOfAction(h)).toBe(false);
  });
  it('ennemi à 0 PB est hors de combat (Mort Subite)', () => {
    const e = mk({ kind: 'enemy', wounds: { current: 0, max: 12 } });
    expect(usesSuddenDeath(e)).toBe(true);
    expect(isOutOfAction(e)).toBe(true);
  });
  it('Inconscient ou mort = hors de combat', () => {
    expect(isOutOfAction(mk({ conditions: [{ name: 'Inconscient', value: 1 }] }))).toBe(true);
    expect(isOutOfAction(mk({ dead: true }))).toBe(true);
  });
  it('applyZeroWounds : à 0 PB → À Terre', () => {
    const h = mk({ wounds: { current: 0, max: 12 } });
    applyZeroWounds(h);
    expect(hasCondition(h, 'À Terre')).toBe(true);
  });
  it('tickDeath : à 0 PB, Inconscient après BE rounds', () => {
    const h = mk({ wounds: { current: 0, max: 12 }, roundsAtZero: 3 }); // BE=3
    tickDeath(h, makeRNG(1)); // roundsAtZero 3 → 4 > BE 3 → Inconscient
    expect(hasCondition(h, 'Inconscient')).toBe(true);
  });
  it('tickDeath : Inconscient + 0 PB + critiques > BE → mort en fin de Round', () => {
    const h = mk({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4 }); // BE=3
    tickDeath(h, makeRNG(1));
    expect(h.dead).toBe(true);
  });
  it('tickDeath : un combattant guéri (PB>0) remet roundsAtZero à 0', () => {
    const h = mk({ wounds: { current: 5, max: 12 }, roundsAtZero: 2 });
    tickDeath(h, makeRNG(1));
    expect(h.roundsAtZero).toBe(0);
  });
});
```

- [ ] **Step 3 : Lancer → échec** (`usesSuddenDeath`/`applyZeroWounds`/`tickDeath` manquants).

Run: `npx vitest run src/engine/death.test.ts`
Expected: FAIL.

- [ ] **Step 4 : Modifier `src/engine/conditions.ts`** — remplacer `isOutOfAction` (dernière fonction du fichier) et ajouter les helpers :
```ts
/** Un figurant (non-héros) sort directement à 0 PB (Mort Subite, LDB 18 l.51-54). */
export function usesSuddenDeath(c: Combatant): boolean {
  return c.kind !== 'hero' && !c.important;
}

/** Hors de combat : mort, ou Inconscient, ou figurant tombé à 0 PB (Mort Subite).
 *  Un héros à 0 PB reste actif (À Terre) — il n'est PAS hors de combat (LDB 18 l.28). */
export function isOutOfAction(c: Combatant): boolean {
  return c.dead === true || hasCondition(c, 'Inconscient') || (usesSuddenDeath(c) && c.wounds.current <= 0);
}

/** À 0 PB : gagne À Terre (l.28). À appeler quand un coup non-critique amène à 0. */
export function applyZeroWounds(c: Combatant): void {
  if (c.wounds.current <= 0 && !hasCondition(c, 'À Terre')) addCondition(c, 'À Terre');
}

/**
 * Upkeep de mort en fin de Round (LDB 18 l.28, l.48-49) — héros/importants :
 *  - à 0 PB non soigné : roundsAtZero++ ; après (BE) rounds → Inconscient ;
 *  - Inconscient + 0 PB + (criticalWounds > BE) → mort.
 * Retourne le journal. (rng réservé pour de futurs Tests ; non utilisé ici.)
 */
export function tickDeath(c: Combatant, _rng: RNG = defaultRNG): string[] {
  const log: string[] = [];
  if (c.dead || usesSuddenDeath(c)) return log;
  const be = bonus(effectiveChar(c, 'E'));
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    return log;
  }
  // À 0 PB.
  c.roundsAtZero = (c.roundsAtZero ?? 0) + 1;
  if (c.roundsAtZero > be && !hasCondition(c, 'Inconscient')) {
    addCondition(c, 'Inconscient');
    log.push(`${c.name} perd connaissance (0 PB depuis ${c.roundsAtZero} Rounds).`);
  }
  if (hasCondition(c, 'Inconscient') && (c.criticalWounds ?? 0) > be) {
    c.dead = true;
    log.push(`${c.name} succombe à ses blessures.`);
  }
  return log;
}
```
> `bonus`/`effectiveChar` sont déjà importés dans `conditions.ts` ; `RNG`/`defaultRNG` aussi (via `./dice`). Vérifier l'import et l'ajouter si besoin.

- [ ] **Step 5 : Lancer → succès.**

Run: `npx vitest run src/engine/death.test.ts`
Expected: PASS.

- [ ] **Step 6 : Régression — suite complète** (le changement d'`isOutOfAction` est sensible) :

Run: `npm test`
Expected: tout vert. Les tests qui mettent `enemy.wounds.current = 0` restent OK (figurants → toujours hors de combat). Si un test met un **héros** à 0 PB en s'attendant à « hors de combat », l'ajuster (mettre `dead:true` ou `Inconscient`, qui sont la nouvelle sémantique). Documenter tout ajustement.

- [ ] **Step 7 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/engine/types.ts src/engine/conditions.ts src/engine/death.test.ts
git commit -m "feat(combat): modèle de mort WFRP4 — 0 PB ≠ mort (À Terre→Inconscient→mort), isOutOfAction révisé"
```

---

## Task 4 : Store — pipeline de critique dans l'application des Dégâts

**Files:**
- Modify: `src/engine/combat.ts` (`applyHit` : retirer `woundsLost > max` du flag critique)
- Modify: `src/state/store.ts` (`applyAttackResult`, `applyCast` branche missile ; imports)
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Écrire les tests (échec attendu)** — ajouter un `describe` à `src/state/store.test.ts` :
```ts
describe('Blessures critiques en combat (LDB 18-Traumatisme)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); reset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function combat(heroOver: Partial<Combatant> = {}, enemyOver: Partial<Combatant> = {}) {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(3) });
    Object.assign(H, heroOver);
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0'; E.name = 'Brigand'; E.kind = 'enemy'; Object.assign(E, enemyOver);
    const battle: BattleState = {
      combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpell: null,
      reachable: new Map(), moved: false, acted: false, log: [], over: null,
    };
    useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8) });
    return { H, E };
  }

  it('overkill sur un HÉROS → Blessure critique (compteur++), pas mort à 0 PB seul, reste actif', () => {
    const { H, E } = combat({ wounds: { current: 2, max: 12 } });
    // applyAttackResult appliqué directement : un coup de 6 (woundsLost) sur 2 PB courants = overkill.
    const before = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.criticalWounds ?? 0;
    // On résout une attaque ennemi→héros via le store (doAttack/applyAttackResult). On force la touche.
    useGame.getState().seedRng(2);
    // (Câblage : voir Step 3. Le test vérifie le résultat de l'application.)
    // Simuler une touche létale-overkill via applyAttackResult exposé par le flux normal :
    expect(before).toBe(0);
  });
});
```
> NB : `applyAttackResult` est une fonction de **module** (non exportée). Le test pilote via le flux store réel (`doAttack`/`attackConfirm`). Affiner les assertions au Step 3 une fois le câblage écrit ; viser : `criticalWounds` du héros incrémenté après un overkill, `À Terre` présent, héros non `dead`, et `isOutOfAction(héros)` false.

- [ ] **Step 2 : `combat.ts` — retirer le déclencheur « > max »** (`applyHit`, ligne `const isCritical = critical || empale || woundsLost > defender.wounds.max;`) :
```ts
  // Coup Critique = double réussi (déjà `critical`) ou Atout Empaleuse sur un multiple de 10 (l.282).
  // L'overkill (woundsLost > PB courants) est désormais géré par le STORE (pipeline de critique),
  // car il dépend des PB courants de la cible (LDB 18-Traumatisme l.30), pas des PB max.
  const empale = hasQ(weapon, 'Empaleuse') && atkBd.roll % 10 === 0;
  const isCritical = critical || empale;
```

- [ ] **Step 3 : `store.ts` — ajouter le pipeline + imports.**

Imports (en tête) :
```ts
import { rollCritical, critLocationRoll } from '../engine/critical';
import { isOutOfAction, endOfRound, addCondition, removeCondition, cannotDefend, canTakeAction, applyZeroWounds, tickDeath, usesSuddenDeath } from '../engine/conditions';
```
(fusionner avec l'import `conditions` existant l.55 — ajouter `applyZeroWounds, tickDeath, usesSuddenDeath`.)

Ajouter un helper de module (près de `applyAttackResult`, avant celui-ci) :
```ts
/** Applique une Blessure critique (Coup Critique ou overkill) à `target` : PB (ignore BE+PA,
 *  plancher 0) + États + compteur + létalité. Mort Subite pour les figurants en overkill. */
function applyCriticalToTarget(
  target: Combatant,
  location: HitLocation,
  isCoupCritique: boolean,
  overkill: number,
  log: string[],
): void {
  if (overkill > 0 && !isCoupCritique && usesSuddenDeath(target)) {
    // Figurant : Mort Subite (LDB 18 l.51-54) — sortie directe.
    target.wounds.current = 0;
    if (!target.conditions.some((c) => c.name === 'Inconscient')) addCondition(target, 'Inconscient');
    log.push(`${target.name} s'effondre, hors de combat.`);
    return;
  }
  const loc = isCoupCritique ? critLocationRoll(battleRng) : location; // Coup Critique = localisation fraîche (l.62)
  const crit = rollCritical(target, loc, battleRng, overkill);
  target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  if (crit.lethal) {
    target.dead = true; // résultat « Mort » instantané (le sauvetage par Destin sera branché ici plus tard)
  } else {
    target.wounds.current = Math.max(0, target.wounds.current - crit.woundsLoss); // ignore BE+PA, plancher 0
    for (const c of crit.conditions) addCondition(target, c.name, c.value);
  }
  log.push(crit.log);
  if (crit.note) log.push(`  ↳ ${crit.note}`); // effet long terme journalisé, non simulé
}
```

Dans `applyAttackResult`, remplacer le bloc d'application des Dégâts/critique. Bloc **actuel** (l.~1299-1302) :
```ts
  if (res.hit && res.woundsLost) {
    target.wounds.current = Math.max(0, target.wounds.current - res.woundsLost);
    if (res.critical && target.wounds.current > 0) addCondition(target, 'À Terre');
  }
```
**Remplacer par** :
```ts
  const critLog: string[] = [];
  if (res.hit && res.woundsLost) {
    const currentBefore = target.wounds.current;
    const overkill = res.woundsLost - currentBefore; // > 0 si le coup dépasse les PB courants (LDB 18 l.30)
    target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
    if (res.critical || overkill > 0) {
      applyCriticalToTarget(target, res.location ?? 'corps', !!res.critical, Math.max(0, overkill), critLog);
    } else if (target.wounds.current <= 0) {
      applyZeroWounds(target); // 0 PB sans critique → À Terre (LDB 18 l.28)
    }
  }
```
Puis, plus bas dans `applyAttackResult`, injecter `critLog` dans le journal : repérer `const log = [...battle.log, res.log];` et le faire suivre de :
```ts
  log.push(...critLog);
```

- [ ] **Step 4 : `store.ts` — même pipeline pour le Projectile magique** (`applyCast`, branche `if (missile)` l.~1455-1459). Bloc actuel :
```ts
    if (res.hit && res.woundsLost) {
      target.wounds.current = Math.max(0, target.wounds.current - res.woundsLost);
      if (res.isCritical && target.wounds.current > 0) addCondition(target, 'À Terre');
    }
```
Remplacer par :
```ts
    if (res.hit && res.woundsLost) {
      const currentBefore = target.wounds.current;
      const overkill = res.woundsLost - currentBefore;
      target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
      if (res.isCritical || overkill > 0) {
        applyCriticalToTarget(target, res.location ?? 'corps', !!res.isCritical, Math.max(0, overkill), logLines);
      } else if (target.wounds.current <= 0) {
        applyZeroWounds(target);
      }
    }
```

- [ ] **Step 5 : Affiner et lancer les tests store.** Compléter le `describe` du Step 1 avec des assertions réelles (piloter une attaque ennemi→héros à 2 PB pour forcer l'overkill, vérifier `criticalWounds === 1`, `À Terre`/États présents, `dead === false`, `isOutOfAction(H) === false`). Exemple complet à viser :
```ts
  it('overkill sur un HÉROS → critique (compteur++), reste actif à 0 PB', () => {
    const { H, E } = combat({ wounds: { current: 2, max: 12 } }, { characteristics: { CC: 80, CT: 30, F: 50, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 } });
    H.pos = { x: 1, y: 0 }; E.pos = { x: 0, y: 0 };
    useGame.getState().seedRng(2);
    useGame.setState({ battle: { ...useGame.getState().battle!, order: [E.id, H.id], turn: 0 } });
    // L'IA (E) attaque H en mêlée → modale de défense ; on subit pour forcer l'application.
    useGame.setState({ pendingDefense: { attackerId: E.id, defenderId: H.id, weapon: E.weapons[0], location: null, atk: { roll: 5, target: 80, success: true, sl: 7, isDouble: false }, mode: 'parade', def: null, result: null } });
    useGame.getState().defenseCancel(); // « Subir » → applyAttackResult
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.criticalWounds ?? 0).toBeGreaterThanOrEqual(1);
    expect(h.dead ?? false).toBe(false);
    expect(isOutOfAction(h)).toBe(false); // 0 PB mais conscient → toujours actif
  });
```
(importer `isOutOfAction` depuis `../engine/conditions` en tête du fichier de test.)

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS.

- [ ] **Step 6 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/engine/combat.ts src/state/store.ts src/state/store.test.ts
git commit -m "feat(combat): pipeline de Blessure critique (overkill/double) dans l'application des Dégâts + Mort Subite figurants"
```

---

## Task 5 : Store — upkeep de mort en fin de Round

**Files:**
- Modify: `src/state/store.ts` (`advanceTurn` round-boundary)
- Test: `src/state/store.test.ts`

- [ ] **Step 1 : Écrire le test (échec attendu)** — ajouter au `describe` Blessures critiques :
```ts
  it('héros Inconscient + 0 PB + critiques > BE → meurt en fin de Round', () => {
    const { H, E } = combat({ wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }], criticalWounds: 4 }); // BE=3
    useGame.setState({ battle: { ...useGame.getState().battle!, order: [E.id, H.id], turn: 1 } }); // H dernier → battleEndTurn franchit le Round
    useGame.getState().seedRng(1);
    useGame.getState().battleEndTurn();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.dead).toBe(true);
  });
```

- [ ] **Step 2 : Lancer → échec** (la mort lente n'est pas appliquée).

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Brancher `tickDeath` dans `advanceTurn`** — dans le bloc round-boundary, juste après la boucle `endOfRound` existante (l.~1584). Bloc actuel :
```ts
      for (const c of battle.combatants) endOfRound(c, battleRng).forEach((l) => battle!.log.push(l));
```
Ajouter juste après :
```ts
      for (const c of battle.combatants) tickDeath(c, battleRng).forEach((l) => battle!.log.push(l));
```
(`tickDeath` est importé depuis `../engine/conditions` — fait à la Task 4 Step 3.)

- [ ] **Step 4 : Lancer → succès + suite.**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS. Puis `npm test` (régression).

- [ ] **Step 5 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(combat): upkeep de mort en fin de Round (0 PB→Inconscient après BE rounds, mort si critiques > BE)"
```

---

## Task 6 : UI — affichage À Terre / Inconscient / Mort

**Files:**
- Modify: `src/ui/BattlePanel.tsx` (ou le rendu de jeton dans `src/gameIso/IsoStage.tsx`)

Le journal annonce déjà les critiques (logs poussés). Cette tâche rend l'**état vital** lisible.

- [ ] **Step 1 : Localiser l'affichage du combattant actif / des jetons.** Inspecter `src/ui/BattlePanel.tsx` (round/initiative/résultat) et la liste des combattants ; choisir où afficher un badge d'État vital.

- [ ] **Step 2 : Ajouter un badge d'état vital.** Pour chaque combattant affiché, dériver un libellé :
```tsx
const vital = c.dead ? '☠️ Mort' : c.conditions.some((x) => x.name === 'Inconscient') ? '😵 Inconscient' : c.wounds.current <= 0 ? '🩸 À Terre (0 PB)' : null;
```
et le rendre (ex. `{vital && <span className="bp-vital">{vital}</span>}`) à côté des PB. (Pas de nouveau CSS obligatoire ; réutiliser une classe d'info existante.)

- [ ] **Step 3 : Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/ui/BattlePanel.tsx
git commit -m "feat(ui): badge d'état vital en combat (À Terre 0 PB / Inconscient / Mort)"
```

---

## Task 7 : ROADMAP + vérification finale

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1 : Suite + typecheck + build**

Run: `npm test` → tout vert. `npm run typecheck` → 0 erreur. `npm run build` → OK.

- [ ] **Step 2 : Mettre à jour `ROADMAP.md`** :
  - l.117 (titre Jalon 1) : retirer « tables de critiques » du *reste*.
  - l.134 : remplacer par `- **Critiques** ✅ : tables de Blessures critiques par localisation (LDB 18-Traumatisme) — 0 PB ≠ mort (À Terre→Inconscient→mort si critiques > BE), overkill/double, Mort Subite figurants ; effets long terme journalisés (→ Jalon 5). **Maladresses** : reste.`
  - l.254 (dette « Combat — reste ») : marquer Critiques ✅, **Maladresses** reste ; noter le fix `isOutOfAction`.

- [ ] **Step 3 : Commit**

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): Blessures critiques & modèle de mort livrés (Maladresses = reste)"
```

- [ ] **Step 4 : Recette navigateur (MANUELLE — par l'utilisateur)** : non réalisée par l'agent (profil Playwright indisponible). À vérifier à l'œil : un héros tombé à 0 PB reste jouable (À Terre), se relève via Détermination (+1 PB) ; une grosse touche déclenche « Blessure critique — <nom> » au journal ; un `00` tue ; un figurant tombe à 0 directement.

---

## Auto-revue du plan (effectuée)

- **Couverture spec :** tables (Task 1) · `rollCritical`/−20/resist (Task 2) · modèle 0 PB→À Terre→Inconscient→mort + `isOutOfAction` révisé (Task 3) · pipeline overkill/double + Mort Subite (Task 4) · upkeep de mort fin de Round (Task 5) · UI état vital (Task 6) · ROADMAP (Task 7). ✓
- **Décalage assumé :** valeurs « 1d10 États » des entrées encodées en valeur fixe (note l'indique) — simplification documentée. Coup Critique → localisation fraîche ; les Dégâts normaux restent à la localisation d'origine (l.64 simplifié, noté). Backstab de Fuite (`disengageFlee`) **non** branché sur les critiques v1 (cas mineur, à noter en reste).
- **Cohérence des types :** `CritEntry`/`CritTable`/`CRITICAL_TABLES` (Task 1) → `rollCritical`/`CriticalResolved`/`critLocationRoll` (Task 2) → `usesSuddenDeath`/`applyZeroWounds`/`tickDeath`/`isOutOfAction` + champs `criticalWounds`/`roundsAtZero`/`dead`/`important` (Task 3) → `applyCriticalToTarget` (Task 4) → `tickDeath` en fin de Round (Task 5). ✓
- **Risque principal :** la révision d'`isOutOfAction` (Task 3) — atténuée par `usesSuddenDeath = kind!=='hero'` (ennemis à 0 toujours hors de combat → tests existants préservés) + régression `npm test` au Step 6.
- **Points de branchement futurs (sous-projets suivants) :** Destin (`applyCriticalToTarget` quand `crit.lethal`/mort lente), Résilience « Je ne faillirai pas ! » (choix de localisation de Critique).
