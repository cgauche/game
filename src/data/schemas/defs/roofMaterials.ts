/**
 * Schéma de `roofMaterials.json` — apparence de RENDU des toits, consommée comme `RoofMaterialDef[]`
 * (`src/gameIso/catalog/roofs/types.ts`). 4 entrées réelles : 3 matériaux de couverture (tuile/chaume/
 * ardoise, teintes N/E/S/O + `detail` + volume d'avant-toit) et 1 « plan » vu du dessus (`planBody`/
 * `planEdge`/`planInner`/`planText` seulement — pas de N/E/S/O/detail).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { detailRecipeSchema } from '../grammaire/valeurs';

export const file = 'roofMaterials.json';
export const famille = 'entite';

const doc = document(
  'roofMaterials',
  famille,
  {
    detail: detailRecipeSchema.optional(),
    N: z.string().optional(),
    E: z.string().optional(),
    S: z.string().optional(),
    O: z.string().optional(),
    line: z.string().optional(),
    planBody: z.string().optional(),
    planEdge: z.string().optional(),
    planInner: z.string().optional(),
    planText: z.string().optional(),
    eaveOverhangM: z.number().optional(),
    soffite: z.string().optional(),
    fasciaDropM: z.number().optional(),
    fasciaThickM: z.number().optional(),
    fascia: z.string().optional(),
    ridgeCap: z.string().optional(),
  },
  {
    detail: { label: 'Recette de détail' },
    N: { label: 'Couleur face nord' },
    E: { label: 'Couleur face est' },
    S: { label: 'Couleur face sud' },
    O: { label: 'Couleur face ouest' },
    line: { label: 'Couleur de liseré de structure', hint: 'Liseré de structure : faîte, arêtiers et égouts' },
    planBody: { label: 'Couleur du plan (corps)', hint: 'Vue de dessus, toit en plan' },
    planEdge: { label: 'Couleur du plan (bord)', hint: 'Vue de dessus : liseré du contour' },
    planInner: { label: 'Couleur du plan (intérieur)', hint: 'Vue de dessus : cadre intérieur' },
    planText: { label: 'Couleur du plan (texte)', hint: 'Vue de dessus : texte du nom' },
    eaveOverhangM: {
      label: 'Débord d’avant-toit',
      hint: 'Débord du soffite au-delà de l’égout, en CASES (le suffixe M du nom ne dit pas l’unité) — absent, aucun débord',
    },
    soffite: { label: 'Couleur de soffite', hint: 'Sous-face de l’avant-toit' },
    fasciaDropM: { label: 'Hauteur de planche de rive', hint: 'En mètres' },
    fasciaThickM: { label: 'Épaisseur de planche de rive', hint: 'En mètres' },
    fascia: { label: 'Couleur de planche de rive' },
    ridgeCap: { label: 'Couleur de faîtière' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: 'catalogue de matériaux de toiture (rendu iso), pas une fiche de contenu.',
      },
    },
    edit: { none: 'catalogue de rendu édité au fichier — absent de `CodexEdit.CATEGORY_DATASET`' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
