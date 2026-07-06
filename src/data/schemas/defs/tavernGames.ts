/**
 * Schéma de `tavernGames.json` — Jeux de taverne (Nuits agitées & dures journées, ch.16), consommé
 * par `src/engine/tavernGame.ts:44` (type `TavernGame`, 11 entrées réelles). `skill` = `id` de
 * `skills.json` ou `null` (aucune Compétence indiquée → Pari, variante rapide l.11) — string libre
 * car free-form FK non validée ici (grep du JSON : "savoir"/"projectiles"/"pari"/"corps-a-corps").
 * `characteristic` réutilise l'enum `CharKey` du moteur (`src/engine/types.ts:18`). `read` : seule
 * "units-tens" apparaît dans le JSON réel ; "sl" ajouté car explicitement dans le type consommateur
 * (`TavernGame.read`, `src/engine/tavernGame.ts:38`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'tavernGames.json';

const charKeySchema = z.enum(['CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc']);

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    skill: z.string().nullable(),
    spec: z.string().optional(),
    characteristic: charKeySchema.optional(),
    mode: z.enum(['opposed', 'extended']),
    target: z.number().optional(),
    drCap: z.number().optional(),
    read: z.enum(['sl', 'units-tens']).optional(),
    stake: z.string().optional(),
    source: sourceRefSchema,
  }),
);

export type TavernGamesData = z.infer<typeof schema>;
