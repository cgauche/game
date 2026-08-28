/**
 * Schéma de `details.json` — formules d'Âge/Taille par espèce (LDB 05 l.691-707) + textes d'aide
 * (Noms/Âge/Taille/Ambitions). Dérivé de l'interface `DetailsData` (`src/data/index.ts`, +
 * `DetailText` co-localisée) et du contenu RÉEL (objet UNIQUE, 5 clés : `ageBase`/`ageRoll`/
 * `heightBase`/`heightRoll` = records espèce→nombre à 7 clés ; `texts` = 5 `DetailText`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { raceKeySchema } from '../grammaire/valeurs';

export const file = 'details.json';
export const famille = 'config';

const detailTextSchema = z.strictObject({
  all: z.string(),
  /** Surcharges PAR ESPÈCE, colonne `raceKeySchema` (id stable, #313) — partiel : un texte d'aide
   *  ne couvre que les races qu'il nomme (7 pour les noms, 6 pour l'âge, 2 pour la taille, 0 pour
   *  les Ambitions). */
  bySpecies: z.partialRecord(raceKeySchema, z.string()),
});

const doc = document(
  'details',
  famille,
  {
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
  },
  {
    ageBase: { label: 'Âge de base', hint: 'Base du jet d’Âge, par colonne d’espèce' },
    ageRoll: { label: 'Jets d’Âge', hint: 'Nombre de d10 ajoutés à la base, par colonne d’espèce' },
    heightBase: { label: 'Taille de base', hint: 'Base du jet de Taille, par colonne d’espèce' },
    heightRoll: { label: 'Jets de Taille', hint: 'Nombre de d10 ajoutés à la base, par colonne d’espèce' },
    texts: { label: 'Textes d’aide', hint: 'Aides affichées à la création : Nom, Âge, Taille, Ambitions' },
  },
  { codex: { keys: ['details'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;
