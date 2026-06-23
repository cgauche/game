import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TravelRolesPanelView } from './TravelRolesPanel';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant>): Combatant => ({
  id: 'h', name: 'Hilda', kind: 'hero',
  characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...p,
} as Combatant);

describe('TravelRolesPanelView', () => {
  it('rend une ligne par héros avec ses Activités de voyage', () => {
    const html = renderToStaticMarkup(
      <TravelRolesPanelView heroes={[hero({ id: 'h1', name: 'Hilda' }), hero({ id: 'h2', name: 'Gunnar' })]} onSet={() => {}} />,
    );
    expect(html).toContain('Rôles de marche');
    expect(html).toContain('Hilda');
    expect(html).toContain('Gunnar');
    expect(html).toContain('Plein air'); // une Activité de voyage du catalogue
  });

  it('marque le rôle épinglé en primaire et signale le rôle inféré « auto »', () => {
    const html = renderToStaticMarkup(
      <TravelRolesPanelView heroes={[hero({ id: 'h1', name: 'Hilda', travelRole: 'plein-air' }), hero({ id: 'h2', name: 'Gunnar' })]} onSet={() => {}} />,
    );
    expect(html).toContain('btn-primary'); // le rôle courant ressort
    expect(html).toContain('(auto)'); // Gunnar, rôle inféré non épinglé
  });

  it('aucun héros → composant nul', () => {
    expect(renderToStaticMarkup(<TravelRolesPanelView heroes={[]} onSet={() => {}} />)).toBe('');
  });
});
