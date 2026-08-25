/**
 * Schéma de `maneuvers.json` — manœuvres/attaques naturelles de créature (LDB 85), résolues ENTIÈREMENT
 * depuis cette donnée par `state/combatManeuvers.resolveManeuver` (`ManeuverDef`, `src/data/index.ts`).
 * `kind` = `AttackKind` (`src/engine/creatureAttacks.ts`, anim/pose/icône seulement — jamais la
 * résolution). `effects` = `TriggeredEffect<EffectOp>[]` (`src/engine/flowCore.ts`), PROMU dans
 * `common.ts` (`conditionSchema`/`flowSchema`/`triggeredEffectSchema` — partagés avec
 * `qualities.ts`/`talents.ts`/`etats.ts`/`spells.ts`).
 *
 * AUCUN champ de PROSE (#1226) : une manœuvre est la PROJECTION mécanique d'un Trait de créature qui la
 * déclare (`TraitData.grantsManeuvers`) et qui porte SEUL le verbatim + l'ancrage. `strictObject` rejette
 * donc tout `desc` ré-ajouté ici. Résolution du trait : `traitProjectingManeuver` (`src/data/index.ts`).
 */
import { z } from 'zod';
import { charKeySchema, sourceRefSchema, stakeFormSchema } from '../grammaire/valeurs';
import { triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'maneuvers.json';
export const famille = 'entite';

/** `ManeuverMeasure` (`src/data/index.ts`) — Portée/Souffle en mètres = `bonus(ref) + plus`. */
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
    stat: z.enum(['capacite-de-combat', 'capacite-de-tir']).optional(),
    defense: z.enum(['esquive', 'parade', 'init', 'resist', 'auto']).optional(),
    targeting: z.enum(['melee', 'ranged', 'zone', 'allFoes', 'allAround', 'self']),
    range: maneuverMeasure.optional(),
    blast: maneuverMeasure.optional(),
    magic: z.boolean().optional(),
    effects: z.array(triggeredEffectSchema),
    /** Folio du Trait PROJETANT (`traitProjectingManeuver`), le seul ancrage : LDB 338-343 pour les
     *  attaques naturelles, Middenheim 115-117 pour les capacités de bestiaire. */
    source: sourceRefSchema,
    priority: z.number().optional(),
    /** ENJEU de l'ENTRÉE (#1117) — ce que la manœuvre met en jeu, COLLÉ à ses `effects` (éditable au
     *  Codex). Rendu par `resolveStake` et PRIORITAIRE sur le gabarit du kind `maneuverDefense`. */
    stake: z.string().optional(),
    stakeForm: stakeFormSchema.optional(),
  }),
);
