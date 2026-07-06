/**
 * Schéma de `details.json` — formules d'Âge/Taille par espèce (LDB 05 l.691-707) + textes d'aide
 * (Noms/Âge/Taille/Ambitions). Dérivé de l'interface `DetailsData` (`src/data/index.ts:665`, +
 * `DetailText` co-localisée) et du contenu RÉEL (objet UNIQUE, 5 clés : `ageBase`/`ageRoll`/
 * `heightBase`/`heightRoll` = records espèce→nombre à 7 clés ; `texts` = 5 `DetailText`).
 */
import { z } from 'zod';

export const file = 'details.json';

const detailTextSchema = z.strictObject({
  all: z.string(),
  bySpecies: z.record(z.string(), z.string()),
});

export const schema = z.strictObject({
  /** Base + jet d'Âge (« base + N d10 ») par colonne refChar (clé = `SpeciesData.label`). */
  ageBase: z.record(z.string(), z.number()),
  ageRoll: z.record(z.string(), z.number()),
  heightBase: z.record(z.string(), z.number()),
  heightRoll: z.record(z.string(), z.number()),
  texts: z.strictObject({
    nom: detailTextSchema,
    age: detailTextSchema,
    taille: detailTextSchema,
    ambitionShort: detailTextSchema,
    ambitionLong: detailTextSchema,
  }),
});

export type DetailsData = z.infer<typeof schema>;
