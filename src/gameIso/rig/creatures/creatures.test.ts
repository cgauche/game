import { describe, it, expect } from 'vitest';
import {
  CREATURES, QUAD_SPECIES, WINGED_SPECIES,
  quadSpeciesMatch, wingSpeciesMatch, quadSpeciesNames, wingedSpeciesNames,
} from './index';

describe('registre de créatures (auto-collecté depuis defs/)', () => {
  it('CREATURES non vide + chaque entrée bien formée', () => {
    expect(CREATURES.length).toBeGreaterThanOrEqual(10);
    for (const c of CREATURES) {
      expect(c.name, 'name').toBeTruthy();
      expect(['biped', 'quadruped', 'winged', 'monolithic']).toContain(c.plan);
      if (c.plan === 'quadruped' || c.plan === 'winged') expect(c.quad, `${c.name}.quad`).toBeTruthy();
    }
  });

  it('tables dérivées cohérentes avec les defs (zéro tableau central)', () => {
    expect(quadSpeciesNames().length).toBe(Object.keys(QUAD_SPECIES).length);
    expect(wingedSpeciesNames().length).toBe(Object.keys(WINGED_SPECIES).length);
    expect(QUAD_SPECIES['Cheval']).toBeTruthy();
    expect(QUAD_SPECIES['Rat géant']).toBeTruthy(); // l'accent du `name` est préservé
    expect(WINGED_SPECIES['Dragon']?.wings).toBe('membrane');
  });

  it('routage par clé/alias à limite de mot', () => {
    expect(quadSpeciesMatch('Destrier de guerre')).toBe('Cheval');
    expect(quadSpeciesMatch('Loup funeste')).toBe('Loup');
    expect(quadSpeciesMatch('Rat ogre')).toBeUndefined(); // « rat » seul ≠ Rat géant (= skaven)
    expect(wingSpeciesMatch('Hyppogriffe')).toBe('Hippogriffe'); // orthographe LDB
    expect(wingSpeciesMatch('Vouivre nauséabonde')).toBe('Dragon');
    expect(wingSpeciesMatch('Hippogriffe')).not.toBe('Griffon'); // pas de capture sous-chaîne « griff »
  });
});
