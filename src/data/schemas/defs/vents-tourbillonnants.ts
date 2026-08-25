/**
 * Schéma de `vents-tourbillonnants.json` — Tableau des Vents Tourbillonnants (LDB 46 l.183-190),
 * consommé par `src/engine/windsOfMagic.ts` (`{ table: WindsEntry[] }`, lookup `findTableEntry` sur 1d10).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'vents-tourbillonnants.json';
export const famille = 'table';

export const schema = z.strictObject({
  table: z.array(
    z.strictObject({
      id: z.string(),
      min: z.number(),
      max: z.number(),
      mod: z.number(),
      label: z.string(),
    }),
  ),
  source: sourceRefSchema.optional(),
});
