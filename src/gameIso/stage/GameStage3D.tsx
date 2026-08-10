/**
 * MONDE VOLUMIQUE de l'écran de jeu (#1176, lots P2-2/P2-2b) — la couche MONDE de l'iso (`CulledScene`)
 * rendue par les pièces du spike, sous l'interrupteur de chantier `state/stage3d.ts` (DEV). CONSOMMATEUR
 * pur du stage : il ne lit AUCUN store, ne décide ni cadrage ni visibilité ni dégagement — `IsoStage`
 * reste la seule source d'intention, exactement comme pour le backend affine.
 *
 * QUATRE CANAUX INDÉPENDANTS, chacun avec ses propres entrées, aucun n'invalidant les autres :
 *  - CUISSON (`bakeWorldGeometry`, `sceneGroundAccents`) : la passe LOURDE, invalidée par la SEULE
 *    scène et la SEULE échelle (`[scene, mpt]`). Ni la marche ni la caméra ne la rejouent.
 *  - DÉGAGEMENT (`applyCutawayMask`, `maskGroundAccents`) : les masses qui coiffent le groupe cessent
 *    d'être dessinées — l'index du monde cuit se compacte EN PLACE (`[baked, keepEl]`). Une masse
 *    dégagée ne se rend pas, elle ne s'estompe pas.
 *  - TEINTE (`applyVisibilityTint`, `instanceColor` des accents) : la visibilité se réécrit en place
 *    sur les couleurs de sommet (`[baked, tintAt]`).
 *  - POSE : la caméra suit les crans du store (`stage3dCamera`), et rien d'autre ne bouge la vue.
 *
 * CANAUX D'AMBIANCE ENCORE ABSENTS (mesuré #1176, P2-2) — la voie affine (`stage/CulledScene`) les
 * applique OBJET PAR OBJET, cet écran ne porte que la teinte de visibilité (`tintAt`). Ils font partie
 * de ce qui reste à porter AVANT que la double voie meure (cliquet `stage/double-voie-ratchet.test.ts`,
 * qui compte les consommateurs restants de la voie affine) :
 *  - champ de LUMIÈRE par case (`tileBrightness`, `CulledScene`) ;
 *  - opacité de PIÈCE / focus de salle (`roomOpacityOf`) ;
 *  - filtres de BROUILLARD, exploré vs inconnu (`fogFilterFor`, `FogLayer`).
 * Toute mesure de performance comparant les deux voies est donc à charge INÉGALE, et ne vaut pas
 * comparaison.
 *
 * Trois GROUPES distincts sous la même scène three : le MONDE (une géométrie, un matériau par groupe de
 * surface — remonté au seul changement de cuisson), les ACCENTS de sol (instanciés, remontés à la teinte)
 * et les BILLBOARDS (invalidés à la position visuelle des acteurs, donc à la frame pendant une marche).
 * Le canevas est posé SOUS le SVG du stage et sans événements de pointeur : overlays, picking et voiles
 * restent au SVG (lots P2-3 / P2-7).
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Dims } from '../../geometry/iso';
import type { Scene } from '../../state/scene';
import { affineCamera } from '../backends/webgl/cameras';
import { pxPerM } from '../backends/webgl/worldTris';
import {
  BILLBOARD_BOX_ASPECT,
  anchorAndSize,
  billboardHeightM,
  billboardTextureKey,
  billboardView,
  rasterPxHeight,
} from '../backends/webgl/billboardMath';
import { clearBillboardTextures, getBillboardTexture, svgToTexture } from '../backends/webgl/svgTexture';
import { clearPeriodTextures, getPeriodTexture } from '../backends/webgl/periodTexture';
import { clearFaceBakes, getFaceBake } from '../backends/webgl/faceBake';
import {
  actorBillboards,
  applyCutawayMask,
  applyVisibilityTint,
  bakeWorldGeometry,
  billboardDepthOffsetUnits,
  billboardPose,
  collectBillboards,
  contactShadow,
  wantsContactShadow,
  type ActorPose,
  type BillboardSubject,
  type KeepEl,
  type SceneBillboardEls,
  type TintAt,
} from '../backends/webgl/sceneMeshes';
import { buildGroundAccentMeshes, maskGroundAccents, sceneGroundAccents } from '../backends/webgl/groundAccents';
import { stage3dFraming } from './stage3dCamera';

/** Fond du canevas — celui des planches QC, sous les mêmes voiles d'ambiance que l'affine. */
const BG = 0x14161f;

/** Convention de taille monde des billboards retenue pour le JEU (cf. `billboardMath`). */
const CONVENTION = 'jeu' as const;

export interface GameStage3DProps {
  scene: Scene;
  /** Dimensions de carte AFFICHÉES (cran, edge-on, projection) — la même valeur que consomme le SVG. */
  dims: Dims;
  /** Mètres par tuile. */
  mpt: number;
  /** Translation caméra du stage (unités de viewBox). */
  cam: { x: number; y: number };
  /** Zoom APPLIQUÉ (creux de transition de cran compris). */
  zoom: number;
  /** Teinte de visibilité par case. */
  tintAt: TintAt;
  /** Verdict de dégagement d'architecture (canal GÉOMÉTRIE). */
  keepEl: KeepEl;
  /** Éléments de scène à billboarder — la sortie des BUILDERS du stage, donc les mêmes filtres que la
   *  voie affine (embuscade, enrôlé, couverture, étage, hors-vue). Cet écran ne les recalcule PAS. */
  els: SceneBillboardEls;
  /** Acteurs à la position VISUELLE de la frame (le glissé de marche). */
  actors: readonly ActorPose[];
}

/** Un billboard monté : ce qu'il faut pour le RE-POSER quand la caméra bouge, sans le reconstruire. */
interface Board {
  sub: BillboardSubject;
  quad: { widthM: number; heightM: number; centerLiftM: number };
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
}

/** Vide un groupe et libère ce qu'il portait — un groupe se reconstruit ENTIER, jamais par différence.
 *  La géométrie marquée `emprunte` appartient au bake (`bakeWorldGeometry`) : elle survit au groupe. */
function viderGroupe(groupe: THREE.Group): void {
  for (const enfant of [...groupe.children]) {
    groupe.remove(enfant);
    const porteur = enfant as THREE.Mesh;
    if (porteur.material) {
      const mats = Array.isArray(porteur.material) ? porteur.material : [porteur.material];
      for (const m of mats) m.dispose();
    }
    if (porteur.geometry && !porteur.userData.emprunte) porteur.geometry.dispose();
  }
}

export function GameStage3D({ scene, dims, mpt, cam, zoom, tintAt, keepEl, els, actors }: GameStage3DProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const boardsRef = useRef<Board[]>([]);
  const camRot = dims.rot ?? 0;

  const three = useRef<THREE.Scene>();
  const monde = useRef<THREE.Group>();
  const touffes = useRef<THREE.Group>();
  const panneaux = useRef<THREE.Group>();
  if (!three.current) {
    three.current = new THREE.Scene();
    monde.current = new THREE.Group();
    touffes.current = new THREE.Group();
    panneaux.current = new THREE.Group();
    three.current.add(monde.current, touffes.current, panneaux.current);
  }

  // Le cache de textures est GLOBAL au module : changer de scène rend ses entrées mortes (les clés
  // portent l'identité des sujets de l'ancienne carte). Même vidange que l'écran de spike.
  useEffect(() => () => { clearBillboardTextures(); clearPeriodTextures(); clearFaceBakes(); }, [scene]);

  // ── CUISSON : la passe LOURDE, invalidée par la SEULE scène et la SEULE échelle. Ni le pas du groupe
  // ni le cran de caméra ne la rejouent — c'est ce que les deux passes en place ci-dessous garantissent.
  const baked = useMemo(() => bakeWorldGeometry(scene, mpt), [scene, mpt]);
  const geometry = baked.geometry;
  useEffect(() => () => baked.geometry.dispose(), [baked]);
  const accents = useMemo(() => sceneGroundAccents(scene, mpt), [scene, mpt]);
  // ── DÉGAGEMENT : compactage de l'index du monde cuit (aucun sommet touché, aucun matériau refait).
  useEffect(() => { applyCutawayMask(baked, keepEl); }, [baked, keepEl]);
  // ── TEINTE : réécriture en place des couleurs de sommet (elle ne retriangule rien).
  useEffect(() => { applyVisibilityTint(baked, tintAt); }, [baked, tintAt]);
  // Les touffes d'une nappe dégagée partent avec elle — MÊME loi, appliquée sur le MÊME semis cuit.
  const accentsVus = useMemo(() => maskGroundAccents(accents, keepEl), [accents, keepEl]);
  const decor = useMemo(() => collectBillboards(scene, mpt, tintAt, els), [scene, mpt, tintAt, els]);
  const acteurs = useMemo(() => actorBillboards(actors, scene, mpt, tintAt), [actors, scene, mpt, tintAt]);
  const subjects = useMemo(() => [...decor, ...acteurs], [decor, acteurs]);

  /** UNE frame : cadre le canevas sur son élément, dérive la caméra de l'intention du stage, re-pose les
   *  quads face à elle, dessine. */
  const dessiner = () => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !three.current) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const f = stage3dFraming({ dims, mpt, cam, zoom, canvas: { w, h } });
    const cible = new THREE.Vector3(f.centre.x, f.centre.y, f.centre.z);
    const boite = geometry.boundingBox;
    const rayon = boite ? boite.getSize(new THREE.Vector3()).length() / 2 : 100;
    const distance = Math.max(50, rayon * 4);
    const { camera } = affineCamera(f.kind, f.yawDeg, mpt, f.viewport, {
      target: cible,
      distance,
      radius: rayon + (boite ? cible.distanceTo(boite.getCenter(new THREE.Vector3())) : 0) + 8,
    });
    for (const b of boardsRef.current) {
      // Quad ALIGNÉ ÉCRAN, ancré aux PIEDS — exactement ce que fait le backend affine du sprite.
      b.mesh.quaternion.copy(camera.quaternion);
      b.mesh.position.copy(billboardPose(b.sub.anchor, b.quad.centerLiftM, camera.quaternion));
      b.material.polygonOffsetUnits = billboardDepthOffsetUnits(camera.near, camera.far);
    }
    renderer.render(three.current, camera);
  };

  // Renderer UNIQUE (le canevas ne se remonte jamais).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Aucun contexte WebGL (machine sans accélération, jsdom des tests de montage) : le canevas reste
    // vierge et le stage continue de tourner — il ne se plante pas.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (e) {
      console.warn('GameStage3D: aucun contexte WebGL — le monde volumique reste vierge.', e);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(BG, 1);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // ── GROUPE MONDE : la géométrie fusionnée, un matériau par groupe de surface.
  useEffect(() => {
    const groupe = monde.current;
    const renderer = rendererRef.current;
    if (!groupe || !renderer) return;
    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    // UN MATÉRIAU PAR GROUPE DE SURFACE : la géométrie reste fusionnée, seul le dessin se scinde.
    // Couleur CUITE (aucun éclairage dynamique) — le régime que la parité avec l'affine juge.
    const materials = geometry.userData.surfaceGroups.map((g) => {
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      if (g.bake && g.recipe) {
        const cuisson = getFaceBake(g.key, { color: g.color ?? '', recipe: g.recipe, part: g.part }, g.bake.wM, g.bake.hM, g.variant ?? 0, anisotropy);
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
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.userData.emprunte = true;
    groupe.add(mesh);
    dessiner();
    return () => viderGroupe(groupe);
    // Les MATÉRIAUX ne dépendent QUE de la cuisson : ni la teinte (elle vit dans les couleurs de sommet)
    // ni le dégagement (il vit dans l'index) n'en refont un seul. Remettre `tintAt` ici reconstruisait
    // les 76 matériaux de l'arène à chaque pas (mesuré #1176).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry]);

  // ── GROUPE ACCENTS : les instances de touffes/mouchetis. Séparé du monde car il porte la teinte
  // AUTREMENT (par `instanceColor`, cuit au montage) : lui seul se remonte quand la visibilité change.
  useEffect(() => {
    const groupe = touffes.current;
    if (!groupe) return;
    for (const m of buildGroundAccentMeshes(accentsVus, { lit: false, tintAt })) groupe.add(m);
    dessiner();
    return () => viderGroupe(groupe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentsVus, tintAt]);

  // ── GROUPE BILLBOARDS : décor + acteurs. Rebâti quand les sujets changent — donc à la frame pendant
  // une marche (les textures, elles, restent en cache : seuls les quads se remontent). L'optimisation
  // « la boucle lit la position » est le lot P2-4.
  useEffect(() => {
    const groupe = panneaux.current;
    if (!groupe) return;
    let annule = false;
    const pxm = pxPerM(mpt);
    const quads = subjects.map((sub) => {
      const heightM = billboardHeightM(CONVENTION, sub.kind) * sub.scaleK;
      const quad = anchorAndSize(heightM, BILLBOARD_BOX_ASPECT);
      // L'art de décor n'existe qu'AUX crans (`propSvg(ref, dir, camRot)`) ; celui d'un personnage
      // l'ignore — l'y mettre rasteriserait quatre fois la MÊME image.
      const identity = sub.kind === 'prop' ? `${sub.identity}|r${camRot}` : sub.identity;
      const { view, mirror } = billboardView({ kind: 'ortho', yawDeg: camRot * 90 }, sub.facing);
      const pxHeight = rasterPxHeight(heightM, pxm);
      const key = billboardTextureKey(identity, view, mirror, pxHeight);
      return { sub, quad, texture: getBillboardTexture(key, () => svgToTexture(sub.svg(view, mirror, camRot), sub.box, pxHeight)) };
    });
    // `allSettled` : une texture rejetée ne doit pas emporter la frame entière — le sujet fautif est
    // sauté et signalé en `warn` (la console reste sans ERREUR).
    void Promise.allSettled(quads.map((q) => q.texture)).then((rendus) => {
      if (annule) return;
      const boards: Board[] = [];
      quads.forEach((q, i) => {
        const issue = rendus[i];
        if (issue.status !== 'fulfilled') {
          console.warn(`GameStage3D: billboard « ${q.sub.identity} » sauté — texture non rasterisée :`, issue.reason);
          return;
        }
        const geo = new THREE.PlaneGeometry(q.quad.widthM, q.quad.heightM);
        const mat = new THREE.MeshBasicMaterial({ map: issue.value, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
        mat.color.setScalar(q.sub.tint);
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -1;
        const mesh = new THREE.Mesh(geo, mat);
        groupe.add(mesh);
        boards.push({ sub: q.sub, quad: q.quad, mesh, material: mat });
        // Ombre de CONTACT : le rig ne porte aucune ellipse au pied (le décor, si).
        if (wantsContactShadow(q.sub.kind, false)) {
          const disque = contactShadow(q.sub.anchor, q.quad.widthM);
          disque.material.opacity *= q.sub.tint;
          groupe.add(disque);
        }
      });
      boardsRef.current = boards;
      dessiner();
    });
    return () => {
      annule = true;
      boardsRef.current = [];
      viderGroupe(groupe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, mpt, camRot]);

  // La frame se rejoue à CHAQUE rendu du stage (marche comprise : le glissé re-rend `IsoStage`).
  useEffect(dessiner);

  // Le canevas OCCUPE la boîte du stage : c'est la MÊME boîte que le SVG, donc la même classe
  // (`.iso-stage` — aucun sélecteur de domaine de plus, cf. cliquet CSS `ui-ratchets` xii). Les deux
  // seules choses qui l'en distinguent sont posées ici : il ne reçoit aucun pointeur (tout le picking
  // reste au SVG), et il se peint SOUS lui (ordre du DOM).
  return <canvas ref={canvasRef} className="iso-stage" style={{ pointerEvents: 'none' }} aria-hidden="true" />;
}
