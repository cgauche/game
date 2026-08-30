/**
 * `trappingRefSchema` (`src/data/schemas/grammaire/reference.ts`) — branche `{creatureId}` ouverte au SOCLE
 * POSSESSIONS #615/#617 §9 (dotation BÊTE, `creatures.json`), en plus des branches existantes.
 */
import { describe, it, expect } from 'vitest';
import { trappingRefSchema } from './reference';
import { flowTestSchema, gameOpSchema } from './mecanique';
import { TESTS_DE_CORRUPTION } from './valeurs';
import { corruptionExposureSchema } from '../defs-scenes/effets';
import { menaceIds } from '../../../engine/menace';
import { resolveTrappingChoices } from '../../../engine/trappingChoices';
import { trappingRefLabel, type TrappingRef } from '../../index';

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
 * (LDB 10 l.1016-1020). La liste est OUVERTE côté RAW : elle n'est donc PAS figée dans le code, elle
 * est résolue au catalogue (`talents.json`) à la VALIDATION. Un tag hors catalogue est refusé au
 * chargement DEV (`dev-validate`), au contrat CI (`schema-contract.test.ts`) et à la sauvegarde Codex.
 */
describe('flowTestSchema.menace — FK vers les specs du talent Résistance', () => {
  const parse = (menace?: string) => flowTestSchema.safeParse({ skill: { id: 'resistance' }, ...(menace != null ? { menace } : {}) });

  it('accepte un id de spec EXISTANT, et l’absence de tag', () => {
    for (const id of menaceIds()) expect(parse(id).success, `spec authorée « ${id} » refusée`).toBe(true);
    expect(parse().success).toBe(true); // un Test sans Menace reste valide
    expect(menaceIds().length).toBeGreaterThan(0); // le catalogue mesuré n'est pas vide
  });

  it('REFUSE le libellé capitalisé (« Poison ») — un id n’est pas un label', () => {
    const r = parse('Poison');
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message).join('\n')).toContain('menace « Poison »');
  });

  it('REFUSE un id hors catalogue, et le message DIT la valeur ET les valeurs admises', () => {
    const r = parse('exposition');
    expect(r.success).toBe(false);
    const msg = r.error!.issues.map((i) => i.message).join('\n');
    expect(msg).toContain('menace « exposition »');
    expect(msg).toContain('resistance');
    for (const id of menaceIds()) expect(msg).toContain(id);
  });
});

/**
 * `corruptionExposure.skill` (`refTestDeCorruption`, `grammaire/valeurs.ts`) — le Test d'Exposition se
 * joue avec l'UNE des deux Compétences que la règle offre (`LDB 19 l.23-75`). Une référence de
 * Compétence NUE laisserait passer les 100+ entrées de `skills.json` : le runtime
 * (`state/corruptionFlow.ts`) les raboterait en silence et la donnée mentirait. Les DEUX portes du
 * même concept — l'op `GameOp` et l'effet de scène — partagent la MÊME borne.
 */
describe('corruptionExposure.skill — borné aux deux Compétences du Test (LDB 19 l.23-75)', () => {
  const portes = {
    'op GameOp': (skill?: { id: string }) => gameOpSchema.safeParse({ op: 'corruptionExposure', level: 'mineure', ...(skill ? { skill } : {}) }),
    'effet de scène': (skill?: { id: string }) => corruptionExposureSchema.safeParse({ type: 'corruptionExposure', level: 'mineure', ...(skill ? { skill } : {}) }),
  };

  for (const [nom, parse] of Object.entries(portes)) {
    it(`${nom} : accepte les deux Compétences de l'alphabet, et l'absence (choix du joueur)`, () => {
      expect(TESTS_DE_CORRUPTION).toEqual(['resistance', 'calme']);
      for (const id of TESTS_DE_CORRUPTION) expect(parse({ id }).success, `« ${id} » refusé`).toBe(true);
      expect(parse().success).toBe(true);
    });

    it(`${nom} : REFUSE une Compétence hors alphabet, et le message NOMME la valeur et la paire`, () => {
      const r = parse({ id: 'charme' });
      expect(r.success).toBe(false);
      const msg = r.error!.issues.map((i) => i.message).join('\n');
      expect(msg).toContain('charme');
      expect(msg).toContain('resistance');
      expect(msg).toContain('calme');
      expect(msg).toContain('LDB 19 l.23-75');
    });
  }
});
