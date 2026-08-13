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
  /** Exposant de la courbe de brume (`fogAt`, `pov/camera.ts`), porté au shader comme LITTÉRAL GLSL à
   *  quatre décimales (`applyFogGamma`, `backends/webgl/sceneMeshes.ts`). Le plancher est celui de ce
   *  littéral : sous 0,00005 il s'écrirait « 0.0000 », donc `pow(x, 0) = 1` — une brume PLEINE partout,
   *  sans un mot. 0,1 le tient à distance (données actuelles : 2 dehors, 1,2 dedans). #1176 P3-1c */
  fogGamma: z.number().positive().min(0.1),
});

/** Couleur écrite en HEXA `#rrggbb` — la forme que lisent `THREE.Color` comme le SVG. */
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'couleur hexadécimale « #rrggbb » attendue');

/** #1176 P2-6 — PRÉCIPITATION MONDE d'un type de météo : le semis de particules qui tombe dans le
 *  volume de la voie volumique. Toutes les bornes sont des bornes de PLAUSIBILITÉ physique et de
 *  BUDGET : une donnée hors bornes ne fait pas une météo étrange, elle fait un semis qui ne tombe
 *  pas (vitesse nulle), qui remonte (négative) ou qui noie la frame (densité). */
const precipSchema = z
  .strictObject({
    /** Particules par m² de SOL couvert — c'est elle qui fixe le budget d'instances de la scène. */
    density: z.number().gt(0).max(2),
    /** Vitesse de CHUTE (m/s). */
    fallMs: z.number().gt(0).max(40),
    /** Dérive du VENT (m/s) dans le plan du sol (`x` = est, `z` = sud). */
    windMs: z.strictObject({ x: z.number().min(-30).max(30), z: z.number().min(-30).max(30) }),
    /** Largeur et longueur (m) d'une particule — la longueur court dans le sens de la chute. */
    widthM: z.number().gt(0).max(1),
    lengthM: z.number().gt(0).max(4),
    /** Hauteur (m) du PLAFOND de semis au-dessus du sol : le volume où les particules vivent. */
    ceilingM: z.number().gt(0).max(60),
    color: hexColor,
    opacity: z.number().gt(0).max(1),
  })
  .refine((p) => p.lengthM >= p.widthM, {
    message: 'precip : `lengthM` ≥ `widthM` — une particule s’étire dans le sens de sa chute, elle n’est jamais plus large que longue',
  })
  .refine((p) => Math.hypot(p.windMs.x, p.windMs.z) < p.fallMs, {
    message: 'precip : la dérive du vent doit rester SOUS la vitesse de chute — au-delà, la précipitation file à l’horizontale et ne touche plus le sol',
  });

/** #1247 — BRUME MONDE d'un type de météo : des nappes horizontales translucides posées à des cotes
 *  fixes au-dessus du sol, dans le volume de la voie volumique (`backends/webgl/weatherSheets.ts`).
 *
 *  RÉFÉRENCE de `hM` : cote ABSOLUE monde, comptée au-dessus du sol le plus BAS de l'emprise de la
 *  carte — la même référence que le recyclage du semis de précipitation (`precipArea`,
 *  `backends/webgl/weatherParticles.ts`), pour que les deux expressions d'une même météo se posent
 *  dans le même repère. Une carte à fort relief a donc des nappes qui rasent ses creux et enterrent
 *  ses sommets : c'est le prix d'une cote unique par scène, et c'est mesurable à l'authoring.
 *
 *  Les bornes sont des bornes de BUDGET et de TRI : quatre nappes au plus (au-delà, c'est un voile
 *  plein), des cotes STRICTEMENT croissantes (deux nappes à la même cote ne se trient pas — leur
 *  ordre de mélange dépendrait de l'ordre de montage), et un alpha non nul (une nappe invisible se
 *  supprime, elle ne s'écrit pas `alpha: 0`). */
const brumeSchema = z
  .strictObject({
    color: hexColor,
    layers: z
      .array(
        z.strictObject({
          /** Cote (m) de la nappe au-dessus du sol le plus BAS de la carte. */
          hM: z.number().min(0).max(60),
          alpha: z.number().gt(0).max(1),
        }),
      )
      .min(1)
      .max(4),
    /** RESSERREMENT de la portée première personne sous cette météo (part de la portée du milieu) :
     *  1 = portée intacte. Appliqué EN AMONT de la courbe de brume ET du plan lointain de la caméra
     *  (`povDepth`, `gameIso/pov/camera.ts`) — les deux ou aucun. */
    povTightenK: z.number().gt(0).max(1).optional(),
  })
  .refine((b) => b.layers.every((l, i) => i === 0 || l.hM > b.layers[i - 1].hM), {
    message: 'brume : les cotes `hM` doivent croître STRICTEMENT — deux nappes à la même cote ne se trient pas',
  });

// #239 — FX de météo AUTHORÉE de scène (`scene.weather`), par type.
const weatherFxSchema = z.strictObject({
  tint: z.string(),
  alpha: z.number(),
  particles: z.enum(['pluie', 'averse', 'neige']).optional(),
  pcolor: z.string().optional(),
  density: z.number().optional(),
  /** Absent = ce type ne fait TOMBER aucune particule (le brouillard n'en fait pas). */
  precip: precipSchema.optional(),
  /** Absent = ce type ne pose AUCUNE nappe de brume (la pluie et la neige n'en posent pas : leur
   *  expression volumique est le semis plus la teinte dérivée de `tint`/`alpha`). */
  brume: brumeSchema.optional(),
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
