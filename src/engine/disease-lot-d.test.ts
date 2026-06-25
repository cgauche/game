import { describe, it, expect } from 'vitest';
import {
  DISEASE_DEFS, contractDisease, rollContraction, tickDisease, diseasePassiveOps,
  diseaseBlesseCount, hasActiveCapability, contagiousDiseases, Disease,
} from './disease';
import { makeRNG } from './dice';
import type { Combatant } from './types';
import type { GameOp } from './ops';

/** Pénalité de Caractéristique due aux maladies actives (lit les GameOp passifs des symptômes). */
const pen = (c: Combatant, char: string): number[] =>
  diseasePassiveOps(c).filter((o): o is Extract<GameOp, { op: 'charMod' }> => o.op === 'charMod' && o.char === char).map((o) => o.mod);

/** Lot D — complément Maladies (LDB 20) : la Litanie de la Pestilence au complet + nouveaux symptômes. */

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
    ...over,
  } as Combatant;
}
const active = (name: string): Disease => {
  const dz = contractDisease(name, makeRNG(1), { incubation: 0, duration: 5 })!;
  return dz;
};

describe('Litanie de la Pestilence — les 9 maladies du LDB 20 sont câblées', () => {
  it('toutes présentes dans DISEASE_DEFS', () => {
    for (const n of ['infection-mineure', 'blessure-purulente', 'infection-du-sang', 'courante-galopante',
      'fievre-du-rongeur', 'flux-sanglant', 'peste-noire', 'verole-du-tanneur', 'verole-urticante']) {
      expect(DISEASE_DEFS[n], n).toBeTruthy();
    }
  });
  it('Fièvre du Rongeur : symptômes du verbatim (l.55)', () => {
    expect(DISEASE_DEFS['fievre-du-rongeur'].symptoms.map((s) => s.symptomId).sort()).toEqual(
      ['blesse', 'convulsions', 'demangeaisons', 'fievre', 'malaise', 'persistant'].sort(),
    );
  });
});

describe('nouveaux symptômes — pénalités (LDB 20 l.99-200)', () => {
  it('bubons : −10 Tests Physiques ET Sociabilité', () => {
    const c = mk({ diseases: [active('peste-noire')] });
    expect(pen(c, 'F')).toContain(-10);
    expect(pen(c, 'Soc')).toContain(-10);
  });
  it('convulsions : −10 Physiques (pas la Sociabilité)', () => {
    const c = mk({ diseases: [active('fievre-du-rongeur')] });
    expect(pen(c, 'Ag')).toContain(-10);
  });
  it('démangeaisons : −10 Sociabilité seulement', () => {
    const c = mk({ diseases: [active('verole-du-tanneur')] });
    expect(pen(c, 'Soc')).toContain(-10);
    expect(pen(c, 'F')).toEqual([]);
  });
  it('gangrène : compte comme Blessé (bloque 1 PB de guérison) + −10 Soc', () => {
    const c = mk({ diseases: [active('peste-noire')] });
    expect(diseaseBlesseCount(c)).toBeGreaterThanOrEqual(1);
  });
  it('nausée / toux : prédicats pour les câblages (Sonné sur Esquive ratée, contagion)', () => {
    const c = mk({ diseases: [active('courante-galopante')] });
    expect(hasActiveCapability(c, 'nausea')).toBe(true);
    const v = mk({ diseases: [active('verole-urticante')] });
    expect(contagiousDiseases(v).length).toBe(1);
  });
});

describe('Vérole Urticante — immunité après guérison (l.97)', () => {
  it('guérison naturelle → inscrite dans diseaseImmunities ; recontraction impossible', () => {
    const c = mk({ diseases: [contractDisease('verole-urticante', makeRNG(2), { incubation: 0, duration: 1 })!] });
    tickDisease(c, 2, makeRNG(3), 40);
    expect(c.diseases).toEqual([]);
    expect(c.diseaseImmunities).toContain('verole-urticante');
    const log = rollContraction(c, 'verole-urticante', 0, 'tresDifficile', makeRNG(4)); // Test impossible à réussir
    expect(log).toEqual([]);
    expect(c.diseases).toEqual([]);
  });
});

describe('gangrène — progression journalière (l.135+)', () => {
  it('échecs cumulés > BE → Localisation perdue (journalisée)', () => {
    const c = mk({ diseases: [contractDisease('peste-noire', makeRNG(5), { incubation: 0, duration: 30 })!] });
    // resistVal 0 → tout Test raté ; BE ≈ 0 → perdue dès le 1er échec.
    const log = tickDisease(c, 3, makeRNG(6), 0);
    expect(log.some((l) => /Gangrène a gagné/.test(l))).toBe(true);
    expect(c.diseases![0].gangreneLost).toBe(true);
  });
});
