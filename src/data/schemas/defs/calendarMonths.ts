/**
 * Schéma de `calendarMonths.json` — les 12 mois du calendrier impérial (Calendrier Impérial, EDO
 * Annexe 3 « Documents et aides de jeux » folio 149 — PAS le LDB, aucune extraction Marker
 * n'attestant cette table au Livre de base, #309 phase 3), consommé tel quel par
 * `src/data/index.ts` (`{ label, days }[]`, cf. `engine/clock.ts` pour la mécanique de calendrier).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'calendarMonths.json';
export const famille = 'entite';

const doc = document(
  'calendarMonths',
  famille,
  {
    days: z.number(),
  },
  {
    days: { label: 'Nombre de jours', hint: 'Nombre de jours du mois' },
  },
  {
    codex: { keys: ['calendarMonths'] },
    edit: { dataset: 'calendarMonths' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
