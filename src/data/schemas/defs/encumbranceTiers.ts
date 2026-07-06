/**
 * Schéma de `encumbranceTiers.json` — Profils de pénalité d'Encombrement par palier (LDB p.295),
 * consommé par `src/engine/encumbrance.ts:43` (`EncumbrancePenalties[]`). Tableau de 4 entrées à
 * index FIXE (0 = aucune pénalité … 3 = immobilisé). `movePenalty: null` UNIQUEMENT sur le palier
 * immobilisé (le flag `immobile` court-circuite avant lecture — cf. commentaire du consommateur).
 */
import { z } from 'zod';

export const file = 'encumbranceTiers.json';

export const schema = z.array(
  z.strictObject({
    tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    movePenalty: z.number().nullable(),
    moveFloor: z.number(),
    agilityPenalty: z.number(),
    travelFatigue: z.number(),
    immobile: z.boolean(),
  }),
);

export type EncumbranceTiersData = z.infer<typeof schema>;
