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

export const schema = z.strictObject({
  ambientFloor: z.number(),
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
