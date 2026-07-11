/**
 * Schéma de `montures.json` — Mouvement/Endurance des montures/bêtes de trait en VOYAGE (EDOC ch.04
 * l.25). PAS de `MonturesData` dans `src/data/index.ts` (aucun consommateur typé grep — colonne
 * vertébrale reconstruite depuis le seul contenu réel, objet UNIQUE : `id`/`label`/`source`/`entries`,
 * 8 entrées toutes {id,label,trappingIds,m,e,trot,encPortee} — inventaire exhaustif par script).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'montures.json';

export const schema = z.strictObject({
  id: z.string(),
  label: z.string(),
  source: sourceRefSchema,
  entries: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      /** Réfs `TrappingData.id` de l'animal au catalogue d'objets (achat) — peut être vide (« Cheval de
       *  trait lourd »/« Bœuf » n'ont pas de fiche `trappings.json` dédiée). */
      trappingIds: z.array(z.string()),
      /** Mouvement (M). */
      m: z.number(),
      /** Endurance (E), pour les Tests de Résistance (allure forcée, EDOC 07 l.229). */
      e: z.number(),
      /** Peut trotter (allure plus rapide sur route, EDOC ch.04) — `false` pour les bêtes de trait/somme. */
      trot: z.boolean(),
      /** Capacité de charge (« Enc portée », EDOC 07 l.97-110). */
      encPortee: z.number(),
    }),
  ),
});

export type MonturesData = z.infer<typeof schema>;
