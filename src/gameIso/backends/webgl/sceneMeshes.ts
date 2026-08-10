/**
 * SPIKE WebGL — ASSEMBLAGE d'une scène : les builders du pivot (`builders/floors|walls|roofs|props`)
 * deviennent (a) UNE géométrie de monde fusionnée (positions + couleurs de sommet), (b) une liste de
 * SUJETS de billboard (personnages riggés + décor), chacun capable de rendre SA chaîne SVG pour une vue.
 *
 * Deux invariants de ce module :
 *  - FUSION : toutes les faces de la scène tiennent dans UNE `BufferGeometry` (la couleur de face est
 *    cuite au sommet, le mode de rendu n'est qu'un choix de MATÉRIAU) — jamais un mesh par face. Elle
 *    est INDEXÉE, d'un index IDENTITÉ (un sommet par usage : `computeVertexNormals` donne toujours la
 *    normale de FACE) que le masque de dégagement compacte sans toucher aux sommets ;
 *  - DÉLÉGATION : aucune couleur, aucune vue, aucun seuil n'est décidé ici — `faceSurface`, `tintFor`,
 *    `facesGeometry` (biais coplanaire compris), `propSvg`, `resolveRender`/`resolveRig` font foi.
 *
 * Node-safe (three est du JS pur) : aucun DOM, aucun renderer. La rasterisation vit dans `svgTexture.ts`.
 */
import * as THREE from 'three';
import { buildFloors } from '../../builders/floors';
import { buildWalls } from '../../builders/walls';
import { buildRoofs, ROOF_SLOPE_M } from '../../builders/roofs';
import { buildProps } from '../../builders/props';
import { buildTokens } from '../../builders/tokens';
import type { CellSide, Face, PropEl, RoofEl, SceneEl, TokenEl, WallEl } from '../../builders/types';
import { roofCourseStepM, variantOf } from '../../detail/courses';
import type { DetailRecipe } from '../../detail/types';
import type { PeriodKind } from './periodTexture';
import { faceBakeKey, needsFaceBake } from './faceBake';
import { facePoly, faceUvFrame, facesGeometry, polyNormal } from './worldTris';
import { faceSurface, tintVarFactor } from './faceColors';
import { faceDepthOf } from './faceRelief';
import { BB_W, BB_H } from '../../pov/billboardCore';
import { type BillboardKind } from './billboardMath';
import { DEFS } from '../../sprites';
import { propSvg } from '../../catalog/decor';
import { AMBIANCE } from '../../catalog/ambiance';
import { bonesToSvg } from '../../rig/renderBones';
import { resolveRig } from '../../rig/composeRig';
import type { RigOverlay } from '../../rig/bones';
import { entityRigProfileFor, enemyRigProfile, rendersFromOwnInventory } from '../../rig/enemyProfile';
import { planById, planOptsForRecord, type RenderResolution, type ResolveOpts } from '../../rig/bodyPlan';
import { defaultAppearance, type Appearance } from '../../rig/appearance';
import { equipFromCombatant, type EquipCtx } from '../../rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from '../../rig/parts/combatantVisuals';
import { isStructure } from '../../../engine/structures';
import type { Combatant } from '../../../engine/types';
import { combatantRender, combatantTokenScale, entityRender, entityTokenScale, sceneEntityForRender } from '../../sizeScale';
import { groundStateOf, planGroundPose, rigGroundPose, type GroundState } from '../../groundPose';
import { hash32 } from '../../detail/hash';
import { entitySize } from '../../../state/spawn';
import { sizeFootprint } from '../../../state/footprint';
import type { View } from '../../rig/facing';
import type { Rot } from '../../../geometry/iso';
import type { Dir8 } from '../../../state/dir8';
import { heightAt, type Scene, type SceneEntity, type WallSide } from '../../../state/scene';
import { memoByRefDeps } from '../../../state/sceneMemo';

/** Teinte de visibilité d'une case `"x,y,z"` (1 = pleine) — fournie par l'appelant (`visibilityTint`). */
export type TintAt = (cellKey: string) => number;

/** Verdict de GÉOMÉTRIE sur un élément de scène : le canal du DÉGAGEMENT (`cleared`), distinct de la
 *  teinte de visibilité — une masse dégagée ne se rend PAS, elle ne s'estompe pas. Il ne filtre RIEN au
 *  bake (`applyCutawayMask` le porte, sur le monde déjà cuit) : un appelant sans loi de dégagement
 *  (planches QC, spike) ne pose simplement aucun masque et rend la scène entière. */
export type KeepEl = (el: SceneEl) => boolean;

/** Éléments à FACES de la scène, dans l'ordre de peinture des builders (toutes couches pleines, comme
 *  la planche QC `env-panels.ts` : le spike juge l'ENVIRONNEMENT, pas le brouillard de l'étage actif). */
function faceEls(scene: Scene): SceneEl[] {
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  return [...buildFloors(scene, undefined, { activeZ: maxZ }), ...buildWalls(scene), ...buildRoofs(scene)];
}

/** Faces MONDE de la scène dans l'ordre de peinture des builders, chacune avec la clé de case qui porte
 *  sa teinte de visibilité — la liste EXACTE que `bakeWorldGeometry` fusionne (les gardes s'y adossent
 *  au lieu de la reconstituer). */
export interface WorldFace {
  face: Face;
  cell: SceneEl['cell'];
  cellKey: string;
  /** Élément de PROVENANCE — l'identité sur laquelle se relit la loi de dégagement (`KeepEl`) une fois
   *  la face fondue dans la géométrie commune. */
  el: SceneEl;
  /** Pente (m) de la nappe dont la face vient — un PAN de toit seulement : le pas de rang, donc
   *  l'échelle verticale de sa texture, en dépend (`roofCourseStepM`). */
  pitchM?: number;
  /** CÔTÉ D'ARÊTE de l'élément qui porte la face (mur, falaise, wedge) — l'identité MONDE sur laquelle
   *  se cale la variante d'anti-périodicité, EXACTEMENT comme le backend affine (`affineWalls` passe
   *  `el.side`, `affineFloors` passe `f.side`). Absent d'un pan de toit ou d'une nappe de sol. */
  side?: WallSide | CellSide;
}

export function worldFaces(scene: Scene): WorldFace[] {
  const out: WorldFace[] = [];
  for (const el of faceEls(scene)) {
    if (!('faces' in el)) continue;
    const cellKey = `${el.cell.x},${el.cell.y},${el.cell.z}`;
    const pitchM = (el as RoofEl).pitch;
    const elSide = (el as WallEl).side;
    for (const face of el.faces) out.push({ face, cell: el.cell, cellKey, el, pitchM, side: face.side ?? elSide });
  }
  return out;
}

/** GROUPE DE SURFACE : la maille de fusion du monde. Une géométrie UNIQUE porte toute la scène (jamais
 *  un mesh par face) et se découpe en `groups` three — un par (surface × variante d'anti-périodicité ×
 *  échelle de période), plus les CUISSONS PAR FACE (colombage) et LE groupe nu des faces sans
 *  appareillage. Le nombre de dessins passe de 1 à quelques dizaines : le prix ASSUMÉ d'une texture
 *  répétée qui ne se répète pas à l'œil. */
export interface SurfaceGroup {
  /** Identité du groupe (= clé de cache de sa texture). */
  key: string;
  /** `null` = groupe NU : aucune période, la couleur de sommet suffit. */
  kind: PeriodKind | null;
  surfaceKey?: string;
  variant?: number;
  /** Couleur de base de la surface — le masque de période n'en garde que des rapports. */
  color?: string;
  recipe?: DetailRecipe;
  /** Taille MÉTRIQUE de la période SUR CETTE SURFACE (le `v` d'un pan de toit suit sa pente). Absente
   *  d'un groupe CUIT PAR FACE : son image ne se répète pas, elle s'échantillonne sur `uv1`. */
  periodM?: { u: number; v: number };
  /** Gabarit MÉTRIQUE (quantifié au cm) d'un groupe CUIT PAR FACE — les faces qui le partagent
   *  partagent leur image (`faceBake`). */
  bake?: { wM: number; hM: number };
  /** PART de mur des faces du groupe — seule une part que le colombage habille se cuit (`needsFaceBake`). */
  part?: string;
}

const NU: SurfaceGroup = { key: 'nu', kind: null };

/** Dimension de face quantifiée au CENTIMÈTRE : la maille de partage d'une cuisson. */
const cm = (m: number): number => Math.round(m * 100) / 100;

/** Groupe d'une face : sa surface (couleur + recette), sa variante de période, et l'échelle métrique de
 *  celle-ci. Le SOL a une période propre, seedée à la seule recette (`groundCoursesPeriod`) : une seule
 *  variante. Un PAN DE TOIT garde la largeur de période de l'appareillage mais son pas de rang vient de
 *  SA pente — deux nappes de pentes différentes ne partagent donc pas un groupe. Une face à COLOMBAGE
 *  sort de la période pour sa propre CUISSON, groupée par gabarit (`faceBakeKey`). */
export function faceGroup(wf: WorldFace, mpt: number): SurfaceGroup {
  const surface = faceSurface(wf.face);
  const { domain, part } = wf.face.material;
  const kind: PeriodKind = domain === 'terrain' ? 'ground' : 'wall';
  // La variante se cale sur le CÔTÉ D'ARÊTE de l'élément — la même clé que `variantOf(cell, side)` de
  // l'affine (`affineDetail.ts`) et que le seed du POV (`pov/geometry.ts`). Sans côté (pan de toit),
  // la `part` du matériau tient lieu d'identité.
  const variant = kind === 'ground' ? 0 : variantOf(wf.cell, wf.side ?? part ?? domain);
  if (needsFaceBake(surface.recipe, kind, part)) {
    const frame = faceUvFrame(facePoly(wf.face, mpt));
    const bake = { wM: cm(frame.du), hM: cm(frame.dv) };
    // La variante d'anti-périodicité ne joue que sur le FOND de période de la cuisson : sans assises,
    // les N variantes cuisent la MÊME image sous N clés (mesuré : 3 textures identiques par gabarit).
    const bakeVariant = surface.recipe?.courses ? variant : 0;
    return {
      key: faceBakeKey(surface.surfaceKey, bake.wM, bake.hM, bakeVariant),
      kind,
      surfaceKey: surface.surfaceKey,
      variant: bakeVariant,
      color: surface.color,
      recipe: surface.recipe,
      bake,
      part,
    };
  }
  const c = surface.recipe?.courses;
  if (!surface.uvScaleM || !c) return NU;
  const periodM =
    domain === 'roof'
      ? { u: surface.uvScaleM.u, v: 2 * roofCourseStepM(wf.pitchM, c.hM, ROOF_SLOPE_M) }
      : surface.uvScaleM;
  return {
    key: `${surface.surfaceKey}|${kind}|v${variant}|p${periodM.v.toFixed(4)}`,
    kind,
    surfaceKey: surface.surfaceKey,
    variant,
    color: surface.color,
    recipe: surface.recipe,
    periodM,
  };
}

/** Découpage d'une liste de faces en groupes de surface : les groupes DANS L'ORDRE d'émission, et pour
 *  chacun les index de ses faces (dans l'ordre de peinture des builders — le rang coplanaire, lui, s'est
 *  calculé sur la liste entière AVANT tout regroupement). */
export function surfaceGrouping(listées: readonly WorldFace[], mpt: number): { groups: SurfaceGroup[]; faceIndices: number[][] } {
  const groups: SurfaceGroup[] = [];
  const faceIndices: number[][] = [];
  const rang = new Map<string, number>();
  listées.forEach((wf, i) => {
    const g = faceGroup(wf, mpt);
    let k = rang.get(g.key);
    if (k === undefined) {
      k = groups.length;
      rang.set(g.key, k);
      groups.push(g);
      faceIndices.push([]);
    }
    faceIndices[k].push(i);
  });
  return { groups, faceIndices };
}

/** La géométrie fusionnée porte ses groupes de surface (index = `materialIndex` de `geometry.groups`) :
 *  c'est le contrat entre le maillage et les matériaux que l'écran monte. */
export interface WorldGeometry extends THREE.BufferGeometry {
  userData: { surfaceGroups: SurfaceGroup[] };
}

/** PLAGE d'une face dans la géométrie fusionnée : les sommets qu'elle occupe, le groupe de surface qui
 *  la dessine, l'élément dont elle vient, la case dont elle prend sa visibilité, et sa couleur NUE
 *  (albédo de surface + variance de teinte de tuile). C'est le seul index dont les DEUX passes en place
 *  ont besoin : `applyVisibilityTint` (couleurs) et `applyCutawayMask` (index de dessin). */
export interface FaceSpan {
  cellKey: string;
  /** Élément de PROVENANCE — ce que la loi de dégagement (`KeepEl`) interroge. */
  el: SceneEl;
  /** Groupe de surface qui dessine la face (= `materialIndex` de `geometry.groups`). */
  group: number;
  /** Premier sommet de la face, et nombre de sommets. */
  start: number;
  count: number;
  /** Albédo NU de la surface (jamais teinté : la teinte se re-multiplie sur lui, elle ne s'y cumule pas). */
  color: string;
  /** Variance de teinte de la tuile — invariante à la visibilité, donc cuite avec la géométrie. */
  varFactor: number;
}

/** Monde CUIT : la géométrie (positions, uv, uv1, groupes de surface) et l'index qui permet d'en
 *  repeindre les couleurs par case et d'en masquer les faces par élément. Le bake est INVARIANT à la
 *  visibilité ET au dégagement.
 *
 *  CONTRAT DE PROPRIÉTÉ — un bake sert UN consommateur à la fois : la géométrie rendue EST le bake
 *  (`applyVisibilityTint` réécrit son attribut `color` en place, `applyCutawayMask` son index, et tous
 *  deux la rendent telle quelle), donc deux vues qui teinteraient ou masqueraient le MÊME `BakedWorld`
 *  s'écraseraient l'une l'autre. Un second consommateur prend SON bake (`bakeWorldGeometry`), il
 *  n'emprunte pas celui d'un autre. */
export interface BakedWorld {
  geometry: WorldGeometry;
  spans: FaceSpan[];
}

/** Géométrie MONDE fusionnée de la scène, SANS teinte de visibilité ni dégagement : une
 *  `BufferGeometry` dont chaque triangle a ses propres sommets (→ `computeVertexNormals` donne la
 *  normale de FACE, l'ombrage plat du mode éclairé), indexée d'un index IDENTITÉ que
 *  `applyCutawayMask` compacte ensuite. C'est la passe LOURDE — triangulation, rang coplanaire, UV,
 *  groupes de surface (mesuré #1176 : 437 ms sur l'arène, 1 601 ms sur l'opéra) — et rien de ce
 *  qu'elle calcule ne dépend de ce que le groupe voit ni de ce qui le coiffe : elle ne se rejoue qu'à
 *  la scène ou à l'échelle.
 *  Un appelant = un bake (cf. `BakedWorld`) : `SpikeScreen` en cuit un pour lui, `stage/GameStage3D`
 *  (l'écran de jeu) le sien — aucun des deux ne partage le bake de l'autre. */
export function bakeWorldGeometry(scene: Scene, mpt: number): BakedWorld {
  const listées = worldFaces(scene);
  const faces = listées.map((f) => f.face);
  // Le RANG coplanaire se calcule sur la liste ENTIÈRE de la scène (contrat de `coplanarRanks`).
  const geoms = facesGeometry(faces, mpt, faceDepthOf(mpt));
  const positions: number[] = [];
  const uvs: number[] = [];
  const uv1s: number[] = [];
  const spans: FaceSpan[] = [];
  // ORIENTATION des triangles : le pivot n'a aucune convention de sens de parcours (une face peut être
  // authorée dans un sens ou dans l'autre). Un rendu en `DoubleSide` s'en moque, mais la CARTE D'OMBRE
  // non : le décalage de biais suit la normale, et une normale à l'envers pousse le receveur DANS son
  // ombre (mesuré : scène entière retombée à la seule ambiante). Deux régimes :
  //  - `g.oriented` (boîtes de mur, copies par joue) : le sens PORTE déjà le dehors du VOLUME — on le
  //    propage tel quel. L'heuristique « vers l'extérieur de la carte » y retournait la joue intérieure
  //    de chaque boîte (mesuré #1176 : siège 1216/2480 triangles de mur, arène 2756/5512, soit ~50 %) ;
  //  - faces sans orientation propre (sols, toits, montants) : vers le HAUT si horizontale, vers
  //    l'EXTÉRIEUR de la carte si verticale.
  const cx = ((scene.dimensions.w - 1) / 2) * mpt;
  const cz = ((scene.dimensions.h - 1) / 2) * mpt;
  const pousser = (i: number, groupe: number) => {
    const g = geoms[i];
    const début = positions.length / 3;
    g.tris.forEach((tri, t) => {
      const n = polyNormal(tri);
      const centre = { x: (tri[0].x + tri[1].x + tri[2].x) / 3, z: (tri[0].z + tri[1].z + tri[2].z) / 3 };
      const dehors = n ? n.x * (centre.x - cx) + n.z * (centre.z - cz) : 0;
      const versLExterieur = g.oriented || !n ? true : Math.abs(n.y) > 1e-6 ? n.y > 0 : dehors >= 0;
      // Le retournement d'un triangle PERMUTE ses UV comme ses sommets (elles sont par SOMMET).
      const ordre = versLExterieur ? [0, 1, 2] : [0, 2, 1];
      for (const k of ordre) {
        const p = tri[k];
        positions.push(p.x, p.y, p.z);
        uvs.push(g.uv[t][k].u, g.uv[t][k].v);
        uv1s.push(g.uv1[t][k].u, g.uv1[t][k].v);
      }
    });
    // La couleur de sommet porte l'albédo du matériau × la variance de teinte de la surface (un aplat
    // répété tuile après tuile se lit sinon comme une nappe de peinture) × la visibilité de la case —
    // ce dernier facteur SEUL est réversible, et c'est `applyVisibilityTint` qui le pose.
    const surface = faceSurface(faces[i]);
    spans.push({
      cellKey: listées[i].cellKey,
      el: listées[i].el,
      group: groupe,
      start: début,
      count: positions.length / 3 - début,
      color: surface.color,
      varFactor: tintVarFactor(surface.recipe, listées[i].cell),
    });
  };
  // Les faces sortent GROUPÉES par surface (un groupe = un dessin) ; à l'intérieur d'un groupe, l'ordre
  // de peinture des builders est conservé. Les `spans` en héritent : ils sont CONTIGUS par groupe, et
  // dans l'ordre des groupes — ce dont le masque de dégagement se sert pour compacter l'index d'une
  // seule passe linéaire.
  const { groups, faceIndices } = surfaceGrouping(listées, mpt);
  const groupSpans: [number, number][] = [];
  faceIndices.forEach((idx, k) => {
    const début = positions.length / 3;
    for (const i of idx) pousser(i, k);
    groupSpans.push([début, positions.length / 3 - début]);
  });
  const geometry = new THREE.BufferGeometry() as WorldGeometry;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
  // `uv` = maille MONDE en mètres (textures répétées) ; `uv1` = face d'origine en [0,1]² (ornements
  // cuits par face). Les deux jeux voyagent dans LA géométrie fusionnée — jamais un mesh par surface.
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1s, 2));
  groupSpans.forEach(([début, count], k) => geometry.addGroup(début, count, k));
  geometry.userData = { surfaceGroups: groups };
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  // INDEX IDENTITÉ : le monde nu se dessine entier, sommet par sommet dans l'ordre où il a été cuit.
  // Aucun sommet n'est partagé (`computeVertexNormals` ci-dessus a donc bien donné des normales de
  // FACE) ; l'index n'existe que pour donner au masque de dégagement une case à réécrire.
  const nbSommets = positions.length / 3;
  const identité = new Uint32Array(nbSommets);
  for (let i = 0; i < nbSommets; i++) identité[i] = i;
  geometry.setIndex(new THREE.BufferAttribute(identité, 1));
  return { geometry, spans };
}

/** Applique le DÉGAGEMENT d'architecture à un monde cuit : l'index de dessin est ré-écrit EN PLACE en
 *  COMPACTANT les faces gardées, groupe de surface par groupe de surface, et les `groups` de la
 *  géométrie sont ré-ancrés sur ces plages. Positions, couleurs, uv, normales et matériaux sont
 *  INTOUCHÉS : une masse retirée cesse simplement d'être référencée par l'index.
 *
 *  C'est le canal GÉOMÉTRIE, jumeau d'`applyVisibilityTint` : il suit le PAS du groupe (`cleared`
 *  change à chaque case franchie et à chaque cran de caméra) sans jamais rejouer la triangulation.
 *  Rend LA géométrie du bake, pas une copie — cf. le contrat de propriété de `BakedWorld`. */
export function applyCutawayMask(baked: BakedWorld, keepEl: KeepEl): WorldGeometry {
  const { geometry, spans } = baked;
  const index = geometry.getIndex() as THREE.BufferAttribute;
  const arr = index.array as Uint32Array;
  const groups = geometry.groups;
  let écrit = 0;
  let groupe = -1;
  let début = 0;
  const clore = () => {
    if (groupe >= 0) {
      groups[groupe].start = début;
      groups[groupe].count = écrit - début;
    }
  };
  for (const span of spans) {
    if (span.group !== groupe) {
      clore();
      groupe = span.group;
      début = écrit;
    }
    if (!keepEl(span.el)) continue;
    const fin = span.start + span.count;
    for (let i = span.start; i < fin; i++) arr[écrit++] = i;
  }
  clore();
  index.needsUpdate = true;
  return geometry;
}

/** Repeint la VISIBILITÉ d'un monde cuit : l'attribut `color` est ré-écrit EN PLACE depuis la couleur
 *  NUE de chaque face (jamais depuis la couleur affichée — une teinte se re-multiplie, elle ne se cumule
 *  pas), la géométrie n'est pas touchée. C'est la passe qui suit le PAS du groupe (mesuré #1176, arène :
 *  1,3 ms pour 19 734 triangles, contre 492 ms de re-bake). Rend la géométrie, pour l'appelant qui
 *  compose les deux — LA géométrie du bake, pas une copie : le dernier appel fait la couleur affichée.
 *  D'où le contrat de propriété de `BakedWorld` (un bake = un consommateur de teinte). */
export function applyVisibilityTint(baked: BakedWorld, tintAt: TintAt): WorldGeometry {
  const attr = baked.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  const c = new THREE.Color();
  for (const span of baked.spans) {
    c.set(span.color).multiplyScalar(tintAt(span.cellKey) * span.varFactor);
    const fin = (span.start + span.count) * 3;
    for (let i = span.start * 3; i < fin; i += 3) {
      arr[i] = c.r;
      arr[i + 1] = c.g;
      arr[i + 2] = c.b;
    }
  }
  attr.needsUpdate = true;
  return baked.geometry;
}

/** Monde cuit ET teinté en un geste — pour un appelant qui n'a pas de teinte à faire varier (gardes,
 *  cadrage). Un écran qui suit la visibilité garde le bake et ne rejoue que `applyVisibilityTint`. */
export function buildWorldGeometry(scene: Scene, mpt: number, tintAt: TintAt): WorldGeometry {
  return applyVisibilityTint(bakeWorldGeometry(scene, mpt), tintAt);
}

/** Un sujet de billboard prêt à texturer : où il se pose, à quelle échelle, et comment il se dessine. */
export interface BillboardSubject {
  /** Identité de cache (hors vue/miroir/palier — cf. `billboardTextureKey`). */
  identity: string;
  kind: BillboardKind;
  /** Ancre PIEDS en repère three (mètres). */
  anchor: THREE.Vector3;
  /** Orientation MONDE d'auteur. */
  facing: Dir8;
  /** Multiplicateur de taille (espèce × Taille pour un personnage, empreinte de décor pour un prop). */
  scaleK: number;
  /** Teinte de visibilité de la case d'ancrage. */
  tint: number;
  /** Boîte locale du fragment SVG. */
  box: { w: number; h: number };
  /** Fragment SVG pour une vue (défs globaux inclus : le blob de rasterisation est un document isolé). */
  svg: (view: View, mirror: boolean, camRot: Rot) => string;
}

/** SVG d'un personnage de scène : rig humanoïde (`resolveRig`) ou gabarit de créature (`planById`),
 *  même résolution par la DONNÉE que le jeu (`entityRender`, preset de PNJ compris) et même
 *  équipement que l'iso (`entityRigProfileFor`, dont l'appartenance à une rencontre : `enrolled`).
 *  `null` = aucune apparence résoluble. */
function personnageSvg(ent: SceneEntity, enrolled: boolean): ((view: View, mirror: boolean) => string) | null {
  const e = sceneEntityForRender(ent);
  const r = entityRender(e);
  if (r.kind === 'rig') {
    const prof = entityRigProfileFor(e, enrolled);
    if (!prof) return null;
    return (view, mirror) => bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view, [], mirror));
  }
  const plan = planById(r.plan);
  if (!plan) return null;
  return (view, mirror) => {
    const body = bonesToSvg(plan.resolve(r.species, view, plan.restPose(), {}));
    // Miroir de la boîte 120×150 (centre en x=60), MÊME convention que `propSvg` pour un profil gauche.
    return mirror ? `<g transform="translate(${BB_W},0) scale(-1,1)">${body}</g>` : body;
  };
}

/** Éléments de scène à billboarder : la sortie des BUILDERS, donc les MÊMES filtres que la voie
 *  affine (embuscade `hiddenUntilCombat`, entité enrôlée que son combattant rend déjà, case couverte
 *  par un combattant, étage isolé/actif, hors-vue). Il n'y a PAS de second jeu de lois côté volumique :
 *  l'écran de jeu passe les éléments de SON stage. */
export interface SceneBillboardEls {
  tokens: readonly TokenEl[];
  props: readonly PropEl[];
}

/** Éléments de la scène ENTIÈRE — pour un appelant SANS loi de vue ni combat en cours (planches QC,
 *  écran de spike : ils jugent l'ENVIRONNEMENT, pas le brouillard), au même titre que `keepEl` absent.
 *  Un écran de JEU ne passe JAMAIS ceci : c'est là que se perdraient l'embuscade et le combat. */
export function wholeSceneBillboardEls(scene: Scene): SceneBillboardEls {
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  return {
    tokens: buildTokens(scene, undefined, null, { activeZ: maxZ, viewZ: null, top: false }),
    props: buildProps(scene),
  };
}

/** Sujets de billboard de la scène : personnages FIGURANTS (`kind:'personnage'`) puis décor. Les
 *  COMBATTANTS n'entrent pas ici — ils passent par `actorBillboards`, à leur position visuelle ; c'est
 *  le builder qui garantit qu'une entité enrôlée n'est pas dessinée deux fois. */
export function collectBillboards(scene: Scene, mpt: number, tintAt: TintAt, els: SceneBillboardEls): BillboardSubject[] {
  const out: BillboardSubject[] = [];
  const defs = `<defs>${DEFS}</defs>`;
  for (const tk of els.tokens) {
    if (tk.subject.kind !== 'figurant') continue;
    const { ent, enrolled } = tk.subject;
    if (ent.kind !== 'personnage') continue;
    const draw = personnageSvg(ent, enrolled);
    if (!draw) continue;
    // Empreinte multi-cases : le corps se centre sur l'empreinte (même décalage que `stage/tokens.tsx`).
    const off = (sizeFootprint(entitySize(ent)) - 1) / 2;
    const gx = ent.pos.x + off;
    const gy = ent.pos.y + off;
    const z = tk.cell.z;
    out.push({
      identity: `perso:${ent.id}`,
      kind: 'personnage',
      anchor: new THREE.Vector3(gx * mpt, heightAt(scene, ent.pos.x, ent.pos.y, z), gy * mpt),
      facing: ent.facing ?? 'S',
      scaleK: entityTokenScale(ent),
      tint: tintAt(`${ent.pos.x},${ent.pos.y},${z}`),
      box: { w: BB_W, h: BB_H },
      svg: (view, mirror) => defs + draw(view, mirror),
    });
  }
  for (const el of els.props) {
    const gx = el.cell.x + el.foot.offX;
    const gy = el.cell.y + el.foot.offY;
    const h = heightAt(scene, el.cell.x, el.cell.y, el.cell.z) + (el.liftM ?? 0);
    out.push({
      identity: `prop:${el.key}`,
      kind: 'prop',
      anchor: new THREE.Vector3(gx * mpt, h, gy * mpt),
      facing: el.facing ?? 'S',
      scaleK: el.foot.scale,
      tint: tintAt(`${el.cell.x},${el.cell.y},${el.cell.z}`),
      box: { w: BB_W, h: BB_H },
      // Le décor délègue sa vue à `propSvg` (dir + cran caméra), exactement comme les deux backends.
      svg: (_view, _mirror, camRot) => defs + propSvg(el.ref, el.facing, camRot),
    });
  }
  return out;
}

/** ACTEUR à billboarder : le combattant (groupe en exploration, combattants en combat) et sa position
 *  VISUELLE — celle qui GLISSE pendant la marche, décidée par le stage (`walkPosOf`), jamais relue ici. */
export interface ActorPose {
  c: Combatant;
  x: number;
  y: number;
  z: number;
  /** Orientation MONDE vivante (store `facing`, jamais un champ du combattant). */
  facing?: Dir8;
}

/** Tout ce dont le DESSIN d'un acteur dépend, résolu à UN seul endroit : le tracé (`actorBillboards`)
 *  et la SIGNATURE (`combatantRenderSignature`) lisent la MÊME structure. Aucun des deux ne peut donc
 *  consommer une entrée que l'autre ignore — c'était la double péremption mesurée (#1176) : une tenue,
 *  une arme ou une Taille changeaient le dessin sans changer ni la clé de mémo du monde volumique ni
 *  l'identité de cache de texture. */
export interface ActorDrawInputs {
  render: RenderResolution;
  ground: GroundState;
  /** Multiplicateur de taille du jeton (espèce × Taille, ou empreinte propre). */
  scaleK: number;
  /** Branche RIG (humanoïde) — absente pour un gabarit de créature. */
  rig?: { appearance: Appearance; equip: EquipCtx; tenue: string | undefined; overlays: RigOverlay[] };
  /** Branche GABARIT (`plan.resolve`) — opts d'apparence du record + override d'authoring. */
  plan?: ResolveOpts;
}

/** Entrées de dessin d'un combattant : profil d'ennemi ou inventaire propre, garde-robe, calques
 *  d'état (mutations, blessures, métamorphose vivante), pose au sol, échelle de jeton. */
export function actorDrawInputs(c: Combatant): ActorDrawInputs {
  const render = combatantRender(c);
  const ground = groundStateOf(c);
  const scaleK = combatantTokenScale(c);
  if (render.kind !== 'rig') return { render, ground, scaleK, plan: planOptsForRecord(c.creatureId, c.appearanceOverride) };
  const prof = rendersFromOwnInventory(c) ? null : enemyRigProfile(c);
  return {
    render,
    ground,
    scaleK,
    rig: {
      appearance: combatantAppearance(prof?.appearance ?? c.appearance ?? defaultAppearance(c), c),
      equip: prof?.equip ?? equipFromCombatant(c),
      tenue: prof?.tenue ?? c.career,
      overlays: combatantOverlays(c),
    },
  };
}

/** Sérialisation DÉTERMINISTE : clés TRIÉES et champs absents omis — deux résolutions de mêmes entrées
 *  donnent la même chaîne quel que soit l'ordre d'insertion des objets qui les portent. */
function stableStr(v: unknown): string {
  if (v === undefined) return 'u';
  if (v === null || typeof v !== 'object') return JSON.stringify(v)!;
  if (Array.isArray(v)) return `[${v.map(stableStr).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${k}:${stableStr(o[k])}`).join(',')}}`;
}

/** SIGNATURE des entrées de dessin d'un combattant — stable tant que le corps rendu ne change pas.
 *  Consommée par les DEUX péremptions du monde volumique : la clé de mémo des acteurs (`IsoStage`) et
 *  l'identité de cache de texture (`BillboardSubject.identity`). */
export function combatantRenderSignature(c: Combatant): string {
  return hash32(stableStr(actorDrawInputs(c))).toString(16);
}

/** Clé de MÉMO d'un acteur du monde volumique : ce qui doit reforger le tableau d'acteurs du stage —
 *  identité, position VISUELLE, orientation, et la signature de ce que le billboard dessine. Même
 *  source que l'identité de cache de texture : une entrée de dessin ne peut pas périmer l'une sans
 *  l'autre. */
export function actorPoseKey(p: ActorPose): string {
  return `${p.c.id}:${p.x},${p.y},${p.z}:${p.facing ?? ''}:${combatantRenderSignature(p.c)}`;
}

/** Billboards des ACTEURS (héros, ennemis, alliés) — le pendant volumique de ce que le stage affine
 *  monte en corps React. Les entrées de dessin sont celles d'`actorDrawInputs` (classifieur de corps,
 *  profil d'ennemi, équipement, garde-robe, calques d'état, échelle de jeton), l'ÉTAT AU SOL passe par
 *  les deux moteurs d'animation (`rigGroundPose` / `planGroundPose`) et la FORME rendue est celle de
 *  `personnageSvg` ci-dessus. Une structure de siège est sautée : elle se rend sur son arête, pas en
 *  jeton (cf. `tokenBodyKind`).
 *
 *  ÉCART RÉSIDUEL MESURÉ (#1176) : le corps au sol prend bien sa POSE couchée, mais pas la BASCULE du
 *  stage (`rigGroundTiltDeg` : 82° cadavre / 72° À Terre). Cette rotation autour des pieds (60,150)
 *  envoie la tête d'un rig à x≈208 dans une boîte de rasterisation large de 120 : le corps y serait
 *  tranché. La porter demande une boîte de sujet et un quad ancrés autrement (largeur ET décalage
 *  d'ancre) — un chantier de billboard, pas un réglage. */
export function actorBillboards(actors: readonly ActorPose[], scene: Scene, mpt: number, tintAt: TintAt): BillboardSubject[] {
  const defs = `<defs>${DEFS}</defs>`;
  const out: BillboardSubject[] = [];
  for (const { c, x, y, z, facing } of actors) {
    if (isStructure(c)) continue;
    const inputs = actorDrawInputs(c);
    const { render: r, ground } = inputs;
    let draw: ((view: View, mirror: boolean) => string) | null = null;
    if (inputs.rig) {
      const { appearance, equip, tenue, overlays } = inputs.rig;
      const couché = rigGroundPose(ground);
      draw = (view, mirror) => bonesToSvg(resolveRig(appearance, equip, couché ?? {}, tenue, view, overlays, mirror));
    } else {
      const plan = planById(r.plan);
      if (plan) {
        // Gabarit AU SOL : pose de mort (ou affaissement À Terre) et ailes ÉTALÉES, comme `usePlanAnim`.
        const couché = planGroundPose(plan, ground);
        const opts = inputs.plan ?? {};
        draw = (view, mirror) => {
          const body = bonesToSvg(plan.resolve(r.species, view, couché ?? plan.restPose(), {
            ...opts,
            ...(ground ? { wings: 'spread' as const } : {}),
          }));
          return mirror ? `<g transform="translate(${BB_W},0) scale(-1,1)">${body}</g>` : body;
        };
      }
    }
    if (!draw) continue;
    const trace = draw;
    const off = (sizeFootprint(c.size) - 1) / 2;
    out.push({
      identity: `acteur:${c.id}|${hash32(stableStr(inputs)).toString(16)}`, // la signature du DESSIN, cf. `combatantRenderSignature`
      kind: 'personnage',
      anchor: new THREE.Vector3((x + off) * mpt, heightAt(scene, Math.round(x), Math.round(y), z), (y + off) * mpt),
      facing: facing ?? 'S',
      scaleK: inputs.scaleK,
      tint: tintAt(`${Math.round(x)},${Math.round(y)},${z}`),
      box: { w: BB_W, h: BB_H },
      svg: (view, mirror) => defs + trace(view, mirror),
    });
  }
  return out;
}

// ————————————————————————————————————————————————————————————————
// LUMIÈRE — un soleil CALIBRÉ, indépendant de la taille de la carte
// ————————————————————————————————————————————————————————————————

/** Élévation du soleil au-dessus de l'horizon (degrés). CONSTANTE : une hauteur dérivée de la taille de
 *  la carte met le soleil d'autant plus près du zénith que la scène est grande, et les blocs de terrain
 *  cessent d'y projeter. Mesuré (#1176, lancer de rayon sur les centroïdes de sol) : sol d'HERBE occulté
 *  0,0 % à `siege-enceinte` sous le soleil dérivé, 6,3 % à 38°. */
export const SUN_ELEVATION_DEG = 38;

/** Azimut du soleil — direction unitaire au sol du point OÙ IL EST (sud-ouest). Mesuré (#1176, même
 *  lancer de rayon) : herbe occultée siège 0,0 % au nord-ouest → 6,3 % au sud-ouest ; arène 21,8 % →
 *  32,0 %. Le nord-ouest jetait les ombres des remparts vers l'intérieur pavé, jamais sur la plaine. */
export const SUN_AZIMUTH = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };

/** Couleur des DEUX lumières. Une lumière module la LUMINANCE ; la teinte de l'albédo est l'identité du
 *  jeu et ne se repeint pas (soleil ambré mesuré #1176 : bois `#6E5940` rendu `#473827`). */
export const LIGHT_COLOR = 0xffffff;

/** Ambiante : le PLANCHER lumineux d'une face dos au soleil (jamais le noir). */
export const AMBIENT_INTENSITY = 0.45;
/** Directionnelle, calibrée AVEC l'ambiante : sous le modèle lambertien de three, une nappe au sol reçoit
 *  `AMBIENT + SUN·sin(SUN_ELEVATION_DEG)` et une face dos au soleil `AMBIENT`, soit un CONTRASTE
 *  `1 + sin(élévation)·SUN/AMBIENT` = 2,16 aux valeurs ci-dessus. */
export const SUN_INTENSITY = 0.85;

/** Côté (px) de la carte d'ombre. */
export const SHADOW_MAP_SIZE = 2048;
/** Décalage du receveur le long de sa normale, exprimé en TEXELS de la carte d'ombre (jamais en mètres
 *  fixes : à 0,35 m il mangeait l'ombre entière d'un bloc bas et laissait les franges des silhouettes). */
export const SHADOW_NORMAL_BIAS_TEXELS = 3;
/** Marge (m) entre la sphère englobante de la scène et les plans du frustum d'ombre. */
export const SHADOW_MARGIN_M = 4;

/** Contraste ANALYTIQUE du réglage : nappe au sol ÷ face dos au soleil, sous le lambertien de three. */
export function sunContrast(): number {
  return 1 + Math.sin((SUN_ELEVATION_DEG * Math.PI) / 180) * (SUN_INTENSITY / AMBIENT_INTENSITY);
}

/** Réglage complet du soleil d'une scène : pose + frustum d'ombre SERRÉ sur sa sphère englobante. */
export interface SunRig {
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** Demi-côté du frustum d'ombre (m). */
  span: number;
  near: number;
  far: number;
  mapSize: number;
  normalBias: number;
}

/** Soleil d'une scène de boîte englobante `box` : élévation et azimut FIXES, distance et frustum
 *  d'ombre dérivés du seul rayon englobant — toute la scène caste, et rien de plus n'entre dans la
 *  carte d'ombre (chaque mètre de frustum en trop est de la précision perdue). La `box` attendue est
 *  celle des CASTEURS, billboards compris (`worldShadowBox`).
 *
 *  Ni l'heure de jeu ni le nord de la carte n'entrent dans ce réglage : la course du soleil
 *  (`sunDirection(gameTime, northDeg)`) est spécifiée au #1176. */
export function sunRig(box: THREE.Box3): SunRig {
  const target = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
  const elev = (SUN_ELEVATION_DEG * Math.PI) / 180;
  const dir = new THREE.Vector3(
    SUN_AZIMUTH.x * Math.cos(elev),
    Math.sin(elev),
    SUN_AZIMUTH.z * Math.cos(elev),
  ).normalize();
  const distance = radius * 2 + SHADOW_MARGIN_M;
  return {
    position: target.clone().addScaledVector(dir, distance),
    target,
    span: radius,
    near: Math.max(0.1, distance - radius - SHADOW_MARGIN_M),
    far: distance + radius + SHADOW_MARGIN_M,
    mapSize: SHADOW_MAP_SIZE,
    normalBias: ((2 * radius) / SHADOW_MAP_SIZE) * SHADOW_NORMAL_BIAS_TEXELS,
  };
}

// ————————————————————————————————————————————————————————————————
// CIEL & BRUME — les couleurs du POV, prises au catalogue d'ambiance
// ————————————————————————————————————————————————————————————————

/** Nombre de paliers du dégradé de ciel. */
const SKY_STEPS = 64;

/** Couleur `#rrggbb` du catalogue en composantes SANS conversion d'espace : la texture de fond est
 *  déclarée sRGB, ses octets sont donc ceux de la donnée. */
function srgb(hex: string): THREE.Color {
  return new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);
}

/** Fond de CIEL : dégradé vertical `skyTop` (haut) → `fogOutdoor` (horizon à mi-hauteur, et dessous),
 *  soit EXACTEMENT le dégradé `pov-sky` du POV SVG (`povAmbianceDefs`) — aucune teinte propre au spike. */
export function skyTexture(): THREE.DataTexture {
  const haut = srgb(AMBIANCE.pov.skyTop);
  const horizon = srgb(AMBIANCE.pov.fogOutdoor);
  const data = new Uint8Array(SKY_STEPS * 4);
  for (let i = 0; i < SKY_STEPS; i++) {
    const v = i / (SKY_STEPS - 1); // 0 = bas de l'image
    const c = horizon.clone().lerp(haut, Math.max(0, (v - 0.5) * 2));
    data.set([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, 1, SKY_STEPS, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Brume atmosphérique d'extérieur : la courbe du POV (`AMBIANCE.pov.depth.outdoor`, en CASES → mètres)
 *  et la brume des SURFACES — le sol s'y éteint au lieu de finir sur une arête franche. */
export function outdoorFog(mpt: number): THREE.Fog {
  const d = AMBIANCE.pov.depth.outdoor;
  return new THREE.Fog(AMBIANCE.pov.fogOutdoorSurface, d.fogStartT * mpt, d.farTiles * mpt);
}

// ————————————————————————————————————————————————————————————————
// BILLBOARDS — profondeur et ombre de contact
// ————————————————————————————————————————————————————————————————

/** Biais de PROFONDEUR (m) d'un quad de billboard : un plan aligné écran plonge sinon dans la géométrie
 *  qu'il touche (silhouettes tranchées par une ligne de crête). Il ne DÉPLACE pas le sujet — un
 *  déplacement monde le long du regard faisait glisser l'ombre de contact de ±0,33 m avec la caméra et
 *  grossissait la silhouette de 17,6 % au POV à 2 m. Il se dépose sur le seul tampon de profondeur
 *  (`polygonOffset`), donc ni sur la passe d'ombre (three fabrique son propre `MeshDepthMaterial` :
 *  `getDepthMaterial`, `three.module.js:9467`, qui ne recopie pas `polygonOffset*`), ni sur la taille. */
export const BILLBOARD_DEPTH_BIAS_M = 0.3;

/** Bits du tampon de profondeur d'un contexte WebGL (`depth: true`) — l'unité de `polygonOffsetUnits`
 *  vaut 2^-BITS de profondeur FENÊTRE. */
export const DEPTH_BUFFER_BITS = 24;

/** `polygonOffsetUnits` (négatif = vers l'œil) qui vaut `BILLBOARD_DEPTH_BIAS_M` pour une caméra de
 *  bornes `near`/`far`. ORTHO : la profondeur fenêtre est linéaire, un mètre y vaut `1/(far−near)`.
 *  PERSPECTIVE (`distanceM` fourni) : elle ne l'est pas — un mètre à la distance `d` vaut
 *  `near·far/((far−near)·d²)`. */
export function billboardDepthOffsetUnits(near: number, far: number, distanceM: number | null = null): number {
  const parMetre = distanceM === null
    ? 1 / (far - near)
    : (near * far) / ((far - near) * Math.max(distanceM, near) ** 2);
  return -BILLBOARD_DEPTH_BIAS_M * parMetre * 2 ** DEPTH_BUFFER_BITS;
}

/** Position MONDE du centre d'un quad de billboard aligné écran : l'ancre PIEDS est EXACTE, le quad
 *  monte de sa demi-hauteur le long du haut d'écran. Aucune avance le long du regard : l'arête basse du
 *  quad reste sur l'ancre quelle que soit la caméra. */
export function billboardPose(anchor: THREE.Vector3, centerLiftM: number, camQuat: THREE.Quaternion): THREE.Vector3 {
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camQuat);
  return anchor.clone().addScaledVector(up, centerLiftM);
}

/** Boîte des CASTEURS d'ombre : la géométrie du monde ÉLARGIE aux quads des billboards. Le sujet le plus
 *  haut du siège dépassait la boîte de géométrie de 0,769 m (mesuré #1176, convention `jeu` ; 3,44 m à
 *  `pont-vitrine` en `heroique`) — hors frustum, une silhouette cesse de projeter. */
export function worldShadowBox(
  geoBox: THREE.Box3,
  subjects: readonly BillboardSubject[],
  quadOf: (sub: BillboardSubject) => { widthM: number; heightM: number },
): THREE.Box3 {
  const box = geoBox.clone();
  const p = new THREE.Vector3();
  for (const sub of subjects) {
    const { widthM, heightM } = quadOf(sub);
    const r = widthM / 2;
    for (const dx of [-r, r])
      for (const dz of [-r, r])
        for (const dy of [0, heightM]) box.expandByPoint(p.copy(sub.anchor).add(new THREE.Vector3(dx, dy, dz)));
  }
  return box;
}

/** Boîte du BÂTI d'une scène : les faces dont le matériau n'est PAS du terrain nu (relief, structure,
 *  toiture). `null` quand la carte n'en porte aucune. La géométrie se calcule sur la liste ENTIÈRE puis
 *  se FILTRE — le rang coplanaire de `facesGeometry` se mesure sur toute la scène (contrat de
 *  `coplanarRanks`) : sur une liste amputée, les mêmes faces sortent à un biais différent.
 *
 *  MÉMOÏSÉE par (scène, `mpt`) via le patron canonique `memoByRefDeps` : elle rejoue `worldFaces` +
 *  `facesGeometry`, soit la passe de `buildWorldGeometry` une seconde fois (mesuré #1181 : 1633 ms sur
 *  `opera`, contre 1815 ms pour la géométrie du monde) — une rotation ou un zoom ne la repaie plus. */
const builtFacesBoxMemo = memoByRefDeps<Scene, THREE.Box3 | null>();
function builtFacesBox(scene: Scene, mpt: number): THREE.Box3 | null {
  return builtFacesBoxMemo(scene, [mpt], () => computeBuiltFacesBox(scene, mpt));
}

function computeBuiltFacesBox(scene: Scene, mpt: number): THREE.Box3 | null {
  const faces = worldFaces(scene).map((f) => f.face);
  const geoms = facesGeometry(faces, mpt, faceDepthOf(mpt));
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (let i = 0; i < faces.length; i++) {
    if (faces[i].material.domain === 'terrain') continue;
    for (const tri of geoms[i].tris) for (const s of tri) box.expandByPoint(p.set(s.x, s.y, s.z));
  }
  return box.isEmpty() ? null : box;
}

/** Boîte du CONTENU d'une scène — ce qu'un cadrage doit tenir : le BÂTI élargi aux quads des sujets.
 *  Repli sur `fallback` (la géométrie entière) pour une carte SANS bâti : cadrer sur une boîte vide n'a
 *  pas de sens. Écart mesuré (#1176) entre géométrie et contenu : `vitrine-batiments` 60×48 m → 51,4×37,1 m,
 *  `pont-vitrine` 32×32 m → 31,9×25,9 m ; `siege-enceinte` 60,2×92 m → 60,2×85,9 m (son bâti touche presque
 *  les bords : là, c'est l'ÉCHELLE, pas le contenu, qui débordait le cadre). */
export function contentBox(
  scene: Scene,
  mpt: number,
  subjects: readonly BillboardSubject[],
  quadOf: (sub: BillboardSubject) => { widthM: number; heightM: number },
  fallback: THREE.Box3,
): THREE.Box3 {
  return worldShadowBox(builtFacesBox(scene, mpt) ?? fallback, subjects, quadOf);
}

/** Le disque d'ombre de contact n'a lieu d'être qu'en couleur CUITE : en mode éclairé, le billboard
 *  projette sa VRAIE ombre (`castShadow`) et le disque en ferait une seconde, à l'aplomb. */
export function wantsContactShadow(kind: BillboardKind, lit: boolean): boolean {
  return kind === 'personnage' && !lit;
}

/** Décollement (m) du disque d'ombre au-dessus du sol qui le porte. */
export const CONTACT_SHADOW_LIFT_M = 0.02;
/** Rayon de l'ombre de contact, en part de la LARGEUR du quad du sujet. */
export const CONTACT_SHADOW_RADIUS_K = 0.35;
export const CONTACT_SHADOW_OPACITY = 0.28;

/** Ombre de CONTACT d'un billboard : un disque sombre plaqué au sol, à l'aplomb EXACT de l'ancre pieds
 *  (mêmes x/z que le sujet — un décalage y laisse une ellipse orpheline à côté du personnage). */
export function contactShadow(
  anchor: THREE.Vector3,
  widthM: number,
): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
  const geo = new THREE.CircleGeometry(widthM * CONTACT_SHADOW_RADIUS_K, 24);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: CONTACT_SHADOW_OPACITY,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(anchor.x, anchor.y + CONTACT_SHADOW_LIFT_M, anchor.z);
  return mesh;
}
