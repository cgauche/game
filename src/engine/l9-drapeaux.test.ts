import { describe, expect, it } from 'vitest';
import type { Combatant, ItemInstance } from './types';
import type { RNG } from './dice';
import { hasActiveFlag, consumeActiveFlag } from './activeFlags';
import { applyOps } from './ops';
import { addCondition, hasCondition, combatTestPenalty, testStatePenalty, endOfRound } from './conditions';
import { rollCritical } from './critical';
import { MIRACLES_SHALLYA } from '../data/spellspecs/miracles-shallya';
import { BENEDICTIONS } from '../data/spellspecs/benedictions';

/** RNG scripté : renvoie les valeurs dans l'ordre (padding 5). */
function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] ?? 5 } as RNG;
}

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'Cobaye', kind: 'hero', size: 'moyenne', advantage: 0,
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 40, Soc: 30 },
    conditions: [], skills: [], talents: [], traits: [], groups: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, wounds: { current: 12, max: 12 },
    ...over,
  } as unknown as Combatant;
}

describe('activeFlags — drapeaux portés par un ActiveEffect (Jalon 2.6 L9)', () => {
  it('hasActiveFlag : faux sans effet, vrai avec un effet porteur', () => {
    const c = mk();
    expect(hasActiveFlag(c, 'freeReroll')).toBe(false);
    c.activeEffects = [{ label: 'Bénédiction de Chance', bonus: 0, roundsLeft: 6, freeReroll: true }];
    expect(hasActiveFlag(c, 'freeReroll')).toBe(true);
    expect(hasActiveFlag(c, 'critRollTwice')).toBe(false);
  });
  it('consumeActiveFlag : retire UNE instance et rend son label ; null si absent', () => {
    const c = mk();
    c.activeEffects = [
      { label: 'Bénédiction de Chance', bonus: 0, roundsLeft: 6, freeReroll: true },
      { label: 'Autre buff', bonus: 10, char: 'CC', roundsLeft: 6 },
    ];
    expect(consumeActiveFlag(c, 'freeReroll')).toBe('Bénédiction de Chance');
    expect(c.activeEffects).toHaveLength(1);
    expect(consumeActiveFlag(c, 'freeReroll')).toBeNull();
  });
});

describe("Endurance de l'anachorète — « ne subit aucune pénalité causée par les États » (LDB 42)", () => {
  it('combatTestPenalty : pénalités d’États annulées sous le drapeau (Sonné + Exténué)', () => {
    const c = mk();
    addCondition(c, 'Sonné');
    addCondition(c, 'Exténué', 2);
    expect(combatTestPenalty(c)).toBe(-20);
    c.activeEffects = [{ label: 'Endurance de l’anachorète', bonus: 0, roundsLeft: 3, ignoreStatePenalties: true }];
    expect(combatTestPenalty(c)).toBe(0);
  });
  it('combatTestPenalty : l’aura Perturbante (trait, pas un État) n’est PAS annulée', () => {
    const c = mk();
    addCondition(c, 'Sonné');
    (c as Combatant & { perturbed?: boolean }).perturbed = true;
    c.activeEffects = [{ label: 'Endurance', bonus: 0, roundsLeft: 3, ignoreStatePenalties: true }];
    expect(combatTestPenalty(c)).toBe(-20);
  });
  it('testStatePenalty : annulée sous le drapeau (Empoisonné, déplacement À Terre)', () => {
    const c = mk();
    addCondition(c, 'Empoisonné');
    addCondition(c, 'À Terre');
    expect(testStatePenalty(c, 'Athlétisme')).toBe(-20);
    c.activeEffects = [{ label: 'Endurance', bonus: 0, roundsLeft: 3, ignoreStatePenalties: true }];
    expect(testStatePenalty(c, 'Athlétisme')).toBe(0);
  });
  it("op ignoreStatePenalties : pose l'effet actif à la durée du sort + journal", () => {
    const c = mk();
    const lines = applyOps(c, [{ op: 'ignoreStatePenalties' }], { label: 'Endurance de l’anachorète', defaultDurationRounds: 3 });
    expect(c.activeEffects?.[0]).toMatchObject({ label: 'Endurance de l’anachorète', ignoreStatePenalties: true, roundsLeft: 3 });
    expect(lines.join(' ')).toMatch(/pénalité d'État|pénalités d'État/i);
  });
  it('spec curée : Endurance de l’anachorète porte l’op (plus de narrative seul)', () => {
    const spec = MIRACLES_SHALLYA.find((s) => s.label === "Endurance de l'anachorète")!;
    expect(spec.ops.some((o) => o.op === 'ignoreStatePenalties')).toBe(true);
  });
});

describe('Sommeil — « Si la cible possède un État À Terre, elle gagne Inconscient » (LDB 47 p.242)', () => {
  it('onlyIfCondition : cible À Terre → Inconscient pour la durée du sort (BFM du lanceur)', () => {
    const caster = mk({ id: 'w', name: 'Sorcier' });
    const target = mk({ id: 't', name: 'Cible' });
    addCondition(target, 'À Terre');
    applyOps(target, [{ op: 'condition', name: 'Inconscient', durationRounds: { bonusOf: 'FM' }, onlyIfCondition: 'À Terre' }], { caster, label: 'Sommeil' });
    expect(hasCondition(target, 'Inconscient')).toBe(true);
    expect(target.conditions.find((x) => x.name === 'Inconscient')?.roundsLeft).toBe(4); // BFM 40 → 4
  });
  it('onlyIfCondition : cible debout → PAS d’Inconscient ; unlessCondition pose À Terre à la place', () => {
    const caster = mk({ id: 'w' });
    const target = mk({ id: 't' });
    applyOps(target, [
      { op: 'condition', name: 'Inconscient', durationRounds: { bonusOf: 'FM' }, onlyIfCondition: 'À Terre' },
      { op: 'condition', name: 'À Terre', unlessCondition: 'À Terre' },
    ], { caster, label: 'Sommeil' });
    expect(hasCondition(target, 'Inconscient')).toBe(false);
    expect(hasCondition(target, 'À Terre')).toBe(true);
  });
  it('unlessCondition : cible déjà À Terre → l’op À Terre ne double pas l’État', () => {
    const caster = mk({ id: 'w' });
    const target = mk({ id: 't' });
    addCondition(target, 'À Terre');
    applyOps(target, [{ op: 'condition', name: 'À Terre', unlessCondition: 'À Terre' }], { caster, label: 'Sommeil' });
    expect(target.conditions.filter((x) => x.name === 'À Terre')).toHaveLength(1);
    expect(target.conditions.find((x) => x.name === 'À Terre')?.value).toBe(1);
  });
});

describe('Bénédiction de Sauvagerie — « deux lancers, choisissez le meilleur » (LDB 41)', () => {
  it('rollCritical(twice) : garde le plus sévère des deux d100', () => {
    const single = rollCritical(mk(), 'corps', seq([15]), 0);
    const double = rollCritical(mk(), 'corps', seq([15, 85]), 0, true);
    expect(single.roll).toBe(15);
    expect(double.roll).toBe(85);
  });
  it('rollCritical(twice) : l’ordre des tirages est indifférent (max)', () => {
    const r = rollCritical(mk(), 'corps', seq([85, 15]), 0, true);
    expect(r.roll).toBe(85);
  });
  it('spec curée : Bénédiction de Sauvagerie porte l’op critTwice', () => {
    const spec = BENEDICTIONS.find((s) => s.label === 'Bénédiction de Sauvagerie')!;
    expect(spec.ops.some((o) => o.op === 'critTwice')).toBe(true);
  });
  it('spec curée : Bénédiction de Chance porte l’op freeReroll', () => {
    const spec = BENEDICTIONS.find((s) => s.label === 'Bénédiction de Chance')!;
    expect(spec.ops.some((o) => o.op === 'freeReroll')).toBe(true);
  });
});

describe('Baume pour un esprit blessé — « Tous les Traits Psychologiques sont retirés pour la durée » (LDB 42)', () => {
  it('op suppressPsych : déplace psychTraits dans l’effet porteur et purge psychState', () => {
    const c = mk({
      psychTraits: [{ type: 'animosite', cible: 'Elfes' }, { type: 'phobie', cible: 'Serpents', indice: 1 }],
      psychState: [{ type: 'animosite', cible: 'Elfes', active: true }],
    });
    const lines = applyOps(c, [{ op: 'suppressPsych' }], { label: 'Baume pour un esprit blessé', defaultDurationRounds: 9999, defaultUntilTime: 120 });
    expect(c.psychTraits).toEqual([]);
    expect(c.psychState).toEqual([]);
    const eff = c.activeEffects?.find((e) => e.suppressedPsych);
    expect(eff?.suppressedPsych).toHaveLength(2);
    expect(eff?.untilTime).toBe(120);
    expect(lines.join(' ')).toMatch(/Traits? psychologiques?/i);
  });
  it('expiration en fin de Round : les Traits psy suspendus sont restitués', () => {
    const c = mk({ psychTraits: [{ type: 'haine', cible: 'Skavens' }] });
    applyOps(c, [{ op: 'suppressPsych' }], { label: 'Baume', defaultDurationRounds: 1 });
    expect(c.psychTraits).toEqual([]);
    endOfRound(c); // l'effet expire (1 round) → restitution
    expect(c.psychTraits).toEqual([{ type: 'haine', cible: 'Skavens' }]);
    expect(c.activeEffects?.some((e) => e.suppressedPsych)).toBe(false);
  });
  it('cible sans Trait psy : journal honnête, pas d’effet porteur', () => {
    const c = mk();
    const lines = applyOps(c, [{ op: 'suppressPsych' }], { label: 'Baume', defaultDurationRounds: 3 });
    expect(c.activeEffects?.some((e) => e.suppressedPsych) ?? false).toBe(false);
    expect(lines.join(' ')).toMatch(/aucun Trait/i);
  });
  it('spec curée : Baume porte l’op suppressPsych', () => {
    const spec = MIRACLES_SHALLYA.find((s) => s.label === 'Baume pour un esprit blessé')!;
    expect(spec.ops.some((o) => o.op === 'suppressPsych')).toBe(true);
  });
});

describe("N'écoutez point la Sorcière — « −20 aux Tests de Langue (Magick) […] dans les (BSoc) mètres » (LDB 42)", () => {
  it('op castWard : pose l’aura au rayon BSoc, élargie de +BSoc par +2 DR', () => {
    const priest = mk({ id: 'p', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 40 } as Combatant['characteristics'] });
    applyOps(priest, [
      { op: 'castWard', radius: { bonusOf: 'Soc' }, perSL: { every: 2, radiusFormula: { bonusOf: 'Soc' } } },
    ], { caster: priest, label: 'N’écoutez point la Sorcière', defaultDurationRounds: 4, sl: 4 });
    const eff = priest.activeEffects?.find((e) => e.castWard);
    expect(eff?.castWard?.radiusMeters).toBe(4 + 2 * 4); // BSoc 4 + 2 paliers (+2 DR) × BSoc
    expect(eff?.roundsLeft).toBe(4);
  });
  it('sans DR excédentaire : rayon de base seul', () => {
    const priest = mk({ id: 'p', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 40 } as Combatant['characteristics'] });
    applyOps(priest, [
      { op: 'castWard', radius: { bonusOf: 'Soc' }, perSL: { every: 2, radiusFormula: { bonusOf: 'Soc' } } },
    ], { caster: priest, label: 'N’écoutez point la Sorcière', defaultDurationRounds: 4, sl: 0 });
    expect(priest.activeEffects?.find((e) => e.castWard)?.castWard?.radiusMeters).toBe(4);
  });
});

describe('Putréfaction — « le cuir se racornit (perdant 1 PA à 1 Localisation) » (LDB 47)', () => {
  const leather = (over: Partial<ItemInstance> = {}): ItemInstance => ({
    uid: 'a1', name: 'Armure de cuir souple', kind: 'armor', pa: 1, locs: ['corps'], equipped: true, enc: 1, qualities: [], ...over,
  } as unknown as ItemInstance);
  it('endommage de 1 PA une pièce de cuir portée (et re-dérive l’armure)', () => {
    const c = mk({ items: [leather()] });
    const lines = applyOps(c, [{ op: 'damageArmour', material: 'cuir' }], { label: 'Putréfaction' });
    expect(c.items![0].damageTaken).toBe(1);
    expect(lines.join(' ')).toMatch(/racornit|pourrit/i);
  });
  it('sans cuir porté : rien d’endommagé, journal honnête', () => {
    const c = mk();
    const lines = applyOps(c, [{ op: 'damageArmour', material: 'cuir' }], { label: 'Putréfaction' });
    expect(lines.join(' ')).toMatch(/pas de cuir|aucun cuir/i);
  });
});
