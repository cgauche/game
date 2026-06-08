import { describe, it, expect } from 'vitest';
import { actorIn, touchActors } from './combatOrParty';
import type { GameState } from './store';
import type { Combatant } from '../engine/types';

const c = (id: string): Combatant => ({ id, name: id } as unknown as Combatant);
const state = (over: Partial<GameState>): GameState => ({ party: [], battle: null, ...over } as unknown as GameState);

describe('combatOrParty — base des actions joueur combat ⇄ hors combat', () => {
  describe('actorIn : résout l’acteur dans le bon ensemble', () => {
    it('EN COMBAT → file de combat (battle.combatants), pas le groupe', () => {
      const inBattle = c('x');
      const inParty = c('x'); // même id, objet DIFFÉRENT côté groupe
      const s = state({ battle: { combatants: [inBattle] } as never, party: [inParty] });
      expect(actorIn(s, 'x')).toBe(inBattle); // la file prime
    });
    it('HORS COMBAT (battle null) → le groupe', () => {
      const inParty = c('y');
      expect(actorIn(state({ party: [inParty] }), 'y')).toBe(inParty);
    });
    it('id inconnu → undefined', () => {
      expect(actorIn(state({ party: [c('a')] }), 'zzz')).toBeUndefined();
    });
  });

  describe('touchActors : patch de re-rendu selon le contexte', () => {
    it('EN COMBAT → nouveau battle (référence fraîche), pas de party', () => {
      const battle = { combatants: [], log: [] } as never;
      const patch = touchActors(state({ battle }));
      expect(patch.battle).not.toBe(battle); // shallow-clone → re-render
      expect(patch.battle).toEqual(battle);
      expect(patch.party).toBeUndefined();
    });
    it('HORS COMBAT → nouveau party (référence fraîche), pas de battle', () => {
      const party = [c('a')];
      const patch = touchActors(state({ party }));
      expect(patch.party).not.toBe(party); // nouvelle liste → re-render
      expect(patch.party).toEqual(party);
      expect(patch.battle).toBeUndefined();
    });
  });
});
