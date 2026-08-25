/**
 * Schéma de `traumas.json` — Traumatismes (LDB 18). Dérivé du contenu RÉEL (23 fiches) et de son
 * consommateur typé `TraumaFiche` (`src/engine/trauma.ts`). `ops` = `GameOp[]` (vocab partagé) ;
 * `cosmetic`/`passiveKind`/`maison` : cicatrices post-guérison (LDB 18 l.61/72, #192).
 */
import { z } from 'zod';
import { sourceRefSchema, formulaSchema } from '../grammaire/valeurs';
import { gameOpSchema } from '../grammaire/mecanique';

/** Règle de COMPTAGE/AGRÉGATION d'une séquelle cumulative (`TraumaCumul`, `src/engine/trauma.ts`) —
 *  LDB 18 l.247/251/273/277/281. */
const cumulSchema = z.strictObject({
  portee: z.enum(['localisation', 'porteur']),
  unite: formulaSchema.optional(),
  parPalier: z.strictObject({ taille: z.number(), ops: z.array(gameOpSchema) }).optional(),
  escalade: z
    .strictObject({ atLeast: z.number(), versTraumaId: z.string(), mode: z.enum(['remplace', 'ajoute']) })
    .optional(),
});

/** Routage d'APPARENCE de la séquelle sur le rig (`TraumaRig`, `src/engine/trauma.ts`) — LDB 18 / LDB 73. */
const rigSchema = z.strictObject({
  bone: z.string(),
  lateral: z.boolean().optional(),
  art: z.string().optional(),
  byProsthesis: z.array(z.strictObject({ trappingId: z.string(), art: z.string() })).optional(),
  hidesBone: z.string().optional(),
  view: z.literal('front').optional(),
  replace: z.boolean().optional(),
});

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
    cumul: cumulSchema.optional(),
    rig: rigSchema.optional(),
    needsSurgery: z.boolean().optional(),
    cosmetic: z.boolean().optional(),
    amputation: z.boolean().optional(),
    passiveKind: z
      .enum(['douleur', 'mobilite', 'structurel', 'sensoriel', 'maladie', 'faim', 'magique', 'etat', 'ivresse', 'intrinseque'])
      .optional(),
    maison: z.string().optional(),
    source: sourceRefSchema.optional(),
  }),
);
