/**
 * SPIKE WebGL — ASSEMBLAGE d'une scène : les builders du pivot (`builders/floors|walls|roofs|props`)
 * deviennent (a) UNE géométrie de monde fusionnée (positions + couleurs de sommet), (b) une liste de
 * SUJETS de billboard (personnages riggés + décor), chacun capable de rendre SA chaîne SVG pour une vue.
 *
 * Deux invariants de ce module :
 *  - FUSION : toutes les faces de la scène tiennent dans UNE `BufferGeometry` non indexée (la couleur
 *    de face est cuite au sommet, le mode de rendu n'est qu'un choix de MATÉRIAU) — jamais un mesh par face ;
 *  - DÉLÉGATION : aucune couleur, aucune vue, aucun seuil n'est décidé ici — `faceColor`, `tintFor`,
 *    `facesGeometry` (biais coplanaire compris), `propSvg`, `resolveRender`/`resolveRig` font foi.
 *
 * Node-safe (three est du JS pur) : aucun DOM, aucun renderer. La rasterisation vit dans `svgTexture.ts`.
 */
import * as THREE from 'three';
import { buildFloors } from '../../builders/floors';
import { buildWalls } from '../../builders/walls';
import { buildRoofs } from '../../builders/roofs';
import { buildProps } from '../../builders/props';
import type { Face, SceneEl } from '../../builders/types';
import { facesGeometry, polyNormal } from './worldTris';
import { faceColor } from './faceColors';
import { BB_W, BB_H } from '../../pov/billboardCore';
import { PROP_BOX_ASPECT, type BillboardKind } from './billboardMath';
import { DEFS } from '../../sprites';
import { propSvg } from '../../catalog/decor';
import { AMBIANCE } from '../../catalog/ambiance';
import { bonesToSvg } from '../../rig/renderBones';
import { resolveRig } from '../../rig/composeRig';
import { entityRigProfileFor } from '../../rig/enemyProfile';
import { resolveRender, planById } from '../../rig/bodyPlan';
import { sizeTokenScale } from '../../sizeScale';
import { entitySize } from '../../../state/spawn';
import { sizeFootprint } from '../../../state/footprint';
import { findCreatureById } from '../../../data';
import type { View } from '../../rig/facing';
import type { Rot } from '../../../geometry/iso';
import type { Dir8 } from '../../../state/dir8';
import { heightAt, type Scene, type SceneEntity } from '../../../state/scene';
import { memoByRefDeps } from '../../../state/sceneMemo';

/** Teinte de visibilité d'une case `"x,y,z"` (1 = pleine) — fournie par l'appelant (`visibilityTint`). */
export type TintAt = (cellKey: string) => number;

/** Éléments à FACES de la scène, dans l'ordre de peinture des builders (toutes couches pleines, comme
 *  la planche QC `env-panels.ts` : le spike juge l'ENVIRONNEMENT, pas le brouillard de l'étage actif). */
function faceEls(scene: Scene): SceneEl[] {
  const maxZ = Math.max(...scene.layers.map((l) => l.z));
  return [...buildFloors(scene, undefined, { activeZ: maxZ }), ...buildWalls(scene), ...buildRoofs(scene)];
}

/** Géométrie MONDE fusionnée de la scène : une `BufferGeometry` non indexée (chaque triangle a ses
 *  propres sommets → `computeVertexNormals` donne la normale de FACE, l'ombrage plat du mode éclairé),
 *  couleur de face × teinte de visibilité cuite dans l'attribut `color`. */
/** Faces MONDE de la scène dans l'ordre de peinture des builders, chacune avec la clé de case qui porte
 *  sa teinte de visibilité — la liste EXACTE que `buildWorldGeometry` fusionne (les gardes s'y adossent
 *  au lieu de la reconstituer). */
export function worldFaces(scene: Scene): { face: Face; cellKey: string }[] {
  const out: { face: Face; cellKey: string }[] = [];
  for (const el of faceEls(scene)) {
    if (!('faces' in el)) continue;
    const cellKey = `${el.cell.x},${el.cell.y},${el.cell.z}`;
    for (const face of el.faces) out.push({ face, cellKey });
  }
  return out;
}

export function buildWorldGeometry(scene: Scene, mpt: number, tintAt: TintAt): THREE.BufferGeometry {
  const listées = worldFaces(scene);
  const faces = listées.map((f) => f.face);
  const tints = listées.map((f) => tintAt(f.cellKey));
  // Le RANG coplanaire se calcule sur la liste ENTIÈRE de la scène (contrat de `coplanarRanks`).
  const geoms = facesGeometry(faces, mpt);
  const positions: number[] = [];
  const colors: number[] = [];
  const c = new THREE.Color();
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
  geoms.forEach((g, i) => {
    c.set(faceColor(faces[i])).multiplyScalar(tints[i]);
    for (const tri of g.tris) {
      const n = polyNormal(tri);
      const centre = { x: (tri[0].x + tri[1].x + tri[2].x) / 3, z: (tri[0].z + tri[1].z + tri[2].z) / 3 };
      const dehors = n ? n.x * (centre.x - cx) + n.z * (centre.z - cz) : 0;
      const versLExterieur = g.oriented || !n ? true : Math.abs(n.y) > 1e-6 ? n.y > 0 : dehors >= 0;
      const ordered = versLExterieur ? tri : ([tri[0], tri[2], tri[1]] as typeof tri);
      for (const p of ordered) {
        positions.push(p.x, p.y, p.z);
        colors.push(c.r, c.g, c.b);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
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

/** SVG d'un personnage : rig humanoïde (`resolveRig`) ou gabarit de créature (`planById`), même
 *  résolution par la DONNÉE que le jeu (`resolveRender`). `null` = aucune apparence résoluble. */
function personnageSvg(ent: SceneEntity): ((view: View, mirror: boolean) => string) | null {
  const r = resolveRender(ent.appearance?.species, findCreatureById(ent.ref ?? '')?.traits, ent.ref);
  if (r.kind === 'rig') {
    const prof = entityRigProfileFor(ent);
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

/** Sujets de billboard de la scène : personnages (`kind:'personnage'`) puis décor (`buildProps`). */
export function collectBillboards(scene: Scene, mpt: number, tintAt: TintAt): BillboardSubject[] {
  const out: BillboardSubject[] = [];
  const defs = `<defs>${DEFS}</defs>`;
  for (const ent of scene.entities) {
    if (ent.kind !== 'personnage') continue;
    const draw = personnageSvg(ent);
    if (!draw) continue;
    // Empreinte multi-cases : le corps se centre sur l'empreinte (même décalage que `stage/tokens.tsx`).
    const off = (sizeFootprint(entitySize(ent)) - 1) / 2;
    const gx = ent.pos.x + off;
    const gy = ent.pos.y + off;
    const z = ent.z ?? 0;
    out.push({
      identity: `perso:${ent.id}`,
      kind: 'personnage',
      anchor: new THREE.Vector3(gx * mpt, heightAt(scene, ent.pos.x, ent.pos.y, z), gy * mpt),
      facing: ent.facing ?? 'S',
      scaleK: sizeTokenScale(entitySize(ent)),
      tint: tintAt(`${ent.pos.x},${ent.pos.y},${z}`),
      box: { w: BB_W, h: BB_H },
      svg: (view, mirror) => defs + draw(view, mirror),
    });
  }
  for (const el of buildProps(scene)) {
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

/** Aspect (l/h) de la boîte locale d'un billboard — la même 120×150 pour un rig et pour un décor. */
export const BILLBOARD_BOX_ASPECT = PROP_BOX_ASPECT;

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
 *  Élévation/azimut fixes = provisoire — Phase 2 : `sunDirection(gameTime, northDeg)`, spec au
 *  commentaire #1176 du 2026-08-09. */
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
  const geoms = facesGeometry(faces, mpt);
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
