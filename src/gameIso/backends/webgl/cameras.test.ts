import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  DEPTH_MARGIN_M,
  affineCamera,
  affineScales,
  orthoDepthRange,
  povCamera,
  projectToScreen,
  rotYaw,
  type AffineKind,
} from './cameras';
import { LEVEL_H, TH, TW, tileCenter, type Dims, type Rot } from '../../../geometry/iso';
import { METRES_PER_LEVEL, metricToLift } from '../../../state/relief';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { sceneMetresPerTile } from '../../../state/scene';
import { DIR8_ORDER } from '../../../state/dir8';
import { VH, VW, makeCamera, project } from '../../pov/camera';
import { ISO_PX_PER_M, pxPerM } from './worldTris';

/**
 * LE test du lot : la caméra three doit rendre le MÊME pixel que la projection SVG de production, à
 * viewport et ancrage égaux. Toute divergence de pitch, d'échelle ou de sens de rotation s'y voit.
 * La fidélité n'est définie que sur les CRANS de production (0/90/180/270°) : un lacet libre n'a
 * aucune vérité SVG en face.
 */
const scene = buildScene(siegeSpec);
const mpt = sceneMetresPerTile(scene);
const VIEWPORT = { w: 1600, h: 1000 };
/** L'écart mesuré est 0,000000 px : la tolérance est celle du flottant, pas un « à peu près ». */
const TOL = 1e-6;

/** Grille d'échantillons (tuiles × hauteurs métriques) couvrant la scène-témoin. */
const SAMPLES: { x: number; y: number; h: number }[] = [];
for (const x of [0, 7, 14.5, 22, 29]) for (const y of [0, 11, 23.5, 34, 45]) for (const h of [0, 1.7, 4, 9.25]) SAMPLES.push({ x, y, h });

const worldOf = (s: { x: number; y: number; h: number }) => new Vector3(s.x * mpt, s.h, s.y * mpt);

function svgScreen(s: { x: number; y: number; h: number }, dims: Dims): { sx: number; sy: number } {
  const { cx, cy } = tileCenter(s.x, s.y, dims, metricToLift(s.h));
  return { sx: cx, sy: cy };
}

function dimsFor(kind: AffineKind, rot: Rot): Dims {
  const base = { w: scene.dimensions.w, h: scene.dimensions.h, rot };
  if (kind === 'edge') return { ...base, edge: true };
  if (kind === 'top') return { ...base, view: 'top' as const };
  return base;
}

/** Écart maximal (px) entre une caméra et la projection SVG, ancrés sur le MÊME point de référence. */
function deltaOf(camera: Parameters<typeof projectToScreen>[0], dims: Dims): number {
  const ref = SAMPLES[0];
  const refSvg = svgScreen(ref, dims);
  const refGl = projectToScreen(camera, worldOf(ref), VIEWPORT);
  let worst = 0;
  for (const s of SAMPLES) {
    const svg = svgScreen(s, dims);
    const gl = projectToScreen(camera, worldOf(s), VIEWPORT);
    worst = Math.max(
      worst,
      Math.abs(gl.sx - refGl.sx - (svg.sx - refSvg.sx)),
      Math.abs(gl.sy - refGl.sy - (svg.sy - refSvg.sy)),
    );
  }
  return worst;
}

function maxDelta(kind: AffineKind, rot: Rot): number {
  return deltaOf(affineCamera(kind, rotYaw(rot), mpt, VIEWPORT).camera, dimsFor(kind, rot));
}

describe('Caméras WebGL — coïncidence pixel avec la projection de production', () => {
  const rots: Rot[] = [0, 1, 2, 3];

  for (const kind of ['iso', 'edge'] as const)
    for (const rot of rots)
      it(`ortho ${kind} rot${rot} : à ${TOL} px de la projection SVG (x, y, hauteur)`, () => {
        expect(maxDelta(kind, rot)).toBeLessThanOrEqual(TOL);
      });

  it(`ortho top : à ${TOL} px de la projection SVG (regard vertical, hauteur sans effet écran)`, () => {
    expect(maxDelta('top', 0)).toBeLessThanOrEqual(TOL);
  });

  it(`perspective POV : à ${TOL} px de \`project\` (pov/camera.ts), 8 caps × 3 positions, en pixels ABSOLUS`, () => {
    let worst = 0;
    let comptes = 0;
    for (const pos of [{ x: 8, y: 40, z: 0 }, { x: 15, y: 22, z: 0 }, { x: 24, y: 8, z: 0 }]) {
      for (const facing of DIR8_ORDER) {
        const pose = makeCamera(scene, pos, facing);
        const camera = povCamera(scene, pos, facing, { w: VW, h: VH });
        for (const d of [2, 6, 15, 40]) {
          for (const lat of [-6, 0, 6]) {
            for (const z of [0, 1.7, 5]) {
              const gx = pos.x + pose.fwd.x * d + pose.right.x * lat;
              const gy = pos.y + pose.fwd.y * d + pose.right.y * lat;
              const P = { x: gx * mpt, y: gy * mpt, z };
              const ref = project(pose, P);
              if (ref.behind) continue;
              const gl = projectToScreen(camera, new Vector3(P.x, P.z, P.y), { w: VW, h: VH });
              worst = Math.max(worst, Math.abs(gl.sx - ref.sx), Math.abs(gl.sy - ref.sy));
              comptes++;
            }
          }
        }
      }
    }
    expect(comptes).toBeGreaterThan(500);
    expect(worst).toBeLessThanOrEqual(TOL);
  });
});

describe('ANISOTROPIE — elle vit DANS la caméra, jamais dans un post-traitement', () => {
  it('un `updateProjectionMatrix()` de plus ne change RIEN à la coïncidence pixel', () => {
    const dims = dimsFor('iso', 0);
    const { camera } = affineCamera('iso', rotYaw(0), mpt, VIEWPORT);
    expect(camera.stretch).not.toBe(1); // sinon la garde passerait sans anisotropie à préserver
    const avant = deltaOf(camera, dims);
    expect(avant).toBeLessThanOrEqual(TOL);
    camera.updateProjectionMatrix();
    expect(deltaOf(camera, dims)).toBe(avant);
    camera.updateProjectionMatrix();
    camera.updateProjectionMatrix();
    expect(deltaOf(camera, dims)).toBeLessThanOrEqual(TOL);
  });

  it('l’étirement est celui de `affineScales`, ré-appliqué à chaque reconstruction de la projection', () => {
    const { camera, stretch } = affineCamera('edge', rotYaw(2), mpt, VIEWPORT);
    expect(camera.stretch).toBe(stretch);
    const elements = [...camera.projectionMatrix.elements];
    camera.updateProjectionMatrix();
    expect([...camera.projectionMatrix.elements]).toEqual(elements);
  });
});

describe('PROFONDEUR — le buffer ne couvre que la scène', () => {
  it('near/far encadrent la sphère englobante, marge comprise', () => {
    expect(orthoDepthRange(120, 40)).toEqual({ near: 120 - 40 - DEPTH_MARGIN_M, far: 120 + 40 + DEPTH_MARGIN_M });
  });

  it('une caméra plus proche que le rayon garde un near strictement positif', () => {
    expect(orthoDepthRange(5, 40).near).toBeGreaterThan(0);
  });

  it('un rayon de scène resserre la caméra (fini le far à des milliers de mètres)', () => {
    const distance = 150;
    const radius = 60;
    const { camera } = affineCamera('iso', rotYaw(0), mpt, VIEWPORT, { distance, radius });
    expect(camera.near).toBe(distance - radius - DEPTH_MARGIN_M);
    expect(camera.far).toBe(distance + radius + DEPTH_MARGIN_M);
    expect(camera.far - camera.near).toBe(2 * (radius + DEPTH_MARGIN_M));
  });

  it('sans rayon fourni, la portée reste large (scène inconnue)', () => {
    const { camera } = affineCamera('iso', rotYaw(0), mpt, VIEWPORT);
    expect(camera.far).toBeGreaterThan(1000);
  });

  it('resserrer la profondeur ne bouge PAS le pixel', () => {
    const dims = dimsFor('iso', 0);
    const { camera } = affineCamera('iso', rotYaw(0), mpt, VIEWPORT, { distance: 150, radius: 60 });
    expect(deltaOf(camera, dims)).toBeLessThanOrEqual(TOL);
  });
});

describe('LACET LIBRE — les crans de production en sont les cas particuliers', () => {
  const heading = (yawDeg: number): number => {
    const d = affineCamera('iso', yawDeg, mpt, VIEWPORT).camera.getWorldDirection(new Vector3());
    return (Math.atan2(d.z, d.x) * 180) / Math.PI;
  };
  const ecart = (a: number, b: number): number => {
    let v = a - b;
    while (v > 180) v -= 360;
    while (v <= -180) v += 360;
    return v;
  };

  it('un cran vaut 90°', () => {
    expect(([0, 1, 2, 3] as Rot[]).map(rotYaw)).toEqual([0, 90, 180, 270]);
  });

  it('le lacet 90° donne EXACTEMENT la caméra du cran 1 (aucun résidu de trigonométrie)', () => {
    const cran = affineCamera('iso', rotYaw(1), mpt, VIEWPORT).camera;
    const libre = affineCamera('iso', 90, mpt, VIEWPORT).camera;
    expect([...libre.matrixWorld.elements]).toEqual([...cran.matrixWorld.elements]);
    expect([...libre.projectionMatrix.elements]).toEqual([...cran.projectionMatrix.elements]);
  });

  it('un lacet intermédiaire tourne vraiment la caméra, entre ses deux crans', () => {
    expect(Math.abs(ecart(heading(45), heading(0)))).toBeCloseTo(45, 6);
    expect(Math.abs(ecart(heading(90), heading(45)))).toBeCloseTo(45, 6);
    expect(Math.abs(ecart(heading(25), heading(0)))).toBeCloseTo(25, 6);
    expect(Math.abs(ecart(heading(65), heading(0)))).toBeCloseTo(65, 6);
  });

  it('le lacet ne touche NI le pitch NI les échelles (seule l’orientation tourne)', () => {
    const a = affineCamera('iso', 25, mpt, VIEWPORT);
    const b = affineCamera('iso', rotYaw(0), mpt, VIEWPORT);
    expect({ sx: a.sx, sy: a.sy, pitch: a.pitch, stretch: a.stretch }).toEqual({ sx: b.sx, sy: b.sy, pitch: b.pitch, stretch: b.stretch });
    expect(a.camera.getWorldDirection(new Vector3()).y).toBeCloseTo(b.camera.getWorldDirection(new Vector3()).y, 12);
  });

  it('un lacet négatif ou > 360° reste équivalent à son cran (modulo un tour)', () => {
    const ref = affineCamera('edge', rotYaw(3), mpt, VIEWPORT).camera;
    for (const yaw of [-90, 630]) {
      expect([...affineCamera('edge', yaw, mpt, VIEWPORT).camera.matrixWorld.elements]).toEqual([...ref.matrixWorld.elements]);
    }
  });
});

describe('Échelles affines — dérivées des constantes, jamais posées', () => {
  it('la cadence VERTICALE de l’écran est la SOURCE UNIQUE `ISO_PX_PER_M`', () => {
    const { sy, pitch } = affineScales('iso', mpt);
    expect(ISO_PX_PER_M).toBe(LEVEL_H / METRES_PER_LEVEL);
    expect(sy * Math.cos(pitch)).toBeCloseTo(ISO_PX_PER_M, 9);
  });

  it('la cadence de PROFONDEUR au sol vaut TH/TW de la cadence horizontale (losange 2:1)', () => {
    const { sx, sy, pitch } = affineScales('iso', mpt);
    expect(sy * Math.sin(pitch)).toBeCloseTo(sx * (TH / TW), 9);
    expect(sx).toBeCloseTo((TW * Math.SQRT1_2) / mpt, 9);
    expect(sx).toBeCloseTo(pxPerM(mpt), 12);
  });

  it('iso et edge-on partagent pitch et échelles (l’edge-on EST le losange tourné d’un quart de tour)', () => {
    expect(affineScales('edge', mpt)).toEqual(affineScales('iso', mpt));
  });

  it('un pitch asin(TH/TW) = 30° manquerait la cadence verticale de plus de 0.5 px/m à cette échelle', () => {
    const { sx } = affineScales('iso', mpt);
    const uniform = sx * Math.cos(Math.asin(TH / TW)); // px/m de hauteur d’une ortho UNIFORME à 30°
    expect(Math.abs(uniform - ISO_PX_PER_M)).toBeGreaterThan(0.5);
  });
});
