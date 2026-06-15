import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { checkTriggers } from './combatEffects';
import type { Scene, Trigger } from './scene';

/** Intégration : `temporalCondition` doit gater le trigger dans `checkTriggers` — il ne se déclenche
 *  qu'en étant DANS la zone ET DANS la fenêtre horaire. On observe un effet `journal` (évite la
 *  question du flag) et on pilote `gameTime` au cran près. */
const sceneWith = (trigger: Trigger): Scene => ({
  id: 't', nom: 't', description: '', dimensions: { w: 5, h: 5 }, ambiance: 'interieur',
  tiles: new Array(25).fill('sol'), entities: [], buildings: [], dialogues: [], triggers: [trigger], encounters: [], flags: {},
});

const spotTrigger: Trigger = {
  id: 'spot', rect: { x: 0, y: 0, w: 5, h: 5 }, once: false,
  temporalCondition: { afterHour: 21, afterMinute: 30, beforeHour: 21, beforeMinute: 45 },
  effects: [{ type: 'journal', text: 'TIC' }],
};

describe('temporalCondition — intégration checkTriggers (proximité ET fenêtre horaire)', () => {
  beforeEach(() => useGame.setState({ battle: null }));

  function run(gameTime: number, partyPos = { x: 2, y: 2 }) {
    useGame.setState({ scene: sceneWith(spotTrigger), partyPos, gameTime, journal: [], flags: {} });
    checkTriggers(useGame.getState, useGame.setState);
    return useGame.getState().journal.join('|');
  }

  it('dans la zone mais AVANT la fenêtre (21:29) → ne se déclenche pas', () => {
    expect(run(21 * 60 + 29)).not.toContain('TIC');
  });
  it('dans la zone ET dans la fenêtre (21:35) → se déclenche', () => {
    expect(run(21 * 60 + 35)).toContain('TIC');
  });
  it('dans la fenêtre mais HORS de la zone → ne se déclenche pas', () => {
    expect(run(21 * 60 + 35, { x: 9, y: 9 })).not.toContain('TIC');
  });
  it('À la borne `before` (21:45, EXCLUSIVE) → ne se déclenche pas', () => {
    expect(run(21 * 60 + 45)).not.toContain('TIC');
  });
});
