/**
 * Garde-fou : le blaireau-monture du Moot existe au bestiaire (dotation `chevaucheur-de-blaireau`,
 * ADE I p.88 ; profil PNJ complet ADE III (VO) chap. « Animal Familiars », Badger).
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

  it('porte le profil chiffré ADE III (VO, l.52-58)', () => {
    const c = findCreatureById('blaireau')!;
    expect(c.char).toMatchObject({
      M: 4,
      'capacite-de-combat': 35,
      'capacite-de-tir': null,
      force: 15,
      endurance: 25,
      initiative: 35,
      agilite: 30,
      dexterite: null,
      intelligence: 15,
      'force-mentale': 15,
      sociabilite: 15,
      B: 5,
    });
  });

  it('porte Arme+4 et Armure 1 (ADE III, pas Arme+6 sans armure du clone Poney)', () => {
    const c = findCreatureById('blaireau')!;
    const arme = c.traits.find((t) => t.id === 'arme');
    const armure = c.traits.find((t) => t.id === 'armure');
    expect(arme?.value).toBe(4);
    expect(armure?.value).toBe(1);
  });

  it("n'a pas le trait Foulée (absent du profil badger ADE III)", () => {
    const c = findCreatureById('blaireau')!;
    expect(c.traits.some((t) => t.id === 'foulee')).toBe(false);
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
