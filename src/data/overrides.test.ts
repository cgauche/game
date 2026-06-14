/**
 * Le seam `overrides` doit muter les datasets EN PLACE : un consommateur qui a importé le tableau de
 * la façade voit les changements sans réimport (identité de référence préservée). `resetData`
 * restaure le seed d'origine.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { etats } from './index';
import { setDataset, resetData, datasetArray } from './overrides';

const fakeEtat = { label: 'TEST', desc: 'x', source: { book: 'X', page: 1 } } as never;

describe('overrides — mutation en place de la façade', () => {
  afterEach(() => resetData());

  it('setDataset mute le MÊME tableau (les consommateurs voient le changement)', () => {
    const original = etats.length;
    expect(original).toBeGreaterThan(1);
    setDataset('etats', [fakeEtat]);
    expect(datasetArray('etats')).toBe(etats); // identité préservée (binding jamais réassigné)
    expect(etats.length).toBe(1);
    expect(etats[0].label).toBe('TEST');
  });

  it('resetData restaure le seed d’origine', () => {
    const n0 = etats.length;
    setDataset('etats', []);
    expect(etats.length).toBe(0);
    resetData();
    expect(etats.length).toBe(n0);
    expect(datasetArray('etats')).toBe(etats);
  });
});
