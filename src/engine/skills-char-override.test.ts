import { describe, it, expect, afterEach } from 'vitest';
import { testValue } from './skills';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';

/** Combattant nu : seules les caractéristiques comptent (pas d'avances, états, passifs). */
const c = () =>
  ({
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 35, intelligence: 50, 'force-mentale': 60, sociabilite: 30 },
    skills: [], conditions: [], items: [], activeEffects: [], liveTraits: [],
  }) as unknown as Combatant;

describe('testValue — Métier (Savoir) : Int au lieu de Dex (LDB 09 l.352, règle optionnelle)', () => {
  afterEach(() => resetRule('test-metier-int'));
  it('défaut : Métier utilise la Dextérité', () => {
    expect(testValue(c(), 'metier')).toBe(35);
  });
  it('règle ON : Métier utilise l’Intelligence', () => {
    setRule('test-metier-int', true);
    expect(testValue(c(), 'metier')).toBe(50);
  });
  it('règle ON : n’affecte PAS les autres compétences (Intimidation reste Force)', () => {
    setRule('test-metier-int', true);
    expect(testValue(c(), 'intimidation')).toBe(30);
  });
});

describe('testValue — Intimidation : caractéristique alternative (LDB 09 l.266, règle optionnelle)', () => {
  afterEach(() => resetRule('test-intimidation-char'));
  it('défaut F : Intimidation utilise la Force', () => {
    expect(testValue(c(), 'intimidation')).toBe(30);
  });
  it('FM : Force Mentale', () => {
    setRule('test-intimidation-char', 'force-mentale');
    expect(testValue(c(), 'intimidation')).toBe(60);
  });
  it('Int : Intelligence', () => {
    setRule('test-intimidation-char', 'intelligence');
    expect(testValue(c(), 'intimidation')).toBe(50);
  });
  it('max : la meilleure des trois (F/FM/Int) → FM ici', () => {
    setRule('test-intimidation-char', 'max');
    expect(testValue(c(), 'intimidation')).toBe(60);
  });
});
