/**
 * MATÉRIAUX du monde CUIT — un matériau par GROUPE DE SURFACE (`geometry.userData.surfaceGroups`,
 * index = `materialIndex` des `geometry.groups`). La géométrie reste FUSIONNÉE, seul le dessin se
 * scinde : le groupe nu garde la couleur cuite au sommet, les autres reçoivent le masque de période
 * de leur surface (UV en MÈTRES, d'où une répétition inverse de la période métrique du groupe) ou
 * leur CUISSON PAR FACE (colombage), échantillonnée sur l'UV de face (`uv1`).
 *
 * Régime LAMBERTIEN par défaut — celui du jeu : l'ambiante porte la scène quand aucun soleil ne
 * l'éclaire, et rien ne bascule au crépuscule. `lit: false` rend le régime PLAT (`MeshBasicMaterial`,
 * aucune lampe consultée) : le seul axe sur lequel les planches du spike divergent du jeu.
 */
import * as THREE from 'three';
import { getFaceBake } from './faceBake';
import { getPeriodTexture } from './periodTexture';
import type { WorldGeometry } from './sceneMeshes';

/** Matériau d'un groupe de surface : les deux régimes partagent `map`, `color` et les couleurs de
 *  sommet — tout ce que cette passe écrit. */
export type WorldSurfaceMaterial = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;

/** Les matériaux du monde cuit, dans l'ordre des groupes de surface. `anisotropy` vient du renderer
 *  qui les dessinera (`capabilities.getMaxAnisotropy`). L'appelant en est PROPRIÉTAIRE : il les
 *  libère avec le maillage qui les porte. */
export function worldSurfaceMaterials(geometry: WorldGeometry, anisotropy: number, opts: { lit?: boolean } = {}): WorldSurfaceMaterial[] {
  const lit = opts.lit ?? true;
  return geometry.userData.surfaceGroups.map((g) => {
    const mat: WorldSurfaceMaterial = lit
      ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true })
      : new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
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
}
