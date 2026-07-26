/** Présentation des terrains — DÉRIVÉE du registre unifié `state/terrain/defs/` (gradient/swatch).
 *  La méta sémantique (walkable/priority) vit côté state ; ici on n'expose que le visuel. */
import { TERRAIN_DEFS } from '../../state/terrain';
import { warnMissing } from './missing';

export interface TerrainViz {
  id: string;
  gradient: string; // id du <linearGradient> dans DEFS
  swatch: string; // couleur d'aperçu (palette éditeur)
}
export const TERRAIN_VIZ: Record<string, TerrainViz> = Object.fromEntries(
  TERRAIN_DEFS.map((t) => [t.id, { id: t.id, gradient: t.gradient, swatch: t.swatch }]),
);
/** Dégradé de REPLI VISIBLE (#877) : id du `<linearGradient>` d'alarme émis par `DEFS` (`gameIso/sprites`)
 *  à côté des dégradés de terrain — un id de terrain absent du registre peint la case en magenta criard,
 *  jamais l'herbe (ni aucun autre terrain réel). */
export const MISSING_GRADIENT = 'g_terrain_manquant';

/** Id du dégradé d'un terrain ; id absent du registre → repli VISIBLE + avertissement DEV. */
export function terrainGradient(id: string): string {
  const viz = TERRAIN_VIZ[id];
  if (viz) return viz.gradient;
  warnMissing('terrain', id);
  return MISSING_GRADIENT;
}
