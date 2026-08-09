/**
 * SPIKE WebGL — TEXTURE DE PÉRIODE : le tracé métrique de `detail/courses` rasterisé en LOGICIEL, sans
 * DOM ni canevas (Node-safe : la planche QC et les tests le cuisent comme le navigateur). Le pivot ne
 * rasterise jamais de SVG ici — `coursesPeriod`/`groundCoursesPeriod` rendent des polylignes et des
 * rectangles en mètres, ce module les échantillonne en pixels.
 *
 * MASQUE DE LUMINANCE, jamais une couleur : la texture MULTIPLIE la couleur de base de la surface
 * (albédo de sommet × `map`). 255 = pleine teinte ; un joint descend au rapport de luminance
 * `joint ÷ base` de la DONNÉE (la recette porte la couleur du joint, ce module n'en garde que le
 * rapport) ; un bloc nuancé applique le MÊME dosage que les deux backends écran (`BLOCK_SHADE_K`).
 * Un bloc CLAIR dépasse 1 : la valeur 255 vaut alors `gain` (rendu avec la texture), à reporter sur la
 * couleur du matériau — le masque reste borné, l'éclaircissement passe par ce facteur.
 *
 * CONTINUITÉ DE RÉPÉTITION : tout stamp s'écrit MODULO la période (tore). Le bord gauche prolonge donc
 * exactement le bord droit, et le haut le bas — une ligne de rang posée en v = 0 se retrouve entière à
 * la couture d'en dessous. Les joints VERTICAUX, eux, ne touchent jamais le bord (`rowBoundaries`).
 */
import * as THREE from 'three';
import {
  coursesKey,
  coursesPeriod,
  coursesPeriodM,
  groundCoursesPeriod,
  groundPeriodM,
  type Courses,
  type CourseLine,
  type CourseRect,
  type CourseVertical,
} from '../../detail/courses';
import { BLOCK_SHADE_K } from '../../detail/expand';
import { parseHex } from '../../shade';
import type { DetailRecipe } from '../../detail/types';

/** Les deux familles de période : appareillage VERTICAL (mur, pan de toit) et appareillage de SOL. */
export type PeriodKind = 'wall' | 'ground';

/** Résolution de cuisson (px par mètre de période). Une assise de 0,35 m y tient sur ~34 px : le joint
 *  (2 cm) fait 2 px, la plus petite forme que le mip 0 sait porter sans se dissoudre. */
export const PERIOD_PX_PER_M = 96;
/** Bornes du côté cuit (px), puissances de 2 : mipmaps + `RepeatWrapping` sans repli d'échantillonnage,
 *  et une période ne coûte jamais plus qu'une petite tuile de VRAM. */
const MIN_PX = 16;
const MAX_PX = 512;

/** Masque cuit d'une période : RGBA 8 bits (les 3 canaux portent la MÊME luminance). */
export interface PeriodTextureData {
  data: Uint8Array;
  w: number;
  h: number;
  /** Taille MÉTRIQUE de la période rendue (u le long de l'appareillage, v vers le bas). */
  periodM: { u: number; v: number };
  /** Facteur que vaut la valeur 255 du masque (> 1 quand la période porte des blocs CLAIRS). */
  gain: number;
}

export interface PeriodTextureOpts {
  kind?: PeriodKind;
  /** Couleur de BASE de la surface : le masque n'en garde que des RAPPORTS (jamais une teinte). */
  baseColor: string;
}

/** Luminance relative (0..1) d'une couleur de donnée ; `null` si elle n'est pas lisible en hex. */
function relLum(color: string): number | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

/** Part de la teinte de base que laisse un joint : le rapport de luminance de la DONNÉE (couleur de
 *  joint ÷ couleur de face), borné à 1 — un joint plus clair que sa pierre ne s'y peint pas en négatif. */
export function jointFactor(jointColor: string, baseColor: string): number {
  const lj = relLum(jointColor);
  const lb = relLum(baseColor);
  if (lj === null || lb === null || lb <= 0) return 1;
  return Math.min(1, lj / lb);
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Côté cuit d'un axe : la taille métrique × la résolution, ramenée à la puissance de 2 la plus proche
 *  dans les bornes. */
function sidePx(metres: number, pxPerM: number): number {
  return 2 ** Math.round(Math.log2(clamp(metres * pxPerM, MIN_PX, MAX_PX)));
}

/** Masque en cours de cuisson — facteurs multiplicatifs, un par pixel, indexés en tore. */
interface Mask {
  f: Float32Array;
  w: number;
  h: number;
  /** Pixels par mètre, par axe (après arrondi du côté à une puissance de 2). */
  sx: number;
  sy: number;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Le plus SOMBRE gagne : deux joints qui se croisent ne creusent pas un puits. */
function darkenPx(m: Mask, x: number, y: number, factor: number): void {
  const i = wrap(y, m.h) * m.w + wrap(x, m.w);
  if (factor < m.f[i]) m.f[i] = factor;
}

/** Segment MÉTRIQUE épaissi de `wPx` pixels, échantillonné au demi-pixel (chaque pas dépose un carré). */
function stampSegment(m: Mask, u0: number, v0: number, u1: number, v1: number, wPx: number, factor: number): void {
  const x0 = u0 * m.sx, y0 = v0 * m.sy, x1 = u1 * m.sx, y1 = v1 * m.sy;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(len * 2));
  const r = Math.max(0.5, wPx / 2);
  const lo = Math.round(-r + 0.5);
  const hi = Math.round(r - 0.5);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(x0 + (x1 - x0) * t);
    const cy = Math.round(y0 + (y1 - y0) * t);
    for (let dy = lo; dy <= hi; dy++) for (let dx = lo; dx <= hi; dx++) darkenPx(m, cx + dx, cy + dy, factor);
  }
}

/** Ligne de rang tremblée : (0, y0) puis chaque point, en mètres. */
function stampLine(m: Mask, line: CourseLine, wPx: number, factor: number): void {
  let pu = 0;
  let pv = line.y0;
  for (const p of line.pts) {
    stampSegment(m, pu, pv, p.u, p.y, wPx, factor);
    pu = p.u;
    pv = p.y;
  }
}

/** Joint vertical entre deux blocs d'un rang. */
function stampVertical(m: Mask, v: CourseVertical, wPx: number, factor: number): void {
  stampSegment(m, v.u, v.y0, v.u, v.y1, wPx, factor);
}

/** Bloc nuancé : multiplie la teinte du rectangle (retrait déjà pris par la période). */
function fillRect(m: Mask, r: CourseRect, factor: number): void {
  const x0 = Math.round(r.u0 * m.sx);
  const x1 = Math.round(r.u1 * m.sx);
  const y0 = Math.round(r.v0 * m.sy);
  const y1 = Math.round(r.v1 * m.sy);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.f[wrap(y, m.h) * m.w + wrap(x, m.w)] *= factor;
}

/** Masque d'une période d'appareillage — `null` quand la recette n'a pas d'assises (rien ne se répète).
 *  `variant` ne joue que sur l'appareillage VERTICAL : la période de SOL est seedée à la seule clé de
 *  recette (`groundCoursesPeriod`), elle n'a qu'un exemplaire. */
export function periodTextureData(
  recipe: DetailRecipe,
  variant: number,
  pxPerM: number,
  opts: PeriodTextureOpts,
): PeriodTextureData | null {
  const c: Courses | undefined = recipe.courses;
  if (!c) return null;
  const kind = opts.kind ?? 'wall';
  const key = coursesKey(c);
  const periodM = kind === 'ground' ? groundPeriodM(c) : coursesPeriodM(c);
  const w = sidePx(periodM.u, pxPerM);
  const h = sidePx(periodM.v, pxPerM);
  const m: Mask = { f: new Float32Array(w * h).fill(1), w, h, sx: w / periodM.u, sy: h / periodM.v };

  const pv = c.paletteVar ?? 0;
  const clair = 1 + pv * BLOCK_SHADE_K;
  const sombre = 1 - pv * BLOCK_SHADE_K;
  const jointW = Math.max(1, c.jointW * ((m.sx + m.sy) / 2));
  const jf = jointFactor(c.joint, opts.baseColor);

  if (kind === 'ground') {
    const p = groundCoursesPeriod(c, key);
    if (pv) {
      for (const r of p.light) fillRect(m, r, clair);
      for (const r of p.dark) fillRect(m, r, sombre);
    }
    for (const l of p.lines) stampLine(m, l, jointW, jf);
    for (const v of p.verticals) stampVertical(m, v, jointW, jf);
  } else {
    const p = coursesPeriod(c, key, variant);
    for (const l of p.lines) stampLine(m, l, jointW, jf);
    for (const v of p.verticals) stampVertical(m, v, jointW, jf);
  }

  let gain = 1;
  for (let i = 0; i < m.f.length; i++) if (m.f[i] > gain) gain = m.f[i];
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < m.f.length; i++) {
    const v = Math.round(255 * clamp(m.f[i] / gain, 0, 1));
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { data, w, h, periodM, gain };
}

// ————————————————————————————————————————————————————————————————
// Côté GPU : la DataTexture et son cache
// ————————————————————————————————————————————————————————————————

/** Texture GPU d'une période + le gain à reporter sur la couleur du matériau. */
export interface PeriodTexture {
  texture: THREE.DataTexture;
  gain: number;
  periodM: { u: number; v: number };
}

const CACHE = new Map<string, PeriodTexture | null>();

/** Vide le cache (changement de scène : les surfaces de l'ancienne carte ne reviendront pas). */
export function clearPeriodTextures(): void {
  for (const t of CACHE.values()) t?.texture.dispose();
  CACHE.clear();
}

/** DataTexture d'une période, cuite UNE fois par (clé de surface, variante) : `RepeatWrapping`, mipmaps
 *  et anisotropie (le pas de rang d'un mur vu de biais tient sinon du bruit). Le masque est de la DONNÉE
 *  LINÉAIRE (un multiplicateur), jamais une couleur : aucune conversion d'espace. */
export function getPeriodTexture(
  cacheKey: string,
  recipe: DetailRecipe,
  variant: number,
  opts: PeriodTextureOpts & { anisotropy?: number },
): PeriodTexture | null {
  const hit = CACHE.get(cacheKey);
  if (hit !== undefined) return hit;
  const cuit = periodTextureData(recipe, variant, PERIOD_PX_PER_M, opts);
  if (!cuit) {
    CACHE.set(cacheKey, null);
    return null;
  }
  const texture = new THREE.DataTexture(cuit.data, cuit.w, cuit.h, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = opts.anisotropy ?? 1;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  const out = { texture, gain: cuit.gain, periodM: cuit.periodM };
  CACHE.set(cacheKey, out);
  return out;
}
