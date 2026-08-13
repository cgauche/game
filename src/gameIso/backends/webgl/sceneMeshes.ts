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
import { teamRingDecor } from '../../builders/dynamicMarks';
import type { CellSide, Face, PropEl, RoofEl, SceneEl, TokenEl, WallEl } from '../../builders/types';
import { roofCourseStepM, variantOf } from '../../detail/courses';
import type { DetailRecipe } from '../../detail/types';
import type { PeriodKind } from './periodTexture';
import { faceBakeKey, needsFaceBake } from './faceBake';
import { facePoly, faceUvFrame, facesGeometry, polyNormal } from './worldTris';
import { faceSurface, tintVarFactor } from './faceColors';
import { faceDepthOf } from './faceRelief';
import { BB_W, BB_H } from '../../pov/billboardCore';
import { povDepth } from '../../pov/camera';
import { type BillboardKind } from './billboardMath';
import { DEFS } from '../../sprites';
import { propSvg } from '../../catalog/decor';
import { AMBIANCE, METEO_SANS_EFFET, type WeatherLight } from '../../catalog/ambiance';
import { bonesToSvg } from '../../rig/renderBones';
import { resolveRig } from '../../rig/composeRig';
import type { RigOverlay } from '../../rig/bones';
import { entityRigProfileFor, enemyRigProfile, rendersFromOwnInventory } from '../../rig/enemyProfile';
import { planById, planOptsForRecord, type RenderResolution, type ResolveOpts } from '../../rig/bodyPlan';
import { defaultAppearance, type Appearance } from '../../rig/appearance';
import { equipFromCombatant, isShield, type EquipCtx } from '../../rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from '../../rig/parts/combatantVisuals';
import { mountedPlanOpts, mountedRest, seatPlacement, seatRiderOnMount } from '../../rig/mountedRig';
import { diagOnce } from '../../rig/devDiag';
import { isStructure } from '../../../engine/structures';
import type { Combatant } from '../../../engine/types';
import { combatantRender, combatantTokenScale, entityRender, entityTokenScale, sceneEntityForRender, sizeTokenScale } from '../../sizeScale';
import { groundStateOf, planGroundPose, rigGroundPose, type GroundState } from '../../groundPose';
import { hash32 } from '../../detail/hash';
import { entitySize } from '../../../state/spawn';
import { sizeFootprint } from '../../../state/footprint';
import type { View } from '../../rig/facing';
import type { Rot } from '../../../geometry/iso';
import type { Dir8 } from '../../../state/dir8';
import { heightAt, type Scene, type SceneEntity, type WallSide } from '../../../state/scene';
import { memoByRef, memoByRefDeps } from '../../../state/sceneMemo';

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
  // ASSISES : décidées par la SURFACE (recette + échelle d'UV), sans aucun filtre de `WallPart`. Les
  // deux voies SVG, elles, les restreignent à trois parts (`COURSED`, `backends/affineWalls.ts:39` ;
  // `pov/geometry.ts:753`) — une part maçonnée hors de ce jeu (plinthe…) portant `courses` reçoit donc
  // ici des assises que l'affine ne peint pas. Bascule VISIBLE PAR LE JOUEUR au passage au volumique
  // (#1176) : à trancher en recette, pas au hasard d'un backend.
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
  /** MODELÉ DE FORME (#1300) : le facteur de famille d'orientation de CHAQUE SOMMET, cuit avec la
   *  géométrie (il n'est fonction que d'elle). PAR SOMMET et non par `FaceSpan`, parce qu'un span est
   *  une FACE et qu'une face de structure est une BOÎTE : mesuré sur l'arène, 1 598 spans sur 4 395
   *  (71,1 % des triangles) portent au moins deux familles, jusqu'à 5 dans un seul span — un facteur
   *  par span aurait donné aux deux joues d'un mur la même valeur. */
  shades: Float32Array;
}

/** FAMILLES D'ORIENTATION du modelé de forme (#1300) : les deux horizontales (`haut` = sol, toit,
 *  chant supérieur ; `bas` = soffite), et les quatre verticales NOMMÉES PAR LA DIRECTION QU'ELLES
 *  REGARDENT, dans l'ordre CYCLIQUE de la grille. */
export type ShadeFamily = 'haut' | 'bas' | '-z' | '+x' | '+z' | '-x';

/** L'ordre CYCLIQUE de la grille — l'index d'une verticale ici EST l'index de son facteur dans la
 *  donnée (`AMBIANCE.faceShade.verticales`), dont le schéma tient la décroissance stricte. Deux
 *  familles voisines dans ce cycle forment un ANGLE de la scène : c'est la paire qui doit se séparer. */
export const SHADE_CYCLE: readonly ShadeFamily[] = ['-z', '+x', '+z', '-x'];

/** Famille d'une normale — l'axe DOMINANT décide, son signe nomme la famille. `null` pour une normale
 *  indéterminée (triangle dégénéré). Une pente à 45° compte pour horizontale : elle se marche. */
export function shadeFamily(n: { x: number; y: number; z: number } | null): ShadeFamily | null {
  if (!n) return null;
  if (Math.abs(n.y) >= Math.max(Math.abs(n.x), Math.abs(n.z))) return n.y > 0 ? 'haut' : 'bas';
  return Math.abs(n.x) >= Math.abs(n.z) ? (n.x > 0 ? '+x' : '-x') : n.z > 0 ? '+z' : '-z';
}

/** Facteur d'irradiance ambiante de cette famille (donnée `AMBIANCE.faceShade`). Une famille
 *  indéterminée ne modèle rien : facteur NEUTRE, jamais un assombrissement par défaut. */
export function shadeFactorOf(f: ShadeFamily | null): number {
  const d = AMBIANCE.faceShade;
  if (f === null) return 1;
  if (f === 'haut') return d.haut;
  if (f === 'bas') return d.bas;
  return d.verticales[SHADE_CYCLE.indexOf(f)];
}

/** PORTE du modelé : ce que le facteur de famille devient sous un soleil allumé à la part `fade`
 *  (`sunFade`, `stage/stageLights.ts`). `fade = 0` — intérieur, nuit, soleil rasant — laisse le
 *  facteur PLEIN ; `fade = 1` le ramène à 1, la directionnelle faisant seule le modelé. CONTINUE et
 *  affine en `fade` : le lever ne peut pas y faire de marche. */
export function shadeSousSoleil(shade: number, fade: number): number {
  return 1 - (1 - shade) * (1 - fade);
}

/**
 * READ-SET de la CUISSON du monde (`worldFaces` → `buildFloors`/`buildWalls`/`buildRoofs`, plus
 * l'orientation des triangles qui lit `scene.dimensions`) et des accents de sol qui la partagent
 * (`groundAccents.sceneGroundAccents`, bâti sur les MÊMES faces). Un hôte qui reforge la référence de
 * scène à chaque geste (l'éditeur : `paintTiles` en produit une par `pointermove`) retient sa cuisson
 * SUR CETTE LISTE — sinon 634 ms de re-cuisson par tick, mesurés sur La Diligence.
 *
 * DÉRIVÉE DU READ-SET, pas devinée — et gardée champ par champ (`bake-retention.test.ts`), parce
 * qu'un champ manquant = un monde périmé à l'écran, invisible autrement.
 * `scene.effectZones` en est ABSENT sciemment : `buildRoofs` le lit (`massRoomZoneIds`), mais il
 * n'entre dans AUCUNE face, aucun sommet, aucun groupe de surface — seulement dans le champ
 * `roomZoneIds` des éléments de toit ET de façade. Ce champ ne SURVIT PLUS à la cuisson (`elCuit`
 * ci-dessous le retire) : un monde cuit ne peut donc pas rendre une zone de pièce périmée à la loi de
 * dégagement qui l'interroge. L'hôte qui en a besoin la résout sur SA scène vive, par la clé stable
 * de l'élément (`roomZonesByElKey`).
 */
export function worldBakeDeps(scene: Scene, mpt: number): readonly unknown[] {
  return [scene.layers, scene.dimensions, scene.walls, scene.architecture, scene.metresPerTile, mpt];
}

/** READ-SET de `heightAt` (`state/scene.ts`) — la SEULE lecture de scène des passes de billboards
 *  (`collectBillboards`, `actorBillboards` : elles prennent tout le reste de leurs éléments). */
export function sceneHeightDeps(scene: Scene): readonly unknown[] {
  return [scene.layers, scene.dimensions];
}

/**
 * Ce que le monde CUIT retient d'un élément : son identité de dégagement, PRIVÉE de tout champ dérivé
 * d'une donnée HORS read-set de la cuisson. Un seul aujourd'hui, et il est piégeux — `roomZoneIds`
 * (nappes de toit `buildRoofs`, façades `buildWalls`) descend de `scene.effectZones` : retenu dans le
 * bake, il aurait rendu une vérité PÉRIMÉE à `applyCutawayMask`, qui interroge `KeepEl` sur l'élément
 * cuit. Le retirer rend la péremption IMPOSSIBLE au lieu de la rendre improbable.
 */
function elCuit(el: SceneEl): SceneEl {
  if ((el.kind === 'roof' || el.kind === 'wall') && el.roomZoneIds !== undefined) {
    const { roomZoneIds: _zones, ...reste } = el;
    return reste as SceneEl;
  }
  return el;
}

/**
 * ZONES DE PIÈCE par clé d'élément, résolues sur une scène VIVE — le pendant d'`elCuit` : ce que le
 * monde cuit ne retient pas, l'hôte le redemande ici, et sa loi de dégagement (`KeepEl`) le lit à
 * jour. La clé est celle du builder (`SceneEl.key`), stable d'une frame à l'autre.
 * MÉMOÏSÉE par référence de scène : en JEU la référence est stable (ce calcul ne se rejoue pas d'un
 * pas à l'autre) ; un hôte qui la reforge au tick ne la consomme pas (l'éditeur n'a pas de cutaway).
 */
const zonesVivesMemo = memoByRef((scene: Scene) => {
  const table = new Map<string, readonly string[]>();
  for (const el of buildRoofs(scene)) if (el.roomZoneIds?.length) table.set(el.key, el.roomZoneIds);
  for (const el of buildWalls(scene)) if (el.roomZoneIds?.length) table.set(el.key, el.roomZoneIds);
  return table;
});

export function roomZonesByElKey(scene: Scene): ReadonlyMap<string, readonly string[]> {
  return zonesVivesMemo(scene);
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
  const shades: number[] = [];
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
      // MODELÉ DE FORME (#1300) : la famille se lit sur la normale TELLE QUE LA LOI CI-DESSUS LA
      // PRÉSENTE — la normale géométrique d'origine ne porte de sens QUE si `g.oriented`. Mesuré sur
      // trois cartes (arène, opéra, siège) : 100 % des triangles de sol sortent du pivot avec une
      // normale géométrique vers le BAS (5 112 / 1 178 / 3 328), que cette loi retourne vers le haut ;
      // les lire avant elle aurait peint tous les sols de toutes les scènes en famille de soffite.
      const vue = n && !versLExterieur ? { x: -n.x, y: -n.y, z: -n.z } : n;
      const s = shadeFactorOf(shadeFamily(vue));
      // Le retournement d'un triangle PERMUTE ses UV comme ses sommets (elles sont par SOMMET).
      const ordre = versLExterieur ? [0, 1, 2] : [0, 2, 1];
      for (const k of ordre) {
        const p = tri[k];
        positions.push(p.x, p.y, p.z);
        uvs.push(g.uv[t][k].u, g.uv[t][k].v);
        uv1s.push(g.uv1[t][k].u, g.uv1[t][k].v);
        shades.push(s);
      }
    });
    // La couleur de sommet porte l'albédo du matériau × la variance de teinte de la surface (un aplat
    // répété tuile après tuile se lit sinon comme une nappe de peinture) × la visibilité de la case —
    // ce dernier facteur SEUL est réversible, et c'est `applyVisibilityTint` qui le pose.
    const surface = faceSurface(faces[i]);
    spans.push({
      cellKey: listées[i].cellKey,
      el: elCuit(listées[i].el),
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
  return { geometry, spans, shades: new Float32Array(shades) };
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
 *  pas), la géométrie n'est pas touchée. C'est la passe qui suit le PAS du groupe (re-mesurée #1300 sur
 *  l'arène, MODELÉ COMPRIS — une lecture et trois multiplications de plus par sommet : 1,34 ms médian
 *  pour 19 358 triangles / 58 074 sommets, contre 492 ms de re-bake). Rend la géométrie, pour l'appelant qui
 *  compose les deux — LA géométrie du bake, pas une copie : le dernier appel fait la couleur affichée.
 *  D'où le contrat de propriété de `BakedWorld` (un bake = un consommateur de teinte).
 *
 *  C'est aussi la passe qui porte le MODELÉ DE FORME (#1300) : le facteur de famille d'orientation du
 *  sommet (`baked.shades`), passé par la PORTE du soleil `fade` — la part de soleil réellement allumée
 *  (`sunFade`, `stage/stageLights.ts`). `fade = 1` (plein soleil) est le NEUTRE de cette porte : le
 *  modelé s'efface entièrement, la directionnelle le faisant seule. C'est pourquoi un appelant qui
 *  n'a pas de soleil à déclarer (gardes de géométrie, cadrage) obtient exactement les couleurs
 *  d'avant le lot. */
export function applyVisibilityTint(baked: BakedWorld, tintAt: TintAt, fade = 1): WorldGeometry {
  const attr = baked.geometry.getAttribute('color') as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  const c = new THREE.Color();
  for (const span of baked.spans) {
    c.set(span.color).multiplyScalar(tintAt(span.cellKey) * span.varFactor);
    const fin = (span.start + span.count) * 3;
    for (let i = span.start * 3, v = span.start; i < fin; i += 3, v++) {
      const k = shadeSousSoleil(baked.shades[v], fade);
      arr[i] = c.r * k;
      arr[i + 1] = c.g * k;
      arr[i + 2] = c.b * k;
    }
  }
  attr.needsUpdate = true;
  return baked.geometry;
}

/** Monde cuit ET teinté en un geste — pour un appelant qui n'a pas de teinte à faire varier (gardes,
 *  cadrage). Un écran qui suit la visibilité garde le bake et ne rejoue que `applyVisibilityTint`. */
export function buildWorldGeometry(scene: Scene, mpt: number, tintAt: TintAt, fade = 1): WorldGeometry {
  return applyVisibilityTint(bakeWorldGeometry(scene, mpt), tintAt, fade);
}

/** Un sujet de billboard prêt à texturer : où il se pose, à quelle échelle, et comment il se dessine. */
export interface BillboardSubject {
  /** Identité de cache (hors vue/miroir/palier — cf. `billboardTextureKey`). */
  identity: string;
  /** Id du COMBATTANT dessiné, quand ce sujet en est un (`actorBillboards`) — ce que le hit-test de
   *  sprite rend au pointeur (`stage/spritePicker.ts`). Absent pour un figurant ou un décor : ni l'un
   *  ni l'autre ne porte de `data-cid` en affine, ils n'y sont donc pas cliquables non plus. */
  cid?: string;
  /** COULEUR D'ÉQUIPE du jeton (#1297) — celle de son anneau aux pieds (`teamRingDecor`), portée ici
   *  pour que sa SILHOUETTE à travers les murs en soit teintée. Absente pour un figurant ou un décor,
   *  qui n'appartiennent à aucune équipe et ne se silhouettent pas. */
  teamColor?: string;
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
      // IDENTITÉ = la clé de l'élément ET sa SIGNATURE DE DESSIN (#1176, P3-3) — même doctrine que
      // l'acteur (`ActorDrawInputs`/`combatantRenderSignature`). La clé seule ne suffit PAS : elle
      // porte l'id de l'ENTITÉ (`prop:decor-1`) ou la CASE d'un overlay de terrain (`ov:x,y,z`), donc
      // deux modèles de décor différents — ou deux terrains à décor différents sur la même case —
      // partageaient une entrée de cache et le premier dessin restait à l'écran. Le cache de textures
      // ne se vide plus à chaque référence de scène (rétention par contenu) : il n'y a plus de purge
      // pour masquer cette collision, un modèle changé à l'inspecteur la rendrait éternelle.
      identity: `prop:${el.key}|${el.ref}`,
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

/** ACTEUR à billboarder : le combattant (groupe en exploration, combattants en combat) et sa case
 *  LOGIQUE — l'ancre CUITE du quad. Le GLISSEMENT de marche n'entre pas ici : la boucle de rendu le
 *  redemande par frame (`StageWalkAnim.glide`) et ne décale que la matrice du quad (#1176, P2-4). */
export interface ActorPose {
  c: Combatant;
  x: number;
  y: number;
  z: number;
  /** Orientation MONDE vivante (store `facing`, jamais un champ du combattant). */
  facing?: Dir8;
  /** CAVALIER du couple, quand `c` est une MONTURE portée (`TokenSubjectEl` `mounted`) : le sujet
   *  devient alors UN billboard COMPOSITE (cavalier assis sur la monture, trié à l'os), à la case et
   *  à l'échelle de la monture — comme le `BodyToken` unique de la voie affine. */
  rider?: Combatant;
  /** ORDINAL d'anneau de héros (`TokenSubjectEl.heroIndex`) — l'identité d'équipe du jeton, dont sa
   *  couleur d'anneau ET la teinte de sa silhouette se dérivent (`teamRingDecor`). Pour un couple
   *  MONTÉ, c'est l'ordinal du CAVALIER : il se lit avec `rider`, jamais avec la monture. */
  heroIndex?: number;
}

/** Poses d'acteur des ÉLÉMENTS DU BUILDER — la SEULE dérivation acteurs du monde volumique (l'écran
 *  n'a aucun second jeu de lois : les filtres de rendu sont déjà ceux du builder). Un couple MONTÉ
 *  donne UNE pose : la monture porte case et échelle, le cavalier voyage avec elle. */
export function actorPoses(tokenEls: readonly TokenEl[], facings: Record<string, Dir8 | undefined>): ActorPose[] {
  const out: ActorPose[] = [];
  for (const tk of tokenEls) {
    const s = tk.subject;
    const unit = s.kind === 'combatant' ? s.c : s.kind === 'mounted' ? s.mount : null;
    if (!unit?.pos) continue;
    // `heroIndex` : l'ordinal d'anneau du builder, la SEULE entrée de la couleur d'équipe d'un héros
    // (`teamRingDecor`) — il voyage avec la pose, sinon la silhouette du corps et l'anneau aux pieds
    // d'un même jeton se peindraient de deux couleurs. Un couple MONTÉ porte celui de son cavalier.
    const heroIndex = s.kind === 'combatant' || s.kind === 'mounted' ? s.heroIndex : undefined;
    out.push({ c: unit, x: unit.pos.x, y: unit.pos.y, z: tk.cell.z, facing: facings[unit.id], ...(heroIndex !== undefined ? { heroIndex } : {}), ...(s.kind === 'mounted' ? { rider: s.rider } : {}) });
  }
  return out;
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
  const monté = p.rider ? `+${p.rider.id}:${combatantRenderSignature(p.rider)}` : '';
  return `${p.c.id}:${p.x},${p.y},${p.z}:${p.facing ?? ''}:${combatantRenderSignature(p.c)}${monté}`;
}

/** Les trois vues d'un corps. La boîte d'un sujet est UNE (le quad ne change pas quand la caméra
 *  tourne) : une boîte dérivée du dessin se mesure donc sur les trois. */
const VUES: readonly View[] = ['front', 'profile', 'back'];

/** Couple MONTÉ (LDB 14 l.175-187) rendu comme UN SEUL corps : le cavalier est ASSIS sur les os réels
 *  de la monture (`seatRiderOnMount` : ancre de selle dérivée de l'os `tronc`, z du cavalier remappé
 *  dans l'échelle du quadrupède), et le composite trié à l'os sort en UN fragment SVG — la MÊME
 *  composition que le corps affine (`MountedToken`), sans ses hooks d'animation. La monture donne la
 *  vue et le miroir du couple ; le cavalier prend la pose montée (`mountedRest`, selon l'arme tenue).
 *
 *  Le couple est le premier sujet à DÉBORDER la boîte canonique : assis, le cavalier monte au-dessus
 *  du garrot, et son crâne sortait par le haut d'une boîte de rasterisation 120×150 (mesuré #1176 :
 *  −18,6 en face). La boîte rendue est donc HAUSSÉE du débord et le fragment descend d'autant — pieds
 *  de la monture au bas de la boîte, ancre inchangée, quad plus haut (`subjectQuad`).
 *
 *  `null` = monture sans gabarit ou cavalier sans rig : l'appelant retombe sur le corps SEUL de la
 *  monture (le cavalier disparaît — défaut de DONNÉE, dit une fois en dev). */
function mountedSvg(
  mount: Combatant,
  rider: Combatant,
  riderInputs: ActorDrawInputs,
): { draw: (view: View, mirror: boolean) => string; box: { w: number; h: number } } | null {
  const mr = combatantRender(mount);
  const plan = planById(mr.plan);
  if (!plan || !riderInputs.rig) {
    if (import.meta.env?.DEV)
      diagOnce(`monté:${mount.id}+${rider.id}`, () =>
        console.error(
          `[bodyPlan] couple monté « ${mount.creatureId ?? mount.label} » + « ${rider.creatureId ?? rider.label} » : ${plan ? 'cavalier sans rig humanoïde' : 'monture sans gabarit'} — seule la monture est dessinée, donnée à corriger.`,
        ),
      );
    return null;
  }
  const { appearance, equip, tenue, overlays } = riderInputs.rig;
  const ground = groundStateOf(mount);
  const couché = planGroundPose(plan, ground);
  const opts: ResolveOpts = {
    ...mountedPlanOpts(mount.creatureId, mount.appearanceOverride),
    ...(ground ? { wings: 'spread' as const } : {}),
  };
  const arme = equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
  // k : échelle du cavalier DANS la boîte de la monture — chaîne d'échelles monde (art × Taille),
  // la même dérivation que `MountedToken`, jamais une constante.
  const k = combatantRender(rider).scale / (mr.scale * sizeTokenScale(mount.size));
  const osMonture = (view: View) => plan.resolve(mr.species, view, couché ?? plan.restPose(), opts);
  const assise = (view: View) => ({ view, mountScale: 1, riderScale: k });
  // Haut de la boîte du cavalier (0..150, contrat du rig) ramenée dans la boîte de la monture, pris
  // à la vue la plus haute : négatif = ce qui manque de ciel au-dessus des 150 px.
  const haut = Math.min(...VUES.map((v) => seatPlacement(osMonture(v), assise(v))[5]));
  const débord = Math.max(0, Math.ceil(-haut));
  return {
    box: { w: BB_W, h: BB_H + débord },
    draw: (view, mirror) => {
      const riderBones = resolveRig(appearance, equip, mountedRest(view, arme), tenue, view, overlays, mirror);
      const body = bonesToSvg(seatRiderOnMount(osMonture(view), riderBones, assise(view)));
      const posé = mirror ? `<g transform="translate(${BB_W},0) scale(-1,1)">${body}</g>` : body;
      return débord ? `<g transform="translate(0,${débord})">${posé}</g>` : posé;
    },
  };
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
  for (const { c, x, y, z, facing, rider, heroIndex } of actors) {
    if (isStructure(c)) continue;
    const inputs = actorDrawInputs(c);
    const { render: r, ground } = inputs;
    // Couple MONTÉ : UN sujet composite (jamais deux quads superposés), à la case et à l'échelle de
    // la monture — le pendant du `BodyToken` unique de la voie affine (`stage/tokens.tsx`). Une monture
    // sans gabarit ou un cavalier sans rig retombe sur le corps SEUL de la monture, ci-dessous.
    // Les entrées du cavalier sont résolues UNE fois : le tracé du composite et sa signature les
    // partagent (`actorDrawInputs` traverse tout l'équipement et la garde-robe).
    const riderInputs = rider ? actorDrawInputs(rider) : undefined;
    const monté = rider && riderInputs ? mountedSvg(c, rider, riderInputs) : null;
    let draw: ((view: View, mirror: boolean) => string) | null = monté?.draw ?? null;
    if (!draw && inputs.rig) {
      const { appearance, equip, tenue, overlays } = inputs.rig;
      const couché = rigGroundPose(ground);
      draw = (view, mirror) => bonesToSvg(resolveRig(appearance, equip, couché ?? {}, tenue, view, overlays, mirror));
    } else if (!draw) {
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
    const composite = monté ? rider : undefined; // cavalier RÉELLEMENT entré dans le fragment
    const trace = draw;
    const off = (sizeFootprint(c.size) - 1) / 2;
    out.push({
      // la signature du DESSIN, cf. `combatantRenderSignature` — le couple monté a SA clé (les deux
      // corps y entrent) : ni la monture seule ni le cavalier à pied ne peuvent la resservir.
      identity: `acteur:${c.id}${composite ? `+${composite.id}` : ''}|${hash32(stableStr(composite ? [inputs, riderInputs] : inputs)).toString(16)}`,
      cid: c.id,
      // TEINTE D'ÉQUIPE (#1297) : la MÊME dérivation que l'anneau aux pieds du jeton et que le jeton
      // affine — une seule loi de couleur d'équipe, quelle que soit la voie qui la peint. Un couple
      // MONTÉ se lit au CAVALIER (avec l'ordinal qu'il a réservé) : le record de la monture porte
      // souvent un autre camp que celui qu'elle transporte (`builders/tokens`).
      teamColor: teamRingDecor(rider ?? c, heroIndex).color,
      kind: 'personnage',
      anchor: new THREE.Vector3((x + off) * mpt, heightAt(scene, Math.round(x), Math.round(y), z), (y + off) * mpt),
      facing: facing ?? 'S',
      scaleK: inputs.scaleK,
      tint: tintAt(`${Math.round(x)},${Math.round(y)},${z}`),
      box: monté?.box ?? { w: BB_W, h: BB_H },
      svg: (view, mirror) => defs + trace(view, mirror),
    });
  }
  return out;
}

// ————————————————————————————————————————————————————————————————
// LUMIÈRE — le soleil de PLANCHE : calibré, FIXE, indépendant de la taille de la carte
// ————————————————————————————————————————————————————————————————
//
// Ce soleil-ci ne bouge JAMAIS : ni l'heure de jeu ni le nord de la carte n'y entrent. C'est le
// contrat des planches QC (`scripts/qc/spike-webgl.mjs` + ses gardes `spike-checks.mjs`), qui
// comparent des captures d'une session à l'autre — une planche ne peut pas changer parce que
// l'horloge a tourné. Le soleil du JEU, lui, suit l'heure et le nord de la scène : `sunJeu.ts`
// (course) → `stage/stageLights.ts` (montage), et il pose sa direction par `sunRigFrom`.

/** Élévation du soleil de PLANCHE au-dessus de l'horizon (degrés). CONSTANTE : une hauteur dérivée de la
 *  taille de la carte met le soleil d'autant plus près du zénith que la scène est grande, et les blocs de
 *  terrain cessent d'y projeter. Mesuré (#1176, lancer de rayon sur les centroïdes de sol) : sol d'HERBE
 *  occulté 0,0 % à `siege-enceinte` sous le soleil dérivé, 6,3 % à 38°. */
export const SUN_ELEVATION_DEG = 38;

/** Azimut du soleil de PLANCHE — direction unitaire au sol du point OÙ IL EST (sud-ouest). Mesuré (#1176,
 *  même lancer de rayon) : herbe occultée siège 0,0 % au nord-ouest → 6,3 % au sud-ouest ; arène 21,8 % →
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

/** Réglage d'ombre d'une scène de boîte englobante `box` pour une direction de soleil DONNÉE (direction
 *  unitaire du point OÙ IL EST) : distance et frustum d'ombre dérivés du seul rayon englobant — toute la
 *  scène caste, et rien de plus n'entre dans la carte d'ombre (chaque mètre de frustum en trop est de la
 *  précision perdue). La `box` attendue est celle des CASTEURS, billboards compris (`worldShadowBox`).
 *
 *  C'est la porte du soleil de JEU (`sunJeu.ts` : heure d'horloge × nord de la scène) ; le soleil de
 *  PLANCHE passe par `sunRig`, qui n'est que cette fonction à direction FIXE. */
export function sunRigFrom(box: THREE.Box3, dir: { x: number; y: number; z: number }): SunRig {
  const target = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
  const unité = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
  const distance = radius * 2 + SHADOW_MARGIN_M;
  return {
    position: target.clone().addScaledVector(unité, distance),
    target,
    span: radius,
    near: Math.max(0.1, distance - radius - SHADOW_MARGIN_M),
    far: distance + radius + SHADOW_MARGIN_M,
    mapSize: SHADOW_MAP_SIZE,
    normalBias: ((2 * radius) / SHADOW_MAP_SIZE) * SHADOW_NORMAL_BIAS_TEXELS,
  };
}

/** Soleil de PLANCHE d'une scène de boîte englobante `box` : élévation et azimut FIXES (cf. l'en-tête de
 *  section). Ni l'heure de jeu ni le nord de la carte n'y entrent — c'est ce que les gardes de planche
 *  épinglent, et c'est pourquoi le jeu passe, lui, par `sunRigFrom` + `sunJeu`. */
export function sunRig(box: THREE.Box3): SunRig {
  const elev = (SUN_ELEVATION_DEG * Math.PI) / 180;
  return sunRigFrom(box, {
    x: SUN_AZIMUTH.x * Math.cos(elev),
    y: Math.sin(elev),
    z: SUN_AZIMUTH.z * Math.cos(elev),
  });
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

/** TEINTE MÉTÉO d'une couleur de ciel, de brume ou de fond (#1247) : elle se déplace vers la teinte du
 *  voile authoré, dosée par son alpha (`weatherLightScalars`, `catalog/ambiance.ts`). C'est la MÊME
 *  donnée que celle qui dose les lampes de la scène (`stage/stageLights.ts`) — le ciel ne peut donc pas
 *  rester clair sur un monde assombri par l'orage. Rend une couleur NEUVE : `base` est intacte. PURE. */
export function weatherTinted(base: THREE.Color, meteo: WeatherLight = METEO_SANS_EFFET): THREE.Color {
  return meteo.tint ? base.clone().lerp(new THREE.Color(meteo.tint), meteo.k) : base.clone();
}

/** FOND du canevas volumique — celui des planches QC (`render-env.mts`), donc les captures et le jeu
 *  se comparent sans biais de contraste. SOURCE UNIQUE : l'écran de jeu et celui du spike le lisent
 *  ici. La météo le teinte (`stageClearColor`). */
export const STAGE_BG = 0x14161f;

/** Couleur d'effacement du canevas sous cette météo — le fond suit le même déplacement que la lumière
 *  et que le ciel du POV. PURE. */
export function stageClearColor(meteo: WeatherLight = METEO_SANS_EFFET): number {
  return weatherTinted(new THREE.Color(STAGE_BG), meteo).getHex();
}

/** Fond de CIEL : dégradé vertical `skyTop` (haut) → `fogOutdoor` (horizon à mi-hauteur, et dessous),
 *  soit EXACTEMENT le dégradé `pov-sky` du POV SVG (`povAmbianceDefs`) — aucune teinte propre au spike.
 *  La météo déplace les DEUX bouts du dégradé (#1247) : sous l'orage, l'horizon ne tranche pas avec
 *  des sols assombris. */
export function skyTexture(meteo: WeatherLight = METEO_SANS_EFFET): THREE.DataTexture {
  const haut = weatherTinted(srgb(AMBIANCE.pov.skyTop), meteo);
  const horizon = weatherTinted(srgb(AMBIANCE.pov.fogOutdoor), meteo);
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

/** FOND de la première personne : le dégradé de ciel dehors, la brume d'intérieur dedans (le POV n'y
 *  dessine aucun plafond — ce qui n'est pas peint est cette nappe sombre). DEUX couleurs, et c'est
 *  structurel : le fond porte la brume du CIEL (`fogOutdoor`), les surfaces la leur (`povFog`
 *  ci-dessous) — cf. le JSDoc de `AMBIANCE.pov.fogOutdoorSurface`.
 *  La météo ne touche QUE le dehors : entré sous un toit, on est sorti d'elle. */
export function povBackground(indoor: boolean, meteo: WeatherLight = METEO_SANS_EFFET): THREE.DataTexture | THREE.Color {
  return indoor ? new THREE.Color(AMBIANCE.pov.fogIndoor) : skyTexture(meteo);
}

/** Brume atmosphérique des SURFACES du POV : la courbe du milieu (`povDepth`, en CASES → mètres) et
 *  la brume qui lui répond — extérieur clair et chaud (`fogOutdoorSurface`, jamais le bleu du ciel :
 *  les sols lointains s'y relèveraient, « délavé »), intérieur sombre (`fogIndoor`). Le sol s'y éteint
 *  au lieu de finir sur une arête franche. Le GAMMA de la courbe, lui, vit au shader (`installFogGamma`
 *  + `applyFogGamma`) : `THREE.Fog` ne sait qu'interpoler en smoothstep.
 *
 *  MÉTÉO (#1247) : dehors, une brume authorée (`brume.color`) REMPLACE la couleur du milieu et son
 *  `povTightenK` resserre la courbe — le resserrement vient de `povDepth`, qui sert AUSSI le plan
 *  lointain de la caméra : la brume atteint 1 exactement à la coupure de rendu, jamais avant ni après.
 *
 *  ESPACE DE MÉLANGE (réf juge de design P3-1c) : three mélange la brume en LINÉAIRE (le fragment
 *  travaille après conversion), la voie affine la mélange en sRGB (`mixHex`). À facteur égal, les deux
 *  voies rendent donc des octets différents : 13,3/255 par canal à mi-course sur un couple gris sombre
 *  → brume claire, 8,1/255 à trois quarts. Le FACTEUR, lui, est le même des deux côtés (courbe vérifiée
 *  à 1e-9, `sceneMeshes.test.ts`) : l'écart est perceptuel, il se juge à l'écran. */
export function povFog(mpt: number, indoor: boolean, brume?: { color: string; povTightenK?: number } | null): THREE.Fog {
  const c = povDepth(indoor, brume?.povTightenK).curve;
  const teinte = !indoor && brume ? brume.color : indoor ? AMBIANCE.pov.fogIndoor : AMBIANCE.pov.fogOutdoorSurface;
  return new THREE.Fog(teinte, c.start * mpt, c.end * mpt);
}

/** Nom du `#define` par lequel un matériau réclame le gamma de la courbe POV. Un matériau qui ne le
 *  porte pas garde la brume de three au trait près : la surcharge de chunk ci-dessous est GLOBALE au
 *  module three (elle touche donc tous les écrans), le gamma ne l'est pas. */
export const FOG_GAMMA_DEFINE = 'POV_FOG_GAMMA';

/** Vrai une fois la surcharge posée — elle ne se pose qu'UNE fois par module three chargé. */
let gammaInstallé = false;

/** La ligne de `ShaderChunk.fog_fragment` (three r185) devant laquelle le gamma s'insère. Son absence
 *  (montée de version) laisse la brume de three intacte, et le banc de `sceneMeshes.test.ts` rouge. */
const ANCRE_FOG = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';

/**
 * SURCHARGE (idempotente, module-level) du fragment de brume de three. Le fog natif est
 * `smoothstep( fogNear, fogFar, vFogDepth )` — la MOITIÉ de la courbe du POV, qui est
 * `smoothstep^gamma` (`fogAt`, `pov/camera.ts`). Le `pow` manquant s'ajoute ici, pour TOUS les
 * matériaux embrumés d'un coup : un `onBeforeCompile` par matériau referait ce même travail quatre-
 * vingt-dix fois. Sous `#ifdef` : sans le define, le chunk surchargé rend exactement le chunk d'origine.
 */
export function installFogGamma(): void {
  if (gammaInstallé) return;
  gammaInstallé = true;
  const chunk = THREE.ShaderChunk.fog_fragment;
  THREE.ShaderChunk.fog_fragment = chunk.replace(
    ANCRE_FOG,
    `#ifdef ${FOG_GAMMA_DEFINE}\n\t\tfogFactor = pow( fogFactor, ${FOG_GAMMA_DEFINE} );\n\t#endif\n\t${ANCRE_FOG}`,
  );
}

/** Le `#define` est une constante de COMPILATION : un littéral flottant GLSL, jamais un entier nu
 *  (`pow( x, 2 )` ne compile pas). Quatre décimales : un gamma sous 0,00005 s'écrirait « 0.0000 », donc
 *  `pow(x, 0) = 1` — une brume PLEINE partout, sans un mot. Le schéma de la donnée le borne déjà
 *  (`fogGamma` ≥ 0,1, `src/data/schemas/defs/ambiance.ts`) ; ce garde-fou tient le site du littéral,
 *  qu'un gamma vienne de la donnée ou d'un appelant. #1176 P3-1c */
const littéralGlsl = (v: number): string => {
  const s = v.toFixed(4);
  if (!(Number(s) > 0)) throw new Error(`gamma de brume irreprésentable au shader : ${v} → « ${s} »`);
  return s;
};

/** Un matériau qui SAIT s'embrumer : `fog` n'est pas déclaré sur la classe de base de three, seulement
 *  sur les matériaux de surface (`MeshBasicMaterial`, `MeshLambertMaterial`…). */
export type MatériauEmbrumable = THREE.Material & { fog?: boolean };

/**
 * Pose (ou retire, avec `null`) le gamma de brume sur tous les matériaux EMBRUMÉS d'un sous-arbre, et
 * renvoie `true` si au moins un a changé (donc recompilé). C'est un `#define` et non un uniform : les
 * uniformes d'un matériau intégré (`MeshLambertMaterial`) sont clonés par three à la compilation et
 * inatteignables depuis le JS, là où `defines` est une propriété du matériau. Une scène entière partage
 * la même valeur → une seule clé de programme, donc UN programme comme avant.
 */
export function applyFogGamma(root: THREE.Object3D, gamma: number | null): boolean {
  if (gamma !== null) installFogGamma();
  const voulu = gamma === null ? undefined : littéralGlsl(gamma);
  let changé = false;
  root.traverse((o) => {
    const porteur = o as THREE.Mesh;
    if (!porteur.material) return;
    const mats = (Array.isArray(porteur.material) ? porteur.material : [porteur.material]) as MatériauEmbrumable[];
    for (const m of mats) {
      if (!m.fog) continue;
      const actuel = m.defines?.[FOG_GAMMA_DEFINE] as string | undefined;
      if (actuel === voulu) continue;
      if (voulu === undefined) delete m.defines![FOG_GAMMA_DEFINE];
      else (m.defines ??= {})[FOG_GAMMA_DEFINE] = voulu;
      m.needsUpdate = true;
      changé = true;
    }
  });
  return changé;
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
 *  PERSPECTIVE (`depthM` fourni) : elle ne l'est pas — `z_w = a + b/z_view`, donc un mètre à la
 *  PROFONDEUR `z` vaut `near·far/((far−near)·z²)`. La grandeur attendue est `z_view` (`billboardViewDepth`),
 *  jamais la distance euclidienne à l'œil. */
export function billboardDepthOffsetUnits(near: number, far: number, depthM: number | null = null): number {
  const parMetre = depthM === null
    ? 1 / (far - near)
    : (near * far) / ((far - near) * Math.max(depthM, near) ** 2);
  return -BILLBOARD_DEPTH_BIAS_M * parMetre * 2 ** DEPTH_BUFFER_BITS;
}

/** Œil et axe de VISÉE de travail — la caméra les redonne à chaque appel, et une allocation par
 *  billboard et par frame n'a rien à faire dans une boucle de pose. */
const OEIL_VUE = new THREE.Vector3();
const AVANT_VUE = new THREE.Vector3();

/** `z_view` d'un point sous `camera` : sa profondeur le long de l'axe de visée — la SEULE grandeur dont
 *  dépend la profondeur fenêtre d'une perspective. Un quad aligné écran est parallèle au plan image,
 *  donc son `z_view` est constant sur toute sa surface (ancre et centre compris), là où sa distance à
 *  l'œil croît vers les bords du champ : mesuré au FOV_X 75° (16/9), la distance ne rendait que
 *  0,185 m de biais au coin de l'écran pour 0,300 m demandés. */
export function billboardViewDepth(camera: THREE.Camera, p: THREE.Vector3): number {
  camera.getWorldPosition(OEIL_VUE);
  AVANT_VUE.set(0, 0, -1).applyQuaternion(camera.quaternion);
  return (p.x - OEIL_VUE.x) * AVANT_VUE.x + (p.y - OEIL_VUE.y) * AVANT_VUE.y + (p.z - OEIL_VUE.z) * AVANT_VUE.z;
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
  poseContactShadow(mesh, anchor);
  return mesh;
}

/** (Re)plaque un disque d'ombre sous une ancre pieds — le SEUL endroit qui décide de son aplomb, que
 *  le disque vienne d'être monté ou qu'il suive un sujet qui glisse (`stage/boardPose.ts`). */
export function poseContactShadow(disque: THREE.Object3D, anchor: THREE.Vector3): void {
  disque.position.set(anchor.x, anchor.y + CONTACT_SHADOW_LIFT_M, anchor.z);
}
