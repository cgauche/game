// @vitest-environment jsdom
/**
 * SITE PILOTE du contrat d'affichage d'un jet (#1117) — LA SURPRISE (embuscade, LDB 13 l.52-81),
 * montée pour de VRAI (`CascadeBody`, patron `createRoot`/`act` d'`opposed-mask.test.tsx`).
 *
 * Contrat mesuré ici, sur la cascade que construit `applySurprise` (aucun pending forgé) :
 *  1. AVANT le jet — les deux issues sont des CHIPS d'ops (`OutcomeNote` ← `branchCertainOps`),
 *     l'échec portant la chip codex-liée de l'État Surpris ; aucune phrase d'enjeu rédigée.
 *  2. APRÈS le jet — le MÊME bloc filtré à la branche réalisée : le verdict rend les MÊMES chips que
 *     la branche d'échec annoncée (symétrie STRUCTURELLE, une seule dérivation).
 *  3. La Difficulté de l'opposition (LDB 12 l.166) se lit des DEUX côtés — celui qui a pré-jeté
 *     (l'embusqueur) comme celui qui répond.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { applySurprise } from '../state/combatFlow';
import { seedBattleRng } from '../state/battleRng';
import { testScene } from '../scenes/test-fixture';
import { runCombatFlow } from '../state/combat/triggeredTest';
import { testFlow, EMPTY_FLOW } from '../state/flow';
import { CascadeBody } from './CascadeModal';
import type { BattleState } from '../state/store';
import type { Combatant, TalentInstance } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const SOLO = { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} };

/** Guetteur (Perception FAIBLE : il perd l'opposition) et embusqueur (Agilité/Discrétion FORTE). */
const chars = (perception: number, agilite: number) =>
  ({ 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30,
     agilite, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30, perception }) as never;

const mk = (id: string, kind: 'hero' | 'enemy', perception: number, agilite: number): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: chars(perception, agilite), conditions: [], traumas: [],
     engagedWith: [], skills: [], talents: [], items: [], weapons: [], advantage: 0, size: 'moyenne',
     pos: { x: kind === 'hero' ? 0 : 1, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;

/** Ouvre la VRAIE cascade de Surprise : héros embusqué (Perception 5) vs embusqueur (Agilité 80). */
function ambush(talents: TalentInstance[] = []) {
  const hero = { ...mk('h', 'hero', 5, 30), talents } as Combatant;
  const foe = mk('e', 'enemy', 30, 80);
  useGame.setState({
    party: [hero],
    battle: { combatants: [hero, foe], order: ['h', 'e'], baseOrder: ['h', 'e'], turn: -1, round: 1, action: null,
      reachable: new Map(), movementUsed: 0, acted: false, log: [], over: null } as unknown as BattleState,
    mode: 'battle', scene: testScene, net: SOLO as never, pendingCascade: null, pendingLogQueue: [],
  });
  applySurprise(useGame.getState, useGame.setState, 'party');
}

const render = () => act(() => { root.render(<CascadeBody />); });
/** Le bloc des issues, tel qu'il est rendu (chips comprises). */
const issues = () => [...host.querySelectorAll('.rm-stake')].map((n) => n.innerHTML);
/** Les chips codex-liées du bloc des issues : `catégorie:id` + libellé lu. */
const chips = () =>
  [...host.querySelectorAll('.rm-stake .entity-chip')].map((n) => n.textContent?.trim());
/** La LIGNE d'issue « Échec » du bloc, telle qu'elle est rendue (chips comprises). */
const ligneEchec = () =>
  [...host.querySelectorAll('.rm-stake p')].find((n) => n.textContent?.startsWith('Échec :'))?.innerHTML;

beforeEach(() => {
  seedBattleRng(7);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, battle: null, party: [], pendingLogQueue: [] });
});

describe('#1117 — la Surprise DIT ses issues en chips d’ops, avant comme après le jet', () => {
  it('AVANT le jet : « Réussite » / « Échec », l’échec portant la chip de l’État Surpris — aucune phrase', () => {
    ambush();
    render();
    const bloc = issues();
    expect(bloc.length, 'un seul bloc d’issues (l’enjeu n’a plus de gabarit rédigé)').toBe(1);
    expect(host.textContent).toContain('Réussite :');
    expect(host.textContent).toContain('Échec :');
    // La conséquence est une CHIP codex-liée (État Surpris), pas une phrase.
    expect(chips()).toEqual(['Surpris']);
    const chip = host.querySelector('.rm-stake .entity-chip .codex-ref')!;
    expect(chip.getAttribute('role'), 'la chip ouvre la fiche etats/surpris').toBe('button');
    // Le gabarit d'enjeu supprimé ne revient par aucune porte.
    expect(host.textContent).not.toContain('l’embuscade est repérée');
    expect(host.textContent).not.toContain('sauf si le Talent Vigilance');
  });

  it('APRÈS le jet perdu : le verdict est le MÊME bloc, filtré à la branche réalisée', () => {
    ambush();
    render();
    const echecAvant = ligneEchec();

    const step = useGame.getState().pendingCascade!.participants[0];
    act(() => { useGame.getState().cascadeRoll(step.id); });
    render();

    const res = useGame.getState().pendingCascade!.participants[0].result!;
    expect(res.success, 'le guetteur à Perception 5 perd l’opposition').toBe(false);
    expect(host.querySelector('.rm-stake')!.innerHTML, 'le verdict ne réannonce plus la branche non réalisée').not.toContain('Réussite :');
    expect(echecAvant, 'la branche d’échec était bien annoncée AVANT le jet').toBeTruthy();
    expect(ligneEchec(), 'MÊMES chips, MÊME rendu que la promesse d’avant le jet').toBe(echecAvant);
    expect(chips()).toEqual(['Surpris']);
  });

  /**
   * LDB 12 l.166 (verbatim Source) : « Comme tout autre Test, certains Tests opposés sont plus ou moins
   * faciles, ou difficiles, que d'autres, et le MJ peut donc décider d'appliquer des modificateurs. Dans
   * la plupart des cas, ces modificateurs sont appliqués aux deux groupes […] ». La Difficulté d'une
   * opposition est donc UNE : elle frappe le pré-jet de l'embusqueur comme le jet du guetteur, et se LIT
   * des deux côtés. Mesuré sur une opposition DIFFICILE (−20) — à l'Intermédiaire (+0) du site, un
   * défaut d'affichage passerait inaperçu.
   */
  it('la Difficulté de l’opposition (LDB 12 l.166) frappe et se lit des DEUX côtés', () => {
    ambush();
    const battle = useGame.getState().battle!;
    const guetteur = battle.combatants.find((c) => c.id === 'h')!;
    const embusqueur = battle.combatants.find((c) => c.id === 'e')!;
    useGame.setState({ pendingCascade: null });
    runCombatFlow(
      { mode: 'combat', get: useGame.getState, set: useGame.setState, target: guetteur, caster: embusqueur, label: 'Surprise' },
      testFlow(
        { skill: 'perception', difficulty: 'difficile', label: 'Guet',
          opposed: { attacker: 'agilite', attackerSkill: 'discretion', attackerLabel: 'Discrétion' } },
        EMPTY_FLOW, EMPTY_FLOW,
      ),
    );
    const step = useGame.getState().pendingCascade!.participants[0];
    const aT = step.meta!.opposed!.aT;
    expect(aT.target, 'le pré-jet de l’embusqueur SUBIT la Difficulté (−20)').toBe((aT.base ?? 0) - 20);

    act(() => { useGame.getState().cascadeRoll(step.id); });
    render();
    const difficultes = [...host.querySelectorAll('.rm-roll-diff')].map((n) => n.textContent?.trim());
    expect(difficultes.length, 'les deux lignes du Test opposé portent LA Difficulté').toBe(2);
    expect(new Set(difficultes).size, 'une seule Difficulté pour l’opposition').toBe(1);
    expect(difficultes[0]).toContain('Difficile');
  });

  /**
   * Guetteur porteur du Talent VIGILANCE (LDB 11 l.168) : sa défaite n'a PLUS d'issue certaine — un
   * second Test s'interpose. Le bloc se TAIT donc sur l'échec (aucune promesse), et la branche est
   * jouée par l'exécuteur cadence-aware, qui APPEND l'étape « Vigilance » à la MÊME cascade.
   */
  it('porteur de Vigilance : l’échec ne PROMET rien et ouvre son second jet (pas d’exception)', () => {
    ambush([{ talentId: 'vigilance', times: 1 }]);
    render();
    expect(host.textContent, 'l’issue de réussite reste certaine').toContain('Réussite :');
    expect(host.textContent, 'un second jet décide : rien à promettre').not.toContain('Échec :');
    expect(chips()).toEqual([]);

    const step = useGame.getState().pendingCascade!.participants[0];
    act(() => { useGame.getState().cascadeRoll(step.id); });
    act(() => { useGame.getState().cascadeNext(); });
    const suite = useGame.getState().pendingCascade!;
    expect(suite.participants.map((s) => s.label), 'le Test de Vigilance est APPENDU à la cascade').toContain('Vigilance');
    // …et il est JOUABLE : son identité ne collisionne pas avec le Test de Perception déjà résolu.
    const vigilance = suite.participants[suite.cursor];
    expect(vigilance.label).toBe('Vigilance');
    act(() => { useGame.getState().cascadeRoll(vigilance.id); });
    expect(useGame.getState().pendingCascade!.participants[suite.cursor].result, 'le second jet se lance').toBeTruthy();
  });
});
