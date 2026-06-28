import { describe, it, expect } from 'vitest';
import { applyCriticalToTarget } from './combatFlow';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';

const CRIT: AttackResult = { hit: true, critical: true, attackerRoll: 11, netSL: 1, location: 'corps', advantageTo: 'attacker', defenderDefeated: false, log: '' };

/**
 * RAW-2 — « Je ne faillirai pas ! » (LDB 17 l.73) : « Si vous infligez un Coup Critique, vous pouvez
 * choisir la Localisation atteinte, plutôt que de la laisser au hasard. » Sur un Coup Critique issu d'un
 * succès FORCÉ, la localisation choisie doit court-circuiter le tirage aléatoire (`critLocationRoll`).
 */
const mk = (): Combatant =>
  ({
    id: 'T', name: 'Cible', kind: 'enemy',
    characteristics: { CC: 30, CT: 30, F: 30, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
  }) as unknown as Combatant;

describe('applyCriticalToTarget — la Localisation fournie est utilisée verbatim (résolue en amont)', () => {
  it('localisation fournie → le Critique est résolu à cette localisation', () => {
    seedBattleRng(1);
    const log: string[] = [];
    applyCriticalToTarget(mk(), 'tete', true, 0, log, () => {});
    expect(log.some((l) => l.includes('(Tête)'))).toBe(true); // localisation affichée en FR via locationLabel(loc, shape)
  });

  it('un Critique est bien appliqué à la localisation donnée', () => {
    seedBattleRng(1);
    const log: string[] = [];
    applyCriticalToTarget(mk(), 'corps', true, 0, log, () => {});
    expect(log.some((l) => l.includes('Blessure critique'))).toBe(true);
  });
});

describe('applyCriticalToTarget — libellé de localisation adapté à la forme du corps (créatures)', () => {
  it('critique sur quadrupède → localisation « (Membre antérieur droit) », jamais « (Bras droit) » humanoïde', () => {
    seedBattleRng(1);
    const log: string[] = [];
    const t = mk();
    t.bodyShape = 'quadrupede';
    applyCriticalToTarget(t, 'brasD', true, 0, log, () => {}); // localisation fournie pour le déterminisme
    expect(log.some((l) => l.includes('(Membre antérieur droit)'))).toBe(true);
    expect(log.some((l) => l.includes('(Bras droit)'))).toBe(false);
  });
});

describe('attackSetCritLocation — réservé au Coup Critique FORCÉ (RAW-2)', () => {
  it('forced + critical → pose result.critLocation', () => {
    useGame.setState({ pendingAttack: { attackerId: 'a', targetId: 'b', location: null, forced: true, result: CRIT } });
    useGame.getState().attackSetCritLocation('jambeG');
    expect(useGame.getState().pendingAttack!.result!.critLocation).toBe('jambeG');
  });

  it('non forcé (Coup Critique « ordinaire ») → ignoré (localisation au hasard, RAW)', () => {
    useGame.setState({ pendingAttack: { attackerId: 'a', targetId: 'b', location: null, result: CRIT } });
    useGame.getState().attackSetCritLocation('jambeG');
    expect(useGame.getState().pendingAttack!.result!.critLocation).toBeUndefined();
  });
});
