/**
 * Schéma de `naval-progression.json` — table PROGRESSION D'UN NAVIRE (MDG 13 l.68-75) : bande de DR
 * du Test de Navigation → mode de déplacement (M+2 / M+1 / M / M−1 / M÷2). Consommé par
 * `src/engine/shipNavigation.ts` (`ProgressionEntry`, `findTableEntry`).
 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'naval-progression.json';
export const famille = 'config';

/** `mode` observés : les 5 issues RAW de la table de Progression (ch.13 l.68-75). */
const champs = {
  entries: z.array(
    z.strictObject({
      /** id STABLE = `mode` (déjà une clé fermée à 5 valeurs) — identité d'entrée pour le Codex (#422). */
      id: z.string(),
      min: z.number(),
      max: z.number(),
      mode: z.enum(['plus2', 'plus1', 'normal', 'minus1', 'half']),
      desc: z.string(),
      source: sourceRefSchema,
    }),
  ),
};

const doc = document(
  'naval-progression',
  famille,
  champs,
  {
    entries: { label: 'Bandes de progression', hint: 'Bande de DR du Test de Navigation → mode de déplacement du navire' },
  },
  {
    codex: { keys: ['navalProgression'] },
    edit: { niche: { categories: ['navalProgression'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type NavalProgressionData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
