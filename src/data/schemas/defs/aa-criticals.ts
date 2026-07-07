/**
 * Schéma de `aa-criticals.json` — Blessures critiques ALTERNATIVES (Aux Armes, l.2441-2627), 4 familles
 * (Tête/Bras/Corps/Jambe). Reflet de l'interface `AAEntry` (`src/engine/aaCritical.ts`) + `_source`
 * (note de provenance en tête de fichier, absente du chemin LDB).
 */
import { z } from 'zod';
import { gameOpSchema, difficultySchema } from '../common';
import { critEscalationSchema } from './criticals';

export const file = 'aa-criticals.json';

const aaEntrySchema = z.strictObject({
  id: z.string(),
  min: z.number(),
  max: z.number(),
  name: z.string(),
  /** Colonne « Blessures » : Blessures supplémentaires perdues (0 = trivial « T », absent = létal). */
  blessures: z.number().optional(),
  trivial: z.boolean().optional(),
  ops: z.array(gameOpSchema).optional(),
  resist: z
    .strictObject({
      difficulty: difficultySchema,
      onFail: z.array(gameOpSchema),
      /** id STABLE `skills.json` — Test conditionnel HORS-Résistance (ex. Athlétisme, l.2609). */
      skill: z.string().optional(),
    })
    .optional(),
  traumas: z.array(z.string()).optional(),
  amputation: z
    .strictObject({
      difficulty: difficultySchema,
      sequels: z.array(z.string()),
    })
    .optional(),
  /** Escalade GATÉE par les soins (« Main ouverte » l.2571 / « Pied écrasé » l.2624) — partagée LDB. */
  escalation: critEscalationSchema.optional(),
  lethal: z.boolean().optional(),
  desc: z.string(),
});

export const schema = z.strictObject({
  /** Note de provenance/périmètre (Système ALTERNATIF optionnel) — display-only, jamais parsée. */
  _source: z.string(),
  tete: z.array(aaEntrySchema),
  bras: z.array(aaEntrySchema),
  corps: z.array(aaEntrySchema),
  jambe: z.array(aaEntrySchema),
});

export type AACriticalsData = z.infer<typeof schema>;
