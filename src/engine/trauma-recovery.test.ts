import { describe, it, expect } from 'vitest';
import { traumaFromKind, traumaRecoveryDays, tickTraumaRecovery, treatTrauma, hasTreatableTrauma, traumaSkillPenalty, hasSurgeryTrauma, removeSurgicalTrauma } from './trauma';
import { testValue } from './skills';
import type { Combatant } from './types';
import type { RNG } from './dice';

const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'c', name: 'C', kind: 'hero', conditions: [], skills: [],
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as Combatant);

describe('Convalescence des Blessures critiques (LDB 18)', () => {
  it('traumaRecoveryDays : déchirure mineure 30−BE, majeure ×2, fracture 30+1d10 (+10 majeure)', () => {
    expect(traumaRecoveryDays('dechirure', 'mineur', 4)).toBe(26);
    expect(traumaRecoveryDays('dechirure', 'majeur', 4)).toBe(52);
    expect(traumaRecoveryDays('fracture', 'mineur', 4, 7)).toBe(37);
    expect(traumaRecoveryDays('fracture', 'majeur', 4, 7)).toBe(47);
    expect(traumaRecoveryDays('dechirure', 'mineur', 50)).toBe(1); // plancher
  });

  it('traumaFromKind pose recoveryDays/recoveryTotal/kind/severity quand BE fourni', () => {
    const t = traumaFromKind('dechirure', 'mineur', 'jambeD', { be: 4 });
    expect(t.recoveryDays).toBe(26);
    expect(t.recoveryTotal).toBe(26);
    expect(t.kind).toBe('dechirure');
    expect(traumaFromKind('dechirure', 'mineur', 'jambeD').recoveryDays).toBeUndefined();
  });

  it('tickTraumaRecovery : guérit une déchirure à 0 (retire trauma + pénalités, décrémente criticalWounds)', () => {
    const c = C({ traumas: [traumaFromKind('dechirure', 'mineur', 'jambeD', { be: 28 })], criticalWounds: 1 }); // 2 jours
    tickTraumaRecovery(c, 1);
    expect(c.traumas![0].recoveryDays).toBe(1);
    const log = tickTraumaRecovery(c, 1);
    expect(c.traumas!.length).toBe(0);
    expect(c.criticalWounds).toBe(0);
    expect(log.join(' ')).toMatch(/guérit/);
  });

  it('déchirure MAJEURE de jambe : rémission partielle (−20 → −10) à la mi-durée (l.326)', () => {
    const t = traumaFromKind('dechirure', 'majeur', 'jambeD', { be: 20 }); // total 2×(30−20)=20, mi = 10
    const c = C({ traumas: [t] });
    expect(c.traumas![0].dodgePenalty).toBe(-20);
    tickTraumaRecovery(c, 9); // reste 11 > 10 → toujours −20
    expect(c.traumas![0].dodgePenalty).toBe(-20);
    tickTraumaRecovery(c, 1); // reste 10 ≤ 10 → −10
    expect(c.traumas![0].dodgePenalty).toBe(-10);
    tickTraumaRecovery(c, 10); // reste 0 → guéri
    expect(c.traumas!.length).toBe(0);
  });

  it('fracture : Test de Résistance de fin RATÉ → séquelle permanente (−5 Ag) (l.300)', () => {
    const t = traumaFromKind('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 }); // 35 jours
    const c = C({ traumas: [t], criticalWounds: 1 });
    const fail: RNG = { int: () => 95 }; // resistVal 0 → cible 20 ; 95 > 20 → échec
    tickTraumaRecovery(c, 40, fail, 0);
    expect(c.traumas!.length).toBe(1); // la fracture part, mais une séquelle reste
    expect(c.traumas![0].label).toMatch(/mal ressoudée/);
    expect(c.traumas![0].charPenalty?.Ag).toBe(-5);
    expect(c.traumas![0].recoveryDays).toBeUndefined(); // permanente
  });

  it('fracture : Test de fin RÉUSSI → guérison propre (aucune séquelle)', () => {
    const t = traumaFromKind('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 });
    const c = C({ traumas: [t] });
    const ok: RNG = { int: () => 10 }; // resistVal 60 → cible 80 ; 10 ≤ 80 → réussite
    tickTraumaRecovery(c, 40, ok, 60);
    expect(c.traumas!.length).toBe(0);
  });

  it('fracture « réduite » par la Guérison (treatTrauma dans la semaine) → pas de Test de fin (l.302)', () => {
    const t = traumaFromKind('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 }); // 35 j ; fenêtre = >28
    const c = C({ traumas: [t] });
    expect(hasTreatableTrauma(c)).toBe(true); // dans la semaine
    treatTrauma(c, 2);
    expect(c.traumas![0].fractureSet).toBe(true);
    const fail: RNG = { int: () => 99 };
    tickTraumaRecovery(c, 40, fail, 0); // fractureSet → aucun Test → guérison propre malgré le mauvais jet
    expect(c.traumas!.length).toBe(0);
  });

  it('treatTrauma : déchirure mineure raccourcie −1 j −1/DR, une fois ; majeure non accélérée (l.326)', () => {
    const mineure = C({ traumas: [traumaFromKind('dechirure', 'mineur', 'jambeD', { be: 4 })] }); // 26 j
    treatTrauma(mineure, 3);
    expect(mineure.traumas![0].recoveryDays).toBe(22); // −(1+3)
    treatTrauma(mineure, 5);
    expect(mineure.traumas![0].recoveryDays).toBe(22); // déjà traité

    const majeure = C({ traumas: [traumaFromKind('dechirure', 'majeur', 'jambeD', { be: 4 })] }); // 52 j
    const before = majeure.traumas![0].recoveryDays;
    treatTrauma(majeure, 5);
    expect(majeure.traumas![0].recoveryDays).toBe(before); // pas d'accélération
  });

  it('fracture à la TÊTE mal ressoudée → séquelle de Langue permanente (l.300/309)', () => {
    const t = traumaFromKind('fracture', 'majeur', 'tete', { be: 4, d10: 5 });
    const c = C({ traumas: [t], skills: [{ name: 'Langue (Reikspiel)', advances: 20, characteristic: 'Int' } as never] });
    const fail: RNG = { int: () => 95 };
    tickTraumaRecovery(c, 50, fail, 0); // fin de convalescence, Test raté
    const seq = c.traumas![0];
    expect(seq.skillPenalty?.langue).toBe(-10); // majeure
    expect(traumaSkillPenalty(c, 'Langue (Reikspiel)')).toBe(-10); // matché par préfixe
    expect(traumaSkillPenalty(c, 'Charme')).toBe(0);
    // testValue intègre la séquelle : Int 30 + 20 avances − 10 = 40.
    expect(testValue(c, 'Langue (Reikspiel)')).toBe(40);
  });

  it('Chirurgie : une fracture MAJEURE exige la chirurgie ; removeSurgicalTrauma la retire (criticalWounds--)', () => {
    const fm = traumaFromKind('fracture', 'majeur', 'jambeG', { be: 4, d10: 5 });
    expect(fm.needsSurgery).toBe(true);
    const fmin = traumaFromKind('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 });
    expect(fmin.needsSurgery).toBeUndefined(); // mineure : pas de chirurgie
    const c = C({ traumas: [fm], criticalWounds: 1 });
    expect(hasSurgeryTrauma(c)).toBe(true);
    const log = removeSurgicalTrauma(c);
    expect(c.traumas!.length).toBe(0);
    expect(c.criticalWounds).toBe(0);
    expect(log.join(' ')).toMatch(/chirurgie/i);
    expect(hasSurgeryTrauma(c)).toBe(false);
  });

  it('hasTreatableTrauma : faux pour une fracture hors fenêtre d’une semaine', () => {
    const t = traumaFromKind('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 }); // 35 ; fenêtre >28
    const c = C({ traumas: [{ ...t, recoveryDays: 20 }] }); // 20 ≤ 28 → fenêtre fermée
    expect(hasTreatableTrauma(c)).toBe(false);
  });
});
