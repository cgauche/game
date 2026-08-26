import { describe, it, expect } from 'vitest';
import reglesOptionnelles from './reglesOptionnelles.json';

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
 * COEXISTENCE des deux est légitime ailleurs et MESURÉE (2026-08-27, `maison` CHAÎNE non vide) sur
 * 8 fichiers / 27 entrées de premier niveau — `talents` 9, `activities` 8, `traits` 3, `trappings` 2,
 * `traumas` 2, `creatures` 1, `etats` 1, `naval-traits` 1 : une entrée y cite son folio ET dit ce que
 * le canon n'a pas tranché. Étendre ce XOR à la fabrique casserait ces 27 entrées.
 * (`actions.json` n'en est PAS : ses 30 `maison` sont des drapeaux BOOLÉENS, un autre concept — cf.
 * `schemas/grammaire/document.ts`, champ `maison`.)
 */

type Regle = { id: string; ref?: string; source?: { book: string; page: number }; maison?: string };

const REGLES = reglesOptionnelles as Regle[];

/** Partition mesurée au 2026-08-27 : 81 = 54 sourcées + 27 maison, 0 des deux, 0 d'aucune. */
const PARTITION = { total: 81, source: 54, maison: 27 };

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

  it('une entrée SOURCÉE porte un folio numérique et un livre non vide', () => {
    const fautifs = REGLES.filter((r) => r.source).filter(
      (r) => typeof r.source!.page !== 'number' || !r.source!.book,
    );
    expect(fautifs.map((r) => r.id)).toEqual([]);
  });
});
