/**
 * Schéma de `calendarMonths.json` — les 12 mois du calendrier impérial (LDB), consommé tel quel par
 * `src/data/index.ts:1384` (`{ name, days }[]`, cf. `engine/clock.ts` pour la mécanique de calendrier).
 */
import { z } from 'zod';

export const file = 'calendarMonths.json';

export const schema = z.array(
  z.strictObject({
    name: z.string(),
    days: z.number(),
  }),
);

export type CalendarMonthsData = z.infer<typeof schema>;
