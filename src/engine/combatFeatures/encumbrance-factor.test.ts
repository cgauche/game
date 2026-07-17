/**
 * `encumbranceFactor` (ADE II ch.02 l.706-710) — capacité de race/créature MULTIPLIANT (Bonus de Force +
 * Bonus d'Endurance) avant l'ajout additif de Costaud (`talentEncumbranceBonus`). Le porteur DONNÉE (talent
 * de race ogre, posé sur `species.json`/`talents.json` par le lot données) est HORS PÉRIMÈTRE ici : ce test
 * prouve le mécanisme sur `maxEncumbranceFactor`, le cœur PUR du collecteur (`talentEncumbranceFactor`).
 */
import { describe, it, expect } from 'vitest';
import { maxEncumbranceFactor } from './dispatch';
import { maxEncumbrance } from '../items';
import type { Combatant } from '../types';

describe('encumbranceFactor (ADE II ch.02 l.708) — facteur MULTIPLICATIF sur BF+BE', () => {
  it('0 excédent : sans capacité, facteur = 1 (aucun effet)', () => {
    expect(maxEncumbranceFactor([])).toBe(1);
    expect(maxEncumbranceFactor([{}])).toBe(1);
  });

  it('cas nominal : le facteur porté (×2) l’emporte', () => {
    expect(maxEncumbranceFactor([{ encumbranceFactor: 2 }])).toBe(2);
  });

  it('non cumulatif : le plus grand facteur l’emporte, jamais la somme', () => {
    expect(maxEncumbranceFactor([{ encumbranceFactor: 2 }, { encumbranceFactor: 2 }])).toBe(2);
  });

  it("maxEncumbrance compose le facteur AVANT l'ajout additif de Costaud (LDB 10) : sans capacité, la formule est INCHANGÉE", () => {
    const c = { characteristics: { force: 35, endurance: 42 }, talents: [] } as unknown as Combatant;
    expect(maxEncumbrance(c)).toBe(3 + 4); // (BF+BE) × 1 + 0 — parité avec le comportement pré-#513
  });
});
