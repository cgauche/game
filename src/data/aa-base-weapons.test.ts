/**
 * #40 — Armes de base d'Aux Armes (AA) absentes de la base : Cimeterre, Dague ballock, Massue,
 * Pique d'armes. Stats VERBATIM du « TABLEAU DES ARMES DE BASE » (folio imprimé 91). Sabre et
 * Gantelets existaient déjà. Griffes de Tigre : ABSENTE volontairement (aucun RAW autorisé — ni AA ni ZI).
 */
import { describe, it, expect } from 'vitest';
import { findTrappingById, findQualityById } from './index';

const CASES = [
  { id: 'cimeterre', label: 'Cimeterre', enc: 1, availability: 'Limitée', reach: 'Courte', flat: 4, price: { gold: 1, silver: 0, bronze: 0 }, qualities: [{ id: 'taillade', spec: '1A' }] },
  { id: 'dague-ballock', label: 'Dague ballock', enc: 0, availability: 'Limitée', reach: 'Très courte', flat: 1, price: { gold: 0, silver: 16, bronze: 0 }, qualities: [{ id: 'empaleuse' }, { id: 'perforante' }, { id: 'precise' }] },
  { id: 'massue', label: 'Massue', enc: 1, availability: 'Commune', reach: 'Moyenne', flat: 4, price: { gold: 0, silver: 4, bronze: 0 }, qualities: [{ id: 'desequilibree' }, { id: 'inoffensive' }] },
  { id: 'pique-d-armes', label: "Pique d'armes", enc: 1, availability: 'Limitée', reach: 'Moyenne', flat: 4, price: { gold: 0, silver: 15, bronze: 0 }, qualities: [{ id: 'desequilibree' }, { id: 'perforante' }] },
] as const;

describe("#40 — Armes de base AA (Aux Armes, folio 91)", () => {
  for (const c of CASES) {
    it(`${c.label} : présente, stats verbatim, source AA folio 91`, () => {
      const t = findTrappingById(c.id);
      expect(t, `trapping ${c.id} doit exister`).toBeTruthy();
      expect(t!.label).toBe(c.label);
      expect(t!.type).toBe('melee');
      expect(t!.subType).toBe('base'); // « TABLEAU DES ARMES DE BASE » → groupe d'arme Base
      expect(t!.enc).toBe(c.enc);
      expect(t!.availability).toBe(c.availability);
      expect(t!.reach).toBe(c.reach);
      expect(t!.damage).toEqual({ plusBF: true, flat: c.flat });
      expect(t!.qualities).toEqual(c.qualities);
      expect(t!.price).toEqual(c.price);
      expect(t!.source).toEqual({ book: 'AA', page: 91 });
      expect(typeof t!.desc).toBe('string'); // paragraphe de saveur verbatim présent
    });
    it(`${c.label} : toutes ses Atouts/Défauts résolvent dans qualities.json`, () => {
      for (const q of c.qualities) expect(findQualityById(q.id), `qualité ${q.id}`).toBeTruthy();
    });
  }

  it('Griffes de Tigre : ABSENTE (aucun RAW autorisé — ni AA ni ZI)', () => {
    expect(findTrappingById('griffes-de-tigre')).toBeUndefined();
    expect(findTrappingById('griffe-de-tigre')).toBeUndefined();
  });
});
