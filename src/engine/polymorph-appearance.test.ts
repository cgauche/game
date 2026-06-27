import { describe, it, expect } from 'vitest';
import { applyOps, type OpsCtx } from './ops';
import { liveMorphRef } from './polymorph';
import { combatantAppearance } from '../gameIso/rig/parts/combatantVisuals';
import { defaultAppearance } from '../gameIso/rig/appearance';
import { findCreatureById } from '../data';
import type { Combatant } from './types';

function combatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'T', kind: 'hero', species: 'humain',
    characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 40, FM: 40, Soc: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items: [], activeEffects: [], traits: [],
    ...over,
  } as Combatant;
}

/** #17 — l'op `polymorph` change AUSSI l'apparence rendue (rig), le temps de l'effet, restituée seule à
 *  l'expiration. Le moteur ne porte que l'id (morphRef) ; la résolution rig vit dans combatantAppearance. */
describe('#17 polymorph → apparence', () => {
  it('pose un morphRef temporisé sur la durée du sort', () => {
    const c = combatant();
    applyOps(c, [{ op: 'polymorph', ref: 'loup-blanc' }], { caster: c, defaultDurationRounds: 6 } as OpsCtx);
    expect(liveMorphRef(c)).toBe('loup-blanc');
    expect(c.activeEffects!.some((e) => e.morphRef === 'loup-blanc' && e.duration.scale === 'rounds')).toBe(true);
  });

  it('forme de base : liveMorphRef = undefined', () => {
    expect(liveMorphRef(combatant())).toBeUndefined();
  });

  it("combatantAppearance rend l'espèce de la créature pendant la métamorphose, base sinon", () => {
    const c = combatant();
    const base = defaultAppearance(c);
    expect(combatantAppearance(base, c).species).toBe(base.species);
    applyOps(c, [{ op: 'polymorph', ref: 'loup-blanc' }], { caster: c, defaultDurationRounds: 6 } as OpsCtx);
    const wolf = findCreatureById('loup-blanc')!.appearance!;
    const morphed = combatantAppearance(base, c);
    expect(morphed.species).toBe(wolf.species);
    expect(morphed.species).not.toBe(base.species);
  });
});
