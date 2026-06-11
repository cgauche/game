import { describe, it, expect } from 'vitest';
import { propRefPatch } from './propDefaults';

describe('propRefPatch — auto-suggestion interact à la pose', () => {
  it('décor searchable sans interact → pré-arme interact{effects:[]}', () => {
    const p = propRefPatch('coffre', false);
    expect(p.ref).toBe('coffre');
    expect(p.interact).toEqual({ effects: [] });
  });
  it('décor searchable AVEC interact déjà posé → ne clobbe pas (pas de clé interact)', () => {
    const p = propRefPatch('coffre', true);
    expect(p).toEqual({ ref: 'coffre' });
    expect('interact' in p).toBe(false);
  });
  it('décor pur (non searchable) → seulement ref, aucun interact', () => {
    const p = propRefPatch('tonneau', false);
    expect(p).toEqual({ ref: 'tonneau' });
  });
});

describe('propRefPatch — empreinte par défaut du catalogue (foot)', () => {
  it('gros décor (tribune 3×1) → foot appliqué à la pose', () => {
    expect(propRefPatch('tribune', false).foot).toEqual({ w: 3, h: 1 });
  });
  it('décor 1×1 (tonneau) → foot REMIS à undefined (purge une empreinte héritée d’un autre ref)', () => {
    const p = propRefPatch('tonneau', false);
    expect('foot' in p).toBe(true);
    expect(p.foot).toBeUndefined();
  });
});
