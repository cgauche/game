/**
 * Schéma de `calendarPhases.json` — les 7 phases de la journée (Aube→Nuit), consommé par
 * `src/data/index.ts` (`{ id, start, label, icon }[]`). `start` = minute du jour (0-1439) où la
 * phase commence ; `icon` = chemin d'icône (`ajouter-une-icone`).
 */
import { z } from 'zod';

export const file = 'calendarPhases.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    id: z.string().min(1),
    start: z.number(),
    label: z.string(),
    icon: z.string(),
  }),
);
