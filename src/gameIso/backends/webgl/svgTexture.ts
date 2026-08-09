/**
 * SPIKE WebGL — couture NAVIGATEUR de rasterisation : une chaîne SVG (l'art, source de vérité :
 * `propSvg(...)` pour le décor, `bonesToSvg(resolveRig(...))` pour les rigs — le chemin des galeries)
 * devient une texture de billboard. ZÉRO logique : les décisions (taille monde, vue, palier de
 * rasterisation) vivent dans `billboardMath.ts` (pur, testé). Ce module dépend du DOM (`Blob`,
 * `Image`, `<canvas>`) et de three : la RASTERISATION se juge à l'écran du spike ; seule la politique
 * de CACHE (pure, injectable) est testée unitairement (`svgTexture.test.ts`).
 *
 * Les chaînes attendues sont des FRAGMENTS SVG en boîte locale (120×150 pour les props, boîte du rig
 * pour les personnages) : ce module les enveloppe dans un `<svg viewBox>` à la boîte fournie.
 */
import * as THREE from 'three';

/** Boîte locale du fragment SVG source (unités d'auteur). */
export interface SvgBox {
  w: number;
  h: number;
}

export interface RasterizedSvg {
  canvas: HTMLCanvasElement;
  /** Aspect l/h de la boîte source — à passer tel quel à `anchorAndSize`. */
  aspect: number;
}

function wrap(markup: string, box: SvgBox, pxHeight: number, pxWidth: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${pxWidth}" height="${pxHeight}">${markup}</svg>`;
}

/** Rasterise un fragment SVG à `pxHeight` pixels de haut (largeur déduite de l'aspect de la boîte). */
export function rasterizeSvg(svg: string, box: SvgBox, pxHeight: number): Promise<RasterizedSvg> {
  const aspect = box.w / box.h;
  const pxWidth = Math.max(1, Math.round(pxHeight * aspect));
  const blob = new Blob([wrap(svg, box, pxHeight, pxWidth)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  return new Promise<RasterizedSvg>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pxWidth;
      canvas.height = pxHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('rasterizeSvg: contexte 2D indisponible'));
        return;
      }
      ctx.drawImage(img, 0, 0, pxWidth, pxHeight);
      URL.revokeObjectURL(url);
      resolve({ canvas, aspect });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('rasterizeSvg: SVG illisible par le navigateur'));
    };
    img.src = url;
  });
}

/** Texture de billboard : rasterisation + filtrage linéaire sans mipmaps, espace colorimétrique sRGB. */
export async function svgToTexture(svg: string, box: SvgBox, pxHeight: number): Promise<THREE.CanvasTexture> {
  const { canvas } = await rasterizeSvg(svg, box, pxHeight);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Cache de textures — une entrée par clé appelante (`billboardTextureKey` : identité, vue, miroir,
 *  palier). Les promesses sont mémoïsées : deux billboards identiques ne rasterisent qu'une fois. */
const CACHE = new Map<string, Promise<THREE.CanvasTexture>>();

/** Texture mémoïsée d'une clé. Un ÉCHEC n'est PAS mémoïsé : une promesse rejetée laissée en cache
 *  condamnerait le sujet pour toute la session (un SVG illisible une fois ne l'est pas toujours — page
 *  rechargée, ressource tardive). L'entrée est évincée au rejet, l'appel suivant re-tente. */
export function getBillboardTexture(key: string, make: () => Promise<THREE.CanvasTexture>): Promise<THREE.CanvasTexture> {
  const hit = CACHE.get(key);
  if (hit) return hit;
  const p: Promise<THREE.CanvasTexture> = make().catch((e: unknown) => {
    if (CACHE.get(key) === p) CACHE.delete(key);
    throw e;
  });
  CACHE.set(key, p);
  return p;
}

/** Vide le cache et libère les textures GPU (changement de scène / rechargement du spike). */
export function clearBillboardTextures(): void {
  for (const p of CACHE.values()) void p.then((t) => t.dispose()).catch(() => undefined);
  CACHE.clear();
}
