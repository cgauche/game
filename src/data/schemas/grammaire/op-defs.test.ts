/**
 * `OP_DEFS` (`grammaire/mecanique.ts`) — payload strict par op, repli nominatif, rouge au SITE.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { conditionSchema, gameOpSchema, OP_DEFS, OPS_NON_TYPEES } from './mecanique';
import { applyOps, messageRecurrenceHorloge } from '../../../engine/ops';
import type { Combatant } from '../../../engine/types';

describe('OP_DEFS — payload strict par op, repli nominatif, rouge au SITE', () => {
  it('une op TYPÉE valide son payload et refuse un champ étranger', () => {
    expect(gameOpSchema.safeParse({ op: 'heal', amount: { dice: { n: 1, sides: 10 } } }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'heal', amount: 2, perSL: { every: 2, amount: 1 } }).success).toBe(true);
    const res = gameOpSchema.safeParse({ op: 'heal', amount: 2, champInvente: true });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/GameOp « heal »/);
    expect(gameOpSchema.safeParse({ op: 'kill' }).success).toBe(true);
    expect(gameOpSchema.safeParse({ op: 'kill', cible: 'x' }).success).toBe(false);
  });

  it('une op NON TYPÉE garde la forme loose', () => {
    expect(OPS_NON_TYPEES).toContain('narrative');
    expect(gameOpSchema.safeParse({ op: 'narrative', text: 'un récit', quoiQueCeSoit: 3 }).success).toBe(true);
  });

  /** `condition` reste LOOSE, mais la combinaison que `applyOps` lève en plein combat (récurrence
   *  comptée en Rounds vs durée d'HORLOGE) se refuse déjà AU PARSE, du MÊME message. */
  it('une op LOOSE ne passe pas les refus mesurés : `condition` à `perRound` + durée d’horloge est refusée au PARSE', () => {
    expect(OPS_NON_TYPEES).toContain('condition');
    expect(gameOpSchema.safeParse({ op: 'condition', id: 'inconscient', perRound: true, durationRounds: 3 }).success).toBe(true);
    for (const duree of [{ durationHours: 1 }, { durationMinutes: 30 }]) {
      const res = gameOpSchema.safeParse({ op: 'condition', id: 'inconscient', perRound: true, ...duree });
      expect(res.success, JSON.stringify(duree)).toBe(false);
      expect(res.error!.issues.map((i) => i.path.join('.'))).toContain('perRound');
      expect(res.error!.issues[0].message).toBe(messageRecurrenceHorloge('inconscient'));
    }
    expect(() => applyOps(
      { id: 'c', label: 'Cobaye', kind: 'hero', characteristics: {}, wounds: { current: 5, max: 5 }, advantage: 0, conditions: [], movement: 4, weapons: [], armour: {}, skills: [], talents: [] } as unknown as Combatant,
      [{ op: 'condition', id: 'inconscient', perRound: true, durationHours: 1 }],
      {},
    ), 'le PARSE et l’APPLICATION disent le même refus').toThrow(messageRecurrenceHorloge('inconscient'));
  });

  it('une op inconnue des DEUX registres est NOMMÉE en erreur', () => {
    const res = gameOpSchema.safeParse({ op: 'nImporteQuoi' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toMatch(/GameOp « nImporteQuoi » : op inconnue de OP_DEFS et de OPS_NON_TYPEES/);
  });

  it('une op TYPÉE au payload FAUX est refusée AU CHAMP (le gate ne s’arrête pas au nom de l’op)', () => {
    // `heal.amount` est un nombre ou une Formula — une chaîne n'en est ni l'un ni l'autre. Le rouge
    // doit venir du CHAMP (`amount`), pas du repli nominatif : sans cela, une op nommée juste passerait
    // avec n'importe quelle charge utile.
    const res = gameOpSchema.safeParse({ op: 'heal', amount: 'beaucoup' });
    expect(res.success).toBe(false);
    const issues = res.error!.issues;
    expect(issues.map((i) => i.path.join('.'))).toContain('amount');
    // Le CODE d'issue du payload est REPORTÉ (jamais aplati en `custom`) : c'est lui le contrat, la
    // phrase appartient à la locale. Le préfixe `GameOp « heal » : ` est du code MAISON, lui stable.
    expect(issues.map((i) => i.code)).toContain('invalid_union');
    expect(JSON.stringify(issues)).toMatch(/GameOp « heal » : /);
  });

  it('une op TYPÉE à CLÉ EN TROP est refusée par la clé NOMMÉE, pas par un message générique', () => {
    const res = gameOpSchema.safeParse({ op: 'kill', zzz: 1 });
    expect(res.success).toBe(false);
    expect(res.error!.issues.map((i) => i.code)).toContain('unrecognized_keys');
    expect(JSON.stringify(res.error!.issues)).toMatch(/zzz/);
  });

  it('la clé `op` SURCHARGÉE d’une `Condition` (comparateur) ne passe pas par ce rouge', () => {
    for (const comparateur of ['>=', '<=', '>', '<', '==']) {
      const cond = { kind: 'slThreshold', op: comparateur, value: 2 };
      expect(conditionSchema.safeParse(cond).success).toBe(true);
    }
  });

  it('les deux registres sont DISJOINTS et couvrent EXACTEMENT les ops du moteur, sans compte magique', () => {
    const typees = Object.keys(OP_DEFS);
    expect(typees.filter((o) => OPS_NON_TYPEES.includes(o))).toEqual([]);
    // La référence est la SOURCE `src/engine/ops.ts` : chaque branche littérale de l'union `GameOp`
    // (`rollTable` en porte 2, dédoublonnées par l'ensemble). Égalité d'ensembles BIDIRECTIONNELLE :
    // une op moteur non couverte comme une entrée orpheline sont NOMMÉES.
    const source = readFileSync(new URL('../../../engine/ops.ts', import.meta.url), 'utf8');
    const opsDuMoteur = new Set([...source.matchAll(/^\s*\|\s*\{\s*op:\s*'([^']+)'/gm)].map((m) => m[1]));
    expect(opsDuMoteur.size).toBeGreaterThan(0);
    const couvertes = new Set([...typees, ...OPS_NON_TYPEES]);
    expect([...opsDuMoteur].filter((o) => !couvertes.has(o)).sort()).toEqual([]);
    expect([...couvertes].filter((o) => !opsDuMoteur.has(o)).sort()).toEqual([]);
  });
});
