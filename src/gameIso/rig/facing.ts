import { rotTile, type Dims, type Rot } from '../iso';
import type { Dir8 } from '../../state/dir8';
export type { Dir8 };

export type View = 'front' | 'back' | 'profile';

/** Direction ÉCRAN (dx,dy px iso) → vue + miroir. PUR.
 *  Latéral net → profile ; vers le bas → front ; vers le haut → back ; mirror = regarde à gauche. */
export function facingView(dx: number, dy: number): { view: View; mirror: boolean } {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const view: View = ax > ay * 1.5 ? 'profile' : dy >= 0 ? 'front' : 'back';
  return { view, mirror: dx < 0 };
}

/** Vecteur direction ÉCRAN entre deux tuiles, dans l'orientation caméra `dims` (rot). PUR.
 *  (iso : screenX ∝ x−y, screenY ∝ x+y, sur les coords tournées.) */
export function screenDir(
  from: { x: number; y: number },
  to: { x: number; y: number },
  dims?: Dims,
) {
  const a = dims ? rotTile(from.x, from.y, dims) : from;
  const b = dims ? rotTile(to.x, to.y, dims) : to;
  return { dx: b.x - b.y - (a.x - a.y), dy: b.x + b.y - (a.x + a.y) };
}

/** Dir8 (MONDE) → delta grille unitaire. */
export const DIR8_DELTA: Record<Dir8, { gx: number; gy: number }> = {
  N: { gx: 0, gy: -1 }, NE: { gx: 1, gy: -1 }, E: { gx: 1, gy: 0 }, SE: { gx: 1, gy: 1 },
  S: { gx: 0, gy: 1 }, SO: { gx: -1, gy: 1 }, O: { gx: -1, gy: 0 }, NO: { gx: -1, gy: -1 },
};

/** Rotation d'un delta grille par le cran caméra. PUR.
 *  (= partie linéaire de rotTile : les offsets W-1/H-1 s'annulent dans une différence.) */
function rotDelta(gx: number, gy: number, rot: Rot): { gx: number; gy: number } {
  switch (rot) {
    case 1: return { gx: gy, gy: -gx };
    case 2: return { gx: -gx, gy: -gy };
    case 3: return { gx: -gy, gy: gx };
    default: return { gx, gy };
  }
}

/** Orientation MONDE (Dir8) + cran caméra → vue + miroir. PUR.
 *  Recalculée à chaque rendu ⇒ tourner la caméra ré-oriente les sprites (sans event). */
export function project(dir: Dir8, camRot: Rot): { view: View; mirror: boolean } {
  const d = DIR8_DELTA[dir];
  const r = rotDelta(d.gx, d.gy, camRot);
  return facingView(r.gx - r.gy, r.gx + r.gy);
}

const DELTA_DIR8: Record<string, Dir8> = {
  '0,-1': 'N', '1,-1': 'NE', '1,0': 'E', '1,1': 'SE',
  '0,1': 'S', '-1,1': 'SO', '-1,0': 'O', '-1,-1': 'NO',
};

/** Delta grille (to−from) → Dir8 la plus proche (par signe). Défaut 'S' si nul. PUR. */
export function facingToward(from: { x: number; y: number }, to: { x: number; y: number }): Dir8 {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (dx === 0 && dy === 0) return 'S';
  return DELTA_DIR8[`${dx},${dy}`];
}
