/**
 * Schéma de `sea-shanties.json` — Chansons de marin (MDG 9), `SeaShantyData`
 * (`src/data/index.ts`). `crewOps`/`captainOps` = `GameOp[]` (même vocabulaire que
 * traits/qualités). `note` = clause RAW laissée à l'arbitrage MJ, affichée telle quelle (jamais un
 * effet inventé).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';
import { gameOpSchema } from '../grammaire/mecanique';

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
