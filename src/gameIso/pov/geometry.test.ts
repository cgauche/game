import { describe, it, expect } from 'vitest';
import { buildPovDrawList } from './geometry';
import { makeCamera } from './camera';
import { emptyScene, setStructureDown, type Scene, type WallSeg } from '../../state/scene';

// Petite scène plate (sol marchable, height 0) + quelques murs devant la caméra.
function scene(): Scene {
  const s = emptyScene(12, 12);
  s.layers = [{ z: 0, tiles: new Array(12 * 12).fill('sol') }];
  const walls: WallSeg[] = [
    { x: 6, y: 5, side: 'N' }, // devant le groupe qui regarde Nord depuis (6,8)
    { x: 6, y: 4, side: 'E' },
  ];
  s.walls = walls;
  return s;
}

const LIGHT = { at: () => 1 };

describe('buildPovDrawList', () => {
  it('liste triée du plus loin au plus proche (depth non-croissant)', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N'); // regarde Nord (y↓)
    const visible = new Set<string>();
    for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].depth).toBeLessThanOrEqual(list[i - 1].depth);
    }
  });

  it('une tuile HORS de `visible` ne produit aucun item', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    // (2,2) n’est PAS dans `visible`.
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    expect(list.some((it) => it.key.includes('2,2,0'))).toBe(false);
    // toutes les clés de sol/plafond référencent des tuiles visibles.
    for (const it of list) {
      if (it.kind === 'floor' || it.kind === 'ceiling') {
        const m = it.key.match(/(\d+),(\d+),0$/)!;
        expect(visible.has(`${m[1]},${m[2]},0`)).toBe(true);
      }
    }
  });

  it('produit des items de mur (kind wall) pour les murs dont une case borde une tuile visible', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const walls = list.filter((it) => it.kind === 'wall');
    expect(walls.length).toBeGreaterThan(0);
  });

  it('chaque item a ≥ 3 points et une couleur rgb(...)', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    for (const it of list) {
      expect(it.points.length).toBeGreaterThanOrEqual(3);
      expect(it.fill).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
      for (const [px, py] of it.points) {
        expect(Number.isFinite(px)).toBe(true);
        expect(Number.isFinite(py)).toBe(true);
      }
    }
  });

  it('extérieur → PAS de plafond (le ciel reste visible) ; intérieur → plafond présent', () => {
    const visible = new Set<string>();
    for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    // emptyScene = extérieur (ambiance absente) → sols oui, plafonds non.
    const so = scene();
    const out = buildPovDrawList(so, makeCamera(so, { x: 6, y: 8 }, 'N'), visible, LIGHT);
    expect(out.some((it) => it.kind === 'floor')).toBe(true);
    expect(out.some((it) => it.kind === 'ceiling')).toBe(false);
    // intérieur → plafond présent (donnée partagée `ambiance`).
    const si = scene();
    si.ambiance = 'interieur';
    const inside = buildPovDrawList(si, makeCamera(si, { x: 6, y: 8 }, 'N'), visible, LIGHT);
    expect(inside.some((it) => it.kind === 'ceiling')).toBe(true);
  });

  it('déterministe : deux appels identiques → même liste', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>(['6,7,0', '6,6,0', '6,5,0']);
    const a = buildPovDrawList(s, cam, visible, LIGHT);
    const b = buildPovDrawList(s, cam, visible, LIGHT);
    expect(a.map((i) => i.key)).toEqual(b.map((i) => i.key));
    expect(a.map((i) => i.fill)).toEqual(b.map((i) => i.fill));
  });

  it('porte-de-ville (structure fortifiée) → détail POV : ouverture béante (face-less) + parapet + merlons + herse', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    s.walls = [{ x: 6, y: 5, side: 'N', structure: 'porte-de-ville' }];
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const walls = list.filter((it) => it.kind === 'wall');
    // La def porte-de-ville produit plusieurs pièces (parapet + ferrure + arase + 3 merlons + 7 barreaux).
    expect(walls.length).toBeGreaterThan(1);
    // Ouverture béante (openingFrac 1.0) → PAS de face pleine, mais herse + merlons présents
    // (clés = `<el.key>:<i>:<part>`, les MÊMES faces pivot que l'iso).
    expect(walls.some((it) => it.key.endsWith(':face'))).toBe(false);
    expect(walls.some((it) => it.key.endsWith(':herse-barreau'))).toBe(true);
    expect(walls.some((it) => it.key.endsWith(':merlon'))).toBe(true);
    expect(walls.some((it) => it.key.endsWith(':parapet'))).toBe(true);
  });

  it('mur-en-pierre (rempart) → face pleine + merlons crénelés', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    s.walls = [{ x: 6, y: 5, side: 'N', structure: 'mur-en-pierre' }];
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const walls = list.filter((it) => it.kind === 'wall');
    expect(walls.some((it) => it.key.endsWith(':face'))).toBe(true); // face pleine (pas d'ouverture)
    expect(walls.some((it) => it.key.endsWith(':merlon'))).toBe(true); // créneaux du rempart
    expect(walls.some((it) => it.key.endsWith(':herse-barreau'))).toBe(false); // pas de porte → pas de herse
  });

  it('mur BOIS → le détail (panneau/moulure/plinthe) est AUSSI visible en POV ; montants (2 points) exclus', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>(['6,5,0', '6,6,0', '6,7,0', '6,8,0']);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const keys = list.filter((it) => it.kind === 'wall').map((it) => it.key);
    for (const part of [':face', ':panneau', ':moulure', ':plinthe', ':couronnement']) expect(keys.some((k) => k.endsWith(part))).toBe(true);
    expect(keys.some((k) => k.endsWith(':poteau'))).toBe(false); // ornement d'écran affine (2 points)
  });

  it('structure ABATTUE → faces de BRÈCHE (tas de gravats) au lieu du mur, plus de face pleine', () => {
    let s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>(['6,5,0', '6,6,0', '6,7,0', '6,8,0']);
    s.walls = [{ x: 6, y: 5, side: 'N', structure: 'mur-en-pierre' }];
    s = setStructureDown(s, 6, 5, 'N', 0, true);
    const keys = buildPovDrawList(s, cam, visible, LIGHT).filter((it) => it.kind === 'wall').map((it) => it.key);
    expect(keys.some((k) => k.endsWith(':gravats-tas'))).toBe(true);
    expect(keys.some((k) => k.endsWith(':face'))).toBe(false);
  });

  it('porte OUVERTE = passage (aucun mur) ; porte FERMÉE = vantail', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>(['6,8,0', '6,7,0', '6,6,0']);
    // Porte SANS `closed` → ouverte par défaut (doorIsOpen) → passage béant, pas de mur devant.
    s.walls = [{ x: 6, y: 7, side: 'N', door: true }];
    expect(buildPovDrawList(s, cam, visible, LIGHT).some((it) => it.kind === 'wall')).toBe(false);
    // Fermée → un vantail (mur) apparaît.
    s.walls = [{ x: 6, y: 7, side: 'N', door: true, closed: true }];
    expect(buildPovDrawList(s, cam, visible, LIGHT).some((it) => it.kind === 'wall')).toBe(true);
  });

  it('relief : une plateforme surélevée (rempart) produit des FACES VERTICALES (risers) → solide, pas de « voir à travers »', () => {
    const s = emptyScene(6, 6);
    const t = new Array(36).fill('vide') as import('../../state/scene').Terrain[];
    const hgt = new Array(36).fill(0);
    const put = (x: number, y: number) => { t[y * 6 + x] = 'sol'; hgt[y * 6 + x] = 4; };
    put(3, 2); put(3, 3); // plateforme 4 m au-dessus du sol (comme un rempart)
    s.layers = [{ z: 0, tiles: new Array(36).fill('sol') }, { z: 1, tiles: t, height: hgt }];
    const cam = makeCamera(s, { x: 3, y: 5 }, 'N'); // au sol, face à la plateforme
    const visible = new Set<string>();
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    expect(list.some((it) => it.kind === 'riser')).toBe(true); // la face verticale du rempart est rendue
  });

  it('multi-niveaux : rend TOUTES les couches d’une colonne visible (sol du groupe + étage/plateforme)', () => {
    const s = emptyScene(6, 6);
    s.layers = [
      { z: 0, tiles: new Array(36).fill('sol') },
      { z: 1, tiles: new Array(36).fill('sol') },
    ];
    const cam = makeCamera(s, { x: 3, y: 3, z: 1 }, 'N'); // groupe à l'étage 1
    const visible = new Set<string>();
    for (let y = 1; y <= 4; y++) for (let x = 1; x <= 4; x++) { visible.add(`${x},${y},1`); visible.add(`${x},${y},0`); }
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    expect(list.some((it) => it.key.endsWith(',1'))).toBe(true); // couche courante
    expect(list.some((it) => it.key.endsWith(',0'))).toBe(true); // couche en dessous (trémie)
  });
});
