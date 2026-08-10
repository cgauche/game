// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Vector3, type OrthographicCamera, type PerspectiveCamera } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { Dims } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { heightAt, isWalkable, sceneMetresPerTile, type Scene } from '../../state/scene';
import { walkNeighbors, type Pt } from '../../state/path';
import { useGame } from '../../state/store';
import { scenario as diligence } from '../../scenes/test-scenarios/diligence';
import { scenario as pont } from '../../scenes/test-scenarios/pont-vitrine';
import { scenario as siege } from '../../scenes/test-scenarios/siege-explore';
import { affineCamera, projectToScreen } from '../backends/webgl/cameras';
import { poseFromDims, screenToWorldAtLift } from './projection';
import { stagePointAt, viewBoxPointAt } from './stageCam';
import { stage3dFraming } from './stage3dCamera';
import { useStagePointer, type StagePointer } from './useStagePointer';

/**
 * PARITÉ DU PICKING DE TUILE ENTRE LES DEUX VOIES (#1176, lot P2-3).
 *
 * Le pointeur n'a qu'un chemin : il inverse la projection du STAGE (`stage/projection.ts` +
 * `stage/stageCam.ts`). Ce que cette garde mesure, c'est que ce chemin unique désigne la case que la
 * voie VOLUMIQUE dessine sous le pixel. Les deux côtés de l'égalité sont donc calculés par des
 * projections DIFFÉRENTES : à droite le hook complet (`onPointerMove` → `hover`) ; à gauche la caméra
 * three elle-même (`stage3dFraming` → `affineCamera`), inversée ici par résolution du système affine
 * qu'elle applique, à chacune des hauteurs de relief de la carte. La RÈGLE, elle, est la même des deux
 * côtés — celle du rendu : parmi les surfaces marchables dessinées sous le pixel, LA PLUS HAUTE gagne,
 * c'est celle qu'on voit (cf. `walkableAtScreen`).
 *
 * L'échantillonnage couvre ce que le relief a de piégeux : rampes et tablier du pont, les DEUX étages
 * de `la-diligence` (dont les 8 marches qui étaient injouables à la souris), les remparts du siège, et
 * les cases au bord du vide. Chaque case est visée en son centre, puis à 0,35 px du bord de son
 * losange — un demi-pixel d'écart entre les deux voies y change de case.
 *
 * L'état de caméra n'est pas neutre exprès (décalage manuel, zoom, cadre plus large que le viewBox) :
 * les deux étages de `stageCam` — recouvrement `slice` et caméra du groupe — doivent s'inverser tous
 * les deux.
 */
const CANVAS = { w: 1600, h: 900 };
const CAM = { x: 137, y: -62 };
const ZOOM = 1.3;
/** Retrait depuis le bord du losange, en pixels d'écran. Un demi-pixel de décalage le franchit. */
const AU_BORD = 0.35;
/** Écart LATÉRAL de l'échantillon de bord : il quitte la frontière exacte sans quitter la case. */
const DE_COTE = 0.17;

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

type Camera = OrthographicCamera | PerspectiveCamera;

/** La caméra VOLUMIQUE cadrée depuis l'état de stage de cette garde. */
function cameraVolumique(dims: Dims, mpt: number): Camera {
  const f = stage3dFraming({ dims, mpt, cam: CAM, zoom: ZOOM, canvas: CANVAS });
  return affineCamera(f.kind, f.yawDeg, mpt, f.viewport, {
    target: new Vector3(f.centre.x, f.centre.y, f.centre.z),
  }).camera;
}

/** Pixel de l'élément où la voie VOLUMIQUE pose le sol d'une case, à la hauteur métrique `hM`. */
function pixelVolumique(camera: Camera, mpt: number, x: number, y: number, hM: number): { sx: number; sy: number } {
  return projectToScreen(camera, new Vector3(x * mpt, hM, y * mpt), CANVAS);
}

/** Inverse de la projection volumique à hauteur FIXE : le point de grille CONTINU dessiné sous le
 *  pixel. La projection y est affine en (x,y) — deux vecteurs de base suffisent à la retourner, et rien
 *  de l'affine du stage n'entre dans ce calcul. */
function grilleVolumique(camera: Camera, mpt: number, p: { sx: number; sy: number }, hM: number): { x: number; y: number } {
  const o = pixelVolumique(camera, mpt, 0, 0, hM);
  const ex = pixelVolumique(camera, mpt, 1, 0, hM);
  const ey = pixelVolumique(camera, mpt, 0, 1, hM);
  const a = ex.sx - o.sx, b = ey.sx - o.sx;
  const c = ex.sy - o.sy, d = ey.sy - o.sy;
  const det = a * d - b * c;
  const u = p.sx - o.sx, v = p.sy - o.sy;
  return { x: (u * d - v * b) / det, y: (a * v - c * u) / det };
}

/** Hauteurs métriques DISTINCTES auxquelles une case de cet étage peut être dessinée, décroissantes. */
function hauteurs(scene: Scene, z: number): number[] {
  const hs = new Set<number>([0]);
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) if (isWalkable(scene, x, y, z)) hs.add(heightAt(scene, x, y, z));
  }
  return [...hs].sort((p, q) => q - p);
}

/** Case MARCHABLE que la voie volumique dessine sous le pixel — la plus HAUTE gagne, c'est celle qu'on
 *  voit. `null` si aucune surface de cet étage n'y est dessinée. */
function caseVueVolumique(scene: Scene, camera: Camera, mpt: number, z: number, p: { sx: number; sy: number }): Pt | null {
  const { w, h } = scene.dimensions;
  for (const hM of hauteurs(scene, z)) {
    const g = grilleVolumique(camera, mpt, p, hM);
    const x = Math.round(g.x), y = Math.round(g.y);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    if (!isWalkable(scene, x, y, z)) continue;
    if (heightAt(scene, x, y, z) !== hM) continue; // cette case n'est pas dessinée à cette hauteur
    return z ? { x, y, z } : { x, y };
  }
  return null;
}

/** Élément de stage MESURÉ (cadre `CANVAS` au coin (0,0)) : le picking inverse une GÉOMÉTRIE
 *  d'élément, pas un CTM de SVG — la voie volumique peint sur un canevas, qui n'en a pas. */
function stageEl(): SVGSVGElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: CANVAS.w, height: CANVAS.h }) as DOMRect,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  } as unknown as SVGSVGElement;
}

function moveEvent(sx: number, sy: number) {
  return { button: 0, clientX: sx, clientY: sy, pointerId: 1, currentTarget: { style: {} } } as unknown as React.PointerEvent;
}

let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
});

/** Monte le pointeur sur une scène, à l'étage `activeZ`, et rend « viser un pixel → la case survolée ». */
function viseur(scene: Scene, activeZ: number, partyPos: Pt): (sx: number, sy: number) => Pt | null {
  const dims = dimsDe(scene);
  useGame.setState({ scene, mode: 'exploration', partyPos, party: [], battle: null, dialogue: null });
  let pointer: StagePointer | undefined;
  const Probe = () => {
    const svgRef = useRef(stageEl());
    const camRef = useRef(CAM);
    pointer = useStagePointer({
      svgRef, scene, dims, zoom: ZOOM, camRef, hoverTracking: false, partyLeader: undefined, activeZ,
    });
    return null;
  };
  const container = document.createElement('div');
  root = createRoot(container);
  act(() => root!.render(<Probe />));
  return (sx, sy) => {
    act(() => pointer!.handlers.onPointerMove(moveEvent(sx, sy)));
    return pointer!.hover;
  };
}

/** Cases marchables de l'étage, réparties, avec les SOULEVÉES d'abord (rampes, marches, tabliers,
 *  chemins de ronde) — c'est là que l'inversion à plat se trompait de case. */
function echantillon(scene: Scene, z: number, combien: number): Pt[] {
  const hautes: Pt[] = [], plates: Pt[] = [];
  const { w, h } = scene.dimensions;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isWalkable(scene, x, y, z)) continue;
      (metricToLift(heightAt(scene, x, y, z)) > 0 ? hautes : plates).push(z ? { x, y, z } : { x, y });
    }
  }
  const etaler = (l: Pt[]) => {
    const pas = Math.max(1, Math.floor(l.length / combien));
    return l.filter((_, i) => i % pas === 0).slice(0, combien);
  };
  return [...etaler(hautes), ...etaler(plates)];
}

/** Point de départ du groupe qui ne CHANGE PAS d'étage d'un pas : le pas inter-étages
 *  (`stepFromScreen`) a sa propre garde (`useStagePointer.test.tsx`) et n'a rien à faire ici. */
function posteDuGroupe(scene: Scene, z: number, defaut: Pt): Pt {
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (!isWalkable(scene, x, y, z)) continue;
      const p: Pt = z ? { x, y, z } : { x, y };
      if (!walkNeighbors(scene, p).some((n) => (n.z ?? 0) !== z)) return p;
    }
  }
  return defaut;
}

const CARTES: { nom: string; scene: Scene; etages: number[] }[] = [
  { nom: 'la-diligence', scene: diligence.scene as Scene, etages: [0, 1] },
  { nom: 'pont-vitrine', scene: pont.scene as Scene, etages: [0, 1] },
  { nom: 'siege-enceinte', scene: siege.scene as Scene, etages: [0] },
];

describe('Picking de TUILE — la case résolue est celle que la voie volumique dessine (#1176 P2-3)', () => {
  for (const carte of CARTES) {
    const dims = dimsDe(carte.scene);
    const mpt = sceneMetresPerTile(carte.scene);
    const camera = cameraVolumique(dims, mpt);
    for (const z of carte.etages) {
      const cases = echantillon(carte.scene, z, 8);
      if (cases.length < 4) continue;
      const poste = posteDuGroupe(carte.scene, z, cases[0]);

      it(`${carte.nom} — étage ${z} : le CENTRE de chaque case résout la case que le volumique y dessine`, () => {
        const vise = viseur(carte.scene, z, poste);
        const ecarts: string[] = [];
        for (const t of cases) {
          const p = pixelVolumique(camera, mpt, t.x, t.y, heightAt(carte.scene, t.x, t.y, z));
          const attendu = caseVueVolumique(carte.scene, camera, mpt, z, p);
          const vu = vise(p.sx, p.sy);
          if (vu?.x !== attendu?.x || vu?.y !== attendu?.y || (vu?.z ?? 0) !== (attendu?.z ?? 0)) {
            ecarts.push(`(${t.x},${t.y}) volumique=${attendu ? `${attendu.x},${attendu.y}` : 'rien'} pointeur=${vu ? `${vu.x},${vu.y}` : 'rien'}`);
          }
        }
        expect(ecarts).toEqual([]);
      });

      it(`${carte.nom} — étage ${z} : à 0,35 px du BORD du losange, les deux voies désignent encore la même case`, () => {
        const vise = viseur(carte.scene, z, poste);
        const ecarts: string[] = [];
        let vises = 0;
        for (const t of cases) {
          const hM = heightAt(carte.scene, t.x, t.y, z);
          const centre = pixelVolumique(camera, mpt, t.x, t.y, hM);
          for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
            const voisin = pixelVolumique(camera, mpt, t.x + d.x, t.y + d.y, hM);
            const demi = Math.hypot(voisin.sx - centre.sx, voisin.sy - centre.sy) / 2; // centre → bord partagé
            const k = (demi - AU_BORD) / (demi * 2);
            // …et DE CÔTÉ : un point rigoureusement sur la frontière d'une case ne départage rien (il
            // tombe sur le .5 d'un arrondi, que deux chaînes de flottants tranchent chacune pour soi —
            // cf. le test de frontière ci-dessous). L'échantillon s'en écarte, sans quitter la case.
            const ux = (voisin.sx - centre.sx) / (2 * demi), uy = (voisin.sy - centre.sy) / (2 * demi);
            const p = {
              sx: centre.sx + (voisin.sx - centre.sx) * k - uy * DE_COTE,
              sy: centre.sy + (voisin.sy - centre.sy) * k + ux * DE_COTE,
            };
            const attendu = caseVueVolumique(carte.scene, camera, mpt, z, p);
            const vu = vise(p.sx, p.sy);
            vises++;
            if (vu?.x !== attendu?.x || vu?.y !== attendu?.y || (vu?.z ?? 0) !== (attendu?.z ?? 0)) {
              ecarts.push(`(${t.x},${t.y})→(${t.x + d.x},${t.y + d.y}) volumique=${attendu ? `${attendu.x},${attendu.y}` : 'rien'} pointeur=${vu ? `${vu.x},${vu.y}` : 'rien'}`);
            }
          }
        }
        expect(vises).toBeGreaterThan(8); // la garde vise vraiment des bords, elle ne tourne pas à vide
        expect(ecarts).toEqual([]);
      });
    }
  }
});

/**
 * SUR LA FRONTIÈRE EXACTE de deux cases, il n'y a rien à départager : la coordonnée continue y vaut un
 * demi, et deux chaînes de flottants distinctes le tranchent chacune pour soi. Ce que cette garde
 * mesure, c'est qu'il ne reste QUE cela : les deux inversions rendent le MÊME point continu (à 1e-9
 * près), à chaque hauteur de relief — c'est la portée exacte de la réserve écrite au JSDoc de
 * `screenToTileAtLift`.
 */
describe('Frontière de deux cases — les deux inversions coïncident, seul l’arrondi du .5 les sépare', () => {
  const carte = CARTES[0];
  const dims = dimsDe(carte.scene);
  const mpt = sceneMetresPerTile(carte.scene);
  const camera = cameraVolumique(dims, mpt);
  const pose = poseFromDims(dims);

  it('la-diligence : le point continu du pointeur EST celui de la caméra volumique', () => {
    let pires = 0;
    let points = 0;
    for (const t of echantillon(carte.scene, 0, 8)) {
      const hM = heightAt(carte.scene, t.x, t.y, 0);
      const centre = pixelVolumique(camera, mpt, t.x, t.y, hM);
      for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const voisin = pixelVolumique(camera, mpt, t.x + d.x, t.y + d.y, hM);
        const p = { sx: (centre.sx + voisin.sx) / 2, sy: (centre.sy + voisin.sy) / 2 }; // LA frontière
        for (const h of hauteurs(carte.scene, 0)) {
          const a = grilleVolumique(camera, mpt, p, h);
          const b = screenToWorldAtLift(pose, stagePointAt(viewBoxPointAt({ sx: p.sx, sy: p.sy }, CANVAS), CAM, ZOOM), metricToLift(h));
          pires = Math.max(pires, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
          points++;
        }
      }
    }
    expect(points).toBeGreaterThan(50);
    expect(pires).toBeLessThan(1e-9);
  });
});
