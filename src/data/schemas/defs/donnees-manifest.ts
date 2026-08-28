/**
 * Schéma de `donnees.manifest.json` — manifeste éditorial de l'atlas des données (#903), consommé
 * par `scripts/docs/build-donnees.mjs` pour générer `docs/donnees.md`. Vocabulaire app-interne
 * (tooling), pas une donnée RAW — cf. `EXEMPT_DATASETS` (citationCoverage.mjs).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'donnees.manifest.json';
export const famille = 'config';

const entreeSchema = z.strictObject({
  files: z.array(z.string()),
  desc: z.string(),
});

const rubriqueSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Note de rubrique imprimée sous son tableau (`build-donnees.mjs`) — CHAMP, jamais un cas
   *  particulier câblé dans le générateur : toute rubrique peut en porter une. */
  note: z.string().min(1).optional(),
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

const doc = document(
  'donnees.manifest',
  famille,
  {
    reglesOr: z.string(),
    rubriques: z.array(rubriqueSchema),
    homonymes: z.strictObject({
      intro: z.string(),
      cas: z.array(homonymeCasSchema),
    }),
  },
  {
    reglesOr: { label: 'Règles d’or', hint: 'Principes éditoriaux de l’atlas des données' },
    rubriques: { label: 'Rubriques', hint: 'Sections de l’atlas, chacune listant ses fichiers et leur usage' },
    homonymes: { label: 'Homonymes', hint: 'Cas de noms partagés entre fichiers, avec la leçon qui les distingue' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "manifeste TOOLING (#903) éditorial de l'atlas des données (rangement par rubrique/description/homonymes) — vocabulaire app-interne.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
