/**
 * LANCER DE RAYON de picking du monde volumique (#1176, lot P2-3) — la réponse de la voie WebGL au
 * hit-test de sprite (`stage/spritePicker.ts`). Un canevas n'a pas d'arbre à interroger : le pixel
 * redevient un RAYON, et c'est la DISTANCE CAMÉRA qui tranche l'empilement — là où le peintre affine
 * tranchait par son tri de profondeur (`stage/objs.ts`).
 *
 * CIBLES : les quads de billboard (chacun portant l'id du combattant qu'il dessine) ET les masses du
 * monde, inscrites SANS id. Une masse qui gagne le rayon vaut « rien de cliquable ici » — c'est la
 * parité avec l'affine, où un mur peint APRÈS le jeton reçoit le `elementFromPoint` et ne porte aucun
 * `data-cid` (le clic retombe alors sur la tuile de sol).
 *
 * ÉCART MESURÉ AVEC L'AFFINE (`stage/sprite-pick-parity.test.ts`) : un quad est plein pour le rayon alors que
 * l'`alphaTest` du matériau le rend transparent à l'affichage. Le hit-test natif du SVG suit le TRACÉ
 * (on clique à travers le vide d'un sprite) ; le rayon suit la BOÎTE, coins compris. Lever cet écart
 * demande de lire l'alpha de la texture à l'UV touché (rasterisation en cache, hors de ce lot).
 */
import * as THREE from 'three';

/** Une cible du rayon : l'objet à toucher, et l'id du combattant qu'il dessine (`null` = occulteur). */
export interface PickTarget {
  cid: string | null;
  object: THREE.Object3D;
}

/** Point NDC (repère [-1,1], y vers le haut) d'un pixel relatif au coin haut-gauche du canevas. */
export function ndcAt(px: { x: number; y: number }, canvas: { w: number; h: number }): { x: number; y: number } {
  return { x: (px.x / canvas.w) * 2 - 1, y: -(px.y / canvas.h) * 2 + 1 };
}

const rayon = new THREE.Raycaster();

/** DÉPARTAGE à égalité EXACTE de distance (deux quads coplanaires au même point, un jeton pile dans le
 *  plan d'une masse) : `true` si `candidat` l'emporte sur `tenant`. Relation d'ORDRE TOTAL sur les
 *  cibles, ne lisant que leur `cid` — c'est ce qui rend le verdict indépendant de l'ordre du tableau.
 *  Deux échelons : le MONDE d'abord (un occulteur `cid:null` gagne son égalité, le clic retombe alors
 *  sur la tuile — même issue qu'en affine, où le mur peint par-dessus ne porte pas de `data-cid`),
 *  puis, entre deux jetons, l'ordre lexicographique des ids — arbitraire, mais STABLE. */
function emporteAEgalite(candidat: PickTarget, tenant: PickTarget): boolean {
  if (candidat.cid === null) return tenant.cid !== null;
  if (tenant.cid === null) return false;
  return candidat.cid < tenant.cid;
}

/** Id du combattant sous le rayon : la cible la PLUS PROCHE de la caméra gagne, et à distance égale
 *  `emporteAEgalite` tranche. `null` si c'est un occulteur (masse du monde, décor) ou si rien n'est
 *  touché — dans les deux cas, il n'y a pas de jeton sous ce pixel. L'ordre du tableau de cibles
 *  n'entre JAMAIS dans le verdict. */
export function pickNearestCid(
  camera: THREE.Camera,
  targets: readonly PickTarget[],
  ndc: { x: number; y: number },
): string | null {
  rayon.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  let gagnant: PickTarget | null = null;
  let plusProche = Infinity;
  for (const cible of targets) {
    for (const touche of rayon.intersectObject(cible.object, true)) {
      if (touche.distance > plusProche) continue;
      if (touche.distance === plusProche && !(gagnant && emporteAEgalite(cible, gagnant))) continue;
      plusProche = touche.distance;
      gagnant = cible;
    }
  }
  return gagnant?.cid ?? null;
}
