/**
 * Schéma de `drunkenness.json` — Tableau d'Ivresse (LDB 09 l.475-481), consommé par
 * `src/engine/drunkenness.ts:47` (`{ table: DrunkEntry[] }`, lookup `findTableEntry` sur 1d10).
 * `effect` = id STABLE narratif (Mouvement OU Action de « piece-tourne » lu par `drunkStaggers` ;
 * gueule de bois de « blackout » résolue par `soberUp`). La MÉCANIQUE exécutable (Bravoure/meilleur
 * ami/belligérant) est `ops` (`GameOp[]`, langue unique — `applyOps`), absent = rien d'exécutable.
 */
import { z } from 'zod';
import { gameOpSchema } from '../common';

export const file = 'drunkenness.json';

export const schema = z.strictObject({
  table: z.array(
    z.strictObject({
      id: z.string(),
      min: z.number(),
      max: z.number(),
      name: z.string(),
      effect: z.enum(['bravoure', 'ami', 'staggering', 'belligerent', 'blackout']),
      desc: z.string(),
      ops: z.array(gameOpSchema).optional(),
    }),
  ),
});

export type DrunkennessData = z.infer<typeof schema>;
