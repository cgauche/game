import { describe, it, expect } from 'vitest';
import { rangedDefenseModes, bestRangedDefense, resolveRanged } from './combat';
import { makeRNG } from './dice';
import type { Combatant, Weapon } from './types';

// Portée 20 m → Bout Portant si dist×2 ≤ 20/10 = 2, donc à ≤ 1 tuile (combat.ts rangeBandName).
const bow = (): Weapon => ({ name: 'Arc', type: 'ranged', damage: '+0', range: 20, qualities: [] } as unknown as Weapon);
const shield = (indice: number): Weapon =>
  ({ name: 'Bouclier', type: 'melee', damage: '+BF', qualities: [`Protectrice ${indice}`] } as unknown as Weapon);

const atk = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 'a', name: 'Tireur', kind: 'hero', conditions: [], engagedWith: [], weapons: [], ...over } as unknown as Combatant);
const def = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 'd', name: 'Cible', kind: 'enemy', conditions: [], engagedWith: [], weapons: [], ...over } as unknown as Combatant);

describe('rangedDefenseModes — RAW défense contre les attaques à distance', () => {
  const w = bow();

  it('défaut : AUCUNE défense contre un tir (LDB 13 l.135)', () => {
    expect(rangedDefenseModes(atk(), def(), w, 5, true)).toEqual([]);
  });

  it('bouclier Protectrice 2+ en Ligne de Vue → Parade (LDB 62 l.307)', () => {
    expect(rangedDefenseModes(atk(), def({ weapons: [shield(2)] }), w, 5, true)).toEqual(['parade']);
  });

  it('Protectrice 1 ne suffit pas (Indice < 2)', () => {
    expect(rangedDefenseModes(atk(), def({ weapons: [shield(1)] }), w, 5, true)).toEqual([]);
  });

  it('Protectrice 2+ HORS Ligne de Vue → aucune parade', () => {
    expect(rangedDefenseModes(atk(), def({ weapons: [shield(2)] }), w, 5, false)).toEqual([]);
  });

  it('Bout Portant → Esquive (LDB 14 l.62)', () => {
    expect(rangedDefenseModes(atk(), def(), w, 1, true)).toEqual(['esquive']);
  });

  it('tireur Engagé → Parade « n’importe quelle Corps à corps » (LDB 14 l.70)', () => {
    expect(rangedDefenseModes(atk({ engagedWith: ['d'] }), def(), w, 5, true)).toEqual(['parade']);
  });

  it('Bout Portant + bouclier Protectrice 2+ → Parade ET Esquive (le défenseur choisit)', () => {
    expect(rangedDefenseModes(atk(), def({ weapons: [shield(2)] }), w, 1, true).sort()).toEqual(['esquive', 'parade']);
  });

  it('cible qui ne peut pas se défendre (Surpris) → aucun mode', () => {
    expect(rangedDefenseModes(atk({ engagedWith: ['d'] }), def({ conditions: [{ name: 'surpris' }] as never }), w, 1, true)).toEqual([]);
  });
});

describe('bestRangedDefense — meilleure défense AUTO contre un tir', () => {
  const w = bow();
  it('aucune exception → undefined (tir non opposé)', () => {
    expect(bestRangedDefense(atk(), def(), w, 5, true)).toBeUndefined();
  });
  it('Bout Portant → esquive', () => {
    expect(bestRangedDefense(atk(), def(), w, 1, true)?.mode).toBe('esquive');
  });
  it('bouclier Protectrice 2+ → parade avec le bouclier', () => {
    const r = bestRangedDefense(atk(), def({ weapons: [shield(2)] }), w, 5, true);
    expect(r?.mode).toBe('parade');
    expect(r?.parryWeapon?.qualities).toContain('Protectrice 2');
  });
});

describe('resolveRanged — tir DÉFENDU = Test OPPOSÉ (cœur combineOpposed partagé avec la mêlée)', () => {
  const chars = { CC: 35, CT: 55, F: 35, E: 35, I: 30, Ag: 45, Dex: 30, Int: 30, FM: 30, Soc: 30 };
  const base = (id: string, kind: 'hero' | 'enemy', over: Partial<Combatant> = {}): Combatant =>
    ({ id, name: id, kind, characteristics: chars, conditions: [], engagedWith: [], skills: [], talents: [],
       weapons: [], advantage: 0, size: 'moyenne', wounds: { current: 20, max: 20 },
       armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);
  const bw: Weapon = { name: 'Arc', type: 'ranged', damage: '+4', range: 60, qualities: [] } as unknown as Weapon;

  it('sans défense → résolution NON opposée (aucun defenderDetail)', () => {
    const r = resolveRanged(base('a', 'hero'), base('d', 'enemy'), bw, makeRNG(3), 10);
    expect(r.defenderDetail).toBeUndefined();
  });
  it('avec défense (esquive) → Test OPPOSÉ (defenderDetail présent)', () => {
    const r = resolveRanged(base('a', 'hero'), base('d', 'enemy'), bw, makeRNG(3), 10, undefined, [], { mode: 'esquive' });
    expect(r.defenderDetail).toBeDefined();
  });
});
