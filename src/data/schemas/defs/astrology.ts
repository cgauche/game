/**
 * Schéma de `astrology.json` — Demeures célestes (ADE II 3 l.502-512). Dérivé du contenu RÉEL
 * (5 demeures) et de `CelestialHouseData` (`src/data/index.ts`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'astrology.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    rand: z.number(),
    desc: z.string(),
    source: sourceRefSchema,
  }),
);
