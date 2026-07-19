/**
 * Garde-fou T0-b (#611) : les créatures MONTURES ajoutées au bestiaire (EDOC 07) portent une
 * facette d'ACHAT valide et des traits/optionnels tous résolvables — zéro id fantôme.
 */
import { describe, it, expect } from 'vitest';
import { creatures, findTraitById, findCreatureById } from './index';

const MOUNT_IDS = [
  'cheval-de-trait',
  'cheval-de-trait-lourd',
  'boeuf',
  'cheval-de-monte',
  'cheval-de-guerre-leger',
  'destrier-cheval-de-guerre-lourd',
  'mule',
  'ane',
  'poney',
] as const;

describe('creatures montures (T0-b, #611)', () => {
  it('les 9 créatures montures existent dans le bestiaire', () => {
    for (const id of MOUNT_IDS) {
      expect(findCreatureById(id), `créature manquante : ${id}`).toBeDefined();
    }
  });

  it('chacune porte une facette purchase avec un prix non nul', () => {
    for (const id of MOUNT_IDS) {
      const c = findCreatureById(id)!;
      expect(c.purchase, `purchase manquant sur ${id}`).toBeDefined();
      const { price } = c.purchase!;
      const total = price.gold + price.silver + price.bronze;
      expect(total, `prix nul sur ${id}`).toBeGreaterThan(0);
    }
  });

  it('traits et optionnels résolvent tous à des ids réels de traits.json', () => {
    for (const id of MOUNT_IDS) {
      const c = findCreatureById(id)!;
      for (const t of c.traits) {
        expect(findTraitById(t.id), `trait fantôme "${t.id}" sur ${id}`).toBeDefined();
      }
      for (const o of c.optionals) {
        if ('id' in o) {
          expect(findTraitById(o.id), `optionnel fantôme "${o.id}" sur ${id}`).toBeDefined();
        }
      }
    }
  });

  it('aucun doublon d\'id parmi les créatures du bestiaire', () => {
    const ids = creatures.map((c) => c.id);
    const dups = [...new Set(ids.filter((i, idx) => ids.indexOf(i) !== idx))];
    expect(dups).toEqual([]);
  });
});
