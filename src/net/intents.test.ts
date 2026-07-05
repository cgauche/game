/**
 * Garde-fou de l'allowlist coop : chaque intent DOIT exister comme action du store (un
 * renommage d'action casse ici, pas en prod chez un invité) — et l'allowlist reste
 * combat-only (aucune action de persistance/économie n'y traîne).
 */
import { describe, it, expect } from 'vitest';
import { useGame } from '../state/store';
import { GUEST_INTENTS, PARTY_INTENTS, INTERLUDE_INTENTS, sanitizeIntentArgs } from './intents';

describe('allowlist coop (net/intents)', () => {
  it('chaque intent correspond à une action existante du store', () => {
    const state = useGame.getState() as unknown as Record<string, unknown>;
    const missing = [...GUEST_INTENTS].filter((name) => typeof state[name] !== 'function');
    expect(missing).toEqual([]);
  });

  it('la composition du groupe est allowlistée (chaque joueur remplit SES emplacements)', () => {
    for (const name of ['partyAddHero', 'partyRemoveHero', 'partyReplaceHero']) {
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

describe('sanitizeIntentArgs — l’événement React ne part pas sur le réseau (audit coop)', () => {
  it('tronque la queue non sérialisable (événement circulaire, fonction) sans toucher aux vrais args', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular; // un SyntheticEvent est circulaire (nativeEvent/target)
    expect(sanitizeIntentArgs(['h2', 'stash', 120, circular])).toEqual(['h2', 'stash', 120]);
    expect(sanitizeIntentArgs([circular])).toEqual([]);
    expect(sanitizeIntentArgs([() => {}])).toEqual([]);
    expect(sanitizeIntentArgs(['h1', { x: 1 }])).toEqual(['h1', { x: 1 }]);
  });
});

describe('Activités d’interlude allowlistées (audit M7) — l’ouverture/clôture reste à l’hôte', () => {
  it('les activités par héros et le flux de jet sont permis à l’invité', () => {
    for (const name of INTERLUDE_INTENTS) expect(GUEST_INTENTS.has(name), name).toBe(true);
    expect(INTERLUDE_INTENTS.has('interludeActivity')).toBe(true); // chemin UNIQUE des Activités à jet
    expect(INTERLUDE_INTENTS.has('activityConfirm')).toBe(true);
  });
});
