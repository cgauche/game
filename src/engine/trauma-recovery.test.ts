import { describe, it, expect } from 'vitest';
import { traumaFromKind, traumaRecoveryDays, tickTraumaRecovery, accelerateTrauma, hasTreatableTrauma } from './trauma';
import type { Combatant } from './types';

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
    expect(traumaRecoveryDays('dechirure', 'mineur', 4)).toBe(26); // l.317 : 30−BE
    expect(traumaRecoveryDays('dechirure', 'majeur', 4)).toBe(52); // l.326 : deux périodes
    expect(traumaRecoveryDays('fracture', 'mineur', 4, 7)).toBe(37); // l.300 : 30+1d10
    expect(traumaRecoveryDays('fracture', 'majeur', 4, 7)).toBe(47); // l.309 : +10 jours
    expect(traumaRecoveryDays('dechirure', 'mineur', 50)).toBe(1); // plancher 1 jour (BE ≥ 30)
  });

  it('traumaFromKind pose recoveryDays quand BE fourni, sinon non (legacy)', () => {
    expect(traumaFromKind('dechirure', 'mineur', 'jambeD', { be: 4 }).recoveryDays).toBe(26);
    expect(traumaFromKind('dechirure', 'mineur', 'jambeD').recoveryDays).toBeUndefined();
  });

  it('tickTraumaRecovery : décompte, guérit à 0 (retire trauma + pénalités, décrémente criticalWounds)', () => {
    const c = C({ traumas: [traumaFromKind('dechirure', 'mineur', 'jambeD', { be: 28 })], criticalWounds: 1 }); // 2 jours
    tickTraumaRecovery(c, 1);
    expect(c.traumas![0].recoveryDays).toBe(1);
    expect(c.criticalWounds).toBe(1);
    const log = tickTraumaRecovery(c, 1); // 1 − 1 ≤ 0 → guéri
    expect(c.traumas!.length).toBe(0); // pénalités (movementHalved/dodge) tombent avec
    expect(c.criticalWounds).toBe(0);
    expect(log.join(' ')).toMatch(/guérit/);
  });

  it('un trauma sans recoveryDays (legacy) n’est jamais décompté', () => {
    const c = C({ traumas: [traumaFromKind('fracture', 'mineur', 'corps')] }); // pas de BE → permanent
    tickTraumaRecovery(c, 999);
    expect(c.traumas!.length).toBe(1);
  });

  it('accelerateTrauma : −1 jour −1/DR, une seule fois, déchirure uniquement (l.317)', () => {
    const c = C({ traumas: [traumaFromKind('dechirure', 'mineur', 'jambeD', { be: 4 })] }); // 26 j
    accelerateTrauma(c, 3); // −(1+3) = 4 → 22
    expect(c.traumas![0].recoveryDays).toBe(22);
    expect(c.traumas![0].healAccelerated).toBe(true);
    accelerateTrauma(c, 5); // déjà accéléré → aucune éligible
    expect(c.traumas![0].recoveryDays).toBe(22);
  });

  it('accelerateTrauma : une fracture n’est pas accélérée par la Guérison', () => {
    const c = C({ traumas: [traumaFromKind('fracture', 'mineur', 'jambeG', { be: 4, d10: 5 })] });
    const log = accelerateTrauma(c, 4);
    expect(log.join(' ')).toMatch(/aucune déchirure/);
    expect(c.traumas![0].recoveryDays).toBe(35); // inchangé (30+5)
  });

  it('hasTreatableTrauma : vrai pour une déchirure non accélérée à durée, faux après', () => {
    const c = C({ traumas: [traumaFromKind('dechirure', 'mineur', 'jambeD', { be: 4 })] });
    expect(hasTreatableTrauma(c)).toBe(true);
    accelerateTrauma(c, 0);
    expect(hasTreatableTrauma(c)).toBe(false);
  });
});
