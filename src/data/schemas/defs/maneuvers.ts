/**
 * Schéma de `maneuvers.json` — manœuvres/attaques naturelles de créature (LDB 85), résolues ENTIÈREMENT
 * depuis cette donnée par `state/combatManeuvers.resolveManeuver` (`ManeuverDef`, `src/data/index.ts:691`).
 * `kind` = `AttackKind` (`src/engine/creatureAttacks.ts:21`, anim/pose/icône seulement — jamais la
 * résolution). `effects` = `TriggeredEffect<EffectOp>[]` (`src/engine/flowCore.ts`), PROMU dans
 * `common.ts` (`conditionSchema`/`flowSchema`/`triggeredEffectSchema` — ex-dupliqués à l'identique
 * dans `qualities.ts`/`talents.ts`/`etats.ts`/`spells.ts`).
 */
import { z } from 'zod';
import { charKeySchema, sourceRefSchema, triggeredEffectSchema } from '../common';

export const file = 'maneuvers.json';

/** `ManeuverMeasure` (`src/data/index.ts:687-690`) — Portée/Souffle en mètres = `bonus(ref) + plus`. */
const maneuverMeasure = z.strictObject({
  bonusOf: charKeySchema.optional(),
  plus: z.number().optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    kind: z.enum(['arme', 'morsure', 'caudale', 'cornes', 'souffle', 'vomi', 'tentacules', 'etreinte', 'regard', 'langue', 'hurlement']),
    activation: z.enum(['action', 'free', 'charge']),
    advantageCost: z.number(),
    advantageMode: z.enum(['fixed', 'variable', 'all']).optional(),
    stat: z.enum(['CC', 'CT']).optional(),
    defense: z.enum(['esquive', 'parade', 'init', 'resist', 'auto']).optional(),
    targeting: z.enum(['melee', 'ranged', 'zone', 'allFoes', 'self']),
    range: maneuverMeasure.optional(),
    blast: maneuverMeasure.optional(),
    magic: z.boolean().optional(),
    effects: z.array(triggeredEffectSchema),
    desc: z.string().optional(),
    /** `ManeuverDef.source` est OPTIONNEL en TS mais présent sur les 20/20 entrées réelles. */
    source: sourceRefSchema,
    priority: z.number().optional(),
  }),
);

export type ManeuversData = z.infer<typeof schema>;
