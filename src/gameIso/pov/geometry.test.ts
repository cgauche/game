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

  it('chaque item plein a ≥ 3 points et une couleur rgb(...) ; chaque tracé a un chemin fini', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    for (const it of list) {
      if (it.path) {
        // Tracé du LOD matériaux : chemin non vide, stroke OU fill teinté, épaisseur finie.
        expect(it.kind).toBe('detail');
        expect(it.path.length).toBeGreaterThan(0);
        expect(it.path).not.toContain('NaN');
        expect(it.stroke ?? it.fill).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
        continue;
      }
      expect(it.points!.length).toBeGreaterThanOrEqual(3);
      expect(it.fill).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
      for (const [px, py] of it.points!) {
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

  it('TOITS : pans continus du pivot rendus (kind roof), teinte par pan — un bâtiment se lit comme une maison', () => {
    const s = scene();
    s.roofs = [{ id: 'r1', style: 'maison', foot: { x: 5, y: 3, w: 3, h: 2 } }];
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 2; y <= 8; y++) for (let x = 3; x <= 8; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const roofs = list.filter((it) => it.kind === 'roof');
    expect(roofs.length).toBeGreaterThan(0); // au moins un pan projeté
    for (const it of roofs) expect(it.key.startsWith('roof:r1:')).toBe(true);
  });

  it('CUTAWAY toit : le groupe DANS l’empreinte → pas de pans, un PLAFOND intérieur sur l’empreinte', () => {
    const s = scene();
    s.roofs = [{ id: 'r1', style: 'maison', foot: { x: 5, y: 6, w: 3, h: 4 } }];
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N'); // le groupe est SOUS le toit (dans l'empreinte)
    const visible = new Set<string>();
    for (let y = 4; y <= 9; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    expect(list.some((it) => it.kind === 'roof')).toBe(false); // on est dessous : aucun pan
    expect(list.some((it) => it.key.startsWith('roofceil:'))).toBe(true); // plafond de l'empreinte
    // Une scène INTÉRIEURE garde son plafond tuile à tuile, sans doublon d'empreinte.
    const si = scene();
    si.ambiance = 'interieur';
    si.roofs = [{ id: 'r1', style: 'maison', foot: { x: 5, y: 6, w: 3, h: 4 } }];
    const inside = buildPovDrawList(si, makeCamera(si, { x: 6, y: 8 }, 'N'), visible, LIGHT);
    expect(inside.some((it) => it.key.startsWith('roofceil:'))).toBe(false);
    expect(inside.some((it) => it.key.startsWith('ceil:'))).toBe(true);
  });

  it('toit HORS des colonnes visibles (empreinte élargie) → pas dessiné', () => {
    const s = scene();
    s.roofs = [{ id: 'loin', style: 'maison', foot: { x: 0, y: 0, w: 2, h: 2 } }];
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>(['6,7,0', '6,6,0']); // le toit (0,0) n'est pas en vue
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    expect(list.some((it) => it.kind === 'roof')).toBe(false);
  });

  it('LOD murs : appareillage COMPLET (joints + blocs nuancés) ≤ 3 cases, joints seuls de 3 à 6, rien au-delà', () => {
    const detailOf = (wallY: number, eyeY: number) => {
      const s = scene();
      s.walls = [{ x: 6, y: wallY, side: 'N', structure: 'mur-en-pierre' }];
      const cam = makeCamera(s, { x: 6, y: eyeY }, 'N');
      const visible = new Set<string>();
      for (let y = 0; y <= 11; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
      return buildPovDrawList(s, cam, visible, LIGHT).filter((it) => it.kind === 'detail' && it.key.startsWith('wall:'));
    };
    // ~2 cases : joints (stroke) ET blocs nuancés (fill) — trapèzes de l'appareillage.
    const near = detailOf(6, 8);
    expect(near.some((it) => it.stroke && it.key.endsWith(':joints'))).toBe(true);
    expect(near.some((it) => it.fill && it.key.includes(':blocs'))).toBe(true);
    // ~5 cases : lignes de rangs seules, plus de blocs.
    const mid = detailOf(3, 8);
    expect(mid.some((it) => it.stroke && it.key.endsWith(':joints'))).toBe(true);
    expect(mid.some((it) => it.fill && it.key.includes(':blocs'))).toBe(false);
    // ~8 cases : plus rien (la brume prend le relais).
    const farAway = detailOf(0, 8);
    expect(farAway.length).toBe(0);
  });

  it('LOD sols : joints d’appareillage ≤ 3 cases pour un terrain à motif (pavé), rien pour l’herbe ni au-delà', () => {
    const s = scene();
    s.layers = [{ z: 0, tiles: new Array(12 * 12).fill('pave') }];
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 0; y <= 11; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const joints = list.filter((it) => it.kind === 'detail' && it.key.startsWith('floor:'));
    expect(joints.length).toBeGreaterThan(0);
    for (const it of joints) {
      // Toutes les tuiles à joints sont DANS la bande proche (≤ 3 cases + demi-diagonale de tuile).
      expect(it.depth / cam.mpt).toBeLessThanOrEqual(3.8);
    }
    // Herbe (aucune recette d'assises) → aucun joint de sol.
    const sh = scene();
    sh.layers = [{ z: 0, tiles: new Array(12 * 12).fill('herbe') }];
    const grass = buildPovDrawList(sh, makeCamera(sh, { x: 6, y: 8 }, 'N'), visible, LIGHT);
    expect(grass.some((it) => it.kind === 'detail' && it.key.startsWith('floor:'))).toBe(false);
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
