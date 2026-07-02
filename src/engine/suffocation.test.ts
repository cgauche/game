/**
 * Noyade et Suffocation (LDB 18 l.424-425) : « Vous perdez 1 Point de blessure par Round que
 * vous passez à suffoquer. Si vos Points de blessure passent à 0, gagnez immédiatement l'État
 * Inconscient. Après cela, et au bout d'un nombre de Rounds égal à votre Bonus d'Endurance,
 * vous mourez par suffocation ou par noyade. »
 * Bénédiction de Souffle (LDB 41) : « n'a pas besoin de respirer et ignore les règles de suffocation ».
 */
import { describe, expect, it } from 'vitest';
import type { Combatant } from './types';
import { suffocationTick, prepareBreathHold, breathHoldSeconds } from './suffocation';
import { inDeathCondition, hasCondition } from './conditions';
import { applyOps } from './ops';
import { findSpell } from '../data';
import { spellOps } from '../state/flow';

/** Ops `on:'target'` d'un sort par label (les EFFETS vivent sur `SpellData.effects`, plus sur la spec). */
const opsOf = (label: string) => spellOps(findSpell(label)?.effects, 'target');

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'Noyé', kind: 'hero', size: 'moyenne', advantage: 0,
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    conditions: [], skills: [], talents: [], traits: [], groups: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, wounds: { current: 2, max: 12 },
    activeEffects: [{ label: 'Ombres étrangleuses', bonus: 0, duration: { scale: 'rounds', left: 8 }, suffocates: true }],
    ...over,
  } as unknown as Combatant;
}

describe('suffocationTick — Noyade et Suffocation (LDB 18 l.424-425)', () => {
  it('perd 1 PB par Round de suffocation', () => {
    const c = mk();
    suffocationTick(c);
    expect(c.wounds.current).toBe(1);
  });
  it('à 0 PB : Inconscient immédiat + compte à rebours de BE Rounds', () => {
    const c = mk({ wounds: { current: 1, max: 12 } });
    suffocationTick(c);
    expect(c.wounds.current).toBe(0);
    expect(hasCondition(c, 'inconscient')).toBe(true);
    expect(c.suffocationCountdown).toBe(3); // BE(30) = 3
  });
  it('après BE Rounds à 0 PB : condition de mort (canal mort-lente — Destin inclus)', () => {
    const c = mk({ wounds: { current: 1, max: 12 } });
    suffocationTick(c); // → 0 PB, Inconscient, compteur 3
    suffocationTick(c); // 2
    suffocationTick(c); // 1
    expect(inDeathCondition(c)).toBe(false);
    suffocationTick(c); // 0 → mort
    expect(inDeathCondition(c)).toBe(true);
  });
  it('Bénédiction de Souffle : « ignore les règles de suffocation » — aucun effet', () => {
    const c = mk();
    c.activeEffects!.push({ label: 'Bénédiction de Souffle', bonus: 0, duration: { scale: 'rounds', left: 6 }, noBreath: true });
    suffocationTick(c);
    expect(c.wounds.current).toBe(2);
  });
  it('la suffocation cesse (effet expiré) : le compte à rebours est annulé', () => {
    const c = mk({ wounds: { current: 1, max: 12 } });
    suffocationTick(c);
    expect(c.suffocationCountdown).toBe(3);
    c.activeEffects = []; // le sort expire — l'air revient
    suffocationTick(c);
    expect(c.suffocationCountdown).toBeUndefined();
    expect(inDeathCondition(c)).toBe(false);
  });
});

describe('Rétention de souffle (LDB 18 l.345) : BE×10 s avant suffocation si préparé', () => {
  it('BE×10 secondes de souffle (BE 3 → 30 s)', () => {
    expect(breathHoldSeconds(mk())).toBe(30);
  });
  it('privé d’air BRUTALEMENT (non préparé) : suffocation immédiate (perte de PB dès le 1ᵉʳ Round)', () => {
    const c = mk(); // pas de prepareBreathHold → suffoque tout de suite
    suffocationTick(c);
    expect(c.wounds.current).toBe(1);
  });
  it('préparé : aucune Blessure perdue tant que le souffle dure (30 s = 3 Rounds de 10 s)', () => {
    const c = mk();
    prepareBreathHold(c); // 30 s
    suffocationTick(c); // 20 s
    suffocationTick(c); // 10 s
    suffocationTick(c); // 0 s
    expect(c.wounds.current).toBe(2); // aucune Blessure perdue pendant l'apnée
    expect(c.breathHoldSeconds).toBe(0);
    suffocationTick(c); // plus d'air → suffocation
    expect(c.wounds.current).toBe(1);
  });
  it('l’air revient avant épuisement du souffle : le crédit d’apnée est purgé', () => {
    const c = mk();
    prepareBreathHold(c);
    suffocationTick(c);
    c.activeEffects = []; // remonte à la surface
    suffocationTick(c);
    expect(c.breathHoldSeconds).toBeUndefined();
  });
});

describe('Effets curés — suffocation (lus de SpellData.effects)', () => {
  it('Bénédiction de Souffle porte l’op noBreath', () => {
    expect(opsOf('Bénédiction de Souffle').some((o) => o.op === 'noBreath')).toBe(true);
  });
  it('Ombres étrangleuses : Exténué + suffocation + incantation coupée (« ne peuvent pas parler »)', () => {
    const ops = opsOf('Ombres étrangleuses');
    expect(ops.some((o) => o.op === 'suffocate')).toBe(true);
    expect(ops.some((o) => o.op === 'condition' && o.name === 'extenue')).toBe(true);
    expect(ops.some((o) => o.op === 'castPenalty' && o.blocked)).toBe(true);
  });
  it('Transmutation de Chamon : États persistants + 1 PA + suffocation', () => {
    const ops = opsOf('Transmutation de Chamon');
    expect(ops.some((o) => o.op === 'suffocate')).toBe(true);
    expect(ops.some((o) => o.op === 'ap')).toBe(true);
    for (const name of ['aveugle', 'assourdi', 'sonne']) {
      expect(ops.some((o) => o.op === 'condition' && o.name === name)).toBe(true);
    }
  });
  it('op suffocate : pose l’effet porteur à la durée du sort', () => {
    const c = mk({ activeEffects: [] });
    applyOps(c, [{ op: 'suffocate' }], { label: 'Ombres étrangleuses', defaultDurationRounds: 4 });
    expect(c.activeEffects?.find((e) => e.suffocates)?.duration).toEqual({ scale: "rounds", left: 4 });
  });
});
