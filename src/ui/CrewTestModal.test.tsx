/**
 * CrewTestModal — l'action « Annuler » n'existe QU'EN COMBAT (undo de misclic). Un Test d'équipage
 * de VOYAGE est à résolution forcée (le flux `crewTest` ne déclare pas `cancel`) : l'annuler figerait
 * la boucle de traversée (`runSeaDays` ne reprendrait jamais). #211.
 *
 * Corps PUR testé en props (patron `ShipDossierView`/`ShipDossier` — cf. docs/architecture.md) :
 * pas de mock du store, robuste sous `isolate:false` (aucun `vi.mock` requis par cette suite).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PendingCrewTest } from '../state/pendings';
import type { BattleState } from '../state/store';
import { CrewTestModalView } from './CrewTestModal';

const noop = () => {};

const pending = (over: Partial<PendingCrewTest>): PendingCrewTest => ({
  shipId: 'ship1', testTypeId: 'progression', moraleScore: 0, participants: [], ...over,
});

const render = (p: PendingCrewTest, battle: BattleState | null) =>
  renderToStaticMarkup(
    <CrewTestModalView
      p={p} battle={battle} party={[]} owns={() => true}
      roll={noop} reroll={noop} bonus={noop} darkPact={noop} force={noop}
      confirm={noop} cancel={noop} cont={noop}
    />
  );

describe('CrewTestModal — annulation réservée au COMBAT (#211)', () => {
  it('Test de VOYAGE : aucune action « Annuler » (résolution forcée)', () => {
    const html = render(pending({ voyage: { kind: 'progression', shipName: 'La Cogue' } }), null);
    expect(html).toContain('La Cogue'); // la modale rend bien
    expect(html).not.toContain('Annuler');
  });

  it('Test de COMBAT : « Annuler » présent (Action défaisable)', () => {
    const html = render(pending({}), { combatants: [{ id: 'ship1', name: 'Le Loup' }] } as unknown as BattleState);
    expect(html).toContain('Le Loup');
    expect(html).toContain('Annuler');
  });
});
