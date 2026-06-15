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

/** Poteau vertical (montant) à une extrémité d'arête : posé aux deux bouts de chaque mur, les poteaux
 *  des murs adjacents COÏNCIDENT → coins pleins et jambages de porte gratuits. */
function post(p: { cx: number; cy: number }, h: number): string {
  return `<rect x="${p.cx - 1.6}" y="${p.cy - h}" width="3.2" height="${h}" rx="0.6" fill="#43372650"/>` +
    `<rect x="${p.cx - 1.6}" y="${p.cy - h}" width="3.2" height="${h}" fill="#3a2f22"/>`;
}

/** SVG (quad vertical extrudé + ombrage par côté + poteaux d'angle) + profondeur d'un segment de mur,
 *  pour le tri global de IsoStage. Une PORTE est ajourée (ouverture basse) avec jambages et linteau. */
export function wallSeg(w: WallSeg, dims: Dims): { d: number; svg: string } {
  const [a, b] = edgeEnds(w, dims);
  // Ombrage par orientation (lumière en haut-gauche) : les faces N (tournées vers le bas-droit) sont
  // un peu plus sombres que les faces E (bas-gauche) — donne du relief sans dégradé.
  const faceFill = w.side === 'N' ? '#5e4d37' : '#6f5a40';
  const capFill = w.side === 'N' ? '#7c6748' : '#8c7656';
  const quad = (h0: number, h1: number) => `${a.cx},${a.cy - h0} ${b.cx},${b.cy - h0} ${b.cx},${b.cy - h1} ${a.cx},${a.cy - h1}`;
  let body: string;
  if (w.door) {
    // Porte : ouverture basse (on voit derrière) + linteau plein en haut, encadrée par les poteaux.
    const op = WALL_H * 0.5; // bas de l'ouverture (hauteur des montants courts)
    const jamb = (p: { cx: number; cy: number }) => `<rect x="${p.cx - 1.4}" y="${p.cy - op}" width="2.8" height="${op}" fill="#4a3b2a"/>`;
    body = `<polygon points="${quad(op, WALL_H)}" fill="#5a4a34" stroke="#2a2118" stroke-width="0.8"/>` + // linteau
      jamb(a) + jamb(b) +
      `<polygon points="${quad(WALL_H, WALL_H + 4)}" fill="${capFill}"/>`;
  } else {
    body = `<polygon points="${quad(0, WALL_H)}" fill="${faceFill}" stroke="#322a1f" stroke-width="0.8"/>` +
      `<polygon points="${quad(WALL_H, WALL_H + 4)}" fill="${capFill}"/>` + // liseré/épaisseur en haut
      `<polygon points="${quad(0, WALL_H * 0.18)}" fill="#00000022"/>`; // ombre basse (assise)
  }
  const svg = `<g>${post(a, WALL_H)}${body}${post(b, WALL_H)}</g>`;
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
