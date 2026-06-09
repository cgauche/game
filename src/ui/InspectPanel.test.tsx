import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectPanel } from './InspectPanel';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

/** Substitut visuel : on vérifie que le panneau d'inspection rend bien les données clés
 *  du combattant (nom, PV, caractéristiques, armes, armure) sans planter. */
describe('InspectPanel', () => {
  const c = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Gunnar', rng: makeRNG(3) });

  it('affiche le nom, les PV et une caractéristique', () => {
    const html = renderToStaticMarkup(<InspectPanel combatant={c} onClose={() => {}} />);
    expect(html).toContain('Gunnar');
    expect(html).toContain('PB'); // barre/compteur de Points de Blessure
    expect(html).toContain('CC'); // capacité de combat
  });

  it('affiche les armes et la ligne d’armure', () => {
    const html = renderToStaticMarkup(<InspectPanel combatant={c} onClose={() => {}} />);
    expect(html).toContain('Armes');
    expect(html).toContain('Armure');
  });
});
