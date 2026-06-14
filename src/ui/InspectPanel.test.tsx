import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectPanel } from './InspectPanel';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { creatureToCombatant } from '../state/spawn';
import { findCreature } from '../data';

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

  it('affiche Mouvement et Taille', () => {
    const html = renderToStaticMarkup(<InspectPanel combatant={c} onClose={() => {}} />);
    expect(html).toContain('>M</b>');
    expect(html).toContain('Taille');
    expect(html).toContain('Moyenne');
  });

  it('ennemi du bestiaire : « – » pour une caractéristique inexistante, chips de traits avec desc (LDB 85)', () => {
    const wolf = creatureToCombatant(findCreature('Loup')!, 'e1', { x: 0, y: 0 });
    const html = renderToStaticMarkup(<InspectPanel combatant={wolf} onClose={() => {}} />);
    expect(html).toContain('–'); // CT « – » (Schéma des Profils, LDB 76)
    expect(html).toContain('insp-trait-chip');
    expect(html).toContain('Vision nocturne'); // libellé du trait
    expect(html).toContain('codex-ref'); // enrobé en CodexRef (popover desc+source au survol, portal)
  });

  it('badge 🪄 si l’ennemi connaît des sorts', () => {
    const caster = creatureToCombatant(findCreature('Mutant')!, 'e1', { x: 0, y: 0 }, { spells: ['Fléchette'] });
    const html = renderToStaticMarkup(<InspectPanel combatant={caster} onClose={() => {}} />);
    expect(html).toContain('Lanceur de sorts');
  });
});
