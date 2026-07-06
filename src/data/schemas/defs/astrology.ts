/**
 * Schéma de `astrology.json` — Demeures célestes (ADE2 ch.03 l.502-512). Dérivé du contenu RÉEL
 * (5 demeures) et de `CelestialHouseData` (`src/data/index.ts:1075`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

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

export type AstrologyData = z.infer<typeof schema>;
