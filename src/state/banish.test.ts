import { describe, it, expect } from 'vitest';
import { fireTriggers, applyTriggeredEffects } from './triggeredEffects';
import { hasCondition, COND } from '../engine/conditions';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { TriggeredEffect } from './flow';

/**
 * Démoniaque — bannissement à 0 PB (LDB 85 p.339 : « son âme retourne dans les Royaumes du Chaos, ce qui
 * la retire du jeu »). L'effet est 100 % DONNÉE : op `banish` portée par l'`effects` du trait, déclenchée
 * par `onWoundLoss` quand `woundsCurrent <= 0` — plus de branche en dur dans applyAttackResult. Le porteur
 * réagit à SA PROPRE chute (le dispatcher autorise les effets `on:'self'` sur une cible hors-combat), donc
 * même un figurant (mort subite à 0 PB) est bien banni — parité avec l'ancien code impératif.
 */

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'd', name: 'Démon', kind: 'enemy', characteristics: { E: 40 }, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: { corps: 0 },
  wounds: { current: 0, max: 12, base: 12 }, advantage: 0,
  ...over,
}) as unknown as Combatant;

const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
const woundLoss = (c: Combatant, attackType: 'melee' | 'ranged') =>
  fireTriggers((get as (c: Combatant) => unknown)(c) as never, c, 'onWoundLoss', { attackType } as never);

describe('Démoniaque — banni à 0 PB (op `banish` en DONNÉE, déclenché par onWoundLoss)', () => {
  it('démoniaque à 0 PB → banni (dead) par mêlée', () => {
    const demon = mk({ traits: [{ id: 'demoniaque', value: 8 }] as never });
    woundLoss(demon, 'melee');
    expect(demon.dead).toBe(true);
  });
  it('démoniaque à 0 PB → banni (dead) par tir (toute attaque, pas seulement mêlée)', () => {
    const demon = mk({ traits: [{ id: 'demoniaque', value: 8 }] as never });
    woundLoss(demon, 'ranged');
    expect(demon.dead).toBe(true);
  });
  it('démoniaque AU-DESSUS de 0 PB → PAS banni (la Condition woundsCurrent<=0 filtre)', () => {
    const demon = mk({ traits: [{ id: 'demoniaque', value: 8 }] as never, wounds: { current: 5, max: 12, base: 12 } as never });
    woundLoss(demon, 'melee');
    expect(demon.dead).toBeFalsy();
  });
});

describe('onWoundLoss — TOUTE perte de PB (mêlée OU distance) ; le type voyage en attribut', () => {
  const alive = (over: Partial<Combatant> = {}) => mk({ wounds: { current: 10, max: 10, base: 10 } as never, ...over });

  it('Sang corrosif éclabousse les Engagés même sur une perte à DISTANCE (RAW LDB 85 l.220 : « chaque fois »)', () => {
    const acid = alive({ id: 'ac', traits: [{ id: 'sang-corrosif' }] as never });
    const foe = alive({ id: 'fo', engagedWith: ['ac'] as never });
    const g = (() => ({ battle: { combatants: [acid, foe] } })) as never;
    const before = foe.wounds.current;
    fireTriggers(g, acid, 'onWoundLoss', { attackType: 'ranged', rng: makeRNG(1) } as never);
    expect(foe.wounds.current).toBeLessThan(before); // plus de gate « mêlée seulement »
  });

  it('un effet `attackType:\'melee\'` ne réagit qu’aux pertes de MÊLÉE', () => {
    const eff: TriggeredEffect = {
      trigger: 'onWoundLoss', on: 'self', attackType: 'melee',
      flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', name: 'sonne', value: 1 }] } } as never,
    };
    const g = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
    const ranged = alive({ id: 'r' });
    applyTriggeredEffects((g as (c: Combatant) => unknown)(ranged) as never, ranged, [eff], 'onWoundLoss', { attackType: 'ranged' });
    expect(hasCondition(ranged, COND.sonne)).toBe(false); // type ≠ → ignoré
    const melee = alive({ id: 'm' });
    applyTriggeredEffects((g as (c: Combatant) => unknown)(melee) as never, melee, [eff], 'onWoundLoss', { attackType: 'melee' });
    expect(hasCondition(melee, COND.sonne)).toBe(true); // type = → réagit
  });
});
