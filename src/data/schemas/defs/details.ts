/**
 * Schéma de `details.json` — formules d'Âge/Taille par espèce (LDB 05 l.691-707) + textes d'aide
 * (Noms/Âge/Taille/Ambitions). Dérivé de l'interface `DetailsData` (`src/data/index.ts`, +
 * `DetailText` co-localisée) et du contenu RÉEL (objet UNIQUE, 5 clés : `ageBase`/`ageRoll`/
 * `heightBase`/`heightRoll` = records espèce→nombre à 7 clés ; `texts` = 5 `DetailText`).
 */
import { z } from 'zod';
import { raceKeySchema } from '../grammaire/valeurs';

export const file = 'details.json';
export const famille = 'config';

const detailTextSchema = z.strictObject({
  all: z.string(),
  /** Clé OUVERTE (libellé d'espèce, saisie libre à l'édition Codex — `CodexEdit.tsx`) : NON migrée
   *  vers `raceKeySchema` (#313, hors périmètre — pas un catalogue fermé de 7 colonnes). */
  bySpecies: z.record(z.string(), z.string()),
});

export const schema = z.strictObject({
  /** Base + jet d'Âge (« base + N d10 ») par colonne `raceKeySchema` (id stable, #313) — partiel. */
  ageBase: z.partialRecord(raceKeySchema, z.number()),
  ageRoll: z.partialRecord(raceKeySchema, z.number()),
  heightBase: z.partialRecord(raceKeySchema, z.number()),
  heightRoll: z.partialRecord(raceKeySchema, z.number()),
  texts: z.strictObject({
    nom: detailTextSchema,
    age: detailTextSchema,
    taille: detailTextSchema,
    ambitionShort: detailTextSchema,
    ambitionLong: detailTextSchema,
  }),
});
