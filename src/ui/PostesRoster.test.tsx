import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PostesRoster, nextPinned } from './PostesRoster';
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

  it('disclosure DÉPLIÉE (initialOpen) : la grille déploie TOUTES les options, le poste courant en primaire', () => {
    const html = render({ heroes: [hero({ id: 'h1', name: 'Hilda' })], currentOf: () => 'plein-air', initialOpen: 'h1' });
    expect(html).toContain('rm-loc-grid'); // la grille OptionChooser est déployée
    expect(html).toContain('Plein air');
    expect(html).toContain('Approvisionnement'); // TOUTES les options sont désormais rendues
    expect(html).toContain('Monter le camp');
    expect(html).toContain('btn-primary'); // le poste courant ressort (primary)
  });

  it('disclosure ne déplie QUE le héros ciblé (initialOpen ne fuit pas sur les autres)', () => {
    const html = render({
      heroes: [hero({ id: 'h1', name: 'Hilda' }), hero({ id: 'h2', name: 'Gunnar' })],
      currentOf: (h) => (h.id === 'h1' ? 'plein-air' : 'monter-camp'),
      initialOpen: 'h1',
    });
    // Une SEULE grille d'options est déployée (celle de h1) ; h2 reste replié (juste sa puce).
    expect(html.match(/rm-loc-grid/g)?.length).toBe(1);
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

describe('nextPinned — décision d’épinglage au clic (logique du handler, sans DOM)', () => {
  it('aucun poste épinglé → clic épingle le poste choisi', () => {
    expect(nextPinned(undefined, 'plein-air')).toBe('plein-air');
  });
  it('un autre poste épinglé → clic change pour le poste choisi', () => {
    expect(nextPinned('approvisionnement', 'plein-air')).toBe('plein-air');
  });
  it('re-clic sur le poste DÉJÀ épinglé → détache (null, retour « auto »)', () => {
    expect(nextPinned('plein-air', 'plein-air')).toBeNull();
  });
});
