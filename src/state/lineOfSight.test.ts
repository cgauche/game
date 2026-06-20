import { describe, it, expect } from 'vitest';
import { tilesBetween, coverModifier, lineOfSightCover, smokeZone } from './lineOfSight';
import { Scene, SceneEntity, WallSeg } from './scene';

function scene(w: number, h: number, tiles?: Record<string, string>, entities: SceneEntity[] = []): Scene {
  const grid = new Array(w * h).fill('herbe');
  if (tiles)
    for (const [k, v] of Object.entries(tiles)) {
      const [x, y] = k.split(',').map(Number);
      grid[y * w + x] = v;
    }
  return {
    id: 's',
    name: 's',
    dimensions: { w, h },
    ambiance: 'jour',
    levels: [{ z: 0, tiles: grid }],
    entities,
    buildings: [],
    dialogues: [],
    triggers: [],
    encounters: [],
  } as unknown as Scene;
}

const prop = (id: string, x: number, y: number, foot?: { w: number; h: number }): SceneEntity =>
  ({ id, kind: 'prop', pos: { x, y }, ref: id, foot }) as SceneEntity;

describe('tilesBetween — cases strictement entre deux points', () => {
  it('horizontal', () => {
    expect(tilesBetween({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });
  it('diagonal', () => {
    expect(tilesBetween({ x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([{ x: 1, y: 1 }]);
  });
  it('adjacent → aucune case intermédiaire', () => {
    expect(tilesBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });
});

describe('coverModifier — valeurs canon (LDB 14 l.103/114/120)', () => {
  it('imparfaite -10, moyenne -20, totale -30, none 0', () => {
    expect(coverModifier('none')).toBe(0);
    expect(coverModifier('imparfaite')).toBe(-10);
    expect(coverModifier('moyenne')).toBe(-20);
    expect(coverModifier('totale')).toBe(-30);
  });
});

describe('lineOfSightCover', () => {
  it('ligne dégagée → aucun couvert, non bloquée', () => {
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'none' });
  });
  it('sous-bois (bois) sur la ligne → imparfaite', () => {
    const s = scene(5, 1, { '2,0': 'bois' });
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'imparfaite' });
  });
  it('mur à distance de la cible → pas de Ligne de Vue (bloqué)', () => {
    const s = scene(6, 1, { '2,0': 'mur' });
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 5, y: 0 }, []).blocked).toBe(true);
  });
  it('mur ADJACENT à la cible → couverture totale -30, non bloqué', () => {
    const s = scene(5, 1, { '3,0': 'mur' });
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'totale' });
  });
  it('clôture (barrière en bois) sur la ligne → moyenne -20', () => {
    const s = scene(5, 1, {}, [prop('cloture', 2, 0)]);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'moyenne' });
  });
  it('empreinte de charrette (2×1) → couvre ses deux cases', () => {
    const s = scene(6, 1, {}, [prop('charrette', 3, 0, { w: 2, h: 1 })]);
    // la case 4,0 fait partie de l'empreinte → couvert moyen sur la ligne 0,0 → 5,0
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 5, y: 0 }, [])).toEqual({ blocked: false, cover: 'moyenne' });
  });
  it('créature intercalée → couvert imparfait (extrapolation 14 l.75)', () => {
    const occ = [{ x: 2, y: 0 }];
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, occ)).toEqual({ blocked: false, cover: 'imparfaite' });
  });
  it('retient la PIRE classe de couvert sur la ligne', () => {
    const s = scene(6, 1, { '1,0': 'bois' }, [prop('cloture', 3, 0)]);
    // bois (imparfaite) + clôture (moyenne) → pire = moyenne
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 5, y: 0 }, [])).toEqual({ blocked: false, cover: 'moyenne' });
  });
});

describe('lineOfSightCover — Fumée (Souffle (Fumée)) bloque la vue', () => {
  it('fumée INTERCALÉE sur la ligne → bloquée (totale)', () => {
    const smoke = [{ x: 2, y: 0 }];
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [], smoke)).toEqual({ blocked: true, cover: 'totale' });
  });
  it('cible DANS la fumée (extrémité) → bloquée', () => {
    const smoke = [{ x: 4, y: 0 }];
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [], smoke).blocked).toBe(true);
  });
  it('tireur DANS la fumée (extrémité source) → bloqué (aveuglé)', () => {
    const smoke = [{ x: 0, y: 0 }];
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [], smoke).blocked).toBe(true);
  });
  it('fumée HORS de la ligne → aucun effet', () => {
    const smoke = [{ x: 2, y: 3 }];
    expect(lineOfSightCover(scene(5, 5), { x: 0, y: 0 }, { x: 4, y: 0 }, [], smoke)).toEqual({ blocked: false, cover: 'none' });
  });
  it('sans argument fumée → comportement inchangé (rétro-compatible)', () => {
    expect(lineOfSightCover(scene(5, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'none' });
  });
});

describe('lineOfSightCover — murs d\'arête (Scene.walls) bloquent la vue', () => {
  const withWalls = (s: Scene, walls: WallSeg[]): Scene => ({ ...s, walls });

  it('mur d\'arête sur le trajet → vue bloquée (on ne voit pas à travers les murs)', () => {
    const s = withWalls(scene(5, 1), [{ x: 2, y: 0, side: 'E' }]); // arête entre (2,0) et (3,0)
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, []).blocked).toBe(true);
  });
  it('mur d\'arête entre deux cases ADJACENTES → vue bloquée', () => {
    const s = withWalls(scene(2, 1), [{ x: 0, y: 0, side: 'E' }]); // arête entre (0,0) et (1,0)
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 1, y: 0 }, []).blocked).toBe(true);
  });
  it('porte (door) sur le trajet → vue NON bloquée (ouverture, V1)', () => {
    const s = withWalls(scene(5, 1), [{ x: 2, y: 0, side: 'E', door: true }]);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, []).blocked).toBe(false);
  });
  it('mur d\'arête HORS du trajet → aucun effet', () => {
    const s = withWalls(scene(5, 2), [{ x: 2, y: 1, side: 'E' }]); // sur la ligne y=1, pas y=0
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'none' });
  });
  it('mur d\'arête sur un AUTRE étage (z) → aucun effet sur z=0', () => {
    const s = withWalls(scene(5, 1), [{ x: 2, y: 0, side: 'E', z: 1 }]);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, []).blocked).toBe(false);
  });
  it('un mur droit bloque AUSSI une ligne de vue DIAGONALE (pas de coin qui fuit)', () => {
    // mur horizontal sur l'arête N de (1,1) et (2,1) → sépare la rangée 0 de la rangée 1
    const s = withWalls(scene(4, 4), [{ x: 1, y: 1, side: 'N' }, { x: 2, y: 1, side: 'N' }]);
    expect(lineOfSightCover(s, { x: 1, y: 0 }, { x: 2, y: 2 }, []).blocked).toBe(true);
  });
  it('une diagonale SANS mur reste dégagée (pas de sur-blocage)', () => {
    const s = withWalls(scene(4, 4), [{ x: 0, y: 1, side: 'N' }]); // mur ailleurs, hors du trajet
    expect(lineOfSightCover(s, { x: 1, y: 0 }, { x: 2, y: 2 }, []).blocked).toBe(false);
  });
});

describe('smokeZone — emprise d\'un nuage de Souffle (Fumée)', () => {
  it('disque de Chebyshev `radius` autour du centre', () => {
    const z = smokeZone({ x: 0, y: 5 }, { x: 5, y: 5 }, 1);
    // 3×3 autour de (5,5) = 9 cases ; le trajet 0,5→5,5 (cases 1..4) en ajoute 4 hors disque
    expect(z).toContainEqual({ x: 5, y: 5 });
    expect(z).toContainEqual({ x: 4, y: 4 });
    expect(z).toContainEqual({ x: 6, y: 6 });
    expect(z.filter((t) => t.y === 5 && t.x >= 4 && t.x <= 6).length).toBe(3); // ligne centrale du disque
  });
  it('inclut le trajet tireur→centre mais PAS la case source', () => {
    const z = smokeZone({ x: 0, y: 0 }, { x: 5, y: 0 }, 0);
    expect(z).toContainEqual({ x: 3, y: 0 }); // trajet
    expect(z).toContainEqual({ x: 5, y: 0 }); // centre (radius 0)
    expect(z).not.toContainEqual({ x: 0, y: 0 }); // la créature souffle DEPUIS sa case (non enfumée)
  });
  it('souffle à bout portant : la case source reste hors fumée même DANS le disque (immunité)', () => {
    // attaquant en (4,5) adjacent à la cible (5,5), rayon 2 → la source est dans le disque
    const z = smokeZone({ x: 4, y: 5 }, { x: 5, y: 5 }, 2);
    expect(z).toContainEqual({ x: 5, y: 5 }); // cible enfumée
    expect(z).not.toContainEqual({ x: 4, y: 5 }); // la créature ne s'aveugle pas (immunisée à son propre Souffle)
  });
});
