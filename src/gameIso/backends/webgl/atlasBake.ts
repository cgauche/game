/**
 * CUISEUR D'ATLAS de flipbook (#1176, L2) — la couture NAVIGATEUR qui remplit la planche dont
 * `billboardMath` tient la géométrie pure (`atlasLayout`/`frameUvRect`).
 *
 * Trois responsabilités, et rien d'autre :
 *  1. CUISSON : rasteriser `n` frames par la chaîne EXISTANTE (`rasterizeSvg`) et les ranger dans la
 *     grille, gouttière comprise — les texels de bord y sont DUPLIQUÉS (`ATLAS_GUTTER_PX`), ce que la
 *     géométrie réservait et qu'aucun cuiseur ne faisait ;
 *  2. CADENCE : une rasterisation par tranche d'inactivité, jamais un burst (mesure navigateur ci-dessous) ;
 *  3. CACHE : LRU à budget d'OCTETS, clé = chaîne de signature complète, entrées épinglées jamais évincées.
 */
import * as THREE from 'three';
import { ATLAS_GUTTER_PX, atlasLayout, type AtlasLayout } from './billboardMath';
import { rasterizeSvg, type SvgBox } from './svgTexture';
import type { View } from '../../rig/facing';
import type { GroundState } from '../../groundPose';

// ————————————————————————————————————————————————————————————————
// 1. COUTURES DE CANEVAS — décrites par ce dont le cuiseur a besoin, testables hors DOM
// ————————————————————————————————————————————————————————————————

/** Source de dessin (le canevas d'une frame rasterisée). */
export interface BakeImage {
  width: number;
  height: number;
}

/** Le seul geste de dessin du cuiseur : une copie de rectangle à rectangle. */
export interface BakeCtx {
  drawImage(
    src: BakeImage,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

/** Le canevas de la planche. */
export interface BakeCanvas extends BakeImage {
  getContext(id: '2d'): BakeCtx | null;
}

/** Couches basses injectables : la rasterisation d'une frame et la fabrication du canevas de planche. */
export interface BakeDeps {
  rasterize?: (svg: string, box: SvgBox, pxHeight: number) => Promise<{ canvas: BakeImage }>;
  makeCanvas?: (w: number, h: number) => BakeCanvas;
}

const defaultCanvas = (w: number, h: number): BakeCanvas => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c as unknown as BakeCanvas;
};

// ————————————————————————————————————————————————————————————————
// 2. FILE CADENCÉE — une rasterisation par tranche
// ————————————————————————————————————————————————————————————————

/**
 * Rasterisations lancées par tranche d'inactivité. Sonde navigateur (#1176, 2026-08-14) : ~9,3 ms par
 * frame en 109×136 et ~10,1 ms en 217×271 — un réchauffage complet en burst mesurait ≈ 2,4 s de mur.
 */
export const FRAMES_PAR_TRANCHE = 1;

/** Priorités d'usage : la vue courante passe devant le réchauffage du reste. */
export const PRIORITE_VUE_COURANTE = 100;
export const PRIORITE_RECHAUFFAGE = 0;

/**
 * Priorité MUTABLE d'une cuisson, partagée par TOUTES ses frames — celles déjà en file comme celles
 * qu'elle y mettra ensuite (une planche n'y pose qu'une frame à la fois). C'est ce qui permet à
 * `enqueueBake` de faire remonter une planche déjà en attente quand la vue courante la réclame.
 */
export interface BakePriority {
  value: number;
}

const bakePriority = (p: number | BakePriority): BakePriority => (typeof p === 'number' ? { value: p } : p);

interface Job {
  prio: BakePriority;
  seq: number;
  run: () => void;
}

const QUEUE: Job[] = [];
let seq = 0;
let sliceArmed = false;
let slices = 0;

function requestSlice(): void {
  if (sliceArmed) return;
  sliceArmed = true;
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => pump());
  else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => pump());
  else setTimeout(pump, 0);
}

function pump(): void {
  sliceArmed = false;
  slices += 1;
  for (let i = 0; i < FRAMES_PAR_TRANCHE && QUEUE.length; i++) {
    let best = 0;
    for (let k = 1; k < QUEUE.length; k++) {
      const a = QUEUE[k];
      const b = QUEUE[best];
      if (a.prio.value > b.prio.value || (a.prio.value === b.prio.value && a.seq < b.seq)) best = k;
    }
    QUEUE.splice(best, 1)[0].run();
  }
  if (QUEUE.length) requestSlice();
}

/** Passe une tâche de frame par la file : elle ne s'exécute qu'à son tour de tranche.
 *
 *  Le JET SYNCHRONE de la tâche (une couture navigateur devenue indisponible entre la mise en file et
 *  la tranche — un contexte perdu, un banc démonté) rejette la planche comme n'importe quel échec.
 *  Laissé nu, il s'échappait de la tranche : ni la promesse ni la mémoïsation ne l'apprenaient, et il
 *  remontait en erreur non gérée depuis un `requestIdleCallback`. */
function queueFrame<T>(prio: BakePriority, task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    QUEUE.push({ prio, seq: seq++, run: () => { try { void task().then(resolve, reject); } catch (e) { reject(e); } } });
    requestSlice();
  });
}

/** Tranches servies depuis le chargement — instrument de garde de la CADENCE (rasterisations ≤ tranches
 *  × `FRAMES_PAR_TRANCHE`). */
export function bakeSliceCount(): number {
  return slices;
}

/** Longueur de la file — instrument de garde (« aucune rasterisation hors file »). */
export function bakeQueueLength(): number {
  return QUEUE.length;
}

/** Abandonne les cuissons en attente et désarme la tranche (changement de scène, teardown de garde) :
 *  les planches déjà en file ne seront jamais servies, leurs promesses restent en suspens. */
export function resetBakeQueue(): void {
  QUEUE.length = 0;
  sliceArmed = false;
}

// ————————————————————————————————————————————————————————————————
// 3. CUISSON
// ————————————————————————————————————————————————————————————————

/** Une planche cuite : sa texture, sa géométrie, et son POIDS (ce que le budget du cache compte). */
export interface BakedAtlas {
  texture: THREE.CanvasTexture;
  layout: AtlasLayout;
  bytes: number;
}

/** Poids GPU d'une planche : 4 octets par texel (RGBA, sans mipmaps — le cuiseur les désactive). */
const atlasBytes = (l: AtlasLayout): number => l.texW * l.texH * 4;

/**
 * Dessine une frame dans son rectangle de contenu PUIS duplique ses texels de bord dans la gouttière
 * (4 bandes étirées à `ATLAS_GUTTER_PX` + 4 coins). C'est la promesse que la géométrie réservait : au
 * filtrage linéaire, un bord ne mélange que sa propre couleur — ni frame voisine, ni frange transparente.
 */
function drawFrameWithGutter(ctx: BakeCtx, frame: BakeImage, r: { x: number; y: number; w: number; h: number }): void {
  const G = ATLAS_GUTTER_PX;
  const fw = frame.width;
  const fh = frame.height;
  ctx.drawImage(frame, 0, 0, fw, fh, r.x, r.y, r.w, r.h);
  ctx.drawImage(frame, 0, 0, 1, fh, r.x - G, r.y, G, r.h);
  ctx.drawImage(frame, fw - 1, 0, 1, fh, r.x + r.w, r.y, G, r.h);
  ctx.drawImage(frame, 0, 0, fw, 1, r.x, r.y - G, r.w, G);
  ctx.drawImage(frame, 0, fh - 1, fw, 1, r.x, r.y + r.h, r.w, G);
  ctx.drawImage(frame, 0, 0, 1, 1, r.x - G, r.y - G, G, G);
  ctx.drawImage(frame, fw - 1, 0, 1, 1, r.x + r.w, r.y - G, G, G);
  ctx.drawImage(frame, 0, fh - 1, 1, 1, r.x - G, r.y + r.h, G, G);
  ctx.drawImage(frame, fw - 1, fh - 1, 1, 1, r.x + r.w, r.y + r.h, G, G);
}

/**
 * Cuit la planche d'un geste : `n` frames dessinées par `drawFrame(k)` (fragments SVG en boîte `box`),
 * rasterisées à `pxHeight` pixels de haut. La planche peut en porter MOINS que demandé (plafond de
 * texture) : `layout.n` fait foi, l'appelant ré-échantillonne son geste dessus.
 *
 * Chaque rasterisation passe par la file cadencée : cuire une planche ne bloque jamais une frame de jeu.
 */
export async function bakeAtlas(
  drawFrame: (k: number) => string,
  box: SvgBox,
  n: number,
  pxHeight: number,
  opts: { priority?: number | BakePriority; deps?: BakeDeps } = {},
): Promise<BakedAtlas> {
  const rasterize = opts.deps?.rasterize ?? rasterizeSvg;
  const makeCanvas = opts.deps?.makeCanvas ?? defaultCanvas;
  const prio = bakePriority(opts.priority ?? PRIORITE_RECHAUFFAGE);
  const px = Math.max(1, Math.round(pxHeight));
  const pxWidth = Math.max(1, Math.round(px * (box.w / box.h)));
  const layout = atlasLayout(pxWidth + 2 * ATLAS_GUTTER_PX, px + 2 * ATLAS_GUTTER_PX, n);
  const canvas = makeCanvas(layout.texW, layout.texH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('bakeAtlas: contexte 2D indisponible');
  for (let k = 0; k < layout.n; k++) {
    const { canvas: frame } = await queueFrame(prio, () => rasterize(drawFrame(k), box, px));
    drawFrameWithGutter(ctx, frame, layout.rects[k]);
  }
  const texture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, layout, bytes: atlasBytes(layout) };
}

// ————————————————————————————————————————————————————————————————
// 4. CLÉS — une planche par (corps, geste, vue, miroir, palier), effondrement ÉNUMÉRÉ
// ————————————————————————————————————————————————————————————————

/** De quoi une planche dépend. `signature` = la CHAÎNE complète des entrées de dessin : un hash seul
 *  ferait collisionner deux corps dans un cache à éviction, silencieusement et pour toute la session. */
export interface AtlasKeyParts {
  signature: string;
  clip: string;
  view: View;
  mirror: boolean;
  pxHeight: number;
  frames: number;
  /** État AU SOL visé — voir `collapseAtlasKeys`. */
  ground?: Exclude<GroundState, null>;
}

export function atlasKey(p: AtlasKeyParts): string {
  return `${p.signature}|${p.clip}|${p.ground ?? '-'}|${p.view}|${p.mirror ? 'm' : 'd'}|${p.pxHeight}|${p.frames}`;
}

/**
 * Clés d'un EFFONDREMENT : `corpse` ET `prone`, deux planches. La pose au sol est un état du RENDU
 * (`planRenderPose` la lit au rendu, pas à l'évènement) — une planche cuite sur la clé du def `dying`
 * seule rendrait le cadavre là où le rendu veut l'affaissé.
 */
export function collapseAtlasKeys(p: Omit<AtlasKeyParts, 'ground'>): string[] {
  return (['corpse', 'prone'] as const).map((ground) => atlasKey({ ...p, ground }));
}

// ————————————————————————————————————————————————————————————————
// 5. CACHE LRU À BUDGET D'OCTETS
// ————————————————————————————————————————————————————————————————

/**
 * Budget du cache d'atlas. Sonde navigateur (#1176, 2026-08-14) : la marche d'UN acteur (8 frames ×
 * 3 vues) pèse ≈ 1,36 Mo à mpt=2 et ≈ 5,38 Mo à mpt=1 ; un combat mesuré tenait 4-6 signatures
 * distinctes pour 10 combattants. 96 Mo laissent donc plusieurs gestes par signature en réserve, loin
 * des 219 Mo qu'un réchauffage non borné atteignait.
 */
export const ATLAS_BUDGET_BYTES_DEFAUT = 96 * 1024 * 1024;
let budget = ATLAS_BUDGET_BYTES_DEFAUT;

/** Change le budget (réglage de mesure/garde) — rend l'ancien. */
export function setAtlasBudgetBytes(n: number): number {
  const avant = budget;
  budget = n;
  evict();
  return avant;
}

interface Entry {
  promise: Promise<BakedAtlas>;
  atlas?: BakedAtlas;
  bytes: number;
  /** Priorité de la cuisson de CETTE entrée, tant qu'elle a des frames en file. */
  prio: BakePriority;
}

/** L'ordre d'insertion de la Map EST l'ordre d'usage : une entrée servie est réinsérée en queue. */
const CACHE = new Map<string, Entry>();
let pinned: ReadonlySet<string> = new Set();

/** Clés ÉPINGLÉES (atlas des boards montés) : jamais évincées, quel que soit leur âge. */
export function setAtlasPins(keys: Iterable<string>): void {
  pinned = new Set(keys);
}

function evict(): void {
  let total = 0;
  for (const e of CACHE.values()) total += e.bytes;
  for (const [key, e] of CACHE) {
    if (total <= budget) return;
    if (pinned.has(key) || !e.atlas) continue;
    CACHE.delete(key);
    total -= e.bytes;
    e.atlas.texture.dispose();
  }
}

/**
 * Planche mémoïsée d'une clé, cuite par la file cadencée. `make` reçoit la POIGNÉE de priorité à
 * passer à `bakeAtlas`. Un ÉCHEC n'est pas mémoïsé (même loi que `getBillboardTexture` : un SVG
 * illisible une fois ne condamne pas le sujet pour la session).
 *
 * RE-PRIORISATION : une planche déjà en file en priorité basse et redemandée plus haut (le
 * réchauffage rattrapé par la vue courante) voit sa poignée RELEVÉE — sinon la frame que la caméra
 * attend resterait derrière tout le réchauffage déjà posé.
 */
export function enqueueBake(
  key: string,
  make: (priority: BakePriority) => Promise<BakedAtlas>,
  priority: number = PRIORITE_RECHAUFFAGE,
): Promise<BakedAtlas> {
  const hit = CACHE.get(key);
  if (hit) {
    CACHE.delete(key);
    CACHE.set(key, hit);
    if (priority > hit.prio.value) hit.prio.value = priority;
    return hit.promise;
  }
  let entry: Entry;
  const prio: BakePriority = { value: priority };
  const promise = make(prio).then(
    (atlas) => {
      if (CACHE.get(key) === entry) {
        entry.atlas = atlas;
        entry.bytes = atlas.bytes;
        evict();
      } else {
        atlas.texture.dispose();
      }
      return atlas;
    },
    (e: unknown) => {
      if (CACHE.get(key) === entry) CACHE.delete(key);
      throw e;
    },
  );
  entry = { bytes: 0, promise, prio };
  CACHE.set(key, entry);
  return promise;
}

/**
 * Planche DÉJÀ CUITE d'une clé, en SYNCHRONE — la seule lecture qu'une IMAGE de rendu s'autorise
 * (`stage/boardPose.writeBoardFrames`). `undefined` tant que la cuisson court : le cache tient une
 * promesse, et une image n'attend pas.
 *
 * Cette lecture ne compte PAS comme un usage LRU : l'ordre du cache resterait ce qu'il est même si
 * tous les boards montés le relisaient soixante fois par seconde. Ce sont les ÉPINGLES
 * (`setAtlasPins`, posées sur les atlas des boards montés) qui protègent ce qui est à l'écran.
 */
export function getCachedAtlas(key: string): BakedAtlas | undefined {
  return CACHE.get(key)?.atlas;
}

/** Compteur de debug du cache d'atlas — l'instrument qui manquait à la sonde (`CACHE` de `svgTexture`
 *  n'expose ni taille ni poids). */
export function atlasCacheStats(): { entries: number; bytes: number } {
  let bytes = 0;
  for (const e of CACHE.values()) bytes += e.bytes;
  return { entries: CACHE.size, bytes };
}

/** Vide le cache et libère les textures (changement de scène, garde de test). */
export function clearAtlasCache(): void {
  for (const e of CACHE.values()) void e.promise.then((a) => a.texture.dispose()).catch(() => undefined);
  CACHE.clear();
  pinned = new Set();
}
