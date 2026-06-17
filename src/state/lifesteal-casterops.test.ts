import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyCast } from './combatFlow';
import { makePregens } from '../data/pregens';
import { findSpell } from '../data';
import { applyZoneEffect } from '../engine/zones';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Combatant } from '../engine/types';

/**
 * Champs de SpellSpec B4 : `lifeSteal` (Projectile drainant — le lanceur récupère une fraction des
 * Blessures infligées), `casterOps` (effets sur le LANCEUR — Vol de vie retire son Exténué) et
 * `ZoneEffect.heal` (zone de soin récurrente — Sang de la Terre).
 */
const ok = (sl: number): CastResult => ({ cast: true, roll: 21, target: 70, sl, isCritical: false, isFumble: false, log: '' });

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingReveals: [] });
  useGame.getState().seedRng(7);
});

describe('Vol de vie — lifeSteal + casterOps', () => {
  it('le lanceur draine ⌈dégâts/2⌉ Blessures et perd son propre État Exténué', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    const cible = makePregens().find((h) => h.name === 'Sigmund Reikhardt')!;
    w.wounds.current = w.wounds.max - 6;
    w.conditions = [{ name: 'extenue', value: 1 }];
    useGame.setState({ party: [w, cible] as Combatant[] });
    const res: CastResult & Partial<MissileResult> = { ...ok(2), hit: true, location: 'corps', damage: 7, woundsLost: 5, defenderDefeated: false };
    const before = w.wounds.current;
    applyCast(useGame.getState, useGame.setState, w, cible, findSpell('Vol de vie')!, res, true, false);
    const wAfter = useGame.getState().party.find((h) => h.id === w.id)!;
    expect(wAfter.wounds.current).toBe(before + Math.ceil(5 / 2)); // vol de vie : +3
    expect(wAfter.conditions.find((c) => c.name === 'extenue')).toBeUndefined(); // casterOps a purgé l'Exténué du lanceur
  });
});

describe('Caresse de Laniph — lifeSteal ⌊dégâts/2⌋', () => {
  it('le lanceur récupère la moitié (arrondie au plancher) des Blessures infligées', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    const cible = makePregens().find((h) => h.name === 'Sigmund Reikhardt')!;
    w.wounds.current = w.wounds.max - 4;
    useGame.setState({ party: [w, cible] as Combatant[] });
    const res: CastResult & Partial<MissileResult> = { ...ok(1), hit: true, location: 'corps', damage: 6, woundsLost: 5, defenderDefeated: false };
    const before = w.wounds.current;
    applyCast(useGame.getState, useGame.setState, w, cible, findSpell('Caresse de Laniph')!, res, true, false);
    expect(useGame.getState().party.find((h) => h.id === w.id)!.wounds.current).toBe(before + Math.floor(5 / 2)); // +2
  });
});

describe('ZoneEffect.heal — Sang de la Terre', () => {
  it('rend (BFM) Blessures à qui stationne dans la zone, sans dépasser le max', () => {
    const caster = makePregens().find((h) => h.name === 'Wilhelmina Faust')!; // BFM connu via ses caracs
    const victim = { ...caster, id: 'v', name: 'V', wounds: { current: 5, max: 30 } } as Combatant;
    const bfm = Math.floor(caster.characteristics.FM / 10);
    const log = applyZoneEffect(victim, 'Sang de la Terre', { heal: { amount: { bonusOf: 'FM' } } }, caster);
    expect(victim.wounds.current).toBe(5 + bfm);
    expect(log.join(' ')).toContain('regagne');
  });
});
