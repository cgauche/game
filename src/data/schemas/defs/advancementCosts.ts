/**
 * Schéma de `advancementCosts.json` — Tableau de Coût des Augmentations (LDB 07 l.51-70),
 * consommé par `src/engine/advancement.ts` (`AdvanceCostBand[]`, qui ignore `id`/`label`). Une bande =
 * nombre d'Augmentations DÉJÀ achetées, `max` borne haute INCLUSIVE ; la DERNIÈRE bande porte `max: null`
 * (« et au-delà », JSON n'a pas d'Infinity — cf. commentaire du consommateur). `id`/`label` = identité
 * STABLE de la bande (fourchette d'Augmentations déjà achetées), ajoutée pour l'exposition Codex (#422).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'advancementCosts.json';
export const famille = 'entite';

const doc = document(
  'advancementCosts',
  famille,
  {
    max: z.number().nullable(),
    char: z.number(),
    skill: z.number(),
  },
  {
    max: {
      label: 'Borne haute de la bande',
      hint: 'Nombre d’Augmentations déjà achetées à ne pas dépasser ; null sur la dernière bande (« et au-delà »)',
    },
    char: { label: 'Coût (Caractéristique)', hint: 'Coût en PX de la prochaine Augmentation de Caractéristique' },
    skill: { label: 'Coût (Compétence)', hint: 'Coût en PX de la prochaine Augmentation de Compétence' },
  },
  {
    codex: { keys: ['advancementCosts'] },
    edit: { dataset: 'advancementCosts' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
