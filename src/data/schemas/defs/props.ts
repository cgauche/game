/**
 * Schéma de `props.json` — accessoires de scène : couche sémantique (solidité/opacité/couvert/lumière),
 * EMPREINTE de grille, recette VOLUMIQUE locale et places assises. `propDataSchema` et ses sous-schémas
 * sont des exports NOMMÉS de ce module (arbitrage vague mobilier), miroir de l'interface `PropData`
 * (`src/data/props.types.ts`).
 */
import { z } from 'zod';
import { cell2Schema } from '../grammaire/valeurs';

export const file = 'props.json';
export const famille = 'entite';

/** `PropPoint3` / `PropSize3` (`src/data/props.types.ts`) — repère LOCAL d'une recette de décor :
 *  `x`/`y` en cases depuis le centre de la case d'ancrage, `h` en mètres depuis le sol de la case. */
export const propPoint3Schema = z.strictObject({ x: z.number().finite(), y: z.number().finite(), h: z.number().finite() });
export const propSize3Schema = z.strictObject({ x: z.number().finite(), y: z.number().finite(), h: z.number().finite() });

/** `PropPrimitive` (`src/data/props.types.ts`) — volume élémentaire d'une recette : caisse droite,
 *  cylindre à N faces, prisme en pente. `material` réfère un id de `propMaterials.json`. */
export const propPrimitiveSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('box'), center: propPoint3Schema, size: propSize3Schema, material: z.string().min(1) }),
  z.strictObject({
    kind: z.literal('cylinder'), center: propPoint3Schema, radius: z.number().finite(), heightM: z.number().finite(),
    sides: z.union([z.literal(8), z.literal(12), z.literal(16)]), material: z.string().min(1),
  }),
  z.strictObject({ kind: z.literal('prism'), center: propPoint3Schema, size: propSize3Schema, slope: z.enum(['x+', 'x-', 'y+', 'y-']), material: z.string().min(1) }),
]);

/** `PropVolumeRecipe` (`src/data/props.types.ts`) — la recette volumique d'un décor. */
export const propVolumeRecipeSchema = z.strictObject({ primitives: z.array(propPrimitiveSchema) });

/** `PropSeatSlot` (`src/data/props.types.ts`) — place assise offerte par un décor : ancre du corps,
 *  cap du corps assis (Dir8), et case d'ABORD relative à l'ancre de l'empreinte. */
export const propSeatSlotSchema = z.strictObject({
  id: z.string().min(1),
  anchor: propPoint3Schema,
  facing: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']),
  approach: cell2Schema,
});

/** `PropData` (`src/data/props.types.ts`) — type de décor app-owned : vérité UNIQUE de l'empreinte,
 *  de la physique, de la recette volumique et des places assises. Entrée de `props.json`, et contrat
 *  partagé par `src/state` (walkability, LdV, lumière) et `src/gameIso` (rendu). */
export const propDataSchema = z.strictObject({
  id: z.string(),
  /** Miroir du `label` de la def d'ART du même id (`src/gameIso/catalog/decor/defs/<id>.ts`) —
   *  parité gardée par `src/data/props-label-parite.test.ts`. */
  label: z.string().min(1),
  solid: z.boolean().optional(),
  opaque: z.boolean().optional(),
  cover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
  // `tone` (#1245, L4) = APPARENCE seule (`lightTones.json` : couleur/intensité/vacillement),
  // résolue au bord du rendu ; le RAYON reste la seule chose que le moteur lise d'une source.
  light: z.strictObject({ radiusTiles: z.number(), tone: z.string().optional() }).optional(),
  foot: z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() }).optional(),
  volume: propVolumeRecipeSchema.optional(),
  seatSlots: z.array(propSeatSlotSchema).optional(),
});

export const schema = z.array(propDataSchema);
