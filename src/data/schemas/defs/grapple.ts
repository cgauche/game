/**
 * Schéma de `grapple.json` — règle d'Empoignade (LDB 14 l.155-169) en donnée. Reflet de `GrappleRule`
 * (`src/data/index.ts`) : `init` = ops à la touche (Empêtré) ; `win` = les 3 options du Test opposé
 * gagné (damage/entangle/free). `ops` en `gameOpSchema` LOOSE — porte des extensions data-only
 * (`grapple`, `perSL`, `valuePerSL`) non génériques à tout `GameOp`, cf. `ops.ts`.
 */
import { z } from 'zod';
import { gameOpSchema } from '../common';

export const file = 'grapple.json';

export const schema = z.strictObject({
  /** Note de règle (LDB 14) — display-only, jamais parsée. */
  _comment: z.string(),
  init: z.array(gameOpSchema),
  win: z.strictObject({
    damage: z.array(gameOpSchema),
    entangle: z.array(gameOpSchema),
    free: z.array(gameOpSchema),
  }),
});

export type GrappleData = z.infer<typeof schema>;
