/**
 * Attributs de Domaine (LDB 48, intros des 8 Couleurs — L14). Citations dans domainAttributes.ts.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant, ItemInstance } from './types';
import type { RNG } from './dice';
import { domainOf, hasArcaneTalent, metalAPAt, domainMissileMods, domainOnHitRiders, ghurFearAfterCast, isLiving } from './domainAttributes';
import { evaluateMissile } from './magic';
import { hasCondition, stacks, addCondition } from './conditions';

function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] ?? 5 } as RNG;
}

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'Cobaye', kind: 'enemy', size: 'moyenne', advantage: 0,
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 40, FM: 40, Soc: 30 },
    conditions: [], skills: [], talents: [], traits: [], groups: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, wounds: { current: 12, max: 12 },
    ...over,
  } as unknown as Combatant;
}

const mail = (pa: number): ItemInstance => ({
  uid: 'm1', name: 'Chemise de mailles', kind: 'armor', pa, locs: ['corps'], equipped: true, qualities: [],
} as unknown as ItemInstance);
const leather = (pa: number): ItemInstance => ({
  uid: 'l1', name: 'Armure de cuir souple', kind: 'armor', pa, locs: ['corps'], equipped: true, qualities: [],
} as unknown as ItemInstance);

describe('domainOf / hasArcaneTalent', () => {
  it('subType d’un Sort d’Arcane = Domaine ; Prière/commun = null', () => {
    expect(domainOf({ type: 'Magie des Arcanes', subType: 'Feu' })).toBe('Feu');
    expect(domainOf({ type: 'Magie des Arcanes', subType: null })).toBeNull();
    expect(domainOf({ type: 'Béni', subType: 'Sigmar' })).toBeNull();
  });
  it('talent Magie des Arcanes (X) détecté', () => {
    const c = mk({ talents: [{ name: 'Magie des Arcanes (Feu)', times: 1 }] as Combatant['talents'] });
    expect(hasArcaneTalent(c, 'Feu')).toBe(true);
    expect(hasArcaneTalent(c, 'Cieux')).toBe(false);
  });
});

describe('Métal / Cieux / Ombres — mitigation des Projectiles (LDB 48 l.87/302/482)', () => {
  it('Métal : ignore les PA métalliques ET les ajoute en Dégâts', () => {
    const t = mk({ items: [mail(3), leather(1)], armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } as Combatant['armour'] });
    expect(metalAPAt(t, 'corps')).toBe(3);
    const mods = domainMissileMods(t, { type: 'Magie des Arcanes', subType: 'Métal' }, 'corps', 4);
    expect(mods).toEqual({ apIgnored: 3, bonusDamage: 3 });
  });
  it('Cieux : ignore les PA métalliques, sans bonus', () => {
    const t = mk({ items: [mail(3)], armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } as Combatant['armour'] });
    expect(domainMissileMods(t, { type: 'Magie des Arcanes', subType: 'Cieux' }, 'corps', 3)).toEqual({ apIgnored: 3, bonusDamage: 0 });
  });
  it('Ombres : ignore tous les PA non magiques — seuls les PA d’un effet actif (apAll) tiennent', () => {
    const t = mk({
      items: [mail(2)],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } as Combatant['armour'],
      activeEffects: [{ label: 'Armure Aethyrique', bonus: 0, roundsLeft: 5, apAll: 1 }],
    });
    expect(domainMissileMods(t, { type: 'Magie des Arcanes', subType: 'Ombres' }, 'corps', 3)).toEqual({ apIgnored: 2, bonusDamage: 0 });
  });
  it('evaluateMissile intègre l’attribut (Métal : +PA métal en Dégâts, PA métal ignorées)', () => {
    const caster = mk({ id: 'w', name: 'Doré' }); // BFM 4
    const t = mk({ id: 't', items: [mail(3)], armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } as Combatant['armour'] });
    const spell = { label: 'Test Métal', type: 'Magie des Arcanes', subType: 'Métal', cn: 0, range: null, target: 1, duration: null, desc: 'Il s’agit d’un Projectile magique avec Dégâts +4.' };
    const cr = { cast: true, roll: 54, target: 60, sl: 2, isCritical: false, isFumble: false, log: 'ok' }; // jet inversé 45 → corps
    const r = evaluateMissile(caster, t, spell as never, cr as never);
    // Dégâts = 4 (sort) + 2 (DR) + 4 (BFM) + 3 (PA métal) = 13 ; mitigation = BE 3 + (PA 3 − 3 ignorées) = 3.
    expect(r.damage).toBe(13);
    expect(r.woundsLost).toBe(10);
  });
});

describe('Riders post-lancement (Feu / Lumière / Mort / Vie)', () => {
  const spellOf = (d: string) => ({ type: 'Magie des Arcanes', subType: d });
  it('Feu : +1 En flammes à la cible adverse, sauf Talent Magie des Arcanes (Feu)', () => {
    const w = mk({ id: 'w' });
    const t = mk({ id: 't' });
    domainOnHitRiders(w, t, spellOf('Feu'), true);
    expect(hasCondition(t, 'En flammes')).toBe(true);
    const immune = mk({ id: 'i', talents: [{ name: 'Magie des Arcanes (Feu)', times: 1 }] as Combatant['talents'] });
    domainOnHitRiders(w, immune, spellOf('Feu'), true);
    expect(hasCondition(immune, 'En flammes')).toBe(false);
    const ally = mk({ id: 'a' });
    domainOnHitRiders(w, ally, spellOf('Feu'), false); // « vous pouvez » — pas sur un allié
    expect(hasCondition(ally, 'En flammes')).toBe(false);
  });
  it('Lumière : Aveuglé + frappe BInt ignorant BE/PA sur un Mort-vivant', () => {
    const w = mk({ id: 'w' }); // BInt 4
    const z = mk({ id: 'z', traits: ['Mort-vivant'], wounds: { current: 10, max: 10 } as Combatant['wounds'] });
    const lines = domainOnHitRiders(w, z, spellOf('Lumière'), true);
    expect(hasCondition(z, 'Aveuglé')).toBe(true);
    expect(z.wounds.current).toBe(6); // 4 = BInt, ignore BE+PA
    expect(lines.join(' ')).toMatch(/lumière pure/);
  });
  it('Mort : +1 Exténué aux vivants, UNE seule fois (marqueur shyishExhausted)', () => {
    const w = mk({ id: 'w' });
    const t = mk({ id: 't' });
    domainOnHitRiders(w, t, spellOf('Mort'), true);
    domainOnHitRiders(w, t, spellOf('Mort'), true);
    expect(stacks(t, 'Exténué')).toBe(1);
    const z = mk({ id: 'z', traits: ['Mort-vivant'] });
    expect(isLiving(z)).toBe(false);
    domainOnHitRiders(w, z, spellOf('Mort'), true);
    expect(stacks(z, 'Exténué')).toBe(0); // « cible vivante » seulement
  });
  it('Vie : purge Exténué/Hémorragique des vivants ; +BFM ignore BE/PA aux Morts-vivants', () => {
    const w = mk({ id: 'w' }); // BFM 4
    const ally = mk({ id: 'a' });
    addCondition(ally, 'Exténué', 2);
    addCondition(ally, 'Hémorragique', 3);
    domainOnHitRiders(w, ally, spellOf('Vie'), false);
    expect(stacks(ally, 'Exténué')).toBe(0);
    expect(stacks(ally, 'Hémorragique')).toBe(0);
    const z = mk({ id: 'z', traits: ['Mort-vivant'], wounds: { current: 10, max: 10 } as Combatant['wounds'] });
    domainOnHitRiders(w, z, spellOf('Vie'), true);
    expect(z.wounds.current).toBe(6);
  });
});

describe('Bête — Peur 1 pour 1d10 Rounds après un Sort de la Bête réussi (LDB 48 l.9)', () => {
  it('pose le Trait + l’effet porteur à la durée tirée', () => {
    const w = mk({ id: 'w', traits: [] });
    const lines = ghurFearAfterCast(w, { type: 'Magie des Arcanes', subType: 'Bête' }, seq([7]));
    expect(w.traits).toContain('Peur 1');
    expect(w.activeEffects?.[0]).toMatchObject({ grantedTrait: 'Peur 1', roundsLeft: 7 });
    expect(lines.join(' ')).toMatch(/Peur 1 pendant 7/);
  });
  it('aucun effet pour un autre Domaine', () => {
    const w = mk({ id: 'w' });
    expect(ghurFearAfterCast(w, { type: 'Magie des Arcanes', subType: 'Feu' }, seq([7]))).toEqual([]);
  });
});
