/**
 * Schéma de `calendarIntercalary.json` — les 6 jours intercalaires du calendrier impérial
 * (Calendrier Impérial, EDO Annexe 3 « Documents et aides de jeux » folio 150 — PAS le LDB, #309
 * phase 3), consommé par `src/data/index.ts` (`{ name, afterMonth }[]`). `afterMonth` =
 * index 0-based du mois APRÈS lequel place le jour (Hexenstag = -1 : avant le 1er mois,
 * cf. `engine/clock.ts`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'calendarIntercalary.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    afterMonth: z.number(),
    source: sourceRefSchema.optional(),
  }),
);
