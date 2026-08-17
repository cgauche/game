/**
 * Schéma de `calendarWeekdays.json` — les 8 jours de la semaine impériale (Calendrier Impérial, EDO
 * Annexe 3 « Documents et aides de jeux » folio 149 — PAS le LDB, #309 phase 3), consommé par
 * `src/data/index.ts:1386` (`{ name }[]`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'calendarWeekdays.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    source: sourceRefSchema.optional(),
  }),
);
