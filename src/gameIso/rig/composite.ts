/**
 * COMPOSITE — fusionne plusieurs corps riggés (ResolvedBone[]) en UN seul, trié par z au
 * niveau de l'OS (pas de l'entité). C'est ce qui donne la « profondeur » fine : deux corps
 * qui se chevauchent à l'écran (cavalier sur monture, portage, familier perché…) s'imbriquent
 * membre par membre — la jambe lointaine du cavalier passe DERRIÈRE le barillet, son buste
 * DERRIÈRE la tête de la monture, etc. — impossible avec un tri par entité (un bloc devant l'autre).
 *
 * PUR (aucun React). Chaque couche apporte ses os déjà résolus, une matrice de placement
 * optionnelle (repère commun) et une fonction z (où ses os s'insèrent dans l'échelle partagée).
 */
import { mul, type Matrix } from './kinematics';
import type { ResolvedBone } from './composeRig';

export interface CompositeLayer {
  /** Os résolus de ce corps (repère local du corps). */
  bones: ResolvedBone[];
  /** Transforme les os dans le repère COMMUN (défaut : identité = déjà dans le repère commun). */
  place?: Matrix;
  /** z de chaque os dans l'échelle de tri PARTAGÉE (peintre, croissant). */
  z: (b: ResolvedBone) => number;
}

/** Tri peintre INTRA-corps (os d'UN SEUL composeur non-bipède) — SOURCE UNIQUE, à réutiliser en fin
 *  de tout `compose*` non-bipède au lieu de recopier `.sort((a,b) => a.z - b.z)`. */
export function sortByZ(bones: ResolvedBone[]): ResolvedBone[] {
  return bones.sort((a, b) => a.z - b.z);
}

/** Concatène les os de toutes les couches (placés + ré-étiquetés en z), UN SEUL tri peintre. */
export function composeComposite(layers: CompositeLayer[]): ResolvedBone[] {
  const out: ResolvedBone[] = [];
  for (const L of layers)
    for (const b of L.bones)
      out.push({ ...b, matrix: L.place ? mul(L.place, b.matrix) : b.matrix, z: L.z(b) });
  out.sort((a, b) => a.z - b.z);
  return out;
}
