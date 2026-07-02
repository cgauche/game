import { describe, it, expect } from 'vitest';
import { prayerSinLock, priestCult, type SpellLike } from './magic';
import { findGodById } from '../data';
import type { Combatant } from './types';

/**
 * VERROU de Péché des cultes (MDG 11 l.142, verbatim) : « Stromfels retire à un suivant la capacité
 * d'utiliser le Talent *Invocation* s'il possède au moins deux Points de Péché et celle d'utiliser le
 * Talent *Béni* s'il possède au moins cinq Points de Péché. » — champ GÉNÉRIQUE `GodData.sinLocks`
 * (aucun culte LDB n'en porte : LDB 40 ne connaît que la Colère au dé des unités), consommé par le
 * flux de Prière (`castSpell`/`castZoneSpell` → refus AVANT la modale).
 */
const priest = (cult: string, sin: number, kind: 'beni' | 'invocation' = 'invocation'): Combatant =>
  ({
    id: 'p1', name: 'Prêtre', kind: 'hero', sinPoints: sin,
    talents: [{ talentId: kind, spec: cult, times: 1 }],
    skills: [], characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, weapons: [], movement: 4,
  }) as unknown as Combatant;

const miracle: SpellLike = { label: 'Lame de fond', type: 'Miracle', cn: null, desc: '', isPrayer: true, family: 'invocation' };
const blessing: SpellLike = { label: 'Bénédiction de Bataille', type: 'Bénédiction', cn: null, desc: '', isPrayer: true, family: 'beni' };
const arcane: SpellLike = { label: 'Trait', type: 'Sort', cn: 0, desc: '', family: 'arcane' };

describe('Gating Péché des cultes (MDG 11 l.142 — Stromfels, GodData.sinLocks)', () => {
  it('la donnée Stromfels porte le verrou RAW : Invocation ≥ 2, Béni ≥ 5', () => {
    expect(findGodById('Stromfels')?.sinLocks).toEqual({ invocation: 2, beni: 5 });
  });

  it('priestCult lit la spec du Talent de Prière (data-driven, castingKind)', () => {
    expect(priestCult(priest('Stromfels', 0))).toBe('Stromfels');
    expect(priestCult(priest('Sigmar', 0, 'beni'))).toBe('Sigmar');
  });

  it('Invocation verrouillée dès 2 Points de Péché (pas à 1)', () => {
    expect(prayerSinLock(priest('Stromfels', 1), miracle)).toBeNull();
    expect(prayerSinLock(priest('Stromfels', 2), miracle)).toEqual({ family: 'invocation', threshold: 2, cult: 'Stromfels' });
    expect(prayerSinLock(priest('Stromfels', 7), miracle)).toEqual({ family: 'invocation', threshold: 2, cult: 'Stromfels' });
  });

  it('Béni verrouillé dès 5 Points de Péché (pas à 4) — le prêtre à 4 Péchés garde ses Bénédictions', () => {
    const p = priest('Stromfels', 4, 'beni');
    expect(prayerSinLock(p, blessing)).toBeNull();
    expect(prayerSinLock(priest('Stromfels', 5, 'beni'), blessing)).toEqual({ family: 'beni', threshold: 5, cult: 'Stromfels' });
  });

  it('un culte SANS sinLocks (Sigmar, LDB) ne verrouille jamais ; un Sort arcanique n’est jamais gaté', () => {
    expect(prayerSinLock(priest('Sigmar', 9, 'beni'), blessing)).toBeNull();
    expect(prayerSinLock(priest('Stromfels', 9), arcane)).toBeNull();
  });
});
