import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';
import { seedBattleRng } from './battleRng';
import { applyOps } from '../engine/ops';

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', name: 'Héros', kind: 'hero',
    characteristics: { CC: 40, CT: 40, F: 80, E: 40, I: 30, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ skillId: 'athletisme', characteristic: 'Ag', advances: 20 }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

function enemy(p: Partial<Combatant>): Combatant {
  return { ...hero({ kind: 'enemy', name: 'Bête', skills: [], ...p }) } as Combatant;
}

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle',
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpell: null, reachable: new Map(), movementUsed: 0, acted: false,
      log: [], over: null,
    } as any,
    pendingStateRecovery: null,
  });
}

describe('Récupération d’État — flux combat (LDB 16 l.61/77)', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('En flammes : se rouler (Athlétisme) → retire 1 + DR pions, consomme l’Action', () => {
    const h = hero({ id: 'h', conditions: [{ name: 'En flammes', value: 2 }] });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('En flammes');
    const sr = useGame.getState().pendingStateRecovery!;
    expect(sr).not.toBeNull();
    expect(sr.opposed).toBe(false);
    expect(sr.skillLabel).toBe('Athlétisme');
    useGame.getState().recoverRoll();
    expect(useGame.getState().pendingStateRecovery!.roll).not.toBeNull();
    // fige une réussite reproductible (DR 1) avant Appliquer
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: true, netSL: 1 } });
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.conditions.find((c) => c.name === 'En flammes')).toBeUndefined(); // 2 − (1+1) = 0 → retiré
    expect(useGame.getState().battle!.acted).toBe(true);
    expect(useGame.getState().pendingStateRecovery).toBeNull();
  });

  it('Empêtré : Test OPPOSÉ de Force contre la source ; succès → se libère', () => {
    const h = hero({ id: 'h', characteristics: { CC: 40, CT: 40, F: 80, E: 40, I: 30, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30 } as any,
      conditions: [{ name: 'Empêtré', value: 1, sourceId: 'pieuvre' }] });
    const src = enemy({ id: 'pieuvre', name: 'Pieuvre', characteristics: { CC: 30, CT: 30, F: 20, E: 30, I: 20, Ag: 20, Dex: 20, Int: 20, FM: 20, Soc: 20 } as any });
    setBattle([h, src], 'h');
    useGame.getState().battleRecoverState('Empêtré');
    const sr = useGame.getState().pendingStateRecovery!;
    expect(sr.opposed).toBe(true);
    expect(sr.opponentName).toBe('Pieuvre');
    useGame.getState().recoverRoll();
    // fige la victoire de l’acteur (F 80 ≫ F 20)
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: true, netSL: 0 } });
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.conditions.find((c) => c.name === 'Empêtré')).toBeUndefined();
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  it('Empêtré sans source vivante → Test simple (non opposé)', () => {
    const h = hero({ id: 'h', conditions: [{ name: 'Empêtré', value: 1, sourceId: 'parti' }] });
    setBattle([h], 'h'); // la source 'parti' n’est pas dans le combat
    useGame.getState().battleRecoverState('Empêtré');
    expect(useGame.getState().pendingStateRecovery!.opposed).toBe(false);
    expect(useGame.getState().pendingStateRecovery!.skillLabel).toBe('Force');
  });

  it('échec : aucun pion retiré, l’Action est tout de même consommée', () => {
    const h = hero({ id: 'h', conditions: [{ name: 'En flammes', value: 1 }] });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('En flammes');
    useGame.getState().recoverRoll();
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: false, netSL: 0 } });
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.conditions.find((c) => c.name === 'En flammes')?.value).toBe(1); // intact
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  it('Empêtré de sort (escapeStrength) : Test OPPOSÉ contre la Force d’entrave FIGÉE (FM du lanceur)', () => {
    // Lanceur : Force Mentale 55 → la Force d'entrave figée doit valoir 55 (charOf FM), pas sa Force.
    const caster = enemy({ id: 'sorcier', name: 'Sorcier',
      characteristics: { CC: 30, CT: 30, F: 25, E: 30, I: 30, Ag: 30, Dex: 30, Int: 40, FM: 55, Soc: 30 } as any });
    const h = hero({ id: 'h', conditions: [] });
    // L'op `condition` Empêtré avec escapeStrength = FM du lanceur (Enchevêtrement de Taal).
    applyOps(h, [{ op: 'condition', name: 'Empêtré', value: 1, escapeStrength: { charOf: 'FM' } }], { caster });
    expect(h.conditions.find((c) => c.name === 'Empêtré')?.escapeStrength).toBe(55);
    setBattle([h], 'h'); // pas de source vivante dans le combat → sans escapeStrength, ce serait un Test simple
    useGame.getState().battleRecoverState('Empêtré');
    const sr = useGame.getState().pendingStateRecovery!;
    expect(sr.opposed).toBe(true); // grâce à la Force d'entrave figée
    expect(sr.opponentValue).toBe(55); // FM du lanceur, pas sa Force (25)
  });

  it('escapeStrength PRIORITAIRE sur la Force de la source vivante', () => {
    // La source vivante a Force 80 ; l'entrave figée (sort) vaut FM 30 → c'est la valeur figée qui prime.
    const caster = enemy({ id: 'src', name: 'Liane',
      characteristics: { CC: 30, CT: 30, F: 80, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 } as any });
    const h = hero({ id: 'h', conditions: [] });
    applyOps(h, [{ op: 'condition', name: 'Empêtré', value: 1, escapeStrength: { charOf: 'FM' } }], { caster });
    // L'op ne pose pas de sourceId — on simule une entrave dont la source serait aussi présente :
    h.conditions.find((c) => c.name === 'Empêtré')!.sourceId = 'src';
    setBattle([h, caster], 'h');
    useGame.getState().battleRecoverState('Empêtré');
    const sr = useGame.getState().pendingStateRecovery!;
    expect(sr.opponentValue).toBe(30); // FM figée, PAS la Force 80 de la source vivante
    expect(sr.opponentName).toBe('Liane'); // nom de la source si présente
  });

  it('cancel avant Appliquer : pas de coût d’Action', () => {
    const h = hero({ id: 'h', conditions: [{ name: 'En flammes', value: 1 }] });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('En flammes');
    useGame.getState().recoverCancel();
    expect(useGame.getState().pendingStateRecovery).toBeNull();
    expect(useGame.getState().battle!.acted).toBe(false);
  });
});
