/**
 * MONTEUR MONO d'une rangée de jet (#1262) — `buildRollRow` : l'acteur passé UNE fois (Chance et
 * Résilience s'en dérivent au rendu), `rolled` dérivé de la donnée du jet, extras typés du site.
 */
import { describe, it, expect } from 'vitest';
import { buildRollRow } from './rollRowBuild';
import type { Combatant } from '../engine/types';

const hero = (): Combatant =>
  ({
    id: 'H1', label: 'Héros H1', kind: 'hero',
    characteristics: {}, skills: [], conditions: [], talents: [], fortune: 2, resilience: 3,
  }) as unknown as Combatant;

describe('#1262 — buildRollRow', () => {
  it('l’acteur est passé UNE fois (Chance/Résilience s’en dérivent au rendu, jamais recopiées)', () => {
    const h = hero();
    const r = buildRollRow({ row: {}, actor: h, onRoll: () => {} });
    expect(r.actor).toBe(h);
    expect(r).not.toHaveProperty('fortune');
    expect(r).not.toHaveProperty('resilience');
  });

  it('`rolled` se DÉRIVE de la donnée du jet (`row.d`), jamais déclaré par le site', () => {
    expect(buildRollRow({ row: {} }).rolled).toBe(false);
    const d = { roll: 30, target: 40, sl: 1, success: true } as never;
    expect(buildRollRow({ row: { d } }).rolled).toBe(true);
  });

  it('les extras TYPÉS du site passent tels quels (Test étendu, garde de règle…)', () => {
    const r = buildRollRow({ row: {} }, { extendedDr: { cum: 2, target: 5 }, rollBlocked: 'hors de portée' });
    expect(r.extendedDr).toEqual({ cum: 2, target: 5 });
    expect(r.rollBlocked).toBe('hors de portée');
  });

  it('le noyau passe intégralement (les 11 champs, aucun perdu en route)', () => {
    const noop = () => {};
    const r = buildRollRow({
      row: {}, actor: hero(), onRoll: noop, rerollable: true, onReroll: noop,
      darkPactable: true, onDarkPact: noop, onBonusSL: noop, onForce: noop, forceShow: true, freeReroll: true,
    });
    expect(r.rerollable).toBe(true);
    expect(r.darkPactable).toBe(true);
    expect(r.forceShow).toBe(true);
    expect(r.freeReroll).toBe(true);
    expect(r.onReroll).toBe(noop);
    expect(r.onDarkPact).toBe(noop);
    expect(r.onBonusSL).toBe(noop);
    expect(r.onForce).toBe(noop);
  });
});
