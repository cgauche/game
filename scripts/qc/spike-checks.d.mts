/** Surface TYPÉE de `spike-checks.mjs` consommée depuis `src/**` (patron des sidecars de
 *  `scripts/guards/lib/`). Seules les fonctions réellement importées par un test y figurent. */

/** Planche décodée : RGBA 8 bits, `data.length === w · h · 4`. */
export interface PlancheRGBA {
  w: number;
  h: number;
  data: Uint8Array;
}

export function decodePng(buf: Uint8Array): PlancheRGBA;

/** Densité d'accents SUR une nappe : part des fenêtres pleines de nappe qui portent au moins un pixel
 *  de la palette `touffes`, et part moyenne de pixels d'accent qu'elles portent. */
export function touffesSurNappe(
  img: PlancheRGBA,
  hexAlbedo: string,
  touffes: readonly string[],
  cote?: number,
): { fenetres: number; partAvecTouffe: number; partPixels: number };
