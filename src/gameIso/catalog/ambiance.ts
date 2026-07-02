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
    vignette: RadialVeilDef;
  };
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

/** Defs SVG du POV : ciel d'extérieur (`pov-sky`, bleu → brume d'horizon) + vignette (`pov-vignette`). */
export function povAmbianceDefs(): string {
  const { skyTop, fogOutdoor, vignette } = AMBIANCE.pov;
  return (
    `<linearGradient id="pov-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${skyTop}"/><stop offset="100%" stop-color="${fogOutdoor}"/></linearGradient>` +
    radialVeil('pov-vignette', vignette, false)
  );
}
