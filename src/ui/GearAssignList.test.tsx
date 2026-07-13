import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GearAssignList } from './GearAssignList';
import type { LootGear } from '../state/store';
import type { Combatant } from '../engine/types';

const hero = (id: string, name: string) =>
  ({ id, name, kind: 'hero', wounds: { current: 10, max: 12 }, conditions: [], advantage: 0, weapons: [], skills: [], talents: [], items: [], movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
     characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } }) as unknown as Combatant;

describe('GearAssignList (butin attribuable)', () => {
  it('objet identifié : ses qualités = chips canoniques (EntityRef), plus de texte plat d’ids', () => {
    const gear: LootGear[] = [
      { label: 'Hallebarde', magic: false, effect: { type: 'giveTrapping', trappingId: 'hallebarde', qualities: ['empaleuse'], identified: true } },
    ];
    const html = renderToStaticMarkup(
      <GearAssignList gear={gear} assignable={[hero('h', 'Hans')]} onAssign={() => {}} />,
    );
    expect(html).toContain('entity-chip');
    expect(html).toContain('Empaleuse'); // libellé résolu via le registre, pas l'id « empaleuse »
    expect(html).not.toContain('>empaleuse<'); // l'id brut n'est jamais affiché
  });
});
