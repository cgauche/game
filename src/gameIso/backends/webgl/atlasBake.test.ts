/**
 * Contrat du CUISEUR D'ATLAS (#1176, L2) : gouttière remplie par DUPLICATION des texels de bord (donc
 * aucune bavure de la frame voisine ni frange transparente), file CADENCÉE (jamais un burst, priorité
 * respectée), et cache LRU à budget d'octets qui n'évince jamais une planche épinglée.
 *
 * Le canevas est un MODÈLE DE PIXELS (le DOM n'existe pas en environnement node) : `drawImage` y
 * échantillonne réellement la source, la gouttière se lit donc pixel par pixel.
 */
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  atlasBytesEstimés,
  atlasCacheStats,
  atlasKey,
  bakeAtlas,
  bakeSliceCount,
  FRAMES_PAR_TRANCHE,
  clearAtlasCache,
  collapseAtlasKeys,
  enqueueBake,
  bakeQueueLength,
  PRIORITE_RECHAUFFAGE,
  PRIORITE_VUE_COURANTE,
  resetBakeQueue,
  setAtlasBudgetBytes,
  setAtlasPins,
  type BakeCanvas,
  type BakeCtx,
  type BakeImage,
} from './atlasBake';
import { ATLAS_GUTTER_PX } from './billboardMath';

/** Canevas-modèle : un pixel = un entier (0 = vide). */
class Toile implements BakeCanvas, BakeCtx {
  px: Int32Array;
  constructor(public width: number, public height: number) {
    this.px = new Int32Array(width * height);
  }
  getContext(): BakeCtx {
    return this;
  }
  at(x: number, y: number): number {
    return this.px[y * this.width + x];
  }
  drawImage(src: BakeImage, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
    const s = src as Toile;
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const u = Math.min(sw - 1, Math.floor((x * sw) / dw));
        const v = Math.min(sh - 1, Math.floor((y * sh) / dh));
        const X = dx + x;
        const Y = dy + y;
        if (X < 0 || Y < 0 || X >= this.width || Y >= this.height) continue;
        this.px[Y * this.width + X] = s.px[(sy + v) * s.width + (sx + u)];
      }
    }
  }
}

const BOX = { w: 120, h: 150 };
const PX = 10;
const COULEUR_BORD = (k: number) => 10 + k;
const COULEUR_COEUR = 99;

/** Frame k : entièrement à sa couleur de BORD, cœur à une autre — une gouttière qui ne dupliquerait
 *  pas le bord (mais une couleur au hasard, ou rien) se voit. */
function frameToile(k: number, w: number, h: number): Toile {
  const t = new Toile(w, h);
  t.px.fill(COULEUR_BORD(k));
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) t.px[y * w + x] = COULEUR_COEUR;
  return t;
}

/** Couche basse injectée : rasterisation instrumentée (compte + ordre) et canevas-modèle. */
function couches() {
  const appels: string[] = [];
  let planche: Toile | undefined;
  return {
    appels,
    planche: () => planche!,
    deps: {
      rasterize: (svg: string, box: { w: number; h: number }, pxHeight: number) => {
        appels.push(svg);
        const w = Math.max(1, Math.round(pxHeight * (box.w / box.h)));
        return Promise.resolve({ canvas: frameToile(Number(svg.slice(1)), w, pxHeight) as BakeImage });
      },
      makeCanvas: (w: number, h: number) => (planche = new Toile(w, h)),
    },
  };
}

const dessin = (k: number) => `F${k}`;

afterEach(() => {
  clearAtlasCache();
  setAtlasBudgetBytes(96 * 1024 * 1024);
  setAtlasPins([]);
  resetBakeQueue();
  vi.useRealTimers();
});

/** HYGIÈNE `isolate: false` : file et cache sont des SINGLETONS de module. Une cuisson laissée en
 *  file par un test s'exécuterait au milieu du fichier de suite suivant (et sur ses faux timers). */
afterAll(() => {
  expect(bakeQueueLength()).toBe(0);
});

describe('cuiseur d’atlas', () => {
  it('remplit la gouttière par duplication des texels de bord (4 côtés + coins)', async () => {
    const c = couches();
    const { layout } = await bakeAtlas(dessin, BOX, 2, PX, { deps: c.deps });
    const t = c.planche();
    const G = ATLAS_GUTTER_PX;
    for (let k = 0; k < layout.n; k++) {
      const r = layout.rects[k];
      const bord = COULEUR_BORD(k);
      expect(t.at(r.x, r.y)).toBe(bord); // contenu dessiné
      expect(t.at(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2))).toBe(COULEUR_COEUR);
      for (let g = 1; g <= G; g++) {
        expect([
          t.at(r.x - g, r.y + 3), // gauche
          t.at(r.x + r.w + g - 1, r.y + 3), // droite
          t.at(r.x + 3, r.y - g), // haut
          t.at(r.x + 3, r.y + r.h + g - 1), // bas
          t.at(r.x - g, r.y - g), // coin haut-gauche
          t.at(r.x + r.w + g - 1, r.y - g), // coin haut-droit
          t.at(r.x - g, r.y + r.h + g - 1), // coin bas-gauche
          t.at(r.x + r.w + g - 1, r.y + r.h + g - 1), // coin bas-droit
        ]).toEqual([bord, bord, bord, bord, bord, bord, bord, bord]);
      }
    }
  });

  it('aucune bavure : le voisinage d’une frame ne porte QUE sa propre couleur', async () => {
    const c = couches();
    const { layout } = await bakeAtlas(dessin, BOX, 2, PX, { deps: c.deps });
    const t = c.planche();
    const r1 = layout.rects[1];
    // Le pixel juste à gauche du contenu de la frame 1 est dans SA gouttière : couleur 1, jamais 0.
    expect(t.at(r1.x - 1, r1.y + 3)).toBe(COULEUR_BORD(1));
    expect(t.at(r1.x - 1, r1.y + 3)).not.toBe(COULEUR_BORD(0));
  });

  it('cadence : rien de synchrone, et au plus FRAMES_PAR_TRANCHE rasterisations par tranche', async () => {
    const c = couches();
    const tranches0 = bakeSliceCount();
    const p = bakeAtlas(dessin, BOX, 3, PX, { deps: c.deps });
    expect(c.appels.length).toBe(0); // aucune rasterisation hors file
    await p;
    const tranches = bakeSliceCount() - tranches0;
    expect(c.appels).toEqual(['F0', 'F1', 'F2']);
    expect(tranches).toBeGreaterThanOrEqual(3 / FRAMES_PAR_TRANCHE);
    expect(c.appels.length).toBeLessThanOrEqual(tranches * FRAMES_PAR_TRANCHE);
  });

  it('priorité : la vue courante passe devant le réchauffage déjà en file', async () => {
    vi.useFakeTimers();
    const c = couches();
    const tard = bakeAtlas((k) => `F${k}`, BOX, 2, PX, { deps: c.deps, priority: 0 });
    const urgent = bakeAtlas(() => 'F7', BOX, 1, PX, { deps: c.deps, priority: 100 });
    await vi.advanceTimersToNextTimerAsync();
    expect(c.appels).toEqual(['F7']);
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();
    expect(c.appels).toEqual(['F7', 'F0', 'F1']);
    await Promise.all([tard, urgent]);
  });

  it('cache : une clé ne cuit qu’une fois, et son poids est instrumenté', async () => {
    const c = couches();
    const make = () => bakeAtlas(dessin, BOX, 2, PX, { deps: c.deps });
    const a = await enqueueBake('k1', make);
    const b = await enqueueBake('k1', make);
    expect(b).toBe(a);
    expect(c.appels.length).toBe(2); // les 2 frames de l'UNIQUE cuisson
    expect(atlasCacheStats()).toEqual({ entries: 1, bytes: a.layout.texW * a.layout.texH * 4 });
  });

  it('priorité : une planche DÉJÀ en file, redemandée pour la vue courante, REMONTE', async () => {
    vi.useFakeTimers();
    const c = couches();
    // Deux réchauffages posés en priorité basse ; 'A' est en tête de file, mais ses frames SUIVANTES
    // repasseraient derrière 'B' si sa demande urgente ne relevait pas sa priorité.
    const a = enqueueBake('A', (p) => bakeAtlas((k) => `A${k}`, BOX, 2, PX, { deps: c.deps, priority: p }), PRIORITE_RECHAUFFAGE);
    const b = enqueueBake('B', (p) => bakeAtlas((k) => `B${k}`, BOX, 2, PX, { deps: c.deps, priority: p }), PRIORITE_RECHAUFFAGE);
    void enqueueBake('A', () => Promise.reject(new Error('jamais re-cuite')), PRIORITE_VUE_COURANTE);
    for (let i = 0; i < 4; i++) await vi.advanceTimersToNextTimerAsync();
    expect(c.appels).toEqual(['A0', 'A1', 'B0', 'B1']);
    await Promise.all([a, b]);
  });

  it('EN VOL : la planche pèse son estimation AVANT sa première frame, et le réel la confirme', async () => {
    const c = couches();
    const attendu = atlasBytesEstimés(BOX, 2, PX);

    const p = enqueueBake(
      'estimée',
      (prio) => bakeAtlas(dessin, BOX, 2, PX, { deps: c.deps, priority: prio }),
      PRIORITE_VUE_COURANTE,
      attendu,
    );

    // AVANT toute rasterisation : la planche connaît sa géométrie (n, palier, boîte), le stock la pèse
    // donc déjà. Sans cela, une rafale de cuissons ne pèse rien jusqu'à son service.
    expect(c.appels.length, 'PRÉMISSE : rien ne doit avoir rasterisé').toBe(0);
    expect(atlasCacheStats()).toEqual({ entries: 1, bytes: attendu });

    const cuite = await p;

    expect(cuite.bytes, 'l’estimation et le poids RÉEL doivent coïncider').toBe(attendu);
    expect(atlasCacheStats()).toEqual({ entries: 1, bytes: attendu });
  });

  it('ESTIMATION IMPOSSIBLE : une planche hors plafond pèse zéro et ne LÈVE PAS', async () => {
    // Palier démesuré : la cellule dépasse `RASTER_PX_MAX` — `bakeAtlas` refusera de cuire. Mais
    // l'estimation court SYNCHRONEMENT au site d'appel : y laisser filer l'erreur en ferait une
    // exception non gérée, là où le refus de cuisson est déjà traité par l'appelant (sujet sauté).
    expect(() => atlasBytesEstimés(BOX, 8, 4096)).not.toThrow();
    expect(atlasBytesEstimés(BOX, 8, 4096)).toBe(0);
    // …et la CUISSON, elle, refuse toujours — au même endroit qu'avant : dans sa promesse.
    const c = couches();
    await expect(bakeAtlas(dessin, BOX, 8, 4096, { deps: c.deps })).rejects.toThrow(/plafond de texture/);
    // Boîte dégénérée : même loi, aucune valeur non finie ne part au budget.
    expect(atlasBytesEstimés({ w: 120, h: 0 }, 2, PX)).toBe(0);
  });

  it('LRU : à budget dépassé, la moins récemment SERVIE saute — la re-servir la SAUVE', async () => {
    const c = couches();
    const make = () => bakeAtlas(dessin, BOX, 2, PX, { deps: c.deps });
    const un = await enqueueBake('a', make);
    await enqueueBake('b', make);
    await enqueueBake('c', make);
    expect(atlasCacheStats().entries).toBe(3);
    expect(c.appels.length).toBe(6); // 3 cuissons de 2 frames
    // AUCUNE épingle ici : c'est le RANG D'USAGE seul qui décide. 'a' est la plus ancienne, mais elle
    // est re-servie — sous une file d'attente FIFO, c'est elle qui sauterait, et 'b' survivrait.
    await enqueueBake('a', make);
    setAtlasBudgetBytes(un.bytes * 2); // budget pour DEUX planches : il en saute exactement une
    expect(atlasCacheStats()).toEqual({ entries: 2, bytes: un.bytes * 2 });
    // SURVIVANTS : 'a' (re-servie en dernier) et 'c' — resservies du cache, sans re-cuisson.
    await enqueueBake('a', make);
    await enqueueBake('c', make);
    expect(c.appels.length, 'une survivante a été re-cuite : l’ordre d’usage n’est pas tenu').toBe(6);
    // VICTIME : 'b', la moins récemment servie — la redemander la RE-CUIT (2 frames de plus).
    await enqueueBake('b', make);
    expect(c.appels.length).toBe(8);
  });

  it('une planche ÉPINGLÉE ne saute pas, même la moins récemment servie', async () => {
    const c = couches();
    const make = () => bakeAtlas(dessin, BOX, 2, PX, { deps: c.deps });
    const un = await enqueueBake('p', make);
    await enqueueBake('q', make);
    setAtlasPins(['p']); // 'p' est la plus ancienne ET la seule protégée
    setAtlasBudgetBytes(un.bytes); // budget pour UNE planche

    expect(atlasCacheStats()).toEqual({ entries: 1, bytes: un.bytes });
    await enqueueBake('p', make);
    expect(c.appels.length, 'l’épinglée a été évincée : le board monté perdrait sa planche').toBe(4);
    await enqueueBake('q', make);
    expect(c.appels.length, 'PRÉMISSE : la pression doit avoir mordu sur la NON épinglée').toBe(6);
  });

  it('effondrement : corpse et prone sont DEUX planches (la pose au sol se lit au rendu)', () => {
    const base = { signature: 'sig', clip: 'plan:dying', view: 'front' as const, mirror: false, pxHeight: 64, frames: 8 };
    const [corpse, prone] = collapseAtlasKeys(base);
    expect(corpse).not.toBe(prone);
    expect(corpse).toBe(atlasKey({ ...base, ground: 'corpse' }));
    expect(new Set([corpse, prone, atlasKey(base)]).size).toBe(3);
  });
});
