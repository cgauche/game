/**
 * Schéma de `hairs.json` — table Couleur des Cheveux (LDB 05 l.698-744, 2d10), consommée comme
 * `DetailColorData[]` (`src/data/index.ts:655`, partagée avec `eyes.json`).
 */
import { z } from 'zod';
import { raceKeySchema, sourceRefSchema } from '../common';

export const file = 'hairs.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    rand: z.number(),
    /** Clé = `raceKeySchema` (id stable, #313) — partiel (7 colonnes, pas toutes présentes par entrée). */
    color: z.partialRecord(raceKeySchema, z.string()),
    /** Provenance MAJORITAIRE (5/7 colonnes LDB) ; `note` détaille les 2 colonnes hors LDB
     *  (gnome NADJ, ogre ADE2) — `sourceRefSchema` ne porte qu'UN livre par entrée. */
    source: sourceRefSchema.optional(),
  }),
);

export type HairsData = z.infer<typeof schema>;
