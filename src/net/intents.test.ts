/**
 * Garde-fou de l'allowlist coop : chaque intent DOIT exister comme action du store (un
 * renommage d'action casse ici, pas en prod chez un invité) — et l'allowlist reste
 * combat-only (aucune action de persistance/économie n'y traîne).
 */
import { describe, it, expect } from 'vitest';
import { useGame } from '../state/store';
import { GUEST_INTENTS, PARTY_INTENTS } from './intents';

describe('allowlist coop (net/intents)', () => {
  it('chaque intent correspond à une action existante du store', () => {
    const state = useGame.getState() as unknown as Record<string, unknown>;
    const missing = [...GUEST_INTENTS].filter((name) => typeof state[name] !== 'function');
    expect(missing).toEqual([]);
  });

  it('la composition du groupe est allowlistée (chaque joueur remplit SES emplacements)', () => {
    for (const name of ['partyAddHero', 'partyRemoveHero']) {
      expect(PARTY_INTENTS.has(name), name).toBe(true);
      expect(GUEST_INTENTS.has(name), name).toBe(true);
    }
  });

  it('aucune action de persistance/économie/exploration dans l’allowlist (périmètre combat + groupe)', () => {
    for (const forbidden of ['saveGame', 'loadGame', 'importGame', 'buyItem', 'sellItem', 'payCart',
      'startTravel', 'moveParty', 'transitionTo', 'startInterlude', 'interludeEnd', 'loadProject',
      'startScene', 'setParty', 'grantXp', 'seedRng', 'netAssignSlot', 'netAssign']) {
      expect(GUEST_INTENTS.has(forbidden), forbidden).toBe(false);
    }
  });
});
