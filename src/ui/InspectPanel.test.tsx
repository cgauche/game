import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InspectPanel } from './InspectPanel';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { creatureToCombatant } from '../state/spawn';
import { findCreature } from '../data';

/** L'inspection rend le statbloc COMPLET via le composant partagé du Codex (CodexSections) +
 *  une tête vivante (nom, PB, psychologie, États). On vérifie la présence des données clés. */
describe('InspectPanel', () => {
  const render = (c: Parameters<typeof InspectPanel>[0]['combatant']) =>
    renderToStaticMarkup(<InspectPanel combatant={c} onClose={() => {}} />);

  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Gunnar', rng: makeRNG(3) });

  it('nom, PB et statbloc (caractéristiques partagées)', () => {
    const html = render(hero);
    expect(html).toContain('Gunnar');
    expect(html).toContain('PB');
    expect(html).toContain('Caractéristiques'); // titre de section partagé avec le Codex
    expect(html).toContain('CC'); // une caractéristique dans la grille
    expect(html).toContain('Taille');
  });

  it('ennemi du bestiaire : « – » pour une carac inexistante, traits cliquables (CodexRef)', () => {
    const wolf = creatureToCombatant(findCreature('Loup')!, 'e1', { x: 0, y: 0 });
    const html = render(wolf);
    expect(html).toContain('–'); // carac « – » (Schéma des Profils, LDB 76)
    expect(html).toContain('Vision nocturne'); // trait
    expect(html).toContain('codex-ref'); // trait enrobé en CodexRef (lien vers la fiche)
    expect(html).toContain('Traits'); // section partagée
    expect(html).toContain('Armes'); // arme dérivée du trait (Morsure)
  });

  it('badge 🪄 + section Sorts si l’ennemi connaît des sorts', () => {
    const caster = creatureToCombatant(findCreature('Mutant')!, 'e1', { x: 0, y: 0 }, { spells: ['flechette'] });
    const html = render(caster);
    expect(html).toContain('Lanceur de sorts');
    expect(html).toContain('Sorts');
  });
});
