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
 * DEUX REGARDS, UN SEUL MONDE (#1176, P3-1a) : le cadre de la frame est une UNION (`StageFrame`) —
 * ortho affine cadrée par le stage SVG (`IsoStage`), ou PERSPECTIVE à hauteur d'homme cadrée par la
 * pose du groupe (`PovStage`). Tout le reste de cet écran l'ignore : mêmes cuisson, teinte, lumière,
 * billboards et intempéries. La première personne n'a ni marques de sol, ni halos, ni picker inscrit —
 * ce sont des affordances de la vue de plateau, et le POV n'en a jamais porté.
 *
 * LUMIÈRE (P2-5) : le CANEVAS porte toute la luminosité de la scène — une ambiante au palier de lumière
 * du moment et, dehors et de jour, un SOLEIL qui suit l'heure d'horloge et le nord de la carte
 * (`stage/stageLights.ts`, décision ; cet écran ne fait que monter ses lampes et brancher les ombres).
 * FLAQUES (#1245) : les sources PONCTUELLES de la scène (brasero posé, lanterne portée — la liste que
 * le champ mécanique de vision consomme) posent leur lumière par un POOL de compte FIXE dont seules les
 * intensités bougent (`stage/stagePointLights.ts`, décision ; le pool ne se monte qu'une fois). Une
 * lampe PORTÉE suit son porteur sur la MÊME courbe de glissement que son quad (`stage/boardPose.ts`).
 * Le voile de nuit du SVG reste à la voie affine — deux propriétaires de luminosité en peindraient deux
 * paliers l'un sur l'autre. Les matériaux du monde sont TOUJOURS lambertiens : sans soleil, l'ambiante
 * seule les porte, et le lever/coucher n'a plus de régime à basculer.
 * Les BILLBOARDS, eux, ne le sont jamais : la normale d'un quad aligné écran est l'axe caméra, un
 * lambertien y mesurerait l'angle caméra↔soleil et la luminosité d'un personnage suivrait la rotation
 * de la vue. Leur lumière est donc un SCALAIRE, mais un scalaire PAR SUJET (#1245, L3) : l'exposition
 * de la frame (`surfaceLuminance`) PLUS les flaques qui l'atteignent, par la même loi que le sol
 * (`billboardExposure`) — sans quoi le sol s'allume et les personnages restent plats. RÉSIDU ASSUMÉ :
 * un personnage sous l'ombre portée d'un bâtiment garde l'exposition de la frame — il ne s'assombrit
 * pas en entrant dans l'ombre, et la flaque qu'il reçoit est omnidirectionnelle.
 *
 * INTEMPÉRIES (P2-6) : la précipitation authorée de la scène TOMBE dans le volume — un semis de quads
 * instanciés qui descend à la cadence de la frame, borné par le MÊME couvert bâti que le dégagement
 * (`shelterField`, `builders/roofs.ts`) : rien ne tombe sous un toit, y compris sous une nappe que le
 * cutaway a levée. La voie affine garde son voile d'écran (`stage/WeatherVeil.tsx`), qui ne se monte
 * plus ici. PÉRIMÈTRE MESURÉ : ce que la voie volumique exprime, c'est ce qui TOMBE (`precip` en
 * donnée) — un type de météo qui ne fait rien tomber, le brouillard, n'y sème donc aucune particule ;
 * sa brume volumique est le ticket #1247.
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
import { freeYaw, type Dims, type Rot } from '../../geometry/iso';
import { heightAt, type Scene } from '../../state/scene';
import { DIR8_ORDER, type Dir8 } from '../../state/dir8';
import { affineCamera, povCamera } from '../backends/webgl/cameras';
import { dir8Basis, farTilesOf } from '../pov/camera';
import { pxPerM } from '../backends/webgl/worldTris';
import {
  billboardTextureKey,
  billboardView,
  rasterPxHeight,
  subjectQuad,
  type BillboardCamera,
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
import { AUCUN_CHROME, billboardMaterial, poseBoards, type Board, type ChromeAt, type FrameCamera, type GlideAt } from './boardPose';
import { buildGroundAccentMeshes, maskGroundAccents, sceneGroundAccents } from '../backends/webgl/groundAccents';
import {
  HIGHLIGHT_SLOTS,
  buildHighlightMesh,
  groupHighlights,
  slotCapacity,
  writeHighlightInstances,
  type HighlightSlot,
} from '../backends/webgl/highlightMeshes';
import type { HighlightEl } from '../builders/highlights';
import { NO_DYNAMIC_MARKS, type DynamicMarks } from '../builders/dynamicMarks';
import { DYN_MARK_SLOTS, buildDynamicMarkMesh } from '../backends/webgl/dynamicMarkMeshes';
import { poseDynamicMarks, type DynMarkPools } from './dynamicMarkPose';
import { NO_INTERACTION_HALOS, type InteractionHalos } from '../builders/interactHalos';
import { HALO_SLOTS, buildHaloMesh } from '../backends/webgl/interactHaloMeshes';
import { poseInteractHalos, type HaloPools } from './interactHaloPose';
import { ndcAt, pickNearestCid, type PickTarget } from '../backends/webgl/spriteRaycast';
import { setSpritePicker } from './spritePicker';
import { stage3dFraming, type Stage3dFraming } from './stage3dCamera';
import { stageLightScalars, stageLights } from './stageLights';
import { applyFlicker, applyPointLights, createPointLightPool, hasFlicker, pointLightWrites, POINT_LIGHT_BUDGET, type PointLightSlots } from './stagePointLights';
import type { LightSource } from '../../state/vision';
import { scenePrecip } from '../catalog/ambiance';
import { isSheltered, shelterField } from '../builders/roofs';
import {
  buildPrecipMesh,
  precipBasis,
  retainWeatherField,
  stepWeatherField,
  writePrecipMatrices,
  type PrecipSlot,
  type ShelteredAt,
} from '../backends/webgl/weatherParticles';

/** Fond du canevas — celui des planches QC, sous les mêmes voiles d'ambiance que l'affine. */
const BG = 0x14161f;

/** Convention de taille monde des billboards retenue pour le JEU (cf. `billboardMath`). */
export const CONVENTION = 'jeu' as const;

/** Ce que cet écran DEMANDE à son renderer, et rien de plus — la surface exacte de sa dépendance à
 *  three côté sortie. Un banc d'essai peut donc en fournir un SANS contexte WebGL : jsdom n'en a
 *  aucun, et la passe de dessin s'arrêterait à sa première garde sans rien montrer de la boucle. */
export interface StageRenderer {
  setPixelRatio(ratio: number): void;
  setClearColor(color: number, alpha: number): void;
  setSize(w: number, h: number, updateStyle: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
  shadowMap: { enabled: boolean; autoUpdate: boolean; needsUpdate: boolean; type: THREE.ShadowMapType };
  capabilities: { getMaxAnisotropy(): number };
}

/** FABRIQUE du renderer — REGISTRE mutable lu à l'appel, jamais un mock de module (la suite partage
 *  son graphe, `src/vi-mock-isolate-guard.test.ts`). `null` = le renderer de three, celui du jeu. */
let fabriqueRenderer: ((canvas: HTMLCanvasElement) => StageRenderer) | null = null;

/** Pose (ou retire, avec `null`) la fabrique de renderer de cet écran. */
export function setStageRendererFactory(fabrique: ((canvas: HTMLCanvasElement) => StageRenderer) | null): void {
  fabriqueRenderer = fabrique;
}

/**
 * CADRE d'une frame : ce dont la caméra se dérive, et RIEN de plus. Une UNION, parce que les deux
 * regards n'ont aucune entrée commune — l'affine se cadre par la transformation d'écran du stage
 * (`stage3dFraming` → `affineCamera`), le POV par la pose du groupe (`povCamera`). Ce que le mode
 * n'utilise pas ne lui est donc pas fournissable : la vue première personne n'a ni cran, ni zoom, ni
 * translation de viewBox à fabriquer pour satisfaire une signature.
 *
 * Le POV N'ENTRE PAS dans `ProjKind`/`Dims` (#1176, P3-1a) : la projection affine, le picking et les
 * trois modules purs qui en dérivent (`geometry/iso`, `stage/projection`, `stage3dCamera`) resteraient
 * à couvrir un cas qu'aucun d'eux ne sait exprimer.
 */
export type StageFrame =
  /** Regard AFFINE : le cran/lacet, la translation caméra et le zoom du stage SVG. */
  | { mode: 'affine'; dims: Dims; cam: { x: number; y: number }; zoom: number }
  /**
   * Regard PREMIÈRE PERSONNE : la case du groupe, son cap, et le milieu (dont dépend la portée).
   * `cid` = le sujet dont le GLISSEMENT de marche déplace l'œil (`anim.glide`) : la caméra suit la
   * position CONTINUE du meneur, comme la caméra volumique affine suit `anim.cam()`. ARBITRAGE
   * D'INGÉNIERIE (#1176, P3-1a, révisable au goût final) : le pas-à-pas du POV SVG était une forme
   * du PEINTRE (une projection recalculée par pas), pas une intention de jeu — `makeCamera` accepte
   * une position continue, et les billboards du monde glissent déjà.
   * Le LACET, lui, reste SEC : `facing` est un `Dir8`, donc l'œil pivote de 45° d'un coup là où la
   * position, elle, glisse. Statu quo du POV SVG — même arbitrage d'ingénierie, révisable au goût.
   */
  | { mode: 'pov'; partyPos: { x: number; y: number; z?: number }; facing: Dir8; indoor: boolean; cid: string | null };

export interface GameStage3DProps {
  scene: Scene;
  /** Mètres par tuile. */
  mpt: number;
  /** D'où la caméra de la frame se dérive (cf. `StageFrame`). */
  frame: StageFrame;
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
  /** Sources de lumière PONCTUELLES de la scène (posées + portées) — la MÊME liste que le champ
   *  mécanique de vision consomme (`state/visionState.ts` `sceneLightSources`) : cet écran ne les
   *  recollecte pas, il en monte les flaques (`stage/stagePointLights.ts`). */
  lights: readonly LightSource[];
  /** MARQUES DE CASES du combat (#1176, P3-0c) — la sortie du builder PUR `builders/highlights`, la
   *  même que la voie affine projette en losanges. Cet écran ne les recalcule pas : il les pose à plat
   *  dans le monde. */
  highlights?: readonly HighlightEl[];
  /** MARQUES DYNAMIQUES (#1176, P3-0d) — lien d'engagement, contour de l'actif, repère du groupe : la
   *  MÊME dérivation pure que la voie affine (`builders/dynamicMarks`), en cases LOGIQUES. Leur
   *  position se prend à la FRAME, sur le glissement de `anim` — jamais à un rendu React. */
  dynMarks?: DynamicMarks;
  /** HALOS D'INTERACTION (#1176, P3-0g) — affordance de fouille d'un décor, halo de survol d'un PNJ
   *  interlocuteur : la MÊME dérivation pure que la voie affine (`builders/interactHalos`). Leurs
   *  PULSATIONS sont des fonctions de la frame (`stage/interactHaloPose`), là où la voie affine les
   *  laisse à ses keyframes CSS. Absents = aucun halo, et pas une frame de plus. */
  halos?: InteractionHalos;
  /** ALLURE des jetons (#1176, P3-0f) — fantôme hors Ligne de Vue, corps hors d'action, cible
   *  survolée : la même dérivation pure que la voie affine (`builders/tokenChrome`), demandée à la
   *  FRAME et posée sur le matériau des quads déjà montés. Absente = aucun jeton ne se distingue. */
  chromeAt?: ChromeAt;
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

/** CRAN d'ART d'une vue. La CAMÉRA suit le lacet continu (`stage3dFraming` lit `Dims.yawDeg`), mais
 *  l'art des billboards est DISCRET — l'atlas de décor n'existe qu'aux quarts de tour, et une identité
 *  de texture qui suivrait le lacet réel recuirait toute la planche à chaque frame de rotation.
 *  Le lacet se PLANCHÉRISE, il ne s'arrondit pas : l'edge-on est le losange à `+45` (`geometry/iso.ts`),
 *  donc les huit vues de production tombent aux lacets `r·90` et `r·90+45` — un arrondi au plus proche
 *  donnerait `r+1` aux quatre vues de face, et l'atlas y peindrait le cran voisin. PUR. */
export function artRot(dims: Dims): Rot {
  return ((Math.floor((freeYaw(dims) ?? (dims.rot ?? 0) * 90) / 90) % 4 + 4) % 4) as Rot;
}

/** LACET (degrés, convention de `freeYaw`/`artRot`) du regard PREMIÈRE PERSONNE de cap `facing`.
 *  La caméra affine du cran `r` regarde la diagonale `DIR8_ORDER[(7 + 2r) % 8]` : à ce cap, `povView`
 *  rend exactement ce que rend `project(·, r)` sur les huit orientations (parité mesurée,
 *  `billboards-pov.test.tsx`). Les huit caps se répartissent donc tous les 45°, le cap N à 45°. PUR. */
export function povYawDeg(facing: Dir8): number {
  return ((DIR8_ORDER.indexOf(facing) + 1) * 45) % 360;
}

/** CRAN d'ART d'un regard première personne (#1176, P3-1b) : le lacet de son cap, PLANCHÉRISÉ par la
 *  MÊME loi qu'`artRot` — l'atlas de décor n'existe qu'aux quarts de tour (`propSvg(ref, dir, camRot)`),
 *  et les quatre caps CARDINAUX tombent entre deux crans. Sans lui, les props d'une vue première
 *  personne gardent le cran de la dernière vue de plateau. PUR. */
export function povArtRot(facing: Dir8): Rot {
  return (Math.floor(povYawDeg(facing) / 90) % 4) as Rot;
}

export function GameStage3D({ scene, mpt, frame, tintAt, keepEl, els, actors, gameTime, lightLevel, lights, highlights, dynMarks, halos, chromeAt, anim }: GameStage3DProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const boardsRef = useRef<Board[]>([]);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const pov = frame.mode === 'pov';
  // CAP du regard première personne — 8 états DISCRETS, et la SEULE entrée d'art de cette vue : la vue
  // d'entité s'y branche (`billboardView` perspective), et le cran de l'atlas de décor s'en dérive.
  // Les deux sortent du MÊME examen du cadre : le cap est la source du cran, pas un second calcul.
  const { povFacing, camRot } = frame.mode === 'pov'
    ? { povFacing: frame.facing, camRot: povArtRot(frame.facing) }
    : { povFacing: null, camRot: artRot(frame.dims) };

  const three = useRef<THREE.Scene>();
  const monde = useRef<THREE.Group>();
  const touffes = useRef<THREE.Group>();
  const panneaux = useRef<THREE.Group>();
  const lampes = useRef<THREE.Group>();
  const flaques = useRef<THREE.Group>();
  const intemperies = useRef<THREE.Group>();
  const marques = useRef<THREE.Group>();
  const marquesDyn = useRef<THREE.Group>();
  const halosGroupe = useRef<THREE.Group>();
  if (!three.current) {
    three.current = new THREE.Scene();
    monde.current = new THREE.Group();
    touffes.current = new THREE.Group();
    panneaux.current = new THREE.Group();
    lampes.current = new THREE.Group();
    // Groupe à part de `lampes` : celui-là se VIDE et se reconstruit (l'ambiante et le soleil suivent
    // l'heure), le pool de flaques ne se monte QU'UNE fois — un vidage partagé le démonterait avec lui,
    // et ferait varier le compte de lampes ponctuelles que le pool existe justement pour figer.
    flaques.current = new THREE.Group();
    intemperies.current = new THREE.Group();
    // Groupe des MARQUES (P3-0c) : monté une fois, jamais vidé par événement de combat — ses pools ne
    // se redimensionnent qu'au PALIER de capacité, leur contenu se réécrit en place.
    marques.current = new THREE.Group();
    // Groupe FRÈRE des marques DYNAMIQUES (P3-0d) : à part parce que ses pools ne dépendent d'AUCUNE
    // capacité d'état — ils sont montés une fois à capacité fixe, et réécrits à la FRAME (jamais à un
    // rendu React, comme les marques de case du groupe voisin).
    marquesDyn.current = new THREE.Group();
    // Groupe des HALOS D'INTERACTION (P3-0g) : même politique que le précédent — capacité fixe, contenu
    // réécrit à la frame. À part de lui parce qu'il vit hors du combat, et que ses pools PULSENT (leur
    // opacité de matériau change à chaque frame, cf. `stage/interactHaloPose`).
    halosGroupe.current = new THREE.Group();
    three.current.add(monde.current, touffes.current, panneaux.current, lampes.current, flaques.current, intemperies.current, marques.current, marquesDyn.current, halosGroupe.current);
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
  // ── MARQUES DE CASES (P3-0c) : les éléments du builder, rangés par SLOT de montage. La CAPACITÉ des
  // pools ne suit que les paliers (`slotCapacity`) — un anneau de cible qui apparaît ne redimensionne
  // rien, il s'écrit dans le pool déjà là.
  const marquesGroupées = useMemo(() => groupHighlights(highlights ?? []), [highlights]);
  const capacités = useMemo(
    () => HIGHLIGHT_SLOTS.map((s) => slotCapacity(marquesGroupées.get(s)?.length ?? 0)),
    [marquesGroupées],
  );
  const clésCapacités = capacités.join(',');
  const poolsMarques = useRef(new Map<HighlightSlot, THREE.InstancedMesh>());
  // ── MARQUES DYNAMIQUES (P3-0d) : trois pools à capacité FIXE, montés une fois (l'effet plus bas).
  // Leur contenu ne se déduit d'aucun état React — il se réécrit à la frame, dans `dessiner`.
  const poolsDyn = useRef<DynMarkPools>({});
  // ── HALOS D'INTERACTION (P3-0g) : même politique de pool, et un contenu qui BAT (l'opacité de leurs
  // matériaux est une fonction de la frame — la conversion des keyframes CSS vit dans la passe de pose).
  const poolsHalos = useRef<HaloPools>({});
  // Le SOL d'une case, la même convention que le builder de marques (0 au rez, la surface réelle en
  // hauteur) : c'est la hauteur d'où le glissement vertical de la marche se compte.
  const solM = (x: number, y: number, z: number) => (z ? heightAt(scene, Math.round(x), Math.round(y), z) : 0);

  // ── LUMIÈRE (P2-5) : la DÉCISION est prise en scalaires purs (`stageLights.ts`), l'écran n'en monte
  // que les conséquences. `lit` = un soleil éclaire RÉELLEMENT (il est levé ET au-dessus du fondu) :
  // ombres portées branchées, disque de contact rendu inutile. La même passe rejoue au montage des lampes.
  const lumière = useMemo(
    () => stageLightScalars({ scene, gameTime, lightLevel }),
    [scene, gameTime, lightLevel],
  );
  const { course, lit } = lumière;
  // ── FLAQUES (#1245, L1) : ce que les sources de lumière de la scène écrivent sur le pool de lampes
  // ponctuelles. Décision PURE (`stagePointLights.ts`), appliquée plus bas sur un pool de compte FIXE.
  // `prev` = la table de la frame précédente, par quoi une source GARDE son slot tant qu'elle vit :
  // l'index d'une lampe ne dépend jamais de l'ordre de la liste de sources.
  const slotsPrécédents = useRef<PointLightSlots | null>(null);
  const flaquesÉcrites = useMemo(
    () => pointLightWrites(lights, { scene, mpt, ambianceLum: lumière.ambianceLum, prev: slotsPrécédents.current ?? undefined }),
    [lights, scene, mpt, lumière.ambianceLum],
  );
  // Le POOL de lampes ponctuelles monté (rempli par l'effet de montage plus bas) : la passe de pose s'en
  // sert pour emmener une lampe PORTÉE avec son porteur qui glisse, et l'exposition d'un billboard se
  // mesure dessus — c'est la lampe montée, jamais la table, qui dit ce qui éclaire à cet instant.
  const pool = useRef<THREE.PointLight[]>([]);
  // Demande de recuisson de la carte d'ombre, honorée par la prochaine frame (cf. `dessiner`).
  const ombresARefaire = useRef(true);
  // Boîte des CASTEURS (géométrie + quads de billboard) : c'est elle qui serre le frustum d'ombre.
  const shadowBox = useMemo(
    () => worldShadowBox(
      geometry.boundingBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)),
      subjects,
      (s) => subjectQuad(CONVENTION, s),
    ),
    [geometry, subjects],
  );

  // ── INTEMPÉRIES (P2-6) : ce qui TOMBE dans le monde. La PORTE est celle des DEUX voies
  // (`scenePrecip` → `sceneWeatherFx` : une météo authorée, et jamais en intérieur) ; densité, vitesse
  // de chute, vent, taille et teinte viennent tous de la donnée — aucun type de météo n'est nommé ici.
  // `null` = rien ne tombe, et pas une frame ne s'en occupe.
  const precip = useMemo(() => scenePrecip(scene), [scene]);
  // Le semis SURVIT aux mutations de scène : il est retenu sur ce qui le DÉTERMINE (scène, type de
  // météo, emprise du volume — `retainWeatherField`), pas sur la référence de l'objet scène. Un pas de
  // combattant produit une référence de scène par frame ; re-semer là-dessus téléporterait l'averse
  // entière (1459/1459 particules mesurées sur La Diligence).
  const semisRetenu = useRef<PrecipSlot | null>(null);
  semisRetenu.current = precip ? retainWeatherField(semisRetenu.current, scene, precip, 'meteo') : null;
  const champ = semisRetenu.current?.champ ?? null;
  // SOUS COUVERT : le MÊME champ que le dégagement d'architecture interroge (`builders/roofs.ts`) —
  // une seule vérité de « suis-je sous un toit ? ». Il ignore la vue : une nappe levée par le cutaway
  // abrite toujours ; le couvert suit le PLAN, et se recalcule avec la scène qui le porte.
  const abris = useMemo(() => shelterField(scene), [scene]);
  const sousCouvert = useMemo<ShelteredAt>(
    () => (xM, zM, yM) => isSheltered(abris, xM / mpt, zM / mpt, yM),
    [abris, mpt],
  );
  const precipMesh = useRef<THREE.InstancedMesh | null>(null);
  const precipBase = useRef<Float32Array | null>(null);
  const dernierPas = useRef(0); // horodatage du dernier pas de chute
  const dernierRendu = useRef(0); // horodatage de la dernière frame dessinée

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
    // CAMÉRA DE LA FRAME : l'union de cadre (`StageFrame`) dit laquelle des deux se dérive, et rien
    // au-delà de ces quelques lignes ne connaît le regard employé.
    let camera: FrameCamera;
    let f: Stage3dFraming | null = null;
    if (frame.mode === 'pov') {
      // La caméra GLISSE avec le marcheur : la case logique du groupe plus le décalage MONDE de
      // l'instant (`anim.glide`, mètres → cases). Repère de `walkGlideM` : dx = est, dz = sud.
      const g = frame.cid && anim ? anim.glide(frame.cid) : null;
      const pos = g
        ? { x: frame.partyPos.x + g.dx / mpt, y: frame.partyPos.y + g.dz / mpt, z: frame.partyPos.z }
        : frame.partyPos;
      // PORTÉE : la distance de rendu du milieu (`farTilesOf`, donnée d'ambiance), jamais un far
      // généreux. Le ratio near/far d'un far de 4 km quantifie la profondeur au point que la
      // séparation coplanaire ne survit plus (`backends/webgl/cameras.ts`, `orthoDepthRange`).
      // ÉCART RÉSIDUEL : cet écran ne pose NI brume NI ciel (`outdoorFog`/`skyTexture`,
      // `backends/webgl/sceneMeshes.ts`, consommés par le seul `SpikeScreen`) — l'horizon est donc
      // tranché net sur le fond `BG` à cette distance. Câblage prévu au lot P3-1c.
      camera = povCamera(scene, pos, frame.facing, { w, h }, farTilesOf(frame.indoor) * mpt);
    } else {
      f = stage3dFraming({ dims: frame.dims, mpt, cam: anim ? anim.cam() : frame.cam, zoom: frame.zoom, canvas: { w, h } });
      const cible = new THREE.Vector3(f.centre.x, f.centre.y, f.centre.z);
      const boite = geometry.boundingBox;
      const rayon = boite ? boite.getSize(new THREE.Vector3()).length() / 2 : 100;
      const distance = Math.max(50, rayon * 4);
      camera = affineCamera(f.kind, f.yawDeg, mpt, f.viewport, {
        target: cible,
        distance,
        radius: rayon + (boite ? cible.distanceTo(boite.getCenter(new THREE.Vector3())) : 0) + 8,
      }).camera;
    }
    // VACILLEMENT (#1245, L4) : l'intensité de l'INSTANT, posée sur les lampes montées avant tout le
    // reste. C'est elle que la passe de pose relit pour exposer les billboards — le personnage au pied
    // du braséro bat donc avec sa flaque, et par UNE seule valeur : celle que three va rendre.
    applyFlicker(pool.current, flaquesÉcrites, performance.now() / 1000);
    // Quads ALIGNÉS ÉCRAN, ancrés aux PIEDS — exactement ce que fait le backend affine du sprite ; le
    // glissement de marche de l'instant y entre (`stage/boardPose.ts`, la passe pure), les lampes qu'un
    // marcheur PORTE avec lui, et l'EXPOSITION de chaque quad à l'endroit où il vient de se poser.
    const aGlissé = poseBoards(boardsRef.current, camera, anim ? anim.glide : AUCUN_GLISSEMENT, {
      pool: pool.current,
      slots: flaquesÉcrites,
      surfaceLuminance: lumière.surfaceLuminance,
    }, chromeAt ?? AUCUN_CHROME);
    // MARQUES DYNAMIQUES (P3-0d) et HALOS D'INTERACTION (P3-0g) : ils suivent la MÊME glisse que les
    // quads, à la même frame et sur le même canal — un lien d'engagement posé à un rendu React
    // attendrait le marcheur à l'arrivée. Marques de sol et halos se mesurent à l'ÉCRAN d'une vue
    // affine (`kind`/`yawDeg`) : la première personne n'en pose aucun (#1176, P3-1a).
    if (f) {
      poseDynamicMarks(poolsDyn.current, dynMarks ?? NO_DYNAMIC_MARKS, {
        mpt,
        glide: anim ? anim.glide : AUCUN_GLISSEMENT,
        groundM: solM,
        kind: f.kind, // l'anneau d'équipe n'a ni le même rayon ni la même compensation selon la vue
        yawDeg: f.yawDeg, // les tirets de l'anneau d'équipe se mesurent à l'ÉCRAN : ils suivent la vue
        chromeAt: chromeAt ?? AUCUN_CHROME, // l'anneau d'un corps estompé s'estompe avec lui (P3-0f)
      });
      // La PULSATION d'un halo est une fonction de l'horloge, donc elle ne s'écrit que dans la frame.
      // `camQuat` : l'étincelle est un quad aligné écran, et son décalage se mesure en pixels d'écran.
      poseInteractHalos(poolsHalos.current, halos ?? NO_INTERACTION_HALOS, {
        mpt,
        groundM: solM,
        kind: f.kind,
        yawDeg: f.yawDeg,
        camQuat: camera.quaternion,
        tSec: performance.now() / 1000,
      });
    }
    // CARTE D'OMBRE : elle ne se recuit QUE quand ce qu'elle contient a bougé — un casteur qui glisse,
    // ou un montage (lampes, monde, billboards) qui l'a demandée. Une rotation de caméra, un zoom, une
    // frame de marche où personne ne glisse : la carte 2048² de la frame précédente reste valide.
    if (aGlissé || ombresARefaire.current) {
      renderer.shadowMap.needsUpdate = true;
      ombresARefaire.current = false;
    }
    // CHUTE (P2-6) : les particules avancent à la cadence RÉELLE de la frame, ici et nulle part
    // ailleurs — aucun rendu React, aucune allocation, aucun `Math.random`. Le pas est BORNÉ : un
    // onglet revenu au premier plan reprend l'averse, il ne la téléporte pas d'un bout à l'autre.
    // Seule la TRANSLATION de chaque instance se réécrit ; la base (orientation × taille) est commune
    // au semis et ne se reconstruit qu'au changement d'axe de caméra.
    const maintenant = performance.now();
    const semis = precipMesh.current;
    if (champ && semis) {
      const dt = Math.min(0.1, Math.max(0, (maintenant - dernierPas.current) / 1000));
      dernierPas.current = maintenant;
      stepWeatherField(champ, dt, sousCouvert);
      const base = precipBasis(champ.def, camera.getWorldDirection(new THREE.Vector3()));
      const memeBase = precipBase.current !== null && base.every((v, i) => v === precipBase.current![i]);
      writePrecipMatrices(semis.instanceMatrix.array as Float32Array, champ, base, !memeBase);
      precipBase.current = base;
      semis.instanceMatrix.needsUpdate = true;
    }
    dernierRendu.current = maintenant;
    cameraRef.current = camera; // la caméra de la DERNIÈRE frame : celle que le rayon de picking doit emprunter
    renderer.render(three.current, camera);
  };

  /** La frame COURANTE, pour les boucles qui battent HORS des rendus React. Elles lisent la réf, jamais
   *  une closure : `dessiner` capture les props de SON rendu, et une boucle abonnée sur le semis
   *  peindrait au cadrage du rendu où le semis a changé — une caméra qui tourne sous la pluie s'y
   *  dessine au zoom périmé. Même patron que `repaintRef` (`fx/useWalkAnim.ts`). */
  const dessinerRef = useRef(dessiner);
  dessinerRef.current = dessiner;

  // ── GROUPE INTEMPÉRIES : un `InstancedMesh` unique (un appel de dessin), remonté au seul changement
  // de SEMIS — c'est-à-dire à la météo de la scène, jamais à la caméra ni au pas du groupe.
  useEffect(() => {
    const groupe = intemperies.current;
    if (!groupe || !champ) return;
    const semis = buildPrecipMesh(champ);
    precipMesh.current = semis;
    precipBase.current = null;
    dernierPas.current = performance.now();
    groupe.add(semis);
    dessiner();
    return () => {
      precipMesh.current = null;
      viderGroupe(groupe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champ]);

  // BOUCLE DE CHUTE : une averse vit hors des rendus React — tant qu'un semis existe, la frame se
  // rejoue. Elle CÈDE le pas à la boucle de MARCHE (P2-4) quand celle-ci vient de dessiner : une même
  // image ne se rend jamais deux fois, quelle que soit celle des deux boucles qui bat la première.
  useEffect(() => {
    if (!champ) return;
    let vivant = true;
    let image = 0;
    const battre = () => {
      if (!vivant) return;
      if (performance.now() - dernierRendu.current > 4) dessinerRef.current();
      image = requestAnimationFrame(battre);
    };
    image = requestAnimationFrame(battre);
    return () => {
      vivant = false;
      cancelAnimationFrame(image);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champ]);

  // BOUCLE DE VACILLEMENT (#1245, L4) : une flamme vit hors des rendus React, comme l'averse. Elle ne
  // bat QUE si une lampe qui vacille est allumée — de jour les flaques s'éteignent, et une scène sans
  // feu (lanternes, lueurs magiques) ne rejoue pas une frame de plus qu'avant ce lot. Même politique
  // de CESSION que la chute : une image déjà rendue par la marche ou l'averse ne se redessine pas.
  const vacille = hasFlicker(flaquesÉcrites);
  useEffect(() => {
    if (!vacille) return;
    let vivant = true;
    let image = 0;
    const battre = () => {
      if (!vivant) return;
      if (performance.now() - dernierRendu.current > 4) dessinerRef.current();
      image = requestAnimationFrame(battre);
    };
    image = requestAnimationFrame(battre);
    return () => {
      vivant = false;
      cancelAnimationFrame(image);
    };
  }, [vacille]);

  // BOUCLE DE PULSATION DES HALOS (P3-0g) : un halo d'affordance bat hors des rendus React, comme la
  // flamme et l'averse — c'est ce que la voie affine obtient de ses keyframes CSS. Elle ne bat QUE si
  // un halo est à l'écran : une scène sans décor fouillable et sans PNJ survolé ne rejoue pas une frame
  // de plus qu'avant ce lot. Même politique de CESSION que les deux autres boucles.
  const pulseHalos = !!halos && (halos.fouilles.length > 0 || halos.pnjs.length > 0);
  useEffect(() => {
    if (!pulseHalos) return;
    let vivant = true;
    let image = 0;
    const battre = () => {
      if (!vivant) return;
      if (performance.now() - dernierRendu.current > 4) dessinerRef.current();
      image = requestAnimationFrame(battre);
    };
    image = requestAnimationFrame(battre);
    return () => {
      vivant = false;
      cancelAnimationFrame(image);
    };
  }, [pulseHalos]);

  // HIT-TEST DE SPRITE (lot P2-3) : la voie volumique répond au pointeur par un RAYON — cibles = les
  // quads montés (ceux d'un combattant portent son id) plus les masses du monde, inscrites sans id
  // (une masse qui gagne le rayon = rien de cliquable ici, comme un mur peint par-dessus un jeton en
  // affine). L'inscription vit et meurt avec ce composant, qui n'est monté qu'en volumique.
  // En PREMIÈRE PERSONNE, aucun picker n'est inscrit : cette vue n'a jamais eu d'affordance de clic
  // (le SVG du POV n'en portait aucune) — l'inscrire en ouvrirait une par le seul changement de voie.
  useEffect(() => {
    if (pov) return;
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
  }, [pov]);

  // Renderer UNIQUE (le canevas ne se remonte jamais).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Aucun contexte WebGL (machine sans accélération, jsdom des tests de montage) : le canevas reste
    // vierge et le stage continue de tourner — il ne se plante pas.
    let renderer: StageRenderer;
    try {
      renderer = fabriqueRenderer ? fabriqueRenderer(canvas) : new THREE.WebGLRenderer({ canvas, antialias: true });
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

  // ── POOLS DE MARQUES (P3-0c) : la CAPACITÉ, et rien d'autre. Un pool ne naît, ne grandit ou ne meurt
  // qu'au changement de palier — c'est la seule passe qui alloue une géométrie ou un matériau de marque.
  // Le contenu, lui, s'écrit dans la passe suivante ; le patron est celui du pool de flaques (#1245).
  useEffect(() => {
    const groupe = marques.current;
    if (!groupe) return;
    HIGHLIGHT_SLOTS.forEach((slot, i) => {
      const voulue = capacités[i];
      const courant = poolsMarques.current.get(slot);
      if (courant && courant.instanceMatrix.count === voulue) return;
      if (courant) {
        groupe.remove(courant);
        courant.geometry.dispose();
        (courant.material as THREE.Material).dispose();
        poolsMarques.current.delete(slot);
      }
      if (voulue <= 0) return;
      const mesh = buildHighlightMesh(slot, voulue);
      poolsMarques.current.set(slot, mesh);
      groupe.add(mesh);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clésCapacités]);

  // ── ÉCRITURE des marques : matrices et teintes réécrites EN PLACE dans des pools déjà montés. Aucun
  // montage, aucun démontage, aucune allocation — un tour de combat ne fait que repasser ici.
  useEffect(() => {
    for (const slot of HIGHLIGHT_SLOTS) {
      const mesh = poolsMarques.current.get(slot);
      if (mesh) writeHighlightInstances(mesh, marquesGroupées.get(slot) ?? [], mpt);
    }
    dessiner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marquesGroupées, mpt]);

  // Le groupe des marques ne se vide qu'à la MORT de l'écran (un `viderGroupe` par changement de
  // dépendance rendrait le pool inutile).
  useEffect(() => {
    const groupe = marques.current;
    const pools = poolsMarques.current;
    return () => {
      for (const mesh of pools.values()) {
        groupe?.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      pools.clear();
    };
  }, []);

  // ── POOLS DYNAMIQUES (P3-0d) : montés UNE fois, à capacité fixe, et jamais retouchés jusqu'à la mort
  // de l'écran. Aucune dépendance : ni le combat, ni la scène, ni l'échelle n'en refont un — leur
  // contenu ENTIER se réécrit à chaque frame (`poseDynamicMarks`), y compris le compte dessiné.
  useEffect(() => {
    const groupe = marquesDyn.current;
    if (!groupe) return;
    const pools = poolsDyn.current;
    for (const slot of DYN_MARK_SLOTS) {
      const mesh = buildDynamicMarkMesh(slot);
      pools[slot] = mesh;
      groupe.add(mesh);
    }
    dessiner();
    return () => {
      for (const slot of DYN_MARK_SLOTS) {
        const mesh = pools[slot];
        if (!mesh) continue;
        groupe.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        delete pools[slot];
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── POOLS DE HALOS (P3-0g) : même politique que les pools dynamiques ci-dessus — montés UNE fois, à
  // capacité fixe, contenu et OPACITÉ réécrits à chaque frame (`poseInteractHalos`).
  useEffect(() => {
    const groupe = halosGroupe.current;
    if (!groupe) return;
    const pools = poolsHalos.current;
    for (const slot of HALO_SLOTS) {
      const mesh = buildHaloMesh(slot);
      pools[slot] = mesh;
      groupe.add(mesh);
    }
    dessiner();
    return () => {
      for (const slot of HALO_SLOTS) {
        const mesh = pools[slot];
        if (!mesh) continue;
        groupe.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        delete pools[slot];
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GROUPE BILLBOARDS : décor + acteurs. Rebâti quand les SUJETS changent — l'identité d'un sujet
  // porte sa case logique et sa signature de dessin, jamais le glissement de la marche : celui-ci
  // décale des quads déjà montés, dans `dessiner` (P2-4).
  useEffect(() => {
    const groupe = panneaux.current;
    if (!groupe) return;
    let annule = false;
    const pxm = pxPerM(mpt);
    // REGARD qui choisit la vue d'une entité : en première personne le CAP du meneur (8 états
    // discrets, repère `dir8Basis`), sur la vue de plateau le cran d'art. Le repère se prend au cap et
    // NON à la caméra de la frame : fwd/right recalculés par frame recuiraient toute la planche de
    // textures à chaque frame (le piège que documente `artRot`).
    const bbCam: BillboardCamera = povFacing
      ? { kind: 'perspective', ...dir8Basis(povFacing) }
      : { kind: 'ortho', yawDeg: camRot * 90 };
    const quads = subjects.map((sub) => {
      // Le quad se taille sur la BOÎTE du sujet : un composite plus haut que la boîte canonique
      // (couple monté) gagne du quad au lieu d'être tranché à la rasterisation.
      const quad = subjectQuad(CONVENTION, sub);
      // L'art de décor n'existe qu'AUX crans (`propSvg(ref, dir, camRot)`) ; celui d'un personnage
      // l'ignore — l'y mettre rasteriserait quatre fois la MÊME image.
      const identity = sub.kind === 'prop' ? `${sub.identity}|r${camRot}` : sub.identity;
      const { view, mirror } = billboardView(bbCam, sub.facing);
      const pxHeight = rasterPxHeight(quad.heightM, pxm);
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
        // Matériau NON lambertien (`billboardMaterial`, cf. l'en-tête), monté à la couleur NEUTRE : son
        // exposition appartient à la passe de pose, qui la lui donne dans le `dessiner()` de cette même
        // passe de montage, avant toute peinture — une seconde loi ici en ferait deux à tenir d'accord.
        const mat = billboardMaterial(issue.value, 1);
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
  }, [subjects, mpt, camRot, povFacing, lit]);

  // L'EXPOSITION des billboards appartient à la passe de POSE (`poseBoards`) : elle dépend de l'endroit
  // où chaque sujet se pose, donc elle se recalcule à la cadence de la frame — c'est ainsi qu'un
  // personnage entre dans une flaque en marchant. Tout rendu de cet écran dessine (l'effet sans
  // dépendances plus bas) : l'heure et le palier la portent aux matériaux déjà montés, sans rerasteriser.

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

  // ── POOL DE FLAQUES (#1245, L1) : monté UNE fois, jamais reconstruit (la réf `pool` est déclarée avec
  // la décision, plus haut). Le compte de lampes ponctuelles entre dans la clé de cache de programme de
  // three (`numPointLights`) : le faire varier recompilerait les 76 matériaux du monde. L'écran ne fait
  // donc plus qu'écrire des intensités.
  useEffect(() => {
    const groupe = flaques.current;
    if (!groupe) return;
    const lampesPonctuelles = createPointLightPool();
    pool.current = lampesPonctuelles;
    for (const l of lampesPonctuelles) groupe.add(l);
    return () => {
      pool.current = [];
      for (const l of lampesPonctuelles) { groupe.remove(l); l.dispose(); }
    };
  }, []);

  // ── ÉCRITURE des flaques : la SEULE chose qui bouge d'une frame à l'autre (intensité, position,
  // portée). Aucun montage, aucun démontage, aucun `visible`. La table appliquée devient celle que la
  // décision suivante relira pour rendre à chaque source SON slot.
  useEffect(() => {
    slotsPrécédents.current = flaquesÉcrites;
    applyPointLights(pool.current, flaquesÉcrites);
    dessiner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaquesÉcrites]);

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
  // `data-lampes` : les flaques ALLUMÉES sur le budget MONTÉ (`allumées/budget`) — le compte de droite
  // ne bouge jamais (c'est tout l'intérêt du pool), celui de gauche tombe à 0 de jour.
  // `data-precip` : le COMPTE de particules du semis d'intempéries — même raison que les deux autres
  // (le canevas n'a pas d'arbre), et la seule trace par laquelle la recette et les tests de montage
  // voient qu'il tombe quelque chose. Absent = rien ne tombe (météo claire, ou scène d'intérieur).
  // `data-vue` : le REGARD de la frame (`affine` | `pov`) — même raison que les autres traces.
  return (
    <canvas
      ref={canvasRef}
      className="iso-stage"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
      data-sun={lit && course ? `${course.azimuthDeg.toFixed(1)},${course.elevationDeg.toFixed(1)}` : undefined}
      data-lum={lumière.surfaceLuminance.toFixed(4)}
      data-lampes={`${flaquesÉcrites.filter((f) => f && f.intensity > 0).length}/${POINT_LIGHT_BUDGET}`}
      data-precip={champ ? champ.n : undefined}
      data-vue={frame.mode}
    />
  );
}
