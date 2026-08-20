/**
 * Harnais de banc volumique PARTAGÉ — importé UNIQUEMENT par des fichiers `.test.` (garde structurelle
 * dans banc-volumique.test.ts).
 *
 * Ce que ce module tient, pour tout banc qui monte l'écran volumique sous jsdom :
 *  - le RENDERER de banc (jsdom n'a aucun contexte WebGL : sans lui la passe de dessin s'arrête à sa
 *    première garde) et les frames qu'il capte, en accumulateurs de MODULE — un banc peut monter
 *    PLUSIEURS écrans et compter leurs rendus ensemble ;
 *  - la RASTERISATION simulée au niveau du DOM (jamais par mock de module, cf.
 *    `src/vi-mock-isolate-guard.test.ts`), en service automatique ou RETENUE ;
 *  - l'ARDOISE : la purge des caches de MODULE que la suite partage sous `isolate: false`
 *    (`brancherArdoise`) — un cache laissé chargé par un fichier voisin fait démarrer le suivant sur
 *    des tâches et des textures d'ailleurs, et son écran se monte sans un seul quad.
 */
import { act } from 'react';
import { afterEach, vi } from 'vitest';
import * as THREE from 'three';
import type { StageRenderer } from './GameStage3D';
import { frameRectOf } from './boardPose';
import { clearAtlasCache, resetBakeQueue } from '../backends/webgl/atlasBake';
import { clearBillboardTextures } from '../backends/webgl/svgTexture';
import { viderTexturesStatiques } from './texturesStatiques';

/** Les scènes three DESSINÉES, dans l'ordre — accumulateur de MODULE : plusieurs écrans montés à la
 *  fois y versent leurs frames, et un banc peut donc compter les rendus de tout ce qui vit. */
export const scènes: THREE.Scene[] = [];
/** La caméra de CHAQUE frame dessinée, appariée à `scènes` par l'index. */
export const caméras: THREE.Camera[] = [];

/** Ardoise neuve des captures (les tableaux gardent leur identité : ils sont exportés). */
export function viderCaptures(): void {
  scènes.length = 0;
  caméras.length = 0;
}

/** Ce qu'un banc peut greffer sur chaque frame dessinée, en plus des captures (projection, horloge…). */
export type SurRendu = (scene: THREE.Scene, camera: THREE.Camera) => void;

export class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  surRendu?: SurRendu;

  constructor(surRendu?: SurRendu) {
    this.surRendu = surRendu;
  }

  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    scènes.push(scene);
    caméras.push(camera);
    this.surRendu?.(scene, camera);
  }
}

/** La rasterisation simulée d'un banc : sa file d'images EN VOL et les deux façons de les servir. */
export interface Rasterisation {
  /** Les rasterisations en vol (mode `retenue` seulement) — la file elle-même, mutable par le banc. */
  enAttente: Array<() => void>;
  /** Sert la PROCHAINE image en vol. */
  résoudreUne(): void;
  /** Sert toutes les images en vol. */
  résoudreTout(): void;
}

/** `URL.createObjectURL`/`revokeObjectURL` d'AVANT la première pose (jsdom ne les fournit pas : il n'y
 *  a rien à espionner, on les POSE) — rendues par `brancherArdoise`. */
let urlAvant: { create: typeof URL.createObjectURL; revoke: typeof URL.revokeObjectURL } | null = null;

/**
 * Rasterisation de billboard SIMULÉE au niveau du DOM : jsdom ne charge aucune ressource, donc
 * l'`Image` d'un blob SVG n'y déclenche ni `onload` ni `onerror` et la promesse de texture resterait
 * pendante — AUCUN board ne serait monté, et toute mesure porterait sur le vide.
 *
 * `auto` : chaque image s'achève à la microtâche suivante. `retenue` : le banc décide QUAND, en
 * servant lui-même la file rendue ici (c'est la fenêtre de montage).
 *
 * CONDITION DE MESURE, dans les deux modes : le stub de `requestIdleCallback` fait SERVIR la file du
 * cuiseur par `setTimeout(0)`. Tout banc qui appelle cette fonction mesure donc un écran dont la file
 * tourne — y compris `pas-exploration`, `entree-en-scene`, `silhouette-corps` et
 * `silhouette-sans-corps`, qui ne servent aucune rasterisation eux-mêmes.
 */
export function simulerRasterisation(mode: 'auto' | 'retenue' = 'auto'): Rasterisation {
  const enAttente: Array<() => void> = [];
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      if (mode === 'auto') queueMicrotask(() => this.onload?.());
      else enAttente.push(() => this.onload?.());
    }
  });
  // La file du cuiseur prend sa propre couture d'INACTIVITÉ, servie par les VRAIS timers : sans elle
  // elle se branche sur l'horloge d'images, qu'un banc voisin de la même suite peut tenir lui-même
  // (`isolate: false`) — la file resterait armée sans jamais être servie, et rien ne se monterait.
  vi.stubGlobal('requestIdleCallback', (cb: () => void) => setTimeout(() => cb(), 0));
  if (!urlAvant) urlAvant = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  URL.createObjectURL = () => 'blob:banc';
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => undefined } as unknown as CanvasRenderingContext2D);
  return {
    enAttente,
    résoudreUne(): void { enAttente.shift()?.(); },
    résoudreTout(): void { for (const f of enAttente.splice(0)) f(); },
  };
}

/**
 * ARDOISE NEUVE entre deux tests, et entre deux FICHIERS — à appeler UNE fois en tête d'un banc.
 *
 * La suite partage son graphe de modules par worker (`isolate: false`, `vite.config.ts`) : la file du
 * cuiseur, le stock d'atlas, les textures de billboard et les textures statiques sont des SINGLETONS
 * que deux fichiers voisins se passent en l'état. Un fichier qui les laisse chargés fait démarrer le
 * suivant sur des tâches et des textures d'ailleurs — mesuré : un écran monté sans un seul quad.
 *
 * La DÉPOSE de ce que `simulerRasterisation` pose (spy de `getContext`, globaux stubbés, `URL.*`) vit
 * ici, dans la même main : le banc appelant n'a rien à rendre lui-même.
 */
export function brancherArdoise(): void {
  afterEach(() => {
    resetBakeQueue();
    clearAtlasCache();
    clearBillboardTextures();
    viderTexturesStatiques();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (urlAvant) {
      URL.createObjectURL = urlAvant.create;
      URL.revokeObjectURL = urlAvant.revoke;
      urlAvant = null;
    }
    viderCaptures();
  });
}

/**
 * Laisse tourner la file CADENCÉE du cuiseur (une rasterisation par tranche d'inactivité) pendant `ms`
 * de mur. `battre` = la pompe d'images du banc, quand il en tient une (`StageWalkAnim.subscribe`).
 */
export async function respirer(ms: number, battre?: () => void): Promise<void> {
  const fin = Date.now() + ms;
  do {
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    if (battre) act(() => battre());
  } while (Date.now() < fin);
}

/** Tous les quads de billboard de la dernière frame dessinée (les corps, jamais leurs jumeaux de
 *  silhouette ni la géométrie empruntée au monde cuit). */
export function quads(): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scènes[scènes.length - 1]?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.emprunte && frameRectOf(m.material as THREE.Material)) out.push(m);
  });
  return out;
}

/** Attend que la file cadencée du cuiseur ait posé `n` quads — PRÉMISSE de mesure, jamais une
 *  assertion : la suite fait tourner plusieurs bancs sur le même module (`isolate: false`) et la file
 *  d'un écran chargé partage la machine avec eux. Le budget est un PLAFOND : la boucle sort au compte
 *  plein. */
export async function attendreQuads(n: number, limiteMs = 4000): Promise<void> {
  const fin = Date.now() + limiteMs;
  while (quads().length < n && Date.now() < fin) await respirer(20);
}

/** Le canevas volumique monté sous `hôte`. */
export const canevas = (hôte: HTMLElement): HTMLCanvasElement => hôte.querySelector('canvas.iso-stage') as HTMLCanvasElement;

/** Le compteur applicatif de rendus du canevas — ce que le renderer a REÇU (un canevas WebGL n'a pas
 *  d'arbre à interroger, et c'est par lui que la recette navigateur lit le même fait). */
export const rendus = (hôte: HTMLElement): number => Number(canevas(hôte).dataset.rendus ?? 0);
