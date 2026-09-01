/**
 * Schéma de `obsessions.json` — Tableau des Obsessions (EDOC 12 l.170, folio 69). Document UNIQUE
 * de famille `config`, dérivé de `ObsessionTableFile`/`ObsessionEntry` (`src/data/obsessions.ts`) :
 * son enveloppe (identité + `source`) est posée par la fabrique, sa charge est `entries`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema } from '../grammaire/valeurs';

export const file = 'obsessions.json';
export const famille = 'config';

const doc = document(
  'obsessions',
  famille,
  {
    entries: z.array(
      z.strictObject({
        ...plageSchema.shape,
        id: z.string(),
        label: z.string(),
      }),
    ),
  },
  {
    entries: { label: 'Obsessions', hint: 'Rangées du 2d10, bornes min/max inclusives' },
  },
  {
    codex: { keys: ['obsessions'] },
    edit: { niche: { categories: ['obsessions'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
