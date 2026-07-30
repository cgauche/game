import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makeRNG } from '../engine/dice';
import { startCascade, registerTableStep, rollTableStep, runCascadeImmediate, stepInteraction, stepReady, tableStepDefs, tableStepDie, naturalRollForTableRow } from './cascade';
import { spyApplier } from './cascadeTestKit';
import { STRUCTURE_CRIT_TABLE } from './combatFlow';
import { STRUCTURE_CRITICALS } from '../data/structureCriticals';
import { findTableEntry } from '../engine/tables';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { intentAllowedFor } from './netOwnership';
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

/**
 * MODE TABLE (#942 L3) — côté ÉTAT : les deux affordances de la modale (champ « Fixer le dé », clic
 * sur une ligne) POSENT LE DÉ par UN seul délégué (`cascadeTableSetForcedRoll`), gaté par l'option de
 * confort « Dés fixés » + le siège qui contrôle l'étape (`canFixDie`). Le dé posé est le dé NATUREL :
 * le `mod` de la déclaration s'applique APRÈS (résolveur unique) — d'où le calcul `min − mod` de la
 * ligne visée, et les lignes qu'aucun dé n'atteint sous ce `mod`.
 */
describe('MODE TABLE — poser le dé d’une étape à table (option « Dés fixés »)', () => {
  const T = 'test-table-mode';
  const applied: { id: string; roll: number; die: number }[] = [];

  /** Étape à table sur `T`, avec le `mod` voulu (le `mod` est ce qui rend le calcul du naturel visible). */
  const step = (mod?: number): CascadeStep =>
    ({ id: 'tm', kind: 'tableModeSpy', label: 'Tirage', icon: 'nav/dice', table: { tableId: T, ...(mod != null ? { mod } : {}) }, interactive: true });

  const open = (mod?: number) =>
    startCascade(useGame.getState, useGame.setState, { title: 'Tirage', purpose: 'test', steps: [step(mod)] });
  const curStep = () => useGame.getState().pendingCascade!.participants[0];

  beforeEach(() => {
    applied.length = 0;
    setDesFixes(true);
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    registerTableStep(T, {
      label: 'Table du mode',
      die: 100,
      rows: [{ min: 1, max: 50, id: 'basse', label: 'Ligne basse' }, { min: 51, max: 100, id: 'haute', label: 'Ligne haute' }],
      lines: (die) => [`ligne ${die <= 50 ? 'basse' : 'haute'} (dé ${die})`],
    });
    spyApplier('tableModeSpy', applied, (s) => ({ id: s.table!.result!.id, roll: s.table!.result!.roll, die: s.table!.result!.die }));
  });
  afterEach(() => resetDesFixes());

  it('le dé d’une LIGNE est son `min − mod` (le lookup se fait sur le dé EFFECTIF), pas sa borne brute', () => {
    const decl = { tableId: T, mod: -10 };
    // Poser la borne BRUTE (51) donnerait un dé effectif de 41 → la ligne BASSE : la ligne cliquée glisse.
    expect(naturalRollForTableRow(decl, tableStepDefs[T].rows[1])).toBe(61);
    expect(naturalRollForTableRow(decl, tableStepDefs[T].rows[0])).toBe(11);
    expect(naturalRollForTableRow({ tableId: T, mod: 10 }, tableStepDefs[T].rows[1])).toBe(41);
    expect(tableStepDie({ tableId: T })).toBe(100);
    expect(tableStepDie({ tableId: T, die: 10 })).toBe(10);
  });

  it('ligne HORS D’ATTEINTE sous le `mod` : aucun dé naturel n’y tombe → `null` (jamais un dé qui glisse)', () => {
    expect(naturalRollForTableRow({ tableId: T, mod: 60 }, tableStepDefs[T].rows[0])).toBeNull(); // 1-50 : max 100-60 → -10
    expect(naturalRollForTableRow({ tableId: T, mod: 60 }, tableStepDefs[T].rows[1])).toBe(1);
    expect(naturalRollForTableRow({ tableId: T, mod: -60 }, tableStepDefs[T].rows[1])).toBeNull(); // 51-100 : min 111 > d100
  });

  it('POSER le dé d’une ligne (mod −10) : la ligne CLIQUÉE sort, le dé naturel est celui qui l’atteint', () => {
    open(-10);
    const nat = naturalRollForTableRow(curStep().table!, tableStepDefs[T].rows[1])!;
    useGame.getState().cascadeTableSetForcedRoll('tm', nat);
    expect(curStep().table!.result).toMatchObject({ roll: 61, die: 51, id: 'haute' });
    useGame.getState().cascadeNext(); // la conséquence lit l'id de ligne, comme un tirage naturel
    expect(applied).toEqual([{ id: 'haute', roll: 61, die: 51 }]);
  });

  it('POSER un dé SAISI (le champ) : le naturel est le dé, `mod` appliqué après ; l’étape porte la provenance', () => {
    open(10);
    useGame.getState().cascadeTableSetForcedRoll('tm', 48);
    expect(curStep().table!.result).toMatchObject({ roll: 48, die: 58, id: 'haute' });
    expect(curStep().fixed, 'la provenance « dé fixé » vit sur l’étape (rangée + journal)').toBe(true);
    // JOURNAL : la mention suit le jet tant que le slot est ouvert (couture unique `fixedDieMark`).
    useGame.getState().log('Conséquence du tirage');
    const journal = useGame.getState().journal;
    expect(journal[journal.length - 1]).toContain('(dé fixé)');
  });

  it('une SAISIE que la table ne peut pas résoudre est ramenée à ses faces utiles (jamais une levée en pleine modale)', () => {
    open(20);
    expect(() => useGame.getState().cascadeTableSetForcedRoll('tm', 100)).not.toThrow();
    expect(curStep().table!.result).toMatchObject({ roll: 80, die: 100, id: 'haute' });
  });

  it('SONDE COOP : le geste d’un INVITÉ sur SON héros passe, même option ÉTEINTE chez l’hôte', () => {
    // L'option « Dés fixés » est CLIENT-SIDE : elle arme l'affordance chez celui qui clique. L'hôte
    // n'a QUE l'autorisation de siège à vérifier (`intentAllowedFor`) — re-juger son état local ferait
    // tomber en silence un geste légitime (le mode d'échec verbatim de `opSetForcedRoll`).
    resetDesFixes(); // option éteinte CHEZ L'HÔTE
    const hero = { id: 'h1', name: 'Aldo', label: 'Aldo', kind: 'hero' } as never;
    useGame.setState({
      party: [hero],
      net: { mode: 'host', mySeat: 0, roomCode: 'ABCD', seatNames: {}, presence: {}, ownership: { h1: 1 }, gmSeat: null } as never,
    });
    startCascade(useGame.getState, useGame.setState, {
      title: 'Tirage', purpose: 'test',
      steps: [{ ...step(), actorId: 'h1' }],
    });
    expect(intentAllowedFor(useGame.getState(), 1, 'cascadeTableSetForcedRoll', ['tm', 97])).toBe(true);
    useGame.getState().cascadeTableSetForcedRoll('tm', 97);
    expect(curStep().table!.result, 'geste légitime d’un invité tombé en silence').toMatchObject({ roll: 97, id: 'haute' });
  });

  it('le dé se RE-POSE tant que l’étape est courante (parité avec la saisie post-jet d’un slot de flux)', () => {
    open();
    useGame.getState().cascadeTableSetForcedRoll('tm', 7);
    expect(curStep().table!.result).toMatchObject({ roll: 7, id: 'basse' });
    useGame.getState().cascadeTableSetForcedRoll('tm', 99); // frappe suivante : 7 → 99
    expect(curStep().table!.result).toMatchObject({ roll: 99, id: 'haute' });
    useGame.getState().cascadeNext(); // l'étape est validée : la fenêtre se referme
    expect(applied).toEqual([{ id: 'haute', roll: 99, die: 99 }]);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  /** Séquence de DEUX étapes à table : le curseur avance, donc l'étape 1 sort de sa fenêtre de pose. */
  const openTwo = () =>
    startCascade(useGame.getState, useGame.setState, {
      title: 'Tirage', purpose: 'test',
      steps: [{ ...step(), id: 's1', label: 'E1' }, { ...step(), id: 's2', label: 'E2' }],
    });
  const stepById = (id: string) => useGame.getState().pendingCascade!.participants.find((x) => x.id === id)!;

  it('étape COMMITTÉE (conséquence appliquée, curseur avancé) : la re-pose est REFUSÉE — on ne réécrit pas l’histoire', () => {
    openTwo();
    useGame.getState().cascadeTableSetForcedRoll('s1', 9);
    const avant = stepById('s1').table!.result;
    useGame.getState().cascadeNext(); // COMMIT de s1 : l'applier a joué, le curseur est sur s2
    expect(applied).toEqual([{ id: 'basse', roll: 9, die: 9 }]);
    expect(stepById('s1').committed).toBe(true);
    useGame.getState().cascadeTableSetForcedRoll('s1', 88); // tentative de réécriture
    expect(stepById('s1').table!.result, 'un dé re-posé APRÈS la conséquence rejouerait une issue déjà subie').toEqual(avant);
    expect(applied).toHaveLength(1); // aucune conséquence rejouée
  });

  it('BILAN (« Tout lancer ») : plus aucune fenêtre de pose — les deux étapes sont figées', () => {
    openTwo();
    useGame.getState().cascadeResolveAll();
    const p = useGame.getState().pendingCascade!;
    expect(p.cursor).toBe(p.participants.length); // curseur EN FIN = bilan
    expect(applied).toHaveLength(2); // les conséquences des deux étapes sont déjà appliquées
    const avant = p.participants.map((x) => x.table!.result!.roll);
    useGame.getState().cascadeTableSetForcedRoll('s1', 88);
    useGame.getState().cascadeTableSetForcedRoll('s2', 88);
    expect(useGame.getState().pendingCascade!.participants.map((x) => x.table!.result!.roll)).toEqual(avant);
    expect(applied).toHaveLength(2);
  });
});
