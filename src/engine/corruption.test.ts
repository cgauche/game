/**
 * Corruption & mutations — moteur pur (LDB 19) : gains par exposition, seuil,
 * d100 corps/esprit par espèce, limites, lecture des effets de mutation.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { makeRNG } from './dice';
import {
  corruptionGain, corruptionThresholdExceeded, mutationKindFor, mutationLimitExceeded,
  attachMutation, mutationArmourBonus,
} from './corruption';
import { rollMutation } from '../data/mutations';
import { passiveSkillSum, passiveTestMod } from './trauma';
import { effectiveChar } from './characteristics';
import { testValue } from './skills';
import { effectiveMovement } from './encumbrance';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'Cobaye', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 42, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [],
    ...p,
  } as Combatant;
}

describe('corruptionGain (LDB 19 l.31/52/65)', () => {
  it('mineure : échec → 1 ; succès → 0', () => {
    expect(corruptionGain('mineure', false, -2)).toBe(1);
    expect(corruptionGain('mineure', true, 0)).toBe(0);
    expect(corruptionGain('mineure', true, 5)).toBe(0);
  });
  it('modérée : échec → 2 ; Succès Minime (0-1 DR) → 1 ; Succès (2+) → 0', () => {
    expect(corruptionGain('moderee', false, -1)).toBe(2);
    expect(corruptionGain('moderee', true, 0)).toBe(1);
    expect(corruptionGain('moderee', true, 1)).toBe(1);
    expect(corruptionGain('moderee', true, 2)).toBe(0);
  });
  it('majeure : échec → 3 ; 0-1 DR → 2 ; 2-3 DR → 1 ; Impressionnant (4+) → 0', () => {
    expect(corruptionGain('majeure', false, -3)).toBe(3);
    expect(corruptionGain('majeure', true, 1)).toBe(2);
    expect(corruptionGain('majeure', true, 3)).toBe(1);
    expect(corruptionGain('majeure', true, 4)).toBe(0);
  });
});

describe('seuil & limites (l.80/95)', () => {
  it('seuil : corruption > BFM + BE (35→3 + 42→4 = 7)', () => {
    expect(corruptionThresholdExceeded(hero({ corruption: 7 }))).toBe(false);
    expect(corruptionThresholdExceeded(hero({ corruption: 8 }))).toBe(true);
  });
  it('limites : physiques > BE ou mentales > BFM → damné', () => {
    const phys = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, label: `m${i}`, desc: '', kind: 'physique' as const, roll: 1 }));
    expect(mutationLimitExceeded(hero({ mutations: phys(4) }))).toBe(false); // BE 4
    expect(mutationLimitExceeded(hero({ mutations: phys(5) }))).toBe(true);
    const ment = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, label: `m${i}`, desc: '', kind: 'mentale' as const, roll: 1 }));
    expect(mutationLimitExceeded(hero({ mutations: ment(3) }))).toBe(false); // BFM 3
    expect(mutationLimitExceeded(hero({ mutations: ment(4) }))).toBe(true);
  });
});

describe('mutationKindFor — d100 corps/esprit par espèce (data-driven, ids STABLES, l.87-91)', () => {
  it('Humain (id) : corps 01-50, esprit 51-100 (LDB ch.19)', () => {
    expect(mutationKindFor('humains-reiklander', 50)).toBe('physique');
    expect(mutationKindFor('humains-reiklander', 51)).toBe('mentale');
  });
  it('Nain 01-05, Halfling 01-10, Elfe jamais physique (LDB ch.19)', () => {
    expect(mutationKindFor('nains', 5)).toBe('physique');
    expect(mutationKindFor('nains', 6)).toBe('mentale');
    expect(mutationKindFor('halflings', 10)).toBe('physique');
    expect(mutationKindFor('halflings', 11)).toBe('mentale');
    expect(mutationKindFor('hauts-elfes', 1)).toBe('mentale');
    expect(mutationKindFor('elfes-sylvains', 100)).toBe('mentale');
  });
  it('Ogre 01-10 (ADE2 « Ogres et Mutations ») — corrige le défaut Humain erroné', () => {
    expect(mutationKindFor('ogres', 10)).toBe('physique');
    expect(mutationKindFor('ogres', 11)).toBe('mentale');
  });
  it('Gnome = Humain 01-50 (NADJ « Gnomes et Corruption »)', () => {
    expect(mutationKindFor('gnomes', 50)).toBe('physique');
    expect(mutationKindFor('gnomes', 51)).toBe('mentale');
  });
  it('espèce inconnue/absente → défaut Humain (50)', () => {
    expect(mutationKindFor(undefined, 30)).toBe('physique');
    expect(mutationKindFor('inexistant', 51)).toBe('mentale');
  });
});

describe('effets de mutation lus à la volée', () => {
  it('charMods permanents → effectiveChar (base, cumulable avec un buff magique)', () => {
    const c = hero();
    attachMutation(c, { id: 'corpulent', label: 'Corpulent', desc: '', kind: 'physique', roll: 8, passive: [{ op: 'charMod', char: 'F', mod: 5 }, { op: 'charMod', char: 'E', mod: 5 }, { op: 'moveMod', mod: -1 }] });
    expect(effectiveChar(c, 'F')).toBe(35);
    c.activeEffects = [{ label: 'Puissance', char: 'F', bonus: 10, duration: { scale: 'rounds', left: 3 } }];
    expect(effectiveChar(c, 'F')).toBe(45); // base mutée 35 + buff 10 (pas d'écrasement)
    expect(effectiveChar(c, 'E')).toBe(c.characteristics.E + 5); // Corpulent E+5 via le collecteur (base + delta)
  });
  it('movement → effectiveMovement', () => {
    const c = hero();
    attachMutation(c, { id: 'court-sur-pattes', label: 'Court sur pattes', desc: '', kind: 'physique', roll: 73, passive: [{ op: 'moveMod', mod: -1 }] });
    expect(effectiveMovement(c)).toBe(3);
  });
  it('PA naturels apAll + apLocations', () => {
    const c = hero();
    attachMutation(c, { id: 'ecailles-epineuses', label: 'Écailles épineuses', desc: '', kind: 'physique', roll: 78, apAll: 1 });
    attachMutation(c, { id: 'cornes-asymetriques', label: 'Cornes asymétriques', desc: '', kind: 'physique', roll: 83, apLocations: { tete: 1 } });
    expect(mutationArmourBonus(c, 'tete')).toBe(2);
    expect(mutationArmourBonus(c, 'corps')).toBe(1);
  });
  it('mods de Tests : compétence nommée + Tests d\'une caractéristique (testValue)', () => {
    const c = hero({ skills: [{ skillId: 'pistage', advances: 5 } as never, { skillId: 'charme', advances: 0 } as never] });
    attachMutation(c, { id: 'groin-poilu', label: 'Groin poilu', desc: '', kind: 'physique', roll: 93, passive: [{ op: 'skillMod', skill: 'pistage', mod: 10 }] });
    attachMutation(c, { id: 'visage-inverse', label: 'Visage inversé', desc: '', kind: 'physique', roll: 53, passive: [{ op: 'testMod', amount: -20, char: 'Soc' }] });
    expect(passiveSkillSum(c, 'pistage')).toBe(10); // compétence nommée → collecteur passif (Σ, intrinsèque)
    expect(passiveTestMod(c, 'Soc')).toBe(-20); // Tests char-qualifiés (Visage inversé) → collecteur passif
    expect(testValue(c, 'charme')).toBe(30 - 20); // Soc 30, Tests de Sociabilité −20 (bout en bout)
  });
  it('attachMutation pousse les Traits dérivés (créature + psychologie)', () => {
    const c = hero();
    attachMutation(c, { id: 'tentacule-epais', label: 'Tentacule épais', desc: '', kind: 'physique', roll: 38, traits: [{ id: 'tentacules' }] });
    attachMutation(c, { id: 'colere-impie', label: 'Colère impie', desc: '', kind: 'mentale', roll: 93, psychTraits: [{ type: 'frenesie' }] });
    expect(c.traits).toContainEqual({ id: 'tentacules' });
    expect(c.psychTraits?.some((t) => t.type === 'frenesie')).toBe(true);
  });
});

describe('rollMutation — tables verbatim', () => {
  it('déterministe au seed, borné aux tables', () => {
    const a = rollMutation('physique', makeRNG(5));
    const b = rollMutation('physique', makeRNG(5));
    expect(a).toEqual(b);
    expect(a.roll).toBeGreaterThanOrEqual(1);
    expect(a.roll).toBeLessThanOrEqual(100);
    expect(a.kind).toBe('physique');
    expect(a.label.length).toBeGreaterThan(0);
  });
  it('chaque jet d100 trouve une entrée dans les deux tables', () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(rollMutation('physique', makeRNG(seed)).label).toBeTruthy();
      expect(rollMutation('mentale', makeRNG(seed)).label).toBeTruthy();
    }
  });
});
