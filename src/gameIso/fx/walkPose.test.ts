import { describe, expect, it } from 'vitest';
import { depth, type Dims } from '../../geometry/iso';
import { STEP_MS } from '../../geometry/walk';
import { walkGlideM, walkPoseAt, type WalkTrack } from './walkPose';

/**
 * La COURBE de glissement est unique (#1176, P2-4) : la voie affine la lit au rendu React, la voie
 * volumique la lit dans sa boucle de rendu. Ces clauses tiennent la courbe elle-même (valeurs
 * attendues, pas une paraphrase de l'implémentation) et le fait que le décalage MONDE que consomme la
 * boucle n'est rien d'autre que cette même pose, exprimée en mètres.
 */
const DIMS: Dims = { w: 8, h: 8, rot: 0, view: 'iso', edge: false };

const T0 = 1000;
const DROITE: WalkTrack = { path: [{ x: 0, y: 2 }, { x: 2, y: 2 }], start: T0 };

describe('walkPoseAt — la courbe de glissement, partagée par les deux voies', () => {
  it('sans marche vivante : le sujet est à sa case et ne glisse pas', () => {
    const p = walkPoseAt(undefined, 3, 4, 0, DIMS, T0 + 40);
    expect(p).toEqual({ x: 3, y: 4, walking: false, sortPt: { x: 3, y: 4 } });
  });

  it('à mi-segment : position FRACTIONNAIRE linéaire entre les deux cases', () => {
    expect(walkPoseAt(DROITE, 2, 2, 0, DIMS, T0)).toMatchObject({ x: 0, y: 2, walking: true });
    expect(walkPoseAt(DROITE, 2, 2, 0, DIMS, T0 + STEP_MS / 4)).toMatchObject({ x: 0.5, y: 2 });
    expect(walkPoseAt(DROITE, 2, 2, 0, DIMS, T0 + STEP_MS / 2)).toMatchObject({ x: 1, y: 2 });
    expect(walkPoseAt(DROITE, 2, 2, 0, DIMS, T0 + (STEP_MS * 3) / 4)).toMatchObject({ x: 1.5, y: 2 });
  });

  it('au terme de la durée : la dernière case du chemin, jamais au-delà', () => {
    expect(walkPoseAt(DROITE, 2, 2, 0, DIMS, T0 + STEP_MS)).toMatchObject({ x: 2, y: 2 });
    expect(walkPoseAt(DROITE, 2, 2, 0, DIMS, T0 + STEP_MS * 10)).toMatchObject({ x: 2, y: 2 });
  });

  it('la position PASSÉE en argument est ignorée tant que la marche vit (le chemin fait foi)', () => {
    const a = walkPoseAt(DROITE, 2, 2, 0, DIMS, T0 + STEP_MS / 2);
    const b = walkPoseAt(DROITE, 99, 99, 0, DIMS, T0 + STEP_MS / 2);
    expect(b).toEqual(a);
  });

  it('le point de TRI est une case du segment et reste CONSTANT sur toute sa durée', () => {
    const ancres = [0, 0.2, 0.5, 0.9].map((f) => walkPoseAt(DROITE, 2, 2, 0, DIMS, T0 + STEP_MS * f).sortPt);
    for (const s of ancres) expect(DROITE.path).toContainEqual(s);
    for (const s of ancres) expect(s).toEqual(ancres[0]);
  });

  it('chemin à plusieurs pas : le segment courant suit l’avancement', () => {
    const long: WalkTrack = { path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 3 }], start: T0 };
    expect(walkPoseAt(long, 0, 0, 0, DIMS, T0 + STEP_MS / 2)).toMatchObject({ x: 0.5, y: 0 });
    expect(walkPoseAt(long, 0, 0, 0, DIMS, T0 + STEP_MS * 1.5)).toMatchObject({ x: 1, y: 1.5 });
  });

  it('chemin qui TOURNE : le point de tri CHANGE de segment au virage, et reste constant dans chacun', () => {
    // Le virage est le cas qui distingue le point de tri d’un simple arrondi de la position : les deux
    // segments n’ont pas la même case la plus profonde, et c’est ce point qui décide où le jeton
    // s’insère dans le peintre (`stage/objs.ts`).
    const virage: WalkTrack = { path: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], start: T0 };
    const plusProfonde = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      (depth(b.x, b.y, DIMS, 0) >= depth(a.x, a.y, DIMS, 0) ? b : a);
    const seg0 = [0.05, 0.5, 0.95].map((f) => walkPoseAt(virage, 9, 9, 0, DIMS, T0 + STEP_MS * f).sortPt);
    const seg1 = [1.05, 1.5, 1.95].map((f) => walkPoseAt(virage, 9, 9, 0, DIMS, T0 + STEP_MS * f).sortPt);
    for (const s of seg0) expect(s).toEqual(seg0[0]);
    for (const s of seg1) expect(s).toEqual(seg1[0]);
    expect(seg1[0]).not.toEqual(seg0[0]);
    expect(seg0[0]).toEqual(plusProfonde({ x: 0, y: 0 }, { x: 2, y: 0 }));
    expect(seg1[0]).toEqual(plusProfonde({ x: 2, y: 0 }, { x: 2, y: 2 }));
  });
});

describe('walkGlideM — le décalage MONDE de la boucle volumique EST la pose partagée', () => {
  const PLAT = () => 0;

  it('reproduit exactement `walkPoseAt`, en mètres, à tout instant', () => {
    const base = { x: 2, y: 2, z: 0 };
    for (const f of [0, 0.25, 0.5, 0.75]) {
      const now = T0 + STEP_MS * f;
      const pose = walkPoseAt(DROITE, base.x, base.y, base.z, DIMS, now);
      expect(walkGlideM(DROITE, base, DIMS, 3, now, PLAT)).toEqual({
        dx: (pose.x - base.x) * 3,
        dy: 0,
        dz: (pose.y - base.y) * 3,
      });
    }
  });

  it('sans marche vivante : aucun décalage (le quad reste à son ancre cuite)', () => {
    expect(walkGlideM(undefined, { x: 2, y: 2, z: 0 }, DIMS, 3, T0, PLAT)).toBeNull();
  });

  it('le jeton monte avec SON SOL : la hauteur suit la case ARRONDIE de la pose', () => {
    const sol = (x: number) => (Math.round(x) >= 2 ? 5 : 0);
    const base = { x: 0, y: 2, z: 0 };
    // Départ à la case 0 (sol 0) ; à mi-chemin la case arrondie vaut encore 1, à l'arrivée elle vaut 2.
    expect(walkGlideM(DROITE, base, DIMS, 3, T0 + STEP_MS / 2, sol)!.dy).toBe(0);
    expect(walkGlideM(DROITE, base, DIMS, 3, T0 + STEP_MS * 0.95, sol)!.dy).toBe(5);
  });
});
