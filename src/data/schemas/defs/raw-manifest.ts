/**
 * Schéma de `raw.manifest.json` — manifeste éditorial du champ Implémente de l'Atlas RAW (#487),
 * généré par `scripts/raw/build-implemente.mjs` : par `id` (le topic de fiche `domaine#sujet`),
 * ticket de dette ou raison de blocage.
 * Vocabulaire app-interne (tooling), pas une donnée RAW — cf. `EXEMPT_DATASETS` (citationCoverage.mjs).
 */
import { z } from 'zod';

export const file = 'raw.manifest.json';
export const famille = 'entite';

export const schema = z.array(
  z
    .strictObject({
      id: z.string().min(1),
      ticket: z.string().optional(),
      bloque: z.string().optional(),
    })
    .refine((entry) => entry.ticket !== undefined || entry.bloque !== undefined, {
      message: 'ticket ou bloque requis',
    }),
);
