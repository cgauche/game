/**
 * Vision — moteur PUR de visibilité & champ de lumière (brouillard de guerre). Vit en `state`
 * (couplé à `Scene`, comme `lineOfSight.ts`) ; aucune dépendance au store/RNG → testable.
 *
 * Un viewer voit une case si la Ligne de Vue n'est pas bloquée (murs/décor/fumée via
 * `lineOfSightCover`) ET (elle est dans sa portée de vision nocturne, OU elle est dans son rayon
 * de vue ET éclairée au-dessus du seuil). L'ensemble visible = UNION de tous les viewers.
 *
 * RÈGLE 1 : la portée de vue de base et le seuil d'éclairement n'ont pas de valeur canon (le LDB ne
 * stat pas la vue) → réglages MAISON injectés en paramètres ; les rayons de lumière (Bougie 10 m,
 * Lanterne 20 m — `LDB 74 l.72`, `LDB 75 l.15`) et la Vision nocturne (20 m/niv — `LDB 11 l.143-147`)
 * sont canon, convertis à l'échelle 1 case = 2 m (`LDB Déplacement l.55`).
 */
import { Scene } from './scene';
import { lineOfSightCover } from './lineOfSight';
import { Pt } from './path';

/** Un observateur : sa case, son rayon de vue (cases éclairées qu'il distingue) et sa portée de
 *  vision nocturne (cases qu'il distingue même dans le noir). */
export interface Viewer {
  pos: Pt;
  z?: number;
  radiusTiles: number;
  darkTiles: number;
}

/** Une source de lumière ponctuelle (torche portée, brasero posé…). */
export interface LightSource {
  pos: Pt;
  z?: number;
  radiusTiles: number;
}

/** Champ de lumière : niveau d'éclairement 0..1 d'une case. */
export interface LightField {
  at(x: number, y: number, z?: number): number;
}

/** Seuil d'éclairement (MAISON) au-dessus duquel une case est « éclairée » pour la vue. */
export const LIT_THRESHOLD = 0.18;

const chebyshev = (a: Pt, b: Pt): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Contribution d'une source à une case à distance `d` (dégradé linéaire, 1 au centre → 0 au bord). */
function falloff(d: number, radius: number): number {
  if (radius <= 0) return d === 0 ? 1 : 0;
  return Math.max(0, 1 - d / radius);
}

/**
 * Champ de lumière de la scène : plancher `ambient` (0..1) partout, rehaussé par chaque source
 * (dégradé `falloff`, combinaison par max) — une source n'éclaire une case que si la Ligne de Vue
 * source→case est dégagée (la lumière ne traverse pas les murs). PUR.
 */
export function computeLightField(scene: Scene, ambient: number, sources: LightSource[], smoke: Pt[] = []): LightField {
  const { w, h } = scene.dimensions;
  const grid = new Map<string, number>(); // "x,y,z" → contribution des sources (> ambient seulement)
  for (const s of sources) {
    const z = s.z ?? 0;
    const R = s.radiusTiles;
    const x0 = Math.max(0, s.pos.x - R), x1 = Math.min(w - 1, s.pos.x + R);
    const y0 = Math.max(0, s.pos.y - R), y1 = Math.min(h - 1, s.pos.y + R);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = chebyshev(s.pos, { x, y });
        const c = falloff(d, R);
        if (c <= 0) continue;
        if (d > 0 && lineOfSightCover(scene, s.pos, { x, y }, [], smoke).blocked) continue;
        const k = `${x},${y},${z}`;
        const prev = grid.get(k) ?? 0;
        if (c > prev) grid.set(k, c);
      }
  }
  return { at: (x, y, z = 0) => Math.max(ambient, grid.get(`${x},${y},${z}`) ?? 0) };
}

/**
 * Ensemble des cases (`"x,y,z"`) visibles par AU MOINS UN viewer. Une case est visible si la Ligne
 * de Vue est dégagée ET (dans la portée de vision nocturne du viewer, OU dans son rayon de vue ET
 * éclairée ≥ `LIT_THRESHOLD`). PUR.
 */
export function computeVisible(scene: Scene, viewers: Viewer[], light: LightField, smoke: Pt[] = []): Set<string> {
  const { w, h } = scene.dimensions;
  const vis = new Set<string>();
  for (const v of viewers) {
    const z = v.z ?? 0;
    const R = Math.max(v.radiusTiles, v.darkTiles);
    const x0 = Math.max(0, v.pos.x - R), x1 = Math.min(w - 1, v.pos.x + R);
    const y0 = Math.max(0, v.pos.y - R), y1 = Math.min(h - 1, v.pos.y + R);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const k = `${x},${y},${z}`;
        if (vis.has(k)) continue;
        const d = chebyshev(v.pos, { x, y });
        if (d > R) continue;
        const inDark = d <= v.darkTiles;
        const lit = d <= v.radiusTiles && light.at(x, y, z) >= LIT_THRESHOLD;
        if (!inDark && !lit) continue;
        if (d > 0 && lineOfSightCover(scene, v.pos, { x, y }, [], smoke).blocked) continue;
        vis.add(k);
      }
  }
  return vis;
}
