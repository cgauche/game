/**
 * LANCER DE RAYON de picking du monde volumique (#1176, lot P2-3) — la réponse de la voie WebGL au
 * hit-test de sprite (`stage/spritePicker.ts`). Un canevas n'a pas d'arbre à interroger : le pixel
 * redevient un RAYON, et c'est la DISTANCE CAMÉRA qui tranche l'empilement — là où le peintre affine
 * tranchait par son tri de profondeur (`stage/objs.ts`).
 *
 * CIBLES : les QUADS de billboard, et eux seuls — ceux d'un combattant portent son id, ceux du DÉCOR
 * n'en portent aucun (`cid: null`). La masse triangulée du monde n'est PAS une cible.
 *
 * LA RÈGLE (#1297) : « ce qui se voit se clique ». Le plus PROCHE touché tranche, et un DÉCOR qui gagne
 * rend `null` — le clic retombe sur la tuile, comme un sprite qui cache un corps le rend inatteignable.
 * Seule l'occultation par la géométrie CUITE du monde tombe : la silhouette d'un jeton occulté par la
 * matière s'y peint à travers (`dynamicMarkMeshes.buildSilhouetteTwin`), donc le pixel où on la lit rend
 * son id.
 *
 * DEUX CHOIX ASSUMÉS (#1297) : AUCUNE BORNE DE DISTANCE — un jeton occulté par le monde reste cliquable
 * à toute profondeur, comme le jumeau de silhouette qui le révèle sans borne. ASYMÉTRIE TRANSITOIRE
 * vu/cliquable — ce qui se voit d'un jeton occulté est son ANNEAU, soit environ 10 % de la surface de
 * réponse que sa boîte offre au clic ; l'écart se résorbe au LOT C, quand le corps sera silhouetté.
 *
 * DIVERGENCE MESURÉE AVEC L'AFFINE (`stage/sprite-pick-parity.test.ts`) : le peintre affine n'a pas de
 * silhouette — un mur peint APRÈS le jeton reçoit l'`elementFromPoint`, ne porte aucun `data-cid`, et le
 * clic y retombe sur la tuile de sol. Sur les mêmes situations la voie volumique rend l'id du jeton.
 *
 * SECONDE DIVERGENCE : un quad est plein pour le rayon alors que l'`alphaTest` du matériau le rend
 * transparent à l'affichage. Le hit-test natif du SVG suit le TRACÉ (on clique à travers le vide d'un
 * sprite) ; le rayon suit la BOÎTE, coins compris. Lever cet écart demande de lire l'alpha de la
 * texture à l'UV touché (rasterisation en cache, hors de ce lot).
 */
import * as THREE from 'three';

/** Une cible du rayon : l'objet à toucher, et l'id du combattant qu'il dessine — `cid: null` = sprite
 *  de DÉCOR, qui ne rend jamais d'id mais OCCULTE le clic quand il gagne le rayon (§ en-tête). */
export interface PickTarget {
  cid: string | null;
  object: THREE.Object3D;
}

/** Point NDC (repère [-1,1], y vers le haut) d'un pixel relatif au coin haut-gauche du canevas. */
export function ndcAt(px: { x: number; y: number }, canvas: { w: number; h: number }): { x: number; y: number } {
  return { x: (px.x / canvas.w) * 2 - 1, y: -(px.y / canvas.h) * 2 + 1 };
}

const rayon = new THREE.Raycaster();

/** DÉPARTAGE à égalité EXACTE de distance entre deux JETONS (deux quads coplanaires au même point,
 *  deux combattants sur la même case) : l'ordre lexicographique des ids — arbitraire, mais STABLE.
 *  C'est ce qui rend le verdict indépendant de l'ordre du tableau de cibles. */
function emporteAEgalite(candidat: string, tenant: string): boolean {
  return candidat < tenant;
}

/**
 * Id du combattant sous le rayon : la cible la plus PROCHE de la caméra tranche — son id si c'est un
 * JETON, `null` si c'est un DÉCOR (§ en-tête : ce qui se voit se clique). À distance ÉGALE, deux jetons
 * se départagent par `emporteAEgalite`, et un jeton l'emporte sur un décor coplanaire. L'ordre du
 * tableau de cibles n'entre JAMAIS dans le verdict.
 *
 * UNE PASSE sur les seuls QUADS (deux triangles chacun) : la masse triangulée de la carte n'est pas
 * une cible, donc jamais balayée au `pointermove`.
 */
export function pickNearestCid(
  camera: THREE.Camera,
  targets: readonly PickTarget[],
  ndc: { x: number; y: number },
): string | null {
  rayon.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  let gagnant: string | null = null;
  let plusProche = Infinity;
  for (const cible of targets) {
    for (const touche of rayon.intersectObject(cible.object, true)) {
      if (touche.distance > plusProche) continue;
      if (touche.distance === plusProche) {
        // Égalité EXACTE : un décor ne prend jamais la place du tenant (un jeton coplanaire d'un
        // décor reste cliquable), et entre deux jetons c'est l'id lexicographique qui tranche.
        if (cible.cid === null) continue;
        if (gagnant !== null && !emporteAEgalite(cible.cid, gagnant)) continue;
      }
      plusProche = touche.distance;
      gagnant = cible.cid;
    }
  }
  return gagnant;
}
