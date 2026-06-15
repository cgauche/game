/**
 * FLOW — modèle + évaluation pure des Conditions (source unique, remplace condMet/temporalConditionMet)
 * + aplatissage des branches `if`/`seq`/`do`. L'exécution interactive (`test`) est testée via le store.
 */
import { describe, it, expect } from 'vitest';
import type { Effect } from './scene';
import {
  evalCondition, flattenFlow, flowFromEffects, flowHasTest, EMPTY_FLOW, type Condition, type Flow,
} from './flow';

// 14h00 = 14*60 minutes depuis minuit ; toDate utilise des minutes depuis l'époque, mais l'heure-du-jour
// est ce qui compte pour `time`. On prend un gameTime dont l'heure-du-jour est connue.
const at = (hour: number, minute = 0) => hour * 60 + minute; // minutes depuis minuit (jour 0)

describe('evalCondition — algèbre close (flags/time/all/any/not)', () => {
  const ctx = { flags: { a: true, b: false }, gameTime: at(14) };
  it('always', () => expect(evalCondition({ kind: 'always' }, ctx)).toBe(true));
  it('flag : ET avec négation (sémantique condMet)', () => {
    expect(evalCondition({ kind: 'flag', expr: 'a' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'flag', expr: '!b' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'flag', expr: 'a,!b' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'flag', expr: 'a,b' }, ctx)).toBe(false);
  });
  it('time : fenêtre horaire (before exclusif)', () => {
    expect(evalCondition({ kind: 'time', window: { afterHour: 12 } }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'time', window: { afterHour: 18 } }, ctx)).toBe(false);
    expect(evalCondition({ kind: 'time', window: { beforeHour: 14 } }, ctx)).toBe(false); // 14h exclu
    expect(evalCondition({ kind: 'time', window: { afterHour: 8, beforeHour: 18 } }, ctx)).toBe(true);
  });
  it('all/any/not composent', () => {
    const day: Condition = { kind: 'time', window: { afterHour: 6, beforeHour: 20 } };
    expect(evalCondition({ kind: 'all', of: [{ kind: 'flag', expr: 'a' }, day] }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'all', of: [{ kind: 'flag', expr: 'b' }, day] }, ctx)).toBe(false);
    expect(evalCondition({ kind: 'any', of: [{ kind: 'flag', expr: 'b' }, day] }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'not', of: { kind: 'flag', expr: 'b' } }, ctx)).toBe(true);
  });
});

describe('flowFromEffects / flattenFlow — séquence + branches if résolues', () => {
  const fx = (flag: string): Effect => ({ type: 'setFlag', flag });
  it('flowFromEffects enveloppe une liste en seq de do', () => {
    const f = flowFromEffects([fx('x'), fx('y')]);
    expect(f).toEqual({ kind: 'seq', steps: [{ kind: 'do', effect: fx('x') }, { kind: 'do', effect: fx('y') }] });
  });
  it('flattenFlow aplatit seq/do', () => {
    expect(flattenFlow(flowFromEffects([fx('x'), fx('y')]), { flags: {}, gameTime: 0 })).toEqual([fx('x'), fx('y')]);
  });
  it('flattenFlow résout les branches if contre le contexte', () => {
    const flow: Flow = {
      kind: 'seq',
      steps: [
        { kind: 'do', effect: fx('start') },
        { kind: 'if', cond: { kind: 'flag', expr: 'béni' }, then: { kind: 'do', effect: fx('heal') }, else: { kind: 'do', effect: fx('curse') } },
      ],
    };
    expect(flattenFlow(flow, { flags: { 'béni': true }, gameTime: 0 })).toEqual([fx('start'), fx('heal')]);
    expect(flattenFlow(flow, { flags: {}, gameTime: 0 })).toEqual([fx('start'), fx('curse')]);
  });
  it('if sans else et condition fausse → rien', () => {
    const flow: Flow = { kind: 'if', cond: { kind: 'flag', expr: 'never' }, then: { kind: 'do', effect: fx('x') } };
    expect(flattenFlow(flow, { flags: {}, gameTime: 0 })).toEqual([]);
  });
  it('EMPTY_FLOW est neutre', () => {
    expect(flattenFlow(EMPTY_FLOW, { flags: {}, gameTime: 0 })).toEqual([]);
  });
});

describe('flowHasTest / flattenFlow refuse les nœuds interactifs', () => {
  const test: Flow = { kind: 'test', test: { skill: 'Crochetage' }, success: { kind: 'do', effect: { type: 'setFlag', flag: 'ouvert' } }, fail: EMPTY_FLOW };
  it('flowHasTest détecte un test imbriqué', () => {
    expect(flowHasTest({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'setFlag', flag: 'x' } }, test] })).toBe(true);
    expect(flowHasTest(flowFromEffects([{ type: 'setFlag', flag: 'x' }]))).toBe(false);
  });
  it('flattenFlow lève sur un nœud test (interactif → store)', () => {
    expect(() => flattenFlow(test, { flags: {}, gameTime: 0 })).toThrow(/interactif/);
  });
});
