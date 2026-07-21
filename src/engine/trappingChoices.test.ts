import { describe, it, expect } from 'vitest';
import { resolveTrappingChoices } from './trappingChoices';
import { trappingRefLabel, type TrappingRef } from '../data/index';

describe('resolveTrappingChoices', () => {
  it('choice sans entrée dans choices -> 1re branche (défaut)', () => {
    const ref: TrappingRef = { choice: [{ id: 'epee' }, { id: 'hache' }] };
    expect(resolveTrappingChoices([ref], {})).toEqual([{ id: 'epee' }]);
  });

  it('choice avec entrée pointant le libellé de la 2e branche -> la résout', () => {
    const ref: TrappingRef = { choice: [{ id: 'epee' }, { id: 'hache' }] };
    const label = trappingRefLabel(ref);
    expect(resolveTrappingChoices([ref], { [label]: trappingRefLabel({ id: 'hache' }) })).toEqual([{ id: 'hache' }]);
  });

  it('choice imbriqué (récursif) -> résout jusqu\'à la feuille', () => {
    const inner: TrappingRef = { choice: [{ id: 'dague' }, { id: 'gourdin' }] };
    const outer: TrappingRef = { choice: [inner, { id: 'hache' }] };
    expect(resolveTrappingChoices([outer], {})).toEqual([{ id: 'dague' }]);
  });

  it('wildcard avec id choisi -> {id}', () => {
    const ref: TrappingRef = { wildcard: 'arme' };
    const label = trappingRefLabel(ref);
    expect(resolveTrappingChoices([ref], { [label]: 'epee' })).toEqual([{ id: 'epee' }]);
  });

  it('wildcard sans entrée -> inchangé', () => {
    const ref: TrappingRef = { wildcard: 'arme' };
    expect(resolveTrappingChoices([ref], {})).toEqual([ref]);
  });

  it('refs concrètes (id/text/creatureId/vehicleId) passent inchangées', () => {
    const refs: TrappingRef[] = [
      { id: 'epee' },
      { text: 'Réseau d\'informateurs' },
      { creatureId: 'cheval' },
      { vehicleId: 'charrette' },
    ];
    expect(resolveTrappingChoices(refs, {})).toEqual(refs);
  });

  it('trappingRefLabel({choice}) joint les branches par " ou "', () => {
    const ref: TrappingRef = { choice: [{ text: 'A' }, { text: 'B' }] };
    expect(trappingRefLabel(ref)).toBe('A ou B');
  });
});
