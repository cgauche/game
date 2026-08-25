/**
 * Schéma de `oups.json` — Tableau des Maladresses (LDB 14, transcrit verbatim). Dérivé du contenu
 * RÉEL (7 entrées) et de `OupsEntry`/`OupsKind` (`src/data/oups.ts`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'oups.json';

export const schema = z.array(
  z.union([
    // Bandes d100 du Tableau des Oups ! (LDB 14 l.21-30).
    z.strictObject({
      id: z.string(),
      min: z.number(),
      max: z.number(),
      kind: z.enum([
        'selfWound',
        'weaponDamageActLast',
        'actionPenalty',
        'loseMovement',
        'loseAction',
        'trauma',
        'hitAlly',
      ]),
      label: z.string(),
      source: sourceRefSchema.optional(),
    }),
    // Incident de Tir — hors table d100 (arme à Poudre noire + jet pair, LDB 14 l.34).
    z.strictObject({
      id: z.string(),
      kind: z.literal('misfire'),
      label: z.string(),
      source: sourceRefSchema.optional(),
    }),
  ]),
);
