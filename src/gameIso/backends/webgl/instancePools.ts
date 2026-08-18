/**
 * POOLS D'INSTANCES du monde volumique — la couture par laquelle un pool annonce COMBIEN d'instances
 * il dessine. Module FEUILLE : il ne connaît que `three`.
 */
import type * as THREE from 'three';

/**
 * Écrit le COMPTE dessiné d'un pool, et le RETIRE du rendu quand il est vide.
 *
 * Un `InstancedMesh` à `count = 0` traverse quand même `WebGLRenderer.renderObject` : il y résout son
 * programme (`getParameters` + `getProgramCacheKey`), et le fait à CHAQUE rendu, pour ne peindre aucun
 * pixel. `visible = false` le sort de la liste de rendu en amont. Aucune conséquence sur le picking :
 * `InstancedMesh.raycast` n'itère que jusqu'à `count`, donc un pool vide n'était déjà touchable par
 * aucun rayon.
 */
export function poserCompteInstances(mesh: THREE.InstancedMesh, n: number): void {
  mesh.count = n;
  mesh.visible = n > 0;
}
