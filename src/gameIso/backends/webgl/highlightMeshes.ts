/**
 * BACKEND VOLUMIQUE des SURBRILLANCES de combat (#1176, P3-0c) — le pendant three d'`affineHighlights`
 * sur le MÊME builder pur (`builders/highlights`) : un élément sémantique devient un quad PLAT posé au
 * sol du monde. En volume, une case est un CARRÉ — le losange de la voie affine n'était que sa
 * projection.
 *
 * DEUX MOITIÉS, comme `groundAccents.ts` :
 *  - DÉRIVATION PURE (`highlightSlot`, `highlightTint`, `highlightMatrix`, `groupHighlights`) : aucun
 *    contexte GPU requis, testable en node nu ;
 *  - MONTAGE (`buildHighlightMesh`, `writeHighlightInstances`) : un `InstancedMesh` par SLOT, de
 *    CAPACITÉ fixe, dont le contenu se réécrit EN PLACE (`instanceMatrix.array` + `instanceColor`) —
 *    le patron du pool de flaques (`stage/stagePointLights.ts`) et du semis d'averse
 *    (`weatherParticles.writePrecipMatrices`). Une marque qui apparaît n'entraîne aucun démontage.
 *
 * SLOT et non KIND : l'opacité est une propriété de MATÉRIAU (elle ne voyage pas par instance), et
 * trois kinds en portent deux (`team` actif/passif, `zone` fumée/feu, `ring` foule/contour). Le slot est
 * donc le kind DIVISÉ par son opacité — la teinte, elle, reste par instance (`instanceColor`). Les
 * `ring` non-foule sont des CONTOURS : un cadre mince, jamais un quad plein.
 *
 * RANG DE SUPERPOSITION : ces quads sont COPLANAIRES entre eux (deux marques sur la même case, un
 * anneau sur une teinte d'équipe) et se z-fighteraient. Le rang est donc EXPLICITE et métrique, en
 * multiples de `SPECKLE_LIFT_M` (`groundAccents.ts`) — le décollement d'un accent au-dessus de sa
 * nappe. Pas `COPLANAR_BIAS_M` : ce biais-là départage des faces DANS la géométrie fusionnée
 * (`worldTris.ts`), et une marque n'y est pas.
 */
import * as THREE from 'three';
import type { HighlightEl } from '../../builders/highlights';
import { tileTint } from '../../teamColors';
import {
  RANGE_BAND_TINT,
  RING_ALLY_TINT,
  RING_CROWD_TINT,
  RING_TARGET_TINT,
  RUN_TINT,
  WALK_TINT,
  ZONE_FIRE_TINT,
  ZONE_SMOKE_TINT,
} from '../../highlightTints';
import { SPECKLE_LIFT_M } from './groundAccents';

/** Un lot de MONTAGE : kind du builder divisé par son opacité de matériau. */
export type HighlightSlot =
  | 'walk'
  | 'run'
  | 'rangeBand'
  | 'team'
  | 'teamActive'
  | 'zoneFire'
  | 'zoneSmoke'
  | 'ringCrowd'
  | 'ringContour';

/** Tous les slots, dans l'ordre de RANG croissant (cf. `SLOT_RANK`). */
export const HIGHLIGHT_SLOTS: readonly HighlightSlot[] = [
  'walk',
  'run',
  'team',
  'teamActive',
  'zoneFire',
  'zoneSmoke',
  'ringCrowd',
  'ringContour',
  'rangeBand',
];

/** Slot d'un élément du builder. */
export function highlightSlot(el: HighlightEl): HighlightSlot {
  switch (el.kind) {
    case 'walk':
      return 'walk';
    case 'run':
      return 'run';
    case 'rangeBand':
      return 'rangeBand';
    case 'team':
      return el.active ? 'teamActive' : 'team';
    case 'zone':
      return el.smoke ? 'zoneSmoke' : 'zoneFire';
    case 'ring':
      return el.tone === 'crowd' ? 'ringCrowd' : 'ringContour';
  }
}

/** Opacités de la voie affine (`backends/affineHighlights.tsx`), à l'identique. */
export const SLOT_OPACITY: Record<HighlightSlot, number> = {
  walk: 0.32,
  run: 0.24,
  rangeBand: 0.26,
  team: 0.2,
  teamActive: 0.3,
  zoneFire: 0.35,
  zoneSmoke: 0.5,
  ringCrowd: 0.34,
  ringContour: 0.9,
};

/** Rang de SUPERPOSITION entre marques coplanaires. Il REPRODUIT l'ordre d'ÉMISSION du builder
 *  (`builders/highlights.buildHighlights`) : la voie affine trie ses objets par profondeur de façon
 *  STABLE (`stage/objs.sortByDepth`), donc à profondeur égale c'est l'ordre d'émission qui décide —
 *  le dernier émis passe au-dessus. Rang croissant = plus haut, à l'identique.
 *  Chaque slot a son rang PROPRE : deux marques d'un même kind peuvent couvrir la même case (une
 *  zone de fumée et une zone de feu qui se chevauchent), et un rang partagé les z-fighterait. */
export const SLOT_RANK: Record<HighlightSlot, number> = {
  walk: 0,
  run: 1,
  team: 2,
  teamActive: 3,
  zoneFire: 4,
  zoneSmoke: 5,
  ringCrowd: 6,
  ringContour: 7,
  rangeBand: 8,
};

/** Décollement (m) d'un slot au-dessus de la surface qui le porte. */
export function slotLiftM(slot: HighlightSlot): number {
  return (SLOT_RANK[slot] + 1) * SPECKLE_LIFT_M;
}

/** Teinte d'un élément — le MÊME catalogue que la voie affine, `team` par l'identité d'équipe. */
export function highlightTint(el: HighlightEl): string {
  switch (el.kind) {
    case 'walk':
      return WALK_TINT;
    case 'run':
      return RUN_TINT;
    case 'rangeBand':
      return RANGE_BAND_TINT[el.tone];
    case 'team':
      return tileTint(el.hero, el.active);
    case 'zone':
      return el.smoke ? ZONE_SMOKE_TINT : ZONE_FIRE_TINT;
    case 'ring':
      return el.tone === 'crowd' ? RING_CROWD_TINT : el.tone === 'ally' ? RING_ALLY_TINT : RING_TARGET_TINT;
  }
}

/** Épaisseur du cadre d'un anneau-contour, en fraction de case. */
export const RING_FRAME_K = 0.09;

/** Matrice d'INSTANCE : le carré UNITÉ posé au centre de sa case, à la hauteur métrique de sa surface
 *  plus le décollement de son slot. `(x, y, h) → (x·mpt, h, y·mpt)`, la conversion du monde
 *  (`worldTris.gpToWorld`). */
export function highlightMatrix(el: HighlightEl, mpt: number, m = new THREE.Matrix4()): THREE.Matrix4 {
  return m.compose(
    new THREE.Vector3(el.cell.x * mpt, el.h + slotLiftM(highlightSlot(el)), el.cell.y * mpt),
    new THREE.Quaternion(),
    new THREE.Vector3(mpt, 1, mpt),
  );
}

/** Les éléments par slot — la maille d'un `InstancedMesh`. */
export function groupHighlights(els: readonly HighlightEl[]): Map<HighlightSlot, HighlightEl[]> {
  const out = new Map<HighlightSlot, HighlightEl[]>();
  for (const el of els) {
    const k = highlightSlot(el);
    const lot = out.get(k);
    if (lot) lot.push(el);
    else out.set(k, [el]);
  }
  return out;
}

/** Capacité d'un pool pour `n` marques : puissance de deux, plancher 32 — un pool ne se redimensionne
 *  donc qu'aux paliers, jamais à la marque près. `0` = aucun pool (rien à peindre de ce slot). */
export function slotCapacity(n: number): number {
  if (n <= 0) return 0;
  return Math.max(32, 2 ** Math.ceil(Math.log2(n)));
}

/** Gabarit UNITÉ d'une case PLEINE : un carré horizontal de côté 1 centré sur l'origine (plan XZ). */
export function tileQuadGeometry(): THREE.BufferGeometry {
  const h = 0.5;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, -h, h, 0, h, -h, 0, h], 3),
  );
  geo.computeVertexNormals();
  return geo;
}

/** Gabarit UNITÉ d'un CONTOUR de case : quatre bandes horizontales formant un cadre de côté 1. `k` =
 *  épaisseur du cadre en fraction de case — un cadre PLUS FIN est le même gabarit, jamais une seconde
 *  géométrie écrite à la main (repère du groupe hors combat, `backends/webgl/dynamicMarkMeshes`). */
export function tileFrameGeometry(k = RING_FRAME_K): THREE.BufferGeometry {
  const o = 0.5;
  const i = o - k;
  const pos: number[] = [];
  const bande = (x0: number, x1: number, z0: number, z1: number) => {
    pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z0, x1, 0, z1, x0, 0, z1);
  };
  bande(-o, o, -o, -i);
  bande(-o, o, i, o);
  bande(-o, -i, -i, i);
  bande(i, o, -i, i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Pool d'un slot : géométrie du slot, matériau NON éclairé (une surbrillance est un repère de jeu, pas
 *  une surface du monde — elle ne doit ni s'assombrir la nuit ni recevoir d'ombre), à la CAPACITÉ
 *  demandée. `instanceColor` est alloué dès la construction : l'écriture qui suit ne fait que le
 *  remplir. */
export function buildHighlightMesh(slot: HighlightSlot, capacity: number): THREE.InstancedMesh {
  const geo = slot === 'ringContour' ? tileFrameGeometry() : tileQuadGeometry();
  const mat = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    opacity: SLOT_OPACITY[slot],
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.name = `marques:${slot}`;
  mesh.frustumCulled = false; // les marques couvrent la carte : la sphère du pool vaudrait la scène
  const blanc = new THREE.Color(1, 1, 1);
  for (let i = 0; i < capacity; i++) mesh.setColorAt(i, blanc);
  mesh.count = 0;
  return mesh;
}

/** Réécrit EN PLACE le contenu d'un pool : matrices, teintes, et le COMPTE d'instances dessinées. Rien
 *  n'est alloué, rien n'est démonté — c'est la passe que tout changement d'état de combat rejoue.
 *  Renvoie le compte écrit (borné par la capacité du pool). */
export function writeHighlightInstances(
  mesh: THREE.InstancedMesh,
  els: readonly HighlightEl[],
  mpt: number,
): number {
  const n = Math.min(els.length, mesh.instanceMatrix.count);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    mesh.setMatrixAt(i, highlightMatrix(els[i], mpt, m));
    mesh.setColorAt(i, c.set(highlightTint(els[i])));
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return n;
}
