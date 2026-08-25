/**
 * Schéma de `donnees.manifest.json` — manifeste éditorial de l'atlas des données (#903), consommé
 * par `scripts/docs/build-donnees.mjs` pour générer `docs/donnees.md`. Vocabulaire app-interne
 * (tooling), pas une donnée RAW — cf. `EXEMPT_DATASETS` (citationCoverage.mjs).
 */
import { z } from 'zod';

export const file = 'donnees.manifest.json';
export const famille = 'config';

const entreeSchema = z.strictObject({
  files: z.array(z.string()),
  desc: z.string(),
});

const rubriqueSchema = z.strictObject({
  nom: z.string(),
  entrees: z.array(entreeSchema),
});

const homonymeEntreeSchema = z.strictObject({
  file: z.string(),
  desc: z.string(),
});

const homonymeCasSchema = z.strictObject({
  mot: z.string(),
  entrees: z.array(homonymeEntreeSchema),
  lecon: z.string(),
});

export const schema = z.strictObject({
  reglesOr: z.string(),
  narratifNote: z.string(),
  rubriques: z.array(rubriqueSchema),
  homonymes: z.strictObject({
    intro: z.string(),
    cas: z.array(homonymeCasSchema),
  }),
});
