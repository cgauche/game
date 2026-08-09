import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { bonus } from '../engine/characteristics';
import { startCascade } from './cascade';
import { spyApplier } from './cascadeTestKit';
import { FLOW_VERBS } from './flowVerbs';
import { frozenOpposedBatchStep } from './combat/triggeredTest';
import type { CascadeStep, BatchParticipant } from './pendings';
import type { Combatant } from '../engine/types';
import { EMPTY_FLOW, type FlowTest } from './flow';

/**
 * SOCLE des BANDES de cascade (#1117, flux `cascadeBatch`) — les trois capacités qu'une rangée doit
 * offrir pour qu'une bande vaille une étape MONO :
 *  1. CHARGE UTILE par rangée (`BatchParticipant.meta`) : l'applier d'une bande lit, PAR RANGÉE, ce qui
 *     diverge d'un héros à l'autre. L'enjeu, lui, reste celui de l'ÉTAPE (la clé d'une bande EST
 *     l'entrée de règle mise en jeu) ;
 *  2. DÉTERMINATION par rangée (LDB 17 l.62) : `BatchParticipant.immune` marque LE porteur, les autres
 *     rangées gardant leur conséquence ;
 *  3. RÉSISTANCE (Menace) par rangée (LDB 10 l.1015-1021) : une bande dont le Test est tagué `menace`
 *     se construit (plus de fail-fast) et chaque rangée peut jouer SON auto-succès.
 */

const bandHero = (id: string, over: Partial<Combatant> = {}): Combatant => {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: id, rng: makeRNG(2) });
  h.id = id;
  h.characteristics.endurance = 43; // Bonus d'Endurance = 4 (DR imposé de la Résistance)
  Object.assign(h, over);
  return h;
};

/** Bande GÉNÉRIQUE (`aggregate:'none'` — jets indépendants) : une rangée par héros, cible 50. */
const band = (kind: string, parts: BatchParticipant[], over: Partial<CascadeStep> = {}): CascadeStep =>
  ({ id: 'bande', kind, label: 'Bande', interactive: true, aggregate: 'none', participants: parts, result: null, ...over }) as CascadeStep;

const row = (id: string, over: Partial<BatchParticipant> = {}): BatchParticipant =>
  ({ id, interactive: true, base: 50, target: 50, result: null, ...over });

beforeEach(() => {
  useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
  useGame.getState().seedRng(7);
});

describe('parité des VERBES : une bande offre ce qu’offre l’étape mono', () => {
  it('`cascadeBatch` expose TOUS les verbes de `cascade` (resist + determine compris)', () => {
    const mono = FLOW_VERBS.cascade.verbs as readonly string[];
    const bande = FLOW_VERBS.cascadeBatch.verbs as readonly string[];
    const manquants = mono.filter((v) => !bande.includes(v));
    expect(manquants, 'verbe de l’étape mono absent de la bande — la rangée ne peut pas jouer sa règle').toEqual([]);
  });

  it('les délégués de store correspondants existent', () => {
    const s = useGame.getState();
    expect(typeof s.cascadeBatchResist).toBe('function');
    expect(typeof s.cascadeBatchDetermine).toBe('function');
  });
});

describe('CHARGE UTILE par rangée (`meta`) — l’applier lit la donnée DE LA RANGÉE', () => {
  it('chaque rangée porte SA donnée d’applier ; l’enjeu reste celui de l’étape', () => {
    const h1 = bandHero('h1'); const h2 = bandHero('h2');
    useGame.setState({ party: [h1, h2] });
    const vues: { id: string; meta: unknown }[] = [];
    spyApplier('bande-meta', vues, (step) => ({ id: 'step', meta: (step.participants ?? []).map((p) => ({ id: p.id, ...p.meta })) }));
    startCascade(useGame.getState, useGame.setState, {
      title: 'Bande', purpose: 'test',
      steps: [band('bande-meta', [
        row(h1.id, { meta: { psychKind: 'peur', prevDR: 2 } }),
        row(h2.id, { meta: { psychKind: 'peur', prevDR: 0 } }),
      ])],
    });
    useGame.getState().cascadeBatchRoll(h1.id);
    useGame.getState().cascadeBatchRoll(h2.id);
    useGame.getState().cascadeNext();
    expect(vues[0].meta).toEqual([
      { id: 'h1', psychKind: 'peur', prevDR: 2 },
      { id: 'h2', psychKind: 'peur', prevDR: 0 },
    ]);
  });
});

describe('DÉTERMINATION par rangée (LDB 17 l.62)', () => {
  const psychBand = () =>
    band('bande-psy', [row('h1'), row('h2')], {
      combatPsych: { kind: 'peur', sourceId: 'e1', sourceName: 'Bête', indice: 2, prevDR: 0 },
    });

  it('le verbe agit sur LA rangée : `immune` posé, Détermination débitée, l’autre rangée intacte', () => {
    const h1 = bandHero('h1', { resolve: 2 }); const h2 = bandHero('h2', { resolve: 2 });
    useGame.setState({ party: [h1, h2] });
    const vues: { parts: { id: string; immune?: boolean }[] }[] = [];
    spyApplier('bande-psy', vues, (step) => ({ parts: (step.participants ?? []).map((p) => ({ id: p.id, immune: p.immune })) }));
    startCascade(useGame.getState, useGame.setState, { title: 'Peur', purpose: 'test', steps: [psychBand()] });

    useGame.getState().cascadeBatchDetermine(h1.id);
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(st.participants![0].immune).toBe(true);
    expect(st.participants![0].result).toEqual({ roll: 50, target: 50, sl: 0, success: true });
    expect(st.participants![1].immune).toBeUndefined();
    expect(st.participants![1].result).toBeNull();
    expect(useGame.getState().party.find((c) => c.id === h1.id)!.resolve).toBe(1);
    expect(useGame.getState().party.find((c) => c.id === h2.id)!.resolve).toBe(2);

    useGame.getState().cascadeBatchRoll(h2.id);
    useGame.getState().cascadeNext();
    // L'applier de bande lit le flag PAR RANGÉE (h1 immunisé, h2 non).
    expect(vues[0].parts).toEqual([{ id: 'h1', immune: true }, { id: 'h2', immune: undefined }]);
  });

  it('bande NON psychologique → no-op (aucune Détermination brûlée)', () => {
    const h1 = bandHero('h1', { resolve: 2 });
    useGame.setState({ party: [h1] });
    spyApplier('bande-nue', [], () => null);
    startCascade(useGame.getState, useGame.setState, { title: 'X', purpose: 'test', steps: [band('bande-nue', [row(h1.id)])] });
    useGame.getState().cascadeBatchDetermine(h1.id);
    expect(useGame.getState().pendingCascade!.participants[0].participants![0].result).toBeNull();
    expect(useGame.getState().party[0].resolve).toBe(2);
  });
});

describe('RÉSISTANCE (Menace) par rangée (LDB 10 l.1015-1021)', () => {
  it('le verbe agit sur LA rangée taguée : auto-succès à DR = Bonus d’Endurance, l’autre rangée intacte', () => {
    const talents = [{ talentId: 'resistance', spec: 'maladie', times: 1 }];
    const h1 = bandHero('h1', { talents }); const h2 = bandHero('h2', { talents });
    useGame.setState({ party: [h1, h2] });
    spyApplier('bande-menace', [], () => null);
    startCascade(useGame.getState, useGame.setState, {
      title: 'Contagion', purpose: 'test',
      steps: [band('bande-menace', [row(h1.id, { menace: 'maladie' }), row(h2.id, { menace: 'maladie' })], { menace: 'maladie' })],
    });
    useGame.getState().cascadeBatchResist(h1.id);
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(st.participants![0].result).toEqual({ roll: 1, target: 50, sl: bonus(43), success: true });
    expect(st.participants![1].result).toBeNull();
    expect(useGame.getState().party.find((c) => c.id === h1.id)!.resistanceUsed).toContain('maladie');
    expect(useGame.getState().party.find((c) => c.id === h2.id)!.resistanceUsed ?? []).toEqual([]);
  });

  it('rangée NON taguée → no-op (la spec du talent n’est pas consommée)', () => {
    const h1 = bandHero('h1', { talents: [{ talentId: 'resistance', spec: 'maladie', times: 1 }] });
    useGame.setState({ party: [h1] });
    spyApplier('bande-nue2', [], () => null);
    startCascade(useGame.getState, useGame.setState, { title: 'X', purpose: 'test', steps: [band('bande-nue2', [row(h1.id)])] });
    useGame.getState().cascadeBatchResist(h1.id);
    expect(useGame.getState().pendingCascade!.participants[0].participants![0].result).toBeNull();
    expect(useGame.getState().party[0].resistanceUsed ?? []).toEqual([]);
  });
});

describe('bande d’un Test tagué MENACE — la construction n’est plus refusée', () => {
  it('`frozenOpposedBatchStep` bâtit l’étape et propage le tag sur CHAQUE rangée', () => {
    const attaquant = bandHero('e1'); const d1 = bandHero('h1'); const d2 = bandHero('h2');
    const ft: FlowTest = {
      skill: 'resistance', menace: 'maladie',
      opposed: { attacker: 'endurance', attackerSkill: 'resistance' },
    };
    const step = frozenOpposedBatchStep(
      [d1, d2], ft, { onSuccess: EMPTY_FLOW, onFail: EMPTY_FLOW }, EMPTY_FLOW, 'intermediaire', attaquant,
      { roll: 40, target: 50, sl: 1, success: true, isDouble: false },
    );
    expect(step).toBeTruthy();
    expect(step!.menace).toBe('maladie');
    expect(step!.participants!.map((p) => p.menace)).toEqual(['maladie', 'maladie']);
  });
});
