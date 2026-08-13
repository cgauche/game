import { describe, expect, it } from 'vitest';
import { projectedRangeAxes } from './lampMarker';
import { tileCenter, type Dims, type Rot } from '../../geometry/iso';

/**
 * CERCLE DE PORTÉE d'une lampe d'auteur (#1176, P3-3, vague B) — une GÉOMÉTRIE, donc gardée comme
 * telle : ce sont les demi-axes qui se mesurent, pas la présence d'une ellipse. Avant correctif, ils
 * étaient pris sur une diagonale d'écran puis aplatis d'un facteur constant : −21 % de portée en
 * losange, et −50 % en vue du DESSUS — la vue où l'auteur travaille son plan, et où la portée doit
 * être ronde.
 */
const dims = (rot: Rot, view: 'iso' | 'top'): Dims => ({ w: 20, h: 20, rot, edge: false, view });
const R = 3;

/** Vérité de référence : l'AMPLITUDE réelle du cercle projeté, échantillonnée sur la projection. */
function amplitudeMesuree(d: Dims, r = R) {
  let rx = 0;
  let ry = 0;
  const o = tileCenter(5, 5, d, 0);
  for (let i = 0; i < 720; i++) {
    const t = (i * Math.PI) / 360;
    const p = tileCenter(5 + r * Math.cos(t), 5 + r * Math.sin(t), d, 0);
    rx = Math.max(rx, Math.abs(p.cx - o.cx));
    ry = Math.max(ry, Math.abs(p.cy - o.cy));
  }
  return { rx, ry };
}

describe('Marqueur de lampe — les demi-axes du cercle de portée sont ceux de la PROJECTION', () => {
  for (const view of ['iso', 'top'] as const)
    for (const rot of [0, 1, 2, 3] as Rot[])
      it(`${view} cran ${rot} : demi-axes exacts (à l’échantillonnage près)`, () => {
        const d = dims(rot, view);
        const attendu = amplitudeMesuree(d);
        const rendu = projectedRangeAxes(5, 5, 0, R, d);
        expect(rendu.rx).toBeCloseTo(attendu.rx, 6);
        expect(rendu.ry).toBeCloseTo(attendu.ry, 6);
      });

  it('en vue du DESSUS, la portée est RONDE — c’est la vue où l’on trace le plan', () => {
    const a = projectedRangeAxes(5, 5, 0, R, dims(0, 'top'));
    expect(a.rx).toBeCloseTo(a.ry, 9);
  });

  it('en LOSANGE, elle est aplatie DANS LE RAPPORT de la projection, jamais d’un facteur posé à la main', () => {
    const a = projectedRangeAxes(5, 5, 0, R, dims(0, 'iso'));
    const attendu = amplitudeMesuree(dims(0, 'iso'));
    expect(a.ry / a.rx).toBeCloseTo(attendu.ry / attendu.rx, 9);
    expect(a.ry).toBeLessThan(a.rx); // l'iso écrase bien la profondeur
  });

  it('les demi-axes sont PROPORTIONNELS au rayon authoré (une lampe deux fois plus loin porte deux fois plus loin)', () => {
    const un = projectedRangeAxes(5, 5, 0, 1, dims(0, 'iso'));
    const deux = projectedRangeAxes(5, 5, 0, 2, dims(0, 'iso'));
    expect(deux.rx).toBeCloseTo(un.rx * 2, 9);
    expect(deux.ry).toBeCloseTo(un.ry * 2, 9);
  });
});
