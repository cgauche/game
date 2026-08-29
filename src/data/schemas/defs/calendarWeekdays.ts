/**
 * Schéma de `calendarWeekdays.json` — les 8 jours de la semaine impériale (Calendrier Impérial, EDO
 * Annexe 3 « Documents et aides de jeux » folio 149 — PAS le LDB, #309 phase 3), consommé par
 * `src/data/index.ts` (`{ id, label }[]`).
 *
 * ZÉRO champ hors enveloppe : l'entrée est son identité et sa provenance, rien de plus.
 */
import { document } from '../grammaire/document';

export const file = 'calendarWeekdays.json';
export const famille = 'entite';

const doc = document(
  'calendarWeekdays',
  famille,
  {},
  {},
  {
    codex: { keys: ['calendarWeekdays'] },
    edit: { dataset: 'calendarWeekdays' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
