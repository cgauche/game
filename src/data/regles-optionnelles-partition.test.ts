import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import reglesOptionnelles from './reglesOptionnelles.json';

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));

/**
 * Garde-fou « une règle optionnelle est SOURCÉE ou MAISON, jamais les deux, jamais aucune »
 * (#1467 L1b V-Src).
 *
 * L'invariant existait en PROSE — `citation-coverage-guard.test.ts:36-39` le raconte (« les 54
 * entrées restantes portent leur `source: {book,page}` … les 27 autres portent `maison` ») — mais
 * aucun test ne l'écrivait : la garde de couverture accepte `source` OU `maison` indifféremment
 * (`isCitedItem`, `citationCoverage.mjs:25-27`), donc une entrée portant les DEUX y passerait pour
 * citée. Or les deux champs se contredisent : `source` ancre la valeur à un folio imprimé, `maison`
 * la déclare arbitrée hors canon. Une entrée qui porte les deux ne dit plus d'où sa valeur vient.
 *
 * Le test est écrit GÉNÉRIQUEMENT (partition XOR par entrée) ; les comptes sont stockés en second
 * volet, pour que le déplacement d'une entrée d'une classe à l'autre soit vu.
 *
 * PORTÉE — À LIRE AVANT DE GÉNÉRALISER : « jamais les deux » est un invariant LOCAL de CE dataset,
 * pas une règle de fabrique. `document()` pose `source` ∨ `maison` (au moins l'un des deux) ; la
 * COEXISTENCE des deux est légitime ailleurs et MESURÉE (`maison` CHAÎNE non vide) sur des entrées de
 * premier niveau : une entrée y cite son folio ET dit ce que le canon n'a pas tranché. Étendre ce XOR
 * à la fabrique les casserait. Ce relevé ne vit plus en prose : il est GELÉ dans `COEXISTENCE`
 * ci-dessous et asserté — la prose dérivait à chaque lot qui déplaçait une entrée.
 */

type Regle = { id: string; ref?: string; source?: { book: string; page: number }; maison?: string };

const REGLES = reglesOptionnelles as Regle[];

/** Partition mesurée au 2026-08-27 : 81 = 54 sourcées + 27 maison, 0 des deux, 0 d'aucune. */
const PARTITION = { total: 81, source: 54, maison: 27 };

/**
 * COEXISTENCE `source` + `maison` (chaîne non vide) sur les entrées de PREMIER niveau de `src/data`,
 * gelée au 2026-08-27 — la POPULATION que le XOR ci-dessus ne décrit PAS, et qu'une généralisation à
 * la fabrique casserait. `actions.json` y est entré avec le lot V-P3 (#1467 L1b) : `switch-loadout`
 * cite son folio pour la gratuité ET porte en clair l'arbitrage du plafond.
 */
const COEXISTENCE: Record<string, number> = {
  'actions.json': 1,
  'activities.json': 8,
  'creatures.json': 1,
  'etats.json': 1,
  // 1 → 2 (#1657 B3-2b-a) : le Trait `cale` porte MSRC 10 p.53 (le livre DIT la cale du navire
  // marchand) ET son `maison` (MSRC 07 l.94 gate le Critique dessus sans imprimer de Trait naval).
  'naval-traits.json': 2,
  'structures.json': 2,
  'talents.json': 9,
  'traits.json': 3,
  'trappings.json': 2,
  'traumas.json': 2,
};

describe('reglesOptionnelles.json — partition source ⊕ maison (#1467 L1b)', () => {
  it('chaque entrée porte `source` XOR `maison` — jamais les deux, jamais aucune', () => {
    const deuxFois: string[] = [];
    const aucune: string[] = [];
    for (const r of REGLES) {
      const aSource = !!r.source;
      const aMaison = typeof r.maison === 'string' && r.maison.length > 0;
      if (aSource && aMaison) deuxFois.push(r.id);
      if (!aSource && !aMaison) aucune.push(r.id);
    }
    expect(deuxFois, `entrée(s) à la fois SOURCÉE et MAISON : ${deuxFois.join(', ')}`).toEqual([]);
    expect(aucune, `entrée(s) SANS provenance : ${aucune.join(', ')}`).toEqual([]);
  });

  it('les comptes de la partition sont ceux stockés (un glissement de classe se voit)', () => {
    const source = REGLES.filter((r) => r.source).length;
    const maison = REGLES.filter((r) => r.maison).length;
    expect({ total: REGLES.length, source, maison }).toEqual(PARTITION);
  });

  it('la COEXISTENCE `source` + `maison` du reste de `src/data` est celle gelée (le XOR reste LOCAL)', () => {
    const mesure: Record<string, number> = {};
    for (const f of readdirSync(DATA_DIR)) {
      if (!f.endsWith('.json')) continue;
      let data: unknown;
      try {
        data = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'));
      } catch {
        continue;
      }
      const items = Array.isArray(data) ? data : [data];
      const n = items.filter((e) => {
        if (!e || typeof e !== 'object') return false;
        const r = e as Record<string, unknown>;
        return typeof r.maison === 'string' && r.maison.length > 0 && r.source !== undefined;
      }).length;
      if (n > 0) mesure[f] = n;
    }
    expect(mesure, `coexistences source+maison — attendu ${JSON.stringify(COEXISTENCE)}, mesuré ${JSON.stringify(mesure)}`).toEqual(COEXISTENCE);
  });

  it('une entrée SOURCÉE porte un folio numérique et un livre non vide', () => {
    const fautifs = REGLES.filter((r) => r.source).filter(
      (r) => typeof r.source!.page !== 'number' || !r.source!.book,
    );
    expect(fautifs.map((r) => r.id)).toEqual([]);
  });
});
