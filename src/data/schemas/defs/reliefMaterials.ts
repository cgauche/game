/**
 * Schéma de `reliefMaterials.json` — apparence de RENDU du relief (falaise/rampe/tablier/pilier iso,
 * plafond/riser/sol-repli POV), consommée comme `ReliefMaterialDef[]` (`src/gameIso/catalog/relief/types.ts`).
 *
 * RÉSERVE sur le `label` de `riser` (« Contremarche ») : il suit la convention de nommage de sa
 * famille bâtie, NON confirmée à l'usage — aucun site n'assigne `riser` à une Face, l'entrée est
 * peut-être morte (#1540).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { detailRecipeSchema } from '../grammaire/valeurs';

export const file = 'reliefMaterials.json';
export const famille = 'entite';

const doc = document(
  'reliefMaterials',
  famille,
  {
    /** Masse BÂTIE (maçonnerie, ouvrage) vs relief NATUREL (talus) — absent = naturel. */
    built: z.boolean().optional(),
    detail: detailRecipeSchema.optional(),
    face: z.string(),
    foot: z.string().optional(),
    slopeTop: z.string().optional(),
    shadeDark: z.number().optional(),
  },
  {
    built: { label: 'Relief bâti', hint: 'Ouvrage maçonné (vs relief naturel type talus)' },
    detail: { label: 'Recette de détail' },
    face: { label: 'Couleur de face', hint: 'Teinte de la face principale du relief' },
    foot: { label: 'Couleur de pied', hint: 'Falaise : ombre de pied' },
    slopeTop: { label: 'Couleur de nez de pente', hint: 'Rampe : arête haute éclairée de la pente (le pied est dérivé par ombrage)' },
    shadeDark: { label: 'Assombrissement', hint: 'Facteur d’assombrissement de la face sombre' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: 'catalogue de matériaux de relief (rendu iso), pas une fiche de contenu.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
