import { Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, type Intersection, type Raycaster } from 'three';
import { describe, expect, it } from 'vitest';
import { pickNearestCid, type PickTarget } from './spriteRaycast';

/**
 * CE QUE LE SURVOL COÛTE (#1176, P2-4). Le hit-test de sprite tourne à CHAQUE `pointermove` en combat
 * (`stage/useStagePointer.pickTile`), et sa cible la plus lourde est de très loin la masse triangulée
 * de la carte. Or le cas MAJORITAIRE du survol est « aucun jeton sous ce pixel » : la question ne doit
 * alors même pas descendre dans le monde. Deux passes — les quads d'abord, le monde seulement pour
 * trancher l'occultation d'un jeton gagnant, borné à SA distance.
 *
 * Le compteur porte sur le `raycast` de l'objet monde LUI-MÊME (le vrai, celui de three, simplement
 * enveloppé) : ce qui est mesuré ici est bien le balayage, pas un drapeau d'intention.
 */
const CAMERA = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
CAMERA.updateMatrixWorld(true);

/** Quad de 2×2 m centré sur l'axe de la caméra, à 5 m — touché au centre de l'écran, manqué au bord. */
function quad(z: number): Mesh {
  const m = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial());
  m.position.set(0, 0, z);
  m.updateMatrixWorld(true);
  return m;
}

/** Masse du monde : une grande nappe, dont on COMPTE les interrogations sans changer son verdict. */
function monde(z: number): { cible: PickTarget; balayages: () => number } {
  const m = new Mesh(new PlaneGeometry(40, 40), new MeshBasicMaterial());
  m.position.set(0, 0, z);
  m.updateMatrixWorld(true);
  let n = 0;
  const vrai = m.raycast.bind(m);
  m.raycast = (r: Raycaster, i: Intersection[]) => { n += 1; vrai(r, i); };
  return { cible: { cid: null, object: m }, balayages: () => n };
}

const CENTRE = { x: 0, y: 0 }; // pixel sur le quad
const BORD = { x: 0.9, y: 0.9 }; // pixel hors du quad (le quad ne fait que 2 m dans un cadre de 20 m)

describe('pickNearestCid — le monde n’est balayé que pour trancher une occultation (#1176 P2-4)', () => {
  it('aucun JETON sous le pixel : verdict `null` immédiat, la carte n’est pas balayée du tout', () => {
    const m = monde(-9);
    const cibles: PickTarget[] = [m.cible, { cid: 'h1', object: quad(-5) }];
    expect(pickNearestCid(CAMERA, cibles, BORD)).toBeNull();
    expect(m.balayages()).toBe(0);
  });

  it('un jeton gagne : le monde est interrogé UNE fois, et derrière le jeton il ne change rien', () => {
    const m = monde(-9);
    const cibles: PickTarget[] = [m.cible, { cid: 'h1', object: quad(-5) }];
    expect(pickNearestCid(CAMERA, cibles, CENTRE)).toBe('h1');
    expect(m.balayages()).toBe(1);
  });

  it('…et le monde DEVANT le jeton l’emporte toujours : le clic retombe sur la tuile', () => {
    const m = monde(-3);
    const cibles: PickTarget[] = [m.cible, { cid: 'h1', object: quad(-5) }];
    expect(pickNearestCid(CAMERA, cibles, CENTRE)).toBeNull();
    expect(m.balayages()).toBe(1);
  });
});
