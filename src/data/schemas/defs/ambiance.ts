/**
 * Schéma de `ambiance.json` — AMBIANCE de rendu partagée iso ⇄ POV (ciel/brumes/vignette/voile chaud/
 * filtre d'étage), consommée comme `AmbianceDef` (objet RACINE unique, PAS un tableau) —
 * `src/gameIso/catalog/ambiance.ts`.
 */
import { z } from 'zod';

export const file = 'ambiance.json';

const radialVeilSchema = z.strictObject({
  cx: z.string(),
  cy: z.string(),
  r: z.string(),
  color: z.string(),
  alpha: z.number(),
  innerOff: z.string().optional(),
});

const povFogSchema = z.strictObject({
  farTiles: z.number(),
  fogStartT: z.number(),
  fogGamma: z.number(),
});

// #239 — FX de météo AUTHORÉE de scène (`scene.weather`), par type.
const weatherFxSchema = z.strictObject({
  tint: z.string(),
  alpha: z.number(),
  particles: z.enum(['pluie', 'averse', 'neige']).optional(),
  pcolor: z.string().optional(),
  density: z.number().optional(),
});

/** Facteur multiplicatif de teinte : 0 = éteint, 1 = pleine matière — hors de [0,1] il n'éclaircit
 *  plus, il sur-expose (ou inverse le signe de la couleur). */
const tintFactor = z.number().min(0).max(1);

export const schema = z.strictObject({
  ambientFloor: z.number(),
  // `fogTint` = APPLICATION de la politique de visibilité en facteur MULTIPLICATIF (0..1), partagée par
  // les trois rendus (`gameIso/catalog/ambiance.ts`). Trois invariants la tiennent : un facteur reste
  // dans [0,1] ; l'ordre des états ne s'inverse pas (une case jamais vue ne peut pas être plus lumineuse
  // qu'un souvenir, ni un souvenir plus lumineux que le vu) ; `explored` est le DÉNOMINATEUR du cran
  // d'ambiance POV (`pov/geometry.ts` : `POV_AMBIENT.unknown`), donc strictement positif.
  fogTint: z
    .strictObject({ visible: tintFactor, explored: tintFactor, unknown: tintFactor })
    .refine((t) => t.explored > 0, {
      message: 'fogTint.explored doit être > 0 : il divise le cran d’ambiance POV (`POV_AMBIENT.unknown`)',
    })
    .refine((t) => t.visible >= t.explored && t.explored >= t.unknown, {
      message: 'fogTint doit décroître visible ≥ explored ≥ unknown : une case moins connue ne peut pas être plus lumineuse',
    }),
  iso: z.strictObject({
    warm: radialVeilSchema,
    vignette: radialVeilSchema,
    lowerFloorDim: z.strictObject({ saturate: z.number(), slope: z.number() }),
    nightVeil: z.string(),
    nightVeilMax: z.number(),
    dayVignetteFloor: z.number(),
    edgeDepth: z.strictObject({
      color: z.string(),
      alpha: z.number(),
      topFrac: z.number(),
      bottomFrac: z.number(),
    }),
    weather: z.strictObject({
      pluie: weatherFxSchema.optional(),
      brouillard: weatherFxSchema.optional(),
      neige: weatherFxSchema.optional(),
      tempete: weatherFxSchema.optional(),
    }),
  }),
  pov: z.strictObject({
    skyTop: z.string(),
    fogIndoor: z.string(),
    fogOutdoor: z.string(),
    fogOutdoorSurface: z.string(),
    ambientUnseen: z.number(),
    warm: radialVeilSchema,
    floorOcclusion: z.number(),
    depth: z.strictObject({
      outdoor: povFogSchema,
      indoor: povFogSchema,
      lod: z.strictObject({
        blocksT: z.number(),
        fadeT: z.number(),
        minJointSpacingPx: z.number(),
        meshStartT: z.number(),
        meshFadeT: z.number(),
        meshShade: z.number(),
        meshJointWM: z.number(),
      }),
      billboards: z.strictObject({ maxPersons: z.number(), maxProps: z.number() }),
    }),
    vignette: radialVeilSchema,
  }),
});

export type AmbianceData = z.infer<typeof schema>;
