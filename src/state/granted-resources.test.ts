import { describe, it, expect } from 'vitest';
import { applyOps } from '../engine/ops';
import { endOfRound } from '../engine/conditions';
import type { Combatant } from '../engine/types';

/**
 * Ops `gainFortune` / `gainFate` (LDB 47 — Signes d'Amul, Que la chance persiste, Maître du
 * Destin) : grant immédiat de Points de Chance/Destin, retirés à l'expiration de l'effet porteur
 * s'ils n'ont pas été dépensés (engine/grantedResources, même mécanique que les traits accordés).
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', name: 'X', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 35, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('op gainFortune / gainFate', () => {
  it('gainFortune : incrément immédiat + échelle au DR (perSL), sans effet si non temporaire', () => {
    const c = dummy({ fortune: 1 });
    applyOps(c, [{ op: 'gainFortune', amount: 1, perSL: { every: 2, amount: 1 } }], { sl: 4 }); // 1 + ⌊4/2⌋ = 3
    expect(c.fortune).toBe(4);
    expect(c.activeEffects ?? []).toHaveLength(0);
  });

  it('gainFortune temporary : points NON dépensés retirés à l’expiration de fin de Round', () => {
    const c = dummy({ fortune: 2 });
    applyOps(c, [{ op: 'gainFortune', amount: 2, temporary: true }], { label: "Premier Signe d'Amul", defaultDurationRounds: 1 });
    expect(c.fortune).toBe(4);
    expect(c.activeEffects?.[0]?.grantedFortune).toBe(2);
    endOfRound(c); // l'effet (1 Round) expire → les 2 Points non dépensés sont perdus
    expect(c.fortune).toBe(2);
    expect(c.activeEffects ?? []).toHaveLength(0);
  });

  it('gainFortune temporary : ce qui a déjà été dépensé n’est pas re-déduit (plancher 0)', () => {
    const c = dummy({ fortune: 0 });
    applyOps(c, [{ op: 'gainFortune', amount: 2, temporary: true }], { label: 'Signe', defaultDurationRounds: 1 });
    c.fortune = 0; // les 2 Points accordés ont été dépensés pendant le Round
    endOfRound(c);
    expect(c.fortune).toBe(0);
  });

  it('gainFate temporary : +1 Destin retiré s’il n’est pas dépensé', () => {
    const c = dummy({ fate: 1 });
    applyOps(c, [{ op: 'gainFate', amount: 1, temporary: true }], { label: "Troisième Signe d'Amul", defaultDurationRounds: 1 });
    expect(c.fate).toBe(2);
    endOfRound(c);
    expect(c.fate).toBe(1);
  });
});
