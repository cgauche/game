/**
 * Risques d'incantation — câblage store (LDB 46) : Incantation Critique (choix +
 * contrecoup, Diction instinctive), Focalisation Critique (NI atteint + Imparfaite
 * sauf Harmonisation aethyrique), interruption de Focalisation (Calme −20),
 * convergence de Domaine (+1 Avantage).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyCast, checkFocusInterruption } from './combatFlow';
import { makePregens } from '../data/pregens';
import { findSpell } from '../data';
import type { Combatant } from '../engine/types';
import type { CastResult } from '../engine/magic';

function wiz() {
  const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
  const sk = w.skills.find((s) => s.name === 'Langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  return w;
}

const critRes = (cast: boolean, sl: number): CastResult => ({
  cast, roll: 44, target: 60, sl, isCritical: true, isFumble: false, log: 'jet critique',
});

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingReveals: [], pendingFocus: null });
  useGame.getState().seedRng(21);
});

describe('Incantation CRITIQUE (LDB 46 l.52-59)', () => {
  it('double réussi sur un SORT → Imparfaite Mineure automatique (le prix de la puissance)', () => {
    const w = wiz();
    useGame.setState({ party: [w] as Combatant[] });
    const spell = findSpell('Choc')!; // sort non-missile ? Choc est ZdE missile — prendre un sort de soutien
    const armure = findSpell('Armure Aethyrique')!;
    applyCast(useGame.getState, useGame.setState, w, w, armure, critRes(true, 4), false, false);
    expect(useGame.getState().journal.join('\n')).toMatch(/Incantation Imparfaite/);
    expect(spell).toBeTruthy();
  });

  it('Diction instinctive : aucune Imparfaite sur le double réussi', () => {
    const w = wiz();
    w.talents.push({ name: 'Diction instinctive', times: 1 });
    useGame.setState({ party: [w] as Combatant[] });
    const armure = findSpell('Armure Aethyrique')!;
    applyCast(useGame.getState, useGame.setState, w, w, armure, critRes(true, 4), false, false);
    const j = useGame.getState().journal.join('\n');
    expect(j).toMatch(/Diction instinctive/);
    expect(j).not.toMatch(/Incantation Imparfaite Mineure \(/);
  });

  it('« Puissance totale » repêche un Critique dont le DR < NI (sort lancé quand même)', () => {
    const w = wiz();
    useGame.setState({ party: [w] as Combatant[] });
    const armure = findSpell('Armure Aethyrique')!; // NI 2 — DR 0 insuffisant
    applyCast(useGame.getState, useGame.setState, w, w, armure, critRes(false, 0), false, false, 'puissance');
    expect(useGame.getState().journal.join('\n')).toMatch(/Puissance totale/);
  });

  it('une PRIÈRE critique ne déclenche pas la mécanique (règle du ch.46, Tests de Langue)', () => {
    const all = makePregens();
    const priest = all.find((h) => h.name === 'Frère Anselm')!;
    useGame.setState({ party: [priest] as Combatant[] });
    const ben = findSpell('Bénédiction de Guérison')!;
    applyCast(useGame.getState, useGame.setState, priest, priest, ben, critRes(true, 2), false, false);
    expect(useGame.getState().journal.join('\n')).not.toMatch(/Incantation Imparfaite/);
  });
});

describe('Focalisation CRITIQUE (l.185-186)', () => {
  it('double réussi → le sort est lançable au prochain Round (focus.dr = NI) + Imparfaite Mineure', () => {
    const w = wiz();
    w.talents = w.talents.filter((t) => t.name !== 'Harmonisation aethyrique'); // le pré-tiré l'a déjà
    w.spells = ['Armure Aethyrique', ...(w.spells ?? [])];
    w.skills.push({ name: 'Focalisation', advances: 8 } as never);
    useGame.setState({ party: [w] as Combatant[] });
    useGame.setState({ pendingFocus: { casterId: w.id, spellLabel: 'Armure Aethyrique', result: { dr: 0, isCritical: true, isFumble: false, roll: 33, log: 'Focalisation critique !' } } });
    useGame.getState().focusConfirm();
    const after = useGame.getState().party.find((h) => h.id === w.id)!;
    expect(after.focus?.dr).toBeGreaterThanOrEqual(findSpell('Armure Aethyrique')!.cn ?? 0);
    expect(useGame.getState().journal.join('\n')).toMatch(/Focalisation CRITIQUE/);
    expect(useGame.getState().journal.join('\n')).toMatch(/Incantation Imparfaite/);
  });

  it('Harmonisation aethyrique : pas de contrecoup sur la Focalisation Critique', () => {
    const w = wiz();
    w.spells = ['Armure Aethyrique'];
    w.skills.push({ name: 'Focalisation', advances: 8 } as never);
    w.talents.push({ name: 'Harmonisation aethyrique', times: 1 });
    useGame.setState({ party: [w] as Combatant[] });
    useGame.setState({ pendingFocus: { casterId: w.id, spellLabel: 'Armure Aethyrique', result: { dr: 0, isCritical: true, isFumble: false, roll: 33, log: 'crit' } } });
    useGame.getState().focusConfirm();
    const j = useGame.getState().journal.join('\n');
    expect(j).toMatch(/Harmonisation aethyrique/);
    expect(j).not.toMatch(/Incantation Imparfaite Mineure \(/);
  });
});

describe('Interruption de Focalisation (l.193-194)', () => {
  it('Calme raté → DR perdus + Imparfaite Mineure + révélation témoin', () => {
    const w = wiz();
    w.characteristics.FM = 1; // Calme ~imbattable à rater
    w.focus = { spell: 'Armure Aethyrique', dr: 3 };
    useGame.setState({ party: [w] as Combatant[] });
    const lines = checkFocusInterruption(useGame.getState, useGame.setState, w);
    expect(w.focus).toBeUndefined();
    expect(lines.join('\n')).toMatch(/perd les 3 DR/);
    expect(useGame.getState().pendingReveals.some((r) => r.kind === 'calme' && r.title.includes('Focalisation'))).toBe(true);
  });

  it('Calme réussi → concentration maintenue, DR conservés', () => {
    const w = wiz();
    w.characteristics.FM = 100;
    w.skills.push({ name: 'Calme', advances: 20 } as never);
    w.focus = { spell: 'Armure Aethyrique', dr: 3 };
    useGame.setState({ party: [w] as Combatant[] });
    checkFocusInterruption(useGame.getState, useGame.setState, w);
    expect(w.focus?.dr).toBe(3);
  });

  it('sans Focalisation en cours : no-op', () => {
    const w = wiz();
    useGame.setState({ party: [w] as Combatant[] });
    expect(checkFocusInterruption(useGame.getState, useGame.setState, w)).toEqual([]);
  });
});

describe('Convergence de Domaine (+1 Avantage, l.176)', () => {
  it('2ᵉ sort du même Vent sur la même cible dans le Round → +1 Avantage au lanceur', () => {
    const w = wiz();
    const w2 = { ...wiz(), id: 'w2', name: 'Apprentie' } as Combatant;
    const target = { ...wiz(), id: 't', name: 'Cible', kind: 'enemy' } as Combatant;
    const battle = {
      combatants: [w, w2, target], order: [w.id, w2.id, target.id], turn: 0, round: 1,
      action: null, selectedSpell: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null,
    } as never;
    useGame.setState({ battle, party: [] });
    const feu = { label: 'Trait de feu', type: 'Magie des Arcanes', subType: 'Feu', cn: 0, desc: 'buff', target: 1 } as never;
    const ok: CastResult = { cast: true, roll: 21, target: 60, sl: 2, isCritical: false, isFumble: false, log: 'ok' };
    applyCast(useGame.getState, useGame.setState, w, target, feu, ok, false, false);
    expect(w.advantage).toBe(0); // premier sort : pas de convergence
    applyCast(useGame.getState, useGame.setState, w2, target, feu, ok, false, false);
    expect(w2.advantage).toBe(1); // le Vent de Feu converge
  });
});
