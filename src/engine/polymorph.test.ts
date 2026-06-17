import { describe, it, expect } from 'vitest';
import { polymorphOps } from './polymorph';
import { applyOps } from './ops';
import { effectiveChar } from './characteristics';
import { endOfRound } from './conditions';
import { findCreatureById } from '../data';
import { hasTraitKey } from './traits/dispatch';
import type { Combatant } from './types';

/**
 * Forme bestiale (LDB 48) : métamorphose en une Bête du Reikland — F/E/Ag/Dex remplacées + Traits
 * de la créature (sauf Bestial), le tout auto-restitué à l'expiration (charMod + grantTrait).
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', name: 'Mage', kind: 'hero',
    characteristics: { CC: 40, CT: 30, F: 30, E: 30, I: 35, Ag: 40, Dex: 45, Int: 40, FM: 40, Soc: 30 },
    wounds: { current: 14, max: 14 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('polymorphOps — Forme bestiale (Ours)', () => {
  it('remplace F/E/Ag/Dex par celles de l’Ours et accorde ses Traits (sauf Bestial)', () => {
    const ours = findCreatureById('ours')!;
    const c = dummy({});
    applyOps(c, polymorphOps(c, 'ours'), { label: 'Forme bestiale', defaultDurationRounds: 3 });
    expect(effectiveChar(c, 'F')).toBe(ours.char.F); // 55
    expect(effectiveChar(c, 'E')).toBe(ours.char.E); // 45
    expect(effectiveChar(c, 'Ag')).toBe(ours.char.Ag); // 25
    expect(hasTraitKey(c.traits, 'morsure')).toBe(true); // Trait de l'Ours accordé
    expect(hasTraitKey(c.traits, 'bestial')).toBe(false); // Bestial exclu
  });

  it('reprend sa vraie forme à l’expiration (Caractéristiques restaurées, Traits retirés)', () => {
    const c = dummy({});
    applyOps(c, polymorphOps(c, 'Ours'), { label: 'Forme bestiale', defaultDurationRounds: 1 });
    endOfRound(c); // 1 Round écoulé → l'effet expire
    expect(effectiveChar(c, 'F')).toBe(30); // base restaurée
    expect(effectiveChar(c, 'Ag')).toBe(40);
    expect(hasTraitKey(c.traits, 'morsure')).toBe(false); // Trait retiré
  });
});
