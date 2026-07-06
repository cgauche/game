/**
 * Schéma de `sea-shanties.json` — Chansons de marin (MDG ch.09), `SeaShantyData`
 * (`src/data/index.ts:1300-1307`). `crewOps`/`captainOps` = `GameOp[]` (même vocabulaire que
 * traits/qualités). `note` = clause RAW laissée à l'arbitrage MJ, affichée telle quelle (jamais un
 * effet inventé).
 */
import { z } from 'zod';
import { gameOpSchema, sourceRefSchema } from '../common';

export const file = 'sea-shanties.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    crewOps: z.array(gameOpSchema).optional(),
    captainOps: z.array(gameOpSchema).optional(),
    note: z.string().optional(),
    source: sourceRefSchema,
  }),
);

export type SeaShantiesData = z.infer<typeof schema>;
