/** Surface TYPÉE de `spike-checks.mjs` consommée depuis `src/**` (patron des sidecars de
 *  `scripts/guards/lib/`). Seules les fonctions réellement importées par un test y figurent.
 *  Le décodage PNG vit dans le module partagé `pngDecode.mjs` (et son sidecar). */
import type { PlancheRGBA } from './lib/pngDecode.mjs';

/** Densité d'accents SUR une nappe : part des fenêtres pleines de nappe qui portent au moins un pixel
 *  de la palette `touffes`, et part moyenne de pixels d'accent qu'elles portent. */
export function touffesSurNappe(
  img: PlancheRGBA,
  hexAlbedo: string,
  touffes: readonly string[],
  cote?: number,
): { fenetres: number; partAvecTouffe: number; partPixels: number };
