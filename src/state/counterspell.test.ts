import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { castSpell, resolveRoundBoundary, counterspellCandidates } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

/** Dissipation / Contre-sort (LDB 46 l.201-202) : Test opposé de Langue (Magick) contre une
 *  incantation — IA (ennemi → héros) et action joueur (héros → ennemi), un seul par Round. */
describe('Contre-sort (Dissipation, LDB 46 l.201-202)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({
      speciesLabel: 'Humains (Reiklander)', careerLabel: 'Sorcier', name: 'W',
      careerTalent: 'Magie mineure', rng: makeRNG(707),
    });
    hero.spells = ['Fléchette'];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    // L'ennemi devient une lanceuse façon Eusapia : Langue (Magick) 63 (Int 48 + 15), Carreau connu.
    E.characteristics.Int = 48; E.characteristics.FM = 53;
    E.skills = [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 15 }];
    E.spells = ['Carreau'];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 12, y: 10 }; // à 2 cases : dans les FM mètres de chacun
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  it('candidats : lanceur du camp opposé, ciblé ou point vu à ≤ FM mètres ; un seul essai par Round', () => {
    const { H, E } = setup();
    expect(counterspellCandidates(useGame.getState().battle, useGame.getState().scene, H, E).map((c) => c.id)).toContain(E.id);
    E.dispelledThisRound = true; // essai consommé
    expect(counterspellCandidates(useGame.getState().battle, useGame.getState().scene, H, E)).toHaveLength(0);
    E.dispelledThisRound = undefined;
    E.skills = []; // plus lanceuse (ni Compétence ni Trait)
    expect(counterspellCandidates(useGame.getState().battle, useGame.getState().scene, H, E)).toHaveLength(0);
  });

  it('IA : l’ennemie chante un Contre-sort contre le Sort du héros (déclaré au jet, 1/Round)', () => {
    useGame.getState().seedRng(3);
    const { H, E } = setup();
    castSpell(useGame.getState, useGame.setState, H, E, 'Fléchette');
    useGame.getState().castRoll();
    const pc = useGame.getState().pendingCast!;
    if (!pc.result!.isCritical) {
      expect(pc.result!.log).toContain('Contre-sort de');
      expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.dispelledThisRound).toBe(true);
    }
    // 2e incantation du même Round : l'essai est consommé, plus de Contre-sort.
    useGame.getState().castCancel();
    castSpell(useGame.getState, useGame.setState, H, E, 'Fléchette');
    useGame.getState().castRoll();
    const pc2 = useGame.getState().pendingCast!;
    expect(pc2.result!.log).not.toContain('Contre-sort de');
  });

  it('routage : un Sort ENNEMI est pré-roulé par le moteur et ouvre le Contre-sort à plusieurs', () => {
    useGame.getState().seedRng(9);
    const { H, E } = setup();
    castSpell(useGame.getState, useGame.setState, E, H, 'Carreau');
    // castSpell roule l'incantation ennemie (jet figé, plus de « Lancer ») ET ouvre pendingCounterspell.
    expect(useGame.getState().pendingCast!.result).toBeTruthy();
    const pcs = useGame.getState().pendingCounterspell;
    expect(pcs).toBeTruthy();
    expect(pcs!.participants.map((p) => p.id)).toContain(H.id);
    // H oppose son Langue (Magick) ; « Appliquer » agrège + résout via castConfirm.
    useGame.getState().counterspellRoll(H.id);
    expect(useGame.getState().pendingCounterspell!.participants[0].result).toBeTruthy();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.dispelledThisRound).toBe(true);
    useGame.getState().counterspellConfirm();
    for (let i = 0; i < 8 && useGame.getState().pendingReveals.length; i++) useGame.getState().dismissReveal();
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull();
  });

  it('IA : le Sort ennemi SUSPEND le tour ; « Laisser passer » applique et la main passe', () => {
    useGame.getState().seedRng(3);
    const { H, E } = setup();
    H.wounds = { ...H.wounds, max: 99, current: 99 }; // survit au Carreau : le sujet est la suspension
    useGame.setState({
      battle: { ...useGame.getState().battle!, order: [H.id, E.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingRoundStart: null, pendingReveals: [],
    });
    useGame.getState().battleEndTurn(); // H finit → E actif → IA : Carreau pré-roulé + Contre-sort ouvert
    vi.advanceTimersByTime(5000);
    let st = useGame.getState();
    expect(st.pendingCast?.casterId).toBe(E.id); // incantation ennemie figée
    expect(st.pendingCounterspell).toBeTruthy(); // H peut Dissiper → modale de réaction (pas de « Lancer »)
    expect(st.battle!.order[st.battle!.turn]).toBe(E.id); // tour SUSPENDU sur le lanceur (non avancé)
    expect(st.battle!.round).toBe(1);
    useGame.getState().counterspellCancel(); // « Laisser passer » → le Sort se résout + le tour reprend
    for (let i = 0; i < 8 && useGame.getState().pendingReveals.length; i++) useGame.getState().dismissReveal();
    vi.advanceTimersByTime(2000);
    st = useGame.getState();
    expect(st.pendingCast).toBeNull();
    expect(st.pendingCounterspell).toBeNull();
    expect(st.battle!.round).toBe(2); // frontière franchie : la main est bien passée
  });

  it('frontière de Round : l’essai de Contre-sort se réarme (LDB 46 : « chaque Round »)', () => {
    const { E } = setup();
    E.dispelledThisRound = true;
    resolveRoundBoundary(useGame.getState, useGame.setState);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.dispelledThisRound).toBeUndefined();
  });

  it('une Prière ne se dissipe pas (LDB 46 : « Si un SORT vous cible »)', () => {
    useGame.getState().seedRng(3);
    const { H, E } = setup();
    const hero = useGame.getState().battle!.combatants.find((c) => c.id === H.id)! as Combatant;
    hero.skills = [...hero.skills, { name: 'Prière', characteristic: 'Soc', advances: 5 }];
    hero.spells = ['Bénédiction de Guérison'];
    castSpell(useGame.getState, useGame.setState, hero, hero, 'Bénédiction de Guérison');
    useGame.getState().castRoll();
    expect(useGame.getState().pendingCast!.result!.log).not.toContain('Contre-sort');
  });
});
