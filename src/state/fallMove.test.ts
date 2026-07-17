import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene } from './scene';
import { planFall } from './fallMove';

/**
 * `planFall` traduit une chute VOLONTAIRE (LDB 15 l.82) en plan jouable : depuis une case en bordure
 * d'un dénivelé `cliff` (`state/relief.ts`) SANS arête `WallSeg.climb` (déjà couverte par `climbAcross`/
 * Escalade), la case cardinale plus basse devient un saut disponible ; sa hauteur RÉELLE (mètres, relief)
 * alimente la modale `pendingFall` (résolution NUMÉRIQUE par DR, hors périmètre de ce module pur).
 */

// Scène 4×4 : falaise de 4 m entre le sommet (2,0) à 4 m et le pied (2,1) à 0 m — AUCUNE arête `climb`.
function cliffScene(): Scene {
  const s = emptyScene(4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4; // (2,0) sommet à 4 m
  s.layers[0].height = h;
  return s;
}

const top = { x: 2, y: 0 }; // sommet (4 m)
const foot = { x: 2, y: 1 }; // pied (0 m)

describe('planFall', () => {
  it('falaise descendante, sans arête climb → saut disponible, hauteur RÉELLE (4 m)', () => {
    expect(planFall(cliffScene(), top, foot)).toEqual({ kind: 'fall', metres: 4 });
  });

  it('sens ASCENDANT (pied → sommet) → aucun saut (le geste ne descend jamais)', () => {
    expect(planFall(cliffScene(), foot, top)).toEqual({ kind: 'none' });
  });

  it('arête grimpable (`climb`) → aucun plan (flux dédié `climbAcross`/Escalade)', () => {
    const s = cliffScene();
    s.walls = [{ x: 2, y: 1, side: 'N', climb: { kind: 'surface' } }];
    expect(planFall(s, top, foot)).toEqual({ kind: 'none' });
  });

  it('mur plein sur l’arête → aucun saut (bloqué comme un mur normal)', () => {
    const s = cliffScene();
    s.walls = [{ x: 2, y: 1, side: 'N' }]; // mur nu, sans porte ni structure → toujours fermé
    expect(planFall(s, top, foot)).toEqual({ kind: 'none' });
  });

  it('dénivelé ≤ seuil (rampe, marchable à pied) → aucun saut (pas une falaise)', () => {
    const s = emptyScene(4, 4);
    const w = 4;
    const h = new Array(w * 4).fill(0) as number[];
    h[0 * w + 2] = 1; // 1 m : ≤ STEP_MAX_M → `ramp`, pas `cliff`
    s.layers[0].height = h;
    expect(planFall(s, { x: 2, y: 0 }, { x: 2, y: 1 })).toEqual({ kind: 'none' });
  });

  it('cases non adjacentes (cardinal) → aucun saut', () => {
    expect(planFall(cliffScene(), top, { x: 3, y: 3 })).toEqual({ kind: 'none' });
  });

  it('case d’arrivée diagonale → aucun saut (cardinal seulement)', () => {
    const s = emptyScene(4, 4);
    const w = 4;
    const h = new Array(w * 4).fill(0) as number[];
    h[1 * w + 3] = 4; // (3,1) surélevé, diagonal de (2,0)
    s.layers[0].height = h;
    expect(planFall(s, { x: 2, y: 0 }, { x: 3, y: 1 })).toEqual({ kind: 'none' });
  });

  it('case d’arrivée non marchable (mur) → aucun saut', () => {
    const s = cliffScene();
    s.layers[0].tiles[1 * 4 + 2] = 'mur'; // (2,1) devient impraticable
    expect(planFall(s, top, foot)).toEqual({ kind: 'none' });
  });
});
