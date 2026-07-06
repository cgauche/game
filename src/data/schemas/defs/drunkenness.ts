/**
 * Schéma de `drunkenness.json` — Tableau d'Ivresse (LDB 09 l.475-481), consommé par
 * `src/engine/drunkenness.ts:47` (`{ table: DrunkEntry[] }`, lookup `findTableEntry` sur 1d10).
 * `effect` = clé de dispatch mécanique lue par `applyDrunkResult` (switch `src/engine/drunkenness.ts:104`) —
 * enum EXACTEMENT les 5 valeurs des `case` (+ `min`/`max` = les 5 entrées réelles du JSON, 1-10).
 */
import { z } from 'zod';

export const file = 'drunkenness.json';

export const schema = z.strictObject({
  table: z.array(
    z.strictObject({
      id: z.string(),
      min: z.number(),
      max: z.number(),
      name: z.string(),
      effect: z.enum(['bravoure', 'ami', 'staggering', 'belligerent', 'blackout']),
      desc: z.string(),
    }),
  ),
});

export type DrunkennessData = z.infer<typeof schema>;
