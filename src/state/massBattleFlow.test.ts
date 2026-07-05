import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { pregenParty, PREGEN } from '../data/pregens';
import { massBattleTrackHit, armyMight, armyStartMight, type MassBattleSpec, type MassBattleState } from './massBattleFlow';
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
    expect(armyMight(s.massBattle!.ally)).toBe(50);
    expect(armyMight(s.massBattle!.enemy)).toBe(55);
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
    // Sabotage (l.106) baisse la Puissance de DÉPART (wounds.max) ET la courante.
    expect(armyStartMight(mbState().enemy)).toBe(50); // 55 − 5 (l.106)
    expect(armyMight(mbState().enemy)).toBe(50);
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

describe('Scènes cinématiques — MULTI-PJ en Soutien (l.116-118)', () => {
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
    expect(armyMight(mb.enemy)).toBe(55 - 5 - 10); // cumul
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
    expect(armyMight(mbState().enemy)).toBe(55 - 10);
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
    expect(armyMight(after.enemy)).toBe(55 - 7);
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
    expect(armyMight(mbState().enemy)).toBe(55 - 20);
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
    expect(armyMight(mbState().enemy)).toBe(55 - 10);
    expect(mbState().imposed).toContain('charge');
  });

  it('DÉFAITE du duel (le champion allié perd) → ALLIÉ −20 et la bataille CONTINUE (l.223)', () => {
    start({ situations: [['duel']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    // Le combat de duel est PERDU (héros hors d'action) : combatScene actif + battle.over = 'defeat'.
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'duel', hits: 2, hitters: ['h1'] } },
      battle: { over: 'defeat', combatants: [] } as any,
    });
    useGame.getState().dismissDefeat();
    const after = mbState();
    expect(armyMight(after.ally)).toBe(50 - 20);   // le camp allié perd −20 (l.223, symétrique)
    expect(armyMight(after.enemy)).toBe(55);        // l'ennemi n'est PAS réduit
    expect(after.phase).toBe('round');         // la bataille continue (pas d'écran de défaite)
    expect(after.combatScene).toBeUndefined();
    expect(after.resolvedScenes).toContain('duel');
    expect(useGame.getState().screen).toBe('massBattle');
    // Les héros sont repoussés mais relevés (le combat de scène est une abstraction).
    expect(useGame.getState().party.every((h) => !h.dead)).toBe(true);
  });
});

describe('Percée (l.173) — vraie Scène de COMBAT + enchaînement sur DÉFAITE', () => {
  it('VICTOIRE : allié +10, pas de Charge imposée', () => {
    start({ situations: [['percee']], sceneEncounters: { percee: 'enc-x' } });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'percee', hits: 4, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ name: 'Garde', count: 3 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    expect(armyMight(mbState().ally)).toBe(Math.min(50 + 10, 50)); // +10 plafonné à la Puissance de départ (l.135)
    expect(mbState().imposed).not.toContain('charge');
  });

  it('DÉFAITE : Scène de Charge imposée au Round suivant (combatLost), bataille continue', () => {
    start({ situations: [['percee'], ['motivation']], sceneEncounters: { percee: 'enc-x' } });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'percee', hits: 1, hitters: ['h1'] } },
      battle: { over: 'defeat', combatants: [] } as any,
    });
    useGame.getState().dismissDefeat();
    expect(mbState().imposed).toContain('charge'); // enchaînement échec→Charge (l.175)
    expect(armyMight(mbState().ally)).toBe(50);         // pas de +10 sur défaite
    expect(mbState().phase).toBe('round');
    // Le Round suivant présente bien la Charge imposée.
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    expect(mbState().situation).toContain('charge');
  });
});

describe('Tenez votre position (l.161) — Point de rupture + bonus cumulatif', () => {
  it('tenir un Round : Puissance ennemie −2, opposition +10 au suivant, Scène réimposée', () => {
    start({ situations: [['tenez-votre-position']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('tenez-votre-position');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.purpose).toBe('hold');
    expect(pt.enemyValue).toBeGreaterThan(0); // jet opposé de l'ennemi figé
    // Le PJ l'emporte ce Round (DR net d'ennemi négatif) → la position tient.
    resolveBattleTest({ roll: 10, success: true, sl: 3, enemySL: -2 } as any);
    const mb = mbState();
    expect(armyMight(mb.enemy)).toBe(55 - 2);                    // −2 par Round tenu (l.163)
    expect(mb.sceneState['tenez-votre-position'].held).toBe(1);
    expect(mb.sceneState['tenez-votre-position'].breakpoint).toBe(0);
    expect(mb.imposed).toContain('tenez-votre-position');  // la Scène recommence au Round suivant
    expect(mb.resolvedScenes).toContain('tenez-votre-position'); // consommée CE Round
  });

  it('le Point de rupture ≥ 10 conclut la Scène par une déroute (plus de réimposition)', () => {
    start({ situations: [['tenez-votre-position']] });
    useGame.getState().massBattleBegin();
    // Pré-charge un Point de rupture proche du seuil (état persistant de Scène).
    const mb0 = mbState();
    useGame.setState({ massBattle: { ...mb0, sceneState: { 'tenez-votre-position': { breakpoint: 8, held: 2, broken: false } } } });
    useGame.getState().massBattleScene('tenez-votre-position');
    // L'ennemi l'emporte largement (DR net +4) → breakpoint 12 ≥ 10 → rupture.
    resolveBattleTest({ roll: 60, success: false, sl: -1, enemySL: 4 } as any);
    const mb = mbState();
    expect(mb.sceneState['tenez-votre-position'].breakpoint).toBe(12);
    expect(mb.sceneState['tenez-votre-position'].broken).toBe(true);
    expect(mb.imposed).not.toContain('tenez-votre-position'); // plus réimposée (déroute)
    expect(armyMight(mb.enemy)).toBe(55); // pas de −2 : la position n'a pas tenu ce Round
  });
});

describe('Test combiné d\'Activité (l.75/102) — un jet vs deux compétences', () => {
  it('Repérage combiné : full (les deux) réussit ; ouvre le bonus de Planification', () => {
    start();
    useGame.getState().massBattleActivity('reperage');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.activityId).toBe('reperage');
    expect(pt.target2).toBeGreaterThan(0); // seconde cible (Perception) présente = Test combiné
    // full : Chevaucher ✓ ET Perception ✓ → Succès → +10 au bonus de Planification, `scouted`.
    resolveBattleTest({ roll: 10, success: true, sl: 3, success2: true, sl2: 2, combinedLevel: 'full' } as any);
    expect(mbState().scouted).toBe(true);
    expect(mbState().planningBonus).toBe(10);
  });

  it('Infiltration combinée : partial (une seule) NE réussit PAS l\'Activité', () => {
    start();
    // Débloque l'Infiltration (requiert la Planification).
    useGame.getState().massBattleActivity('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    useGame.getState().massBattleActivity('infiltration');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.activityId).toBe('infiltration');
    expect(pt.target2).toBeGreaterThan(0);
    const modBefore = mbState().allyMod;
    // partial : Discrétion ✓ mais Perception ✗ → l'Activité ÉCHOUE (pas de +10 aux Tests alliés).
    resolveBattleTest({ roll: 40, success: true, sl: 1, success2: false, sl2: -1, combinedLevel: 'partial' } as any);
    expect(mbState().allyMod).toBe(modBefore); // aucun gain
    expect(mbState().activitiesDone).toContain('infiltration');
  });
});

describe('Affectation explicite d\'un PJ à une action (E3 — poste ≠ auto « meilleur »)', () => {
  /** L'« autre » PJ disponible que la SUGGESTION `bestForSkills` — pour poster un NON-suggéré. */
  function otherThanSuggested(actionId: string, opener: () => void): { suggested: string; other: string } {
    opener();
    const suggested = useGame.getState().pendingBattleTest!.actorId;
    useGame.setState({ pendingBattleTest: null }); // referme la modale d'exploration
    const other = useGame.getState().party.find((h) => !h.dead && h.id !== suggested)!.id;
    return { suggested, other };
  }

  it('(a) poster un PJ NON suggéré à une Scène de Test → CE PJ (meneur) résout la Scène', () => {
    start({ situations: [['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    const { suggested, other } = otherThanSuggested('ligne-de-mire', () => useGame.getState().massBattleScene('ligne-de-mire'));
    expect(other).not.toBe(suggested);
    useGame.getState().setMassBattleHero('ligne-de-mire', [other]); // un seul posté → il est le meneur, sans soutien
    useGame.getState().massBattleScene('ligne-de-mire');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.actorId).toBe(other); // le POSTE est honoré
    expect(pt.heroIds).toEqual([other]); // équipage engagé = le seul posté
    expect(pt.support).toEqual({ count: 0, bonus: 0 }); // pas d'assistant
  });

  it('(a-bis) poster DEUX PJ à une Scène de Test → résolution en SOUTIEN (meneur + assistant), les DEUX consommés', () => {
    start({ situations: [['ligne-de-mire']] }, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    useGame.getState().massBattleBegin();
    const [a, b] = useGame.getState().party.map((h) => h.id);
    useGame.getState().setMassBattleHero('ligne-de-mire', [a, b]);
    useGame.getState().massBattleScene('ligne-de-mire');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.heroIds).toEqual(expect.arrayContaining([a, b]));
    expect(pt.heroIds).toHaveLength(2);
    // Ligne de mire = Balistique (CT), compétence commune : l'autre PJ soutient s'il la possède.
    expect(pt.support!.count).toBeGreaterThanOrEqual(0);
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    // TOUT l'équipage engagé est consommé ce Round (pas seulement le meneur).
    expect(mbState().actedHeroes).toEqual(expect.arrayContaining([a, b]));
    expect(mbState().actedHeroes).toHaveLength(2);
  });

  it('(b) sans affectation → la SUGGESTION (meilleur PJ disponible) résout SEUL — comportement inchangé (pas de soutien)', () => {
    start({ situations: [['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    // Référence : suggestion pure (aucun poste).
    useGame.getState().massBattleScene('ligne-de-mire');
    const pt = useGame.getState().pendingBattleTest!;
    expect(mbState().assignment).toEqual({});
    // La valeur de compétence servie est bien celle du suggéré, résolu SEUL (aucun soutien).
    expect(pt.skillValue).toBeGreaterThan(0);
    expect(pt.support).toEqual({ count: 0, bonus: 0 });
    expect(pt.heroIds).toEqual([pt.actorId]); // seul le meneur suggéré est engagé
  });

  it('(c) poster un PJ INDISPONIBLE (déjà engagé ce Round) → repli sur la suggestion', () => {
    start({ situations: [['ligne-de-mire', 'compte-a-rebours']] });
    useGame.getState().massBattleBegin();
    // Un premier PJ agit (Ligne de mire) → il rejoint actedHeroes.
    useGame.getState().massBattleScene('ligne-de-mire');
    const acted = useGame.getState().pendingBattleTest!.actorId;
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    // On poste ce PJ DÉJÀ ENGAGÉ à une autre Scène : `assignedHeroesFor` le rejette → suggestion.
    useGame.getState().setMassBattleHero('compte-a-rebours', [acted]);
    useGame.getState().massBattleScene('compte-a-rebours');
    const resolver = useGame.getState().pendingBattleTest!.actorId;
    expect(resolver).not.toBe(acted); // le poste invalide est ignoré, un autre PJ disponible résout
  });

  it('(d) poster un PJ à une Activité combinée → CE PJ résout SOLO (poste honoré sur le chemin combiné)', () => {
    start();
    const { suggested, other } = otherThanSuggested('reperage', () => useGame.getState().massBattleActivity('reperage'));
    expect(other).not.toBe(suggested);
    useGame.getState().setMassBattleHero('reperage', [other]);
    useGame.getState().massBattleActivity('reperage');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.actorId).toBe(other);
    expect(pt.target2).toBeGreaterThan(0); // toujours un Test combiné (deux compétences)
    expect(pt.support).toBeUndefined(); // Activité SOLO : pas de Soutien
  });

  it('un nouveau Round efface les affectations (le poste ne survit pas)', () => {
    start({ plannedRounds: 2, situations: [['motivation'], ['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    useGame.getState().setMassBattleHero('ligne-de-mire', [useGame.getState().party[0].id]);
    expect(Object.keys(mbState().assignment)).toHaveLength(1);
    expect(mbState().assignment['ligne-de-mire']).toEqual([useGame.getState().party[0].id]); // liste d'ids
    seedBattleRng(3);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    expect(mbState().assignment).toEqual({}); // remis à zéro au Round suivant
  });
});

describe('Activité SOUTENABLE — Planification (l.81 : « peut aider au Test »)', () => {
  /** Garantit que les deux PJ POSSÈDENT Savoir (Guerre) — l'assistant est alors « capable » quels que
   *  soient les tirages de carrière (ADE II l.81 : « au moins une Augmentation en Savoir (Guerre) »). */
  function partyWithWarLore(): Combatant[] {
    return pregenParty(PREGEN.soldat, PREGEN.chasseur).map((h) =>
      h.skills.some((s) => s.skillId === 'savoir' && s.spec === 'Guerre')
        ? h
        : { ...h, skills: [...h.skills, { skillId: 'savoir', spec: 'Guerre', characteristic: 'Int' as const, advances: 5 }] });
  }

  it('deux PJ postés à la Planification → résolution en SOUTIEN (heroIds=2, support.count ≥ 1)', () => {
    // Deux PJ capables (Savoir (Guerre)) → l'assistant soutient le meneur (+10, plafonné BFM ; LDB 12).
    start({}, partyWithWarLore());
    const [a, b] = useGame.getState().party.map((h) => h.id);
    useGame.getState().setMassBattleHero('planification', [a, b]);
    useGame.getState().massBattleActivity('planification');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.activityId).toBe('planification');
    expect(pt.heroIds).toEqual(expect.arrayContaining([a, b]));
    expect(pt.heroIds).toHaveLength(2);
    expect(pt.support!.count).toBeGreaterThanOrEqual(1); // au moins un assistant capable
    expect(pt.support!.bonus).toBeGreaterThanOrEqual(10);
    expect(pt.target2).toBeUndefined(); // Test simple (pas combiné)
  });

  it('un seul PJ posté → meneur SEUL, aucun assistant (support.count 0)', () => {
    start({}, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    const [a] = useGame.getState().party.map((h) => h.id);
    useGame.getState().setMassBattleHero('planification', [a]);
    useGame.getState().massBattleActivity('planification');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.actorId).toBe(a);
    expect(pt.heroIds).toEqual([a]);
    expect(pt.support).toEqual({ count: 0, bonus: 0 });
  });

  it('sans affectation → SUGGESTION résout SEUL, byte-identique au solo (support.count 0)', () => {
    start({}, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    useGame.getState().massBattleActivity('planification');
    const pt = useGame.getState().pendingBattleTest!;
    expect(mbState().assignment).toEqual({});
    expect(pt.heroIds).toEqual([pt.actorId]);
    expect(pt.support).toEqual({ count: 0, bonus: 0 });
    // La résolution reste correcte (Planification réussie → +10 permanent).
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(mbState().allyMod).toBe(10);
    expect(mbState().planned).toBe(true);
  });

  it('une Activité SOLO (Repérage/Sabotage) reste solo — pas de Soutien (support undefined)', () => {
    start({}, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    // Repérage est combiné/solo : le poste ne fournit PAS de soutien.
    const [a, b] = useGame.getState().party.map((h) => h.id);
    useGame.getState().setMassBattleHero('reperage', [a, b]);
    useGame.getState().massBattleActivity('reperage');
    const pt = useGame.getState().pendingBattleTest!;
    expect(pt.activityId).toBe('reperage');
    expect(pt.support).toBeUndefined(); // Activité solo : aucun Soutien
    expect(pt.actorId).toBe(a); // premier posté honoré, seul
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
    expect(armyMight(mb.ally)).toBeLessThanOrEqual(50 - 5);
    expect(armyMight(mb.enemy)).toBeLessThanOrEqual(55 - 5);
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
    expect(armyMight(mb.enemy)).toBe(0);
    expect(mb.phase).toBe('over');
    expect(mb.outcome).toBe('ally');
  });
});

describe('Modèle Combattant-armée (Blessures = Puissance)', () => {
  it('l\'armée est un Combattant INANIMÉ : PB courantes = Puissance, PB max = départ, inerte', () => {
    start({ allyMight: 50, enemyMight: 55 });
    const ally = mbState().ally.combatant;
    expect(ally.wounds.current).toBe(50);
    expect(ally.wounds.max).toBe(50);
    expect(ally.inert).toBe(true);       // aucune conséquence de créature à 0 PB
    expect(ally.psychImmune).toBe(true); // un objet inerte ignore la Psychologie
  });

  it('un gain de Scène est plafonné NATURELLEMENT à la Puissance de départ (heal → wounds.max, l.135)', () => {
    // Motivation octroie +DR de Puissance ALLIÉE. Sans dégât préalable, la Puissance est DÉJÀ au départ →
    // le gain ne peut pas la faire dépasser (heal borné à wounds.max).
    start({ allyMight: 50, situations: [['motivation']] }, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('motivation');
    resolveBattleTest({ roll: 10, success: true, sl: 4 }); // +4 tenté, mais déjà à 50/50
    expect(armyMight(mbState().ally)).toBe(50); // plafonné au départ, PAS 54
  });

  it('après une perte, un gain de Scène ne remonte pas au-delà du départ', () => {
    start({ allyMight: 50, plannedRounds: 3, situations: [['motivation'], ['motivation']] }, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    useGame.getState().massBattleBegin();
    // Round 1 : le clash entame la Puissance alliée.
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    const afterClash = armyMight(mbState().ally);
    expect(afterClash).toBeLessThan(50);
    useGame.getState().massBattleAdvance();
    // Round 2 : Motivation +DR — la Puissance remonte, mais jamais au-dessus de 50 (wounds.max).
    useGame.getState().massBattleScene('motivation');
    resolveBattleTest({ roll: 10, success: true, sl: 6 }); // +6 tenté
    expect(armyMight(mbState().ally)).toBeLessThanOrEqual(50);
    expect(armyMight(mbState().ally)).toBeGreaterThan(afterClash); // le gain a bien opéré (heal)
  });

  it('Rassembler des forces (l.96) monte la Puissance de DÉPART (wounds.max) — le plafond suit', () => {
    start({ allyMight: 50 }, pregenParty(PREGEN.soldat, PREGEN.chasseur));
    useGame.getState().massBattleActivity('rassembler-des-forces');
    resolveBattleTest({ roll: 10, success: true, sl: 6 }); // Stupéfiant → +10 (l.96)
    expect(armyStartMight(mbState().ally)).toBe(60); // départ recalé
    expect(armyMight(mbState().ally)).toBe(60);       // courante suit
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
