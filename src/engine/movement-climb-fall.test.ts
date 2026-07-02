import { describe, it, expect } from 'vitest';
import { ladderClimbReach, resolveLadderClimb, resolveSurfaceClimb, resolveDeliberateFall } from './movement';
import { pursuitOutcome, resolveGroundPursuitRound, pursuitMoveBonus, PURSUIT_ESCAPE_DISTANCE, type PursuitParticipant } from './pursuit';
import type { RNG } from './dice';

/** RNG d100 → `roll` (le reste des int() renvoie `roll` aussi ; escalade/chute n'utilisent qu'un d100). */
const fixed = (roll: number): RNG => ({ int: () => roll });

describe('Escalade (LDB 15 l.52-57)', () => {
  it('échelle sans Test : ½ vitesse → M mètres avec le Mouvement du Round', () => {
    expect(ladderClimbReach(4)).toBe(4);
  });
  it('échelle rapide (Action + Escalade Accessible) : M + DR mètres (M4, réussite ample)', () => {
    const r = resolveLadderClimb(80, 4, fixed(1)); // 01 → réussite, DR élevé
    expect(r.success).toBe(true);
    expect(r.metres).toBeGreaterThanOrEqual(4); // au moins M
  });
  it('surface à prises : (½M + DR) mètres sur réussite, 0 sur échec', () => {
    const ok = resolveSurfaceClimb(80, 4, fixed(1)); // réussite
    expect(ok.metres).toBeGreaterThanOrEqual(2); // ½M(=2) + DR
    const ko = resolveSurfaceClimb(20, 4, fixed(99)); // échec
    expect(ko.metres).toBe(0);
  });
  it('surface exigeant Grimpeur, sans le Talent → escalade impossible', () => {
    const r = resolveSurfaceClimb(80, 4, fixed(1), { requiresGrimpeur: true, hasGrimpeur: false });
    expect(r.impossible).toBe(true);
    expect(r.metres).toBe(0);
  });
});

describe('Chute volontaire (LDB 15 l.82)', () => {
  it('réussite : −1 m de chute par DR', () => {
    const r = resolveDeliberateFall(80, 6, fixed(1)); // 01 → réussite, gros DR
    expect(r.success).toBe(true);
    expect(r.effectiveMetres).toBeLessThan(6);
  });
  it('DR suffisant → chute ramenée à 0 (aucun Dégât)', () => {
    const r = resolveDeliberateFall(100, 2, fixed(1)); // DR ≥ 2 attendu
    expect(r.effectiveMetres).toBe(0);
  });
  it('échec : aucune réduction (on ne tombe pas de plus haut)', () => {
    const r = resolveDeliberateFall(20, 6, fixed(99)); // échec
    expect(r.effectiveMetres).toBe(6);
  });
});

describe('Poursuite terrestre — Distance (LDB 15 l.86-108)', () => {
  it('issue partagée : ≤0 rattrapé, ≥10 semé, sinon continue', () => {
    expect(pursuitOutcome(0)).toBe('caught');
    expect(pursuitOutcome(-2)).toBe('caught');
    expect(pursuitOutcome(PURSUIT_ESCAPE_DISTANCE)).toBe('escaped');
    expect(pursuitOutcome(5)).toBe('ongoing');
  });
  it('bonus de Mouvement = différence avec le plus lent (M8/M7/M9 → 1/0/2)', () => {
    expect(pursuitMoveBonus(8, 7)).toBe(1);
    expect(pursuitMoveBonus(7, 7)).toBe(0);
    expect(pursuitMoveBonus(9, 7)).toBe(2);
  });
  it('Distance += (min DR fuyards − max DR poursuivants) ; issue jugée', () => {
    const parts: PursuitParticipant[] = [
      { id: 'fuyard', skill: 80, movement: 4, side: 'fleeing' },
      { id: 'chasseur', skill: 20, movement: 4, side: 'pursuer' },
    ];
    // fuyard réussit fort (01), chasseur échoue (99) → delta positif, Distance augmente.
    const seq = [1, 99]; let i = 0;
    const rng: RNG = { int: (_min, max) => (max === 100 ? seq[i++] ?? 50 : max) };
    const r = resolveGroundPursuitRound(2, parts, rng);
    expect(r.delta).toBeGreaterThan(0);
    expect(r.distance).toBeGreaterThan(2);
    expect(r.rolls).toHaveLength(2);
  });
});
