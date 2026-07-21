/**
 * `trappingRefSchema` (`src/data/schemas/common.ts`) — branche `{creatureId}` ouverte au SOCLE
 * POSSESSIONS #615/#617 §9 (dotation BÊTE, `creatures.json`), en plus des branches existantes.
 */
import { describe, it, expect } from 'vitest';
import { trappingRefSchema } from './common';
import { resolveTrappingChoices } from '../../engine/trappingChoices';
import { trappingRefLabel, type TrappingRef } from '../index';

describe('trappingRefSchema — branches de TrappingRef', () => {
  it('accepte {id} de catalogue (+ count optionnel)', () => {
    expect(trappingRefSchema.safeParse({ id: 'epee-courte' }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ id: 'epee-courte', count: { fixed: 2 } }).success).toBe(true);
  });

  it('accepte {text} narratif hors catalogue', () => {
    expect(trappingRefSchema.safeParse({ text: 'collection d’alcool sans pareille' }).success).toBe(true);
  });

  it('accepte {vehicleId} — dotation véhicule', () => {
    expect(trappingRefSchema.safeParse({ vehicleId: 'chariot-leger' }).success).toBe(true);
  });

  it('accepte {creatureId} — dotation bête (#615/#617 §9)', () => {
    expect(trappingRefSchema.safeParse({ creatureId: 'mule' }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ creatureId: 'mule', count: { fixed: 1 } }).success).toBe(true);
  });

  it('refuse un mélange de branches (strictObject)', () => {
    expect(trappingRefSchema.safeParse({ id: 'epee-courte', vehicleId: 'chariot-leger' }).success).toBe(false);
    expect(trappingRefSchema.safeParse({ creatureId: 'mule', vehicleId: 'chariot-leger' }).success).toBe(false);
  });

  it('accepte {choice} — dotation « X ou Y » migrée (chantier #654 Lot 3)', () => {
    const ref = { choice: [{ id: 'arbalete-de-poing' }, { id: 'pistolet' }] };
    expect(trappingRefSchema.safeParse(ref).success).toBe(true);
  });

  it('{choice} migré (Arbalète de poing ou pistolet) résout la 2e branche via resolveTrappingChoices', () => {
    const ref: TrappingRef = { choice: [{ id: 'arbalete-de-poing' }, { id: 'pistolet' }] };
    const label = trappingRefLabel(ref);
    expect(resolveTrappingChoices([ref], { [label]: trappingRefLabel({ id: 'pistolet' }) })).toEqual([
      { id: 'pistolet' },
    ]);
  });
});
