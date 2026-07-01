/** Nappe de TOIT auto-construite (`roofFromCells`) : seule primitive de rendu partagée des bâtiments. */
import { tileCenter, WALL_H, depth, type Dims } from '../../iso';
import { roofMaterial } from '../roofs';

/** TOIT AUTO-CONSTRUIT à partir de l'ENSEMBLE DE CELLULES du bâtiment (forme QUELCONQUE : rectangle, U, L…).
 *  Chaque SOMMET de grille reçoit une hauteur = `WALL_H` + (distance-à-l'avant-toit)·pente → bas aux bords,
 *  haut au faîte (une LIGNE de faîte pour un rectangle, qui suit la forme sinon). Rendu cellule par cellule
 *  (quads iso triés arrière→avant, peintre), ombré selon l'orientation de la pente. Repose sur les murs
 *  `WallSeg` (base `WALL_H`) → aucun toit plat/flottant, aucune hypothèse de rectangle. */
export function roofFromCells(cells: Set<string>, dims: Dims, material: string): string {
  const SLOPE = 17; // px de montée par cran de profondeur
  const sh = roofMaterial(material);
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  // sommets de grille touchés par au moins une cellule
  const verts = new Set<string>();
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    verts.add(`${x},${y}`); verts.add(`${x + 1},${y}`); verts.add(`${x},${y + 1}`); verts.add(`${x + 1},${y + 1}`);
  }
  // profondeur BFS : sommet INTÉRIEUR = ses 4 cellules sont du toit ; sinon avant-toit (0)
  const inner = (vx: number, vy: number) => has(vx - 1, vy - 1) && has(vx, vy - 1) && has(vx - 1, vy) && has(vx, vy);
  const dep = new Map<string, number>();
  const q: [number, number][] = [];
  for (const k of verts) { const [vx, vy] = k.split(',').map(Number); if (!inner(vx, vy)) { dep.set(k, 0); q.push([vx, vy]); } }
  for (let i = 0; i < q.length; i++) {
    const [vx, vy] = q[i]; const d = dep.get(`${vx},${vy}`)!;
    for (const [nx, ny] of [[vx + 1, vy], [vx - 1, vy], [vx, vy + 1], [vx, vy - 1]] as [number, number][]) {
      const nk = `${nx},${ny}`;
      if (verts.has(nk) && !dep.has(nk)) { dep.set(nk, d + 1); q.push([nx, ny]); }
    }
  }
  const hgt = (vx: number, vy: number) => WALL_H + (dep.get(`${vx},${vy}`) ?? 0) * SLOPE;
  const scr = (vx: number, vy: number): [number, number] => { const { cx, cy } = tileCenter(vx - 0.5, vy - 0.5, dims); return [cx, cy - hgt(vx, vy)]; };
  // cellules triées arrière→avant (peintre iso : la pente avant recouvre l'arrière)
  const arr = [...cells].map((k) => k.split(',').map(Number) as [number, number]).sort((a, b) => depth(a[0], a[1], dims) - depth(b[0], b[1], dims));
  let s = '';
  for (const [x, y] of arr) {
    const TL = scr(x, y), TR = scr(x + 1, y), BR = scr(x + 1, y + 1), BL = scr(x, y + 1);
    const hTL = hgt(x, y), hTR = hgt(x + 1, y), hBR = hgt(x + 1, y + 1), hBL = hgt(x, y + 1);
    const dhx = hTR + hBR - hTL - hBL; // montée vers +x (grille)
    const dhy = hBL + hBR - hTL - hTR; // montée vers +y (grille)
    // teinte = pente DESCENDANTE (vers l'avant-toit) : dhx>0 descend vers -x (O), etc.
    const col = Math.abs(dhx) >= Math.abs(dhy) ? (dhx > 0 ? sh.O! : dhx < 0 ? sh.E! : sh.N!) : dhy > 0 ? sh.N! : dhy < 0 ? sh.S! : sh.N!;
    // GRILLE de tuiles VISIBLE (liseré sombre par cellule) : c'est elle qui donne la PROFONDEUR / le relief
    // du toit (rangs de tuiles) — préférée au rendu lisse qui aplatit la lecture.
    s += `<path d="M${TL[0]},${TL[1]} L${TR[0]},${TR[1]} L${BR[0]},${BR[1]} L${BL[0]},${BL[1]} Z" fill="${col}" stroke="${sh.line!}" stroke-width="0.6" stroke-linejoin="round"/>`;
  }
  return s;
}
