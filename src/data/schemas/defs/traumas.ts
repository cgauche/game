/**
 * Schéma de `traumas.json` — Traumatismes (LDB 18). Dérivé du contenu RÉEL (23 fiches) et de son
 * consommateur typé `TraumaFiche` (`src/engine/trauma.ts:38`). `ops` = `GameOp[]` (vocab partagé) ;
 * `needsSurgery` figure dans l'interface TS mais AUCUNE entrée actuelle ne le porte (optionnel gardé
 * conforme au type).
 */
import { z } from 'zod';
import { gameOpSchema } from '../common';

export const file = 'traumas.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    ops: z.array(gameOpSchema).optional(),
    kind: z.enum(['dechirure', 'fracture']).optional(),
    severity: z.enum(['mineur', 'majeur']).optional(),
    prosthesis: z
      .array(
        z.strictObject({
          trappingId: z.string(),
          cancels: z.enum(['all', 'movement']),
        }),
      )
      .optional(),
    needsSurgery: z.boolean().optional(),
  }),
);

export type TraumasData = z.infer<typeof schema>;
