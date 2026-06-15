import { tileCenter, depth, type Dims } from './iso';
import type { Scene, WallSeg } from '../state/scene';

/** Hauteur écran (px) d'une cloison dressée sur une arête. */
export const WALL_H = 54;

type P = { cx: number; cy: number };

/** Les 2 extrémités-écran (au sol) de l'arête d'un mur. Un COIN de grille (gx,gy) se projette comme le
 *  centre d'une tuile décalée d'un demi : `tileCenter(gx-0.5, gy-0.5)` (rotation/vue/étage z gérés par
 *  tileCenter). E = arête entre (x,y) et (x+1,y) → coins (x+1,y) et (x+1,y+1) ; N = entre (x,y) et
 *  (x,y-1) → coins (x,y) et (x+1,y). */
function edgeEnds(w: WallSeg, dims: Dims): [P, P] {
  const z = w.z ?? 0;
  const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, z);
  return w.side === 'E' ? [gc(w.x + 1, w.y), gc(w.x + 1, w.y + 1)] : [gc(w.x, w.y), gc(w.x + 1, w.y)];
}

/** Poteau vertical (montant) à une extrémité d'arête : posé aux deux bouts de chaque mur → les poteaux
 *  des murs adjacents COÏNCIDENT (coins pleins + jambages de porte gratuits). Légère moulure en haut. */
function post(p: P, h: number): string {
  return `<rect x="${p.cx - 1.9}" y="${p.cy - h}" width="3.8" height="${h}" fill="#352b1f"/>` +
    `<rect x="${p.cx - 1.9}" y="${p.cy - h}" width="3.8" height="2.4" fill="#5b4a35"/>` + // chapiteau
    `<rect x="${p.cx - 1.9}" y="${p.cy - 3}" width="3.8" height="3" fill="#241c12"/>`; // socle
}

/** Quad « tranche » de la face entre deux hauteurs (h0 bas, h1 haut), suivant l'arête a→b. */
const slab = (a: P, b: P, h0: number, h1: number) => `${a.cx},${a.cy - h0} ${b.cx},${b.cy - h0} ${b.cx},${b.cy - h1} ${a.cx},${a.cy - h1}`;

/** SVG d'un segment de mur TEXTURÉ (panneau encadré + moulures + plinthe + ombrage par côté) + sa
 *  profondeur, pour le tri global de IsoStage. Une PORTE est ajourée (ouverture basse + linteau). */
export function wallSeg(w: WallSeg, dims: Dims): { d: number; svg: string } {
  const [a, b] = edgeEnds(w, dims);
  const H = WALL_H;
  // Palette par orientation (lumière en haut-gauche) : faces N (vers le bas-droit) plus sombres que E.
  const N = w.side === 'N';
  const face = N ? '#5d4c36' : '#6e5940';
  const inset = N ? '#4b3d2b' : '#594732'; // fond de panneau (renfoncement)
  const frame = N ? '#6b573e' : '#7c6647'; // liseré clair du cadre
  const cap = N ? '#806b4b' : '#917a58'; // corniche / dessus
  const skirt = N ? '#3c3022' : '#473829'; // plinthe

  if (w.door) {
    const op = H * 0.52; // hauteur de l'ouverture
    const jamb = (p: P) => `<rect x="${p.cx - 1.5}" y="${p.cy - op}" width="3" height="${op}" fill="#4a3b2a"/>`;
    const svg = `<g>${post(a, H)}` +
      `<polygon points="${slab(a, b, op, H)}" fill="${face}" stroke="#2a2118" stroke-width="0.7"/>` + // linteau
      `<polygon points="${slab(a, b, H * 0.86, H)}" fill="${cap}"/>` +
      jamb(a) + jamb(b) +
      `${post(b, H)}</g>`;
    const dz = w.z ?? 0;
    return { d: (N ? depth(w.x, w.y, dims, dz) : depth(w.x + 1, w.y, dims, dz)) + 0.45, svg };
  }

  // Panneau encadré : un rectangle inset (renfoncé) au centre de la face.
  const lerp = (A: P, B: P, t: number): P => ({ cx: A.cx + (B.cx - A.cx) * t, cy: A.cy + (B.cy - A.cy) * t });
  const m = 0.2; // marge horizontale du panneau
  const pl = lerp(a, b, m), pr = lerp(a, b, 1 - m);
  const yLo = 0.2, yHi = 0.78; // bornes verticales du panneau
  const panel = `${pl.cx},${pl.cy - H * yLo} ${pr.cx},${pr.cy - H * yLo} ${pr.cx},${pr.cy - H * yHi} ${pl.cx},${pl.cy - H * yHi}`;
  const frameLine = `M${pl.cx},${pl.cy - H * yHi} L${pr.cx},${pr.cy - H * yHi}`; // arête haute du cadre (lumière)

  const svg = `<g>${post(a, H)}` +
    `<polygon points="${slab(a, b, 0, H)}" fill="${face}" stroke="#2c2419" stroke-width="0.7"/>` + // face
    `<polygon points="${panel}" fill="${inset}"/>` + // panneau renfoncé
    `<path d="${frameLine}" stroke="${frame}" stroke-width="1.3" fill="none"/>` + // moulure haute du cadre
    `<polygon points="${slab(a, b, 0, H * 0.11)}" fill="${skirt}"/>` + // plinthe
    `<polygon points="${slab(a, b, H * 0.86, H)}" fill="${cap}"/>` + // corniche
    `<polygon points="${slab(a, b, H, H + 4)}" fill="${cap}"/>` + // épaisseur dessus
    `${post(b, H)}</g>`;
  const dz = w.z ?? 0;
  const d = (N ? depth(w.x, w.y, dims, dz) : depth(w.x + 1, w.y, dims, dz)) + 0.45;
  return { d, svg };
}

/** Tous les segments de mur de la scène, prêts à fusionner dans le tri de profondeur. */
export function wallSegs(scene: Scene, dims: Dims): { d: number; svg: string }[] {
  return (scene.walls ?? []).map((w) => wallSeg(w, dims));
}
