/**
 * Tables d'Imparfaites/Colère pleinement mécaniques (LDB 46 l.61-136, 40 l.58-138) :
 * ops émises par les tables, pénalités/blocages d'incantation temporisés, plafond
 * de DR de Prière, Tests imbriqués à palier (« Purifier la chair »).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { makeRNG } from './dice';
import { rollMiscast } from './miscast';
import { applyOps } from './ops';
import {
  castingValue, castBlockedBy, prayerMaxZeroDR, evaluateCasting, castPenaltyMod,
} from './magic';
import { endOfRound } from './conditions';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'Cobaye', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 40, FM: 35, Soc: 45 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { skillId: 'priere', advances: 10 }, { skillId: 'langue', spec: 'Magick', advances: 10 },
      { skillId: 'focalisation', advances: 10 },
    ] as never,
    talents: [],
    ...p,
  } as Combatant;
}

describe('castPenalty — pénalités/blocages temporisés', () => {
  it('Langue maladroite : −10 aux Tests de Langue pendant N Rounds, dissipé par endOfRound', () => {
    const c = hero();
    const base = castingValue(c, 'langue', 'Magick');
    applyOps(c, [{ op: 'castPenalty', skill: 'langue', mod: -10, rounds: 2 }], { label: 'Langue maladroite' });
    expect(castingValue(c, 'langue', 'Magick')).toBe(base - 10);
    expect(castPenaltyMod(c, 'priere')).toBe(0); // ne touche pas la Prière
    endOfRound(c, makeRNG(1));
    expect(castingValue(c, 'langue', 'Magick')).toBe(base - 10); // round 1 restant
    const log = endOfRound(c, makeRNG(1));
    expect(castingValue(c, 'langue', 'Magick')).toBe(base); // expiré
    expect(log.join('\n')).toMatch(/Langue maladroite se dissipe/);
  });

  it('blocage : « Vous abusez de ma patience » interdit les Tests de Prière', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: 'priere', blocked: true, rounds: 3 }], { label: 'Vous abusez de ma patience' });
    expect(castBlockedBy(c, 'priere')).toBe('Vous abusez de ma patience');
    expect(castBlockedBy(c, 'langue')).toBeNull();
  });

  it('durée d\'horloge : untilTime = now + minutes/heures/jours', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: 'langue', blocked: true, minutes: 5 }], { label: 'Drain de puissance', now: 1000 });
    expect(c.castPenalties![0].untilTime).toBe(1005);
    const c2 = hero();
    applyOps(c2, [{ op: 'castPenalty', skill: 'priere', maxZeroDR: true, days: 7 }], { label: 'Pensez à vos actes', now: 0 });
    expect(c2.castPenalties![0].untilTime).toBe(7 * 24 * 60);
  });

  it('« Pensez à vos actes » : tout Test de Prière RÉUSSI plafonné à 0 DR', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: 'priere', maxZeroDR: true, days: 7 }], { label: 'Pensez à vos actes', now: 0 });
    expect(prayerMaxZeroDR(c)).toBe(true);
    const prayer = { label: 'Bénédiction de Guérison', type: 'Béni', isPrayer: true, cn: null, desc: 'soin' };
    const res = evaluateCasting(c, prayer, { roll: 5, target: 55, success: true, sl: 5, isDouble: false });
    expect(res.cast).toBe(true);
    expect(res.sl).toBe(0); // plafonné
    // Un SORT (Langue) n'est pas plafonné.
    const sort = { label: 'X', type: 'Magie mineure', cn: 0, desc: 'x' };
    expect(evaluateCasting(c, sort, { roll: 5, target: 50, success: true, sl: 4, isDouble: false }).sl).toBe(4);
  });
});

describe('Tests imbriqués des tables', () => {
  it('« Murmures mortels » : Test de FM Accessible raté → +1 Corruption (via onCorruption)', () => {
    const c = hero({ characteristics: { ...hero().characteristics, FM: 1 } }); // échec quasi sûr
    const gained: number[] = [];
    applyOps(
      c,
      [{ op: 'test', characteristic: 'FM', difficulty: 'accessible', onFail: [{ op: 'corruption', amount: 1 }] }],
      { rng: makeRNG(3), onCorruption: (n) => { gained.push(n); return [`+${n} Corruption`]; } },
    );
    expect(gained).toEqual([1]);
  });

  it('« Purifier la chair » : échec → Sonné ; échec à −4 DR ou moins → Inconscient EN PLUS', () => {
    const c = hero({ characteristics: { ...hero().characteristics, E: 1 } }); // cible ~1 → échec dur garanti
    applyOps(
      c,
      [{ op: 'test', skill: 'resistance', difficulty: 'difficile', onFail: [{ op: 'condition', name: 'sonne' }], onFailHard: { dr: -4, ops: [{ op: 'condition', name: 'inconscient' }] } }],
      { rng: makeRNG(1) }, // d100 = 63 vs cible ~1 → échec à −6 DR (≤ −4 : palier dur)
    );
    expect(c.conditions.some((x) => x.name === 'sonne')).toBe(true);
    expect(c.conditions.some((x) => x.name === 'inconscient')).toBe(true);
  });
});

describe('tables migrées — sweep d\'application', () => {
  it('toutes les entrées atteignables s\'appliquent sans erreur sur un Combatant', () => {
    for (const sev of ['mineure', 'majeure', 'colere'] as const) {
      for (let seed = 0; seed < 120; seed++) {
        const c = hero();
        const r = rollMiscast(sev, makeRNG(seed), sev === 'colere' ? seed % 6 : 0);
        const lines = applyOps(c, r.ops, { rng: makeRNG(seed + 1), label: r.name, now: 0 });
        expect(Array.isArray(lines)).toBe(true);
      }
    }
  });

  it('« Tenez compte de mes enseignements » porte la durée 1d10 + Péchés (formule plus)', () => {
    // Force l'entrée 11-15 : on échantillonne jusqu'à la trouver.
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      const r = rollMiscast('colere', makeRNG(seed), 0);
      if (!r.name.startsWith('Tenez compte')) continue;
      found = true;
      const c = hero();
      applyOps(c, r.ops, { rng: makeRNG(1), label: r.name });
      const p = c.castPenalties![0];
      expect(p.skill).toBe('priere');
      expect(p.mod).toBe(-10);
      expect(p.roundsLeft).toBeGreaterThanOrEqual(1);
      expect(p.roundsLeft).toBeLessThanOrEqual(10);
    }
    expect(found).toBe(true);
  });
});
