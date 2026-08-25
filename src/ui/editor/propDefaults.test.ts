import { describe, it, expect } from 'vitest';
import { propRefPatch } from './propDefaults';
import { EMPTY_FLOW } from '../../state/flow';
import { propDeclaredFoot } from '../../state/footprint';

describe('propRefPatch — auto-suggestion interact à la pose', () => {
  it('décor searchable sans interact → pré-arme interact{flow vide}', () => {
    const p = propRefPatch('coffre', false);
    expect(p.ref).toBe('coffre');
    expect(p.interact).toEqual({ flow: EMPTY_FLOW });
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

describe('propRefPatch — l’empreinte n’est PAS une propriété d’instance', () => {
  it('gros décor (tribune 3×1) → aucune empreinte posée sur l’entité : elle vient du catalogue', () => {
    expect(propRefPatch('tribune', false)).toEqual({ ref: 'tribune' });
    expect(propDeclaredFoot('tribune')).toEqual({ w: 3, h: 1 });
  });
  it('décor 1×1 (tonneau) → seulement la ref, et aucune empreinte au catalogue', () => {
    expect(propRefPatch('tonneau', false)).toEqual({ ref: 'tonneau' });
    expect(propDeclaredFoot('tonneau')).toBeUndefined();
  });
});
