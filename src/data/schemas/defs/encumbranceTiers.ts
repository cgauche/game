/**
 * Schéma de `encumbranceTiers.json` — Profils de pénalité d'Encombrement par palier (LDB 61 p.295),
 * consommé par `src/engine/encumbrance.ts:43` (`EncumbrancePenalties[]`, qui ignore `id`/`label`).
 * Tableau de 4 entrées à index FIXE (0 = aucune pénalité … 3 = immobilisé). `movePenalty: null`
 * UNIQUEMENT sur le palier immobilisé (le flag `immobile` court-circuite avant lecture — cf.
 * commentaire du consommateur). `id`/`label` = identité STABLE du palier, ajoutée pour l'exposition
 * Codex (#422).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'encumbranceTiers.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    movePenalty: z.number().nullable(),
    moveFloor: z.number(),
    agilityPenalty: z.number(),
    travelFatigue: z.number(),
    immobile: z.boolean(),
    source: sourceRefSchema.optional(),
  }),
);

export type EncumbranceTiersData = z.infer<typeof schema>;
