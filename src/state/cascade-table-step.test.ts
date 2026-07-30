import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makeRNG } from '../engine/dice';
import { startCascade, registerTableStep, rollTableStep, runCascadeImmediate, stepInteraction, stepReady, tableStepDefs } from './cascade';
import { spyApplier } from './cascadeTestKit';
import { STRUCTURE_CRIT_TABLE } from './combatFlow';
import { STRUCTURE_CRITICALS } from '../data/structureCriticals';
import { findTableEntry } from '../engine/tables';
import type { CascadeStep } from './pendings';

/**
 * ÉTAPE À TABLE (#942 L2) — le TIRAGE SUR TABLEAU est une interaction d'étape de cascade, résolue en UN
 * site (`rollTableStep` : dé, `mod` appliqué avant le lookup, `findTableEntry`, id de ligne STABLE),
 * exercée par les VRAIES coutures du store (`cascadeTableRoll`/`cascadeNext`/`cascadeResolveAll`) et par
 * le pilote immédiat. La table est résolue par le registre `tableStepDefs`, peuplé par les modules de
 * domaine (le cœur générique ne nomme aucune table).
 */
describe('Étape à TABLE — le tirage sur tableau, résolu en un site', () => {
  /** Table SYNTHÉTIQUE (le générique se prouve sans domaine) : deux fourchettes, lignes dérivées de l'id. */
  const SYNTH = 'test-table-synthetique';
  const applied: { id: string; roll: number; die: number }[] = [];

  beforeEach(() => {
    applied.length = 0;
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    registerTableStep(SYNTH, {
      label: 'Table synthétique',
      die: 100,
      rows: [{ min: 1, max: 50, id: 'basse' }, { min: 51, max: 100, id: 'haute' }],
      lines: (die) => [`ligne ${die <= 50 ? 'basse' : 'haute'} (dé ${die})`, 'note de la ligne'],
    });
    spyApplier('tableSpy', applied, (step) => ({
      id: step.table!.result!.id, roll: step.table!.result!.roll, die: step.table!.result!.die,
    }));
  });

  const tableStep = (id: string, decl: Partial<CascadeStep['table']> = {}): CascadeStep =>
    ({ id, kind: 'tableSpy', label: 'Tirage', icon: 'nav/dice', table: { tableId: SYNTH, ...decl }, interactive: true });

  it("l'interaction est inférée du champ `table` : sans résultat = à tirer, avec résultat = affichage prêt", () => {
    const st = tableStep('t1');
    expect(stepInteraction(st)).toBe('table');
    expect(stepReady(st)).toBe(false);
    const tiree: CascadeStep = { ...st, table: { ...st.table!, result: { roll: 12, die: 12, id: 'basse', lines: ['x'] } } };
    expect(stepInteraction(tiree)).toBe('affichage');
    expect(stepReady(tiree)).toBe(true);
  });

  it('tirage NATUREL par les vraies coutures : le dé tombe dans SA fourchette, la ligne est affichée puis APPLIQUÉE', () => {
    useGame.getState().seedRng(4);
    startCascade(useGame.getState, useGame.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1')] });
    useGame.getState().cascadeNext(); // pas encore tiré → no-op (la modale force d'abord le dé)
    expect(applied).toHaveLength(0);
    useGame.getState().cascadeTableRoll('t1');
    const res = useGame.getState().pendingCascade!.participants[0].table!.result!;
    expect(res.roll).toBeGreaterThanOrEqual(1);
    expect(res.roll).toBeLessThanOrEqual(100);
    expect(res.die).toBe(res.roll); // aucun `mod`
    expect(res.id).toBe(res.die <= 50 ? 'basse' : 'haute'); // la fourchette qui contient le dé
    expect(res.lines[0]).toBe(`ligne ${res.id} (dé ${res.die})`);
    useGame.getState().cascadeNext(); // valide → la conséquence lit l'id de ligne
    expect(applied).toEqual([{ id: res.id, roll: res.roll, die: res.die }]);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('dé INJECTÉ (`forcedRoll`) : la ligne correspondante, aucun dé consommé', () => {
    startCascade(useGame.getState, useGame.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1', { tableId: SYNTH, forcedRoll: 97 })] });
    useGame.getState().cascadeTableRoll('t1');
    const res = useGame.getState().pendingCascade!.participants[0].table!.result!;
    expect(res).toMatchObject({ roll: 97, die: 97, id: 'haute' });
  });

  it('`mod` appliqué au dé AVANT le lookup (convention `rollTable`) : 48 + 10 = 58 → la ligne haute', () => {
    startCascade(useGame.getState, useGame.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1', { tableId: SYNTH, forcedRoll: 48, mod: 10 })] });
    useGame.getState().cascadeTableRoll('t1');
    const res = useGame.getState().pendingCascade!.participants[0].table!.result!;
    expect(res.roll).toBe(48); // le dé NATUREL reste lisible
    expect(res.die).toBe(58); // le dé EFFECTIF a servi au lookup
    expect(res.id).toBe('haute');
    expect(res.lines[0]).toBe('ligne haute (dé 58)');
  });

  it('un dé déjà tiré ne se relance pas en douce (`cascadeTableRoll` idempotent sur l’étape résolue)', () => {
    startCascade(useGame.getState, useGame.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1', { tableId: SYNTH, forcedRoll: 7 })] });
    useGame.getState().cascadeTableRoll('t1');
    useGame.getState().cascadeTableRoll('t1');
    expect(useGame.getState().pendingCascade!.participants[0].table!.result).toMatchObject({ roll: 7, id: 'basse' });
  });

  it('les pilotes AUTOMATIQUES tirent la table par le même résolveur (« Tout lancer » et résolution immédiate)', () => {
    useGame.getState().seedRng(11);
    startCascade(useGame.getState, useGame.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1'), tableStep('t2')] });
    useGame.getState().cascadeResolveAll();
    expect(applied).toHaveLength(2);
    for (const a of applied) expect(a.id).toBe(a.die <= 50 ? 'basse' : 'haute');
    useGame.getState().cascadeFinish();
    applied.length = 0;
    const out = runCascadeImmediate(useGame.getState, useGame.setState, [tableStep('t3', { tableId: SYNTH, forcedRoll: 51 })]);
    expect(out[0].table!.result).toMatchObject({ roll: 51, die: 51, id: 'haute' });
    expect(applied).toEqual([{ id: 'haute', roll: 51, die: 51 }]);
  });

  it('table non enregistrée : fail-fast (un `tableId` fautif ne se résout jamais en silence)', () => {
    expect(() => rollTableStep({ tableId: 'table-inexistante' }, makeRNG(1))).toThrow(/non enregistrée/i);
  });

  it('dé effectif HORS PLAGE : fail-fast, jamais le repli silencieux sur la ligne extrême', () => {
    // `findTableEntry` replie sur la DERNIÈRE ligne : sans borne, un mod trop HAUT et un mod trop BAS
    // rendraient tous deux 'haute' — le pire résultat, en silence, dans les deux sens.
    expect(() => rollTableStep({ tableId: SYNTH, forcedRoll: 100, mod: 20 }, makeRNG(1)))
      .toThrow(/dé effectif 120 hors de la plage \[1, 100\].*test-table-synthetique.*naturel 100, mod 20/s);
    expect(() => rollTableStep({ tableId: SYNTH, forcedRoll: 1, mod: -20 }, makeRNG(1)))
      .toThrow(/dé effectif -19 hors de la plage \[1, 100\]/);
    // Les bornes EXACTES restent résolubles (la garde borne, elle ne rétrécit pas la table).
    expect(rollTableStep({ tableId: SYNTH, forcedRoll: 1 }, makeRNG(1)).id).toBe('basse');
    expect(rollTableStep({ tableId: SYNTH, forcedRoll: 100 }, makeRNG(1)).id).toBe('haute');
  });

  it("registre : la table de Critiques de Structure est déclarée par son module de domaine, fourchettes = la DONNÉE", () => {
    expect(tableStepDefs[STRUCTURE_CRIT_TABLE]).toBeDefined();
    expect(tableStepDefs[STRUCTURE_CRIT_TABLE].rows).toBe(STRUCTURE_CRITICALS);
    // Le résolveur GÉNÉRIQUE trouve la même ligne que le lookup partagé sur la donnée verbatim.
    for (const die of [10, 40, 85, 98]) {
      expect(rollTableStep({ tableId: STRUCTURE_CRIT_TABLE, forcedRoll: die }, makeRNG(1)).id)
        .toBe(findTableEntry(STRUCTURE_CRITICALS, die).id);
    }
  });
});
