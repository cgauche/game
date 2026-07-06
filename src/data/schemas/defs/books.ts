/**
 * Schéma de `books.json` — dérivé du contenu RÉEL (29 entrées, script d'inventaire) et de
 * `BookData` (`src/data/index.ts:1096`). `id` = relation id-pure vers `source.book` (migration
 * `21aa4881`). `abr`/`language`/`folder` sont typés nullable par l'interface mais toujours
 * renseignés (string) sur les 29 entrées observées ; `desc` est le seul champ réellement null
 * (1/29).
 */
import { z } from 'zod';

export const file = 'books.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    abr: z.string().nullable(),
    language: z.string().nullable(),
    folder: z.string().nullable(),
    /** HTML de présentation (bibliographie) — hors du périmètre `<Prose>` (pas un texte de règle
     *  copié/collé verbatim d'un livre, mais une notice éditoriale du dataset lui-même). */
    desc: z.string().nullable(),
  }),
);

export type BooksData = z.infer<typeof schema>;
