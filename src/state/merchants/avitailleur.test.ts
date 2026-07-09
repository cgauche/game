/**
 * #220 — Avitailleur (chandlerie navale) : archétype au registre + stock garanti (`curated`)
 * contenant l'eau douce et les pièces détachées de navire indispensables au réassort en mer.
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from '../../engine/dice';
import { rollStock, type CatalogItem } from '../../engine/disponibilite';
import { trappings } from '../../data';
import { MERCHANTS } from './index';

describe('#220 — archétype avitailleur (registre)', () => {
  it('est chargé au registre avec son étiquette et sa catégorie', () => {
    expect(MERCHANTS.avitailleur).toMatchObject({ label: 'Avitailleur', settlement: 'ville', resaleRate: 0.5, bargainSkill: 40 });
    expect(MERCHANTS.avitailleur.category.subTypes).toEqual(
      expect.arrayContaining(['nourriture-boisson-et-hebergement', 'possessions-diverses', 'munition-de-siege']),
    );
  });

  it('le curated est exhaustif : eau douce + pièces de navire + munitions navales + rations de mer', () => {
    expect(MERCHANTS.avitailleur.curated).toEqual(
      expect.arrayContaining([
        'tonneau-d-eau-douce',
        'pieces-detachees-de-navire',
        'boulet-et-poudre',
        'mitraille-et-poudre',
        'ration-biscuits-de-mer',
        'ration-nourriture-preservee',
        'ration-soupe-chou-fermente',
      ]),
    );
  });

  it('le stock tiré (rollStock, RNG seedé) garantit l\'eau douce et les pièces détachées de navire', () => {
    const arch = MERCHANTS.avitailleur;
    const cat: CatalogItem[] = trappings
      .filter((t) => !arch.category.types && t.subType != null && arch.category.subTypes!.includes(t.subType))
      .map((t) => ({ id: t.id, label: t.label, availability: (t.availability as CatalogItem['availability']) ?? null }));
    // seeds multiples : le curated doit ressortir quelle que soit l'issue du Test de Disponibilité du reste du stock
    for (const seed of [1, 2, 3, 42]) {
      const stock = rollStock(cat, 'ville', makeRNG(seed), arch.curated);
      const ids = stock.map((l) => l.id);
      expect(ids).toContain('tonneau-d-eau-douce');
      expect(ids).toContain('pieces-detachees-de-navire');
      expect(ids).toContain('boulet-et-poudre');
      expect(ids).toContain('mitraille-et-poudre');
    }
  });
});
