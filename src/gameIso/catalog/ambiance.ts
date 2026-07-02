/** AMBIANCE partagée iso ⇄ POV — donnée pure (`src/data/ambiance.json`) : ciel d'extérieur, brumes
 *  (intérieure sombre / extérieure claire), vignette, voile chaud, filtre d'étage inférieur, voile de
 *  nuit. Les stages (IsoStage/PovStage) et la QC headless consomment les MÊMES defs SVG assemblées ici —
 *  plus aucune de ces couleurs en dur dans un renderer. */
import { ambiance } from '../../data';

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
  };
  pov: {
    /** Haut du ciel d'extérieur — l'horizon se fond dans `fogOutdoor`. */
    skyTop: string;
    /** Brume de distance en INTÉRIEUR (sombre) — aussi le fond des scènes couvertes. */
    fogIndoor: string;
    /** Brume de distance en EXTÉRIEUR (claire) — aussi l'horizon du ciel. */
    fogOutdoor: string;
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

/** Defs SVG de l'ambiance ISO (voile chaud `g_warm`, vignette `g_vig`, filtre `lower-floor-dim`). */
export function isoAmbianceDefs(): string {
  const { warm, vignette, lowerFloorDim: dim } = AMBIANCE.iso;
  return (
    radialVeil('g_warm', warm, true) +
    radialVeil('g_vig', vignette, false) +
    `<filter id="lower-floor-dim" x="-5%" y="-5%" width="110%" height="110%"><feColorMatrix type="saturate" values="${dim.saturate}"/>` +
    `<feComponentTransfer><feFuncR type="linear" slope="${dim.slope}"/><feFuncG type="linear" slope="${dim.slope}"/><feFuncB type="linear" slope="${dim.slope}"/></feComponentTransfer></filter>`
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
