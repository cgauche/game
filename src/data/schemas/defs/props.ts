/**
 * Schéma de `props.json` — accessoires de scène : couche sémantique (solidité/opacité/couvert/lumière),
 * EMPREINTE de grille, recette VOLUMIQUE locale et places assises. Les sous-schémas sont des exports
 * NOMMÉS de ce module (arbitrage vague mobilier), miroir de l'interface `PropData`
 * (`src/data/props.types.ts`) ; l'ENTRÉE elle-même est rendue par `document()`.
 */
import { z } from 'zod';
import { cell2Schema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';

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
 *  partagé par `src/state` (walkability, LdV, lumière) et `src/gameIso` (rendu).
 *  Le `label` de l'enveloppe est le MIROIR du `label` de la def d'ART du même id
 *  (`src/gameIso/catalog/decor/defs/<id>.ts`) — parité gardée par `src/data/props-label-parite.test.ts`. */
const doc = document(
  'props',
  famille,
  {
    solid: z.boolean().optional(),
    opaque: z.boolean().optional(),
    cover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
    // `tone` (#1245, L4) = APPARENCE seule (`lightTones.json` : couleur/intensité/vacillement),
    // résolue au bord du rendu ; le RAYON reste la seule chose que le moteur lise d'une source.
    light: z.strictObject({ radiusTiles: z.number(), tone: z.string().optional() }).optional(),
    foot: z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() }).optional(),
    volume: propVolumeRecipeSchema.optional(),
    seatSlots: z.array(propSeatSlotSchema).optional(),
  },
  {
    solid: { label: 'Bloque le passage', hint: 'Empêche de marcher sur la case (combat et exploration)' },
    opaque: { label: 'Bloque la vue', hint: 'Coupe la ligne de vue (LdV)' },
    cover: { label: 'Couvert', hint: 'Degré de couvert offert (imparfaite/moyenne/totale)' },
    light: { label: 'Source lumineuse', hint: 'Rayon éclairé (en cases) et ton optionnel de la source' },
    foot: { label: 'Empreinte au sol', hint: 'Largeur × profondeur en cases occupées par le décor' },
    volume: { label: 'Recette volumique', hint: 'Primitives (caisse/cylindre/prisme) composant le rendu volumique du décor' },
    seatSlots: { label: 'Places assises', hint: 'Ancres, orientation et case d’abord des places offertes par le décor' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'catalogue des placeables de décor (art, pas règle) — aucune catégorie du Codex ne l’expose ; il s’édite à la palette de l’éditeur de carte',
      },
    },
    edit: { none: 'édité à la PALETTE de décor de l’éditeur de carte, jamais par une catégorie du Codex' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
/** Clés top-level de l'ENTRÉE (enveloppe + champs), relevées AVANT le sceau — le nœud rendu par la
 *  fabrique n'a plus de `.shape`. Consommée par `scripts/guards/lib/fieldConsumerTargets.mjs`, qui
 *  dégraderait SILENCIEUSEMENT à zéro champ sur un nœud scellé. */
export const cles = doc.cles;
