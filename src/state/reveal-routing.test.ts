/**
 * Routage des révélations témoin (arbitrage 2026-06-11, spec coop §4bis) : une modale ne
 * s'affiche que si un HÉROS est concerné (il subit ou inflige) — un Coup Critique purement
 * ennemi↔ennemi reste au journal/bandeau ; les révélations gardées portent leur gravité
 * (auto-fermeture : 'grave' = critique/mutation, 'minor' = entretien/informatif).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from './store';
import { applyCriticalToTarget } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';

const mkEnemy = (id: string): Combatant =>
  ({
    id, name: id, kind: 'enemy', size: 'moyenne',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12, base: 12 }, conditions: [], skills: [], talents: [], items: [],
    weapons: [], armour: {}, advantage: 0, traits: [], bodyShape: 'biped',
  }) as unknown as Combatant;

describe('routage des révélations (spec coop §4bis)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    seedBattleRng(7);
    useGame.setState({ pendingReveals: [], battle: null });
  });

  it('Critique ennemi↔ennemi → AUCUNE modale (journal seul)', () => {
    const log: string[] = [];
    applyCriticalToTarget(mkEnemy('e1'), 'corps', true, 0, log, useGame.setState, undefined,
      { attackerId: 'e2', attackerKind: 'enemy' });
    expect(useGame.getState().pendingReveals).toHaveLength(0);
    expect(log.length).toBeGreaterThan(0); // le détail vit dans le journal
  });

  it('un HÉROS inflige le Critique à un ennemi → modale (gravité grave)', () => {
    const log: string[] = [];
    applyCriticalToTarget(mkEnemy('e1'), 'corps', true, 0, log, useGame.setState, undefined,
      { attackerId: 'h1', attackerKind: 'hero' });
    const r = useGame.getState().pendingReveals;
    expect(r).toHaveLength(1);
    expect(r[0].severity).toBe('grave');
  });

  it('un HÉROS subit le Critique → modale (gravité grave)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(3) });
    const log: string[] = [];
    applyCriticalToTarget(hero, 'corps', true, 0, log, useGame.setState, undefined,
      { attackerId: 'e1', attackerKind: 'enemy' });
    expect(useGame.getState().pendingReveals).toHaveLength(1);
    expect(useGame.getState().pendingReveals[0].severity).toBe('grave');
  });
});
