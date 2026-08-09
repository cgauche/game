/**
 * SPIKE WebGL — mathématique PURE des BILLBOARDS (personnages + props en quads texturés).
 * Node-safe : aucune dépendance DOM/three ici, tout le décisionnel (taille monde, sélection de vue,
 * ancrage, palier de rasterisation) vit dans ce module ; `svgTexture.ts` n'est qu'une couture navigateur.
 *
 * Le SVG reste la source de vérité de l'art (`propSvg` / `bonesToSvg`) : ce module ne dessine rien.
 */
import { BB_W, BB_H, ENT_H_M, PROP_H_M } from '../../pov/billboardCore';
import { project, facingView, type View, type Dir8 } from '../../rig/facing';
import { povView } from '../../pov/camera';
import { DIR8_DELTA } from '../../../state/dir8';
import { type Rot } from '../../../geometry/iso';
import { ISO_PX_PER_M } from './worldTris';

// ————————————————————————————————————————————————————————————————
// 1. TAILLE MONDE — les DEUX conventions de la prod, rendues côte à côte pour arbitrage (#1160)
// ————————————————————————————————————————————————————————————————

export type BillboardConvention = 'heroique' | 'metrique';
export type BillboardKind = 'personnage' | 'prop';

/** Échelle de token iso par famille, MESURÉE aux sites de rendu (non exportées là-bas, littéraux en
 *  place) : `stage/tokens.tsx:172` rig = 0.58 ; `stage/tokens.tsx:85` prop (et `:165` sprite) = 0.55.
 *  (`speciesScale`/`sizeTokenScale`/`foot.scale` sont des facteurs PAR ENTITÉ, hors de cette base.) */
const ISO_TOKEN_SCALE: Record<BillboardKind, number> = { personnage: 0.58, prop: 0.55 };

/** Pixels iso par mètre monde — SOURCE UNIQUE dans `worldTris.ts`, ré-exportée pour les consommateurs
 *  de billboards. */
export { ISO_PX_PER_M };

/**
 * Hauteur MONDE (m) d'un billboard selon la convention rendue.
 * - `heroique` : dérivée des sites iso — boîte locale `BB_H` px × échelle de token ÷ `ISO_PX_PER_M`.
 * - `metrique` : constantes du POV (`ENT_H_M` / `PROP_H_M`).
 */
export function billboardHeightM(convention: BillboardConvention, kind: BillboardKind): number {
  if (convention === 'metrique') return kind === 'personnage' ? ENT_H_M : PROP_H_M;
  return (BB_H * ISO_TOKEN_SCALE[kind]) / ISO_PX_PER_M;
}

// ————————————————————————————————————————————————————————————————
// 2. SÉLECTION DE VUE — délégation aux DEUX résolveurs de prod, aucun seuil recopié (#1161)
// ————————————————————————————————————————————————————————————————

/** Caméra du spike : `ortho` = familles top/iso/edge (lacet RÉEL en degrés, les crans de production en
 *  sont les multiples de 90°), `perspective` = famille POV. */
export type BillboardCamera =
  | { kind: 'ortho'; yawDeg: number }
  | { kind: 'perspective'; fwd: { x: number; y: number }; right: { x: number; y: number } };

/**
 * Vue + miroir d'un billboard : reproduit ce que fait CHAQUE famille de caméra aujourd'hui —
 * ortho → `project` (`rig/facing.ts`), perspective → `povView` (`pov/camera.ts`).
 */
export function billboardView(cam: BillboardCamera, entFacing: Dir8): { view: View; mirror: boolean } {
  return cam.kind === 'ortho'
    ? orthoView(cam.yawDeg, entFacing)
    : povView(cam.fwd, cam.right, entFacing);
}

/** Vue ortho à un lacet RÉEL. Multiple de 90° : délégation ENTIÈRE à `project` (le résolveur de cran de
 *  la prod). Entre deux crans : le delta d'orientation est tourné du même lacet, puis remis au MÊME juge
 *  d'écran `facingView` — aucun seuil recopié, aucune table de vue propre au spike. */
function orthoView(yawDeg: number, entFacing: Dir8): { view: View; mirror: boolean } {
  const quarts = yawDeg / 90;
  if (Number.isInteger(quarts)) return project(entFacing, ((((quarts % 4) + 4) % 4) as Rot));
  const a = (yawDeg * Math.PI) / 180;
  const d = DIR8_DELTA[entFacing];
  const gx = d.gx * Math.cos(a) + d.gy * Math.sin(a);
  const gy = -d.gx * Math.sin(a) + d.gy * Math.cos(a);
  return facingView(gx - gy, gx + gy);
}

// ————————————————————————————————————————————————————————————————
// 3. ANCRAGE — quad face caméra, pieds au sol
// ————————————————————————————————————————————————————————————————

/** Aspect (l/h) de la boîte locale d'un prop : `catalog/decor` dessine en 120×150, pieds en (60,150). */
export const PROP_BOX_ASPECT = BB_W / BB_H;

/** Quad d'un billboard, exprimé dans le plan face-caméra (u = droite écran, v = haut monde),
 *  en MÈTRES relatifs à l'ancre PIEDS (0,0). */
export interface BillboardQuad {
  widthM: number;
  heightM: number;
  /** Centre du quad au-dessus de l'ancre pieds (m) — position du plan `PlaneGeometry`. */
  centerLiftM: number;
  /** Coins BL, BR, TR, TL (u,v) en mètres depuis l'ancre pieds. */
  corners: [[number, number], [number, number], [number, number], [number, number]];
}

/** Géométrie d'un quad de hauteur `heightM` et d'aspect `aspectRatio` (l/h de la boîte SVG source),
 *  centré horizontalement sur l'ancre, base posée dessus. */
export function anchorAndSize(heightM: number, aspectRatio: number): BillboardQuad {
  if (!(heightM > 0) || !(aspectRatio > 0)) {
    throw new Error(`anchorAndSize: hauteur/aspect invalides (${heightM}, ${aspectRatio})`);
  }
  const widthM = heightM * aspectRatio;
  const hw = widthM / 2;
  return {
    widthM,
    heightM,
    centerLiftM: heightM / 2,
    corners: [
      [-hw, 0],
      [hw, 0],
      [hw, heightM],
      [-hw, heightM],
    ],
  };
}

// ————————————————————————————————————————————————————————————————
// 4. PALIER DE RASTERISATION
// ————————————————————————————————————————————————————————————————

/** Zoom maximal du jeu — borne haute de `setZoom` (`src/state/store.ts:1674`, littéral non exporté). */
export const ZOOM_MAX = 2.6;
/** Garde-fous de texture : sous 16 px un billboard n'est plus lisible, au-delà de 2048 px on sort des
 *  tailles de texture sûres pour un spike. */
export const RASTER_PX_MIN = 16;
export const RASTER_PX_MAX = 2048;

/** Les pixels écran par mètre monde en iso à zoom 1 sont ceux de `pxPerM` (`worldTris.ts`) : SOURCE
 *  UNIQUE, à passer à `rasterPxHeight` — ce module n'en refait pas une seconde. */

/** Hauteur de rasterisation (px) d'un billboard : sa taille écran au palier de zoom MAX, bornée. */
export function rasterPxHeight(heightM: number, pxPerMetre: number, maxZoom: number = ZOOM_MAX): number {
  const px = Math.ceil(heightM * pxPerMetre * maxZoom);
  return Math.min(RASTER_PX_MAX, Math.max(RASTER_PX_MIN, px));
}

/** Clé de cache d'une texture de billboard : une entrée par (identité, vue, miroir, palier). */
export function billboardTextureKey(
  identity: string,
  view: View,
  mirror: boolean,
  pxHeight: number,
): string {
  return `${identity}|${view}|${mirror ? 'm' : 'd'}|${pxHeight}`;
}
