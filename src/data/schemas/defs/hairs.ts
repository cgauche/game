/**
 * Schéma de `hairs.json` — table Couleur des Cheveux (LDB 05 l.698-744, 2d10), consommée comme
 * `DetailColorData[]` (`src/data/index.ts:655`, partagée avec `eyes.json`).
 */
import { z } from 'zod';
import { raceKeySchema } from '../common';

export const file = 'hairs.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    rand: z.number(),
    /** Clé = `raceKeySchema` (id stable, #313) — partiel (7 colonnes, pas toutes présentes par entrée). */
    color: z.partialRecord(raceKeySchema, z.string()),
  }),
);

export type HairsData = z.infer<typeof schema>;
