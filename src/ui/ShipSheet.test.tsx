import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipStateBlock, ShipCrewByRole, PosteDetail } from './ShipSheet';
import type { Combatant, SkillInstance } from '../engine/types';

const mk = (id: string, dex: number, skills: { skillId: string; advances: number; spec?: string }[] = [], shipRole?: string): Combatant =>
  ({
    id, name: id, kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: dex, Int: 30, FM: 30, Soc: 30 },
    skills: skills.map((s) => ({ ...s, characteristic: 'Dex' }) as SkillInstance),
    conditions: [], talents: [], wounds: { current: 10, max: 10, base: 10 }, shipRole,
  }) as unknown as Combatant;

type Poste = NonNullable<Combatant['postes']>[number];
const poste = (name: string, uid: string, side: string, crewIds: string[]): Poste =>
  ({ item: { name, uid }, side, crewIds }) as unknown as Poste;

describe('ShipSheet — fiche du navire (état · postes · rôles)', () => {
  it('ShipStateBlock : coque, cap, Moral, effectif', () => {
    const crew = [mk('Anna', 60, [{ skillId: 'voile', advances: 30 }], 'timonier')];
    const ship = { id: 'ship', name: 'La Cogue', wounds: { current: 40, max: 50 }, conditions: [] } as unknown as Combatant;
    const html = renderToStaticMarkup(<ShipStateBlock ship={ship} cap="N" morale={75} crew={crew} />);
    expect(html).toContain('40/50'); // coque
    expect(html).toContain('Nord');  // cap
    expect(html).toContain('1/1');   // effectif apte/total
  });

  it('ShipCrewByRole : rôles de manœuvre + essentiel marqué + assignation', () => {
    const crew = [mk('Anna', 60, [{ skillId: 'voile', advances: 30 }], 'timonier')];
    const html = renderToStaticMarkup(<ShipCrewByRole crew={crew} onSet={() => {}} />);
    // Les 5 rôles de 'manoeuvre' (crew-test-types.json).
    expect(html).toContain('Timonier');
    expect(html).toContain('Capitaine');
    expect(html).toContain('Navigateur');
    expect(html).toContain('Mousse');
    expect(html).toContain('Chansonnier');
    expect(html).toContain('★');           // Timonier essentiel (DR ×2)
    expect(html).toContain('+ assigner');  // entrée de l'assignation par portrait
  });

  it('PosteDetail : le poste sélectionné affiche son bord + son nom + son servant', () => {
    const soldat = mk('Soldat', 50, [{ skillId: 'projectiles', advances: 20, spec: 'poudre-noire' }]);
    const ship = { id: 'ship', name: 'La Cogue', conditions: [] } as unknown as Combatant;
    const html = renderToStaticMarkup(<PosteDetail hull={ship} poste={poste('Pierrier', 'p1', 'tribord', ['Soldat'])} combatants={[ship, soldat]} />);
    expect(html).toContain('Tribord');
    expect(html).toContain('Pierrier');
    expect(html).toContain('Soldat');
  });

  it('PosteDetail : poste sans servant → « sans servant »', () => {
    const ship = { id: 'ship', name: 'La Cogue', conditions: [] } as unknown as Combatant;
    const html = renderToStaticMarkup(<PosteDetail hull={ship} poste={poste('Couleuvrine', 'p2', 'babord', [])} combatants={[ship]} />);
    expect(html).toContain('Bâbord');
    expect(html).toContain('— sans servant —');
  });

  it('PosteDetail : le détail change avec le poste sélectionné (maître-détail)', () => {
    const ship = { id: 'ship', name: 'La Cogue', conditions: [] } as unknown as Combatant;
    // Le plan/les puces choisissent LE poste ; PosteDetail n'affiche QUE celui-là.
    const p1 = renderToStaticMarkup(<PosteDetail hull={ship} poste={poste('Pierrier', 'p1', 'tribord', [])} combatants={[ship]} />);
    const p2 = renderToStaticMarkup(<PosteDetail hull={ship} poste={poste('Couleuvrine', 'p2', 'babord', [])} combatants={[ship]} />);
    expect(p1).toContain('Pierrier');
    expect(p1).not.toContain('Couleuvrine');
    expect(p2).toContain('Couleuvrine');
    expect(p2).not.toContain('Pierrier');
  });
});
