/**
 * Schéma de `systemes.manifest.json` — manifeste éditorial des systèmes implémentés (#298), consommé
 * par `scripts/docs/build-systemes.mjs` pour générer `docs/systemes.md`. Vocabulaire app-interne
 * (tooling), pas une donnée RAW — cf. `EXEMPT_DATASETS` (citationCoverage.mjs).
 */
import { z } from 'zod';

export const file = 'systemes.manifest.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    nom: z.string(),
    modules: z.array(z.string()),
    etat: z.enum(['complet', 'partiel']),
    ticket: z.string().nullable(),
    notes: z.string(),
  }),
);
