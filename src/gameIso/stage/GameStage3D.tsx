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
 *  - POSE : la caméra suit les crans du store (`stage3dCamera`) et, pendant une MARCHE, l'intention
 *    du stage à l'instant de la frame (`anim.cam`) — rien d'autre ne bouge la vue.
 *  - MARCHE (P2-4) : la boucle de rendu lit elle-même le glissement (`anim.glide`) et ne déplace que
 *    les matrices des quads concernés. Aucun rendu React, aucun sommet, aucun matériau.
 *
 * LUMIÈRE (P2-5) : le CANEVAS porte toute la luminosité de la scène — une ambiante au palier de lumière
 * du moment et, dehors et de jour, un SOLEIL qui suit l'heure d'horloge et le nord de la carte
 * (`stage/stageLights.ts`, décision ; cet écran ne fait que monter ses lampes et brancher les ombres).
 * Le voile de nuit du SVG reste à la voie affine — deux propriétaires de luminosité en peindraient deux
 * paliers l'un sur l'autre. Les matériaux du monde sont TOUJOURS lambertiens : sans soleil, l'ambiante
 * seule les porte, et le lever/coucher n'a plus de régime à basculer.
 * Les BILLBOARDS, eux, ne le sont jamais : la normale d'un quad aligné écran est l'axe caméra, un
 * lambertien y mesurerait l'angle caméra↔soleil et la luminosité d'un personnage suivrait la rotation
 * de la vue. Ils multiplient donc l'exposition GLOBALE de la frame (`surfaceLuminance`, la luminance
 * d'une surface horizontale). RÉSIDU ASSUMÉ de ce choix : un personnage sous l'ombre portée d'un
 * bâtiment garde l'exposition globale — il ne s'assombrit pas en entrant dans l'ombre.
 *
 * CANAUX D'AMBIANCE ENCORE ABSENTS (mesuré #1176, P2-2) — la voie affine (`stage/CulledScene`) les
 * applique OBJET PAR OBJET, cet écran porte la teinte de visibilité (`tintAt`) et la lumière globale
 * ci-dessus. Ils font partie de ce qui reste à porter AVANT que la double voie meure (cliquet
 * `stage/double-voie-ratchet.test.ts`, qui compte les consommateurs restants de la voie affine) :
 *  - champ de LUMIÈRE par case (`tileBrightness`, `CulledScene`) ;
 *  - opacité de PIÈCE / focus de salle (`roomOpacityOf`) ;
 *  - filtres de BROUILLARD, exploré vs inconnu (`fogFilterFor`, `FogLayer`).
 * Toute mesure de performance comparant les deux voies est donc à charge INÉGALE, et ne vaut pas
 * comparaison.
 *
 * Trois GROUPES distincts sous la même scène three : le MONDE (une géométrie, un matériau par groupe de
 * surface — remonté au seul changement de cuisson), les ACCENTS de sol (instanciés, remontés à la teinte)
 * et les BILLBOARDS (invalidés à la case LOGIQUE et à la signature de dessin des sujets, jamais au
 * glissement de marche : celui-ci ne touche que les matrices, dans la boucle).
 * Le canevas est posé SOUS le SVG du stage et sans événements de pointeur : les overlays et les voiles
 * restent au SVG, qui reçoit tous les événements (lot P2-7). Le hit-test de SPRITE, lui, ne peut plus
 * s'y lire — plus aucun jeton n'y porte de `data-cid` : cet écran INSCRIT son lanceur de rayon auprès
 * de `stage/spritePicker.ts`, la couture unique où le pointeur pose la question.
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
  collectBillboards,
  contactShadow,
  wantsContactShadow,
  type ActorPose,
  type KeepEl,
  type SceneBillboardEls,
  type TintAt,
  worldShadowBox,
} from '../backends/webgl/sceneMeshes';
import { billboardMaterial, poseBoards, type Board, type GlideAt } from './boardPose';
import { buildGroundAccentMeshes, maskGroundAccents, sceneGroundAccents } from '../backends/webgl/groundAccents';
import { ndcAt, pickNearestCid, type PickTarget } from '../backends/webgl/spriteRaycast';
import { setSpritePicker } from './spritePicker';
import { stage3dFraming } from './stage3dCamera';
import { stageLightScalars, stageLights } from './stageLights';

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
  /** Acteurs à leur case LOGIQUE — le glissement de marche passe par `anim`, pas par cette liste. */
  actors: readonly ActorPose[];
  /** Horloge de jeu (minutes) — SEULE entrée de la course du soleil, avec le nord de la scène. */
  gameTime: number;
  /** Mise en scène de lumière (`state.lightLevel`, 0..1) : prime sur le palier authoré de la scène,
   *  exactement comme pour les voiles du SVG. */
  lightLevel: number | null | undefined;
  /** Cadençage de la MARCHE, quand le stage en offre un (lot P2-4) : sans lui, cet écran ne bouge
   *  qu'aux rendus du stage. */
  anim?: StageWalkAnim;
}

/**
 * MARCHE lue par la BOUCLE DE RENDU (#1176, P2-4). Le stage reste la seule source d'intention : il
 * décide de la courbe de glissement et du cadrage, cet écran ne fait que les redemander à SA cadence.
 * Sans cet objet, rien ne bouge entre deux rendus React — le contrat d'avant le lot.
 */
export interface StageWalkAnim {
  /** Abonne une callback au battement de la marche (une passe par frame tant qu'un glissement dure). */
  subscribe: (onFrame: () => void) => () => void;
  /** Décalage MONDE (mètres) du sujet `cid` à l'instant de l'appel — `null` s'il ne marche pas. */
  glide: (cid: string) => { dx: number; dy: number; dz: number } | null;
  /** Translation caméra à l'instant de l'appel (mêmes unités que `cam`). */
  cam: () => { x: number; y: number };
}

/** Rien ne glisse : la pose d'une frame hors marche (la boucle ne demande alors que l'orientation). */
const AUCUN_GLISSEMENT: GlideAt = () => null;

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

export function GameStage3D({ scene, dims, mpt, cam, zoom, tintAt, keepEl, els, actors, gameTime, lightLevel, anim }: GameStage3DProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const boardsRef = useRef<Board[]>([]);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const camRot = dims.rot ?? 0;

  const three = useRef<THREE.Scene>();
  const monde = useRef<THREE.Group>();
  const touffes = useRef<THREE.Group>();
  const panneaux = useRef<THREE.Group>();
  const lampes = useRef<THREE.Group>();
  if (!three.current) {
    three.current = new THREE.Scene();
    monde.current = new THREE.Group();
    touffes.current = new THREE.Group();
    panneaux.current = new THREE.Group();
    lampes.current = new THREE.Group();
    three.current.add(monde.current, touffes.current, panneaux.current, lampes.current);
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

  // ── LUMIÈRE (P2-5) : la DÉCISION est prise en scalaires purs (`stageLights.ts`), l'écran n'en monte
  // que les conséquences. `lit` = un soleil éclaire RÉELLEMENT (il est levé ET au-dessus du fondu) :
  // ombres portées branchées, disque de contact rendu inutile. La même passe rejoue au montage des lampes.
  const lumière = useMemo(
    () => stageLightScalars({ scene, gameTime, lightLevel }),
    [scene, gameTime, lightLevel],
  );
  const { course, lit } = lumière;
  // Exposition de la frame, lue par la construction ASYNCHRONE des billboards (leur texture arrive après
  // le rendu qui l'a demandée) : la valeur du moment, jamais celle capturée à la demande.
  const lumRef = useRef(lumière.surfaceLuminance);
  lumRef.current = lumière.surfaceLuminance;
  // Demande de recuisson de la carte d'ombre, honorée par la prochaine frame (cf. `dessiner`).
  const ombresARefaire = useRef(true);
  // Boîte des CASTEURS (géométrie + quads de billboard) : c'est elle qui serre le frustum d'ombre.
  const shadowBox = useMemo(
    () => worldShadowBox(
      geometry.boundingBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)),
      subjects,
      (s) => anchorAndSize(billboardHeightM(CONVENTION, s.kind) * s.scaleK, BILLBOARD_BOX_ASPECT),
    ),
    [geometry, subjects],
  );

  /** UNE frame : cadre le canevas sur son élément, dérive la caméra de l'intention du stage, re-pose les
   *  quads face à elle (glissement de marche compris), dessine. Rien n'y est construit : cette passe est
   *  celle que la MARCHE rejoue soixante fois par seconde, hors de tout rendu React (P2-4). */
  const dessiner = () => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !three.current) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const f = stage3dFraming({ dims, mpt, cam: anim ? anim.cam() : cam, zoom, canvas: { w, h } });
    const cible = new THREE.Vector3(f.centre.x, f.centre.y, f.centre.z);
    const boite = geometry.boundingBox;
    const rayon = boite ? boite.getSize(new THREE.Vector3()).length() / 2 : 100;
    const distance = Math.max(50, rayon * 4);
    const { camera } = affineCamera(f.kind, f.yawDeg, mpt, f.viewport, {
      target: cible,
      distance,
      radius: rayon + (boite ? cible.distanceTo(boite.getCenter(new THREE.Vector3())) : 0) + 8,
    });
    // Quads ALIGNÉS ÉCRAN, ancrés aux PIEDS — exactement ce que fait le backend affine du sprite ; le
    // glissement de marche de l'instant y entre (`stage/boardPose.ts`, la passe pure).
    const aGlissé = poseBoards(boardsRef.current, camera, anim ? anim.glide : AUCUN_GLISSEMENT);
    // CARTE D'OMBRE : elle ne se recuit QUE quand ce qu'elle contient a bougé — un casteur qui glisse,
    // ou un montage (lampes, monde, billboards) qui l'a demandée. Une rotation de caméra, un zoom, une
    // frame de marche où personne ne glisse : la carte 2048² de la frame précédente reste valide.
    if (aGlissé || ombresARefaire.current) {
      renderer.shadowMap.needsUpdate = true;
      ombresARefaire.current = false;
    }
    cameraRef.current = camera; // la caméra de la DERNIÈRE frame : celle que le rayon de picking doit emprunter
    renderer.render(three.current, camera);
  };

  // HIT-TEST DE SPRITE (lot P2-3) : la voie volumique répond au pointeur par un RAYON — cibles = les
  // quads montés (ceux d'un combattant portent son id) plus les masses du monde, inscrites sans id
  // (une masse qui gagne le rayon = rien de cliquable ici, comme un mur peint par-dessus un jeton en
  // affine). L'inscription vit et meurt avec ce composant, qui n'est monté qu'en volumique.
  useEffect(() => {
    setSpritePicker((clientX, clientY) => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const cibles: PickTarget[] = [{ cid: null, object: monde.current! }];
      for (const b of boardsRef.current) cibles.push({ cid: b.sub.cid ?? null, object: b.mesh });
      return pickNearestCid(
        camera,
        cibles,
        ndcAt({ x: clientX - rect.left, y: clientY - rect.top }, { w: rect.width, h: rect.height }),
      );
    });
    return () => setSpritePicker(null);
  }, []);

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
    renderer.shadowMap.enabled = true;
    // La carte d'ombre ne se recuit PAS à chaque frame : rien ne la périme tant que ni le soleil ni un
    // casteur n'ont bougé, et la boucle de marche (P2-4) rend soixante fois par seconde. C'est
    // `dessiner` qui la redemande, au cas par cas (`shadowMap.needsUpdate`).
    renderer.shadowMap.autoUpdate = false;
    ombresARefaire.current = true;
    // `PCFSoftShadowMap` est DÉPRÉCIÉ depuis three 0.185 : le moteur le remplace lui-même par
    // `PCFShadowMap` à la première frame ombrée en criant à la console — on pose donc directement le
    // filtre réellement appliqué (rendu identique, console propre).
    renderer.shadowMap.type = THREE.PCFShadowMap;
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
    // UN MATÉRIAU PAR GROUPE DE SURFACE : la géométrie reste fusionnée, seul le dessin se scinde. Le
    // régime NE BASCULE PLUS avec la lumière : toujours lambertien, même sans soleil — l'ambiante porte
    // alors la scène à elle seule (`stageLights`), et le crépuscule n'a plus de marche d'escalier.
    const materials = geometry.userData.surfaceGroups.map((g) => {
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true });
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
    // Le monde caste et reçoit TOUJOURS : sans lampe à ombre, three ne compile aucun chemin d'ombre —
    // ces deux drapeaux ne coûtent alors rien, et le matériau cesse de dépendre de l'heure.
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    groupe.add(mesh);
    ombresARefaire.current = true;
    dessiner();
    return () => viderGroupe(groupe);
    // Les MATÉRIAUX ne dépendent QUE de la cuisson : ni la teinte (elle vit dans les couleurs de sommet),
    // ni le dégagement (il vit dans l'index), ni l'heure (le régime lambertien ne bascule plus) n'en
    // refont un seul. Remettre `tintAt` ici reconstruisait les 76 matériaux de l'arène à chaque pas
    // (mesuré #1176).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry]);

  // ── GROUPE ACCENTS : les instances de touffes/mouchetis. Séparé du monde car il porte la teinte
  // AUTREMENT (par `instanceColor`, cuit au montage) : lui seul se remonte quand la visibilité change.
  useEffect(() => {
    const groupe = touffes.current;
    if (!groupe) return;
    // Toujours lambertiens eux aussi — même régime que les faces du monde, dont ils prolongent le sol.
    for (const m of buildGroundAccentMeshes(accentsVus, { lit: true, tintAt })) {
      m.castShadow = true;
      m.receiveShadow = true;
      groupe.add(m);
    }
    ombresARefaire.current = true;
    dessiner();
    return () => viderGroupe(groupe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentsVus, tintAt]);

  // ── GROUPE BILLBOARDS : décor + acteurs. Rebâti quand les SUJETS changent — l'identité d'un sujet
  // porte sa case logique et sa signature de dessin, jamais le glissement de la marche : celui-ci
  // décale des quads déjà montés, dans `dessiner` (P2-4).
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
        // Matériau NON lambertien (`billboardMaterial`, cf. l'en-tête) éclairé par l'exposition GLOBALE
        // de la frame : celle de l'instant où la texture arrive, pas celle de la demande.
        const mat = billboardMaterial(issue.value, q.sub.tint * lumRef.current);
        const mesh = new THREE.Mesh(geo, mat);
        // Un quad PROJETTE son ombre même en Basic (le casteur ne connaît que sa géométrie et son alpha) ;
        // `receiveShadow` n'aurait, lui, aucun effet sous ce matériau.
        mesh.castShadow = true;
        groupe.add(mesh);
        const board: Board = { sub: q.sub, quad: q.quad, mesh, material: mat };
        boards.push(board);
        // Ombre de CONTACT : le rig ne porte aucune ellipse au pied (le décor, si). Elle entre dans le
        // board — donc dans la passe de pose, donc elle suit le sujet qui glisse. Sous le soleil, c'est
        // l'ombre PROJETÉE qui fait foi (`wantsContactShadow`) — sinon le personnage en porte deux.
        if (wantsContactShadow(q.sub.kind, lit)) {
          const disque = contactShadow(q.sub.anchor, q.quad.widthM);
          disque.material.opacity *= q.sub.tint;
          board.shadow = disque;
          groupe.add(disque);
        }
      });
      boardsRef.current = boards;
      ombresARefaire.current = true;
      dessiner();
    });
    return () => {
      annule = true;
      boardsRef.current = [];
      viderGroupe(groupe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, mpt, camRot, lit]);

  // ── EXPOSITION des billboards : elle change à l'heure, au palier de lumière et à la porte franchie —
  // toutes choses qui ne justifient pas de rerasteriser un seul sujet. Une passe à part, qui ne touche
  // que la couleur des matériaux déjà montés.
  useEffect(() => {
    for (const b of boardsRef.current) b.material.color.setScalar(b.sub.tint * lumière.surfaceLuminance);
    dessiner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lumière.surfaceLuminance, subjects]);

  // ── GROUPE LAMPES : ce que `stageLights` décide, monté tel quel. Groupe à part des trois autres car
  // il vit sur d'autres entrées (l'heure, le palier de lumière, la boîte des casteurs) et ne coûte ni
  // géométrie ni matériau : une lampe se remplace, elle ne se reconstruit pas avec le monde.
  useEffect(() => {
    const groupe = lampes.current;
    if (!groupe) return;
    const { ambient, sun } = stageLights({ scene, gameTime, lightLevel, shadowBox });
    groupe.add(ambient);
    if (sun) groupe.add(sun, sun.target);
    ombresARefaire.current = true;
    dessiner();
    return () => {
      for (const enfant of [...groupe.children]) groupe.remove(enfant);
      ambient.dispose();
      sun?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, gameTime, lightLevel, shadowBox]);

  // La frame se rejoue à CHAQUE rendu du stage — et, pendant une MARCHE, au battement de celle-ci :
  // c'est la boucle de rendu qui lit alors la position visuelle, pas React (P2-4). L'effet n'a pas de
  // dépendances par CONSTRUCTION : il court après chaque rendu, donc `dessiner` réabonné est toujours
  // celui des props courantes.
  useEffect(() => {
    dessiner();
    return anim?.subscribe(dessiner);
  });

  // Le canevas OCCUPE la boîte du stage : c'est la MÊME boîte que le SVG, donc la même classe
  // (`.iso-stage` — aucun sélecteur de domaine de plus, cf. cliquet CSS `ui-ratchets` xii). Les deux
  // seules choses qui l'en distinguent sont posées ici : il ne reçoit aucun pointeur (les événements
  // restent au SVG, qui interroge ce monde par le rayon inscrit ci-dessus), et il se peint SOUS lui
  // (ordre du DOM).
  // `data-sun` : la SEULE trace lisible du soleil réellement MONTÉ (azimut/élévation, degrés) — un
  // canevas WebGL n'a pas d'arbre à interroger, et la recette navigateur comme les tests de montage ont
  // besoin de savoir SI une directionnelle est là et OÙ elle est. Absent = aucune directionnelle
  // (intérieur, nuit, ou soleil encore sous son fondu de lever/coucher).
  // `data-lum` : l'EXPOSITION de la frame (luminance d'une surface horizontale, en part d'albédo). C'est
  // par elle que la parité avec la voie affine et la continuité du crépuscule se mesurent à l'écran.
  return (
    <canvas
      ref={canvasRef}
      className="iso-stage"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
      data-sun={lit && course ? `${course.azimuthDeg.toFixed(1)},${course.elevationDeg.toFixed(1)}` : undefined}
      data-lum={lumière.surfaceLuminance.toFixed(4)}
    />
  );
}
