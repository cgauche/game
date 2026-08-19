/**
 * `trappingRefSchema` (`src/data/schemas/common.ts`) — branche `{creatureId}` ouverte au SOCLE
 * POSSESSIONS #615/#617 §9 (dotation BÊTE, `creatures.json`), en plus des branches existantes.
 */
import { describe, it, expect } from 'vitest';
import { trappingRefSchema, flowTestSchema } from './common';
import { menaceIds } from '../../engine/menace';
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

/**
 * `flowTestSchema.menace` (#1346) — CLÉ ÉTRANGÈRE vers un id de spec du talent « Résistance (Menace) »
 * (LDB 10 l.1015-1021). La liste est OUVERTE côté RAW : elle n'est donc PAS figée dans le code, elle
 * est résolue au catalogue (`talents.json`) à la VALIDATION. Un tag hors catalogue est refusé au
 * chargement DEV (`dev-validate`), au contrat CI (`schema-contract.test.ts`) et à la sauvegarde Codex.
 */
describe('flowTestSchema.menace — FK vers les specs du talent Résistance', () => {
  const parse = (menace?: string) => flowTestSchema.safeParse({ skill: 'resistance', ...(menace != null ? { menace } : {}) });

  it('accepte un id de spec EXISTANT, et l’absence de tag', () => {
    for (const id of menaceIds()) expect(parse(id).success, `spec authorée « ${id} » refusée`).toBe(true);
    expect(parse().success).toBe(true); // un Test sans Menace reste valide
    expect(menaceIds().length).toBeGreaterThan(0); // le catalogue mesuré n'est pas vide
  });

  it('REFUSE le libellé capitalisé (« Poison ») — un id n’est pas un label', () => {
    const r = parse('Poison');
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toContain('menace « Poison »');
  });

  it('REFUSE un id hors catalogue, et le message DIT la valeur ET les valeurs admises', () => {
    const r = parse('exposition');
    expect(r.success).toBe(false);
    const msg = r.error!.issues[0].message;
    expect(msg).toContain('menace « exposition »');
    expect(msg).toContain('resistance');
    for (const id of menaceIds()) expect(msg).toContain(id);
  });
});
