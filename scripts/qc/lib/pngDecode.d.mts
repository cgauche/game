/** Surface TYPÉE du décodeur PNG partagé (`pngDecode.mjs`, #1263) — patron des sidecars de
 *  `scripts/guards/lib/`. */

/** Planche décodée : RGBA 8 bits, `data.length === w · h · 4`. */
export interface PlancheRGBA {
  w: number;
  h: number;
  data: Uint8Array;
}

/** PNG 8 bits non entrelacé, couleur RGBA (type 6) ou RGB (type 2) → planche RGBA. */
export function decodePng(buf: Uint8Array): PlancheRGBA;
