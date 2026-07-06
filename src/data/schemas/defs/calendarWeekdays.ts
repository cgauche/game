/**
 * Schéma de `calendarWeekdays.json` — les 8 jours de la semaine impériale (LDB), consommé par
 * `src/data/index.ts:1386` (`{ name }[]`).
 */
import { z } from 'zod';

export const file = 'calendarWeekdays.json';

export const schema = z.array(
  z.strictObject({
    name: z.string(),
  }),
);

export type CalendarWeekdaysData = z.infer<typeof schema>;
