import { describe, it, expect } from 'vitest';
import { emptyScene } from '../../state/scene';
import type { GameState, BattleState } from '../../state/store';
import { Combatant } from '../../engine/types';
import { combatHighlightsView } from './highlightLayer';

describe('combatHighlightsView — survol d’une entité SANS arme (#203 régression écran noir)', () => {
  it('ne lève pas, et ne produit AUCUNE bande de portée : une structure (porte, weapons: []) n’en a pas', () => {
    const door = { id: 'structure-5-4-N-0', name: 'Porte', kind: 'structure', pos: { x: 5, y: 4 }, size: 'moyenne', conditions: [], wounds: { current: 10, max: 10 }, weapons: [] } as unknown as Combatant;
    const battle = { combatants: [door], order: [], turn: 0, zones: [], acted: false, action: null } as unknown as BattleState;
    const get = (() => ({ hovered: 'structure-5-4-N-0', battle, scene: emptyScene(6, 6) })) as unknown as () => GameState;

    const view = combatHighlightsView(get, battle, {
      myTurn: false,
      pendingAttack: null,
      pendingCleave: null,
      pendingDualStrike: null,
      pendingCast: null,
    });
    expect(view.rangeBandSource).toBeNull();
  });
});
