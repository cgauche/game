import { Scene, tileAt, elevAt } from '../state/scene';
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

/** Une « jupe » de dénivelé : la paroi VERTICALE descendant de l'arête `dir` (au niveau de la case,
 *  hauteur `self`) jusqu'au niveau de la case voisine plus basse. 4 sommets (bande verticale). */
export interface Skirt {
  dir: EdgeDir;
  drop: number; // dénivelé en unités d'étage (>0)
  points: [number, number][];
}

/** Sommets d'arête d'un losange (paire de coins partagée avec la case voisine de direction `dir`). */
function edgeCorners(c: ReturnType<typeof diamondCorners>, dir: EdgeDir): [[number, number], [number, number]] {
  switch (dir) {
    case 'N': return [c.top, c.right];
    case 'E': return [c.right, c.bot];
    case 'S': return [c.bot, c.left];
    default: return [c.left, c.top]; // O
  }
}

/** Jupes de dénivelé de la case (x,y) : une paroi par arête où la case est PLUS HAUTE que sa voisine
 *  (la case haute porte toujours la paroi — vaut pour un plateau surélevé ET le rebord d'une fosse).
 *  Pas de paroi sur une arête de même niveau (plateau plat). PUR (testable hors rendu). */
export function elevSkirt(scene: Scene, x: number, y: number, dims: Dims, z = 0): Skirt[] {
  const self = elevAt(scene, x, y, z);
  const out: Skirt[] = [];
  for (const dir of ['N', 'E', 'S', 'O'] as EdgeDir[]) {
    const [dx, dy] = NEIGHBOURS[dir];
    const nb = elevAt(scene, x + dx, y + dy, z);
    if (self <= nb) continue; // pas de chute de ce côté
    const hi = edgeCorners(diamondCorners(x, y, dims, z + self), dir); // arête au sol haut
    const lo = edgeCorners(diamondCorners(x, y, dims, z + nb), dir); // même arête, au sol bas
    out.push({ dir, drop: self - nb, points: [hi[0], hi[1], lo[1], lo[0]] });
  }
  return out;
}

// Faces avant (vers la caméra : S/E) éclairées, faces arrière sombres (occludées par le propre sol).
const SKIRT_FILL: Record<EdgeDir, string> = { S: '#5a4a33', E: '#4a3d2b', N: '#33291c', O: '#3d3122' };

/** SVG d'une tuile de sol du niveau `z` (défaut sol) : jupes de dénivelé + losange de base (soulevé de
 *  son élévation locale) + wedges de transition. */
export function groundTile(scene: Scene, x: number, y: number, dims: Dims, z = 0): string {
  if (tileAt(scene, x, y, z) === 'vide') return ''; // tuile non construite d'un étage → transparente
  const e = elevAt(scene, x, y, z);
  // Jupes d'abord (la paroi descend SOUS le sol), puis le losange par-dessus son arête haute.
  const skirts = elevSkirt(scene, x, y, dims, z)
    .map((s) => `<polygon class="elev-skirt" points="${s.points.map((p) => `${p[0]},${p[1]}`).join(' ')}" fill="${SKIRT_FILL[s.dir]}" stroke="rgba(0,0,0,0.28)" stroke-width="0.5"/>`)
    .join('');
  const { cx, cy, top, right, bot, left } = diamondCorners(x, y, dims, z + e);
  const base = `<path d="M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z" fill="url(#${terrainGradient(
    tileAt(scene, x, y, z),
  )})" stroke="rgba(0,0,0,0.16)"/>`;
  const blends = edgeBlends(scene, x, y, z);
  if (!blends.length) return skirts + base; // tuile sans voisin de plus haute précédence : pas de wedge
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
  return skirts + base + wedges;
}
