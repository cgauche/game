/**
 * Garde-fou : le blaireau-monture du Moot existe au bestiaire (dotation `chevaucheur-de-blaireau`,
 * ADE I p.88 ; profil dérivé du Poney EDOC p.24 + traits d'espèce ADE III p.[Animal Familiars] Blaireau).
 */
import { describe, it, expect } from 'vitest';
import { findCreatureById, findTraitById } from './index';

describe('créature blaireau (bête du Moot montable)', () => {
  it('existe au bestiaire', () => {
    expect(findCreatureById('blaireau')).toBeDefined();
  });

  it('est de Taille Moyenne (montable)', () => {
    const c = findCreatureById('blaireau')!;
    const taille = c.traits.find((t) => t.id === 'taille');
    expect(taille?.arg).toBe('moyenne');
  });

  it('porte une facette purchase (dotation/achat)', () => {
    const c = findCreatureById('blaireau')!;
    expect(c.purchase).toBeDefined();
    const total = c.purchase!.price.gold + c.purchase!.price.silver + c.purchase!.price.bronze;
    expect(total).toBeGreaterThan(0);
  });

  it('ses traits résolvent tous à des ids réels de traits.json', () => {
    const c = findCreatureById('blaireau')!;
    for (const t of c.traits) {
      expect(findTraitById(t.id), `trait fantôme "${t.id}"`).toBeDefined();
    }
  });
});
