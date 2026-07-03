import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TopoScene } from './TopoScene';
import { emptyScene } from '../state/scene';
import type { Station } from '../state/stations';

/**
 * SMOKE SSR de TopoScene (env node : rendu serveur, pas de DOM interactif — le contrat de CLIC est
 * couvert par le câblage direct `onSelectStation` + la géométrie pure `topoMarkers.test`). On vérifie
 * que le composant s'assemble (sols/murs symboliques + marqueur de station cliquable) sans erreur.
 */
function station(over: Partial<Station> = {}): Station {
  return {
    id: 's1',
    kind: 'poste',
    pos: { x: 1, y: 1 },
    label: 'Baliste',
    icon: 'action/serve-engine',
    faction: 'ally',
    assignedIds: ['c1'],
    manned: true,
    ref: { kind: 'poste', hullId: 'h1', posteUid: 'p1' },
    ...over,
  };
}

describe('TopoScene — smoke SSR', () => {
  it('rend un <svg> top-down + un marqueur de station en zone cliquable (role=button, badge)', () => {
    const html = renderToStaticMarkup(
      <TopoScene scene={emptyScene(3, 3)} stations={[station()]} selectedStationId="s1" onSelectStation={() => {}} />,
    );
    expect(html).toContain('class="topo-scene"');
    expect(html).toContain('class="topo-station"');
    expect(html).toContain('role="button"'); // zone cliquable réelle (pas de chasse au pixel)
    expect(html).toContain('>1</text>'); // badge = 1 équipier assigné
  });
});
