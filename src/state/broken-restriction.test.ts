import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { chooseEnemyAction } from './ai';
import type { Combatant } from '../engine/types';

const scene = () =>
  ({ id: 's', nom: '', description: '', dimensions: { w: 12, h: 12 }, tiles: Array(144).fill('herbe'), entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

function setup(broken: boolean, enemyPos = { x: 9, y: 5 }) {
  const hero = { id: 'h', kind: 'hero', name: 'H', pos: { x: 5, y: 5 }, movement: 4, weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] }], conditions: broken ? [{ name: 'Brisé', value: 1 }] : [], characteristics: { FM: 40 }, skills: [], wounds: { current: 10, max: 10 }, advantage: 0, engagedWith: [], psychState: [] } as unknown as Combatant;
  const enemy = { id: 'e', kind: 'enemy', name: 'E', pos: enemyPos, conditions: [], wounds: { current: 10, max: 10 } } as unknown as Combatant;
  useGame.setState({ battle: { combatants: [hero, enemy], order: ['h', 'e'], baseOrder: ['h', 'e'], turn: 0, action: null, moved: false, acted: false, reachable: new Map(), over: false, round: 1, log: [] } as never, scene: scene() });
  return { hero, enemy };
}

describe('Brisé — restriction d\'action (LDB 16 l.55)', () => {
  beforeEach(() => useGame.setState({ battle: null }));

  it('Brisé : sélectionner « Attaquer » est REFUSÉ (aucune action offensive)', () => {
    setup(true);
    useGame.getState().battleSelectAction('attack');
    expect(useGame.getState().battle!.action).toBeNull();
  });

  it('non Brisé : « Attaquer » fonctionne (régression)', () => {
    setup(false);
    useGame.getState().battleSelectAction('attack');
    expect(useGame.getState().battle!.action).toBe('attack');
  });

  it('Brisé : « Détermination » (resolve) reste permis — pour pouvoir retirer le Brisé', () => {
    setup(true);
    useGame.getState().battleSelectAction('resolve');
    expect(useGame.getState().battle!.action).toBe('resolve');
  });

  it('Brisé : le déplacement ne propose QUE des cases qui ne rapprochent pas d\'un ennemi (fuir)', () => {
    setup(true); // héros (5,5), ennemi (9,5)
    useGame.getState().battleSelectAction('move');
    const r = useGame.getState().battle!.reachable;
    expect(r.has('4,5')).toBe(true); // s\'éloigne → permis
    expect(r.has('6,5')).toBe(false); // se rapproche de l\'ennemi → exclu
  });

  it('IA : un ennemi Brisé non Engagé FUIT (move s\'éloignant des héros)', () => {
    const enemy = { id: 'e', kind: 'enemy', name: 'E', pos: { x: 5, y: 5 }, movement: 4, weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] }], conditions: [{ name: 'Brisé', value: 1 }], wounds: { current: 10, max: 10 }, engagedWith: [] } as unknown as Combatant;
    const h = { id: 'h', kind: 'hero', name: 'H', pos: { x: 6, y: 5 }, wounds: { current: 10, max: 10 } } as unknown as Combatant;
    const action = chooseEnemyAction({ enemy, heroes: [h], scene: scene(), blocked: new Set(['6,5']), movement: 4 } as never);
    expect(action.kind).toBe('move');
    const to = (action as { to: { x: number; y: number } }).to;
    expect(Math.max(Math.abs(to.x - 6), Math.abs(to.y - 5))).toBeGreaterThan(1); // plus loin du héros que (5,5)
  });
});
