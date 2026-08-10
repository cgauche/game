// @vitest-environment jsdom
/**
 * FLAQUES DE LAMPE de l'écran de jeu volumique (#1245, L1) — quatre étages, tous nécessaires :
 *
 *  1. la DÉCISION (`stagePointLights.ts`) : ce qu'une source de lumière de la scène écrit sur une lampe
 *     (position monde, portée = rayon RAW, intensité qui COMPLÈTE le palier d'ambiance), et sur QUEL
 *     slot du pool — une source garde le sien tant qu'elle vit ;
 *  2. la MATIÈRE : ce que three fait de `decay = 0` et de `distance` — sa contribution est constante
 *     puis coupée EXACTEMENT à la portée (mesuré sur ses propres chunks de shader), et le COMPTE de
 *     lampes ponctuelles entre dans sa clé de cache de programme (d'où le pool fixe) ;
 *  3. le PROFIL : la part d'albédo qu'une flaque rend au sol, épinglée point par point, et la garde de
 *     SATURATION — three additionne les contributions sans tone mapping, donc la luminance du sol des
 *     scènes livrées ne doit dépasser 1 à aucune heure ;
 *  4. le MONTAGE réel : le compte de lampes ne bouge d'un cran ni à l'heure ni à la scène, aucune
 *     n'est jamais rendue invisible, l'écran porte la trace lisible de ses flaques (`data-lampes`), et
 *     le nombre d'ÉCRITURES sur le pool est celui d'une passe — jamais une par frame de caméra.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene, heightAt, sceneMetresPerTile, type Scene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import { sceneLightSources } from '../../state/visionState';
import { ambientScalar, mapLights, type LightSource } from '../../state/vision';
import { ambianceLuminance } from '../catalog/ambiance';
import { lightLevels } from '../../data';
import { areneCampaign } from '../../scenes/campaign';
import { IsoStage } from '../IsoStage';
import type { Dims } from '../../geometry/iso';
import { GameStage3D, setStageRendererFactory, type StageRenderer } from './GameStage3D';
import {
  applyPointLights,
  createPointLightPool,
  extinctionDe,
  flaqueLuminance,
  flaquePart,
  pointLightWrites,
  FLAME_INTENSITY,
  FLAME_LIFT_M,
  FOYER_NUIT_CIBLE,
  POINT_LIGHT_BUDGET,
  type PointLightSlots,
} from './stagePointLights';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MIDI = 12 * 60;
const NUIT = 23 * 60;

/** Scène d'extérieur portant `n` braséros (`props.json` : rayon 4 cases) à des cases distinctes. */
function avecBraseros(n: number): Scene {
  const scene = emptyScene(10, 10);
  scene.ambiance = 'exterieur';
  scene.entities = Array.from({ length: n }, (_, i) => ({
    id: `b${i}`, kind: 'prop', pos: { x: 1 + i, y: 2 }, ref: 'brasero',
  })) as unknown as Scene['entities'];
  return scene;
}

const source = (over: Partial<LightSource> = {}): LightSource => ({ pos: { x: 3, y: 4 }, radiusTiles: 4, ...over });

/** Les slots ALLUMÉS d'une table, dans l'ordre des slots. */
const allumés = (slots: PointLightSlots): { slot: number; srcId?: string }[] =>
  slots.map((w, slot) => ({ slot, w })).filter((s) => s.w && s.w.intensity > 0).map((s) => ({ slot: s.slot, srcId: s.w!.srcId }));

// ── 1. DÉCISION ─────────────────────────────────────────────────────────────────────────────────

describe('stagePointLights — le POOL est fixe, seules les intensités bougent', () => {
  it('une lampe du pool naît éteinte, VISIBLE, sans ombre et sans atténuation physique', () => {
    const pool = createPointLightPool();
    expect(pool.length).toBe(POINT_LIGHT_BUDGET);
    for (const l of pool) {
      expect([l.isPointLight, l.intensity, l.visible, l.castShadow, l.decay]).toEqual([true, 0, true, false, 0]);
    }
  });

  it('le COMPTE ne bouge pour aucun nombre de sources — les lampes en trop retombent à 0', () => {
    const pool = createPointLightPool();
    const opts = { scene: avecBraseros(0), mpt: 2, ambianceLum: 0 };
    for (const n of [0, 1, 3, POINT_LIGHT_BUDGET, POINT_LIGHT_BUDGET + 18]) {
      const sources = Array.from({ length: n }, (_, i) => source({ pos: { x: i % 9, y: 1 }, radiusTiles: 1 + i }));
      applyPointLights(pool, pointLightWrites(sources, opts));
      expect([n, pool.length]).toEqual([n, POINT_LIGHT_BUDGET]);
      const allumées = pool.filter((l) => l.intensity > 0).length;
      expect([n, allumées]).toEqual([n, Math.min(n, POINT_LIGHT_BUDGET)]);
    }
  });

  it('`visible` n’est JAMAIS écrit (l’écrire retirerait la lampe de la passe, donc ferait varier le compte)', () => {
    const pool = createPointLightPool();
    for (const l of pool) {
      Object.defineProperty(l, 'visible', {
        configurable: true,
        get: () => true,
        set: () => { throw new Error('`visible` écrit : le compte de lampes de la clé de programme bougerait'); },
      });
    }
    const opts = { scene: avecBraseros(0), mpt: 2, ambianceLum: 0 };
    expect(() => applyPointLights(pool, pointLightWrites([source()], opts))).not.toThrow();
    expect(() => applyPointLights(pool, [])).not.toThrow();
  });
});

describe('stagePointLights — ce qu’une flaque écrit : sa place, sa portée, son intensité', () => {
  const scene = avecBraseros(0);
  const opts = { scene, mpt: 2, ambianceLum: 0 };

  it('la portée est le rayon RAW de la source, converti à l’échelle de la carte', () => {
    expect(pointLightWrites([source({ radiusTiles: 4 })], opts)[0]!.distance).toBe(4 * 2);
    expect(pointLightWrites([source({ radiusTiles: 10 })], { ...opts, mpt: 3 })[0]!.distance).toBe(10 * 3);
  });

  it('la lampe se pose sur la case de sa source, à SON étage, une flamme au-dessus du sol', () => {
    const w = pointLightWrites([source({ pos: { x: 3, y: 4 }, z: 0 })], opts)[0]!;
    expect([w.x, w.z]).toEqual([3 * 2, 4 * 2]);
    expect(w.y).toBeCloseTo(heightAt(scene, 3, 4, 0) + FLAME_LIFT_M, 9);
    // Un étage plus haut : la lampe monte avec le sol de son étage (le halo mécanique y est déjà, #1245 L0).
    const étage = pointLightWrites([source({ pos: { x: 3, y: 4 }, z: 1 })], opts)[0]!;
    expect(étage.y).toBeCloseTo(heightAt(scene, 3, 4, 1) + FLAME_LIFT_M, 9);
  });

  it('la flaque COMPLÈTE le palier : nulle en plein jour, pleine en ténèbres — sans porte par nom', () => {
    const intensité = (ambianceLum: number) => pointLightWrites([source()], { ...opts, ambianceLum })[0]!.intensity;
    expect(intensité(1)).toBe(0); // `jour` : `ambianceLuminance(1)` vaut 1, il ne reste rien à allumer
    expect(intensité(0)).toBeCloseTo(FLAME_INTENSITY * Math.PI, 9);
    // Palier `nuit` RÉEL (le plancher mesuré : `ambianceLuminance(0,18)`), pas le 0,18 du palier brut.
    expect(ambianceLuminance(0.18)).toBeCloseTo(0.3276, 4);
    expect(intensité(ambianceLuminance(0.18))).toBeCloseTo(FLAME_INTENSITY * Math.PI * (1 - 0.3276), 4);
  });

  it('chaque écriture garde l’id de son PORTEUR (la couture par laquelle une lampe suivra son sujet)', () => {
    const slots = pointLightWrites([source({ srcId: 'b0' }), source({ srcId: undefined })], opts);
    expect(slots.slice(0, 2).map((w) => w!.srcId)).toEqual(['b0', undefined]);
  });
});

describe('stagePointLights — le SLOT d’une source est STABLE (une lampe ne saute pas de sujet)', () => {
  const opts = { scene: avecBraseros(0), mpt: 2, ambianceLum: 0 };
  const src = (id: string, x: number, carried = false) => source({ srcId: id, pos: { x, y: 1 }, carried });

  it('l’ordre de la liste ne décide plus du slot : une source GARDE le sien quand la liste bouge', () => {
    const f1 = pointLightWrites([src('a', 1), src('b', 2), src('c', 3)], opts);
    expect(allumés(f1)).toEqual([{ slot: 0, srcId: 'a' }, { slot: 1, srcId: 'b' }, { slot: 2, srcId: 'c' }]);
    // Liste renversée (et un rayon plus large en tête) : chacun reste sur SON slot.
    const f2 = pointLightWrites([src('c', 3), src('b', 2), src('a', 1)], { ...opts, prev: f1 });
    expect(allumés(f2)).toEqual([{ slot: 0, srcId: 'a' }, { slot: 1, srcId: 'b' }, { slot: 2, srcId: 'c' }]);
  });

  it('une source qui MEURT libère son slot sans déplacer les autres — la nouvelle prend le trou', () => {
    const f1 = pointLightWrites([src('a', 1), src('b', 2), src('c', 3)], opts);
    const f2 = pointLightWrites([src('a', 1), src('c', 3)], { ...opts, prev: f1 });
    expect(f2[1]).toBeNull(); // le slot de « b » s'éteint sur place
    expect(allumés(f2)).toEqual([{ slot: 0, srcId: 'a' }, { slot: 2, srcId: 'c' }]);
    const f3 = pointLightWrites([src('a', 1), src('c', 3), src('d', 4)], { ...opts, prev: f2 });
    expect(allumés(f3)).toEqual([{ slot: 0, srcId: 'a' }, { slot: 1, srcId: 'd' }, { slot: 2, srcId: 'c' }]);
  });

  it('la source qui BOUGE garde son slot : seule sa position change', () => {
    const f1 = pointLightWrites([src('a', 1, true), src('b', 2)], opts);
    const slotA = f1.findIndex((w) => w?.srcId === 'a');
    const f2 = pointLightWrites([src('a', 7, true), src('b', 2)], { ...opts, prev: f1 });
    expect(f2.findIndex((w) => w?.srcId === 'a')).toBe(slotA);
    expect(f2[slotA]!.x).toBe(7 * 2);
  });

  it('budget SATURÉ : les sources POSÉES restent allumées, ce sont les PORTÉES qui débordent', () => {
    // 13 sources pour 12 lampes : 12 braséros posés (rayon 4) + une lanterne portée de rayon 10.
    const posées = Array.from({ length: POINT_LIGHT_BUDGET }, (_, i) => src(`b${i}`, i));
    const lanterne = source({ srcId: 'h1', pos: { x: 5, y: 5 }, radiusTiles: 10, carried: true });
    const slots = pointLightWrites([lanterne, ...posées], opts);
    expect(allumés(slots).map((s) => s.srcId).sort()).toEqual(posées.map((s) => s.srcId).sort());
    expect(slots.some((w) => w?.srcId === 'h1')).toBe(false);
  });

  it('sous le budget, la portée s’allume comme les autres (la priorité ne l’éteint pas)', () => {
    const slots = pointLightWrites([source({ srcId: 'h1', carried: true }), src('b0', 0)], opts);
    expect(allumés(slots)).toEqual([{ slot: 0, srcId: 'b0' }, { slot: 1, srcId: 'h1' }]);
  });
});

// ── 2. MATIÈRE (three) ──────────────────────────────────────────────────────────────────────────

describe('Ce que three fait de `decay = 0` et de `distance` — mesuré sur ses chunks', () => {
  const chunk = THREE.ShaderChunk.lights_pars_begin.replace(/\s+/g, ' ');

  it('sans décroissance, la contribution est CONSTANTE… et coupée exactement à la portée', () => {
    // `1 / max(pow(d, 0), 0.01)` = 1 partout : aucune atténuation physique (la mécanique du jeu dégrade
    // linéairement, pas en 1/d² — `state/vision.ts`).
    expect(chunk).toContain('float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );');
    // …puis la fenêtre de coupure, qui vaut 0 dès `d = cutoffDistance` : rien au-delà du rayon RAW.
    expect(chunk).toContain('distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );');
    const coupure = (d: number, D: number) => Math.pow(Math.min(1, Math.max(0, 1 - Math.pow(d / D, 4))), 2);
    expect(coupure(8, 8)).toBe(0); // au rayon : éteint
    expect(coupure(7.99, 8)).toBeGreaterThan(0); // juste avant : encore quelque chose
    expect(coupure(9, 8)).toBe(0); // au-delà : rien
  });

  it('l’intensité écrite se relit en part d’albédo par la MÊME définition que `flaquePart`', () => {
    // Chaîne mesurée : `uniforms.color = light.color × light.intensity` (WebGLLights, aucun autre
    // facteur d'échelle), puis `irradiance = dotNL × lightColor` et `BRDF_Lambert = albédo / π`.
    const D = 8, ext = 0.5;
    const w = pointLightWrites([source({ radiusTiles: 4 })], { scene: avecBraseros(0), mpt: 2, ambianceLum: 1 - ext })[0]!;
    const parLeShader = (dM: number) => {
      const L = Math.hypot(dM, FLAME_LIFT_M);
      const coupure = Math.pow(Math.min(1, Math.max(0, 1 - Math.pow(L / D, 4))), 2);
      return (w.intensity / Math.PI) * (FLAME_LIFT_M / L) * coupure;
    };
    for (const d of [0, 1, 3, 6]) expect(parLeShader(d)).toBeCloseTo(flaquePart(d, D, ext), 12);
  });
});

// ── 3. PROFIL & SATURATION ──────────────────────────────────────────────────────────────────────

describe('Le PROFIL d’une flaque — épinglé, et calé sous la saturation', () => {
  const AMB_NUIT = ambianceLuminance(0.18);
  const D = 8; // brasero : 4 cases × 2 m

  it('l’intensité est CALÉE : le foyer d’une flaque culmine à la cible de nuit, jamais à 1', () => {
    expect(FLAME_INTENSITY).toBeCloseTo(0.7769, 4);
    expect(flaqueLuminance(AMB_NUIT, 0, D)).toBeCloseTo(FOYER_NUIT_CIBLE, 3);
    expect(flaqueLuminance(AMB_NUIT, 0, D)).toBeLessThan(1);
  });

  it('profil au sol de nuit (part d’albédo AJOUTÉE), mètre par mètre', () => {
    const ext = extinctionDe(AMB_NUIT);
    const profil = [0, 1, 2, 4, 6, 7.9, 8, 9].map((d) => +flaquePart(d, D, ext).toFixed(4));
    expect(profil).toEqual([0.5221, 0.3687, 0.2308, 0.1095, 0.0381, 0, 0, 0]);
  });

  it('AUCUN palier ne sature : le foyer d’UNE flaque reste sous 1 aux cinq paliers de `lightLevels.json`', () => {
    const mesuré = lightLevels.map((l) => [l.id, +flaqueLuminance(ambianceLuminance(l.scalar), 0, D).toFixed(4)]);
    expect(mesuré).toEqual([['jour', 1], ['couvert', 0.9542], ['crepuscule', 0.8992], ['nuit', 0.8497], ['tenebres', 0.8168]]);
  });

  it('SCÈNES LIVRÉES : la luminance du sol ne dépasse 1 à aucune heure, recouvrements compris', () => {
    let pire = 0;
    let où = '';
    let recouvrements = 0;
    for (const scene of areneCampaign.scenes) {
      const src = mapLights(scene);
      if (!src.length) continue;
      const mpt = sceneMetresPerTile(scene);
      for (let h = 0; h < 24; h++) {
        const amb = ambianceLuminance(ambientScalar(scene, h * 60, null));
        const ext = extinctionDe(amb);
        if (ext === 0) continue; // plein jour : aucune flaque n'est allumée, le sol est à l'ambiance seule
        // Échantillonnage du sol au demi-mètre, dans l'emprise des flaques (ailleurs, rien n'est ajouté).
        for (const s of src) {
          const R = s.radiusTiles * mpt;
          for (let dy = -R; dy <= R; dy += 0.5)
            for (let dx = -R; dx <= R; dx += 0.5) {
              const xM = s.pos.x * mpt + dx;
              const yM = s.pos.y * mpt + dy;
              if (xM < 0 || yM < 0 || xM > scene.dimensions.w * mpt || yM > scene.dimensions.h * mpt) continue;
              let tot = amb;
              let n = 0;
              for (const o of src) {
                const p = flaquePart(Math.hypot(xM - o.pos.x * mpt, yM - o.pos.y * mpt), o.radiusTiles * mpt, ext);
                tot += p;
                if (p > 0) n++;
              }
              if (n > 1) recouvrements++;
              if (tot > pire) { pire = tot; où = `${scene.id} h${h} (${xM},${yM})`; }
            }
        }
      }
    }
    // Des flaques SE RECOUVRENT bel et bien dans les scènes livrées (deux braséros à deux cases) : c'est
    // la SOMME qui doit tenir, pas leur séparation.
    expect(recouvrements).toBeGreaterThan(0);
    expect([où, +pire.toFixed(4)]).toEqual(['arene-zone4 h0 (26,32)', 0.9592]);
    expect(pire).toBeLessThan(1);
  });
});

// ── 4. MONTAGE RÉEL ─────────────────────────────────────────────────────────────────────────────

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
}

afterEach(() => {
  démonter();
  setStageBackend('affine');
});

/** Monte l'écran de JEU (store → `IsoStage` → voie volumique) sur `scene` à l'heure `gameTime`. */
function canevas(scene: Scene, gameTime: number): HTMLCanvasElement {
  useGame.setState({
    scene, mode: 'exploration', partyPos: { x: 5, y: 5 }, party: [], battle: null, dialogue: null,
    flags: {}, gameTime, lightLevel: null,
  });
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  setStageBackend('webgl');
  act(() => root!.render(<IsoStage />));
  return hôte.querySelector('canvas.iso-stage') as HTMLCanvasElement;
}

describe('L’écran de jeu — les flaques de la scène, allumées par la nuit seule', () => {
  it('DEUX braséros de nuit : deux flaques allumées sur le budget monté', () => {
    expect(canevas(avecBraseros(2), NUIT).dataset.lampes).toBe(`2/${POINT_LIGHT_BUDGET}`);
  });

  it('les MÊMES braséros à midi : aucune flaque allumée (le budget, lui, ne bouge pas)', () => {
    expect(canevas(avecBraseros(2), MIDI).dataset.lampes).toBe(`0/${POINT_LIGHT_BUDGET}`);
  });

  it('une scène SANS source n’allume rien, de nuit comme de jour', () => {
    expect(canevas(avecBraseros(0), NUIT).dataset.lampes).toBe(`0/${POINT_LIGHT_BUDGET}`);
  });

  it('les sources montées sont celles du champ MÉCANIQUE (même liste, mêmes rayons)', () => {
    const scene = avecBraseros(3);
    const sources = sceneLightSources({ scene, battle: null, party: [], partyPos: { x: 5, y: 5 } });
    expect(sources.map((s) => s.srcId)).toEqual(['b0', 'b1', 'b2']);
    expect(canevas(scene, NUIT).dataset.lampes).toBe(`3/${POINT_LIGHT_BUDGET}`);
  });
});

/** Ce que le banc retient de chaque frame dessinée : la scène three montée à cet instant. */
let scènes: THREE.Scene[] = [];

class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(scene: THREE.Scene): void { scènes.push(scene); }
}

const TAILLE = { w: 800, h: 600 };
const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });
const props = (scene: Scene, gameTime: number) => ({
  scene,
  dims: dimsDe(scene),
  mpt: sceneMetresPerTile(scene),
  cam: { x: 0, y: 0 },
  zoom: 1,
  tintAt: () => 1,
  keepEl: () => true,
  els: { tokens: [], props: [] },
  actors: [],
  gameTime,
  lightLevel: null,
  lights: sceneLightSources({ scene, battle: null, party: [], partyPos: { x: 5, y: 5 } }),
});

describe('Le pool MONTÉ — un compte que rien ne fait varier (la clé de cache de three)', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
    setStageRendererFactory(() => new BancRenderer());
  });
  afterAll(() => setStageRendererFactory(null));

  /** Les lampes ponctuelles de la DERNIÈRE frame dessinée. */
  function lampesDeLaFrame(): THREE.PointLight[] {
    const scene = scènes[scènes.length - 1];
    const out: THREE.PointLight[] = [];
    scene.traverse((o) => { if ((o as THREE.PointLight).isPointLight) out.push(o as THREE.PointLight); });
    return out;
  }

  function monter(scene: Scene, gameTime: number): void {
    scènes = [];
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    act(() => root!.render(<GameStage3D {...props(scene, gameTime)} />));
  }

  it('même compte de lampes de nuit et à midi, avec ou sans source — et toutes VISIBLES', () => {
    for (const [scene, t] of [[avecBraseros(2), NUIT], [avecBraseros(2), MIDI], [avecBraseros(0), NUIT]] as const) {
      monter(scene, t);
      const lampes = lampesDeLaFrame();
      expect(lampes.length).toBe(POINT_LIGHT_BUDGET);
      expect(lampes.every((l) => l.visible)).toBe(true);
      expect(lampes.every((l) => l.decay === 0 && !l.castShadow)).toBe(true);
      démonter();
    }
  });

  it('de nuit, DEUX lampes sont allumées, posées sur la case de leur brasero et coupées à son rayon', () => {
    const scene = avecBraseros(2);
    const mpt = sceneMetresPerTile(scene);
    monter(scene, NUIT);
    const allumées = lampesDeLaFrame().filter((l) => l.intensity > 0);
    expect(allumées.length).toBe(2);
    expect(allumées.map((l) => [l.position.x, l.position.z]).sort()).toEqual([[1 * mpt, 2 * mpt], [2 * mpt, 2 * mpt]].sort());
    expect(allumées.every((l) => l.distance === 4 * mpt)).toBe(true); // brasero : 4 cases (props.json)
  });

  it('…et à midi, les mêmes lampes sont là, toutes à intensité NULLE', () => {
    monter(avecBraseros(2), MIDI);
    const lampes = lampesDeLaFrame();
    expect(lampes.length).toBe(POINT_LIGHT_BUDGET);
    expect(lampes.filter((l) => l.intensity > 0).length).toBe(0);
  });
});

describe('Le pool ÉCRIT — une passe par changement de lumière, aucune par frame de caméra', () => {
  /** Compte TOUTE écriture d'intensité sur une lampe ponctuelle, construction comprise. */
  let écritures = 0;
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
    setStageRendererFactory(() => new BancRenderer());
    Object.defineProperty(THREE.PointLight.prototype, 'intensity', {
      configurable: true,
      get(this: { __i?: number }) { return this.__i ?? 0; },
      set(this: { __i?: number }, v: number) { écritures++; this.__i = v; },
    });
  });
  afterAll(() => {
    setStageRendererFactory(null);
    delete (THREE.PointLight.prototype as unknown as Record<string, unknown>).intensity;
  });

  it('montage puis rendus : la caméra n’écrit RIEN, l’heure écrit UNE passe, la même heure rien', () => {
    const scene = avecBraseros(2);
    const p = props(scene, NUIT);
    scènes = [];
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);

    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} />));
    // 12 constructions de lampe (le pool) + 12 écritures de la première passe.
    expect(écritures).toBe(2 * POINT_LIGHT_BUDGET);

    // Rendus de CAMÉRA : ni la translation ni le zoom ne touchent la lumière.
    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} cam={{ x: 40, y: 12 }} zoom={1.5} />));
    act(() => root!.render(<GameStage3D {...p} cam={{ x: 80, y: 24 }} zoom={2} />));
    expect(écritures).toBe(0);

    // Changement d'HEURE : une seule passe sur le pool (12 lampes), jamais un remontage.
    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} gameTime={MIDI} />));
    expect(écritures).toBe(POINT_LIGHT_BUDGET);

    // La MÊME heure re-rendue : rien à réécrire.
    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} gameTime={MIDI} />));
    expect(écritures).toBe(0);
  });

  it('le slot d’une source SURVIT au changement d’heure (la table se relit, elle ne se rebat pas)', () => {
    const scene = avecBraseros(3);
    const p = props(scene, NUIT);
    scènes = [];
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    act(() => root!.render(<GameStage3D {...p} />));
    const posesDeNuit = () => {
      const s = scènes[scènes.length - 1];
      const out: [number, number][] = [];
      s.traverse((o) => { if ((o as THREE.PointLight).isPointLight) out.push([(o as THREE.PointLight).position.x, (o as THREE.PointLight).position.z]); });
      return out;
    };
    const avant = posesDeNuit();
    act(() => root!.render(<GameStage3D {...p} gameTime={MIDI} />));
    expect(posesDeNuit()).toEqual(avant); // chaque lampe est restée sur SA case, seule l'intensité est tombée
  });
});
