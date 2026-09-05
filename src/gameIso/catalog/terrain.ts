/** Présentation des terrains — DÉRIVÉE du registre unifié `state/terrain/defs/` (gradient/swatch).
 *  La méta sémantique (walkable/priority) vit côté state ; ici on n'expose que le visuel. */
import { TERRAIN_DEFS, type TerrainDef } from '../../state/terrain';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE } from './missing';

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

const DEF_BY_ID: Record<string, TerrainDef> = Object.fromEntries(TERRAIN_DEFS.map((t) => [t.id, t]));

/** Entrée de REPLI VISIBLE (#877) : un terrain au ton d'alarme, jamais l'apparence d'un autre terrain.
 *  `stops` VIDE : le dégradé peint du repli est `MISSING_GRADIENT`, émis par `DEFS` — une rampe recopiée
 *  ici en serait une seconde définition. Infranchissable et de priorité nulle : le repli ne déborde sur
 *  aucun voisin et n'ouvre aucun passage que la donnée n'a pas authorisé. */
const MISSING: TerrainDef = {
  id: MISSING_ID,
  label: MISSING_LABEL,
  walkable: false,
  priority: 0,
  gradient: MISSING_GRADIENT,
  swatch: MISSING_TONE,
  stops: [],
};

/** Terrain par id ; id absent du registre → repli VISIBLE + avertissement DEV. Le seul accès du rendu
 *  au registre : `swatch`, `detail` et `gradient` en sortent tous, donc du MÊME repli. */
export function terrainDef(id: string): TerrainDef {
  return catalogEntry((cle) => DEF_BY_ID[cle], id, 'terrain', MISSING);
}

/** Id du dégradé d'un terrain ; id absent du registre → repli VISIBLE + avertissement DEV. */
export function terrainGradient(id: string): string {
  return terrainDef(id).gradient;
}
