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
import { tome1Intro } from '../scenes/tome1-intro';
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

describe('entretien de fin de Round — partition héros/ennemis (spec coop §4bis)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    seedBattleRng(7);
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero], battle: null, pendingReveals: [], pendingRoundStart: null });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
  });

  const crossRound = () => {
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.id.startsWith('hero') || c.kind === 'hero')!;
    useGame.setState({
      battle: { ...st.battle!, order: [H.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingRoundStart: null,
      pendingReveals: [],
    });
    useGame.getState().battleEndTurn(); // seul dans l'ordre → franchit le Round
    vi.advanceTimersByTime(3000);
  };

  it('États récurrents ENNEMIS seuls → pas de modale, mais le journal de combat les porte', () => {
    const st = useGame.getState();
    for (const c of st.battle!.combatants) if (c.kind === 'enemy') c.conditions.push({ name: 'Hémorragique', value: 1 });
    crossRound();
    const reveals = useGame.getState().pendingReveals.filter((r) => r.kind === 'round');
    expect(reveals).toHaveLength(0);
    expect(useGame.getState().battle!.log.some((e) => /Hémorragique|hémorragie|perd/i.test(e.text))).toBe(true);
  });

  it('État récurrent sur un HÉROS → modale de Round avec SA ligne, sans les lignes ennemies', () => {
    const st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    H.conditions.push({ name: 'Hémorragique', value: 1 });
    for (const c of st.battle!.combatants) if (c.kind === 'enemy') c.conditions.push({ name: 'Hémorragique', value: 1 });
    crossRound();
    const reveal = useGame.getState().pendingReveals.find((r) => r.kind === 'round');
    expect(reveal).toBeTruthy();
    expect(reveal!.lines.some((l) => l.includes(H.name))).toBe(true);
    expect(reveal!.lines.every((l) => l.includes(H.name) || !/Mutant/i.test(l))).toBe(true);
  });
});
