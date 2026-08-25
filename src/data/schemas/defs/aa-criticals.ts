/**
 * Schéma de `aa-criticals.json` — Blessures critiques ALTERNATIVES (Aux Armes, l.2441-2627), 4 familles
 * (Tête/Bras/Corps/Jambe). Reflet de l'interface `AAEntry` (`src/engine/aaCritical.ts`) + `_source`
 * (note de provenance en tête de fichier, absente du chemin LDB). SEUL dataset encore sur
 * `freeSourceNoteSchema` (#278) : « Aux Armes ! » n'a pas d'extraction Markdown avec folios `data-folio`
 * dans `Source/` (PDF brut > 100 Mo, illisible par l'outillage) — migration vers `source` structuré PAR
 * entrée BLOQUÉE tant qu'une extraction Marker n'existe pas (cf. `common.ts`).
 */
import { z } from 'zod';
import { difficultySchema, freeSourceNoteSchema } from '../grammaire/valeurs';
import { gameOpSchema } from '../grammaire/mecanique';
import { critEscalationSchema, amputationSchema } from './criticals';

export const file = 'aa-criticals.json';
export const famille = 'record';

const aaEntrySchema = z.strictObject({
  id: z.string(),
  min: z.number(),
  max: z.number(),
  label: z.string(),
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
  // Amputation (« voir Amputation p.180 de WFJDR ») — MÊME forme partagée que le chemin LDB (`amputationSchema`) :
  // le vocabulaire `timing`/`loss` vaut pour l'AA (mêmes textes « Une fois la rencontre terminée… »/« un orteil par DR »).
  amputation: amputationSchema.optional(),
  /** Escalade GATÉE par les soins (« Main ouverte » l.2571 / « Pied écrasé » l.2624) — partagée LDB. */
  escalation: critEscalationSchema.optional(),
  lethal: z.boolean().optional(),
  desc: z.string(),
});

export const schema = z.strictObject({
  /** Note de provenance/périmètre (Système ALTERNATIF optionnel) — display-only, jamais parsée. */
  _source: freeSourceNoteSchema,
  tete: z.array(aaEntrySchema),
  bras: z.array(aaEntrySchema),
  corps: z.array(aaEntrySchema),
  jambe: z.array(aaEntrySchema),
});
