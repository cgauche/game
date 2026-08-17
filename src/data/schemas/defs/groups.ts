/**
 * Schéma de `groups.json` — registre des Groupes d'APPARTENANCE (LDB 21, Traits psy ciblés), miroir de
 * `GroupData` (`src/data/index.ts:496-499`). Inventaire réel (33 entrées) : uniquement `id`+`label`,
 * aucun champ supplémentaire.
 */
import { z } from 'zod';

export const file = 'groups.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
  }),
);
