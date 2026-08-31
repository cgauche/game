/**
 * Garde-fou T0-b (#611) : les créatures ACHETABLES du bestiaire (LDB 70, EDOC 07, ADE III) portent une
 * facette d'ACHAT valide et des traits/optionnels tous résolvables — zéro id fantôme.
 */
import { describe, it, expect } from 'vitest';
import { creatures, trappings, vehicles, findTraitById, findCreatureById } from './index';

const ACHAT_IDS = [
  'chien',
  'blaireau',
  'cheval-de-trait',
  'cheval-de-trait-lourd',
  'boeuf',
  'cheval-de-monte',
  'cheval-de-guerre-leger',
  'destrier-cheval-de-guerre-lourd',
  'mule',
  'ane',
  'poney',
  'mouton',
  'cochon',
] as const;

/** Détecteurs PURS : la garde et sa preuve par mutation portent sur la MÊME fonction. */
const porteursDePurchase = (liste: typeof creatures) =>
  liste.filter((c) => c.purchase).map((c) => c.id).sort();
const idsCaptes = (ids: readonly string[], pris: readonly string[]) =>
  ids.filter((id) => new Set(pris).has(id));

const ATTENDU = [...ACHAT_IDS].sort();

describe('creatures achetables (T0-b, #611)', () => {
  it('les créatures achetables existent dans le bestiaire', () => {
    for (const id of ACHAT_IDS) {
      expect(findCreatureById(id), `créature manquante : ${id}`).toBeDefined();
    }
  });

  it('la liste est EXHAUSTIVE : aucune autre créature ne porte purchase', () => {
    expect(porteursDePurchase(creatures)).toEqual(ATTENDU);
  });

  it('la garde d\'exhaustivité MORD sur un porteur en trop ou en moins', () => {
    const enTrop = structuredClone(creatures);
    enTrop.find((c) => c.id === 'poulet')!.purchase = {
      price: { gold: 0, silver: 0, bronze: 5 },
      availability: 'Commune',
    };
    expect(porteursDePurchase(enTrop)).not.toEqual(ATTENDU);

    const enMoins = structuredClone(creatures);
    delete enMoins.find((c) => c.id === 'cochon')!.purchase;
    expect(porteursDePurchase(enMoins)).not.toEqual(ATTENDU);
  });

  it('aucune ne partage son id avec un trapping ou un véhicule', () => {
    // `catalogEntryOf` (state/merchantFlow) résout un id trapping AVANT la créature, et le stock
    // jette toute ligne d'unité sans `unit` : un id partagé rend la facette purchase de la
    // créature illisible par le marché.
    expect(idsCaptes(ACHAT_IDS, [...trappings.map((t) => t.id), ...vehicles.map((v) => v.id)])).toEqual([]);
  });

  it('la garde de collision d\'id MORD sur un id capté par le catalogue d\'objets', () => {
    const pris = [...trappings.map((t) => t.id), ...vehicles.map((v) => v.id), 'cochon'];
    expect(idsCaptes(ACHAT_IDS, pris)).toEqual(['cochon']);
  });

  it('chacune porte une facette purchase avec un prix non nul', () => {
    for (const id of ACHAT_IDS) {
      const c = findCreatureById(id)!;
      expect(c.purchase, `purchase manquant sur ${id}`).toBeDefined();
      const { price } = c.purchase!;
      const total = price.gold + price.silver + price.bronze;
      expect(total, `prix nul sur ${id}`).toBeGreaterThan(0);
    }
  });

  it('traits et optionnels résolvent tous à des ids réels de traits.json', () => {
    for (const id of ACHAT_IDS) {
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
