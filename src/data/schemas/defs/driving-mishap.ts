/**
 * Schéma de `driving-mishap.json` — Tableau des Accidents de Conduite d'attelage EN SCÈNE
 * (LDB 09 l.140-149), 1d10. Reflet de `MishapEntry`/`DrivingMishapOutcome`. L'ISSUE tirée est
 * `outcome` — graphie du dépôt pour une issue de table (`sea-navigation.json::orientation.reperes`,
 * `mecanique.ts::travelTableEntry.mount.outcome`), la MÉCANIQUE exécutable restant `ops`
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
      outcome: z.enum(['harness', 'jolt', 'wheel', 'crash']),
      desc: z.string(),
    }),
  ),
  source: sourceRefSchema.optional(),
});
