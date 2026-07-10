/**
 * Schéma de `ship-construction.json` — CONSTRUIRE UN NAVIRE (MDG ch.12 l.108-193). Consommé par
 * `src/engine/shipBuild.ts` (`DATA as unknown as { ... }`, cast inline reflété ICI 1:1) : tableau
 * CARACTÉRISTIQUES DE BATEAU STANDARD, Propulsion, Manœuvrabilité, Traits de vitesse, Traits de
 * construction. `size` = `ShipSize` (`src/data/index.ts:1255`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'ship-construction.json';

const shipSize = z.enum(['minuscule', 'tres-petite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse']);
const propulsionRow = z.strictObject({ m: z.number(), crew: z.number() });

export const schema = z.strictObject({
  standard: z.array(
    z.strictObject({
      size: shipSize,
      costGold: z.number(),
      crew: z.number(),
      /** Absent pour les catégories non propulsables à la voile/à la rame (l.133). */
      sail: propulsionRow.optional(),
      oars: propulsionRow.optional(),
      lengthM: z.tuple([z.number(), z.number()]),
      e: z.number(),
      b: z.number(),
      capacity: z.number(),
      source: sourceRefSchema,
    }),
  ),
  propulsion: z.strictObject({ secondaryMalus: z.number(), secondaryMinM: z.number(), source: sourceRefSchema }),
  manoeuvrability: z.array(z.strictObject({ manDR: z.number(), costPct: z.number(), source: sourceRefSchema })),
  speedTraits: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      mMod: z.number(),
      capacityPct: z.number(),
      manDR: z.number(),
      costPct: z.number(),
      source: sourceRefSchema,
    }),
  ),
  constructionTraits: z.array(
    z.strictObject({
      id: z.string(),
      maxLevel: z.number(),
      costPctPerLevel: z.number(),
      ePerLevel: z.number().optional(),
      bPctPerLevel: z.number().optional(),
      capacityPctPerLevel: z.number().optional(),
      source: sourceRefSchema,
    }),
  ),
});

export type ShipConstructionData = z.infer<typeof schema>;
