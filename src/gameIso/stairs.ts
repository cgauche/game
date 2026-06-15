import { tileCenter, depth, LEVEL_H, TW, TH, type Dims } from './iso';
import type { Scene } from '../state/scene';

/**
 * Rendu des ESCALIERS — `Scene.stairs` (franchissement vertical d'un étage) dessiné comme une vraie
 * VOLÉE DE MARCHES, pas un décor posé à la main. Élément STRUCTUREL du multi-niveaux, au même titre que
 * les murs (`walls.ts`) : la donnée `stairs` qui porte déjà la traversée porte aussi le visuel. Une volée
 * monte du sol `lo` au sol `hi` sur la MÊME case, de l'avant (côté caméra) vers l'arrière en gravissant.
 */
const STEPS_PER_LEVEL = 6;

/** SVG + profondeur d'une volée reliant (x,y,from.z) à (x,y,to.z). */
export function stairSeg(s: NonNullable<Scene['stairs']>[number], dims: Dims): { d: number; svg: string } {
  const lo = Math.min(s.from.z, s.to.z);
  const hi = Math.max(s.from.z, s.to.z);
  const x = s.from.x, y = s.from.y;
  const N = STEPS_PER_LEVEL * (hi - lo);
  // La volée a du RUN : elle démarre une case EN AVANT (côté caméra, sol bas) et grimpe jusqu'à la case
  // de l'escalier au sol HAUT → les marches s'étalent en diagonale (lisible) au lieu d'un puits vertical.
  const p0 = tileCenter(x, y + 1, dims, lo); // pied de la volée (avant)
  const p1 = tileCenter(x, y, dims, hi); // haut de la volée (case de l'escalier, étage du dessus)
  const rise = (p0.cy - p1.cy) / N; // hauteur écran d'une marche
  const halfW = TW * 0.32, halfD = TH * 0.16; // giron large, peu profond
  let svg = '<g>';
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const mx = p0.cx + (p1.cx - p0.cx) * t;
    const my = p0.cy + (p1.cy - p0.cy) * t;
    const tread = `${mx},${my - halfD} ${mx + halfW},${my} ${mx},${my + halfD} ${mx - halfW},${my}`;
    const riser = `${mx - halfW},${my} ${mx},${my + halfD} ${mx + halfW},${my} ${mx + halfW},${my + rise} ${mx},${my + halfD + rise} ${mx - halfW},${my + rise}`;
    svg += `<polygon points="${riser}" fill="#3c3120"/>` + // contremarche (face avant, sombre)
      `<polygon points="${tread}" fill="#8a724f" stroke="#2a2217" stroke-width="0.6"/>`; // giron (dessus, clair)
  }
  svg += '</g>';
  // Ancrée au sol bas, juste devant son plancher (comme un mur) — rise dans l'espace de l'étage du dessus.
  return { d: depth(x, y, dims, lo) + 0.42, svg };
}

/** Étages reliés par une volée (pour l'emphase d'étage : visible si l'un OU l'autre est actif). */
export function stairLevels(s: NonNullable<Scene['stairs']>[number]): [number, number] {
  return [Math.min(s.from.z, s.to.z), Math.max(s.from.z, s.to.z)];
}

/** Toutes les volées de la scène, prêtes à fusionner dans le tri de profondeur. */
export function stairSegs(scene: Scene, dims: Dims): { d: number; svg: string }[] {
  return (scene.stairs ?? []).map((s) => stairSeg(s, dims));
}
