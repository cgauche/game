import { describe, it, expect, afterEach } from 'vitest';
import { campGain, reversalStealOne, reconcileAdvantageToPool, roundEndAdvantageTransfer, startAdvantagePools } from './advantagePool';
import { setRule, resetRule } from '../../engine/policy';
import { baseTestMods } from '../../engine/combat';
import type { Combatant } from '../../engine/types';
import type { AdvantagePools } from '../../engine/advantagePool';

const mk = (id: string, kind: Combatant['kind'], over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, kind, advantage: 0, conditions: [], talents: [], activeEffects: [], wounds: { current: 10, max: 10, base: 10 }, ...over }) as unknown as Combatant;

interface FakeBattle { combatants: Combatant[]; advantagePools?: AdvantagePools }
const makeGet = (combatants: Combatant[], advantagePools?: AdvantagePools) => {
  const battle: FakeBattle = { combatants, advantagePools };
  return { get: (() => ({ battle })) as never, battle };
};

afterEach(() => resetRule('combat-aa-avantage-groupe'));

describe('campGain — mode Livre de base (défaut) : per-combattant, INCHANGÉ', () => {
  it('ne crédite QUE le combattant ciblé ; aucune réserve créée', () => {
    const a = mk('h1', 'hero');
    const b = mk('h2', 'hero');
    const { get, battle } = makeGet([a, b]);
    campGain(get, a, 2);
    expect(a.advantage).toBe(2);
    expect(b.advantage).toBe(0);
    expect(battle.advantagePools).toBeUndefined();
  });
});

describe('campGain — mode « Avantage de groupe » : réserve du camp (AA l.4113-4115)', () => {
  it('un gain d’un héros va dans la réserve des alliés et se projette sur tout le camp', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const b = mk('h2', 'hero');
    const e = mk('e1', 'enemy');
    const { get, battle } = makeGet([a, b, e]);
    campGain(get, a, 1);
    campGain(get, b, 2); // même camp → même réserve cumulée
    expect(battle.advantagePools).toEqual({ allies: 3, foes: 0 });
    expect(a.advantage).toBe(3); // projection
    expect(b.advantage).toBe(3);
    expect(e.advantage).toBe(0); // camp adverse intact
  });

  it('les LECTEURS d’Avantage lisent la réserve du camp de l’acteur (baseTestMods)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const e = mk('e1', 'enemy');
    const { get } = makeGet([a, e]);
    campGain(get, a, 2);
    expect(baseTestMods(a)).toBe(20); // 2 Avantages de camp × 10
    expect(baseTestMods(e)).toBe(0);
  });

  it('génération d’un PNJ hostile → réserve des adversaires (Redoutable via reconcile)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h1', 'hero');
    const e = mk('e1', 'enemy');
    const { get, battle } = makeGet([a, e], { allies: 0, foes: 0 });
    // l’op `gainAdvantage` (Redoutable) a complété l’Avantage de l’ennemi jusqu’à l’Indice sur la projection…
    e.advantage = 3;
    reconcileAdvantageToPool(get, e); // …on relève la réserve adverse en conséquence
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 3 });
    expect(e.advantage).toBe(3);
  });
});

describe('Renversement (variante AA l.4442) — vole 1 dans la réserve adverse', () => {
  it('déplace 1 Avantage de la réserve adverse vers la sienne, projeté', () => {
    setRule('combat-aa-avantage-groupe', true);
    const thief = mk('h1', 'hero');
    const victim = mk('e1', 'enemy');
    const { get, battle } = makeGet([thief, victim], { allies: 1, foes: 2 });
    const stole = reversalStealOne(get, thief, victim);
    expect(stole).toBe(true);
    expect(battle.advantagePools).toEqual({ allies: 2, foes: 1 });
    expect(thief.advantage).toBe(2);
    expect(victim.advantage).toBe(1);
  });

  it('réserve adverse vide → simple +1 (pas de vol)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const thief = mk('h1', 'hero');
    const victim = mk('e1', 'enemy');
    const { get, battle } = makeGet([thief, victim], { allies: 0, foes: 0 });
    const stole = reversalStealOne(get, thief, victim);
    expect(stole).toBe(false);
    expect(battle.advantagePools).toEqual({ allies: 1, foes: 0 });
  });
});

describe('roundEndAdvantageTransfer — domination de fin de Round (AA l.4146)', () => {
  it('le camp majoritaire prend 1 Avantage à l’autre + reprojette', () => {
    setRule('combat-aa-avantage-groupe', true);
    const combatants = [mk('h1', 'hero'), mk('h2', 'hero'), mk('e1', 'enemy')];
    const { get, battle } = makeGet(combatants, { allies: 1, foes: 2 });
    void get;
    roundEndAdvantageTransfer(battle);
    expect(battle.advantagePools).toEqual({ allies: 2, foes: 1 }); // alliés majoritaires (2 c.1)
    expect(combatants[0].advantage).toBe(2); // projection alliés
    expect(combatants[2].advantage).toBe(1); // projection adverses
  });
});

describe('startAdvantagePools — positionnement initial auto-dérivé', () => {
  it('Surnombre calculé sur les combattants actifs (AA l.4162-4164)', () => {
    const all = [mk('h1', 'hero'), mk('h2', 'hero'), mk('h3', 'hero'), mk('e1', 'enemy')];
    expect(startAdvantagePools(all, false)).toEqual({ allies: 3, foes: 0 }); // ×3 → +3 aux alliés
  });

  it('Surprise (embuscade) → +2 aux adversaires', () => {
    const all = [mk('h1', 'hero'), mk('e1', 'enemy')];
    expect(startAdvantagePools(all, true)).toEqual({ allies: 0, foes: 2 });
  });
});
