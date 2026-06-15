import { Scene, tileAt } from '../state/scene';
import { terrainPriority } from '../state/terrain';
import { terrainGradient } from './catalog/terrain';
import { Dims, diamondCorners } from './iso';

export type EdgeDir = 'N' | 'E' | 'S' | 'O';
const NEIGHBOURS: Record<EdgeDir, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  O: [-1, 0],
};

export interface EdgeBlend {
  dir: EdgeDir;
  terrain: string;
}

/** Voisins de plus haute précédence qui « débordent » sur la tuile (x,y) du niveau `z`. */
export function edgeBlends(scene: Scene, x: number, y: number, z = 0): EdgeBlend[] {
  const self = terrainPriority(tileAt(scene, x, y, z));
  const out: EdgeBlend[] = [];
  for (const dir of ['N', 'E', 'S', 'O'] as EdgeDir[]) {
    const [dx, dy] = NEIGHBOURS[dir];
    const nt = tileAt(scene, x + dx, y + dy, z);
    if (terrainPriority(nt) > self) out.push({ dir, terrain: nt });
  }
  return out;
}

/** SVG d'une tuile de sol du niveau `z` (défaut sol) : losange de base + wedges de transition,
 *  soulevés de z·LEVEL_H si étage. */
export function groundTile(scene: Scene, x: number, y: number, dims: Dims, z = 0): string {
  if (tileAt(scene, x, y, z) === 'vide') return ''; // tuile non construite d'un étage → transparente
  const { cx, cy, top, right, bot, left } = diamondCorners(x, y, dims, z);
  const base = `<path d="M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z" fill="url(#${terrainGradient(
    tileAt(scene, x, y, z),
  )})" stroke="rgba(0,0,0,0.16)"/>`;
  const blends = edgeBlends(scene, x, y, z);
  if (!blends.length) return base; // tuile sans voisin de plus haute précédence : pas de wedge
  // arête partagée par direction (paire de sommets), repliée vers le centre à 40 %
  const EDGE: Record<EdgeDir, [number, number][]> = {
    N: [top, right],
    E: [right, bot],
    S: [bot, left],
    O: [left, top],
  };
  const wedges = blends
    .map(({ dir, terrain }) => {
      const [a, b] = EDGE[dir];
      const ia = [a[0] + (cx - a[0]) * 0.4, a[1] + (cy - a[1]) * 0.4];
      const ib = [b[0] + (cx - b[0]) * 0.4, b[1] + (cy - b[1]) * 0.4];
      const d = `M${a[0]},${a[1]} L${b[0]},${b[1]} L${ib[0]},${ib[1]} L${ia[0]},${ia[1]} Z`;
      return `<path d="${d}" fill="url(#${terrainGradient(terrain)})" opacity="0.7"/>`;
    })
    .join('');
  return base + wedges;
}
