import { describe, it, expect } from 'vitest';
import { ruleOfEightSeverity, sorceryMandatoryMiscast } from './magic';
import { domainEnvironmentBonus, isSorceryDomain } from './domainAttributes';

describe('Règle du 8 — Influences malfaisantes (LDB 46 l.89)', () => {
  it('dé des unités = 8 près d’une Corruption → Imparfaite Mineure', () => {
    expect(ruleOfEightSeverity(8, true, false)).toBe('mineure');
    expect(ruleOfEightSeverity(18, true, false)).toBe('mineure');
    expect(ruleOfEightSeverity(98, true, false)).toBe('mineure');
  });
  it('escalade en Majeure si une Mineure a déjà été obtenue au Test (« 88 »)', () => {
    expect(ruleOfEightSeverity(88, true, true)).toBe('majeure');
  });
  it('rien si pas de Corruption à proximité, ou dé des unités ≠ 8', () => {
    expect(ruleOfEightSeverity(8, false, false)).toBeNull(); // pas de Corruption
    expect(ruleOfEightSeverity(7, true, false)).toBeNull(); // unités ≠ 8
    expect(ruleOfEightSeverity(80, true, false)).toBeNull(); // unités = 0
  });
});

describe('Sorcellerie — composant obligatoire (LDB 49)', () => {
  it('Sort de Sorcellerie sans composant → Imparfaite Mineure systématique', () => {
    expect(sorceryMandatoryMiscast(true, false)).toBe(true);
  });
  it('avec composant : pas de lancer systématique', () => {
    expect(sorceryMandatoryMiscast(true, true)).toBe(false);
  });
  it('hors Sorcellerie : jamais de lancer systématique', () => {
    expect(sorceryMandatoryMiscast(false, false)).toBe(false);
  });
});

describe('Attributs de Domaine data-driven (LDB 48/49)', () => {
  it('Vie/Ghyran : +10 en environnement rural ou sauvage (LDB 48 l.690)', () => {
    expect(domainEnvironmentBonus({ domainId: 'vie' }, 'rural')).toBe(10);
    expect(domainEnvironmentBonus({ domainId: 'vie' }, 'sauvage')).toBe(10);
    expect(domainEnvironmentBonus({ domainId: 'vie' }, 'urbain')).toBe(0);
    expect(domainEnvironmentBonus({ domainId: 'vie' }, undefined)).toBe(0);
  });
  it('un Domaine sans attribut d’environnement → 0', () => {
    expect(domainEnvironmentBonus({ domainId: 'feu' }, 'rural')).toBe(0);
    expect(domainEnvironmentBonus({ domainId: null }, 'rural')).toBe(0);
  });
  it('Sorcellerie : marqueur DONNÉE reconnu (LDB 49)', () => {
    expect(isSorceryDomain({ domainId: 'sorcellerie' })).toBe(true);
    expect(isSorceryDomain({ domainId: 'feu' })).toBe(false);
    expect(isSorceryDomain({ domainId: null })).toBe(false);
  });
});
