/**
 * Schéma de `propMaterials.json` — matériaux de rendu des recettes volumiques de décor
 * (`PropMaterialData`, `src/data/props.types.ts`). Couleur hexadécimale + réponse à la lumière ;
 * aucune émission : une source lumineuse est un `light` de prop ou d'instance, jamais un matériau.
 */
import { z } from 'zod';

export const file = 'propMaterials.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    id: z.string().min(1),
    label: z.string().min(1),
    color: z.string().regex(/^#[0-9a-f]{6}$/),
    roughness: z.number().min(0).max(1),
    metalness: z.number().min(0).max(1),
  }),
);
