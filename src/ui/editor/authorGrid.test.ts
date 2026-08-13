import { describe, expect, it } from 'vitest';
import { gridLines } from './authorGrid';
import { diamondCorners, tileCenter, type Dims, type Rot } from '../../geometry/iso';

/**
 * GRILLE D'AUTHORING (#1176, P3-3) — ce qui se garde, c'est qu'elle tombe sur les BORDS DE CASE du
 * monde, pas qu'elle existe : un quadrillage d'écran au bon pas mais décalé d'un demi-losange serait
 * pire que rien pour un éditeur (on poserait ses murs à côté).
 */
const dims = (rot: Rot, view: 'iso' | 'top'): Dims => ({ w: 8, h: 5, rot, edge: false, view });

describe('Grille de l’éditeur — un trait par rangée et par colonne, sur les bords de case', () => {
  it('le COMPTE est celui des lignes de grille, jamais un chemin par case', () => {
    const d = dims(0, 'top');
    expect(gridLines(d).length).toBe(d.w + d.h + 2); // 15 traits pour 40 cases
  });

  for (const view of ['iso', 'top'] as const)
    for (const rot of [0, 1, 2, 3] as Rot[])
      it(`${view} cran ${rot} : les traits passent par les COINS des cases (jamais par leur centre)`, () => {
        const d = dims(rot, view);
        const lignes = gridLines(d);
        const coins = diamondCorners(0, 0, d, 0);
        // Le coin HAUT de la case (0,0) est l'intersection des deux premiers traits : il est sur les deux.
        const surLigne = (l: { x1: number; y1: number; x2: number; y2: number }, p: [number, number]) => {
          const [px, py] = p;
          const ux = l.x2 - l.x1, uy = l.y2 - l.y1;
          const t = ((px - l.x1) * ux + (py - l.y1) * uy) / (ux * ux + uy * uy);
          return Math.hypot(l.x1 + t * ux - px, l.y1 + t * uy - py);
        };
        const proches = lignes.filter((l) => surLigne(l, coins.top) < 1e-6);
        expect(proches.length, 'un coin de case est sur DEUX traits').toBeGreaterThanOrEqual(2);
        // …et le CENTRE d'une case n'est sur aucun : la grille borne les cases, elle ne les barre pas.
        const centre = tileCenter(3, 2, d, 0);
        expect(lignes.every((l) => surLigne(l, [centre.cx, centre.cy]) > 1e-3)).toBe(true);
      });

  it('le PAS de la grille est celui de la carte : deux traits voisins sont à une case l’un de l’autre', () => {
    const d = dims(0, 'top');
    const lignes = gridLines(d);
    const pasGrille = Math.hypot(lignes[1].x1 - lignes[0].x1, lignes[1].y1 - lignes[0].y1);
    const a = tileCenter(3, 2, d, 0);
    const b = tileCenter(4, 2, d, 0);
    expect(pasGrille).toBeCloseTo(Math.hypot(b.cx - a.cx, b.cy - a.cy), 9);
  });

  it('elle couvre la carte ENTIÈRE (premier et dernier bord)', () => {
    const d = dims(0, 'iso');
    const lignes = gridLines(d);
    const premier = tileCenter(-0.5, -0.5, d, 0);
    const dernier = tileCenter(d.w - 0.5, -0.5, d, 0);
    expect([lignes[0].x1, lignes[0].y1]).toEqual([premier.cx, premier.cy]);
    expect([lignes[d.w].x1, lignes[d.w].y1]).toEqual([dernier.cx, dernier.cy]);
  });
});
