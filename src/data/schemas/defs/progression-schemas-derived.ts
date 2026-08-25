/**
 * Schéma de `progression-schemas.derived.json` — artefact GÉNÉRÉ (#905) par
 * `python scripts/data/gen-progression-schemas.py`, qui lit dans les PDF de `Source/` le schéma de
 * progression imprimé de chaque Carrière (quelle marque de niveau coche quelle Caractéristique).
 * Il n'est pas authoré : ce contrat verrouille la FORME que le générateur écrit et que
 * `scripts/guards/lib/progressionSchemas.mjs` consomme, pour qu'une édition à la main s'y casse.
 */
import { z } from 'zod';
import { charKeySchema } from '../grammaire/valeurs';

export const file = 'progression-schemas.derived.json';

/** Une marque lue sur la page : sa colonne imprimée, la Caractéristique correspondante, son abscisse
 *  et — pour les niveaux 2/3/4, imprimés en aplat — la couleur RVB MESURÉE qui donne le niveau. Le
 *  niveau 1 est un glyphe de police (`crossbatstfb`), sans aplat donc sans teinte. */
const markSchema = z.strictObject({
  col: z.enum(['CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc']),
  key: charKeySchema,
  x: z.number(),
  teinte: z.tuple([z.number(), z.number(), z.number()]).optional(),
  mark: z.literal('glyphe').optional(),
});

export const schema = z.strictObject({
  __genere: z.string(),
  __lecture: z.string(),
  __livres: z.array(z.string()),
  schemas: z.array(
    z.strictObject({
      /** `id` du livre (`books.json`). */
      book: z.string(),
      /** Folio IMPRIMÉ relevé SUR la page — jamais l'index PDF (l'écart n'est pas constant). */
      folio: z.number(),
      /** Titre imprimé le plus proche AU-DESSUS de la bande, tel que la couche texte le recolle ;
       *  `null` si aucun titre de la page ne la coiffe (VDM folio 188, colonne de droite : le bloc
       *  commence à la page précédente) — la garde rapproche alors par `titresPage`. */
      career: z.string().nullable(),
      titresPage: z.array(z.string()),
      pdfpage: z.number(),
      y: z.number(),
      lv: z.strictObject({
        '1': z.array(markSchema),
        '2': z.array(markSchema),
        '3': z.array(markSchema),
        '4': z.array(markSchema),
      }),
    }),
  ),
});
