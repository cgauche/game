import { describe, it, expect } from 'vitest';
import { areGrappling, setGrapple, clearGrapple, grappleTierMod, grappleEnvMod, grappleDamageOps } from './grapple';
import { applyOps } from './ops';
import type { Combatant } from './types';

// Empoignade (Issue #42.1, LDB 14 l.159/161/169).
//  l.159 : « Si vous remportez le Test opposé, vous ET votre adversaire êtes Empoignés, et votre
//           adversaire gagne l'État *Empêtré*. »
//  l.161 : « BF + DR Dégâts […] en IGNORANT tous les PA. »
//  l.169 : « +20 pour toucher le Personnage Empoigné avec le plus FAIBLE Avantage, et +10 pour celui
//           qui a l'Avantage le plus IMPORTANT. »

const C = (id: string, p?: Partial<Combatant>): Combatant => ({
  id, name: id, kind: 'hero',
  characteristics: { CC: 40, CT: 30, F: 40, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
  engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  ...p,
} as unknown as Combatant);

describe('areGrappling / setGrapple / clearGrapple — relation symétrique + purge (LDB 14 l.159)', () => {
  it('areGrappling est SYMÉTRIQUE après setGrapple (posé par paire)', () => {
    const a = C('a'), b = C('b');
    expect(areGrappling(a, b)).toBe(false);
    setGrapple(a, b);
    expect(areGrappling(a, b)).toBe(true);
    expect(areGrappling(b, a)).toBe(true);
    expect(a.grapplingWith).toEqual(['b']);
    expect(b.grapplingWith).toEqual(['a']);
    setGrapple(a, b); // idempotent
    expect(a.grapplingWith).toEqual(['b']);
  });
  it('clearGrapple retire des DEUX côtés', () => {
    const a = C('a'), b = C('b');
    setGrapple(a, b);
    clearGrapple(a, b);
    expect(areGrappling(a, b)).toBe(false);
    expect(a.grapplingWith).toEqual([]);
    expect(b.grapplingWith).toEqual([]);
  });
});

describe('grappleTierMod — bonus de tiers +20 / +10 (LDB 14 l.169)', () => {
  it('attaquant hors-Empoignade, cible au PLUS FAIBLE Avantage → +20', () => {
    const att = C('att');
    const lowAdv = C('low', { advantage: 1 });
    const partner = C('high', { advantage: 3 });
    setGrapple(lowAdv, partner);
    const m = grappleTierMod(att, lowAdv, partner);
    expect(m).not.toBeNull();
    expect(m!.value).toBe(20);
  });
  it('cible au PLUS FORT Avantage → +10', () => {
    const att = C('att');
    const lowAdv = C('low', { advantage: 1 });
    const partner = C('high', { advantage: 3 });
    setGrapple(lowAdv, partner);
    const m = grappleTierMod(att, partner, lowAdv);
    expect(m!.value).toBe(10);
  });
  it('attaquant PARTIE à l’Empoignade → AUCUN bonus', () => {
    const a = C('a', { advantage: 2 }), b = C('b', { advantage: 0 });
    setGrapple(a, b);
    expect(grappleTierMod(a, b, a)).toBeNull(); // a est partie prenante (Empoigné avec b)
  });
  it('cible NON Empoignée → null', () => {
    const att = C('att'), target = C('t'), other = C('o');
    expect(grappleTierMod(att, target, other)).toBeNull();
  });
  it('grappleEnvMod résout le partenaire dans la liste de combat', () => {
    const att = C('att');
    const low = C('low', { advantage: 0 });
    const high = C('high', { advantage: 4 });
    setGrapple(low, high);
    const m = grappleEnvMod(att, low, [att, low, high]);
    expect(m!.value).toBe(20); // low a l'Avantage le plus faible
    expect(grappleEnvMod(low, high, [att, low, high])).toBeNull(); // low EST partie à l'Empoignade
  });
});

describe('grappleDamageOps — BF + DR, tous les PA IGNORÉS (LDB 14 l.161)', () => {
  it('Dégâts = BF + DR, le Bonus d’Endurance est déduit, les PA sont ignorés', () => {
    const actor = C('actor', { characteristics: { CC: 40, CT: 30, F: 50, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 } as Combatant['characteristics'] });
    const target = C('target', { characteristics: { CC: 40, CT: 30, F: 40, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 } as Combatant['characteristics'] });
    const before = target.wounds.current;
    applyOps(target, grappleDamageOps(actor, 3), { caster: actor }); // BF(5) + DR(3) = 8, − BE(3) = 5
    expect(before - target.wounds.current).toBe(5);
  });
  it('une cible BLINDÉE subit AUTANT qu’une cible nue (PA ignorés)', () => {
    const actor = C('actor', { characteristics: { CC: 40, CT: 30, F: 50, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 } as Combatant['characteristics'] });
    const naked = C('naked', { characteristics: { CC: 40, CT: 30, F: 40, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 } as Combatant['characteristics'] });
    const armoured = C('armoured', {
      characteristics: { CC: 40, CT: 30, F: 40, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 } as Combatant['characteristics'],
      armour: { tete: 5, brasG: 5, brasD: 5, corps: 5, jambeG: 5, jambeD: 5 },
    });
    const ops = grappleDamageOps(actor, 3);
    const dn = naked.wounds.current; applyOps(naked, ops, { caster: actor });
    const da = armoured.wounds.current; applyOps(armoured, ops, { caster: actor });
    expect(dn - naked.wounds.current).toBe(da - armoured.wounds.current); // PA ignorés → même perte
    expect(da - armoured.wounds.current).toBe(5);
  });
});
