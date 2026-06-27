import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import { cureDiseases, blessDiseaseDuration } from './rest';
import { cureCriticalWounds, traumaById, dechirureFractureFicheId } from './trauma';
import type { HitLocation } from './types';
const tk = (k: 'dechirure' | 'fracture', sv: 'mineur' | 'majeur', loc: HitLocation, opts?: { be?: number; d10?: number }) => traumaById(dechirureFractureFicheId(k, sv, loc), opts, loc);
import { contractDisease } from './disease';
import { MINUTES_PER_DAY } from './clock';
import { stacks } from './conditions';
import type { Combatant } from './types';

/**
 * Jalon 2.6 — Ops maladies/soins : Amère catharsis (cureDisease + échelle DR), Bénédiction de
 * Convalescence (reduceDiseaseDays, 1×/maladie), Cautériser (preventInfection → woundDressed),
 * Larmes de Shallya (cureCriticalWound — jamais une amputation). Consomment directement les
 * moteurs maladies (LDB 20) et convalescence (LDB 18) du Jalon 2.5/5.
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', name: 'X', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

const sick = (name: string, days = 5) => contractDisease(name, { int: () => 1 }, { incubation: 0, duration: days })!;

describe('cureDisease — Amère catharsis (LDB 42)', () => {
  it('purge 1 + ⌊DR/2⌋ maladies (actives d’abord) et rend l’Exténué du malaise', () => {
    const c = dummy({
      diseases: [sick('infection-mineure'), sick('blessure-purulente')],
      conditions: [{ name: 'extenue', value: 2 }], // les 2 malaises « collants »
    });
    applyOps(c, [{ op: 'cureDisease', count: 1, countPerSL: { every: 2, amount: 1 } }], { sl: 2 });
    expect(c.diseases).toHaveLength(0); // 1 + ⌊2/2⌋ = 2 purges
    expect(stacks(c, 'extenue')).toBe(0); // malaise levé → Exténué rendu
  });

  it('immunité post-guérison préservée (Vérole Urticante)', () => {
    const c = dummy({ diseases: [sick('verole-urticante')] });
    cureDiseases(c, 1);
    expect(c.diseaseImmunities).toContain('verole-urticante');
  });
});

describe('reduceDiseaseDays — Bénédiction de Convalescence (LDB 41)', () => {
  it('−1 jour (min 1), UNE seule fois par maladie', () => {
    const c = dummy({ diseases: [sick('infection-mineure', 5)] });
    blessDiseaseDuration(c, 1);
    expect(c.diseases![0].minutesLeft).toBe(4 * MINUTES_PER_DAY);
    const log = blessDiseaseDuration(c, 1); // 2e tentative sur la même maladie → refus
    expect(c.diseases![0].minutesLeft).toBe(4 * MINUTES_PER_DAY);
    expect(log.join(' ')).toMatch(/aucune maladie/);
  });
});

describe('preventInfection — Cautériser (LDB 47) & cureCriticalWound — Larmes de Shallya (LDB 42)', () => {
  it('preventInfection pose woundDressed (pas d’Infection post-critique, LDB 18 l.382)', () => {
    const c = dummy({});
    applyOps(c, [{ op: 'preventInfection' }], { label: 'Cautériser' });
    expect(c.woundDressed).toBe(true);
  });

  it('cureCriticalWound guérit déchirures/fractures mais JAMAIS une amputation', () => {
    const c = dummy({
      criticalWounds: 3,
      traumas: [
        tk('dechirure', 'mineur', 'jambeD', { be: 25 }),
        tk('fracture', 'majeur', 'brasG', { be: 25, d10: 5 }),
        { label: 'Main/bras amputé (brasD)', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }] },
      ],
    });
    applyOps(c, [{ op: 'cureCriticalWound', count: 1, countPerSL: { every: 2, amount: 1 } }], { sl: 4 }); // 1 + 2 = 3 tentées
    expect(c.traumas).toHaveLength(1); // l'amputation reste
    expect(c.traumas![0].label).toMatch(/amputé/);
    expect(c.criticalWounds).toBe(1); // 3 − 2 guéris
  });

  it('cureCriticalWounds direct : 0 trauma guérissable → journal explicite via l’op', () => {
    const c = dummy({ traumas: [{ label: 'Main/bras amputé (brasD)', location: 'brasD' }] });
    const log = applyOps(c, [{ op: 'cureCriticalWound' }], {});
    expect(log.join(' ')).toMatch(/amputations sont hors d'atteinte/);
    expect(c.traumas).toHaveLength(1);
  });
});
