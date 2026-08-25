/**
 * Schéma de `surincantation.json` — TABLEAU DE SURINCANTATION des Vents de Magie (VDM 02 l.207-215,
 * folio 23). Fichier NON-tableau (objet `{ source, ref, table }`, même patron qu'`obsessions.json`).
 * Une rangée = un PALIER de DR dépensés sur UNE colonne : `targets` = Cibles ADDITIONNELLES,
 * `damage` = Dégât en plus (Projectiles magiques, VDM 02 l.198), `range`/`zone`/`duration` =
 * multiplicateurs de la valeur listée par le Sort. Rangées AUTHORÉES dans l'ordre imprimé (DR
 * croissant) ; le lookup (`src/engine/overcast.ts`) retient le palier le plus haut ≤ DR dépensés.
 * `id`/`label` = identité STABLE de la rangée pour l'exposition et l'édition au Compendium.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'surincantation.json';

export const schema = z.strictObject({
  source: sourceRefSchema,
  ref: z.string().min(1),
  table: z
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
});

export type SurincantationData = z.infer<typeof schema>;
