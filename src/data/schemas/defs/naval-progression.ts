/**
 * Schéma de `naval-progression.json` — table PROGRESSION D'UN NAVIRE (MDG ch.13 l.68-75) : bande de DR
 * du Test de Navigation → mode de déplacement (M+2 / M+1 / M / M−1 / M÷2). Consommé par
 * `src/engine/shipNavigation.ts` (`ProgressionEntry`, `findTableEntry`).
 */
import { z } from 'zod';

export const file = 'naval-progression.json';

/** `mode` observés : les 5 issues RAW de la table de Progression (ch.13 l.68-75). */
export const schema = z.array(
  z.strictObject({
    min: z.number(),
    max: z.number(),
    mode: z.enum(['plus2', 'plus1', 'normal', 'minus1', 'half']),
    desc: z.string(),
  }),
);

export type NavalProgressionData = z.infer<typeof schema>;
