/**
 * CrewTestModal — l'action « Annuler » n'existe QU'EN COMBAT (undo de misclic). Un Test d'équipage
 * de VOYAGE est à résolution forcée (le flux `crewTest` ne déclare pas `cancel`) : l'annuler figerait
 * la boucle de traversée (`runSeaDays` ne reprendrait jamais). #211.
 *
 * Le store est MOCKÉ (env `node` : `renderToStaticMarkup` + zustand ne lisent que l'état INITIAL,
 * cf. les autres tests d'UI qui rendent des composants sans store) — on injecte l'état lu par la modale.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const h = vi.hoisted(() => ({ state: {} as Record<string, unknown>, noop: () => {} }));
const noop = h.noop;

vi.mock('../state/store', () => ({
  useGame: Object.assign((sel: (s: Record<string, unknown>) => unknown) => sel(h.state), {
    getState: () => h.state,
    setState: h.noop,
  }),
}));

import { CrewTestModal } from './CrewTestModal';

function setState(pending: Record<string, unknown>, battle: Record<string, unknown> | null) {
  h.state = {
    pendingCrewTest: pending, battle, party: [], net: { mode: 'local' },
    crewTestRoll: noop, crewTestReroll: noop, crewTestBonusSL: noop, crewTestDarkPact: noop,
    crewTestForceSuccess: noop, crewTestConfirm: noop, crewTestCancel: noop,
  };
}

const pending = (over: Record<string, unknown>) => ({ shipId: 'ship1', testTypeId: 'progression', moraleScore: 0, participants: [], ...over });

describe('CrewTestModal — annulation réservée au COMBAT (#211)', () => {
  it('Test de VOYAGE : aucune action « Annuler » (résolution forcée)', () => {
    setState(pending({ voyage: { kind: 'progression', shipName: 'La Cogue' } }), null);
    const html = renderToStaticMarkup(<CrewTestModal />);
    expect(html).toContain('La Cogue'); // la modale rend bien
    expect(html).not.toContain('Annuler');
  });

  it('Test de COMBAT : « Annuler » présent (Action défaisable)', () => {
    setState(pending({}), { combatants: [{ id: 'ship1', name: 'Le Loup' }] });
    const html = renderToStaticMarkup(<CrewTestModal />);
    expect(html).toContain('Le Loup');
    expect(html).toContain('Annuler');
  });
});
