export type View = 'front' | 'back' | 'profile';

/** Direction ÉCRAN (dx,dy px iso) → vue + miroir. PUR.
 *  Latéral net → profile ; vers le bas → front ; vers le haut → back ; mirror = regarde à gauche. */
export function facingView(dx: number, dy: number): { view: View; mirror: boolean } {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const view: View = ax > ay * 1.5 ? 'profile' : dy >= 0 ? 'front' : 'back';
  return { view, mirror: dx < 0 };
}

/** Vecteur direction ÉCRAN entre deux tuiles (iso : screenX ∝ x−y, screenY ∝ x+y). */
export function screenDir(from: { x: number; y: number }, to: { x: number; y: number }) {
  return { dx: to.x - to.y - (from.x - from.y), dy: to.x + to.y - (from.x + from.y) };
}
