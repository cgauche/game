import { describe, it, expect } from 'vitest';
import { resolveParts } from './resolve';
import { careerTenueFor } from './career';
import { armourPart } from './equipment';
import type { EquipCtx } from './equipment';
import type { ItemInstance, Weapon } from '../../../engine/types';

const empty: EquipCtx = { weapons: [], armour: [] };
const wep = (name: string, type: 'melee' | 'ranged'): Weapon => ({ name, type, damage: '+4', qualities: [] } as Weapon);
const plastron: ItemInstance = { uid: '1', name: 'Plastron', kind: 'armor', qualities: [], pa: 4, locs: ['corps'], enc: 1, equipped: true };

describe('resolveParts — priorité', () => {
  it('sans rien : torse = tenue de la carrière (par-carrière)', () => {
    const r = resolveParts('Humain', 'M', 'Soldat', empty, {}, 1);
    expect(r.torse?.svg).toBe(careerTenueFor('Soldat').torse?.svg);
  });

  it('armure équipée sur le corps PRIME sur la tenue de carrière', () => {
    const equip: EquipCtx = { weapons: [], armour: [plastron] };
    const r = resolveParts('Humain', 'M', 'Soldat', equip, {}, 1);
    expect(r.torse?.svg).toBe(armourPart(plastron, 'torse')?.svg);
    expect(r.torse?.svg).not.toBe(careerTenueFor('Soldat').torse?.svg);
  });

  it('arme et bouclier suivent l’équipement', () => {
    const equip: EquipCtx = { weapons: [wep('Hache', 'melee')], armour: [], shield: { name: 'Bouclier', qualities: ['Bouclier'] } as unknown as Weapon };
    const r = resolveParts('Humain', 'M', 'Soldat', equip, {}, 1);
    expect(r.arme?.svg).toContain('<');
    expect(r.bouclier?.svg).toContain('<');
  });

  it('override éditeur (parts) PRIME sur l’équipement', () => {
    const equip: EquipCtx = { weapons: [], armour: [plastron] };
    const r = resolveParts('Humain', 'M', 'Soldat', equip, { torse: 0 }, 1);
    expect(r.torse?.svg).not.toBe(armourPart(plastron, 'torse')?.svg);
  });

  it('visage et cheveux sont toujours présents', () => {
    const r = resolveParts('Humain', 'M', 'Soldat', empty, {}, 1);
    expect(r.visage?.svg).toContain('<');
    expect(r.cheveux?.svg).toContain('<');
  });
});
