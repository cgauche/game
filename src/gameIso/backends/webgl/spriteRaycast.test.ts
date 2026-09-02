import { Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, type Intersection, type Raycaster } from 'three';
import { describe, expect, it } from 'vitest';
import { pickNearestTarget, type PickTarget } from './spriteRaycast';

/**
 * QUI GAGNE UN PIXEL DISPUTÉ (#1176 P2-4, #1297 lot B + correctif du juge du cumul).
 *
 * Le hit-test de sprite tourne à CHAQUE `pointermove` en combat (`stage/useStagePointer.pickTile`), et
 * ses cibles sont les seuls QUADS : la masse triangulée de la carte, de très loin la plus lourde, n'y
 * est plus inscrite (`stage/GameStage3D`) — un jeton qu'elle occulte se lit en SILHOUETTE, donc se
 * clique. Restent deux natures de quad : le JETON, qui porte un id, et le DÉCOR, qui n'en porte pas et
 * dont c'est justement l'emploi d'OCCULTER — touché le premier, il rend le verdict `null` et le clic
 * retombe sur la tuile (« ce qui se voit se clique »).
 */
const CAMERA = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
CAMERA.updateMatrixWorld(true);

/** Quad de 2×2 m centré sur l'axe de la caméra, à `z` — touché au centre de l'écran, manqué au bord. */
function quad(z: number): Mesh {
  const m = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial());
  m.position.set(0, 0, z);
  m.updateMatrixWorld(true);
  return m;
}

/** Quad de DÉCOR (sans id), dont on COMPTE les interrogations : c'est le `raycast` de three qui est
 *  enveloppé, donc ce qui est mesuré est bien le balayage, pas un drapeau d'intention. */
function decor(z: number): { cible: PickTarget; balayages: () => number } {
  const m = quad(z);
  let n = 0;
  const vrai = m.raycast.bind(m);
  m.raycast = (r: Raycaster, i: Intersection[]) => { n += 1; vrai(r, i); };
  return { cible: { cid: null, object: m }, balayages: () => n };
}

/** Le verdict sur les seuls BILLBOARDS (aucun maillage monde) ramené à un id de combattant. */
const cidLePlusProche = (camera: OrthographicCamera, cibles: readonly PickTarget[], ndc: { x: number; y: number }): string | null => {
  const visé = pickNearestTarget(camera, cibles, null, ndc);
  return visé?.kind === 'combatant' ? visé.id : null;
};

const CENTRE = { x: 0, y: 0 }; // pixel sur le quad
const BORD = { x: 0.9, y: 0.9 }; // pixel hors du quad (le quad ne fait que 2 m dans un cadre de 20 m)

describe('pickNearestTarget (billboards seuls) — le plus PROCHE tranche, et un DÉCOR rend `null` (#1297)', () => {
  it('aucun quad sous le pixel : verdict `null` — et le décor a bien été interrogé', () => {
    const d = decor(-9);
    expect(cidLePlusProche(CAMERA, [d.cible, { cid: 'h1', object: quad(-5) }], BORD)).toBeNull();
    expect(d.balayages()).toBe(1);
  });

  it('décor DERRIÈRE le jeton : il ne dispute rien — l’id est rendu', () => {
    const d = decor(-9);
    expect(cidLePlusProche(CAMERA, [d.cible, { cid: 'h1', object: quad(-5) }], CENTRE)).toBe('h1');
  });

  it('décor DEVANT le jeton : ce qui cache un corps le rend inatteignable — verdict `null`', () => {
    const d = decor(-3);
    expect(cidLePlusProche(CAMERA, [d.cible, { cid: 'h1', object: quad(-5) }], CENTRE)).toBeNull();
    expect(cidLePlusProche(CAMERA, [{ cid: 'h1', object: quad(-5) }, d.cible], CENTRE)).toBeNull();
  });

  it('deux JETONS alignés : le plus PROCHE gagne, et un décor DERRIÈRE les deux n’y change rien', () => {
    const proche: PickTarget = { cid: 'proche', object: quad(-4) };
    const loin: PickTarget = { cid: 'loin', object: quad(-8) };
    expect(cidLePlusProche(CAMERA, [loin, proche], CENTRE)).toBe('proche');
    expect(cidLePlusProche(CAMERA, [decor(-9).cible, loin, proche], CENTRE)).toBe('proche');
    // …et un décor DEVANT les deux les couvre tous les deux.
    expect(cidLePlusProche(CAMERA, [decor(-1).cible, loin, proche], CENTRE)).toBeNull();
  });

  it('PIONS EN DISQUES (#1176 P3-5c) : sans un seul quad de personnage, le verdict est `null` — le clic RETOMBE sur la case', () => {
    // Sous le verdict `pionsEnDisques` (vue du dessus), le monde ne monte AUCUN sujet `personnage`
    // (`stage/GameStage3D`) : les seules cibles restantes sont du DÉCOR, qui ne rend jamais d'id. Le
    // picking de sprite se tait donc PAR CONSTRUCTION, et `useStagePointer.pickTile` résout par
    // le repli de surface de `stage/pickResolve.ts:resoudrePixel` — juste, puisque le disque est
    // centré sur SA case.
    const cibles = [decor(-9).cible, decor(-3).cible];
    expect(cidLePlusProche(CAMERA, cibles, CENTRE)).toBeNull();
    expect(cidLePlusProche(CAMERA, cibles, BORD)).toBeNull();
    expect(cidLePlusProche(CAMERA, [], CENTRE)).toBeNull();
    // TÉMOIN : la même caméra, le même pixel, avec un quad de personnage — l'absence d'id vient bien
    // de la population, pas d'un rayon qui ne touche rien.
    expect(cidLePlusProche(CAMERA, [{ cid: 'h1', object: quad(-5) }], CENTRE)).toBe('h1');
  });
});
