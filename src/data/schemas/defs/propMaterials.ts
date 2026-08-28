/**
 * Schéma de `propMaterials.json` — matériaux de rendu des recettes volumiques de décor
 * (`PropMaterialData`, `src/data/props.types.ts`). Couleur hexadécimale + réponse à la lumière ;
 * aucune émission : une source lumineuse est un `light` de prop ou d'instance, jamais un matériau.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'propMaterials.json';
export const famille = 'entite';

const doc = document(
  'propMaterials',
  famille,
  {
    color: z.string().regex(/^#[0-9a-f]{6}$/),
    roughness: z.number().min(0).max(1),
    metalness: z.number().min(0).max(1),
  },
  {
    color: { label: 'Couleur', hint: 'Teinte hexadécimale `#rrggbb` du matériau' },
    roughness: { label: 'Rugosité', hint: 'Réponse mate/brillante à la lumière' },
    metalness: { label: 'Métallicité', hint: 'Part de réponse métallique à la lumière' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "catalogue de matériaux des recettes volumiques de décor (couleur, rugosité, métallicité — rendu WebGL), jumeau exact de `reliefMaterials`/`roofMaterials` : le meuble qui les porte s'expose, pas la teinte de ses primitives.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
