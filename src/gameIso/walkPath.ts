/** Interpolation visuelle d'un déplacement le long d'un chemin de tuiles. PUR. */
export interface Pt { x: number; y: number }

/**
 * Position FRACTIONNAIRE le long de `path` à `elapsed` ms, `stepMs` par tuile.
 * Permet au token de GLISSER tuile par tuile (marche) au lieu de se téléporter à la fin.
 */
export function walkXY(path: Pt[], elapsed: number, stepMs: number): Pt {
  if (!path || path.length === 0) return { x: 0, y: 0 };
  const total = (path.length - 1) * stepMs;
  if (path.length === 1 || elapsed >= total) return path[path.length - 1];
  if (elapsed <= 0) return path[0];
  const seg = Math.floor(elapsed / stepMs);
  const f = (elapsed - seg * stepMs) / stepMs;
  const a = path[seg];
  const b = path[seg + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/** Durée totale du parcours (ms). */
export function walkDuration(path: Pt[], stepMs: number): number {
  return Math.max(0, (path.length - 1) * stepMs);
}
