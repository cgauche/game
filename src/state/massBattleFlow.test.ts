import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { pregenParty, PREGEN } from '../data/pregens';
import { massBattleTrackHit, type MassBattleSpec, type MassBattleState } from './massBattleFlow';
import type { Combatant } from '../engine/types';

/** Amorce une bataille avec un vrai groupe (pré-tirés) et le RNG seedé. */
function start(spec: Partial<MassBattleSpec> = {}, party = pregenParty(PREGEN.soldat, PREGEN.chasseur)) {
  seedBattleRng(1234);
  useGame.setState({ party, battle: null });
  useGame.getState().startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3, ...spec });
}

/** Injecte un résultat de jet connu dans la modale de bataille puis l'applique. */
function resolveBattleTest(over: { roll: number; success: boolean; sl: number }) {
  const pt = useGame.getState().pendingBattleTest!;
  useGame.setState({ pendingBattleTest: { ...pt, ...over } });
  useGame.getState().battleTestConfirm();
}

const mbState = (): MassBattleState => useGame.getState().massBattle!;

describe('startMassBattle / état', () => {
  beforeEach(() => start());

  it('pose la bataille et bascule sur l\'écran dédié (situation composée à l\'engagement)', () => {
    const s = useGame.getState();
    expect(s.screen).toBe('massBattle');
    expect(s.massBattle?.ally.might).toBe(50);
    expect(s.massBattle?.enemy.might).toBe(55);
    expect(s.massBattle?.phase).toBe('inspire');
    expect(s.massBattle?.situation).toEqual([]); // composée seulement à `massBattleBegin`
    expect(s.massBattle?.pool.length).toBeGreaterThan(0);
  });

  it('refuse de s\'ouvrir en plein combat tactique', () => {
    useGame.setState({ massBattle: null, battle: { combatants: [] } as any });
    useGame.getState().startMassBattle({ allyMight: 40, enemyMight: 40 });
    expect(useGame.getState().massBattle).toBeNull();
  });
});

describe('Situation par Round (l.114-116) — sous-ensemble, pas tout le catalogue', () => {
  it('une situation authorée est présentée telle quelle (≠ catalogue complet)', () => {
    start({ situations: [['motivation', 'ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    expect(mb.situation).toEqual(['motivation', 'ligne-de-mire']);
    expect(mb.situation.length).toBeLessThan(mb.pool.length); // sous-ensemble
  });

  it('sans situation authorée, un tirage borné compose la situation (situationSize)', () => {
    start({ situationSize: 2 });
    useGame.getState().massBattleBegin();
    expect(mbState().situation.length).toBe(2);
  });
});

describe('Discours inspirant (l.71)', () => {
  beforeEach(() => start());

  it('un succès accorde +10 au Test de Puissance du premier Round', () => {
    useGame.getState().massBattleInspire();
    const pt = useGame.getState().pendingBattleTest;
    expect(pt?.purpose).toBe('inspire');
    resolveBattleTest({ roll: 20, success: true, sl: 2 });
    const mb = mbState();
    expect(mb.firstRoundBonus).toBe(10);
    expect(mb.inspired).toBe(true);
  });

  it('un échec ne donne aucun bonus', () => {
    useGame.getState().massBattleInspire();
    resolveBattleTest({ roll: 95, success: false, sl: -3 });
    expect(mbState().firstRoundBonus).toBe(0);
    expect(mbState().inspired).toBe(true);
  });
});

describe('Activités de bataille pré-combat (l.79-106)', () => {
  it('Planification réussie : +10 permanent aux Tests de Puissance ; débloque l\'Infiltration', () => {
    start();
    useGame.getState().massBattleActivity('planification');
    expect(useGame.getState().pendingBattleTest?.activityId).toBe('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 3 });
    const mb = mbState();
    expect(mb.allyMod).toBe(10);
    expect(mb.planned).toBe(true);
    expect(mb.activitiesDone).toContain('planification');
  });

  it('Sabotage requiert le Repérage ; réduit la Puissance ennemie de départ', () => {
    start();
    // Sans Repérage : refusé.
    useGame.getState().massBattleActivity('sabotage');
    expect(useGame.getState().pendingBattleTest).toBeNull();
    // Repérage réussi → `scouted`.
    useGame.getState().massBattleActivity('reperage');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(mbState().scouted).toBe(true);
    // Sabotage maintenant possible.
    useGame.getState().massBattleActivity('sabotage');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(mbState().enemy.startMight).toBe(50); // 55 − 5 (l.106)
    expect(mbState().enemy.might).toBe(50);
  });

  it('max 3 Activités (Discours compris, l.65)', () => {
    start();
    useGame.getState().massBattleActivity('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    useGame.getState().massBattleActivity('reperage');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    useGame.getState().massBattleActivity('rassembler-des-forces');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    // 3 faites → le Discours et toute autre Activité sont bloqués.
    useGame.getState().massBattleInspire();
    expect(useGame.getState().pendingBattleTest).toBeNull();
    useGame.getState().massBattleActivity('sabotage');
    expect(useGame.getState().pendingBattleTest).toBeNull();
  });
});

describe('Scènes cinématiques — une par PJ (l.116-118)', () => {
  it('deux PJ résolvent deux Scènes ; les deltas se CUMULENT avant le clash', () => {
    start({ situations: [['ligne-de-mire', 'compte-a-rebours']] }, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    useGame.getState().massBattleBegin();
    // 1er PJ : Ligne de mire (enemy −5).
    useGame.getState().massBattleScene('ligne-de-mire');
    const first = useGame.getState().pendingBattleTest!.actorId;
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    // 2e PJ : Compte à rebours (enemy −10).
    useGame.getState().massBattleScene('compte-a-rebours');
    const second = useGame.getState().pendingBattleTest!.actorId;
    expect(second).not.toBe(first); // un autre PJ agit
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    const mb = mbState();
    expect(mb.enemy.might).toBe(55 - 5 - 10); // cumul
    expect(mb.actedHeroes).toHaveLength(2);
    expect(mb.resolvedScenes).toEqual(expect.arrayContaining(['ligne-de-mire', 'compte-a-rebours']));
  });

  it('une fois tous les PJ engagés, plus aucune Scène de Test ne s\'ouvre', () => {
    start({ situations: [['ligne-de-mire', 'compte-a-rebours', 'motivation']] }, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('ligne-de-mire');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    useGame.getState().massBattleScene('compte-a-rebours');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    // 2 PJ ont agi → 3e Scène refusée.
    useGame.getState().massBattleScene('motivation');
    expect(useGame.getState().pendingBattleTest).toBeNull();
  });

  it('Ligne de mire : −10 si le général tombe (Succès Stupéfiant DR ≥ 6)', () => {
    start({ situations: [['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('ligne-de-mire');
    resolveBattleTest({ roll: 5, success: true, sl: 6 });
    expect(mbState().enemy.might).toBe(55 - 10);
  });

  it('Survol : −20 si le général tombe (Stupéfiant) ; Échec Stupéfiant impose une Charge au Round suivant', () => {
    start({ situations: [['survol'], ['motivation']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('survol');
    resolveBattleTest({ roll: 3, success: false, sl: -6 });
    expect(mbState().imposed).toContain('charge'); // enchaînement (l.217)
    // Le Round suivant présente bien la Charge imposée.
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    expect(mbState().situation).toContain('charge');
  });
});

describe('Scène MENACE (Intrus l.219)', () => {
  it('applique −20 aux Tests des autres Scènes et est levée par le combat', () => {
    start({ situations: [['intrus', 'ligne-de-mire']], sceneEncounters: { intrus: 'enc-x' } });
    useGame.getState().massBattleBegin();
    expect(mbState().activeThreats).toContain('intrus');
    // Le Test de Ligne de mire subit −20.
    useGame.getState().massBattleScene('ligne-de-mire');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.target).toBe(Math.max(1, Math.min(99, pt.skillValue - 20)));
    useGame.getState().battleTestConfirm();
    // La menace est levée en la vainquant (Scène de combat → dismissVictory).
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'intrus', hits: 3, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ name: 'Sanguinaire', count: 3 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    expect(mbState().activeThreats).not.toContain('intrus');
    expect(mbState().resolvedScenes).toContain('intrus');
  });
});

describe('Enchaînement de Scènes (l.169) : Compte à rebours échoué → Motivation imposée', () => {
  it('impose la Scène de Motivation au Round suivant', () => {
    start({ situations: [['compte-a-rebours'], ['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('compte-a-rebours');
    resolveBattleTest({ roll: 95, success: false, sl: -2 });
    expect(mbState().imposed).toContain('motivation');
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    expect(mbState().situation).toContain('motivation'); // imposée intégrée
    expect(mbState().imposed).toEqual([]); // consommée
  });
});

describe('Scène de COMBAT — touches ET kills (l.139)', () => {
  it('massBattleTrackHit ne compte que les touches HÉROS → ENNEMI', () => {
    start({ situations: [['charge']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({ massBattle: { ...mb, combatScene: { sceneId: 'charge', hits: 0, hitters: [] } } });
    const hero = { id: 'h1', kind: 'hero', bodyShape: 'biped' } as unknown as Combatant;
    const foe = { id: 'e1', kind: 'enemy', bodyShape: 'biped' } as unknown as Combatant;
    const other = { id: 'h2', kind: 'hero', bodyShape: 'biped' } as unknown as Combatant;
    const { getState, setState } = useGame;
    const g = getState as any; const s = setState as any;
    massBattleTrackHit(g, s, hero, foe);
    massBattleTrackHit(g, s, hero, foe);
    massBattleTrackHit(g, s, other, foe);
    // Un ennemi frappant un héros ne compte pas.
    massBattleTrackHit(g, s, foe, hero);
    const cs = mbState().combatScene!;
    expect(cs.hits).toBe(3);
    expect(cs.hitters).toEqual(['h1', 'h2']);
  });

  it('Charge (l.139) : réduction = −1/touche + −2/kill (5 touches + 1 kill = −7)', () => {
    start({ situations: [['charge']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'charge', hits: 5, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ name: 'Mutant', count: 1 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    const after = mbState();
    expect(after.enemy.might).toBe(55 - 7);
    expect(after.combatScene).toBeUndefined();
    expect(after.resolvedScenes).toContain('charge');
    expect(useGame.getState().screen).toBe('massBattle');
  });
});

describe('Duel (l.225) — vraie Scène de combat + intervention', () => {
  it('solo (1 frappeur) : ennemi −20', () => {
    start({ situations: [['duel']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'duel', hits: 3, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ name: 'Général', count: 1 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    expect(mbState().enemy.might).toBe(55 - 20);
    expect(mbState().imposed).not.toContain('charge');
  });

  it('intervention (≥ 2 frappeurs) : ennemi −10 + Scène de Charge enchaînée', () => {
    start({ situations: [['duel']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'duel', hits: 4, hitters: ['h1', 'h2'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ name: 'Général', count: 1 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    expect(mbState().enemy.might).toBe(55 - 10);
    expect(mbState().imposed).toContain('charge');
  });
});

describe('Rassemblement (l.122)', () => {
  it('un PJ blessé récupère DR + BE Blessures sur un Test de Résistance réussi', () => {
    start({ situations: [['motivation']] }, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    // Blesse le 1er héros, place la bataille en attente post-clash.
    const party = useGame.getState().party.map((h, i) => i === 0 ? { ...h, wounds: { ...h.wounds, current: 1 } } : h);
    useGame.setState({ party });
    const mb = mbState();
    useGame.setState({ massBattle: { ...mb, phase: 'round', awaitingNext: true } });
    useGame.getState().massBattleRally();
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.purpose).toBe('rally');
    resolveBattleTest({ roll: 10, success: true, sl: 3 });
    expect(useGame.getState().party[0].wounds.current).toBeGreaterThan(1);
    expect(mbState().ralliedHeroes).toContain(pt.actorId);
  });
});

describe('Test spectaculaire, avancement & issue (l.120/124)', () => {
  it('le clash réduit les deux Puissances d\'au moins 5 sans faire avancer le Round', () => {
    start({ plannedRounds: 3 });
    useGame.getState().massBattleBegin();
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    const mb = mbState();
    expect(mb.awaitingNext).toBe(true);
    expect(mb.round).toBe(1); // pas d'avancement automatique
    expect(mb.ally.might).toBeLessThanOrEqual(50 - 5);
    expect(mb.enemy.might).toBeLessThanOrEqual(55 - 5);
  });

  it('massBattleAdvance passe au Round suivant et réinitialise l\'état par-Round', () => {
    start({ plannedRounds: 2, situations: [['motivation'], ['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    seedBattleRng(3);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    const mb = mbState();
    expect(mb.round).toBe(2);
    expect(mb.awaitingNext).toBe(false);
    expect(mb.resolvedScenes).toEqual([]);
    expect(mb.actedHeroes).toEqual([]);
    expect(mb.situation).toEqual(['ligne-de-mire']);
    // Le dernier clash conclut la bataille.
    useGame.getState().massBattleClash();
    expect(mbState().phase).toBe('over');
  });

  it('une armée réduite à 0 est détruite immédiatement', () => {
    start({ plannedRounds: 5, enemyMight: 5 });
    useGame.getState().massBattleBegin();
    seedBattleRng(9);
    useGame.getState().massBattleClash();
    const mb = mbState();
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
    expect(mbState().hazard?.label).toBe('Peur');
  });

  it('endMassBattle ferme la bataille', () => {
    useGame.getState().endMassBattle();
    expect(useGame.getState().massBattle).toBeNull();
  });
});
