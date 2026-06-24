import { describe, it, expect } from 'vitest';
import { rotateDir8 } from './dir8';
import { inFireArc, targetArc } from './fireArc';
import { resolveShipManeuver } from '../engine/shipNavigation';
import { useGame } from './store';
import type { Combatant } from '../engine/types';

/**
 * Phase 2 « Manœuvre du navire » (MDG ch.13). Le cœur PUR : tourner le cap (`rotateDir8`) RE-MAPPE d'un coup
 * tous les arcs de bordée (la cible change de côté), et `resolveShipManeuver` dit si le virage réussit.
 */
describe('rotateDir8 — rotation du cap', () => {
  it('vire tribord (horaire, steps>0) / bâbord (anti-horaire, steps<0) par crans de 45°', () => {
    expect(rotateDir8('N', 2)).toBe('E'); // 90° à droite (tribord)
    expect(rotateDir8('N', -2)).toBe('O'); // 90° à gauche (bâbord)
    expect(rotateDir8('N', 1)).toBe('NE');
    expect(rotateDir8('N', -1)).toBe('NO');
    expect(rotateDir8('E', 4)).toBe('O'); // demi-tour
    expect(rotateDir8('NO', 1)).toBe('N'); // wrap horaire
    expect(rotateDir8('N', 0)).toBe('N');
  });
});

describe('Manœuvre → re-mapping des bordées (aligner / désaligner sa bordée)', () => {
  const ship = { x: 5, y: 5 };
  const east = { x: 9, y: 5 }; // cible plein EST du navire

  it('cap Nord : la cible plein est tombe dans la bordée TRIBORD', () => {
    expect(targetArc('N', ship, east)).toBe('tribord');
    expect(inFireArc('tribord', 'N', ship, east)).toBe(true);
  });

  it('virer tribord (N → E) SORT la cible de la bordée tribord (elle passe en PROUE)', () => {
    const h = rotateDir8('N', 2); // 'E'
    expect(targetArc(h, ship, east)).toBe('proue');
    expect(inFireArc('tribord', h, ship, east)).toBe(false); // la bordée tribord ne porte plus
  });

  it('virer bâbord (N → O) met la cible plein est DERRIÈRE (poupe), hors des deux bordées', () => {
    expect(targetArc(rotateDir8('N', -2), ship, east)).toBe('poupe'); // 'O' : on s'est détourné de la cible
  });

  it('demi-tour (N → S) fait passer la cible de tribord à BÂBORD (bordée opposée)', () => {
    expect(targetArc(rotateDir8('N', 4), ship, east)).toBe('babord'); // 'S'
  });
});

describe('resolveShipManeuver — réussite & DR final (MDG ch.13 l.117-119)', () => {
  it('DR final = DR du Test de Navigation + Man + extra ; réussite si ≥ 0', () => {
    expect(resolveShipManeuver(2, 5, -1).dr).toBe(1); // 2 + (-1) + 0
    expect(resolveShipManeuver(2, 5, -1).success).toBe(true);
    expect(resolveShipManeuver(0, 5, -1).success).toBe(false); // 0 - 1 = -1 < 0
  });
});

describe('shipTurn (action store) — vire le cap, branché aux arcs', () => {
  const ship = (): Combatant =>
    ({ id: 'ship', name: 'Cogue', kind: 'enemy', pos: { x: 5, y: 5 }, conditions: [], weapons: [] }) as unknown as Combatant;

  it('vire tribord 90° (N → E)', () => {
    useGame.setState({ battle: { combatants: [ship()], order: ['ship'], turn: 0 } as never, facing: { ship: 'N' } });
    useGame.getState().shipTurn('ship', 2);
    expect(useGame.getState().facing.ship).toBe('E'); // firedAttackBlock/targeting reliront ce cap → arcs re-mappés
  });

  it('vire bâbord 90° (N → O)', () => {
    useGame.setState({ battle: { combatants: [ship()], order: ['ship'], turn: 0 } as never, facing: { ship: 'N' } });
    useGame.getState().shipTurn('ship', -2);
    expect(useGame.getState().facing.ship).toBe('O');
  });

  it('navire sans cap → no-op (aucun virage fantôme)', () => {
    useGame.setState({ battle: { combatants: [], order: [], turn: 0 } as never, facing: {} });
    useGame.getState().shipTurn('ghost', 2);
    expect(useGame.getState().facing.ghost).toBeUndefined();
  });
});
