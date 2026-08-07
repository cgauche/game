import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PartyDock } from './PartyDock';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

describe('PartyDock', () => {
  const h1 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', rng: makeRNG(3) });
  const h2 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Elsa', rng: makeRNG(4) });
  h1.id = 'h1'; h2.id = 'h2';

  it('conserve Blessures et États sans marquer le héros actif du tour', () => {
    h1.wounds = { current: 11, max: 11 };
    h1.conditions = [{ id: 'assourdi', value: 1 }];
    const html = renderToStaticMarkup(<PartyDock heroes={[h1, h2]} onOpen={() => {}} />);
    expect(html).toContain('party-dock');
    expect(html).toContain('11/11');
    expect(html).toContain('ptile-states');
    expect(html).toContain('pt-state');
    expect(html).not.toContain('ptile-caret');
    expect(html).not.toMatch(/class="ptile[^"]*\bactive\b/);
  });

  it('affiche le nom de chaque héros en TEXTE VISIBLE, pas seulement en infobulle', () => {
    const html = renderToStaticMarkup(<PartyDock heroes={[h1, h2]} onOpen={() => {}} />);
    // Les balises (donc TOUS les attributs : title, aria-label…) sont retirées : ne reste que le
    // texte des nœuds, c'est-à-dire ce qu'un joueur lit à l'écran.
    const visible = html.replace(/<[^>]*>/g, ' ');
    expect(visible).toContain('Gunnar');
    expect(visible).toContain('Elsa');
    expect(html).toMatch(/>\s*Gunnar\s*</);
    expect(html).toMatch(/>\s*Elsa\s*</);
  });
});
