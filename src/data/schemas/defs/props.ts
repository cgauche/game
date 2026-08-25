/**
 * Schéma de `props.json` — accessoires de scène : couche sémantique (solidité/opacité/couvert/lumière),
 * EMPREINTE de grille, recette VOLUMIQUE locale et places assises. Dérivé de l'interface `PropData`
 * (`src/data/props.types.ts`, contrat neutre partagé par `src/state` et `src/gameIso`).
 */
import { z } from 'zod';

export const file = 'props.json';

const point3 = z.strictObject({ x: z.number().finite(), y: z.number().finite(), h: z.number().finite() });
const size3 = z.strictObject({ x: z.number().finite(), y: z.number().finite(), h: z.number().finite() });
const material = z.string().min(1);

const primitive = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('box'), center: point3, size: size3, material }),
  z.strictObject({ kind: z.literal('cylinder'), center: point3, radius: z.number().finite(), heightM: z.number().finite(), sides: z.union([z.literal(8), z.literal(12), z.literal(16)]), material }),
  z.strictObject({ kind: z.literal('prism'), center: point3, size: size3, slope: z.enum(['x+', 'x-', 'y+', 'y-']), material }),
]);

const dir8 = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']);

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    solid: z.boolean().optional(),
    opaque: z.boolean().optional(),
    cover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
    // `tone` (#1245, L4) = APPARENCE seule (`lightTones.json` : couleur/intensité/vacillement),
    // résolue au bord du rendu ; le RAYON reste la seule chose que le moteur lise d'une source.
    light: z.strictObject({ radiusTiles: z.number(), tone: z.string().optional() }).optional(),
    foot: z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() }).optional(),
    volume: z.strictObject({ primitives: z.array(primitive) }).optional(),
    seatSlots: z.array(z.strictObject({
      id: z.string().min(1),
      anchor: point3,
      facing: dir8,
      approach: z.strictObject({ x: z.number().finite(), y: z.number().finite() }),
    })).optional(),
  }),
);
