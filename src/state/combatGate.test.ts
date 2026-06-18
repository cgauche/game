import { describe, it, expect } from 'vitest';
import { combatAdvanceBlocked } from './combatGate';
import type { ArbiterState } from './modalArbiter';

/**
 * Garde unique de reprise (A1) — strictement ISO aux 4 gardes historiques. Les `opts` reflètent
 * ce que CHAQUE site surveillait : `resumeSuspendedAI` ignorait `pendingCast` (`{cast:false}`),
 * seul `maybeRunEnemyTurn` testait `pendingRoundStart` ici (`{roundStart:true}`).
 */
const battle = { over: false } as unknown as ArbiterState['battle'];
const s = (extra: Partial<ArbiterState>): ArbiterState => ({ battle, pendingReveals: [], ...extra });

describe('combatAdvanceBlocked — garde de reprise unifiée (A1, iso)', () => {
  it('aucun pending + combat en cours → non bloqué', () => {
    expect(combatAdvanceBlocked(s({}))).toBe(false);
  });

  it('pas de combat / combat terminé → bloqué', () => {
    expect(combatAdvanceBlocked({ pendingReveals: [] })).toBe(true);
    expect(combatAdvanceBlocked(s({ battle: { over: true } as unknown as ArbiterState['battle'] }))).toBe(true);
  });

  it('modales du cœur commun (fateSave/fumble/cascade/reveals) → bloqué', () => {
    expect(combatAdvanceBlocked(s({ pendingFateSave: {} as never }))).toBe(true);
    expect(combatAdvanceBlocked(s({ pendingFumble: {} as never }))).toBe(true);
    expect(combatAdvanceBlocked(s({ pendingCascade: {} as never }))).toBe(true);
    expect(combatAdvanceBlocked(s({ pendingReveals: [{}] as never }))).toBe(true);
  });

  it('pendingCast : bloque par défaut, MAIS pas avec {cast:false} (iso resumeSuspendedAI)', () => {
    expect(combatAdvanceBlocked(s({ pendingCast: {} as never }))).toBe(true);
    expect(combatAdvanceBlocked(s({ pendingCast: {} as never }), { cast: false })).toBe(false);
  });

  it('pendingRoundStart : ignoré par défaut, MAIS bloque avec {roundStart:true} (iso maybeRunEnemyTurn)', () => {
    expect(combatAdvanceBlocked(s({ pendingRoundStart: {} as never }))).toBe(false);
    expect(combatAdvanceBlocked(s({ pendingRoundStart: {} as never }), { roundStart: true })).toBe(true);
  });
});
