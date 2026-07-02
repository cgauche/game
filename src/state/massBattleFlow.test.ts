import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { pregenParty, PREGEN } from '../data/pregens';
import type { MassBattleSpec } from './massBattleFlow';

/** Amorce une bataille avec un vrai groupe (pré-tirés) et le RNG seedé. */
function start(spec: Partial<MassBattleSpec> = {}) {
  seedBattleRng(1234);
  useGame.setState({ party: pregenParty(PREGEN.soldat, PREGEN.chasseur), battle: null });
  useGame.getState().startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3, ...spec });
}

/** Injecte un résultat de jet connu dans la modale de bataille puis l'applique. */
function resolveBattleTest(over: { roll: number; success: boolean; sl: number }) {
  const pt = useGame.getState().pendingBattleTest!;
  useGame.setState({ pendingBattleTest: { ...pt, ...over } });
  useGame.getState().battleTestConfirm();
}

describe('startMassBattle / état', () => {
  beforeEach(() => start());

  it('pose la bataille et bascule sur l\'écran dédié', () => {
    const s = useGame.getState();
    expect(s.screen).toBe('massBattle');
    expect(s.massBattle?.ally.might).toBe(50);
    expect(s.massBattle?.enemy.might).toBe(55);
    expect(s.massBattle?.ally.startMight).toBe(50);
    expect(s.massBattle?.phase).toBe('inspire');
    expect(s.massBattle?.round).toBe(1);
  });

  it('refuse de s\'ouvrir en plein combat tactique', () => {
    useGame.setState({ massBattle: null, battle: { combatants: [] } as any });
    useGame.getState().startMassBattle({ allyMight: 40, enemyMight: 40 });
    expect(useGame.getState().massBattle).toBeNull();
  });
});

describe('Discours inspirant (l.71)', () => {
  beforeEach(() => start());

  it('un succès accorde +10 au Test de Puissance du premier Round', () => {
    useGame.getState().massBattleInspire();
    const pt = useGame.getState().pendingBattleTest;
    expect(pt?.purpose).toBe('inspire');
    resolveBattleTest({ roll: 20, success: true, sl: 2 });
    const mb = useGame.getState().massBattle!;
    expect(mb.firstRoundBonus).toBe(10);
    expect(mb.inspired).toBe(true);
    expect(useGame.getState().pendingBattleTest).toBeNull();
  });

  it('un échec ne donne aucun bonus', () => {
    useGame.getState().massBattleInspire();
    resolveBattleTest({ roll: 95, success: false, sl: -3 });
    expect(useGame.getState().massBattle!.firstRoundBonus).toBe(0);
    expect(useGame.getState().massBattle!.inspired).toBe(true);
  });
});

describe('Scène cinématique de Compétence (l.149-225)', () => {
  beforeEach(() => start());

  it('Motivation réussie : +DR de Puissance alliée (plafonné au départ)', () => {
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('motivation');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.purpose).toBe('scene');
    expect(pt.sceneId).toBe('motivation');
    // Puissance courante 50, départ 50 → un gain est plafonné à 50 (l.135).
    resolveBattleTest({ roll: 10, success: true, sl: 4 });
    const mb = useGame.getState().massBattle!;
    expect(mb.ally.might).toBe(50);
    expect(mb.sceneResolved).toBe(true);
    expect(mb.sceneDelta).toMatchObject({ side: 'ally', amount: 4 });
  });

  it('Duel réussi : −20 de Puissance ennemie (montant plat)', () => {
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('duel');
    resolveBattleTest({ roll: 30, success: true, sl: 1 });
    expect(useGame.getState().massBattle!.enemy.might).toBe(55 - 20);
  });

  it('un échec de Scène ne change pas la Puissance', () => {
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('duel');
    resolveBattleTest({ roll: 88, success: false, sl: -2 });
    expect(useGame.getState().massBattle!.enemy.might).toBe(55);
    expect(useGame.getState().massBattle!.sceneResolved).toBe(true);
  });
});

describe('Test spectaculaire de Puissance & issue (l.120/124)', () => {
  it('réduit les deux Puissances d\'au moins 5 et conclut à l\'épuisement des Rounds', () => {
    start({ plannedRounds: 1 });
    useGame.getState().massBattleBegin();
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    const mb = useGame.getState().massBattle!;
    expect(mb.phase).toBe('over');
    expect(mb.ally.might).toBeLessThanOrEqual(50 - 5);
    expect(mb.enemy.might).toBeLessThanOrEqual(55 - 5);
    expect(['ally', 'enemy', 'draw']).toContain(mb.outcome);
  });

  it('plusieurs Rounds : la bataille avance jusqu\'au nombre prévu', () => {
    start({ plannedRounds: 2 });
    useGame.getState().massBattleBegin();
    seedBattleRng(3);
    useGame.getState().massBattleClash();
    let mb = useGame.getState().massBattle!;
    expect(mb.phase).toBe('round');
    expect(mb.round).toBe(2);
    expect(mb.sceneResolved).toBe(false); // per-Round réinitialisé
    useGame.getState().massBattleClash();
    mb = useGame.getState().massBattle!;
    expect(mb.phase).toBe('over');
  });

  it('une armée réduite à 0 est détruite immédiatement', () => {
    start({ plannedRounds: 5, enemyMight: 5 });
    useGame.getState().massBattleBegin();
    seedBattleRng(9);
    useGame.getState().massBattleClash();
    const mb = useGame.getState().massBattle!;
    expect(mb.enemy.might).toBe(0);
    expect(mb.phase).toBe('over');
    expect(mb.outcome).toBe('ally');
  });
});

describe('Aléa & fermeture', () => {
  beforeEach(() => start());

  it('massBattleHazard pose un facteur environnemental (1d10)', () => {
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleHazard(10);
    expect(useGame.getState().massBattle!.hazard?.label).toBe('Peur');
  });

  it('endMassBattle ferme la bataille', () => {
    useGame.getState().endMassBattle();
    expect(useGame.getState().massBattle).toBeNull();
  });
});

describe('Scène de COMBAT tactique — reprise post-victoire (l.139)', () => {
  it('dismissVictory nourrit la réduction de Puissance ennemie (−2 par ennemi vaincu)', () => {
    start();
    useGame.getState().massBattleBegin();
    const mb = useGame.getState().massBattle!;
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'charge', effect: { side: 'enemy', scale: 'perKill', amount: -2 } } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ name: 'Mutant', count: 3 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    const after = useGame.getState().massBattle!;
    expect(after.enemy.might).toBe(55 - 6); // 3 ennemis × −2
    expect(after.combatScene).toBeUndefined();
    expect(after.sceneResolved).toBe(true);
    expect(useGame.getState().screen).toBe('massBattle');
  });
});
