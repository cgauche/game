/**
 * Schéma de `oups.json` — Tableau des Maladresses (LDB 14, transcrit verbatim). Dérivé du contenu
 * RÉEL (7 entrées) et de `OupsEntry`/`OupsKind` (`src/data/oups.ts:10-14`).
 */
import { z } from 'zod';

export const file = 'oups.json';

export const schema = z.array(
  z.strictObject({
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
  }),
);

export type OupsData = z.infer<typeof schema>;
