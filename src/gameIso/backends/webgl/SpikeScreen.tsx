/**
 * SPIKE WebGL (#1160) — ÉCRAN DE JUGEMENT, DEV uniquement (`import.meta.env.DEV`, monté par `App.tsx`
 * sur `screen === 'webglSpike'`). Il ne décide RIEN : il monte côte à côte les pièces du spike
 * (`worldTris` + `faceColors` → géométrie fusionnée ; `cameras` → les vues de production ; `billboardMath`
 * + `svgTexture` → les billboards ; `visibilityTint` → le brouillard) pour qu'un ŒIL tranche.
 *
 * Les seuls choix propres à cet écran sont des choix de PRÉSENTATION, tous exposés en interrupteurs :
 * canevas de taille FIXE (captures comparables), mode éclairé vs couleur cuite, convention de taille des
 * billboards, visibilité ON/OFF. Le pilotage headless passe par `window.__spike` (cf. `scripts/qc/spike-webgl.mjs`).
 *
 * NAVIGATION : le lacet ortho est un RÉEL (glisser horizontal à la souris, touches A/E maintenues) et le
 * zoom est CONTINU (molette, borné par `ZOOM_MIN`/`ZOOM_MAX`) ; les crans de production restent des
 * raccourcis. La géométrie du monde et les sujets de billboard sont MÉMOÏSÉS (scène × visibilité) : une
 * rotation ne rejoue que la caméra et les quads, jamais les builders.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import * as THREE from 'three';
import { ScreenShell } from '../../../ui/ScreenShell';
import { useGame } from '../../../state/store';
import { buildScene } from '../../../state/mapSpec';
import { startOf } from '../../../state/mapQC';
import { computeStateVisible } from '../../../state/visionState';
import { sceneMetresPerTile, type Scene } from '../../../state/scene';
import { DIR8_ORDER, facingToward, type Dir8 } from '../../../state/dir8';
import type { Rot } from '../../../geometry/iso';
import { makeCamera } from '../../pov/camera';
import { affineCamera, fitAffineView, povCamera, rotYaw, type AffineKind } from './cameras';
import { pxPerM } from './worldTris';
import { tintFor } from './visibilityTint';
import {
  billboardHeightM,
  billboardView,
  anchorAndSize,
  rasterPxHeight,
  billboardTextureKey,
  BILLBOARD_BOX_ASPECT,
  ZOOM_MAX,
  type BillboardConvention,
} from './billboardMath';
import { clearBillboardTextures, getBillboardTexture, svgToTexture } from './svgTexture';
import { clearPeriodTextures, getPeriodTexture } from './periodTexture';
import { clearFaceBakes, getFaceBake } from './faceBake';
import {
  billboardDepthOffsetUnits,
  billboardPose,
  applyVisibilityTint,
  bakeWorldGeometry,
  collectBillboards,
  contactShadow,
  contentBox,
  outdoorFog,
  skyTexture,
  sunRig,
  wantsContactShadow,
  worldShadowBox,
  AMBIENT_INTENSITY,
  LIGHT_COLOR,
  SUN_INTENSITY,
} from './sceneMeshes';
import { accentCounts, buildGroundAccentMeshes, sceneGroundAccents } from './groundAccents';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { scenario as pontVitrine } from '../../../scenes/test-scenarios/pont-vitrine';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { buildOperaFloorplan } from '../../../scenes/opera/floorplan';
import { buildVitrineScene } from '../../../scenes/vitrine-batiments';
import { scenario as diligence } from '../../../scenes/test-scenarios/diligence';

/** Canevas de taille FIXE : deux captures ne se comparent qu'à cadre égal. */
const CANVAS_W = 1280;
const CANVAS_H = 720;
/** Fond des planches QC (`render-env.mts`) — même fond ici pour comparer sans biais de contraste. */
const BG = 0x14161f;
/** Échelle de rendu du canevas, FIGÉE à 2 : le tampon fait 2× le cadre CSS (les arêtes fines — merlons,
 *  montants — cessent de pointiller) pour 4× les pixels à remplir, et deux captures prises sur deux
 *  machines de densité d'écran différente restent comparables au pixel près. */
const PIXEL_RATIO = 2;

/** Vues du spike : les 3 familles affines + le POV première personne. */
type SpikeView = AffineKind | 'pov';

/** Scènes-témoins : les cartes sur lesquelles l'utilisateur juge le rendu. */
const SCENES: { id: string; label: string; make: () => Scene }[] = [
  { id: 'siege-enceinte', label: 'Siège — enceinte', make: () => buildScene(siegeSpec) },
  { id: 'pont-vitrine', label: 'Pont — vitrine (relief)', make: () => pontVitrine.scene },
  { id: 'opera', label: 'Opéra — théâtre', make: () => buildOperaFloorplan() },
  { id: 'arene', label: 'Arène (hub)', make: () => arene.scene },
  { id: 'vitrine-batiments', label: 'Vitrine — bâtiments', make: () => buildVitrineScene() },
  { id: 'diligence', label: 'La Diligence (2 niveaux)', make: () => diligence.scene },
];

/** Plancher de zoom exposé (le plafond est `ZOOM_MAX`, borne haute de `setZoom` en prod). */
const ZOOM_MIN = 0.4;
/** Paliers de zoom en raccourcis : le plancher, la référence, le plafond. */
const ZOOMS = [ZOOM_MIN, 1, ZOOM_MAX];
/** Conventions de taille monde des billboards, dans l'ordre du sélecteur — `jeu` en tête (le défaut,
 *  cf. `JEU_ENT_H_M`), les deux autres restant les repères de comparaison de la planche. */
const CONVENTIONS: BillboardConvention[] = ['jeu', 'heroique', 'metrique'];
/** Degrés de lacet par pixel de glissement horizontal. */
const YAW_DEG_PER_PX = 0.35;
/** Degrés de lacet par seconde, touche de rotation MAINTENUE. */
const YAW_DEG_PER_S = 90;
/** Sensibilité de la molette (facteur exponentiel : un cran de molette ≈ ×1,15). */
const ZOOM_PER_WHEEL = 0.0015;

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
/** Lacet réel → cran de caméra le plus proche : l'art de décor (`propSvg`) n'existe qu'AUX crans. */
const nearestRot = (yawDeg: number): Rot => ((((Math.round(yawDeg / 90) % 4) + 4) % 4) as Rot);
const normYaw = (yawDeg: number): number => ((yawDeg % 360) + 360) % 360;

interface SpikeOpts {
  scene: string;
  view: SpikeView;
  /** Lacet ortho, en degrés — RÉEL (les crans de production valent `rotYaw(rot)`). */
  yawDeg: number;
  zoom: number;
  lit: boolean;
  convention: BillboardConvention;
  vis: boolean;
  /** Cadrage : la scène entière, ou le premier personnage (planche créature). */
  focus: 'scene' | 'personnage';
  /** Cap du POV — `'auto'` = dérivé vers le contenu de la carte. */
  facing: Dir8 | 'auto';
  nonce: number;
}

/** Options pilotables de l'extérieur : `rot` est un RACCOURCI d'entrée vers `yawDeg` (aucun état propre). */
type SpikePatch = Partial<Omit<SpikeOpts, 'nonce'>> & { rot?: Rot };

const DEFAULT_OPTS: SpikeOpts = {
  scene: 'siege-enceinte',
  view: 'iso',
  yawDeg: 0,
  zoom: 1,
  lit: false,
  convention: 'jeu',
  vis: false,
  focus: 'scene',
  facing: 'auto',
  nonce: 0,
};

/** `{ rot }` (cran) → `{ yawDeg }` : une seule source d'état pour l'orientation. */
function normalizePatch(patch: SpikePatch): Partial<Omit<SpikeOpts, 'nonce'>> {
  const { rot, ...rest } = patch;
  return rot === undefined ? rest : { ...rest, yawDeg: rest.yawDeg ?? rotYaw(rot) };
}

declare global {
  interface Window {
    __spike?: {
      set: (opts: SpikePatch) => Promise<void>;
      ready: Promise<void>;
      options: () => SpikeOpts;
      scenes: () => string[];
    };
  }
}

export function SpikeScreen(): JSX.Element {
  const setScreen = useGame((s) => s.setScreen);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pendingRef = useRef<(() => void)[]>([]);
  const readyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const dragRef = useRef<number | null>(null);
  const [opts, setOpts] = useState<SpikeOpts>(DEFAULT_OPTS);
  const [info, setInfo] = useState('');
  /** Cap POV EFFECTIF de la dernière frame (le `'auto'` résolu) — base du pivot et de l'affichage. */
  const [cap, setCap] = useState<Dir8>('S');

  if (!readyRef.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    readyRef.current = { promise, resolve };
  }

  const patch = useCallback((p: SpikePatch) => setOpts((o) => ({ ...o, ...normalizePatch(p), nonce: o.nonce + 1 })), []);

  const scene = useMemo(() => (SCENES.find((s) => s.id === opts.scene) ?? SCENES[0]).make(), [opts.scene]);
  const mpt = useMemo(() => sceneMetresPerTile(scene), [scene]);
  // Le cache de textures est GLOBAL au module : changer de scène rend TOUTES ses entrées mortes (les
  // clés portent l'identité des sujets de l'ancienne carte). Sans vidange, elles occupent la VRAM du
  // navigateur jusqu'à la fin de la session — et le spike se parcourt scène par scène.
  useEffect(() => () => { clearBillboardTextures(); clearPeriodTextures(); clearFaceBakes(); }, [scene]);
  const start = useMemo(
    () => startOf(scene) ?? { x: Math.floor(scene.dimensions.w / 2), y: Math.floor(scene.dimensions.h / 2), z: 0 },
    [scene],
  );

  // ── Visibilité : la politique du jeu (`computeStateVisible`), `explored` VIDE → 3 teintes nettes.
  const tintAt = useMemo(() => {
    const visible = opts.vis
      ? computeStateVisible({ scene, battle: null, party: [], partyPos: start, gameTime: 12 * 60, lightLevel: null })
      : null;
    const explored = new Set<string>();
    return (key: string) => (visible ? tintFor(key, visible, explored) : 1);
  }, [scene, start, opts.vis]);

  // ── Monde : UNE géométrie fusionnée, CUITE par (scène × échelle) — la visibilité n'en refait rien.
  // La triangulation, le rang coplanaire, les UV et les groupes de surface sont invariants à ce que le
  // groupe voit (mesuré #1176, arène : 492 ms de bake pour 1,3 ms de teinte) : un pas de marche ne
  // rejoue que la RÉÉCRITURE des couleurs de sommet, en place.
  const baked = useMemo(() => bakeWorldGeometry(scene, mpt), [scene, mpt]);
  useEffect(() => () => baked.geometry.dispose(), [baked]);
  const geometry = useMemo(() => applyVisibilityTint(baked, tintAt), [baked, tintAt]);
  const subjects = useMemo(() => collectBillboards(scene, mpt, tintAt), [scene, mpt, tintAt]);
  // ── Accents de SOL : un semis ancré MONDE, sans période — il ne peut passer ni par la texture de
  // période ni par la cuisson par face. Dérivation PURE mémoïsée (scène × échelle, 12,1 ms sur l'arène) ;
  // le montage instancié, lui, dépend du mode de matériau et porte la teinte par `instanceColor`.
  const accents = useMemo(() => sceneGroundAccents(scene, mpt), [scene, mpt]);

  // Renderer UNIQUE (le canevas ne se remonte jamais) — `preserveDrawingBuffer` pour `toDataURL`.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(PIXEL_RATIO);
    renderer.setSize(CANVAS_W, CANVAS_H, false);
    renderer.setClearColor(BG, 1);
    renderer.shadowMap.enabled = true;
    // `PCFSoftShadowMap` est DÉPRÉCIÉ depuis three 0.185 : le moteur le remplace lui-même par
    // `PCFShadowMap` à la première frame ombrée (`WebGLShadowMap.render`) en criant à la console —
    // on pose donc directement le filtre réellement appliqué (rendu identique, console propre).
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const renderer = rendererRef.current;
    if (!renderer) return;
    const three = new THREE.Scene();
    const disposables: { dispose: () => void }[] = [];

    const run = async () => {
      // Cap POV : `'auto'` pointe le CONTENU (`facingToward` vers le centre de la carte) — un départ
      // posé en bord de carte regarderait sinon le vide. Les boutons de pivot posent un cap explicite.
      const facing = opts.facing === 'auto' ? facingToward(start, { x: (scene.dimensions.w - 1) / 2, y: (scene.dimensions.h - 1) / 2 }) : opts.facing;

      // UN MATÉRIAU PAR GROUPE DE SURFACE (`geometry.userData.surfaceGroups`, index = `materialIndex`) :
      // la géométrie reste FUSIONNÉE, seul le dessin se scinde. Le groupe NU garde la couleur cuite au
      // sommet ; les autres reçoivent le masque de période de leur surface. Les UV du monde sont en
      // MÈTRES : la répétition vaut donc l'inverse de la période métrique DU GROUPE (le `v` d'un pan de
      // toit suit sa pente). La teinte reste portée par la couleur de sommet — la `map` la MULTIPLIE ;
      // le masque plafonnant à 1, l'éclaircissement des blocs clairs revient à la couleur du matériau.
      // Un groupe CUIT PAR FACE (colombage) ne répète rien : son image est échantillonnée sur l'UV de
      // face (`uv1`, `texture.channel = 1`) et porte DÉJÀ le fond de période de sa surface.
      const anisotropy = renderer.capabilities.getMaxAnisotropy();
      const materials = geometry.userData.surfaceGroups.map((g) => {
        const mat = opts.lit
          ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true })
          : new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
        disposables.push(mat);
        if (g.bake && g.recipe) {
          const cuisson = getFaceBake(
            g.key,
            { color: g.color ?? '', recipe: g.recipe, part: g.part },
            g.bake.wM,
            g.bake.hM,
            g.variant ?? 0,
            anisotropy,
          );
          if (cuisson) {
            mat.map = cuisson.texture;
            mat.color.setScalar(cuisson.gain);
          }
          return mat;
        }
        const période = g.kind && g.recipe && g.periodM
          ? getPeriodTexture(g.key, g.recipe, g.variant ?? 0, { kind: g.kind, baseColor: g.color ?? '', anisotropy })
          : null;
        if (période && g.periodM) {
          période.texture.repeat.set(1 / g.periodM.u, 1 / g.periodM.v);
          mat.map = période.texture;
          mat.color.setScalar(période.gain);
        }
        return mat;
      });
      const worldMesh = new THREE.Mesh(geometry, materials);
      worldMesh.castShadow = opts.lit;
      worldMesh.receiveShadow = opts.lit;
      three.add(worldMesh);

      // ── ACCENTS DE SOL : un `InstancedMesh` par (type × couleur de donnée), teinte de visibilité
      // portée par `instanceColor`. Ils entrent dans les `disposables` de la frame — changer de scène,
      // de mode ou de visibilité les évince avec le reste, sans cache à invalider.
      const accentMeshes = buildGroundAccentMeshes(accents, { lit: opts.lit, tintAt });
      for (const m of accentMeshes) {
        m.castShadow = opts.lit;
        m.receiveShadow = opts.lit;
        disposables.push(m.geometry, m.material as THREE.Material, m);
        three.add(m);
      }

      const box = geometry.boundingBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
      const centre = box.getCenter(new THREE.Vector3());
      const taille = box.getSize(new THREE.Vector3());

      // ── CIEL & BRUME : seule la caméra PERSPECTIVE a un horizon (une ortho n'en a pas). Le POV prend
      // le dégradé et la courbe de brume du POV SVG (`sceneMeshes` → `AMBIANCE.pov`) : le sol s'y éteint
      // au lieu de finir sur une arête franche posée sur le fond de planche. Les ortho gardent `BG`.
      if (opts.view === 'pov') {
        const ciel = skyTexture();
        disposables.push(ciel);
        three.background = ciel;
        three.fog = outdoorFog(mpt);
      }

      // ── Billboards : vue déléguée à `billboardView` (lacet RÉEL), taille à la convention testée.
      const pose = makeCamera(scene, start, facing);
      const bbCam = opts.view === 'pov'
        ? ({ kind: 'perspective', fwd: pose.fwd, right: pose.right } as const)
        : ({ kind: 'ortho', yawDeg: opts.yawDeg } as const);
      const pxm = pxPerM(mpt);
      // L'art de décor n'existe qu'aux crans (`propSvg(ref, dir, camRot)`) : entre deux crans, le plus
      // proche. POV : cran 0, comme la prod.
      const camRot: Rot = opts.view === 'pov' ? 0 : nearestRot(opts.yawDeg);
      const quads = subjects.map((sub) => {
        const { view, mirror } = billboardView(bbCam, sub.facing);
        const heightM = billboardHeightM(opts.convention, sub.kind) * sub.scaleK;
        const quad = anchorAndSize(heightM, BILLBOARD_BOX_ASPECT);
        const pxHeight = rasterPxHeight(heightM, pxm);
        // Le cran de caméra n'entre dans l'identité que pour le DÉCOR — `propSvg(ref, dir, camRot)`
        // en dépend, alors que le SVG d'un personnage l'ignore (`collectBillboards`, `sceneMeshes.ts`) :
        // l'y mettre rasterisait quatre fois la MÊME image.
        const identity = sub.kind === 'prop' ? `${sub.identity}|r${camRot}` : sub.identity;
        const key = billboardTextureKey(identity, view, mirror, pxHeight);
        const texture = getBillboardTexture(key, () => svgToTexture(sub.svg(view, mirror, camRot), sub.box, pxHeight));
        return { sub, quad, texture };
      });
      // `allSettled` : une texture rejetée (SVG illisible) ne doit pas emporter la frame ENTIÈRE —
      // sinon aucun billboard n'est monté, `ready`/`pendingRef` ne se résolvent jamais et le pilotage
      // headless (`window.__spike.set`) pend sans fin. Le sujet fautif est SAUTÉ et signalé en
      // `warn` : le garde console du QC reste strict sur les erreurs.
      const settled = await Promise.allSettled(quads.map((q) => q.texture));
      if (cancelled) return;
      const montables = quads.flatMap((q, i) => {
        const issue = settled[i];
        if (issue.status === 'fulfilled') return [{ ...q, tex: issue.value }];
        console.warn(`SpikeScreen: billboard « ${q.sub.identity} » sauté — texture non rasterisée :`, issue.reason);
        return [];
      });

      // ── Caméra : les vues de PRODUCTION. Le zoom ortho = l'échelle de `projectToScreen` (viewport ÷ zoom).
      // CADRAGE d'ÉCRAN : à l'échelle FIXE des vues affines (`CELL/mpt` au dessus), une carte de 60×92 m
      // déborde le cadre de 4,4× en surface (mesuré #1176 : `siege-enceinte` top) et une planche ne montre
      // plus que la douve. Le cadrage à la SCÈNE part donc de la boîte de CONTENU (bâti + sujets) et en
      // dérive cible + zoom ; l'utilisateur zoome PAR-DESSUS. Le cadrage au PERSONNAGE garde l'échelle
      // métrique nue — c'est elle que la planche créature juge (`billboardMath`, conventions de taille).
      // La boîte de contenu ne se calcule QUE là où le cadrage la lit : elle rejoue les faces du monde
      // (`contentBox`, mémoïsée par scène) et le POV comme le cadrage au personnage n'en font rien.
      const quadDe = new Map(quads.map((q) => [q.sub, q.quad]));
      const fit = opts.view === 'pov' || opts.focus === 'personnage'
        ? null
        : fitAffineView(opts.view, opts.yawDeg, mpt, contentBox(scene, mpt, subjects, (s) => quadDe.get(s)!, box), { w: CANVAS_W, h: CANVAS_H });
      const target = fit
        ? fit.target
        : opts.focus === 'personnage'
          ? (subjects.find((s) => s.kind === 'personnage')?.anchor.clone().add(new THREE.Vector3(0, 0.9, 0)) ?? centre)
          : centre;
      const echelle = (fit?.zoom ?? 1) * opts.zoom;
      const distance = Math.max(50, taille.length() * 2);
      // Rayon englobant DEPUIS la scène : c'est lui qui resserre near/far (`orthoDepthRange`).
      const radius = taille.length() / 2 + target.distanceTo(centre) + 8;
      const viewport = { w: CANVAS_W / echelle, h: CANVAS_H / echelle };
      const camera = opts.view === 'pov'
        ? povCamera(scene, start, facing, { w: CANVAS_W, h: CANVAS_H })
        : affineCamera(opts.view, opts.yawDeg, mpt, viewport, { target, distance, radius }).camera;

      montables.forEach(({ sub, quad, tex }) => {
        const geo = new THREE.PlaneGeometry(quad.widthM, quad.heightM);
        const mat = opts.lit
          ? new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
          : new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
        mat.color.setScalar(sub.tint);
        disposables.push(geo, mat);
        const mesh = new THREE.Mesh(geo, mat);
        // Quad ALIGNÉ ÉCRAN (quaternion de la caméra) : c'est ce que fait le backend affine, qui dessine
        // le sprite droit dans le plan de l'image ; l'ancre reste les PIEDS, le quad monte de sa demi-hauteur.
        mesh.quaternion.copy(camera.quaternion);
        mesh.position.copy(billboardPose(sub.anchor, quad.centerLiftM, camera.quaternion));
        // Un plan aligné écran TRAVERSE la géométrie qu'il effleure (une ligne de crête coupe la
        // silhouette à mi-corps). Le sujet ne BOUGE pas pour autant : le biais se dépose sur le seul
        // tampon de profondeur (`billboardDepthOffsetUnits` — bornes de la caméra, distance à l'œil pour
        // la perspective), sans conséquence ni sur l'ombre projetée ni sur la taille à l'écran.
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -1;
        mat.polygonOffsetUnits = billboardDepthOffsetUnits(
          camera.near,
          camera.far,
          opts.view === 'pov' ? camera.position.distanceTo(mesh.position) : null,
        );
        mesh.castShadow = opts.lit;
        three.add(mesh);
        // Ombre de CONTACT : le rig ne porte aucune ellipse au pied (le décor, si — `catalog/decor`),
        // et sans elle un personnage flotte en couleur cuite. En mode éclairé, c'est l'ombre PROJETÉE
        // qui fait foi (`wantsContactShadow`) — sinon le personnage en porte deux.
        if (wantsContactShadow(sub.kind, opts.lit)) {
          const disque = contactShadow(sub.anchor, quad.widthM);
          disque.material.opacity *= sub.tint;
          disposables.push(disque.geometry, disque.material);
          three.add(disque);
        }
      });

      // ── Lumière : le mode éclairé remplace tout ombrage cuit (directionnelle à ombres + ambiante),
      // toutes deux NEUTRES et calibrées dans `sceneMeshes` (élévation/azimut fixes, frustum d'ombre
      // serré sur la sphère englobante, biais en texels).
      if (opts.lit) {
        // Intensités en unités PHYSIQUES (three ≥ r155 : plus de mise à l'échelle héritée par π) — le
        // facteur `Math.PI` ramène les intensités catalogue à leur part de la couleur de base à l'écran.
        three.add(new THREE.AmbientLight(LIGHT_COLOR, AMBIENT_INTENSITY * Math.PI));
        // Le frustum d'ombre est SERRÉ : il se calcule sur les casteurs, billboards COMPRIS (un sujet
        // dépasse la boîte de géométrie — 0,769 m au siège) ; hors frustum, une silhouette ne caste plus.
        const rig = sunRig(worldShadowBox(box, subjects, (s) => quadDe.get(s)!));
        const sun = new THREE.DirectionalLight(LIGHT_COLOR, SUN_INTENSITY * Math.PI);
        sun.position.copy(rig.position);
        sun.target.position.copy(rig.target);
        sun.castShadow = true;
        const cam = sun.shadow.camera;
        cam.left = -rig.span; cam.right = rig.span; cam.top = rig.span; cam.bottom = -rig.span;
        cam.near = rig.near;
        cam.far = rig.far;
        cam.updateProjectionMatrix();
        sun.shadow.mapSize.set(rig.mapSize, rig.mapSize);
        // Décalage le long de la NORMALE (jamais un biais de profondeur seul) : c'est lui qui sépare un
        // plan de son propre rendu dans la carte d'ombre.
        sun.shadow.normalBias = rig.normalBias;
        three.add(sun);
        three.add(sun.target);
      }

      renderer.render(three, camera);
      setCap(facing);
      setInfo(
        `${scene.nom} — ${scene.dimensions.w}×${scene.dimensions.h}, ${(geometry.getAttribute('position').count / 3) | 0} triangles, ` +
        `${montables.length} billboards, ${accentCounts(accents).total} accents de sol en ${accentMeshes.length} lots, ` +
        `lacet ${normYaw(opts.yawDeg).toFixed(1)}° (cran ${camRot}), zoom ×${echelle.toFixed(2)}` +
        `${fit ? ` (cadré ×${fit.zoom.toFixed(2)} × réglage ×${opts.zoom.toFixed(2)})` : ''}, cap ${facing}`,
      );
    };

    // La frame RENDUE libère le pilotage headless — et une frame INTERROMPUE le libère aussi : sans
    // ça, une seule exception dans `run` laisserait `ready` et tous les `set()` en attente pour
    // toujours, et le script QC pendrait sans jamais rien dire.
    const liberer = () => {
      if (cancelled) return; // une frame plus récente est en vol : c'est ELLE qui répondra
      readyRef.current?.resolve();
      const pending = pendingRef.current;
      pendingRef.current = [];
      for (const done of pending) done();
    };
    void run()
      .catch((e: unknown) => { console.warn('SpikeScreen: frame interrompue —', e); })
      .finally(liberer);
    return () => {
      cancelled = true;
      for (const d of disposables) d.dispose();
    };
  }, [scene, mpt, start, geometry, tintAt, subjects, accents, opts]);

  // Pilotage headless : `window.__spike.set(...)` résout quand la frame demandée est RENDUE.
  useEffect(() => {
    window.__spike = {
      set: (p) => new Promise<void>((resolve) => {
        pendingRef.current.push(resolve);
        setOpts((o) => ({ ...o, ...normalizePatch(p), nonce: o.nonce + 1 }));
      }),
      ready: readyRef.current!.promise,
      options: () => opts,
      scenes: () => SCENES.map((s) => s.id),
    };
    return () => { delete window.__spike; };
  }, [opts]);

  // Rotation au CLAVIER : A/E maintenues font tourner en continu (une frame = un incrément de lacet).
  useEffect(() => {
    const held = new Set<string>();
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      const sens = (held.has('a') ? -1 : 0) + (held.has('e') ? 1 : 0);
      if (sens) setOpts((o) => ({ ...o, yawDeg: o.yawDeg + sens * YAW_DEG_PER_S * dt, nonce: o.nonce + 1 }));
      raf = held.size ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k !== 'a' && k !== 'e') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      held.add(k);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current === null) return;
    const dx = e.clientX - dragRef.current;
    if (!dx) return;
    dragRef.current = e.clientX;
    setOpts((o) => ({ ...o, yawDeg: o.yawDeg + dx * YAW_DEG_PER_PX, nonce: o.nonce + 1 }));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onWheel = (e: ReactWheelEvent<HTMLCanvasElement>) => {
    setOpts((o) => ({ ...o, zoom: clamp(o.zoom * Math.exp(-e.deltaY * ZOOM_PER_WHEEL), ZOOM_MIN, ZOOM_MAX), nonce: o.nonce + 1 }));
  };

  const pivot = (delta: number) =>
    patch({ facing: DIR8_ORDER[(DIR8_ORDER.indexOf(cap) + delta + DIR8_ORDER.length) % DIR8_ORDER.length] });
  const on = (test: boolean) => `btn${test ? ' active' : ''}`;
  const auCran = (kind: AffineKind, r: Rot) => opts.view === kind && normYaw(opts.yawDeg) === rotYaw(r);

  return (
    <ScreenShell title="Spike WebGL — rendu three (DEV)" onClose={() => setScreen('menu')} body="full" className="webgl-spike">
      <div className="panel row-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        {SCENES.map((s) => (
          <button key={s.id} type="button" className={on(opts.scene === s.id)} onClick={() => patch({ scene: s.id })}>{s.label}</button>
        ))}
      </div>
      <div className="panel row-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={on(opts.view === 'top')} onClick={() => patch({ view: 'top' })}>top</button>
        {([0, 1, 2, 3] as Rot[]).map((r) => (
          <button key={`iso${r}`} type="button" className={on(auCran('iso', r))} onClick={() => patch({ view: 'iso', rot: r })}>iso rot{r}</button>
        ))}
        {([0, 1, 2, 3] as Rot[]).map((r) => (
          <button key={`edge${r}`} type="button" className={on(auCran('edge', r))} onClick={() => patch({ view: 'edge', rot: r })}>edge rot{r}</button>
        ))}
        <button type="button" className={on(opts.view === 'pov')} onClick={() => patch({ view: 'pov' })}>POV</button>
        <button type="button" className="btn" onClick={() => pivot(-1)}>◀ cap</button>
        <span className="hint">{opts.facing === 'auto' ? `auto → ${cap}` : cap}</span>
        <button type="button" className="btn" onClick={() => pivot(1)}>cap ▶</button>
      </div>
      <div className="panel row-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        {ZOOMS.map((z) => (
          <button key={z} type="button" className={on(opts.zoom === z)} onClick={() => patch({ zoom: z })}>zoom ×{z}</button>
        ))}
        <button type="button" className={on(opts.lit)} onClick={() => patch({ lit: !opts.lit })}>{opts.lit ? 'éclairé' : 'couleur cuite'}</button>
        {CONVENTIONS.map((c) => (
          <button key={c} type="button" className={on(opts.convention === c)} onClick={() => patch({ convention: c })}>
            billboards : {c}
          </button>
        ))}
        <button type="button" className={on(opts.vis)} onClick={() => patch({ vis: !opts.vis })}>visibilité {opts.vis ? 'ON' : 'OFF'}</button>
        <button type="button" className={on(opts.focus === 'personnage')} onClick={() => patch({ focus: opts.focus === 'scene' ? 'personnage' : 'scene' })}>
          cadrage : {opts.focus}
        </button>
        <span className="hint">lacet {normYaw(opts.yawDeg).toFixed(1)}° — glisser la souris ou maintenir A/E ; molette = zoom</span>
      </div>
      <div className="panel">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ width: '100%', maxWidth: CANVAS_W, display: 'block', touchAction: 'none', cursor: 'ew-resize' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />
        <p className="hint">{info}</p>
      </div>
    </ScreenShell>
  );
}
