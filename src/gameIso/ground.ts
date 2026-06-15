import { Scene, tileAt, elevAt } from '../state/scene';
import { terrainPriority } from '../state/terrain';
import { terrainGradient } from './catalog/terrain';
import { Dims, diamondCorners, tileCenter } from './iso';

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
 *  hauteur `self`) jusqu'à la case voisine plus basse. 4 sommets ; `lit` = face tournée vers la caméra. */
export interface Skirt {
  dir: EdgeDir;
  drop: number; // dénivelé en unités d'étage (>0)
  points: [number, number][];
  lit: boolean; // face avant (vers la caméra) → éclairée ; arrière → sombre (déduit du z écran)
}

/** Coins de GRILLE d'une arête MONDE par direction (partagés avec la case voisine). À projeter par
 *  tileCenter(gx-0.5, gy-0.5) → ROTATION-CORRECT (≠ coins d'écran top/right/… qui ne tournent pas). */
const EDGE_GRID: Record<EdgeDir, [[number, number], [number, number]]> = {
  N: [[0, 0], [1, 0]],
  E: [[1, 0], [1, 1]],
  S: [[1, 1], [0, 1]],
  O: [[0, 1], [0, 0]],
};

/** Jupes de dénivelé de la case (x,y) : une paroi par arête où la case est PLUS HAUTE que sa voisine
 *  (la case haute porte toujours la paroi — plateau surélevé ET rebord de fosse). Géométrie sur les COINS
 *  DE GRILLE (projetés avec la rotation caméra) ; éclairage déduit de la position ÉCRAN → suit la rotation. */
export function elevSkirt(scene: Scene, x: number, y: number, dims: Dims, z = 0): Skirt[] {
  const self = elevAt(scene, x, y, z);
  const out: Skirt[] = [];
  const gc = (gx: number, gy: number, lift: number) => tileCenter(x - 0.5 + gx, y - 0.5 + gy, dims, lift);
  const ctr = tileCenter(x, y, dims, z + self); // centre case (sol haut) pour le test avant/arrière
  for (const dir of ['N', 'E', 'S', 'O'] as EdgeDir[]) {
    const [dx, dy] = NEIGHBOURS[dir];
    const nb = elevAt(scene, x + dx, y + dy, z);
    if (self <= nb) continue; // pas de chute de ce côté
    const [[ax, ay], [bx, by]] = EDGE_GRID[dir];
    const hiA = gc(ax, ay, z + self), hiB = gc(bx, by, z + self); // arête au sol haut
    const loA = gc(ax, ay, z + nb), loB = gc(bx, by, z + nb); // même arête, au sol bas
    const lit = (hiA.cy + hiB.cy) / 2 >= ctr.cy; // l'arête est DEVANT (plus bas à l'écran) → face avant
    out.push({ dir, drop: self - nb, lit, points: [[hiA.cx, hiA.cy], [hiB.cx, hiB.cy], [loB.cx, loB.cy], [loA.cx, loA.cy]] });
  }
  return out;
}

const lerpP = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** SVG d'une jupe TEXTURÉE : face (claire si avant, sombre si arrière) + ombre au pied + arête vive. */
function renderSkirt(s: Skirt): string {
  const [tl, tr, br, bl] = s.points; // haut-gauche, haut-droit, bas-droit, bas-gauche
  const poly = (pts: [number, number][]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
  const fill = s.lit ? '#5a4a33' : '#33291c', foot = s.lit ? '#3e3322' : '#241c12';
  const fl = lerpP(tl, bl, 0.6), fr = lerpP(tr, br, 0.6); // bord haut de l'ombre de pied
  return (
    `<polygon class="elev-skirt" points="${poly([tl, tr, br, bl])}" fill="${fill}" stroke="rgba(0,0,0,0.3)" stroke-width="0.6"/>` +
    `<polygon points="${poly([fl, fr, br, bl])}" fill="${foot}" opacity="0.85"/>` +
    (s.lit ? `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="rgba(255,240,210,0.22)" stroke-width="1.1"/>` : '')
  );
}

/** SVG d'une tuile de sol du niveau `z` (défaut sol) : jupes de dénivelé + losange de base (soulevé de
 *  son élévation locale) + wedges de transition. */
export function groundTile(scene: Scene, x: number, y: number, dims: Dims, z = 0): string {
  if (tileAt(scene, x, y, z) === 'vide') return ''; // tuile non construite d'un étage → transparente
  const e = elevAt(scene, x, y, z);
  // Jupes d'abord (la paroi descend SOUS le sol), puis le losange par-dessus son arête haute.
  const skirts = elevSkirt(scene, x, y, dims, z).map(renderSkirt).join('');
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
