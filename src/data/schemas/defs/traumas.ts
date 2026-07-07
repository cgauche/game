/**
 * Schéma de `traumas.json` — Traumatismes (LDB 18). Dérivé du contenu RÉEL (23 fiches) et de son
 * consommateur typé `TraumaFiche` (`src/engine/trauma.ts:38`). `ops` = `GameOp[]` (vocab partagé) ;
 * `cosmetic`/`passiveKind`/`maison` : cicatrices post-guérison (LDB 18 l.61/72, #192).
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
    cosmetic: z.boolean().optional(),
    passiveKind: z
      .enum(['douleur', 'mobilité', 'structurel', 'sensoriel', 'maladie', 'faim', 'magique', 'etat', 'ivresse', 'intrinsèque'])
      .optional(),
    maison: z.string().optional(),
  }),
);

export type TraumasData = z.infer<typeof schema>;
