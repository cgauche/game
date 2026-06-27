/**
 * #40 — Armes de base d'Aux Armes (AA) absentes de la base : Cimeterre, Dague ballock, Massue,
 * Pique d'armes. Stats VERBATIM du « TABLEAU DES ARMES DE BASE » (folio imprimé 91). Sabre et
 * Gantelets existaient déjà. Griffes de Tigre : PAS dans AA/ZI (le ticket mal-sourçait) — en réalité
 * dans NADJ « Le mariage de Nastassia » (folio 67) ; ajoutée comme arme de Bagarre au profil de Dague.
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

  it('Griffes de Tigre : présente, source NADJ folio 67 (pas AA), arme de Bagarre au profil de Dague', () => {
    const t = findTrappingById('griffe-de-tigre');
    expect(t, 'griffe-de-tigre doit exister (NADJ)').toBeTruthy();
    expect(t!.type).toBe('melee');
    expect(t!.subType).toBe('bagarre'); // « utilisation se base sur Corps à corps (Bagarre) »
    expect(t!.damage).toEqual({ plusBF: true, flat: 2 }); // « mêmes caractéristiques qu'une Dague »
    expect(t!.source).toEqual({ book: 'NADJ', page: 67 });
  });
});
