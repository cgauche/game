import { describe, it, expect } from 'vitest';
import { parsePsychTraits, peurTerreurFromSize, resolvePeurTest, resolveTerreurTest } from './psychology';
import { makeRNG } from './dice';

describe('Psychologie (pur)', () => {
  it('parsePsychTraits : « Peur N » / « Terreur N » / Immunité', () => {
    expect(parsePsychTraits(['Peur 4', 'Arme +7'])).toEqual({ causesPeur: 4 });
    expect(parsePsychTraits(['Terreur 3'])).toEqual({ causesTerreur: 3 });
    expect(parsePsychTraits(['Immunité (Psychologie)'])).toEqual({ psychImmune: true });
    expect(parsePsychTraits(['Arme +7'])).toEqual({});
  });
  it('peurTerreurFromSize : écart ≥1 → Peur ; ≥2 → Terreur (Indice = écart)', () => {
    expect(peurTerreurFromSize('grande', 'moyenne')).toEqual({ kind: 'peur', indice: 1 });
    expect(peurTerreurFromSize('enorme', 'moyenne')).toEqual({ kind: 'terreur', indice: 2 });
    expect(peurTerreurFromSize('moyenne', 'moyenne')).toBeNull();
    expect(peurTerreurFromSize('petite', 'grande')).toBeNull(); // plus petit ne fait pas peur
  });
  it('resolvePeurTest : cumule le DR jusqu’à l’Indice (vaincue)', () => {
    const r = resolvePeurTest(80, 2, 0, makeRNG(2));
    expect(r.dr).toBeGreaterThanOrEqual(0);
    expect(typeof r.calmeDR).toBe('number');
    expect(r.calmeDR >= 2).toBe(r.vaincue); // vaincue ⟺ DR cumulé ≥ Indice
  });
  it('resolveTerreurTest : échec → Brisé = Indice + |DR négatifs| ; devient Peur', () => {
    const r = resolveTerreurTest(1, 3, makeRNG(2)); // FM 1 → échec quasi sûr
    if (!r.success) expect(r.brise).toBeGreaterThanOrEqual(3);
    expect(r.devientPeur).toBe(3);
  });
});
