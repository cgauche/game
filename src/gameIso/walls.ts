import { tileCenter, depth, type Dims } from './iso';
import type { Scene, WallSeg } from '../state/scene';

/** Hauteur écran (px) d'une cloison dressée sur une arête. */
export const WALL_H = 52;

/** Les 2 extrémités-écran (au sol) de l'arête d'un mur. Un COIN de grille (gx,gy) se projette comme le
 *  centre d'une tuile décalée d'un demi : `tileCenter(gx-0.5, gy-0.5)` (rotation/vue/étage z gérés par
 *  tileCenter). E = arête entre (x,y) et (x+1,y) → coins (x+1,y) et (x+1,y+1) ; N = entre (x,y) et
 *  (x,y-1) → coins (x,y) et (x+1,y). */
function edgeEnds(w: WallSeg, dims: Dims): [{ cx: number; cy: number }, { cx: number; cy: number }] {
  const z = w.z ?? 0;
  const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, z);
  return w.side === 'E' ? [gc(w.x + 1, w.y), gc(w.x + 1, w.y + 1)] : [gc(w.x, w.y), gc(w.x + 1, w.y)];
}

/** SVG (quad vertical extrudé) + profondeur d'un segment de mur, pour le tri global de IsoStage. Une
 *  porte est dessinée plus basse et ajourée (linteau seul) → on voit qu'on peut passer. */
export function wallSeg(w: WallSeg, dims: Dims): { d: number; svg: string } {
  const [a, b] = edgeEnds(w, dims);
  const h = w.door ? WALL_H * 0.42 : WALL_H; // une porte : ouverture basse
  const face = `${a.cx},${a.cy} ${b.cx},${b.cy} ${b.cx},${b.cy - h} ${a.cx},${a.cy - h}`;
  const capH = h + 4;
  const cap = `${a.cx},${a.cy - h} ${b.cx},${b.cy - h} ${b.cx},${b.cy - capH} ${a.cx},${a.cy - capH}`;
  let svg: string;
  if (w.door) {
    // jambages + linteau (cadre de porte) : montants courts aux extrémités + traverse haute pleine hauteur
    const lintelTop = WALL_H, lintelBot = WALL_H * 0.74;
    const lintel = `${a.cx},${a.cy - lintelBot} ${b.cx},${b.cy - lintelBot} ${b.cx},${b.cy - lintelTop} ${a.cx},${a.cy - lintelTop}`;
    svg = `<g><polygon points="${face}" fill="#4a3b2a" stroke="#2a2118" stroke-width="1"/>` +
      `<polygon points="${cap}" fill="#6f5c40"/>` +
      `<polygon points="${lintel}" fill="#5a4a34" stroke="#2a2118" stroke-width="1"/></g>`;
  } else {
    svg = `<g><polygon points="${face}" fill="#6b5840" stroke="#3a2f22" stroke-width="1"/>` +
      `<polygon points="${cap}" fill="#8a7654"/></g>`;
  }
  // Profondeur : à l'arête, du côté de la tuile la plus PROCHE de la caméra (occlusion correcte) — la
  // tuile en aval de l'arête (E → (x+1,y) ; N → (x,y)). +0.45 : juste après le sol de cette tuile.
  const dz = w.z ?? 0;
  const d = (w.side === 'E' ? depth(w.x + 1, w.y, dims, dz) : depth(w.x, w.y, dims, dz)) + 0.45;
  return { d, svg };
}

/** Tous les segments de mur de la scène, prêts à fusionner dans le tri de profondeur. */
export function wallSegs(scene: Scene, dims: Dims): { d: number; svg: string }[] {
  return (scene.walls ?? []).map((w) => wallSeg(w, dims));
}
