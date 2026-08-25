/**
 * Schéma de `primitives.manifest.json` — manifeste des primitives partagées (#298), source unique de
 * « qu'est-ce qui est canonique » consommée par `scripts/docs/build-systemes.mjs`. Vocabulaire
 * app-interne (tooling), pas une donnée RAW — cf. `EXEMPT_DATASETS` (citationCoverage.mjs).
 */
import { z } from 'zod';

export const file = 'primitives.manifest.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    nom: z.string(),
    fichier: z.string(),
    concept: z.string(),
    perimetre: z.string(),
    verrou: z.string(),
  }),
);
