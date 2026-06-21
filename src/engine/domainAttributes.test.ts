/**
 * Attributs de Domaine (LDB 48, intros des 8 Couleurs — L14). Citations dans domainAttributes.ts.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant, ItemInstance } from './types';
import type { RNG } from './dice';
import { hasArcaneTalent, metalAPAt, domainMissileMods, domainOnHitEffects, domainAfterCast, isLiving } from './domainAttributes';
import { evaluateMissile } from './magic';
import { hasCondition, stacks, addCondition } from './conditions';
import { runSpellFlowLines } from '../state/combatEffects';
import { applyTriggeredEffects } from '../state/triggeredEffects';
import type { Get } from '../state/flowTypes';

/** Applique les riders onHit AUTHORÉS d'un Domaine à `target` (gating par les Conditions Flow, contre
 *  les vues d'acteur du lanceur/cible). `caster` adverse = camp ≠ (hero vs enemy). `domainId` = id STABLE. */
const applyDomain = (caster: Combatant, target: Combatant, domainId: string, rng: RNG = seq([])): string[] => {
  const lines: string[] = [];
  for (const eff of domainOnHitEffects({ domainId })) lines.push(...runSpellFlowLines(target, caster, eff.flow, { rng, caster }));
  return lines;
};

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

describe('hasArcaneTalent', () => {
  it('talent Magie des Arcanes (X) détecté', () => {
    const c = mk({ talents: [{ talentId: 'magie-des-arcanes', spec: 'Feu', times: 1 }] as Combatant['talents'] });
    expect(hasArcaneTalent(c, 'Feu')).toBe(true);
    expect(hasArcaneTalent(c, 'Cieux')).toBe(false);
  });
});

describe('Métal / Cieux / Ombres — mitigation des Projectiles (LDB 48 l.87/302/482)', () => {
  it('Métal : ignore les PA métalliques ET les ajoute en Dégâts', () => {
    const t = mk({ items: [mail(3), leather(1)], armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } as Combatant['armour'] });
    expect(metalAPAt(t, 'corps')).toBe(3);
    const mods = domainMissileMods(t, { domainId: 'metal' }, 'corps', 4);
    expect(mods).toEqual({ apIgnored: 3, bonusDamage: 3 });
  });
  it('Cieux : ignore les PA métalliques, sans bonus', () => {
    const t = mk({ items: [mail(3)], armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } as Combatant['armour'] });
    expect(domainMissileMods(t, { domainId: 'cieux' }, 'corps', 3)).toEqual({ apIgnored: 3, bonusDamage: 0 });
  });
  it('Ombres : ignore tous les PA non magiques — seuls les PA d’un effet actif (apAll) tiennent', () => {
    const t = mk({
      items: [mail(2)],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } as Combatant['armour'],
      activeEffects: [{ label: 'Armure Aethyrique', bonus: 0, roundsLeft: 5, apAll: 1 }],
    });
    expect(domainMissileMods(t, { domainId: 'ombres' }, 'corps', 3)).toEqual({ apIgnored: 2, bonusDamage: 0 });
  });
  it('evaluateMissile intègre l’attribut (Métal : +PA métal en Dégâts, PA métal ignorées)', () => {
    const caster = mk({ id: 'w', name: 'Doré' }); // BFM 4
    const t = mk({ id: 't', items: [mail(3)], armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } as Combatant['armour'] });
    const spell = { label: 'Test Métal', type: 'Magie des Arcanes', subType: 'Métal', domainId: 'metal', missile: true, damage: 4, cn: 0, range: null, target: 1, duration: null, desc: 'Il s’agit d’un Projectile magique avec Dégâts +4.' };
    const cr = { cast: true, roll: 54, target: 60, sl: 2, isCritical: false, isFumble: false, log: 'ok' }; // jet inversé 45 → corps
    const r = evaluateMissile(caster, t, spell as never, cr as never);
    // Dégâts = 4 (sort) + 2 (DR) + 4 (BFM) + 3 (PA métal) = 13 ; mitigation = BE 3 + (PA 3 − 3 ignorées) = 3.
    expect(r.damage).toBe(13);
    expect(r.woundsLost).toBe(10);
  });
});

describe('Riders « à la touche » data-driven (Feu / Lumière / Mort / Vie) — gating par Conditions Flow', () => {
  it('Feu : +1 En flammes à la cible adverse, sauf Talent (Feu) ; pas sur un allié', () => {
    const w = mk({ id: 'w', kind: 'hero' });
    const t = mk({ id: 't', kind: 'enemy' });
    applyDomain(w, t, 'feu');
    expect(hasCondition(t, 'en-flammes')).toBe(true);
    const immune = mk({ id: 'i', kind: 'enemy', talents: [{ talentId: 'magie-des-arcanes', spec: 'Feu', times: 1 }] as Combatant['talents'] });
    applyDomain(w, immune, 'feu');
    expect(hasCondition(immune, 'en-flammes')).toBe(false);
    const ally = mk({ id: 'a', kind: 'hero' }); // même camp que le lanceur → pas adversaire
    applyDomain(w, ally, 'feu');
    expect(hasCondition(ally, 'en-flammes')).toBe(false);
  });
  it('Lumière : Aveuglé + frappe BInt ignorant BE/PA sur un Mort-vivant', () => {
    const w = mk({ id: 'w', kind: 'hero' }); // BInt 4
    const z = mk({ id: 'z', kind: 'enemy', traits: [{ id: 'mort-vivant' }], wounds: { current: 10, max: 10 } as Combatant['wounds'] });
    applyDomain(w, z, 'lumiere');
    expect(hasCondition(z, 'aveugle')).toBe(true);
    expect(z.wounds.current).toBe(6); // 4 = BInt, ignore BE+PA
  });
  it('Mort : +1 Exténué aux vivants adverses, UNE seule fois (pas déjà Exténué)', () => {
    const w = mk({ id: 'w', kind: 'hero' });
    const t = mk({ id: 't', kind: 'enemy' });
    applyDomain(w, t, 'mort');
    applyDomain(w, t, 'mort');
    expect(stacks(t, 'extenue')).toBe(1);
    const z = mk({ id: 'z', kind: 'enemy', traits: [{ id: 'mort-vivant' }] });
    expect(isLiving(z)).toBe(false);
    applyDomain(w, z, 'mort');
    expect(stacks(z, 'extenue')).toBe(0); // « cible vivante » seulement
  });
  it('Vie : purge Exténué/Hémorragique des vivants ; +BFM ignore BE/PA aux Morts-vivants', () => {
    const w = mk({ id: 'w', kind: 'hero' }); // BFM 4
    const ally = mk({ id: 'a', kind: 'hero' });
    addCondition(ally, 'extenue', 2);
    addCondition(ally, 'hemorragique', 3);
    applyDomain(w, ally, 'vie');
    expect(stacks(ally, 'extenue')).toBe(0);
    expect(stacks(ally, 'hemorragique')).toBe(0);
    const z = mk({ id: 'z', kind: 'enemy', traits: [{ id: 'mort-vivant' }], wounds: { current: 10, max: 10 } as Combatant['wounds'] });
    applyDomain(w, z, 'vie');
    expect(z.wounds.current).toBe(6);
  });
});

describe('Cieux — arc d’Azyr (LDB 48 l.87) : géométrie on:{near} + bypass métal', () => {
  // « se dirigent vers toutes les autres cibles dans les 2 mètres, à l’exception de ceux possédant le
  //   Talent Magie des Arcanes (Cieux), infligeant un nombre de Dégâts égal à votre BFM ». L’effet est
  //   une GÉOMÉTRIE (`on:{near:'victim',radiusMeters:2}`) résolue par `applyTriggeredEffects` (≠ runSpellFlowLines
  //   direct des autres riders) : il faut un `battle` (positions) pour exercer le ciblage de zone + le bypass.
  const at = (over: Partial<Combatant>, x: number, y: number): Combatant =>
    mk({ ...over, pos: { x, y } } as Partial<Combatant>);

  it('arc vers les voisins (≤2 m) en perçant le métal ; épargne le Talent (Cieux), la victime, les lointains', () => {
    const caster = mk({ id: 'w', kind: 'hero', pos: { x: 0, y: 0 } } as Partial<Combatant>); // BFM 4
    const victim = at({ id: 'v', kind: 'enemy' }, 5, 5);
    // voisin en mailles (métal) : l’arc perce les PA métalliques → BFM(4) − BE(2) − 0 = 2 Blessures.
    const nearMail = at({ id: 'n', kind: 'enemy', items: [mail(4)],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } as Combatant['armour'],
      characteristics: { ...mk().characteristics, E: 20 } as Combatant['characteristics'] }, 6, 5);
    // voisin en cuir (non-métal) : rien n’est percé → BFM(4) − BE(2) − PA(4) = 0, l’armure tient.
    const nearLeather = at({ id: 'l', kind: 'enemy', items: [leather(4)],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } as Combatant['armour'],
      characteristics: { ...mk().characteristics, E: 20 } as Combatant['characteristics'] }, 5, 6);
    // voisin avec le Talent (Cieux) : exempté par la Condition Flow `has talent`.
    const nearTalent = at({ id: 't', kind: 'enemy',
      talents: [{ talentId: 'magie-des-arcanes', spec: 'Cieux', times: 1 }] as Combatant['talents'] }, 4, 5);
    const farFoe = at({ id: 'f', kind: 'enemy' }, 9, 5); // >2 m → hors arc

    const all = [caster, victim, nearMail, nearLeather, nearTalent, farFoe];
    const get = (() => ({ battle: { combatants: all } })) as unknown as Get;
    applyTriggeredEffects(get, caster, domainOnHitEffects({ domainId: 'cieux' }), 'onHit', { victim });

    expect(nearMail.wounds.current).toBe(10);   // 12 − 2 : métal percé
    expect(nearLeather.wounds.current).toBe(12); // armure non-métal intacte
    expect(nearTalent.wounds.current).toBe(12);  // Talent (Cieux) → exempté
    expect(victim.wounds.current).toBe(12);      // l’arc vise « les AUTRES cibles », pas la victime
    expect(farFoe.wounds.current).toBe(12);      // hors des 2 m
  });
});

describe('Bête — Peur 1 pour 1d10 Rounds après un Sort de la Bête réussi (LDB 48 l.9)', () => {
  it('pose le Trait + l’effet porteur à la durée tirée', () => {
    const w = mk({ id: 'w', traits: [] });
    const lines = domainAfterCast(w, { domainId: 'bete' }, seq([7]));
    expect(w.traits).toContainEqual({ id: 'peur', value: 1 });
    expect(w.activeEffects?.[0]).toMatchObject({ grantedTrait: { id: 'peur', value: 1 }, roundsLeft: 7 });
    expect(lines.join(' ')).toMatch(/Peur 1 pendant 7/);
  });
  it('aucun effet pour un autre Domaine', () => {
    const w = mk({ id: 'w' });
    expect(domainAfterCast(w, { domainId: 'feu' }, seq([7]))).toEqual([]);
  });
});
