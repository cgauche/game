import { describe, it, expect } from 'vitest';
import { emptyScene } from '../../state/scene';
import type { GameState, BattleState } from '../../state/store';
import { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { combatHighlightObjs } from './highlightLayer';

const DIMS: Dims = { w: 6, h: 6, rot: 0, view: 'iso' };

describe('combatHighlightObjs — survol d’une entité SANS arme (#203 régression écran noir)', () => {
  it('ne lève pas : une structure (porte, weapons: []) survolée ne produit aucune bande de portée', () => {
    const door = { id: 'structure-5-4-N-0', name: 'Porte', kind: 'structure', pos: { x: 5, y: 4 }, size: 'moyenne', conditions: [], wounds: { current: 10, max: 10 }, weapons: [] } as unknown as Combatant;
    const battle = { combatants: [door], order: [], turn: 0, zones: [], acted: false, action: null } as unknown as BattleState;
    const get = (() => ({ hovered: 'structure-5-4-N-0', battle, scene: emptyScene(6, 6) })) as unknown as () => GameState;

    expect(() =>
      combatHighlightObjs(get, emptyScene(6, 6), battle, DIMS, () => 0, {
        myTurn: false,
        pendingAttack: null,
        pendingCleave: null,
        pendingDualStrike: null,
        pendingCast: null,
      }),
    ).not.toThrow();
  });
});
