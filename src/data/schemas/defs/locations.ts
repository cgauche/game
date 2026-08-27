/**
 * Schéma de `locations.json` — Lieux de la carte du monde, miroir strict de `LocationData`
 * (`src/data/index.ts`). `parent` est une réf id (≠ libellé) vers un autre `LocationData.id`,
 * ou `null` si racine.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'locations.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    parent: z.string().nullable(),
    prefix: z.string().nullable(),
    suffix: z.string().nullable(),
    desc: z.string().min(1).optional(),
    source: sourceRefSchema,
  }),
);
