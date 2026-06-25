import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipStateBlock, ShipCrewRoles } from './ShipSheet';
import type { Combatant, SkillInstance } from '../engine/types';

const mk = (id: string, dex: number, skills: { skillId: string; advances: number; spec?: string }[] = [], shipRole?: string): Combatant =>
  ({
    id, name: id, kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: dex, Int: 30, FM: 30, Soc: 30 },
    skills: skills.map((s) => ({ ...s, characteristic: 'Dex' }) as SkillInstance),
    conditions: [], talents: [], wounds: { current: 10, max: 10, base: 10 }, shipRole,
  }) as unknown as Combatant;

describe('ShipSheet — état + assignation des rôles (fiche du navire)', () => {
  it('ShipStateBlock : coque, cap, Moral, effectif, pièces par bord', () => {
    const crew = [mk('Anna', 60, [{ skillId: 'voile', advances: 30 }], 'timonier')];
    const ship = { id: 'ship', name: 'La Cogue', wounds: { current: 40, max: 50 }, conditions: [],
      postes: [{ side: 'tribord' }, { side: 'tribord' }] } as unknown as Combatant;
    const html = renderToStaticMarkup(<ShipStateBlock ship={ship} cap="N" morale={75} crew={crew} />);
    expect(html).toContain('40/50');   // coque
    expect(html).toContain('Nord');    // cap
    expect(html).toContain('Tribord'); // pièces par bord
    expect(html).toContain('1/1');     // effectif apte/total
  });

  it('ShipCrewRoles : équipage apte + rôles (épinglé vs auto)', () => {
    const crew = [
      mk('Anna', 60, [{ skillId: 'voile', advances: 30 }], 'timonier'),
      mk('Bjorn', 40, [{ skillId: 'projectiles', advances: 20, spec: 'Poudre noire' }]), // inféré → artilleur (auto)
    ];
    const html = renderToStaticMarkup(<ShipCrewRoles crew={crew} onSet={() => {}} />);
    expect(html).toContain('Anna');
    expect(html).toContain('Bjorn');
    expect(html).toContain('Timonier');
    expect(html).toContain('Artilleur');
    expect(html).toContain('(auto)'); // Bjorn : rôle inféré non épinglé
  });

  it('équipage vide → aucune rangée de rôle', () => {
    const html = renderToStaticMarkup(<ShipCrewRoles crew={[]} onSet={() => {}} />);
    expect(html).not.toContain('wm-role-row');
  });
});
