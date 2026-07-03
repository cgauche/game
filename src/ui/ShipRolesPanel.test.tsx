import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipRolesPanelView } from './ShipRolesPanel';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant>): Combatant => ({
  id: 'h', name: 'Hilda', kind: 'hero',
  characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...p,
} as Combatant);

describe('ShipRolesPanelView — postes d’équipage naval (MDG ch.14)', () => {
  it('rend une ligne par héros avec les rôles du navire', () => {
    const html = renderToStaticMarkup(
      <ShipRolesPanelView heroes={[hero({ id: 'h1', name: 'Hilda' }), hero({ id: 'h2', name: 'Gunnar' })]} onSet={() => {}} />,
    );
    expect(html).toContain('Postes d’équipage');
    expect(html).toContain('Hilda');
    expect(html).toContain('Gunnar');
    expect(html).toContain('Capitaine'); // un rôle du catalogue crew-roles
    expect(html).toContain('Timonier');
  });

  it('marque le poste épinglé en primaire et signale le poste inféré « auto »', () => {
    // Hilda épingle Capitaine ; Gunnar a une avance en Voile → poste inféré Timonier (non épinglé, « auto »).
    const html = renderToStaticMarkup(
      <ShipRolesPanelView
        heroes={[
          hero({ id: 'h1', name: 'Hilda', shipRole: 'capitaine' }),
          hero({ id: 'h2', name: 'Gunnar', skills: [{ skillId: 'voile', characteristic: 'Ag', advances: 20 }] }),
        ]}
        onSet={() => {}}
      />,
    );
    expect(html).toContain('btn-primary'); // le poste courant ressort
    expect(html).toContain('(auto)'); // Gunnar, poste inféré non épinglé
  });

  it('aucun héros → composant nul', () => {
    expect(renderToStaticMarkup(<ShipRolesPanelView heroes={[]} onSet={() => {}} />)).toBe('');
  });
});
