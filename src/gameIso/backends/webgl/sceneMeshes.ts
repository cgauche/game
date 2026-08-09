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
export function buildWorldGeometry(scene: Scene, mpt: number, tintAt: TintAt): THREE.BufferGeometry {
  const els = faceEls(scene);
  const faces: Face[] = [];
  const tints: number[] = [];
  for (const el of els) {
    if (!('faces' in el)) continue;
    const t = tintAt(`${el.cell.x},${el.cell.y},${el.cell.z}`);
    for (const f of el.faces) {
      faces.push(f);
      tints.push(t);
    }
  }
  // Le RANG coplanaire se calcule sur la liste ENTIÈRE de la scène (contrat de `coplanarRanks`).
  const geoms = facesGeometry(faces, mpt);
  const positions: number[] = [];
  const colors: number[] = [];
  const c = new THREE.Color();
  // ORIENTATION des triangles : le pivot n'a aucune convention de sens de parcours (une face peut être
  // authorée dans un sens ou dans l'autre). Un rendu en `DoubleSide` s'en moque, mais la CARTE D'OMBRE
  // non : le décalage de biais suit la normale, et une normale à l'envers pousse le receveur DANS son
  // ombre (mesuré : scène entière retombée à la seule ambiante). On oriente donc chaque triangle vers
  // le HAUT pour une face horizontale, vers l'EXTÉRIEUR de la carte pour une face verticale.
  const cx = ((scene.dimensions.w - 1) / 2) * mpt;
  const cz = ((scene.dimensions.h - 1) / 2) * mpt;
  geoms.forEach((g, i) => {
    c.set(faceColor(faces[i])).multiplyScalar(tints[i]);
    for (const tri of g.tris) {
      const n = polyNormal(tri);
      const centre = { x: (tri[0].x + tri[1].x + tri[2].x) / 3, z: (tri[0].z + tri[1].z + tri[2].z) / 3 };
      const dehors = n ? n.x * (centre.x - cx) + n.z * (centre.z - cz) : 0;
      const versLExterieur = !n ? true : Math.abs(n.y) > 1e-6 ? n.y > 0 : dehors >= 0;
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
