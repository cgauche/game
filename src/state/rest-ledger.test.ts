import { describe, it, expect } from 'vitest';
import { ledgerRerollable } from '../ui/MultiRollList';

/**
 * `ledgerRerollable` (primitive `MultiRollList`) — seules les lignes de jet ratées, taguées
 * recalculables (`reKind`), encore vierges, sont proposables à la relance. Repos multi-jours :
 * chaque nuit est une cascade influençable (`state/restFlow.ts` `openRestNight`/`continueRestNights`) ;
 * ce prédicat reste une primitive générique pour tout futur PV multi-jets partiellement relançable.
 */
function d(over: Partial<import('../engine/combat').RollBreakdown>): import('../engine/combat').RollBreakdown {
  return { label: 'Résistance', base: 55, modifier: 0, target: 55, roll: 95, success: false, sl: -4, ...over };
}

describe('ledgerRerollable — seules les lignes de jet ratées, taguées recalculables, encore vierges', () => {
  it('récupération ratée non relancée → true ; réussie / déjà relancée / sans reKind → false', () => {
    expect(ledgerRerollable({ id: 'r', actorId: 'A', label: 'Récup', reKind: 'recovery', d: d({ success: false }) })).toBe(true);
    expect(ledgerRerollable({ id: 'r', actorId: 'A', label: 'Récup', reKind: 'recovery', d: d({ success: true, roll: 8, sl: 3 }) })).toBe(false);
    expect(ledgerRerollable({ id: 'r', actorId: 'A', label: 'Récup', reKind: 'recovery', d: d({ success: false }), rerolled: true })).toBe(false);
    expect(ledgerRerollable({ id: 'x', actorId: 'A', label: 'Exposition', d: d({ success: false }) })).toBe(false); // pas de reKind → lecture seule
    expect(ledgerRerollable({ actorId: 'A', label: 'Note', text: 'jour 3/3' })).toBe(false); // pas de jet
  });
});
