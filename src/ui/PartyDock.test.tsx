import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PartyDock } from './PartyDock';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

describe('PartyDock', () => {
  const h1 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', rng: makeRNG(3) });
  const h2 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Elsa', rng: makeRNG(4) });
  h1.id = 'h1'; h2.id = 'h2';

  it('une tuile par héros, PV chiffrés affichés, actif marqué', () => {
    h1.wounds = { current: 11, max: 11 };
    const html = renderToStaticMarkup(<PartyDock heroes={[h1, h2]} activeId="h2" onOpen={() => {}} />);
    expect(html).toContain('party-dock');
    expect(html).toContain('11/11'); // showPv sur le dock
    expect(html.match(/▼/g)?.length).toBe(1); // h2 actif
  });
});
