/**
 * Risques d'incantation — câblage store (LDB 46) : Incantation Critique (choix +
 * contrecoup, Diction instinctive), Focalisation Critique (NI atteint + Imparfaite
 * sauf Harmonisation aethyrique), interruption de Focalisation (Calme −20),
 * convergence de Domaine (+1 Avantage).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyCast, checkFocusInterruption, openCastCascade } from './combatFlow';
import { makePregens } from '../data/pregens';
import { findSpell } from '../data';
import type { Combatant } from '../engine/types';
import type { CastResult } from '../engine/magic';

function wiz() {
  const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
  const sk = w.skills.find((s) => s.skillId === 'langue');
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
    w.talents.push({ talentId: 'diction-instinctive', times: 1 });
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

  // FOLD (2026-06-16) : le Critique de Sort ET l'Imparfaite/Colère sont des ÉTAPES de la cascade
  // d'incantation ACTIVE (comme l'attaque enchaîne Critique/Déviation), plus une cascade séparée.
  it('FOLD : une Imparfaite via castConfirm APPEND à la cascade d\'incantation (pas de cascade séparée)', () => {
    const w = wiz();
    w.spells = ['armure-aethyrique', ...(w.spells ?? [])];
    useGame.setState({ party: [w] as Combatant[], pendingCast: null, pendingCascade: null, pendingReveals: [] });
    // Situation d'incantation HÔTÉE par la cascade (comme l'aurait ouverte castSpell → openCastCascade).
    openCastCascade(useGame.getState, useGame.setState, w);
    expect(useGame.getState().pendingCascade?.title).toBe('Incantation'); // étape jet:'cast' au curseur 0
    // Jet figé : Maladresse d'un Sort → Imparfaite Mineure (LDB 46) — appendue par applyMiscast.
    useGame.setState({
      pendingCast: {
        casterId: w.id, targetId: w.id, spellId: 'armure-aethyrique', missile: false, focused: false,
        result: { cast: false, roll: 99, target: 40, sl: -3, isCritical: false, isFumble: true, log: 'Maladresse !' },
      },
    });
    useGame.getState().castConfirm();
    const c = useGame.getState().pendingCascade;
    expect(useGame.getState().pendingCast).toBeNull(); // le JET est clos (CastModal disparaît)
    expect(c).toBeTruthy(); // la cascade reste OUVERTE : la conséquence s'y joue
    expect(c!.title).toBe('Incantation'); // MÊME cascade (pas une « Conséquences » neuve) = le fold
    expect(c!.cursor).toBe(1); // curseur avancé au-delà de l'étape cast (cursor 0)
    expect(c!.participants[1]?.kind).toBe('miscast'); // l'Imparfaite est l'étape appendue
    expect(useGame.getState().pendingReveals).toEqual([]); // aucune RevealModal témoin séparée
  });

  it('FOLD : un Sort SANS conséquence ferme la cascade d\'incantation (rien à enchaîner)', () => {
    const w = wiz();
    w.spells = ['armure-aethyrique', ...(w.spells ?? [])];
    useGame.setState({ party: [w] as Combatant[], pendingCast: null, pendingCascade: null, pendingReveals: [] });
    openCastCascade(useGame.getState, useGame.setState, w);
    useGame.setState({
      pendingCast: {
        casterId: w.id, targetId: w.id, spellId: 'armure-aethyrique', missile: false, focused: false,
        result: { cast: true, roll: 21, target: 60, sl: 2, isCritical: false, isFumble: false, log: 'ok' },
      },
    });
    useGame.getState().castConfirm();
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().pendingCascade).toBeNull(); // aucune conséquence → la situation se clôt
  });
});

describe('Focalisation CRITIQUE (l.185-186)', () => {
  it('double réussi → le sort est lançable au prochain Round (focus.dr = NI) + Imparfaite Mineure', () => {
    const w = wiz();
    w.talents = w.talents.filter((t) => t.talentId !== 'harmonisation-aethyrique'); // le pré-tiré l'a déjà
    w.spells = ['armure-aethyrique', ...(w.spells ?? [])];
    w.skills.push({ skillId: 'focalisation', characteristic: 'force-mentale', advances: 8 } as never);
    useGame.setState({ party: [w] as Combatant[] });
    useGame.setState({ pendingFocus: { casterId: w.id, spellId: 'armure-aethyrique', result: { dr: 0, isCritical: true, isFumble: false, roll: 33, log: 'Focalisation critique !' } } });
    useGame.getState().focusConfirm();
    const after = useGame.getState().party.find((h) => h.id === w.id)!;
    expect(after.focus?.dr).toBeGreaterThanOrEqual(findSpell('Armure Aethyrique')!.cn ?? 0);
    expect(useGame.getState().journal.join('\n')).toMatch(/Focalisation CRITIQUE/);
    expect(useGame.getState().journal.join('\n')).toMatch(/Incantation Imparfaite/);
  });

  it('Harmonisation aethyrique : pas de contrecoup sur la Focalisation Critique', () => {
    const w = wiz();
    w.spells = ['armure-aethyrique'];
    w.skills.push({ skillId: 'focalisation', characteristic: 'force-mentale', advances: 8 } as never);
    w.talents.push({ talentId: 'harmonisation-aethyrique', times: 1 });
    useGame.setState({ party: [w] as Combatant[] });
    useGame.setState({ pendingFocus: { casterId: w.id, spellId: 'armure-aethyrique', result: { dr: 0, isCritical: true, isFumble: false, roll: 33, log: 'crit' } } });
    useGame.getState().focusConfirm();
    const j = useGame.getState().journal.join('\n');
    expect(j).toMatch(/Harmonisation aethyrique/);
    expect(j).not.toMatch(/Incantation Imparfaite Mineure \(/);
  });
});

/**
 * Interruption de Focalisation (LDB 46 l.194) : le Test de Calme Difficile (−20) du focaliseur est routé
 * CADENCE-AWARE (comme tout jet héros). Héros MANUEL → étape de cascade `triggeredTest` INFLUENÇABLE
 * (le joueur PEUT dépenser sa Chance pour garder son sort) ; ennemi / cadence auto → jet INLINE. La
 * conséquence d'échec (perte des DR + Imparfaite Mineure, op `interruptFocus`) s'exécute APRÈS le Test.
 */
describe('Interruption de Focalisation (l.194) — cadence-aware', () => {
  /** Place le focaliseur dans un combat minimal (un ennemi figurant) → le routage cadence s'applique. */
  function inCombat(w: Combatant, foe?: Combatant): Combatant {
    const enemy = foe ?? ({ ...wiz(), id: 'foe', name: 'Brute', kind: 'enemy' } as Combatant);
    const battle = {
      combatants: [w, enemy], order: [w.id, enemy.id], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null,
    } as never;
    useGame.setState({ battle, party: [], pendingCascade: null, pendingReveals: [], pendingLogQueue: [] });
    return enemy;
  }

  it('héros MANUEL frappé en Focalisation → étape de cascade triggeredTest (non lancée, influençable)', () => {
    const w = wiz();
    w.focus = { spell: 'armure-aethyrique', dr: 3 };
    inCombat(w);
    checkFocusInterruption(useGame.getState, useGame.setState, w);
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    const step = c.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(w.id);
    expect(step.rollLabel).toBe('Calme'); // le Test RÉEL (≠ le libellé de situation)
    expect(step.result).toBeFalsy(); // pas encore lancé → Chance/Résilience possibles
    expect(w.focus?.dr).toBe(3); // DR encore intacts : la conséquence est différée
  });

  it('héros MANUEL : Calme RATÉ (cascadeRoll+Next) → DR perdus + Imparfaite Mineure', () => {
    const w = wiz();
    w.characteristics['force-mentale'] = 1; // Calme ~imbattable à rater
    w.focus = { spell: 'armure-aethyrique', dr: 3 };
    inCombat(w);
    checkFocusInterruption(useGame.getState, useGame.setState, w);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext(); // valide l'échec → applier `triggeredTest` → branche fail → hook
    const h = useGame.getState().battle!.combatants.find((x) => x.id === w.id)!;
    expect(h.focus).toBeUndefined(); // concentration BRISÉE : DR perdus
    // L'Imparfaite Mineure (conséquence d'échec) est appendue comme une étape `miscast` à la MÊME cascade.
    expect(useGame.getState().pendingCascade!.participants.some((s) => s.kind === 'miscast')).toBe(true);
  });

  it('héros MANUEL : Calme RÉUSSI → concentration maintenue, DR conservés, aucune Imparfaite', () => {
    const w = wiz();
    w.characteristics['force-mentale'] = 100;
    w.skills.push({ skillId: 'calme', characteristic: 'force-mentale', advances: 20 } as never);
    w.focus = { spell: 'armure-aethyrique', dr: 3 };
    inCombat(w);
    checkFocusInterruption(useGame.getState, useGame.setState, w);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === w.id)!;
    expect(h.focus?.dr).toBe(3); // succès : focalisation gardée
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'miscast') ?? false).toBe(false);
  });

  it('ENNEMI focaliseur frappé → Test de Calme résolu INLINE (jamais d’étape de cascade)', () => {
    const foe = { ...wiz(), id: 'caster-foe', name: 'Sorcier ennemi', kind: 'enemy' } as Combatant;
    foe.characteristics['force-mentale'] = 1; // Calme raté → conséquence inline
    foe.focus = { spell: 'armure-aethyrique', dr: 2 };
    const w = wiz();
    inCombat(w, foe);
    checkFocusInterruption(useGame.getState, useGame.setState, foe);
    expect(useGame.getState().pendingCascade).toBeNull(); // ennemi → aucune étape influençable
    const e = useGame.getState().battle!.combatants.find((x) => x.id === foe.id)!;
    expect(e.focus).toBeUndefined(); // DR perdus inline
    // La ligne de l'effet inline part dans la file différée (drainée par l'appelant).
    expect(useGame.getState().pendingLogQueue.length).toBeGreaterThan(0);
  });

  it('sans Focalisation en cours : no-op', () => {
    const w = wiz();
    inCombat(w);
    expect(checkFocusInterruption(useGame.getState, useGame.setState, w)).toEqual([]);
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});

describe('Convergence de Domaine (+1 Avantage, l.176)', () => {
  it('2ᵉ sort du même Vent sur la même cible dans le Round → +1 Avantage au lanceur', () => {
    const w = wiz();
    const w2 = { ...wiz(), id: 'w2', name: 'Apprentie' } as Combatant;
    const target = { ...wiz(), id: 't', name: 'Cible', kind: 'enemy' } as Combatant;
    const battle = {
      combatants: [w, w2, target], order: [w.id, w2.id, target.id], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null,
    } as never;
    useGame.setState({ battle, party: [] });
    const feu = { label: 'Trait de feu', type: 'Magie des Arcanes', subType: 'Feu', domainId: 'feu', cn: 0, desc: 'buff', target: 1 } as never;
    const ok: CastResult = { cast: true, roll: 21, target: 60, sl: 2, isCritical: false, isFumble: false, log: 'ok' };
    applyCast(useGame.getState, useGame.setState, w, target, feu, ok, false, false);
    expect(w.advantage).toBe(0); // premier sort : pas de convergence
    applyCast(useGame.getState, useGame.setState, w2, target, feu, ok, false, false);
    expect(w2.advantage).toBe(1); // le Vent de Feu converge
  });
});
