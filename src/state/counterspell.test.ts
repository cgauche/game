import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { castSpell, resolveRoundBoundary, counterspellCandidates } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';
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
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
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

  it('héros : castCounterspell oppose Langue (Magick) au Sort ennemi figé (dissipé OU DR net)', () => {
    useGame.getState().seedRng(9);
    const { H, E } = setup();
    castSpell(useGame.getState, useGame.setState, E, H, 'Carreau');
    useGame.getState().castRoll();
    const before = useGame.getState().pendingCast!.result!;
    useGame.getState().castCounterspell(H.id);
    const after = useGame.getState().pendingCast!.result!;
    expect(after.log).toContain('Contre-sort de W');
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.dispelledThisRound).toBe(true);
    if (after.dispelled) {
      expect(after.cast).toBe(false); // gagné → dissipé
    } else {
      // perdu → « le Sort utilise le DR du Test opposé » : DR net SIGNÉ (un contre-sort raté en
      // DR négatif peut même AUGMENTER le DR du lanceur — quirk RAW des Tests opposés, assumé).
      const net = Number(after.log.match(/se résout à DR (-?\d+)/)?.[1]);
      expect(after.sl).toBe(net);
      const counterSL = Number(after.log.match(/DR (-?\d+)\) :/)?.[1]);
      expect(net).toBe(before.sl - counterSL);
    }
    // 2e tentative du même héros ce Round : no-op.
    const frozen = after;
    useGame.getState().castCounterspell(H.id);
    expect(useGame.getState().pendingCast!.result).toBe(frozen);
  });

  it('IA : la modale d’incantation ennemie SUSPEND le tour — reprise à l’Appliquer', () => {
    useGame.getState().seedRng(3);
    const { H, E } = setup();
    H.wounds = { ...H.wounds, max: 99, current: 99 }; // survit au Carreau : le sujet est la suspension
    useGame.setState({
      battle: { ...useGame.getState().battle!, order: [H.id, E.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingRoundStart: null, pendingReveals: [],
    });
    useGame.getState().battleEndTurn(); // H finit → E actif → IA : Carreau jouable → modale témoin
    vi.advanceTimersByTime(5000);
    let st = useGame.getState();
    expect(st.pendingCast?.casterId).toBe(E.id); // la modale d'incantation ennemie est ouverte
    expect(st.battle!.order[st.battle!.turn]).toBe(E.id); // tour SUSPENDU sur le lanceur (non avancé)
    expect(st.battle!.round).toBe(1);
    // Le témoin déroule : Lancer → Appliquer → le tour de l'IA reprend (et seulement là).
    st.castRoll();
    useGame.getState().castConfirm();
    for (let i = 0; i < 8 && useGame.getState().pendingReveals.length; i++) useGame.getState().dismissReveal();
    vi.advanceTimersByTime(2000);
    st = useGame.getState();
    expect(st.pendingCast).toBeNull();
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
