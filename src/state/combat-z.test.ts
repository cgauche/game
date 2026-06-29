import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { combatDistance, footprintChebyshev } from './footprint';
import { occupied } from './combatGeometry';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { BattleState } from './store';
import type { Combatant } from '../engine/types';
import type { SizeCategory } from '../engine/size';

/**
 * Combat z-aware — Lot 0-geom. Un défenseur sur une muraille (z=1) et un assaillant au sol (z=0) ne
 * sont PAS traités comme superposés. DISCIPLINE : le chemin z=0 reste byte-identique (z OMIS, pas `z:0`).
 */
const mk = (id: string, x: number, y: number, z?: number, size?: SizeCategory): Combatant =>
  ({ id, name: id, pos: z ? { x, y, z } : { x, y }, size, wounds: { current: 10, max: 10, base: 10 }, conditions: [] }) as unknown as Combatant;
const battle = (cs: Combatant[]): BattleState => ({ combatants: cs }) as unknown as BattleState;

describe('combatDistance — séparation verticale (TILES_PER_LEVEL = 4 m ÷ 2 m/case = 2)', () => {
  it('même (x,y), Δz=1 → 2 (pas 0 : pas au contact, atteignable au tir)', () => {
    expect(combatDistance(mk('a', 5, 5), mk('b', 5, 5, 1))).toBe(2);
  });

  it('Δz=0 (coplanaire) → byte-identique à la distance d’empreinte 2D', () => {
    const a = mk('a', 0, 0), b = mk('b', 3, 4);
    expect(combatDistance(a, b)).toBe(footprintChebyshev(a.pos!, 1, b.pos!, 1)); // 4
    expect(combatDistance(a, b)).toBe(4);
  });

  it('(x,y) adjacents + Δz=1 → max(1, 2) = 2 (le terme vertical domine)', () => {
    expect(combatDistance(mk('a', 5, 5), mk('b', 6, 5, 1))).toBe(2);
  });

  it('non posé → Infinity (inchangé)', () => {
    const a = mk('a', 0, 0);
    const ghost = { id: 'g', name: 'g', conditions: [] } as unknown as Combatant;
    expect(combatDistance(a, ghost)).toBe(Infinity);
  });
});

describe('occupied — un bloqueur n’occupe que SON étage', () => {
  it('un combattant z=1 n’apparaît PAS dans l’ensemble bloquant d’un mover z=0 (on passe dessous)', () => {
    const mover = mk('m', 5, 5);       // sol
    const upper = mk('u', 5, 5, 1);    // étage 1, MÊME (x,y)
    const blocked = occupied(battle([mover, upper]), mover);
    expect(blocked.has('5,5')).toBe(false);   // invisible au sol (clé « x,y » non présente)
    expect(blocked.has('5,5,1')).toBe(true);  // mais bien occupée à l’étage 1 (clé « x,y,z »)
  });

  it('deux combattants z=0 se bloquent comme avant (clé « x,y » sans suffixe)', () => {
    const a = mk('a', 0, 0);
    const z0 = mk('z', 5, 5);
    expect(occupied(battle([a, z0]), a).has('5,5')).toBe(true);
  });
});

describe('spawn — la SceneEntity.z se propage en Combatant.pos.z', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('une entité enrôlée à z:1 → son Combattant a pos.z===1 ; un ennemi au sol n’a PAS de z', () => {
    useGame.getState().seedRng(1);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    const scene = structuredClone(testScene);
    const ent = scene.entities.find((e) => e.id === 'enemy-enc-mutants-0')!;
    ent.z = 1; // posté sur une muraille
    useGame.getState().startScene(scene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'enemy-enc-mutants-0')!.pos?.z).toBe(1);
    expect(b.combatants.find((c) => c.id === 'enemy-enc-mutants-1')!.pos?.z).toBeUndefined(); // sol = byte-identique
  });
});
