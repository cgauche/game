/** AMBIANCE partagée iso ⇄ POV — donnée pure (`src/data/ambiance.json`) : ciel d'extérieur, brumes
 *  (intérieure sombre / extérieure claire), vignette, voile chaud, filtre d'étage inférieur, voile de
 *  nuit. Les stages (IsoStage/PovStage) et la QC headless consomment les MÊMES defs SVG assemblées ici —
 *  plus aucune de ces couleurs en dur dans un renderer. */
import { ambiance } from '../../data';
import type { Dims } from '../iso';

/** Halo radial (voile chaud / vignette) : centre + rayon en %, couleur et alpha au bord utile. */
export interface RadialVeilDef { cx: string; cy: string; r: string; color: string; alpha: number; innerOff?: string }

export interface AmbianceDef {
  iso: {
    /** Voile CHAUD (lumière dorée descendante) posé sur toute la scène. */
    warm: RadialVeilDef;
    /** Vignette d'assombrissement des bords. */
    vignette: RadialVeilDef;
    /** Filtre de l'ÉTAGE INFÉRIEUR (multi-niveaux) : désaturation + assombrissement, SANS opacité. */
    lowerFloorDim: { saturate: number; slope: number };
    /** Voile de NUIT (rect plein écran, alpha piloté par la lumière ambiante). */
    nightVeil: string;
    /** Ombrage de PROFONDEUR de la vue « de face » (edge-on) : les rangées écran LOINTAINES (haut de
     *  l'écran) s'assombrissent progressivement (perspective atmosphérique). Décoration de VUE, subtile
     *  (alpha ≈ 8-12 % max). `topFrac`/`bottomFrac` = bornes verticales écran du dégradé (0 = haut). */
    edgeDepth: { color: string; alpha: number; topFrac: number; bottomFrac: number };
  };
  pov: {
    /** Haut du ciel d'extérieur — l'horizon se fond dans `fogOutdoor`. */
    skyTop: string;
    /** Brume de distance en INTÉRIEUR (sombre) — aussi le fond des scènes couvertes. */
    fogIndoor: string;
    /** Brume de distance en EXTÉRIEUR (claire) — aussi l'horizon du ciel. */
    fogOutdoor: string;
    /** Facteur de LUMIÈRE D'AMBIANCE d'une surface STATIQUE non encore VUE (brouillard de guerre) :
     *  multiplie la lumière ambiante de la scène (jour clair / nuit sombre) pour garder la matière
     *  lisible mais LÉGÈREMENT en retrait d'une case explorée — jamais du noir ni un aplat de brume. */
    ambientUnseen: number;
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
  const { skyTop, fogOutdoor, vignette } = AMBIANCE.pov;
  return (
    `<linearGradient id="pov-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${skyTop}"/><stop offset="50%" stop-color="${fogOutdoor}"/><stop offset="100%" stop-color="${fogOutdoor}"/></linearGradient>` +
    radialVeil('pov-vignette', vignette, false)
  );
}
