/**
 * Schéma de `mutationTables.json` — Tableaux de Corruption (LDB 19, EDOC…), miroir de `MutationTable`
 * (`src/data/mutations.ts:25-29`). Plages d100 → référence de mutation par id (`ranges[].mutation`).
 * Inventaire réel (17 tables) : `id`/`label`/`ranges[{min,max,mutation}]` seulement.
 */
import { z } from 'zod';

export const file = 'mutationTables.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    ranges: z.array(
      z.strictObject({
        min: z.number(),
        max: z.number(),
        /** id d'une entrée de `mutations.json` (résolu par `rollMutation`/`BY_ID`). */
        mutation: z.string(),
      }),
    ),
  }),
);

export type MutationTablesData = z.infer<typeof schema>;
