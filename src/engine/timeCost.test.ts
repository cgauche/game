import { describe, it, expect } from 'vitest';
import { TIME_COST } from './timeCost';

describe('timeCost — coûts-temps des actions', () => {
  it('expose des coûts-temps positifs par catégorie d’action', () => {
    expect(TIME_COST.combatRound).toBeGreaterThan(0);
    expect(TIME_COST.sceneMovePerTile).toBeGreaterThanOrEqual(0);
    expect(TIME_COST.search).toBeGreaterThan(0);
    expect(TIME_COST.dialogue).toBeGreaterThanOrEqual(0);
    expect(TIME_COST.sceneTransition).toBeGreaterThanOrEqual(0);
  });
});
