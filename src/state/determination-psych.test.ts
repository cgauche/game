import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { isPsychImmune, clearPsychOf } from '../engine/psychology';
import { attackModifiers } from '../engine/combat';
import { traumaCharPenalties, traumaMovementHalved, traumaDodgePenalty } from '../engine/trauma';
import type { Combatant } from '../engine/types';

const C = (o: Partial<Combatant>): Combatant => o as unknown as Combatant;

describe('isPsychImmune — prédicat central (trait / Frénésie / Détermination temp)', () => {
  it('trait Immunité ou Frénésie → immunisé', () => {
    expect(isPsychImmune(C({ psychImmune: true }))).toBe(true);
    expect(isPsychImmune(C({ frenzied: true }))).toBe(true);
    expect(isPsychImmune(C({}))).toBe(false);
  });
  it('Détermination temporaire : immunisé tant que psychImmuneRoundsLeft > 0 (LDB 17 l.62)', () => {
    expect(isPsychImmune(C({ psychImmuneRoundsLeft: 2 }))).toBe(true);
    expect(isPsychImmune(C({ psychImmuneRoundsLeft: 1 }))).toBe(true);
    expect(isPsychImmune(C({ psychImmuneRoundsLeft: 0 }))).toBe(false);
  });
});

describe('clearPsychOf — les effets psy d\'une créature finissent à sa mort', () => {
  it('retire de TOUS les combattants les afflictions sourcées par la créature morte', () => {
    const h1 = C({ psychState: [{ type: 'peur', sourceId: 'mort', indice: 2, calmeDR: 0 } as never, { type: 'peur', sourceId: 'vivant', indice: 1, calmeDR: 0 } as never] });
    const h2 = C({ psychState: [{ type: 'animosite', sourceId: 'mort', cible: 'X', active: true } as never] });
    clearPsychOf([h1, h2], 'mort');
    expect(h1.psychState!.map((p) => p.sourceId)).toEqual(['vivant']); // l'autre source reste
    expect(h2.psychState).toEqual([]);
  });
});

describe('Immunité psy → AUCUN modificateur de combat psy (attackModifiers, LDB 17 l.62)', () => {
  it('une Peur active donne −1 DR, mais sous immunité Détermination ce malus disparaît', () => {
    const weapon = { name: 'Épée', type: 'melee', damage: '+4', qualities: [] } as never;
    const target = C({ id: 't', groups: [], conditions: [], size: 'moyenne' });
    const afraid = C({ advantage: 0, conditions: [], psychState: [{ type: 'peur', sourceId: 't', indice: 2, calmeDR: 0 } as never] });
    const mods = attackModifiers(afraid, target, weapon, { kind: 'melee' });
    expect(mods.some((m) => m.label === 'Peur' && m.value === -10)).toBe(true);
    afraid.psychImmuneRoundsLeft = 2; // Détermination active
    const mods2 = attackModifiers(afraid, target, weapon, { kind: 'melee' });
    expect(mods2.some((m) => m.label === 'Peur')).toBe(false); // immunisé → plus de malus
  });
});

describe('Détermination « ignorer modifs de critique » (LDB 17 l.64) annule les pénalités de trauma', () => {
  const trauma = () => C({ traumas: [{ ops: [{ op: 'charMod', char: 'F', mod: -30 }, { op: 'skillMod', skill: 'esquive', mod: -20 }, { op: 'moveScale', num: 1, den: 2 }] } as never] });
  it('actif : pénalités normales', () => {
    const c = trauma();
    expect(traumaCharPenalties(c, 'F')).toEqual([-30]);
    expect(traumaDodgePenalty(c)).toBe(-20);
    expect(traumaMovementHalved(c)).toBe(true);
  });
  it('ignoreCritMods : toutes les pénalités de trauma sont annulées', () => {
    const c = trauma();
    c.ignoreCritMods = true;
    expect(traumaCharPenalties(c, 'F')).toEqual([]);
    expect(traumaDodgePenalty(c)).toBe(0);
    expect(traumaMovementHalved(c)).toBe(false);
  });
});

describe('Actions Détermination — immunité psy & ignore-crit (store)', () => {
  beforeEach(() => useGame.setState({ battle: null }));
  function withHero() {
    const hero = C({ id: 'h', kind: 'hero', name: 'H', resolve: 2, conditions: [], wounds: { current: 10, max: 10 } });
    useGame.setState({ battle: { combatants: [hero], order: ['h'], turn: 0, round: 2, over: false, log: [], acted: false } as never });
    return hero;
  }

  it('battleResolvePsychImmune : immunisé jusqu\'au Round courant+1, −1 Détermination, ne consomme pas l\'Action', () => {
    withHero();
    useGame.getState().battleResolvePsychImmune();
    const h = useGame.getState().battle!.combatants[0];
    expect(h.psychImmuneRoundsLeft).toBe(2); // ce Round + le prochain
    expect(h.resolve).toBe(1);
    expect(useGame.getState().battle!.acted).toBe(false); // gratuit
  });

  it('battleResolveIgnoreCrit : pose ignoreCritMods, −1 Détermination', () => {
    withHero();
    useGame.getState().battleResolveIgnoreCrit();
    const h = useGame.getState().battle!.combatants[0];
    expect(h.ignoreCritMods).toBe(true);
    expect(h.resolve).toBe(1);
  });

  it('sans Détermination (0) : no-op', () => {
    const hero = C({ id: 'h', kind: 'hero', name: 'H', resolve: 0, conditions: [], wounds: { current: 10, max: 10 } });
    useGame.setState({ battle: { combatants: [hero], order: ['h'], turn: 0, round: 1, over: false, log: [], acted: false } as never });
    useGame.getState().battleResolvePsychImmune();
    expect(useGame.getState().battle!.combatants[0].psychImmuneRoundsLeft).toBeUndefined();
  });
});
