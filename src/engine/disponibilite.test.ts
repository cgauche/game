import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { rollAvailability, rollStock, DISPO_PCT, type CatalogItem } from './disponibilite';

describe('disponibilite — Disponibilité RAW (LDB 59 p.292)', () => {
  it('table RAW : Limitée 30/60/90, Rare 15/30/45', () => {
    expect(DISPO_PCT.Limitée).toEqual({ village: 30, ville: 60, cite: 90 });
    expect(DISPO_PCT.Rare).toEqual({ village: 15, ville: 30, cite: 45 });
  });
  it('Commune → toujours en stock (sans Test)', () => {
    const r = rollAvailability('Commune', 'village', makeRNG(1));
    expect(r.inStock).toBe(true);
    expect(r.test).toBeUndefined();
    expect(r.qty).toBe(2); // base 1 × 2 (Commune)
  });
  it('Exotique → jamais en stock', () => {
    expect(rollAvailability('Exotique', 'cite', makeRNG(1)).inStock).toBe(false);
  });
  it('Limitée à la Ville : un seed réussit, un autre échoue ; Test exposé', () => {
    let win = -1, lose = -1;
    for (let s = 1; s < 50 && (win < 0 || lose < 0); s++) {
      const r = rollAvailability('Limitée', 'ville', makeRNG(s));
      if (r.inStock && win < 0) win = s;
      if (!r.inStock && lose < 0) lose = s;
    }
    expect(win).toBeGreaterThan(0);
    expect(lose).toBeGreaterThan(0);
    const r = rollAvailability('Limitée', 'ville', makeRNG(win));
    expect(r.test).toMatchObject({ target: 60 });
    expect(r.qty).toBeGreaterThanOrEqual(1); // Ville 1d10, Limitée = base
  });
  it('Rare en stock : quantité = ceil(base/2) (÷2 arrondi sup.)', () => {
    let s = 1;
    while (!rollAvailability('Rare', 'village', makeRNG(s)).inStock && s < 200) s++;
    expect(rollAvailability('Rare', 'village', makeRNG(s)).qty).toBe(1);
  });
  it('rollStock : déterministe (même seed → même stock), filtre Exotique, curaté forcé', () => {
    const cat: CatalogItem[] = [
      { id: 'epee', label: 'Épée', availability: 'Commune' },
      { id: 'arquebuse', label: 'Arquebuse', availability: 'Rare' },
      { id: 'clavecin', label: 'Clavecin', availability: 'Exotique' },
    ];
    const a = rollStock(cat, 'ville', makeRNG(7));
    const b = rollStock(cat, 'ville', makeRNG(7));
    expect(a).toEqual(b); // déterministe
    expect(a.find((l) => l.label === 'Épée')!.qty).toBeGreaterThan(0); // Commune toujours
    expect(a.find((l) => l.label === 'Clavecin')).toBeUndefined(); // Exotique exclu
    const withCurated = rollStock(cat, 'ville', makeRNG(7), ['Clavecin']);
    expect(withCurated.find((l) => l.label === 'Clavecin')!.qty).toBeGreaterThan(0); // curaté forcé
  });
});
