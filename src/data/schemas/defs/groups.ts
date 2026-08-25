/**
 * Schéma de `groups.json` — registre des Groupes d'APPARTENANCE (LDB 21, Traits psy ciblés), miroir de
 * `GroupData` (`src/data/index.ts`). Inventaire réel (38 entrées) : `id`+`label`, et le couple
 * JOKER `matchesAll`/`exceptGroups` sur 2 entrées (`tout`, `vivant`).
 */
import { z } from 'zod';

export const file = 'groups.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    /** Groupe-CIBLE JOKER : il vise n'importe quel combattant (`groupMatch`), hormis les porteurs
     *  d'un `exceptGroups`. Absent = appartenance STRICTE par id. */
    matchesAll: z.literal(true).optional(),
    /** Ids de `groups.json` RETRANCHÉS du joker — un combattant qui en porte un n'est pas visé. */
    exceptGroups: z.array(z.string()).optional(),
  }),
);
