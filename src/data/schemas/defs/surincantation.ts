/**
 * Schéma de `surincantation.json` — TABLEAU DE SURINCANTATION des Vents de Magie (VDM 02 l.205-215,
 * folio 23). Document UNIQUE de famille `config`, même patron qu'`obsessions.json`.
 * Une rangée = un PALIER de DR dépensés sur UNE colonne : `targets` = Cibles ADDITIONNELLES,
 * `damage` = Dégât en plus (Projectiles magiques, VDM 02 l.198), `range`/`zone`/`duration` =
 * multiplicateurs de la valeur listée par le Sort. Rangées AUTHORÉES dans l'ordre imprimé (DR
 * croissant) ; le lookup (`src/engine/overcast.ts`) retient le palier le plus haut ≤ DR dépensés.
 * `id`/`label` = identité STABLE de la rangée pour l'exposition et l'édition au Compendium.
 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';

export const file = 'surincantation.json';
export const famille = 'config';

const champs = {
  entries: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        label: z.string().min(1),
        dr: z.number().int().min(1),
        targets: z.number().int().min(0),
        damage: z.number().int().min(0),
        range: z.number().int().min(1),
        zone: z.number().int().min(1),
        duration: z.number().int().min(1),
      }),
    )
    .min(1),
};

const doc = document(
  'surincantation',
  famille,
  champs,
  {
    entries: { label: 'Paliers de Surincantation', hint: 'Un palier = des DR dépensés ; le lookup retient le plus haut palier ≤ DR dépensés' },
  },
  {
    codex: { keys: ['surincantation'] },
    edit: {
      none: 'édité par TABLEAU NICHÉ : la catégorie Codex `surincantation` édite le champ `entries` de ce document, jamais le document entier (CodexEdit.CATEGORY_DATASET)',
    },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
export type SurincantationData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
