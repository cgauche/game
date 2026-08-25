/**
 * Schéma de `regles.json` — catalogue des PROCÉDURES / OPTIONS de jeu (Sombre Pacte, modes
 * d'attaque/défense, Empoignade, Focalisation étendue…) dont le texte est un COPIÉ-COLLÉ VERBATIM
 * du Source (règle stricte 5). Consommé par le Codex (`registry.ts`, catégorie `regles`) et routé en
 * tooltip `CodexRef`. `desc` non vide (garde `regles.test.ts`) ; `source` = folio IMPRIMÉ.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'regles.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    /** Prose VERBATIM Markdown (règle stricte 5) — non vide, rendue par `<Prose>`. */
    desc: z.string().min(1),
    source: sourceRefSchema,
  }),
);
