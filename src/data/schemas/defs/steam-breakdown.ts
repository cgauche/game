/**
 * Schéma de `steam-breakdown.json` — Panne de Vapeur (MDG ch.12 l.313-352), `SteamBreakdownEntry`
 * (`src/engine/shipBuild.ts:223-237`), tirée par `rollSteamBreakdown` (d100).
 *
 * ⚠️ ANOMALIE (à corriger, pas corrigée ici — rapportée) : l'entrée `fuite-de-vapeur` (min 41/max 60)
 * porte un champ `engineerTest: { char: "I" }` qui n'existe PAS dans `SteamBreakdownEntry` (interface
 * TS, `src/engine/shipBuild.ts:223-237`) — champ mort, jamais lu par `rollSteamBreakdown`/consommateurs.
 * Conservé ici (reflet du JSON réel) et ajouté au schéma pour ne pas faire échouer la preuve, mais à
 * dropper du JSON ou à câbler dans l'interface — au choix de qui traite l'anomalie.
 */
import { z } from 'zod';
import { difficultySchema } from '../common';

export const file = 'steam-breakdown.json';

export const schema = z.array(
  z.strictObject({
    min: z.number(),
    max: z.number(),
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    mMod: z.number().optional(),
    durationRounds: z.string().optional(),
    failDamage: z.string().optional(),
    engineDestroyed: z.boolean().optional(),
    hullCritical: z.boolean().optional(),
    compartmentDamage: z.number().optional(),
    mSet: z.number().optional(),
    coolMinutes: z.string().optional(),
    restart: z
      .array(
        z.strictObject({
          skillId: z.string(),
          spec: z.string().optional(),
          difficulty: difficultySchema,
          extendedDR: z.number().optional(),
        }),
      )
      .optional(),
    /** Champ orphelin — absent de `SteamBreakdownEntry` (interface TS). Cf. anomalie en tête de fichier. */
    engineerTest: z.strictObject({ char: z.string() }).optional(),
  }),
);

export type SteamBreakdownData = z.infer<typeof schema>;
