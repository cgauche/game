/**
 * Schéma de `calendarPhases.json` — les 7 phases de la journée (Aube→Nuit), consommé par
 * `src/data/index.ts` (`{ id, start, label, icon }[]`). `start` = minute du jour (0-1439) où la
 * phase commence ; `icon` = clé d'ENVELOPPE, EXIGÉE ici (`options.exiges`) — toute phase porte
 * la sienne à l'écran (`ajouter-une-icone`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'calendarPhases.json';
export const famille = 'entite';

const doc = document(
  'calendarPhases',
  famille,
  {
    start: z.number(),
  },
  {
    start: { label: 'Heure de début', hint: 'Minute du jour (0-1439) où la phase commence' },
  },
  {
    codex: { keys: ['calendarPhases'] },
    edit: { dataset: 'calendarPhases' },
  },
  { exiges: ['icon'] },
);

export const schema = doc.schema;
export const meta = doc.meta;
