/**
 * Possession réseau (Jalon 7, P3) : l'hôte ne rejoue un intent que si le siège émetteur possède
 * le combattant concerné — modale ouverte → son concerné seul ('*' = tous) ; sinon le tour actif.
 */
import { describe, it, expect } from 'vitest';
import { intentAllowedFor, modalOwnerOf, seatOwns, seatSlotsRemaining } from './netOwnership';
import type { GameState } from './store';

const base = (over: Partial<GameState>): GameState =>
  ({
    net: { mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1 }, slots: [0, 0, 0, 0] },
    party: [{ id: 'h1' }, { id: 'h2' }],
    battle: { order: ['h1', 'h2'], turn: 0, combatants: [
      { id: 'h1', kind: 'hero' }, { id: 'h2', kind: 'hero' }, { id: 'e1', kind: 'enemy' },
    ] },
    pendingReveals: [],
    ...over,
  }) as unknown as GameState;

describe('possession réseau (netOwnership)', () => {
  it('sans modale : seul le propriétaire du combattant ACTIF agit', () => {
    const s = base({}); // actif = h1 (non attribué → hôte)
    expect(intentAllowedFor(s, 0, 'battleEndTurn')).toBe(true);
    expect(intentAllowedFor(s, 1, 'battleEndTurn')).toBe(false);
    const s2 = base({ battle: { ...base({}).battle!, turn: 1 } }); // actif = h2 (siège 1)
    expect(intentAllowedFor(s2, 1, 'battleClickEntity')).toBe(true);
    expect(intentAllowedFor(s2, 0, 'battleClickEntity')).toBe(false);
  });

  it('modale ouverte : seul son CONCERNÉ agit (défense du héros de l’invité)', () => {
    const s = base({ pendingDefense: { attackerId: 'e1', defenderId: 'h2' } as GameState['pendingDefense'] });
    expect(modalOwnerOf(s)).toBe('h2');
    expect(intentAllowedFor(s, 1, 'defenseRoll')).toBe(true);
    expect(intentAllowedFor(s, 0, 'defenseRoll')).toBe(false);
  });

  it("sort ENNEMI ('*') : tout le monde peut agir (Contre-sort multi)", () => {
    const s = base({ pendingCast: { casterId: 'e1', targetId: 'h1' } as GameState['pendingCast'] });
    expect(modalOwnerOf(s)).toBe('*');
    expect(intentAllowedFor(s, 1, 'castCounterspell')).toBe(true);
  });

  it('révélation SANS sujet (entretien) → hôte seul ; roundStartReady → toujours permis', () => {
    const s = base({ pendingReveals: [{ kind: 'round', title: 'x', lines: [] }] as GameState['pendingReveals'] });
    expect(intentAllowedFor(s, 0, 'dismissReveal')).toBe(true);
    expect(intentAllowedFor(s, 1, 'dismissReveal')).toBe(false);
    expect(intentAllowedFor(s, 1, 'roundStartReady')).toBe(true);
  });

  it('seatOwns : héros non attribué → hôte', () => {
    const s = base({});
    expect(seatOwns(s, 0, 'h1')).toBe(true);
    expect(seatOwns(s, 1, 'h1')).toBe(false);
    expect(seatOwns(s, 1, 'h2')).toBe(true);
  });

  it('partyAddHero : permis tant que le siège a des emplacements à remplir, refusé ensuite', () => {
    // 2 slots au siège 1, il possède déjà h2 → 1 restant.
    const s = base({
      net: { mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1 }, slots: [0, 1, 1, 0] },
      battle: null,
    } as unknown as Partial<GameState>);
    expect(seatSlotsRemaining(s, 1)).toBe(1);
    expect(intentAllowedFor(s, 1, 'partyAddHero', [{ id: 'h3' }])).toBe(true);
    // Quota épuisé : h3 ajouté au siège 1 → refus.
    const full = base({
      net: { mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1, h3: 1 }, slots: [0, 1, 1, 0] },
      party: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
      battle: null,
    } as unknown as Partial<GameState>);
    expect(seatSlotsRemaining(full, 1)).toBe(0);
    expect(intentAllowedFor(full, 1, 'partyAddHero', [{ id: 'h4' }])).toBe(false);
  });

  it('partyRemoveHero : seul le propriétaire du héros peut le retirer', () => {
    const s = base({ battle: null } as unknown as Partial<GameState>);
    expect(intentAllowedFor(s, 1, 'partyRemoveHero', ['h2'])).toBe(true);
    expect(intentAllowedFor(s, 1, 'partyRemoveHero', ['h1'])).toBe(false);
  });
});
