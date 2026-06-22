import { describe, it, expect } from 'vitest';
import { fireTriggers } from './triggeredEffects';
import { addCondition, hasCondition, stacks, COND } from '../engine/conditions';
import type { Combatant } from '../engine/types';

/**
 * DISPATCHER UNIQUE des effets déclenchés (principe : « peu importe le KIND — Trait, Talent, Atout, État,
 * Mutation/Maladie par composition — un Trigger fonctionne sans code spécifique »). `fireTriggers` réunit
 * TOUTES les sources : ici un TRAIT (Bestial) et un ÉTAT (Empoisonné) réagissent au MÊME `onRoundEnd`,
 * via le MÊME appel — preuve qu'on n'a plus deux chemins (traits vs États).
 */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'x', name: 'X', kind: 'enemy', characteristics: { E: 40 }, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: { corps: 0 },
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
  ...over,
}) as unknown as Combatant;

const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
const fire = (c: Combatant, rng?: { int: () => number }) =>
  fireTriggers((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', rng ? { rng: rng as never } : {});

describe('Dispatcher unique — Traits ET États réagissent au même Trigger, sans chemin par-kind', () => {
  it('TRAIT Bestial (LDB 85) : En Flammes en fin de Round → gagne Brisé (effet de DONNÉE, plus de hook)', () => {
    const c = mk({ traits: [{ id: 'bestial' }] as never });
    addCondition(c, COND.enFlammes);
    fire(c);
    expect(hasCondition(c, COND.brise)).toBe(true);
  });

  it('Bestial sans En Flammes → aucun Brisé (la Condition Flow `if` filtre)', () => {
    const c = mk({ traits: [{ id: 'bestial' }] as never });
    fire(c);
    expect(hasCondition(c, COND.brise)).toBe(false);
  });

  it('Bestial déjà Brisé → ne re-stacke pas (LDB 85 : un seul Brisé de peur du feu)', () => {
    const c = mk({ traits: [{ id: 'bestial' }] as never });
    addCondition(c, COND.enFlammes);
    addCondition(c, COND.brise); // déjà Brisé d'une autre source
    fire(c);
    expect(stacks(c, COND.brise)).toBe(1); // la Condition `brise == 0` empêche le re-stack
  });

  it('UN SEUL appel `fireTriggers(onRoundEnd)` joue à la fois l’effet de TRAIT et l’effet d’ÉTAT', () => {
    const c = mk({ traits: [{ id: 'bestial' }] as never }); // BE=4, PAmin=0
    addCondition(c, COND.enFlammes); // déclenche le TRAIT Bestial (→ Brisé) ET l'ÉTAT En Flammes (→ dégâts)
    const before = c.wounds.current;
    fire(c, { int: () => 8 }); // d10=8 → En Flammes : max(1, 8 − 4 − 0) = 4 PB
    expect(hasCondition(c, COND.brise)).toBe(true); // effet de TRAIT (donnée)
    expect(before - c.wounds.current).toBe(4);      // effet d'ÉTAT (donnée) — MÊME appel
  });
});
