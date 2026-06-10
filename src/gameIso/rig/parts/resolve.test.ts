import { describe, it, expect } from 'vitest';
import { resolveParts } from './resolve';
import { careerTenueFor } from './career';
import { armourPart } from './equipment';
import { pickView } from './types';
import type { EquipCtx } from './equipment';
import type { ItemInstance, Weapon } from '../../../engine/types';

const empty: EquipCtx = { weapons: [], armour: [] };
const wep = (name: string, type: 'melee' | 'ranged'): Weapon => ({ name, type, damage: '+4', qualities: [] } as Weapon);
const plastron: ItemInstance = { uid: '1', name: 'Plastron', kind: 'armor', qualities: [], pa: 4, locs: ['corps'], enc: 1, equipped: true };

describe('resolveParts — priorité', () => {
  it('sans rien : torse = tenue de la carrière (par-carrière)', () => {
    const r = resolveParts('Humain', 'M', 'Soldat', empty, {}, 1);
    expect(r.torse?.svg).toBe(pickView(careerTenueFor('Soldat').torse, 'front'));
  });

  it('armure équipée sur le corps PRIME sur la tenue de carrière', () => {
    const equip: EquipCtx = { weapons: [], armour: [plastron] };
    const r = resolveParts('Humain', 'M', 'Soldat', equip, {}, 1);
    expect(r.torse?.svg).toBe(pickView(armourPart(plastron, 'torse'), 'front'));
    expect(r.torse?.svg).not.toBe(pickView(careerTenueFor('Soldat').torse, 'front'));
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
    expect(r.torse?.svg).not.toBe(pickView(armourPart(plastron, 'torse'), 'front'));
  });

  it('visage et cheveux sont toujours présents', () => {
    const r = resolveParts('Humain', 'M', 'Soldat', empty, {}, 1);
    expect(r.visage?.svg).toContain('<');
    expect(r.cheveux?.svg).toContain('<');
  });
});

describe('resolveParts — dual-wield (main secondaire dessinée)', () => {
  const wh = (name: string, hand: 'main' | 'off', q: string[] = []): Weapon => ({ name, type: 'melee', damage: '+4', qualities: q, hand } as Weapon);

  it('épée + dague (hand off) → la 2e arme est dessinée à la main secondaire (os bouclier)', () => {
    const r = resolveParts('Humain', 'M', 'Soldat', { weapons: [wh('Épée', 'main'), wh('Dague', 'off')], armour: [] }, {}, 1);
    expect(r.arme?.svg).toContain('<');
    expect(r.bouclier?.svg).toContain('<'); // dague dessinée à la main secondaire
  });

  it('épée seule → main secondaire vide', () => {
    const r = resolveParts('Humain', 'M', 'Soldat', { weapons: [wh('Épée', 'main')], armour: [] }, {}, 1);
    expect(r.bouclier?.svg ?? '').toBe('');
  });

  it('épée + bouclier → le bouclier prime sur une arme à la main secondaire', () => {
    const shield = { name: 'Bouclier', type: 'melee', damage: '+4', qualities: ['Bouclier'], hand: 'off' } as unknown as Weapon;
    const r = resolveParts('Humain', 'M', 'Soldat', { weapons: [wh('Épée', 'main'), shield], armour: [], shield }, {}, 1);
    expect(r.bouclier?.svg).toContain('<');
  });
});
