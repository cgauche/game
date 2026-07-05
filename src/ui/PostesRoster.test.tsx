import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PostesRoster } from './PostesRoster';
import type { Poste } from '../state/poste';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant>): Combatant => ({
  id: 'h', name: 'Hilda', kind: 'hero',
  characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...p,
} as Combatant);

const POSTES: Poste[] = [
  { id: 'plein-air', label: 'Plein air', skills: [], cardinality: 'heroExclusive' },
  { id: 'approvisionnement', label: 'Approvisionnement', skills: [], cardinality: 'heroExclusive' },
  { id: 'monter-camp', label: 'Monter le camp', skills: [], cardinality: 'heroExclusive' },
];

const render = (props: Partial<Parameters<typeof PostesRoster>[0]> = {}) =>
  renderToStaticMarkup(
    <PostesRoster
      title="Rôles de marche"
      heroes={[hero({ id: 'h1', name: 'Hilda' }), hero({ id: 'h2', name: 'Gunnar' })]}
      postes={POSTES}
      currentOf={(h) => (h.id === 'h1' ? 'plein-air' : 'monter-camp')}
      pinnedOf={() => undefined}
      onSet={() => {}}
      {...props}
    />,
  );

describe('PostesRoster — roster héros-first avec disclosure', () => {
  it('rend le titre, un héros par ligne, et la puce du poste COURANT de chacun', () => {
    const html = render();
    expect(html).toContain('Rôles de marche');
    expect(html).toContain('Hilda');
    expect(html).toContain('Gunnar');
    expect(html).toContain('Plein air'); // puce courante de Hilda
    expect(html).toContain('Monter le camp'); // puce courante de Gunnar
  });

  it('disclosure : les postes NON courants restent repliés (pas le mur d’options)', () => {
    const html = render({ heroes: [hero({ id: 'h1', name: 'Hilda' })], currentOf: () => 'plein-air' });
    expect(html).toContain('Plein air'); // la puce courante
    expect(html).not.toContain('Approvisionnement'); // les autres options ne sont pas rendues (repliées)
  });

  it('badge « auto » quand le poste courant n’est PAS épinglé', () => {
    const html = render({ heroes: [hero({ id: 'h1', name: 'Hilda' })], currentOf: () => 'plein-air', pinnedOf: () => undefined });
    expect(html).toContain('(auto)');
  });

  it('pas de badge « auto » quand le poste est ÉPINGLÉ', () => {
    const html = render({ heroes: [hero({ id: 'h1', name: 'Hilda' })], currentOf: () => 'plein-air', pinnedOf: () => 'plein-air' });
    expect(html).not.toContain('(auto)');
  });

  it('poste courant absent → puce « — choisir — »', () => {
    const html = render({ heroes: [hero({ id: 'h1', name: 'Hilda' })], currentOf: () => null });
    expect(html).toContain('— choisir —');
  });

  it('aucun héros → composant nul', () => {
    expect(render({ heroes: [] })).toBe('');
  });
});
