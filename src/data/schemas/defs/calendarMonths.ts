/**
 * Schéma de `calendarMonths.json` — les 12 mois du calendrier impérial (Calendrier Impérial, EDO
 * Annexe 3 « Documents et aides de jeux » folio 149 — PAS le LDB, aucune extraction Marker
 * n'attestant cette table au Livre de base, #309 phase 3), consommé tel quel par
 * `src/data/index.ts:1384` (`{ name, days }[]`, cf. `engine/clock.ts` pour la mécanique de calendrier).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'calendarMonths.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    name: z.string(),
    days: z.number(),
    source: sourceRefSchema.optional(),
  }),
);

export type CalendarMonthsData = z.infer<typeof schema>;
