/**
 * Schéma de `eyes.json` — table Couleur des Yeux (LDB 05 l.698-744, 2d10), consommée comme
 * `DetailColorData[]` (`src/data/index.ts:655`, partagée avec `hairs.json`).
 */
import { z } from 'zod';

export const file = 'eyes.json';

export const schema = z.array(
  z.strictObject({
    label: z.string(),
    rand: z.number(),
    color: z.record(z.string(), z.string()),
  }),
);

export type EyesData = z.infer<typeof schema>;
