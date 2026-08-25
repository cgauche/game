/**
 * Schéma de `tables.json` — Tables d'EFFETS référençables (`EffectTable`, `src/data/effectTables.ts`).
 * Rangées `[min,max] → GameOp[]` tirées par l'op `rollTable` variante `tableId`. Miroir de `mutationTables`
 * mais la rangée porte des `GameOp` (forme LOOSE `gameOpSchema`) au lieu d'un id de mutation.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';
import { gameOpSchema } from '../grammaire/mecanique';

export const file = 'tables.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    die: z.enum(['d10', 'd100']),
    source: sourceRefSchema.optional(),
    rows: z.array(
      z.strictObject({
        min: z.number(),
        max: z.number(),
        label: z.string().optional(),
        ops: z.array(gameOpSchema),
      }),
    ),
  }),
);
