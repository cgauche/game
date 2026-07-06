/**
 * Schéma de `calendarIntercalary.json` — les 6 jours intercalaires du calendrier impérial (LDB),
 * consommé par `src/data/index.ts:1385` (`{ name, afterMonth }[]`). `afterMonth` = index 0-based du
 * mois APRÈS lequel place le jour (Hexenstag = -1 : avant le 1er mois, cf. `engine/clock.ts`).
 */
import { z } from 'zod';

export const file = 'calendarIntercalary.json';

export const schema = z.array(
  z.strictObject({
    name: z.string(),
    afterMonth: z.number(),
  }),
);

export type CalendarIntercalaryData = z.infer<typeof schema>;
