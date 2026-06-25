import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipRolesPanelView } from './ShipRolesPanel';
import type { Combatant, SkillInstance } from '../engine/types';

const mk = (id: string, dex: number, skills: { skillId: string; advances: number; spec?: string }[] = [], shipRole?: string): Combatant =>
  ({
    id, name: id, kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: dex, Int: 30, FM: 30, Soc: 30 },
    skills: skills.map((s) => ({ ...s, characteristic: 'Dex' }) as SkillInstance),
    conditions: [], talents: [], wounds: { current: 10, max: 10, base: 10 }, shipRole,
  }) as unknown as Combatant;

describe('ShipRolesPanel — interface de gestion (assignation + état)', () => {
  it('liste l’équipage apte avec ses rôles + l’état du navire (coque, cap, postes, effectif)', () => {
    const crew = [
      mk('Anna', 60, [{ skillId: 'voile', advances: 30 }], 'timonier'),
      mk('Bjorn', 40, [{ skillId: 'projectiles', advances: 20, spec: 'Poudre noire' }]), // inféré → artilleur (auto)
    ];
    const ship = { id: 'ship', name: 'La Cogue', bodyShape: 'vehicule', wounds: { current: 40, max: 50 }, conditions: [],
      postes: [{ side: 'tribord' }, { side: 'tribord' }], crewIds: ['Anna', 'Bjorn'] } as unknown as Combatant;
    const html = renderToStaticMarkup(
      <ShipRolesPanelView ship={ship} crew={crew} cap="N" morale={75} onSet={() => {}} />,
    );
    expect(html).toContain('La Cogue');
    expect(html).toContain('Anna');
    expect(html).toContain('Bjorn');
    expect(html).toContain('Timonier'); // rôle (option)
    expect(html).toContain('Artilleur'); // rôle (option)
    expect(html).toContain('Tribord'); // pièces par bord
    expect(html).toContain('40/50'); // coque
    expect(html).toContain('(auto)'); // Bjorn : rôle inféré non épinglé
  });

  it('équipage vide → rendu sans rangée de rôle (parité TravelRolesPanel)', () => {
    const ship = { id: 'ship', name: 'Épave', bodyShape: 'vehicule', wounds: { current: 0, max: 10 }, conditions: [], crewIds: [] } as unknown as Combatant;
    const html = renderToStaticMarkup(<ShipRolesPanelView ship={ship} crew={[]} morale={75} onSet={() => {}} />);
    expect(html).toContain('Épave');
    expect(html).not.toContain('wm-role-row');
  });
});
