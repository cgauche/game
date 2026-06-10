# Phase C2b — Pénalités de port d'armure (hors combat) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Étapes en `- [ ]`.
> ⚠️ Fichiers chauds (4 sessions Claude //) → relire avant chaque edit ; `git commit -- <chemins>`.

**Goal:** Un héros qui **porte** une maille/plate subit la pénalité canonique aux **Tests hors combat** de la compétence pénalisée (−10 **Discrétion** par pièce de maille/plate ; −10/−20 **Perception** pour certains heaumes — LDB 63 l.84-95). La pénalité est **réduite d'un niveau (+10)** si la pièce est **Pratique**, **doublée** si **Peu Fiable** (LDB 60 l.59/88).

**Architecture :** Les pénalités sont **DÉJÀ dans la donnée** — sous forme de chaînes dans `ItemInstance.qualities[]` (« -10% en Discrétion », « -20% en Perception »), fidèles à la table FR (vérifié : 9 pièces maille/plate ont « -10% en Discrétion », les 3 heaumes ont la Perception). On NE rajoute donc **aucun champ `wearPenalty`** ni patch `build-data` (≠ spec §4.3) : un **parser pur** lit ces chaînes, un helper somme les pénalités des pièces **équipées** de l'acteur (modulées par Pratique/Peu Fiable), et `skills.ts:testValue` les soustrait. **Hook combat abandonné** (YAGNI : aucune armure ne pénalise une compétence de combat — uniquement Discrétion/Perception, hors combat).

**Tech Stack :** TypeScript pur, Vitest.

---

## État actuel (vérifié 2026-06-07, source FR)

- **Source RAW** : `Source/Warhammer v4 - Livre de base version corrigée/63 - Armures.md` :
  - l.95 (footnote **) : « Porter n'importe quelle maille ou plate confère chaque fois une pénalité de **-10 en Discrétion**. »
  - l.84 Coiffe de mailles **-10 Perception** ; l.88 Heaume **-20 Perception** ; l.89 Heaume ouvert **-10 Perception** ; l.90 Jambières d'acier -10 Discrétion (= la règle **).
  - l.93 (footnote *) : le cuir souple se porte **sans pénalité**.
- **Donnée du jeu** (`src/data/trappings.json`, généré) : chaque pièce d'armure a ses pénalités **déjà inlinées** dans `qualities[]` — ex. `Heaume` → `["Impénétrable", "Points faibles", "-10% en Discrétion", "-20% en Perception"]`, `subType: "Plate"`, `type: "armor"`. Format constant : `"-N% en <Compétence>"`. **9 chaînes Discrétion + 3 Perception** = la table FR exacte.
- **Compétences** `Discrétion` (Ag) et `Perception` (I) existent (`src/data/skills.json`).
- **`skills.ts:testValue(c, skill?, characteristic?)`** (16-26) : `base = caract + advances` ; AUCUNE pénalité d'armure aujourd'hui. `partyBest` (29-40) sélectionne le meilleur acteur via `testValue`.
- **`ItemInstance`** : `qualities: string[]`, `equipped: boolean`, `kind` (`'armor'` pour les armures), pas de champ pénalité. `hasQuality(carrier, key)` (qualities/dispatch) accepte tout `{qualities}`.

## Décision de conception (≠ spec §4.3 — à valider)

**Parser les chaînes existantes** plutôt qu'ajouter `TrappingData.wearPenalty` + un patch `build-data`. Justif : la donnée encode déjà la table FR fidèlement (DRY, source unique, zéro re-transcription = zéro risque d'invention). Inconvénient : couplage à un format de chaîne (`"-N% en X"`) — mitigé par un parser testé et tolérant.

**Périmètre fichiers :** `src/engine/wearPenalty.ts` (neuf, pur), `src/engine/skills.ts` (hook dans `testValue`), `src/engine/wearPenalty.test.ts` (neuf), `src/engine/skills.test.ts` (si existe, sinon dans wearPenalty.test.ts).

---

## Task 1 : Parser `parseWearPenalty` (pur)

**Files:** Create `src/engine/wearPenalty.ts` ; Create `src/engine/wearPenalty.test.ts`.

- [ ] **Step 1 : Test qui échoue**

```ts
import { describe, it, expect } from 'vitest';
import { parseWearPenalty } from './wearPenalty';

describe('parseWearPenalty', () => {
  it('parse « -10% en Discrétion » → { skill: Discrétion, value: -10 }', () => {
    expect(parseWearPenalty('-10% en Discrétion')).toEqual({ skill: 'Discrétion', value: -10 });
  });
  it('parse « -20% en Perception »', () => {
    expect(parseWearPenalty('-20% en Perception')).toEqual({ skill: 'Perception', value: -20 });
  });
  it('renvoie null pour une qualité non-pénalité', () => {
    expect(parseWearPenalty('Flexible')).toBeNull();
    expect(parseWearPenalty('Impénétrable')).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npx vitest run src/engine/wearPenalty.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3 : Implémenter `wearPenalty.ts`**

```ts
/**
 * Pénalités de port d'armure (LDB 63 l.84-95) : déjà encodées dans `qualities[]` des armures
 * sous la forme « -N% en <Compétence> » (ex. « -10% en Discrétion », « -20% en Perception »).
 * Ce module les PARSE (pas de re-transcription) et somme celles des pièces ÉQUIPÉES d'un acteur,
 * modulées par l'artisanat de la pièce (Pratique réduit d'un niveau, Peu Fiable double — LDB 60 l.59/88).
 */
import { Combatant } from './types';
import { hasQuality } from './qualities/dispatch';

const WEAR_RE = /^\s*([+-]?\d+)\s*%?\s*en\s+(.+?)\s*$/i;

/** Parse une chaîne de pénalité de port (« -10% en Discrétion ») ; null si ce n'en est pas une. */
export function parseWearPenalty(q: string): { skill: string; value: number } | null {
  const m = WEAR_RE.exec(q);
  if (!m) return null;
  return { value: parseInt(m[1], 10), skill: m[2].trim() };
}
```

- [ ] **Step 4 : Lancer → passe**

Run: `npx vitest run src/engine/wearPenalty.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git commit -- src/engine/wearPenalty.ts src/engine/wearPenalty.test.ts -m "feat(qualites): parser de penalite de port d'armure (Phase C2b)"
```

---

## Task 2 : `wornArmourPenalty(c, skill)` — somme + modificateurs Pratique/Peu Fiable

**Files:** Modify `src/engine/wearPenalty.ts` ; Modify `src/engine/wearPenalty.test.ts`.

- [ ] **Step 1 : Tests qui échouent**

```ts
import { wornArmourPenalty } from './wearPenalty';
import type { Combatant } from './types';

function mkWearer(qualities: string[]): Combatant {
  return {
    id: 'h', name: 'A', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 40, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [{ uid: 'a1', name: 'Heaume', kind: 'armor', qualities, pa: 2, locs: ['tete'], enc: 2, equipped: true }],
  } as unknown as Combatant;
}

describe('wornArmourPenalty', () => {
  it('somme la pénalité de la compétence portée (Perception -20 sur un Heaume)', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', '-20% en Perception']), 'Perception')).toBe(-20);
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', '-20% en Perception']), 'Discrétion')).toBe(-10);
  });
  it('ignore une pièce NON équipée', () => {
    const c = mkWearer(['-20% en Perception']);
    c.items![0].equipped = false;
    expect(wornArmourPenalty(c, 'Perception')).toBe(0);
  });
  it('Pratique réduit la pénalité d’un niveau (+10, plancher 0)', () => {
    expect(wornArmourPenalty(mkWearer(['-20% en Perception', 'Pratique']), 'Perception')).toBe(-10);
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', 'Pratique']), 'Discrétion')).toBe(0);
  });
  it('Peu Fiable double la pénalité', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', 'Peu Fiable']), 'Discrétion')).toBe(-20);
  });
  it('match insensible à la spécialisation et à la casse', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion']), 'discrétion (Urbaine)')).toBe(-10);
  });
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npx vitest run src/engine/wearPenalty.test.ts`
Expected: FAIL (`wornArmourPenalty` absent).

- [ ] **Step 3 : Implémenter `wornArmourPenalty`** (ajouter à `wearPenalty.ts`)

```ts
/** Somme des pénalités de port (≤ 0) des armures ÉQUIPÉES de `c` pour la compétence `skill`
 *  (spécialisation/casse ignorées). Pratique réduit d'un niveau (+10, plancher 0), Peu Fiable double. */
export function wornArmourPenalty(c: Combatant, skill: string): number {
  const base = skill.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  let total = 0;
  for (const piece of c.items ?? []) {
    if (!piece.equipped || piece.kind !== 'armor') continue;
    for (const q of piece.qualities ?? []) {
      const p = parseWearPenalty(q);
      if (!p || p.skill.toLowerCase() !== base) continue;
      let v = p.value; // négatif
      if (hasQuality(piece, 'Pratique')) v = Math.min(0, v + 10); // Atout : -1 niveau (LDB 60 l.59)
      if (hasQuality(piece, 'Peu Fiable')) v = v * 2;              // Défaut : doublée (LDB 60 l.88)
      total += v;
    }
  }
  return total;
}
```

- [ ] **Step 4 : Lancer → passe** ; **Step 5 : Commit**

Run: `npx vitest run src/engine/wearPenalty.test.ts` → PASS.
```bash
git commit -- src/engine/wearPenalty.ts src/engine/wearPenalty.test.ts -m "feat(qualites): somme des penalites de port (Pratique/Peu Fiable) (Phase C2b)"
```

---

## Task 3 : Brancher dans `testValue` (skills.ts)

**Files:** Modify `src/engine/skills.ts` ; Test dans `src/engine/wearPenalty.test.ts`.

- [ ] **Step 1 : Test qui échoue** — `testValue` soustrait la pénalité ; `partyBest` préfère le non-armuré.

```ts
import { testValue, partyBest } from './skills';

describe('testValue + port d’armure', () => {
  function hero(id: string, ag: number, items: any[]) {
    return {
      id, name: id, kind: 'hero',
      characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: ag, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
      skills: [{ name: 'Discrétion', characteristic: 'Ag', advances: 0 }], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items,
    } as unknown as Combatant;
  }
  it('testValue soustrait la pénalité de Discrétion d’une cotte équipée', () => {
    const c = hero('h1', 40, [{ uid: 'a', name: 'Cotte de mailles', kind: 'armor', qualities: ['-10% en Discrétion'], enc: 3, equipped: true }]);
    expect(testValue(c, 'Discrétion')).toBe(30); // Ag 40 − 10
  });
  it('partyBest préfère le héros NON armuré pour un Test de Discrétion', () => {
    const armure = hero('arm', 45, [{ uid: 'a', name: 'Cotte de mailles', kind: 'armor', qualities: ['-10% en Discrétion'], enc: 3, equipped: true }]); // 35
    const leste = hero('leste', 40, []); // 40
    expect(partyBest([armure, leste], 'Discrétion')!.actor.id).toBe('leste');
  });
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npx vitest run src/engine/wearPenalty.test.ts -t "port d’armure"`
Expected: FAIL (pénalité non appliquée).

- [ ] **Step 3 : Implémenter le hook** (`skills.ts`)

Importer en haut :
```ts
import { wornArmourPenalty } from './wearPenalty';
```
Dans `testValue`, branche `if (skill)` — ajouter la pénalité (≤ 0) au retour :
```ts
  if (skill) {
    const ck = skillCharKey(skill) ?? 'Dex';
    const base = c.characteristics[ck] ?? 0;
    const low = skill.toLowerCase();
    const sk = c.skills.find((s) => low === s.name.toLowerCase() || low.startsWith(s.name.toLowerCase()));
    return base + (sk?.advances ?? 0) + wornArmourPenalty(c, skill); // pénalité de port d'armure (LDB 63)
  }
```
*(La branche `characteristic` pure n'applique PAS la pénalité : seule la compétence Discrétion/Perception est visée, pas un Test de caractéristique brut.)*

- [ ] **Step 4 : Lancer → passe** ; puis **suite complète** (le hook touche tous les Tests hors combat) :

Run: `npx vitest run src/engine/wearPenalty.test.ts -t "port d’armure"` → PASS
Run: `npm test` (attendu vert — les Tests existants utilisent des compétences hors Discrétion/Perception, ou des héros sans maille/plate équipée → pénalité 0 ; **si un test rougit**, c'est un héros armuré sur un Test Discrétion/Perception → ajuster l'attente du test, pas le code).
Run: `npm run typecheck` → 0.

- [ ] **Step 5 : Commit**

```bash
git commit -- src/engine/skills.ts src/engine/wearPenalty.test.ts -m "feat(qualites): testValue applique les penalites de port d'armure (Phase C2b)"
```

---

## Task 4 : Vérification finale

- [ ] `npm test` + `npm run typecheck` verts ; `golden-combat` intact (C2b ne touche pas le combat).
- [ ] Recette légère (optionnelle) : scène avec un `Effect.test` de Discrétion/Perception et un héros en maille → la cible du jet est réduite (visible dans la modale `pendingTest`).

---

## Fin — différé / hors périmètre

- **Hook combat** (`combat.ts:attackModifiers`) : NON implémenté — aucune armure FR ne pénalise une compétence de combat (Corps à corps/Projectiles/Esquive). À ajouter seulement si une telle armure apparaît (ADE).
- **C2c** : `Laid` (−10 Soc) + `Volumineux` (porté = Enc 1, Fatigue ×2) — nouveau champ social sur `QualityDef`.
- Prochain gros morceau : **#2 Marchand** (consomme `craftEconomy` + la réparation d'armure LDB 63 l.97-100).

## Self-review

- **Couverture** : parser (T1), somme + Pratique/Peu Fiable (T2), hook testValue + partyBest (T3), régression (T4). RAW cité (LDB 63 l.84-95, 60 l.59/88). ✓
- **Pas de placeholder** : parser, helper, hook, ~10 assertions montrés. ✓
- **Pas d'invention** : on PARSE la donnée existante (déjà extraite fidèlement du FR) — pas de re-transcription de la table. ✓
- **Cohérence types** : `parseWearPenalty(string) → {skill,value}|null` → `wornArmourPenalty(Combatant, string) → number ≤0` → consommé par `testValue`. `hasQuality` lit l'`ItemInstance` (porteur `{qualities}`). ✓
- **YAGNI** : champ `wearPenalty` + patch build-data **abandonnés** (donnée déjà présente) ; hook combat abandonné (aucune armure ne pénalise un Test de combat). ✓
- **Risque** : `testValue` touche TOUS les Tests hors combat → faire tourner `npm test` (T3 Step 4) ; un héros pré-généré portant une maille verra ses Tests de Discrétion/Perception baisser (correct RAW) — ajuster l'attente d'un test existant le cas échéant, pas le code.
