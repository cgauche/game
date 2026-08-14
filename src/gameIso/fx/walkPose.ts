/**
 * POSE d'une marche en cours — la courbe de glissement, PURE (#1176, P2-4). Le monde volumique la lit
 * depuis SA boucle de rendu, sans re-rendre React ; les overlays SVG posés par-dessus (chrome de jeton,
 * caméra de stage) la lisent au rendu React par `WalkPos`. Une seule fonction, donc une seule courbe et
 * une seule durée : le canevas et ses surcouches ne peuvent pas diverger.
 */
import { depth, type Dims } from '../../geometry/iso';
import { walkXY, STEP_MS, type Pt } from '../../geometry/walk';

/** Une marche vivante : le chemin de tuiles et l'instant de son départ (`performance.now()`). */
export interface WalkTrack {
  path: Pt[];
  start: number;
}

/** Position VISUELLE d'un sujet et son point de TRI. */
export interface WalkPose {
  x: number;
  y: number;
  walking: boolean;
  sortPt: Pt;
}

/** Lecture de la pose d'un sujet par son id, à l'instant du rendu : la forme que les surcouches SVG
 *  du stage consomment (chrome de jeton, caméra) pour suivre un corps qui glisse. */
export type WalkPos = (id: string, x: number, y: number, z?: number) => WalkPose;

/**
 * Pose à l'instant `now`. Sans marche vivante, le sujet est à sa case et ne glisse pas. Sinon la
 * position est FRACTIONNAIRE le long du chemin, et le point de tri est celle des deux cases du segment
 * courant qui est la PLUS PROFONDE — le tri reste ainsi constant sur toute la durée d'un pas.
 */
export function walkPoseAt(track: WalkTrack | undefined, x: number, y: number, z: number, dims: Dims, now: number): WalkPose {
  if (!track) return { x, y, walking: false, sortPt: { x, y } };
  const elapsed = now - track.start;
  const p = walkXY(track.path, elapsed, STEP_MS);
  const seg = track.path.length < 2 ? 0 : Math.min(track.path.length - 2, Math.max(0, Math.floor(elapsed / STEP_MS)));
  const a = track.path[seg];
  const b = track.path[seg + 1] ?? a;
  const sortPt = depth(b.x, b.y, dims, z) >= depth(a.x, a.y, dims, z) ? { x: b.x, y: b.y } : { x: a.x, y: a.y };
  return { x: p.x, y: p.y, walking: true, sortPt };
}

/**
 * Décalage MONDE (mètres, repère three) entre la pose de l'instant et la case LOGIQUE du sujet : ce que
 * la boucle volumique ajoute à l'ancre CUITE d'un billboard, sans reconstruire quoi que ce soit. `null`
 * si le sujet ne marche pas. `groundM` donne la hauteur de sol d'une case — le jeton monte avec son sol,
 * exactement comme `liftAt` le fait en affine, et par la même discrétisation (case arrondie).
 */
export function walkGlideM(
  track: WalkTrack | undefined,
  base: { x: number; y: number; z: number },
  dims: Dims,
  mpt: number,
  now: number,
  groundM: (x: number, y: number, z: number) => number,
): { dx: number; dy: number; dz: number } | null {
  const p = walkPoseAt(track, base.x, base.y, base.z, dims, now);
  if (!p.walking) return null;
  return {
    dx: (p.x - base.x) * mpt,
    dy: groundM(p.x, p.y, base.z) - groundM(base.x, base.y, base.z),
    dz: (p.y - base.y) * mpt,
  };
}
