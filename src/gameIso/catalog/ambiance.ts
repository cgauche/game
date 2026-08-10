/** AMBIANCE partagée iso ⇄ POV — donnée pure (`src/data/ambiance.json`) : ciel d'extérieur, brumes
 *  (intérieure sombre / extérieure claire), vignette, voile chaud, filtre d'étage inférieur, voile de
 *  nuit. Les stages (IsoStage/PovStage) et la QC headless consomment les MÊMES defs SVG assemblées ici —
 *  plus aucune de ces couleurs en dur dans un renderer. */
import { ambiance } from '../../data';
import { ao, spec } from '../shade';
import type { Dims } from '../../geometry/iso';
import type { Visibility } from '../../state/visibility';

/** Halo radial (voile chaud / vignette) : centre + rayon en %, couleur et alpha au bord utile. */
export interface RadialVeilDef { cx: string; cy: string; r: string; color: string; alpha: number; innerOff?: string }

/** #239 — voile de MÉTÉO authorée (`scene.weather`) : teinte plein écran (`tint`/`alpha`) et,
 *  pour la précipitation, un champ de particules (`particles` = classe CSS, `pcolor`, `density`). */
export interface WeatherFxDef { tint: string; alpha: number; particles?: 'pluie' | 'averse' | 'neige'; pcolor?: string; density?: number }
export type WeatherFxId = 'pluie' | 'brouillard' | 'neige' | 'tempete';

export interface AmbianceDef {
  /** Luminosité PLANCHER partagée : une surface éclairée à 0 n'est jamais totalement noire. Source UNIQUE
   *  du clamp de lumière des DEUX vues — POV (`tint`, `pov/camera.ts`) et voile d'occlusion des sols iso
   *  (`backends/affineFloors.ts`) → les deux répondent d'un cran égal. */
  ambientFloor: number;
  /** APPLICATION de la politique de visibilité (`state/visibility.ts`) en facteur multiplicatif, par
   *  état de case. Source UNIQUE des trois rendus : couleur de sommet du monde three (`visibilityTint`),
   *  terme `brightness` du voile CSS de l'iso (`FogLayer`), lumière d'ambiance d'une surface non vue au
   *  POV (`pov/geometry.ts`). Un filtre CSS composé n'est pas un scalaire : l'iso n'y prend que son
   *  `brightness` d'`explored`, et sa case inconnue s'éteint (`brightness(0)`) là où un rendu 3D garde
   *  un facteur bas mais non nul — une silhouette noire y serait illisible. */
  fogTint: Record<Visibility, number>;
  iso: {
    /** Voile CHAUD (lumière dorée descendante) posé sur toute la scène. */
    warm: RadialVeilDef;
    /** Vignette d'assombrissement des bords. */
    vignette: RadialVeilDef;
    /** Filtre de l'ÉTAGE INFÉRIEUR (multi-niveaux) : désaturation + assombrissement, SANS opacité. */
    lowerFloorDim: { saturate: number; slope: number };
    /** Voile de NUIT (rect plein écran, alpha piloté par la lumière ambiante). */
    nightVeil: string;
    /** Alpha MAX du voile de nuit (à luminosité 0). L'alpha effectif = `(1 − ambientScalar) × nightVeilMax`,
     *  PARTAGÉ par l'iso ET le POV → les deux vues s'assombrissent à l'identique selon `scene.ambientLight`. */
    nightVeilMax: number;
    /** Opacité de la VIGNETTE à PLEINE lumière (jour). Elle monte vers 1 quand la luminosité baisse →
     *  une scène « jour » n'est plus enfumée de grimdark ; on l'assombrit en baissant `ambientLight`. */
    dayVignetteFloor: number;
    /** Ombrage de PROFONDEUR de la vue « de face » (edge-on) : les rangées écran LOINTAINES (haut de
     *  l'écran) s'assombrissent progressivement (perspective atmosphérique). Décoration de VUE, subtile
     *  (alpha ≈ 8-12 % max). `topFrac`/`bottomFrac` = bornes verticales écran du dégradé (0 = haut). */
    edgeDepth: { color: string; alpha: number; topFrac: number; bottomFrac: number };
    /** Voiles de MÉTÉO authorée de scène (`scene.weather`), par type (#239). `clair` = absent. */
    weather: Partial<Record<WeatherFxId, WeatherFxDef>>;
  };
  pov: {
    /** Haut du ciel d'extérieur — l'horizon se fond dans `fogOutdoor`. */
    skyTop: string;
    /** Brume de distance en INTÉRIEUR (sombre) — aussi le fond des scènes couvertes. */
    fogIndoor: string;
    /** Brume de distance du CIEL EXTÉRIEUR (claire) : bas du dégradé `pov-sky` = horizon. */
    fogOutdoor: string;
    /** Brume de distance des SURFACES en extérieur (sol/mur/relief). DÉCOUPLÉE du ciel : plus chaude et
     *  moins claire que `fogOutdoor` → les sols lointains se fondent dans une brume atmosphérique COHÉRENTE
     *  avec l'iso (chaud/mat), plutôt que de se relever vers le ciel froid et clair (« délavé »). */
    fogOutdoorSurface: string;
    /** Facteur de LUMIÈRE D'AMBIANCE d'une surface STATIQUE non encore VUE (brouillard de guerre) :
     *  multiplie la lumière ambiante de la scène (jour clair / nuit sombre) pour garder la matière
     *  lisible mais LÉGÈREMENT en retrait d'une case explorée — jamais du noir ni un aplat de brume. */
    ambientUnseen: number;
    /** Voile CHAUD du POV (miroir de `iso.warm`) : réconcilie la TEMPÉRATURE des matériaux entre les deux
     *  vues — le POV, sinon, reste froid (swatch neutre + brume de ciel froide) là où l'iso a `g_warm`. */
    warm: RadialVeilDef;
    /** OCCLUSION intra-tuile du sol POV : amplitude d'un dégradé vertical (spéculaire en haut/loin →
     *  ombre de contact en bas/près) posé sur chaque losange — miroir du « creusé » que l'iso tire de son
     *  dégradé de terrain (ex. `g_pave` 143→99). MOYENNE-neutre (highlight ET ombre) : on ajoute du relief,
     *  pas du sombre. 0 = aplat plasticky, sans relief. */
    floorOcclusion: number;
    /** PROFONDEUR du POV — portées, courbes de brume et bandes de LOD, tout en DONNÉE. */
    depth: PovDepthDef;
    vignette: RadialVeilDef;
  };
}

/** Courbe de brume ATMOSPHÉRIQUE d'un milieu : portée max de rendu (cases), début du voile,
 *  gamma de la smoothstep (>1 = les silhouettes restent lisibles plus loin avant de se délaver). */
export interface PovFogDef { farTiles: number; fogStartT: number; fogGamma: number }

export interface PovDepthDef {
  /** Extérieur : perspective atmosphérique longue (claire). */
  outdoor: PovFogDef;
  /** Intérieur : brume sombre COURTE (donnée séparée). */
  indoor: PovFogDef;
  /** Bandes de LOD matériaux — les transitions se CHEVAUCHENT en fondu, jamais de coupure sèche. */
  lod: {
    /** Appareillage COMPLET (blocs nuancés + joints verticaux) jusqu'ici (cases)… */
    blocksT: number;
    /** …puis fondu des blocs/verticaux sur cette longueur (cases). */
    fadeT: number;
    /** Pas PROJETÉ minimal (px) d'un rang : en-dessous les rangs se fondent (anti-moiré) —
     *  le maillage de tuiles et la brume prennent le relais. */
    minJointSpacingPx: number;
    /** Maillage de tuiles des terrains SANS appareillage : fondu d'entrée [start, start+fade] (cases). */
    meshStartT: number;
    meshFadeT: number;
    /** Assombrissement des lignes du maillage (× shade de la teinte du terrain) — très subtil. */
    meshShade: number;
    /** Épaisseur métrique des lignes du maillage (m) quand le terrain n'a pas de joint propre. */
    meshJointWM: number;
  };
  /** Budgets de billboards par famille (les plus proches priment). */
  billboards: { maxPersons: number; maxProps: number };
}

export const AMBIANCE: AmbianceDef = ambiance;

/** Alpha du voile de NUIT à la luminosité `light` (0..1). SOURCE UNIQUE du dosage : le voile SVG de
 *  l'iso (`stage/Ambiance.tsx`) et le voile du POV (`pov/PovStage.tsx`) le posent tel quel. */
export function nightVeilAlpha(light: number): number {
  return (1 - light) * AMBIANCE.iso.nightVeilMax;
}

/** Part de la LUMINANCE d'origine qui subsiste sous le voile de nuit à la luminosité `light` — soit
 *  `1 − nightVeilAlpha(light)`, l'autre face de la MÊME donnée. C'est le scalaire d'exposition commun
 *  aux DEUX voies de rendu du stage : la voie affine l'obtient en peignant son voile par-dessus la
 *  scène, la voie volumique en dose ses LAMPES avec (`stage/stageLights.ts`) — d'où une parité de
 *  luminosité par construction, et un plancher non nul à luminosité 0 (`1 − nightVeilMax`). */
export function ambianceLuminance(light: number): number {
  return 1 - nightVeilAlpha(light);
}

const radialVeil = (id: string, v: RadialVeilDef, fadeOut: boolean): string =>
  `<radialGradient id="${id}" cx="${v.cx}" cy="${v.cy}" r="${v.r}">` +
  (fadeOut
    ? `<stop offset="0%" stop-color="${v.color}" stop-opacity="${v.alpha}"/><stop offset="100%" stop-color="${v.color}" stop-opacity="0"/>`
    : `<stop offset="${v.innerOff ?? '50%'}" stop-color="${v.color}" stop-opacity="0"/><stop offset="100%" stop-color="${v.color}" stop-opacity="${v.alpha}"/>`) +
  `</radialGradient>`;

/** Defs SVG de l'ambiance ISO (voile chaud `g_warm`, vignette `g_vig`). */
export function isoAmbianceDefs(): string {
  const { warm, vignette } = AMBIANCE.iso;
  return radialVeil('g_warm', warm, true) + radialVeil('g_vig', vignette, false);
}

/** Assombrissement de l'étage INFÉRIEUR (z < activeZ) en CSS `filter` (GPU-composité par le navigateur →
 *  coût quasi nul, ≠ filtre SVG `url()` re-rastérisé au CPU par élément = rame). Même effet que l'ancien
 *  `lower-floor-dim` : désaturation + assombrissement, SANS opacité (l'étage recule mais reste OPAQUE). */
export function lowerFloorDimCss(): string {
  const { lowerFloorDim: dim } = AMBIANCE.iso;
  return `saturate(${dim.saturate}) brightness(${dim.slope})`;
}

/** Gabarit d'ALIGNEMENT ÉDITEUR (couche `z < currentLayer`, EditorCanvas UNIQUEMENT — jamais le jeu,
 *  qui reste sur `lowerFloorDimCss` ci-dessus telle quelle) : MÊME désaturation/assombrissement
 *  catalogués que le jeu + une VRAIE opacité — un gabarit doit pouvoir s'EFFACER franchement pour ne
 *  pas concurrencer le tracé de la couche active, ce que le voile de jeu (opaque par choix, l'étage
 *  du DESSOUS doit y rester pleinement lisible) ne permet pas. `opacity` = réglage UTILISATEUR
 *  (curseur, 0 = masqué, 1 = plein), jamais une constante catalogue. */
export function editorLowerLayerFilterCss(opacity: number): string {
  const { lowerFloorDim: dim } = AMBIANCE.iso;
  return `saturate(${dim.saturate}) brightness(${dim.slope}) opacity(${opacity})`;
}

/** Voile d'ASSOMBRISSEMENT de profondeur de la vue « de face » (edge-on) : les rangées écran lointaines
 *  (haut de l'écran) reculent dans une brume sombre progressive. DÉCORATION DE VUE (screen-space) —
 *  jamais dans les builders : le stage affine ET la QC l'appliquent au dessin, PAR-DESSUS la scène. Vide
 *  hors edge-on. Auto-contenu (gradient objectBoundingBox + rect plein cadre) → une seule source, deux
 *  consommateurs ; l'id partagé est sans risque (contenu identique entre panneaux). */
export function edgeDepthVeil(dims: Dims, w: number, h: number): string {
  if (!dims.edge || dims.view === 'top') return '';
  const { color, alpha, topFrac, bottomFrac } = AMBIANCE.iso.edgeDepth;
  return (
    `<linearGradient id="edge-depth" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="${(topFrac * 100).toFixed(1)}%" stop-color="${color}" stop-opacity="${alpha}"/>` +
    `<stop offset="${(bottomFrac * 100).toFixed(1)}%" stop-color="${color}" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#edge-depth)" pointer-events="none"/>`
  );
}

/** Defs SVG du POV : ciel d'extérieur (`pov-sky`) + vignette (`pov-vignette`).
 *  Le ciel atteint la couleur de brume EXACTEMENT à l'horizon (50 % = ligne d'œil, projection sans
 *  tangage) et le reste sous l'horizon : tout ce qui est coupé en portée ou hors visibilité se fond
 *  dans cette nappe — plus de « trous » de ciel à travers le sol. */
export function povAmbianceDefs(): string {
  const { skyTop, fogOutdoor, vignette, warm, floorOcclusion: occl } = AMBIANCE.pov;
  // OCCLUSION intra-tuile du sol : dégradé NEUTRE (spéculaire en haut/loin → transparent → ombre de contact
  // en bas/près) en objectBoundingBox → chaque losange de sol reçoit le MÊME « creusé » vertical que l'iso,
  // indépendamment de sa couleur (fog/lumière). Couleurs via `spec`/`ao` (shade.ts, sanctionnés).
  const floorShade =
    `<linearGradient id="pov-floor-shade" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${spec(occl)}"/>` +
    `<stop offset="50%" stop-color="${ao(0)}"/>` +
    `<stop offset="100%" stop-color="${ao(occl)}"/>` +
    `</linearGradient>`;
  return (
    `<linearGradient id="pov-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${skyTop}"/><stop offset="50%" stop-color="${fogOutdoor}"/><stop offset="100%" stop-color="${fogOutdoor}"/></linearGradient>` +
    floorShade +
    radialVeil('pov-warm', warm, true) +
    radialVeil('pov-vignette', vignette, false)
  );
}
