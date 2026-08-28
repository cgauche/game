/**
 * Schéma de `raw.manifest.json` — manifeste éditorial du champ Implémente de l'Atlas RAW (#487),
 * généré par `scripts/raw/build-implemente.mjs` : par `id` (le topic de fiche `domaine#sujet`),
 * ticket de dette ou raison de blocage. Le `label` (clé d'ENVELOPPE) est le titre VERBATIM de la
 * section d'Atlas que le topic adresse — accord gardé par `scripts/raw/build-implemente.test.mjs`
 * (`headingForTopic`).
 * Vocabulaire app-interne (tooling), pas une donnée RAW — cf. `EXEMPT_DATASETS` (citationCoverage.mjs).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'raw.manifest.json';
export const famille = 'entite';

const doc = document(
  'raw.manifest',
  famille,
  {
    ticket: z.string().optional(),
    bloque: z.string().optional(),
  },
  {
    ticket: { label: 'Ticket', hint: 'Ticket de dette portant l’implémentation manquante' },
    bloque: { label: 'Raison de blocage', hint: 'Motif de non-implémentation quand aucun ticket n’est ouvert' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "manifeste TOOLING (#487) éditorial du champ Implémente de l'Atlas RAW (id/ticket/bloque) — vocabulaire app-interne.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
  {
    affinerEntree: (entree) =>
      entree.refine((entry) => (entry as { ticket?: string }).ticket !== undefined || (entry as { bloque?: string }).bloque !== undefined, {
        message: 'ticket ou bloque requis',
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
