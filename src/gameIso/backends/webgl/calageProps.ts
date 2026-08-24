/**
 * MODE CALAGE du calque de référence (ÉDITEUR seulement) — quand l'auteur compare sa planche
 * décalquée (#830) au mobilier volumique qu'il a posé, le décor se rend en APLAT UNI d'une teinte
 * absente des planches (cyan) avec ses ARÊTES appuyées : ce qui appartient au plan dessiné et ce qui
 * appartient à la scène construite se séparent à l'œil — du marron de mobilier sur un gris de plan
 * ne se distingue pas.
 *
 * PÉRIMÈTRE : le DÉCOR VOLUMIQUE seul (`SurfaceGroup.prop`) — ni sol, ni murs, ni toits, ni jetons.
 * La géométrie du monde n'est JAMAIS recuite : le monde reste fusionné, seuls les matériaux des
 * groupes de décor sont SURCHARGÉS le temps du mode (`materiauxDeCalage`), et les arêtes sont un
 * maillage de lignes à part, bâti des seuls triangles de ces groupes (`aretesDeCalage`).
 */
import * as THREE from 'three';
import type { WorldGeometry } from './sceneMeshes';
import type { WorldSurfaceMaterial } from './worldMaterials';

/** Aplat du mode : un cyan saturé, absent des planches sépia comme de la matière du monde (pierre,
 *  bois, terre). Littéral parce que `THREE.Color` ne résout pas une var CSS et que l'environnement de
 *  test n'a pas de feuille de style (même raison que les façades de `teintesJeu.json`). */
export const CALAGE_APLAT = '#0097a7';
/** Arêtes du mode : le même cyan porté au clair — il tranche sur l'aplat qu'il cerne comme sur le
 *  trait sépia de la planche. */
export const CALAGE_ARETES = '#5ffbff';
/** Opacité de l'aplat : assez couvrant pour lire le volume, assez transparent pour que le dessin de
 *  la planche reste lisible dessous. */
export const CALAGE_OPACITE = 0.45;
/** Seuil d'arête (degrés) : deux triangles coplanaires (la diagonale d'un quad) ne font pas une
 *  arête — seuls les plis du volume se tracent. */
const SEUIL_ARETE_DEG = 1;

/** Nom du maillage d'arêtes dans la scène three — la seule prise pour le retrouver. */
export const NOM_ARETES_CALAGE = 'calage-aretes';

/** Le mode est-il actif ? Il ne vaut QUE calque VISIBLE : un contraste réglé sur un calque masqué
 *  n'a rien à contraster. */
export function calageActif(rec: { visible: boolean; contraste: boolean } | null | undefined): boolean {
  return !!rec && rec.visible && rec.contraste;
}

/** Rangs des groupes de surface qui portent du décor volumique (= `materialIndex` de leurs `groups`). */
export function rangsDeDecor(geometry: WorldGeometry): number[] {
  const rangs: number[] = [];
  geometry.userData.surfaceGroups.forEach((g, rang) => {
    if (g.prop) rangs.push(rang);
  });
  return rangs;
}

/** Matériau de l'aplat. Un VOLUME, donc SANS `DoubleSide` : ses faces arrière n'ont pas à repeindre
 *  l'aplat par-dessus les faces avant (`materiauPlanTransparent` ne sert que les PLANS). */
export function materiauCalage(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: CALAGE_APLAT,
    transparent: true,
    opacity: CALAGE_OPACITE,
    depthWrite: false,
    fog: false,
  });
}

/**
 * Le tableau de matériaux à donner au maillage du monde pour le mode : le matériau de calage aux
 * rangs de décor, les matériaux d'ORIGINE partout ailleurs (aucun n'est refait, aucun n'est libéré —
 * ils reprennent leur place à la sortie du mode). `null` = cette scène ne porte aucun décor
 * volumique : rien à surcharger, l'appelant ne touche pas au maillage.
 */
export function materiauxDeCalage(
  origines: readonly WorldSurfaceMaterial[],
  geometry: WorldGeometry,
  calage: WorldSurfaceMaterial,
): WorldSurfaceMaterial[] | null {
  const rangs = new Set(rangsDeDecor(geometry));
  if (rangs.size === 0) return null;
  return origines.map((mat, rang) => (rangs.has(rang) ? calage : mat));
}

/**
 * Les ARÊTES du décor volumique, en maillage de lignes à part : les triangles RÉELLEMENT DESSINÉS
 * des groupes de décor (l'index compacté par le dégagement fait foi), passés à `EdgesGeometry`.
 * `null` si la scène n'en dessine aucun. La géométrie du monde n'est ni copiée ni touchée : seules
 * les positions des sommets concernés sont relues.
 */
export function aretesDeCalage(geometry: WorldGeometry): THREE.LineSegments | null {
  const rangs = new Set(rangsDeDecor(geometry));
  if (rangs.size === 0) return null;
  const index = geometry.getIndex();
  const positions = geometry.getAttribute('position');
  if (!index || !positions) return null;
  const sommets: number[] = [];
  for (const g of geometry.groups) {
    if (!rangs.has(g.materialIndex ?? 0)) continue;
    for (let i = g.start; i < g.start + g.count; i++) {
      const v = index.getX(i);
      sommets.push(positions.getX(v), positions.getY(v), positions.getZ(v));
    }
  }
  if (sommets.length === 0) return null;
  const decor = new THREE.BufferGeometry();
  decor.setAttribute('position', new THREE.Float32BufferAttribute(sommets, 3));
  const aretes = new THREE.EdgesGeometry(decor, SEUIL_ARETE_DEG);
  decor.dispose();
  const lignes = new THREE.LineSegments(
    aretes,
    new THREE.LineBasicMaterial({ color: CALAGE_ARETES, transparent: true, opacity: 0.95, depthWrite: false, fog: false }),
  );
  lignes.name = NOM_ARETES_CALAGE;
  return lignes;
}
