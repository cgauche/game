import { describe, it, expect } from 'vitest';
import { rollArtillerySalveMisfire } from './artilleryMisfire';
import { makeRNG } from './dice';
import { ARTILLERY_MISFIRE } from '../data/artilleryMisfire';

/**
 * Incident de Tir d'Artillerie par Salve — résolveur PUR (AA 10 l.270-277). Déterministe via
 * `forcedRoll` (le d10 imposé), même patron que `structureCritical.test.ts`.
 */
describe('rollArtillerySalveMisfire (AA 10 l.270-277)', () => {
  it('1-4 : Bras principal, 1 hit, pièce détruite', () => {
    const r = rollArtillerySalveMisfire(5, makeRNG(1), 2);
    expect(r.id).toBe('bras-principal');
    expect(r.entry.location).toBe('brasPrincipal');
    expect(r.hits).toBe(1);
    expect(r.destroyed).toBe(true);
  });

  it('5-7 : Localisation aléatoire, 1 hit, pièce détruite', () => {
    const r = rollArtillerySalveMisfire(5, makeRNG(1), 6);
    expect(r.id).toBe('localisation-aleatoire');
    expect(r.entry.location).toBe('random');
    expect(r.hits).toBe(1);
    expect(r.destroyed).toBe(true);
  });

  it('8-9 : « Pour chaque Indice de Salve restant » → hits = salveRemaining, pièce détruite', () => {
    const r = rollArtillerySalveMisfire(3, makeRNG(1), 9);
    expect(r.id).toBe('rafale-par-indice');
    expect(r.hits).toBe(3);
    expect(r.destroyed).toBe(true);
  });

  it('8-9 avec 0 Indice de Salve restant → 0 hit (pas de servant touché), toujours détruite', () => {
    const r = rollArtillerySalveMisfire(0, makeRNG(1), 8);
    expect(r.hits).toBe(0);
    expect(r.destroyed).toBe(true);
  });

  it('10 : Tir perdu — 0 hit direct à l’équipe, pièce NON détruite', () => {
    const r = rollArtillerySalveMisfire(4, makeRNG(1), 10);
    expect(r.id).toBe('tir-perdu');
    expect(r.entry.strayFire).toBe(true);
    expect(r.hits).toBe(0);
    expect(r.destroyed).toBe(false);
    expect(r.note).toContain('Esquive Très Difficile');
  });

  it('table contiguë 1..10, chaque entrée nommée + id + note', () => {
    const e = [...ARTILLERY_MISFIRE].sort((a, b) => a.min - b.min);
    expect(e[0].min).toBe(1);
    expect(e[e.length - 1].max).toBe(10);
    for (let i = 1; i < e.length; i++) expect(e[i].min).toBe(e[i - 1].max + 1);
    for (const x of e) expect(x.id && x.label && x.note).toBeTruthy();
  });

  it('le d10 par défaut (sans forcedRoll) reste dans la table et renvoie une entrée valide', () => {
    const r = rollArtillerySalveMisfire(2, makeRNG(9));
    expect(r.roll).toBeGreaterThanOrEqual(1);
    expect(r.roll).toBeLessThanOrEqual(10);
    expect(ARTILLERY_MISFIRE.some((e) => e.id === r.id)).toBe(true);
  });
});
