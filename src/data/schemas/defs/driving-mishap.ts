/**
 * Schéma de `driving-mishap.json` — Tableau des Accidents de Conduite d'attelage EN SCÈNE
 * (LDB 09 l.140-149), 1d10. Reflet de `MishapEntry`/`DrivingMishapEffect`
 * (`src/engine/drivingMishap.ts`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'driving-mishap.json';
export const famille = 'table';

export const schema = z.strictObject({
  table: z.array(
    z.strictObject({
      id: z.string(),
      min: z.number(),
      max: z.number(),
      label: z.string(),
      effect: z.enum(['harness', 'jolt', 'wheel', 'crash']),
      desc: z.string(),
    }),
  ),
  source: sourceRefSchema.optional(),
});
