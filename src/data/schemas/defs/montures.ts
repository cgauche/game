/**
 * Schéma de `montures.json` — Mouvement/Endurance des montures/bêtes de trait en VOYAGE (EDOC 7
 * l.25). PAS de `MonturesData` dans `src/data/index.ts` (aucun consommateur typé grep — colonne
 * vertébrale reconstruite depuis le seul contenu réel, objet UNIQUE : `id`/`label`/`source`/`entries`,
 * 8 entrées toutes {id,label,creatureIds,m,e,trot,encPortee} — inventaire exhaustif par script).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'montures.json';
export const famille = 'config';

const doc = document(
  'montures',
  famille,
  {
    entries: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      /** Réfs `CreatureData.id` du bestiaire (SOCLE POSSESSIONS #617/#618) — peut être vide (« Cheval de
       *  trait lourd »/« Bœuf » n'ont pas de profil de bête possédable dédié). */
      creatureIds: z.array(z.string()),
      /** Mouvement (M). */
      m: z.number(),
      /** Endurance (E), pour les Tests de Résistance (allure forcée, EDOC 07 l.229). */
      e: z.number(),
      /** Peut trotter (allure plus rapide sur route, EDOC 7) — `false` pour les bêtes de trait/somme. */
      trot: z.boolean(),
      /** Capacité de charge (« Enc portée », EDOC 07 l.97-110). */
      encPortee: z.number(),
    }),
    ),
  },
  {
    entries: { label: 'Montures et bêtes de trait', hint: 'Mouvement, Endurance, trot et capacité de charge en voyage' },
  },
  {
    codex: { keys: ['montures'] },
    edit: { niche: { categories: ['montures'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
