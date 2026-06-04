import { Scene, tileAt } from '../state/scene';
import { terrainPriority } from '../state/terrain';
import { terrainGradient } from './catalog/terrain';
import { Dims, tileCenter, diamondPath, TW, TH } from './iso';

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

/** Voisins de plus haute précédence qui « débordent » sur la tuile (x,y). */
export function edgeBlends(scene: Scene, x: number, y: number): EdgeBlend[] {
  const self = terrainPriority(tileAt(scene, x, y));
  const out: EdgeBlend[] = [];
  for (const dir of ['N', 'E', 'S', 'O'] as EdgeDir[]) {
    const [dx, dy] = NEIGHBOURS[dir];
    const nt = tileAt(scene, x + dx, y + dy);
    if (terrainPriority(nt) > self) out.push({ dir, terrain: nt });
  }
  return out;
}

/** SVG d'une tuile de sol : losange de base + wedges de transition. */
export function groundTile(scene: Scene, x: number, y: number, dims: Dims): string {
  const base = `<path d="${diamondPath(x, y, dims)}" fill="url(#${terrainGradient(tileAt(scene, x, y))})" stroke="rgba(0,0,0,0.16)"/>`;
  const { cx, cy } = tileCenter(x, y, dims);
  // 4 sommets du losange
  const top = [cx, cy - TH / 2];
  const right = [cx + TW / 2, cy];
  const bot = [cx, cy + TH / 2];
  const left = [cx - TW / 2, cy];
  // arête partagée par direction (paire de sommets)
  const EDGE: Record<EdgeDir, number[][]> = {
    N: [top, right],
    E: [right, bot],
    S: [bot, left],
    O: [left, top],
  };
  const wedges = edgeBlends(scene, x, y)
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
