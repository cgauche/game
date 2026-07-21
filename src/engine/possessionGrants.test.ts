import { describe, it, expect } from 'vitest';
import { possessionGrantsFromRefs } from './possessionGrants';
import type { TrappingRef } from '../data';

describe('possessionGrantsFromRefs (#617/#618 SOCLE POSSESSIONS Lot 1)', () => {
  it('{vehicleId} → grant vehicule avec-le-groupe, owner = ownerId', () => {
    const refs: TrappingRef[] = [{ vehicleId: 'barque' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-1');
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ nature: 'vehicule', vehicleId: 'barque', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [] });
  });

  it('{creatureId} → grant bete (ref.creatureId), avec-le-groupe, owner = ownerId', () => {
    const refs: TrappingRef[] = [{ creatureId: 'mule' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-2');
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ nature: 'bete', ref: { creatureId: 'mule' }, ownerId: 'hero-2', location: { kind: 'avec-le-groupe' }, items: [] });
  });

  it('count.fixed > 1 → autant de grants DISTINCTS (aucun aliasing d\'objet/items/location)', () => {
    const refs: TrappingRef[] = [{ creatureId: 'mule', count: { fixed: 3 } }];
    const grants = possessionGrantsFromRefs(refs, 'h');
    expect(grants).toHaveLength(3);
    expect(grants[0]).not.toBe(grants[1]);
    expect(grants[1]).not.toBe(grants[2]);
    expect(grants[0].items).not.toBe(grants[1].items);
    expect(grants[0].location).not.toBe(grants[1].location);
  });

  it('{id} (objet de sac) et {text} (flavor) ignorés — pas des possessions', () => {
    const refs: TrappingRef[] = [{ id: 'baril' }, { text: 'Réseau d\'informateurs' }];
    expect(possessionGrantsFromRefs(refs, 'h')).toHaveLength(0);
  });

  it('mix de refs — seuls creatureId/vehicleId produisent, dans l\'ordre', () => {
    const refs: TrappingRef[] = [{ id: 'baril' }, { vehicleId: 'chariot-leger' }, { creatureId: 'mule' }, { text: 'flavor' }];
    const grants = possessionGrantsFromRefs(refs, 'h');
    expect(grants.map((g) => g.nature)).toEqual(['vehicule', 'bete']);
  });

  it('{creatureId, label} → le label propre de la dotation est transporté sur la PossessionInput', () => {
    const refs: TrappingRef[] = [{ creatureId: 'blaireau', label: 'Gros blaireau apprivoisé' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-3');
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ nature: 'bete', ref: { creatureId: 'blaireau' }, label: 'Gros blaireau apprivoisé' });
  });

  it('{creatureId} SANS label → aucun `label` posé (repli sur le libellé de créature via possessionLabel)', () => {
    const refs: TrappingRef[] = [{ creatureId: 'mule' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-4');
    expect(grants[0]).not.toHaveProperty('label');
  });

  it('{vehicleId, label} → le label propre de la dotation est transporté sur la PossessionInput', () => {
    const refs: TrappingRef[] = [{ vehicleId: 'barque', label: 'La Perle Grise' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-5');
    expect(grants[0]).toMatchObject({ nature: 'vehicule', vehicleId: 'barque', label: 'La Perle Grise' });
  });
});
