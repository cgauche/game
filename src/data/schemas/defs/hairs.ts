/**
 * Schéma de `hairs.json` — table Couleur des Cheveux (LDB 05 l.698-744, 2d10), consommée comme
 * `DetailColorData[]` (`src/data/index.ts:655`, partagée avec `eyes.json`).
 */
import { z } from 'zod';

export const file = 'hairs.json';

export const schema = z.array(
  z.strictObject({
    label: z.string(),
    rand: z.number(),
    color: z.record(z.string(), z.string()),
  }),
);

export type HairsData = z.infer<typeof schema>;
