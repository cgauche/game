import { rotTile, type Dims } from '../iso';

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
