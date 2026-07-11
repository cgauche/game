/**
 * Prix de la nuit de repos (`restFlow.restCost`, LDB ch.66 p.304) VS le catalogue `trappings.json`
 * (`chambre-commune-nuit`/`chambre-privee-nuit`/`repas-auberge`, tarifs de SERVICE — cf.
 * `src/state/merchants/service-trappings.test.ts`). `restCost` porte ses propres constantes
 * (`PRICE_BRASS`, restFlow.ts:618) plutôt que de résoudre ces id — divergence de SOURCE signalée
 * (hors périmètre : restFlow.ts n'est pas touché), ce test verrouille l'ÉGALITÉ numérique actuelle
 * pour qu'une dérive future (prix RAW changé d'un côté, oublié de l'autre) casse la CI.
 */
import { describe, it, expect } from 'vitest';
import { restCost, type PendingRest } from './restFlow';
import { findTrappingById } from '../data';
import { toBrass, priceToMoney } from '../engine/money';
import type { Combatant } from '../engine/types';

const hero = (id: string): Combatant => ({ id, name: id, items: [], wounds: { current: 10, max: 10 }, conditions: [] } as unknown as Combatant);

const basePending = (perHero: PendingRest['perHero']): PendingRest =>
  ({ places: { auberge: true }, quality: 'normale', days: 1, perHero, phase: 'setup' }) as PendingRest;

describe('restCost (restFlow) résout les MÊMES prix que le catalogue trappings (LDB ch.66 p.302/304)', () => {
  it('chambre commune/nuit : restCost == price du trapping "chambre-commune-nuit"', () => {
    const h = hero('a');
    const cost = restCost(basePending({ a: { lodging: 'commune', food: 'rien' } }), [h]);
    expect(toBrass(cost)).toBe(toBrass(priceToMoney(findTrappingById('chambre-commune-nuit')!.price)));
  });

  it('chambre privée/nuit (2 convives) : restCost == price du trapping "chambre-privee-nuit"', () => {
    const a = hero('a'); const b = hero('b');
    const cost = restCost(basePending({ a: { lodging: 'privee', food: 'rien' }, b: { lodging: 'privee', food: 'rien' } }), [a, b]);
    expect(toBrass(cost)).toBe(toBrass(priceToMoney(findTrappingById('chambre-privee-nuit')!.price)));
  });

  it('repas, auberge : restCost == price du trapping "repas-auberge"', () => {
    const h = hero('a');
    const cost = restCost(basePending({ a: { lodging: 'dehors', food: 'repas' } }), [h]);
    expect(toBrass(cost)).toBe(toBrass(priceToMoney(findTrappingById('repas-auberge')!.price)));
  });
});
