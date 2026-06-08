import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';
import { traumaFromKind } from '../engine/trauma';
import { seedBattleRng } from './battleRng';

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', name: 'Doc', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 40, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ name: 'Guérison', advances: 30 }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle',
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpell: null, reachable: new Map(), moved: false, acted: false,
      log: [], over: null,
    } as any,
    pendingHeal: null,
  });
}

describe('Guérison — flux combat', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('battleHeal → healRoll → healConfirm : soigne et pose le flag, consomme l’Action', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const wounded = hero({ id: 'al', name: 'Blessé', wounds: { current: 3, max: 12 }, pos: { x: 2, y: 1 } });
    setBattle([doc, wounded], 'doc');
    useGame.getState().battleHeal('al', 'wounds');
    expect(useGame.getState().pendingHeal).not.toBeNull();
    useGame.getState().healRoll();
    expect(useGame.getState().pendingHeal!.roll).not.toBeNull();
    // fige un succès reproductible avant Appliquer
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 2 } });
    useGame.getState().healConfirm();
    const al = useGame.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.wounds.current).toBe(3 + 4 + 2); // +BI(4)+DR(2)
    expect(al.soinRencontreUtilise).toBe(true);
    expect(useGame.getState().battle!.acted).toBe(true);
    expect(useGame.getState().pendingHeal).toBeNull();
  });

  it('limite 1/rencontre : 2e « wounds » indisponible, « bleed » reste possible', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 3, max: 12 }, conditions: [{ name: 'Hémorragique', value: 2 }], soinRencontreUtilise: true, pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'wounds'); // refusé (déjà soigné cette rencontre)
    expect(useGame.getState().pendingHeal).toBeNull();
    useGame.getState().battleHeal('al', 'bleed'); // accepté
    expect(useGame.getState().pendingHeal!.mode).toBe('bleed');
  });

  it('soigner un allié Inconscient le relève une fois > 0 PB (LDB 18 l.28)', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const ko = hero({ id: 'ko', wounds: { current: 0, max: 12 }, conditions: [{ name: 'Inconscient', value: 1 }, { name: 'À Terre', value: 1 }], pos: { x: 2, y: 1 } });
    setBattle([doc, ko], 'doc');
    useGame.getState().battleHeal('ko', 'wounds');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
    useGame.getState().healConfirm();
    const k = useGame.getState().battle!.combatants.find((c) => c.id === 'ko')!;
    expect(k.wounds.current).toBeGreaterThan(0);
    expect(k.conditions.find((c) => c.name === 'Inconscient')).toBeUndefined();
  });

  it('healConfirm (bleed) : arrête l’hémorragie sans consommer la limite de soin', () => {
    const doc = hero({ id: 'doc', pos: { x: 1, y: 1 } });
    const t = hero({ id: 'al', wounds: { current: 12, max: 12 }, conditions: [{ name: 'Hémorragique', value: 3 }], pos: { x: 2, y: 1 } });
    setBattle([doc, t], 'doc');
    useGame.getState().battleHeal('al', 'bleed');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
    useGame.getState().healConfirm();
    const al = useGame.getState().battle!.combatants.find((c) => c.id === 'al')!;
    expect(al.conditions.find((c) => c.name === 'Hémorragique')?.value).toBe(1); // 3 − (1+1)
    expect(al.soinRencontreUtilise).toBeUndefined(); // bleed ne consomme pas la limite
  });
});

describe('Guérison — flux hors combat', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('healAlly : meilleur soigneur du groupe, applique au groupe, sans avancer le temps', () => {
    const doc = hero({ id: 'doc', skills: [{ name: 'Guérison', advances: 30, characteristic: 'Int' }] });
    const al = hero({ id: 'al', name: 'Blessé', wounds: { current: 4, max: 12 }, skills: [] });
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, al], pendingHeal: null });
    useGame.getState().healAlly('al', 'wounds');
    const ph = useGame.getState().pendingHeal!;
    expect(useGame.getState().battle).toBeNull(); // contexte hors combat (résolution via party)
    expect(ph.healerId).toBe('doc');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 1 } });
    useGame.getState().healConfirm();
    expect(useGame.getState().party.find((c) => c.id === 'al')!.wounds.current).toBeGreaterThan(4);
  });

  it('mode trauma : la Guérison accélère la convalescence d’une déchirure (LDB 18 l.317)', () => {
    const doc = hero({ id: 'doc', skills: [{ name: 'Guérison', advances: 30, characteristic: 'Int' }] });
    const patient = hero({ id: 'p', name: 'Patient', skills: [], traumas: [traumaFromKind('dechirure', 'mineur', 'jambeD', { be: 4 })] }); // 26 j
    useGame.setState({ mode: 'exploration', battle: null, party: [doc, patient], pendingHeal: null });
    useGame.getState().healAlly('p', 'trauma');
    expect(useGame.getState().pendingHeal!.mode).toBe('trauma');
    useGame.getState().healRoll();
    useGame.setState({ pendingHeal: { ...useGame.getState().pendingHeal!, success: true, sl: 2 } });
    useGame.getState().healConfirm();
    const p = useGame.getState().party.find((c) => c.id === 'p')!;
    expect(p.traumas![0].recoveryDays).toBe(26 - (1 + 2)); // −1 jour −1/DR
    expect(p.traumas![0].healAccelerated).toBe(true);
  });
});
