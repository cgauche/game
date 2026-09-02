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
import { setSpritePicker, setStageFrame, type CadreRendu } from './spritePicker';
import { pickTileAt } from './pickProbe';
import { caseAuSol } from './pickResolve';
import { buildPropVolumes } from '../builders/propVolumes';
import { findPropById } from '../../data';
import { capVolumique } from '../../data/props.types';
import type { SceneEntity } from '../../state/scene';

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
 * c'est celle qu'on voit (cf. `stage/pickResolve.ts:caseMarchable`).
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

/** Le cadre que l'hôte PUBLIE : projection commise + caméra RENDUE (un lecteur, comme `camRef`) + zoom. */
const cadreRendu = (dims: Dims, cam: { x: number; y: number } = CAM, zoom = ZOOM): CadreRendu =>
  ({ dims, camRendue: () => cam, zoom });

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
  setSpritePicker(null);
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
});

/** Monte le pointeur sur une scène, à l'étage `activeZ`, et rend « viser un pixel → la case survolée ». */
function viseur(scene: Scene, activeZ: number, partyPos: Pt, cadre?: Dims): (sx: number, sy: number) => Pt | null {
  const dims = cadre ?? dimsDe(scene);
  useGame.setState({ scene, mode: 'exploration', partyPos, party: [], battle: null, dialogue: null });
  let pointer: StagePointer | undefined;
  const Probe = () => {
    const svgRef = useRef(stageEl());
    const camRef = useRef(CAM);
    pointer = useStagePointer({
      svgRef, dims, zoom: ZOOM, camRef, hoverTracking: false, partyLeader: undefined, activeZ,
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
 *  (`stage/pickResolve.ts:pasInterEtages`) a sa propre garde (`useStagePointer.test.tsx`) et n'a rien
 *  à faire ici. */
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

/**
 * MEUBLE HAUT — le pixel du DESSUS appartient au meuble, et c'est le RAYON qui le dit (#1443, round 2).
 *
 * La résolution de case du pointeur inverse l'écran au LIFT DU SOL : sur une FACE SUPÉRIEURE portée à
 * un mètre, elle rend une case décalée vers l'arrière — mesuré sur la Diligence, le pixel du dessus
 * d'un comptoir désigne la table voisine, et un clic y envoyait le groupe s'attabler au lieu de servir
 * le comptoir. Le rayon, lui, touche la face RÉELLEMENT dessinée à sa hauteur réelle : quand il nomme
 * un décor, c'est lui qui décide ; la case dessinée n'est qu'un REPLI (plateau fin, aucune face touchée).
 */
describe('meuble HAUT — le rayon décide, la case dessinée n’est qu’un repli (#1443)', () => {
  const scene = diligence.scene as Scene;
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const camera = cameraVolumique(dims, mpt);

  /** Sommet MONDE d'un décor posé, dérivé de ses faces réelles (aucune relecture de recette). */
  const sommet = (ent: SceneEntity): number => {
    const prop = findPropById(ent.ref ?? '')!;
    const faces = buildPropVolumes(prop, {
      ancre: ent.pos,
      facing: capVolumique(ent.facing, ent.id),
      baseHeightM: heightAt(scene, ent.pos.x, ent.pos.y, ent.z ?? 0),
      entId: ent.id,
    }, mpt);
    return Math.max(...faces.flatMap((f) => f.poly.map((p) => p.h)));
  };

  /** Les décors dont le pixel du DESSUS tombe, au lift du SOL, sur la case d'un AUTRE décor : le cas
   *  exact que la règle tranche. Vide = la carte a changé, et la garde ne mesure plus rien. */
  const pieges = scene.entities
    .filter((e) => e.kind === 'prop' && (e.z ?? 0) === 0)
    .map((e) => ({ ent: e, px: pixelVolumique(camera, mpt, e.pos.x, e.pos.y, sommet(e)) }))
    .map(({ ent, px }) => {
      const vb = viewBoxPointAt({ sx: px.sx, sy: px.sy }, CANVAS);
      const g = stagePointAt(vb, CAM, ZOOM);
      const sol = screenToWorldAtLift(poseFromDims(dims), g, 0);
      const dessous = scene.entities.find((e) => e.kind === 'prop' && e.pos.x === Math.round(sol.x) && e.pos.y === Math.round(sol.y) && (e.z ?? 0) === 0);
      return { ent, px, voisin: dessous && dessous.id !== ent.id ? dessous : null };
    })
    .filter((c) => !!c.voisin);

  it('le pixel du DESSUS d’un meuble haut cible CE meuble, jamais le voisin que le lift du sol désigne', () => {
    expect(pieges.length, 'la Diligence DOIT porter au moins un meuble haut qui décale sa case').toBeGreaterThan(0);
    const ecarts: string[] = [];
    for (const { ent, px, voisin } of pieges) {
      setSpritePicker(() => ({ kind: 'entity', id: ent.id })); // le rayon touche la face du dessus
      const vise = viseur(scene, 0, posteDuGroupe(scene, 0, { x: 0, y: 0 }));
      const vu = vise(px.sx, px.sy);
      if (vu?.x !== ent.pos.x || vu?.y !== ent.pos.y) {
        ecarts.push(`${ent.id} (${ent.pos.x},${ent.pos.y}) → pointeur=${vu ? `${vu.x},${vu.y}` : 'rien'} (voisin piège : ${voisin!.id})`);
      }
      act(() => root!.unmount());
      root = null;
    }
    expect(ecarts).toEqual([]);
  });

  it('TÉMOIN — sans rayon, le repli par la case dessinée désigne bien le voisin : c’est ce que la règle évite', () => {
    const { ent, px, voisin } = pieges[0];
    setSpritePicker(null); // aucune voie de rayon inscrite → repli par la case dessinée
    const vise = viseur(scene, 0, posteDuGroupe(scene, 0, { x: 0, y: 0 }));
    const vu = vise(px.sx, px.sy);
    expect(`${vu?.x},${vu?.y}`, `le repli désigne ${voisin!.id}, pas ${ent.id}`).toBe(`${voisin!.pos.x},${voisin!.pos.y}`);
  });
});

/**
 * SONDE DE RECETTE ⇄ GESTE — la sonde `__wfrp.pickTileAt` rapporte ce qu'un CLIC ferait (#1680).
 *
 * La sonde sert à diagnostiquer un « clic qui ne fait rien » : si elle et le geste divergent, elle
 * innocente le pixel que le clic manque, et la recette conclut faux. Les deux décisions du picking
 * vivent donc en un lieu (`stage/pickResolve.ts`) : la CONDITION DE TIR du rayon — que la sonde
 * bornait au COMBAT alors que le geste tire aussi hors combat sur une scène à décor volumique — et la
 * RÉSOLUTION de ce que le rayon nomme, dont la branche `entity` retombait en silence sur le sol.
 */
describe('sonde de picking — hors combat, un décor volumique nommé rend SA case (#1680)', () => {
  const scene = diligence.scene as Scene;
  const cible = scene.entities.find((e) => e.kind === 'prop' && (e.z ?? 0) === 0)!;
  const mpt = sceneMetresPerTile(scene);
  /** Un pixel qui tombe sur une SURFACE dessinée : le repli de sol y a donc une réponse, et le
   *  témoin mesure bien la voie choisie, pas un hors-carte. */
  const px = pixelVolumique(
    cameraVolumique(dimsDe(scene), mpt), mpt,
    cible.pos.x, cible.pos.y, heightAt(scene, cible.pos.x, cible.pos.y, 0),
  );
  const pixel = { x: px.sx, y: px.sy };

  /** Élément de stage que la sonde cherche dans le DOM (`svg.iso-stage`), mesuré au cadre du test. */
  function poserStage(): SVGSVGElement {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'iso-stage');
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: CANVAS.w, height: CANVAS.h }) as DOMRect;
    document.body.appendChild(el);
    return el;
  }

  afterEach(() => {
    document.querySelectorAll('svg.iso-stage').forEach((el) => el.remove());
    setStageFrame(null);
  });

  /** Le poste du groupe est POSÉ, jamais hérité : `partyPos.z` décide de l'étage sur lequel la sonde
   *  résout (`state/viewLevel.ts:etageActif`), donc de la voie qui répond — un `z` de 1 laissé par un
   *  test voisin fait rendre `sol` là où l'étage 0 rend `meuble`. */
  function armer(): void {
    poserStage();
    setStageFrame(cadreRendu(dimsDe(scene)));
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null,
      partyPos: posteDuGroupe(scene, 0, { x: 0, y: 0 }),
      camPan: CAM, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'iso',
    });
  }

  it('le rayon nomme une ENTITÉ : la sonde rend sa case d’ancrage, par la voie `decor`', () => {
    armer();
    setSpritePicker(() => ({ kind: 'entity', id: cible.id }));
    expect(pickTileAt(pixel)).toEqual({
      tile: { x: cible.pos.x, y: cible.pos.y, z: cible.z ?? 0 },
      cid: null,
      via: 'decor',
    });
  });

  it('TÉMOIN — sans voie de rayon inscrite, la même sonde retombe sur la surface du SOL', () => {
    armer();
    setSpritePicker(null);
    const vu = pickTileAt(pixel);
    // La VOIE change — c'est le seul discriminant : au MÊME pixel, la branche `entity` répondait
    // `null` et la sonde poursuivait la chaîne en silence, en rapportant l'étage suivant là où le
    // geste rend le décor que le rayon nomme.
    expect(vu?.via).toBe('meuble');
  });
});

/**
 * PLATEAU FIN — le repli par le MEUBLE DESSINÉ appartient à la CHAÎNE, pas au geste (#1680).
 *
 * Un plateau fin ne présente aucune face au rayon : c'est alors la case DESSINÉE qui décide. La
 * résolution de tuile l'écarte (l'empreinte d'un meuble solide n'est pas marchable) et le repli
 * cross-couche rend une case d'un AUTRE ÉTAGE — décalage mesuré sur `la-diligence` : (+3,+3) et z0→z1,
 * soit la table voisine, à l'autre bout de la salle. Le geste s'en protégeait seul ; la sonde de
 * recette, qui n'avait pas cet étage, innocentait donc le pixel que le clic manquait.
 */
describe('sonde de picking — plateau FIN : la case du meuble DESSINÉ, jamais celle d’un autre étage (#1680)', () => {
  const scene = diligence.scene as Scene;
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const camera = cameraVolumique(dims, mpt);
  const pose = poseFromDims(dims);
  const poste = posteDuGroupe(scene, 0, { x: 0, y: 0 });

  /** Les décors de l'étage 0 et le pixel de leur case, à la hauteur du SOL — le pixel d'un plateau fin. */
  const decors = scene.entities
    .filter((e) => e.kind === 'prop' && (e.z ?? 0) === 0)
    .map((ent) => ({ ent, px: pixelVolumique(camera, mpt, ent.pos.x, ent.pos.y, heightAt(scene, ent.pos.x, ent.pos.y, 0)) }));

  function poserStage(): void {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'iso-stage');
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: CANVAS.w, height: CANVAS.h }) as DOMRect;
    document.body.appendChild(el);
    setStageFrame(cadreRendu(dims));
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null, partyPos: poste,
      camPan: CAM, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'iso',
    });
  }

  afterEach(() => {
    document.querySelectorAll('svg.iso-stage').forEach((el) => el.remove());
    setStageFrame(null);
  });

  it('sans rayon, chaque décor de l’étage rend SA case par la voie `meuble`', () => {
    poserStage();
    setSpritePicker(null);
    expect(decors.length, 'la Diligence DOIT porter des décors à l’étage 0').toBeGreaterThan(0);
    const ecarts: string[] = [];
    for (const { ent, px } of decors) {
      const vu = pickTileAt({ x: px.sx, y: px.sy });
      if (vu?.via !== 'meuble' || vu.tile?.x !== ent.pos.x || vu.tile?.y !== ent.pos.y || vu.tile?.z !== 0)
        ecarts.push(`${ent.id} (${ent.pos.x},${ent.pos.y}) → ${vu ? `${vu.via} ${vu.tile?.x},${vu.tile?.y},z${vu.tile?.z}` : 'rien'}`);
    }
    expect(ecarts).toEqual([]);
  });

  it('TÉMOIN — le repli cross-couche, lui, désigne bien une case d’un AUTRE étage : c’est ce que cet étage évite', () => {
    const pieges: string[] = [];
    for (const { ent, px } of decors) {
      const g = stagePointAt(viewBoxPointAt({ sx: px.sx, sy: px.sy }, CANVAS), CAM, ZOOM);
      const sol = caseAuSol(scene, { pose, dims, activeZ: 0 }, g);
      if (sol && (sol.x !== ent.pos.x || sol.y !== ent.pos.y || (sol.z ?? 0) !== 0))
        pieges.push(`${ent.id} (${ent.pos.x},${ent.pos.y}) → sol ${sol.x},${sol.y},z${sol.z ?? 0}`);
    }
    expect(pieges.length, 'aucun piège mesuré : ce contrat ne départage plus rien').toBeGreaterThan(0);
    // Le décalage EST celui du bug : la case rendue est celle de l'étage du dessus, trois pas plus loin.
    expect(pieges).toContain('diligence-salle-table-murale-1 (14,11) → sol 17,14,z1');
  });
});

/**
 * LE CADRE EST PUBLIÉ, PAS REBÂTI — la sonde résout sur la pose que l'écran REND (#1680).
 *
 * L'hôte de rendu commet un cadre qui n'est PAS le store nu : `view: pov ? 'iso' : viewMode`
 * (`MondeDeCampagne.tsx`) — en première personne le monde reste projeté en iso alors que le store peut
 * porter `viewMode: 'top'` — et un `yawDeg` LISSÉ pendant une rotation. Une sonde qui rebâtit le cadre
 * depuis le store résout donc sur une AUTRE pose que l'image, et innocente le pixel que le clic manque.
 * Le cadre commis est publié (`spritePicker.ts:setStageFrame`) ; la sonde le lit.
 */
describe('sonde de picking — le CADRE est celui que l’écran rend, jamais le store nu (#1680)', () => {
  const scene = diligence.scene as Scene;
  const poste = posteDuGroupe(scene, 0, { x: 0, y: 0 });

  afterEach(() => {
    document.querySelectorAll('svg.iso-stage').forEach((el) => el.remove());
    setStageFrame(null);
  });

  /** Monte le stage, PUBLIE `cadre`, et pose au store un `viewMode` DIVERGENT — celui qu'une sonde
   *  rebâtisseuse lirait. C'est exactement la situation de la première personne. */
  function armerCadre(cadre: Dims): void {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'iso-stage');
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: CANVAS.w, height: CANVAS.h }) as DOMRect;
    document.body.appendChild(el);
    setStageFrame(cadreRendu(cadre));
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null, partyPos: poste,
      camPan: CAM, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'top', // le store DIVERGE du cadre commis
    });
  }

  /** Les pixels d'échantillon : les décors de l'étage 0 vus au cadre PUBLIÉ. */
  const echantillonPixels = (cadre: Dims) => {
    const mpt = sceneMetresPerTile(scene);
    const camera = cameraVolumique(cadre, mpt);
    return scene.entities
      .filter((e) => e.kind === 'prop' && (e.z ?? 0) === 0)
      .map((ent) => pixelVolumique(camera, mpt, ent.pos.x, ent.pos.y, heightAt(scene, ent.pos.x, ent.pos.y, 0)));
  };

  for (const [nom, cadre] of [
    ['première personne (monde en iso, store en top)', { ...dimsDe(scene), view: 'iso' }],
    ['rotation en cours (lacet LISSÉ, hors cran)', { ...dimsDe(scene), view: 'iso', yawDeg: 31.5 }],
  ] as [string, Dims][]) {
    it(`${nom} : la sonde résout à la case du GESTE, au cadre publié`, () => {
      armerCadre(cadre);
      setSpritePicker(null);
      const pixels = echantillonPixels(cadre);
      expect(pixels.length, 'aucun pixel d’échantillon : ce contrat ne mesure plus rien').toBeGreaterThan(0);
      const ecarts: string[] = [];
      for (const px of pixels) {
        // Le GESTE, monté sur le MÊME cadre : c'est lui l'étalon, jamais une seconde formule.
        const vise = viseur(scene, 0, poste, cadre);
        const attendu = vise(px.sx, px.sy);
        act(() => root!.unmount());
        root = null;
        const vu = pickTileAt({ x: px.sx, y: px.sy });
        const cle = (t: { x: number; y: number; z?: number } | null | undefined) => (t ? `${t.x},${t.y},z${t.z ?? 0}` : 'rien');
        if (cle(vu?.tile) !== cle(attendu)) ecarts.push(`(${px.sx.toFixed(1)},${px.sy.toFixed(1)}) geste=${cle(attendu)} sonde=${cle(vu?.tile)}`);
      }
      expect(ecarts).toEqual([]);
    });
  }

  it('hors montage du stage, la sonde NOMME l’absence d’image plutôt que de résoudre à l’aveugle', () => {
    armerCadre(dimsDe(scene));
    setStageFrame(null); // aucun hôte de rendu : plus aucune pose commise
    expect(pickTileAt({ x: CANVAS.w / 2, y: CANVAS.h / 2 })).toEqual({ tile: null, cid: null, via: 'aucune' });
  });
});

/**
 * LA CAMÉRA DU CADRE EST CELLE DU RENDU, PAS CELLE DU STORE (#1680).
 *
 * Un écran qui SUIT le groupe ne pose rien dans `store.camPan` : le focal vit dans la réf que la boucle
 * d'images réécrit (`MondeDeCampagne.tsx:camRef`), et c'est cette valeur-là que le geste inverse à
 * l'instant de l'événement. Une sonde qui inverse avec le store part donc de tout le focal à côté —
 * mesuré sur Chrome (scène `diligence`, 1600×900) : au pixel MÊME dont le clic déplaçait le groupe en
 * (19,4), la sonde rendait `{tile: null, via: 'aucune'}`.
 *
 * D'où le cadre PUBLIÉ en LECTEUR de caméra : les deux porteurs lisent la même valeur au même instant.
 */
describe('sonde de picking — la CAMÉRA du cadre est celle du RENDU, jamais `store.camPan` (#1680)', () => {
  const scene = diligence.scene as Scene;
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const camera = cameraVolumique(dims, mpt);
  const poste = posteDuGroupe(scene, 0, { x: 0, y: 0 });
  /** Les décors de l'étage 0, vus au pixel de leur case : l'échantillon des deux contrats voisins. */
  const decors = scene.entities
    .filter((e) => e.kind === 'prop' && (e.z ?? 0) === 0)
    .map((ent) => ({ ent, px: pixelVolumique(camera, mpt, ent.pos.x, ent.pos.y, heightAt(scene, ent.pos.x, ent.pos.y, 0)) }));

  afterEach(() => {
    document.querySelectorAll('svg.iso-stage').forEach((el) => el.remove());
    setStageFrame(null);
  });

  it('cadre publié à la caméra du RENDU, store AU REPOS : la sonde résout la case du geste', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'iso-stage');
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: CANVAS.w, height: CANVAS.h }) as DOMRect;
    document.body.appendChild(el);
    // L'image est cadrée en `CAM` (c'est la caméra que `viseur` tend au geste par sa réf) ; le store,
    // lui, reste à l'origine — exactement l'état d'un écran centré sur le groupe.
    setStageFrame(cadreRendu(dims, CAM));
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null, partyPos: poste,
      camPan: { x: 0, y: 0 }, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'iso',
    });
    setSpritePicker(null);
    expect(decors.length, 'aucun pixel d’échantillon : ce contrat ne mesure plus rien').toBeGreaterThan(0);
    const cle = (t: { x: number; y: number; z?: number } | null | undefined) => (t ? `${t.x},${t.y},z${t.z ?? 0}` : 'rien');
    const ecarts: string[] = [];
    for (const { ent, px } of decors) {
      const attendu = viseur(scene, 0, poste, dims)(px.sx, px.sy); // le GESTE, étalon
      act(() => root!.unmount());
      root = null;
      const vu = pickTileAt({ x: px.sx, y: px.sy });
      if (cle(vu?.tile) !== cle(attendu)) ecarts.push(`${ent.id} : geste=${cle(attendu)} sonde=${cle(vu?.tile)} (via ${vu?.via ?? 'rien'})`);
    }
    expect(ecarts).toEqual([]);
  });
});
