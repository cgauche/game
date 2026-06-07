import { describe, it, expect } from 'vitest';
import { attackModifiers } from './combat';
import type { Combatant, Weapon } from './types';

const SWORD: Weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] };

function mk(opts: Partial<Combatant>): Combatant {
  return {
    id: 'c', name: 'c', kind: 'enemy', advantage: 0, conditions: [],
    characteristics: {} as never, size: 'moyenne', psychState: [], groups: [],
    weapons: [SWORD], armour: {} as never, skills: [], talents: [], movement: 4,
    wounds: { current: 10, max: 10 }, ...opts,
  } as Combatant;
}

describe('attackModifiers — effets des Traits psy ciblés (LDB 21, P3)', () => {
  it('Animosité active vs un membre du groupe Cible → +10 (+1 DR)', () => {
    const att = mk({ psychState: [{ type: 'animosite', cible: 'Elfes', active: true }] });
    const tgt = mk({ id: 't', groups: ['Elfe', 'Soldat'] });
    const mods = attackModifiers(att, tgt, SWORD, { kind: 'melee' });
    expect(mods.some((m) => m.value === 10 && /Anim|Haine/i.test(m.label))).toBe(true);
  });

  it('Animosité active vs un NON-membre → aucun bonus', () => {
    const att = mk({ psychState: [{ type: 'animosite', cible: 'Elfes', active: true }] });
    const tgt = mk({ id: 't', groups: ['Humain'] });
    const mods = attackModifiers(att, tgt, SWORD, { kind: 'melee' });
    expect(mods.some((m) => /Anim|Haine/i.test(m.label))).toBe(false);
  });

  it('Animosité INACTIVE (résistée) → aucun bonus', () => {
    const att = mk({ psychState: [{ type: 'animosite', cible: 'Elfes', active: false }] });
    const tgt = mk({ id: 't', groups: ['Elfe'] });
    const mods = attackModifiers(att, tgt, SWORD, { kind: 'melee' });
    expect(mods.some((m) => /Anim|Haine/i.test(m.label))).toBe(false);
  });

  it('Haine active vs le groupe haï → immunité à la Peur de cette source (pas de −10) + bonus', () => {
    const tgt = mk({ id: 't', groups: ['Skaven'] });
    const att = mk({
      psychState: [
        { type: 'peur', sourceId: 't', indice: 2, calmeDR: 0 },
        { type: 'haine', cible: 'Skavens', active: true },
      ],
    });
    const mods = attackModifiers(att, tgt, SWORD, { kind: 'melee' });
    expect(mods.some((m) => m.label === 'Peur')).toBe(false); // immunité Haine (l.41)
    expect(mods.some((m) => m.value === 10)).toBe(true);
  });

  it('Peur sans immunité → −10', () => {
    const tgt = mk({ id: 't', groups: [] });
    const att = mk({ psychState: [{ type: 'peur', sourceId: 't', indice: 2, calmeDR: 0 }] });
    const mods = attackModifiers(att, tgt, SWORD, { kind: 'melee' });
    expect(mods.some((m) => m.label === 'Peur' && m.value === -10)).toBe(true);
  });

  it('Amour actif → immunité Peur + +10 (défend les aimés)', () => {
    const tgt = mk({ id: 't', groups: [] });
    const att = mk({
      psychState: [
        { type: 'peur', sourceId: 't', indice: 2, calmeDR: 0 },
        { type: 'amour', cible: 'Famille', active: true },
      ],
    });
    const mods = attackModifiers(att, tgt, SWORD, { kind: 'melee' });
    expect(mods.some((m) => m.label === 'Peur')).toBe(false);
    expect(mods.some((m) => m.value === 10 && /Amour|Camaraderie/i.test(m.label))).toBe(true);
  });
});
