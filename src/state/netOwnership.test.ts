/**
 * Possession réseau (Jalon 7, P3) : l'hôte ne rejoue un intent que si le siège émetteur possède
 * le combattant concerné — modale ouverte → son concerné seul ('*' = tous) ; sinon le tour actif.
 */
import { describe, it, expect } from 'vitest';
import { intentAllowedFor, modalOwnerOf, seatOwns, seatSlotsRemaining, controlsActive } from './netOwnership';
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
    // La défense est désormais une étape `jet:'defense'` de la cascade `combat` (pendingDefense = porteur de
    // données) ; l'owner de la modale `cascade` = l'actorId de l'étape (le défenseur h2).
    const s = base({
      pendingDefense: { attackerId: 'e1', defenderId: 'h2' } as GameState['pendingDefense'],
      pendingCascade: { participants: [{ jet: 'defense', kind: 'defenseJet', actorId: 'h2' }], cursor: 0 } as unknown as GameState['pendingCascade'],
    });
    expect(modalOwnerOf(s)).toBe('h2');
    expect(intentAllowedFor(s, 1, 'defenseRoll')).toBe(true);
    expect(intentAllowedFor(s, 0, 'defenseRoll')).toBe(false);
  });

  it("sort ENNEMI ('*') : tout le monde peut agir (Contre-sort multi)", () => {
    // Wrapper-fold : l'incantation est une étape `jet:'cast'` de la cascade (l'entrée d'arbitre `cast`
    // a été retirée). Sort ENNEMI → la cascade est ouverte avec `groupOwner:true` → l'entrée `cascade`
    // met l'owner à '*' (moment partagé + Contre-sort multi en coop). `pendingCast` coexiste comme data.
    const s = base({
      pendingCast: { casterId: 'e1', targetId: 'h1' } as GameState['pendingCast'],
      pendingCascade: { participants: [{ jet: 'cast', kind: 'cast', actorId: 'e1', groupOwner: true }], cursor: 0 } as unknown as GameState['pendingCascade'],
    });
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

  it('partyReplaceHero : seul le propriétaire de l’ANCIEN héros (1er arg) peut le remplacer', () => {
    const s = base({ battle: null } as unknown as Partial<GameState>);
    expect(intentAllowedFor(s, 1, 'partyReplaceHero', ['h2'])).toBe(true);  // h2 = siège 1
    expect(intentAllowedFor(s, 1, 'partyReplaceHero', ['h1'])).toBe(false); // h1 = hôte
  });
});

describe('controlsActive — gating d’affichage : le tour d’un héros distant est inerte (comme un tour ennemi)', () => {
  const withSeat = (s: GameState, mySeat: number): GameState =>
    ({ ...s, net: { ...s.net, mySeat } }) as GameState;

  it('mode local / hors combat : toujours vrai', () => {
    expect(controlsActive(base({ net: { ...base({}).net, mode: 'local' } } as unknown as Partial<GameState>))).toBe(true);
    expect(controlsActive(base({ battle: null } as unknown as Partial<GameState>))).toBe(true);
  });

  it('tour du héros d’un AUTRE joueur : faux — pour l’hôte aussi', () => {
    const s = base({ battle: { ...base({}).battle!, turn: 1 } }); // actif = h2 (siège 1), vu de l'hôte
    expect(controlsActive(s)).toBe(false); // l'hôte ne pilote PAS le héros de l'invité
    expect(controlsActive(withSeat(s, 1))).toBe(true); // son propriétaire, si
  });

  it('tour de SON héros : vrai ; tour ennemi : vrai pour tous (l’IA est déjà inerte)', () => {
    const s = base({}); // actif = h1 (non attribué → hôte)
    expect(controlsActive(s)).toBe(true);
    expect(controlsActive(withSeat(s, 1))).toBe(false);
    const enemyTurn = base({ battle: { ...base({}).battle!, order: ['e1', 'h1', 'h2'], turn: 0 } });
    expect(controlsActive(enemyTurn)).toBe(true);
    expect(controlsActive(withSeat(enemyTurn, 1))).toBe(true);
  });
});

describe('Activités d’interlude en coop (audit M7/M8) — chacun mène SES héros', () => {
  const interludeState = (over: Partial<GameState> = {}): GameState => base({
    battle: null,
    interlude: { weeks: 2, phase: 'activities', perHero: { h1: { eventRoll: 1, left: 2, revenueBrass: 0 }, h2: { eventRoll: 2, left: 2, revenueBrass: 0 } } },
    bank: [{ heroId: 'h2', kind: 'stash', brass: 100, rate: 0 }],
    ...over,
  } as Partial<GameState>);

  it('activité visant un héros : son propriétaire agit, pas les autres', () => {
    const s = interludeState();
    expect(intentAllowedFor(s, 1, 'interludeActivity', ['h2', 'revenus'])).toBe(true);
    expect(intentAllowedFor(s, 1, 'interludeActivity', ['h1', 'revenus'])).toBe(false);
    expect(intentAllowedFor(s, 0, 'interludeCraftStart', ['h1', 'Dague', [], []])).toBe(true);
    expect(intentAllowedFor(s, 0, 'interludeActivity', ['h2', 'learn', { talentId: 'chanceux' }])).toBe(false);
    expect(intentAllowedFor(s, 1, 'interludeBank', ['h2', 'stash', 120])).toBe(true);
  });

  it('retrait bancaire : le dépôt appartient à un héros — son propriétaire retire', () => {
    const s = interludeState();
    expect(intentAllowedFor(s, 1, 'interludeWithdraw', [0])).toBe(true); // dépôt de h2 (siège 1)
    expect(intentAllowedFor(s, 0, 'interludeWithdraw', [0])).toBe(false);
    expect(intentAllowedFor(s, 0, 'interludeWithdraw', [99])).toBe(false); // index inconnu → personne
  });

  it('modale de jet d’Activité (arbitre M8) : owner = héros du pending', () => {
    const s = interludeState({ pendingActivity: { heroId: 'h2', kind: 'catalog', activityId: 'revenus' } as GameState['pendingActivity'] });
    expect(modalOwnerOf(s)).toBe('h2');
    expect(intentAllowedFor(s, 1, 'activityRoll')).toBe(true);
    expect(intentAllowedFor(s, 0, 'activityRoll')).toBe(false);
  });
});
