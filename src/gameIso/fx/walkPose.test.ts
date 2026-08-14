import { describe, expect, it } from 'vitest';
import { STEP_MS } from '../../geometry/walk';
import { walkGlideM, walkPoseAt, type WalkTrack } from './walkPose';

/**
 * La COURBE de glissement est unique (#1176, P2-4) : les surcouches SVG la lisent au rendu React, le
 * monde volumique la lit dans sa boucle de rendu. Ces clauses tiennent la courbe elle-même (valeurs
 * attendues, pas une paraphrase de l'implémentation) et le fait que le décalage MONDE que consomme la
 * boucle n'est rien d'autre que cette même pose, exprimée en mètres.
 */
const T0 = 1000;
const DROITE: WalkTrack = { path: [{ x: 0, y: 2 }, { x: 2, y: 2 }], start: T0 };

describe('walkPoseAt — la courbe de glissement, partagée par les deux voies', () => {
  it('sans marche vivante : le sujet est à sa case et ne glisse pas', () => {
    expect(walkPoseAt(undefined, 3, 4, T0 + 40)).toEqual({ x: 3, y: 4, walking: false });
  });

  it('à mi-segment : position FRACTIONNAIRE linéaire entre les deux cases', () => {
    expect(walkPoseAt(DROITE, 2, 2, T0)).toEqual({ x: 0, y: 2, walking: true });
    expect(walkPoseAt(DROITE, 2, 2, T0 + STEP_MS / 4)).toMatchObject({ x: 0.5, y: 2 });
    expect(walkPoseAt(DROITE, 2, 2, T0 + STEP_MS / 2)).toMatchObject({ x: 1, y: 2 });
    expect(walkPoseAt(DROITE, 2, 2, T0 + (STEP_MS * 3) / 4)).toMatchObject({ x: 1.5, y: 2 });
  });

  it('la vitesse est CONSTANTE le long d’un segment (une marche, pas un ressort)', () => {
    const à = (f: number) => walkPoseAt(DROITE, 2, 2, T0 + STEP_MS * f).x;
    const pas = [0.1, 0.2, 0.3, 0.4, 0.5].map((f) => à(f + 0.1) - à(f));
    for (const d of pas) expect(d).toBeCloseTo(pas[0], 12);
    expect(pas[0]).toBeGreaterThan(0);
  });

  it('au terme de la durée : la dernière case du chemin, jamais au-delà', () => {
    expect(walkPoseAt(DROITE, 2, 2, T0 + STEP_MS)).toMatchObject({ x: 2, y: 2 });
    expect(walkPoseAt(DROITE, 2, 2, T0 + STEP_MS * 10)).toMatchObject({ x: 2, y: 2 });
  });

  it('la position PASSÉE en argument est ignorée tant que la marche vit (le chemin fait foi)', () => {
    const a = walkPoseAt(DROITE, 2, 2, T0 + STEP_MS / 2);
    const b = walkPoseAt(DROITE, 99, 99, T0 + STEP_MS / 2);
    expect(b).toEqual(a);
  });

  it('chemin à plusieurs pas : le segment courant suit l’avancement', () => {
    const long: WalkTrack = { path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 3 }], start: T0 };
    expect(walkPoseAt(long, 0, 0, T0 + STEP_MS / 2)).toMatchObject({ x: 0.5, y: 0 });
    expect(walkPoseAt(long, 0, 0, T0 + STEP_MS * 1.5)).toMatchObject({ x: 1, y: 1.5 });
  });

  it('chemin qui TOURNE : la pose reste SUR le chemin à chaque instant', () => {
    const virage: WalkTrack = { path: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], start: T0 };
    for (const f of [0.05, 0.5, 0.95]) {
      const p = walkPoseAt(virage, 9, 9, T0 + STEP_MS * f);
      expect(p.y).toBe(0); // premier segment : plein est
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(2);
    }
    for (const f of [1.05, 1.5, 1.95]) {
      const p = walkPoseAt(virage, 9, 9, T0 + STEP_MS * f);
      expect(p.x).toBe(2); // second segment : plein sud
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(2);
    }
  });
});

describe('walkGlideM — le décalage MONDE de la boucle volumique EST la pose partagée', () => {
  const PLAT = () => 0;

  it('reproduit exactement `walkPoseAt`, en mètres, à tout instant', () => {
    const base = { x: 2, y: 2, z: 0 };
    for (const f of [0, 0.25, 0.5, 0.75]) {
      const now = T0 + STEP_MS * f;
      const pose = walkPoseAt(DROITE, base.x, base.y, now);
      expect(walkGlideM(DROITE, base, 3, now, PLAT)).toEqual({
        dx: (pose.x - base.x) * 3,
        dy: 0,
        dz: (pose.y - base.y) * 3,
      });
    }
  });

  it('sans marche vivante : aucun décalage (le quad reste à son ancre cuite)', () => {
    expect(walkGlideM(undefined, { x: 2, y: 2, z: 0 }, 3, T0, PLAT)).toBeNull();
  });

  it('le jeton monte avec SON SOL : la hauteur suit la case ARRONDIE de la pose', () => {
    const sol = (x: number) => (Math.round(x) >= 2 ? 5 : 0);
    const base = { x: 0, y: 2, z: 0 };
    // Départ à la case 0 (sol 0) ; à mi-chemin la case arrondie vaut encore 1, à l'arrivée elle vaut 2.
    expect(walkGlideM(DROITE, base, 3, T0 + STEP_MS / 2, sol)!.dy).toBe(0);
    expect(walkGlideM(DROITE, base, 3, T0 + STEP_MS * 0.95, sol)!.dy).toBe(5);
  });
});
