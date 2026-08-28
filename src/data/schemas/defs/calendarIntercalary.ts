/**
 * Schéma de `calendarIntercalary.json` — les 6 jours intercalaires du calendrier impérial
 * (Calendrier Impérial, EDO Annexe 3 « Documents et aides de jeux » folio 150 — PAS le LDB, #309
 * phase 3), consommé par `src/data/index.ts` (`{ label, afterMonth }[]`). `afterMonth` =
 * index 0-based du mois APRÈS lequel place le jour (Hexenstag = -1 : avant le 1er mois,
 * cf. `engine/clock.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'calendarIntercalary.json';
export const famille = 'entite';

const doc = document(
  'calendarIntercalary',
  famille,
  {
    afterMonth: z.number(),
  },
  {
    afterMonth: {
      label: 'Mois précédent',
      hint: 'Index du mois après lequel ce jour intercalaire se place (avant le 1ᵉʳ mois = -1)',
    },
  },
  {
    codex: { keys: ['calendarIntercalary'] },
    edit: { dataset: 'calendarIntercalary' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
