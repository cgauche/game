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

  it('une tuile HORS de `visible` = MATIÈRE + lumière d\'AMBIANCE (plus de silhouette de brume pure)', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 4; y <= 8; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    // (6,2) n’est PAS dans `visible` (droit devant, dans la portée) → le sol est TOUJOURS rendu (plus de
    // trou de ciel), mais avec sa VRAIE matière sous une lumière d'ambiance : ni brume pure, ni noir, et
    // AUCUN détail d'appareillage (réservé au vu).
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const fogRgb = 'rgb(159,178,198)'; // AMBIANCE.pov.fogOutdoor #9fb2c6
    const hidden = list.filter((it) => it.key.includes('6,2,0'));
    expect(hidden.length).toBeGreaterThan(0); // plus de trou de ciel à travers le sol
    for (const it of hidden) {
      expect(it.kind).not.toBe('detail'); // pas d'appareillage fin sur une case non vue
      expect(it.fill).not.toBe(fogRgb); // la matière se montre, pas un aplat de brume
      expect(it.fill).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    }
    // Les murs d'une colonne non visible se MONTRENT aussi (matière + ambiance), sans détail d'appareillage.
    const sw = scene();
    sw.walls = [{ x: 6, y: 2, side: 'N', structure: 'mur-en-pierre' }];
    const lw = buildPovDrawList(sw, cam, visible, LIGHT);
    const hiddenWalls = lw.filter((it) => it.kind === 'wall' && it.key.includes('6,2'));
    expect(hiddenWalls.length).toBeGreaterThan(0);
    for (const it of hiddenWalls) expect(it.fill).not.toBe(fogRgb);
    expect(lw.some((it) => it.kind === 'detail' && it.key.startsWith('wall:6,2'))).toBe(false);
  });

  it('structure NON VUE : matière+ambiance FONDUE par la DISTANCE (proche nette, loin délavée ; jamais brume pure ni noir)', () => {
    // Sol plat, RIEN de visible → tout est non vu (lumière d'ambiance). On compare le fond d'une tuile
    // PROCHE (droit devant) à celui d'une tuile LOINTAINE : la lointaine doit être NETTEMENT plus délavée
    // vers la brume (fondu de distance `fogAt`), preuve que le rendu n'est ni un aplat de brume ni du noir.
    const N = 34;
    const flat = () => {
      const s = emptyScene(N, N);
      s.layers = [{ z: 0, tiles: new Array(N * N).fill('sol') }];
      return s;
    };
    const s = flat();
    const cam = makeCamera(s, { x: 16, y: 30 }, 'N'); // regarde Nord (y↓)
    const list = buildPovDrawList(s, cam, new Set<string>(), LIGHT);
    const fogRgb = 'rgb(159,178,198)';
    const fog = [159, 178, 198];
    const distToFog = (fill: string): number => {
      const [r, g, b] = fill.match(/\d+/g)!.map(Number);
      return Math.hypot(r - fog[0], g - fog[1], b - fog[2]);
    };
    const near = list.find((it) => it.kind === 'floor' && it.key === 'floor:16,28,0'); // ~2 cases
    const far = list.find((it) => it.kind === 'floor' && it.key === 'floor:16,10,0'); // ~20 cases
    expect(near).toBeTruthy();
    expect(far).toBeTruthy();
    for (const it of [near!, far!]) {
      expect(it.fill).not.toBe(fogRgb); // pas d'aplat de brume pure
      expect(it.fill).not.toBe('rgb(0,0,0)'); // ni noir (lumière d'ambiance)
    }
    // La tuile LOINTAINE est nettement plus proche de la brume que la PROCHE → fondu par la distance.
    expect(distToFog(far!.fill!)).toBeLessThan(distToFog(near!.fill!) - 20);
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
    // Fermée → un VANTAIL (panneau + planches + poignée) apparaît, plus une embrasure béante.
    s.walls = [{ x: 6, y: 7, side: 'N', door: true, closed: true }];
    const keys = buildPovDrawList(s, cam, visible, LIGHT).filter((it) => it.kind === 'wall').map((it) => it.key);
    expect(keys.some((k) => k.endsWith(':vantail'))).toBe(true);
    expect(keys.some((k) => k.endsWith(':embrasure'))).toBe(false);
  });

  it('mur FENÊTRÉ : vitre rendue en POV ; NUIT → vitre AMBRÉE émissive (fill ≠ jour) + classe warm', () => {
    const s = scene();
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>(['6,5,0', '6,6,0', '6,7,0', '6,8,0']);
    s.walls = [{ x: 6, y: 5, side: 'N', window: true }];
    const day = buildPovDrawList(s, cam, visible, LIGHT, false);
    const dayGlass = day.find((it) => it.kind === 'wall' && it.key.endsWith(':vitre'));
    expect(dayGlass).toBeTruthy();
    expect(dayGlass!.cls).toBeUndefined(); // pas d'anim de jour
    const night = buildPovDrawList(s, cam, visible, LIGHT, true);
    const nightGlass = night.find((it) => it.kind === 'wall' && it.key.endsWith(':vitre'));
    expect(nightGlass).toBeTruthy();
    expect(nightGlass!.cls).toBe('warm'); // scintillement d'ambiance (anim.css global)
    expect(nightGlass!.fill).not.toBe(dayGlass!.fill); // ambre allumé ≠ verre froid du jour
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

  it('toit HORS des colonnes visibles (empreinte élargie) → MATIÈRE + ambiance (pas un trou, pas de brume pure)', () => {
    const s = scene();
    s.roofs = [{ id: 'loin', style: 'maison', foot: { x: 4, y: 2, w: 2, h: 2 } }];
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>(['6,7,0', '6,6,0']); // le toit n'est pas en vue
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const roofs = list.filter((it) => it.kind === 'roof');
    expect(roofs.length).toBeGreaterThan(0); // le bâtiment se rend (fondu au loin) au lieu de disparaître
    for (const it of roofs) expect(it.fill).not.toBe('rgb(159,178,198)'); // sa tuile réelle, pas un aplat de brume
  });

  it('LOD murs en FONDU : appareillage complet près, blocs dissous après blocksT+fadeT, rangs JUSQU\'AU LOIN', () => {
    const detailOf = (wallY: number, eyeY: number) => {
      const s = scene();
      s.walls = [{ x: 6, y: wallY, side: 'N', structure: 'mur-en-pierre' }];
      const cam = makeCamera(s, { x: 6, y: eyeY }, 'N');
      const visible = new Set<string>();
      for (let y = 0; y <= 11; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
      return buildPovDrawList(s, cam, visible, LIGHT).filter((it) => it.kind === 'detail' && it.key.startsWith('wall:'));
    };
    // ~2 cases : rangs (stroke), joints verticaux ET blocs nuancés (fill) — appareillage complet.
    const near = detailOf(6, 8);
    expect(near.some((it) => it.stroke && it.key.endsWith(':joints'))).toBe(true);
    expect(near.some((it) => it.stroke && it.key.endsWith(':jointsv'))).toBe(true);
    expect(near.some((it) => it.fill && it.key.includes(':blocs'))).toBe(true);
    // ~8 cases (> blocksT+fadeT) : les rangs CONTINUENT (perspective jusqu'au loin), blocs/verticaux dissous.
    const mid = detailOf(0, 8);
    expect(mid.some((it) => it.stroke && it.key.endsWith(':joints'))).toBe(true);
    expect(mid.some((it) => it.key.endsWith(':jointsv'))).toBe(false);
    expect(mid.some((it) => it.fill && it.key.includes(':blocs'))).toBe(false);
    // ~11 cases : les rangs portent TOUJOURS la profondeur (plus de coupure sèche à 6 cases).
    const farAway = detailOf(0, 11);
    expect(farAway.some((it) => it.stroke && it.key.endsWith(':joints'))).toBe(true);
  });

  it('LOD sols : rangs de pavé en fondu adaptatif (pas projeté) + MAILLAGE de tuiles jusqu\'à la portée', () => {
    const s = scene();
    s.layers = [{ z: 0, tiles: new Array(12 * 12).fill('pave') }];
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 0; y <= 11; y++) for (let x = 4; x <= 8; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const joints = list.filter((it) => it.kind === 'detail' && it.key.startsWith('floor:'));
    expect(joints.length).toBeGreaterThan(0);
    for (const it of joints) {
      // Les rangs intra-tuile s'éteignent quand leur pas PROJETÉ passe sous le minimum (~7-8 cases
      // à 2 m/case) — pas de moiré subpixel au loin.
      expect(it.depth / cam.mpt).toBeLessThanOrEqual(9);
    }
    // Le MAILLAGE (arêtes de tuiles = vrais joints du pavé) file LUI jusqu'au fond de la vue.
    const mesh = list.filter((it) => it.kind === 'detail' && it.key.startsWith('mesh:'));
    expect(mesh.length).toBeGreaterThan(0);
    const maxMeshT = Math.max(...mesh.map((it) => it.depth / cam.mpt));
    expect(maxMeshT).toBeGreaterThan(6); // bien au-delà de l'ancienne coupure des 3 cases
    // Herbe (aucune recette d'assises) → pas de rangs, mais une maille SUBTILE qui entre en fondu
    // après meshStartT (repère de profondeur des terrains nus).
    const sh = scene();
    sh.layers = [{ z: 0, tiles: new Array(12 * 12).fill('herbe') }];
    const grass = buildPovDrawList(sh, makeCamera(sh, { x: 6, y: 8 }, 'N'), visible, LIGHT);
    expect(grass.some((it) => it.kind === 'detail' && it.key.startsWith('floor:'))).toBe(false);
    const gmesh = grass.filter((it) => it.kind === 'detail' && it.key.startsWith('mesh:'));
    expect(gmesh.length).toBeGreaterThan(0);
    // …et jamais dans la zone d'entrée (≤ meshStartT cases) : l'herbe aux pieds reste nue.
    for (const it of gmesh) expect(it.depth / cam.mpt).toBeGreaterThan(2);
  });

  it('DÉTAIL SOL POV — herbe : variance de teinte par tuile (tintVar) + TOUFFES au premier plan', () => {
    const s = scene();
    s.layers = [{ z: 0, tiles: new Array(12 * 12).fill('herbe') }];
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 0; y <= 11; y++) for (let x = 3; x <= 9; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    // tintVar : les tuiles PROCHES d'herbe ne partagent pas toutes le même aplat (variante par tuile).
    const fills = new Set(list.filter((it) => it.kind === 'floor').map((it) => it.fill));
    expect(fills.size).toBeGreaterThan(1);
    // TOUFFES : au moins une tuile proche porte des brins (tracé stroké, teinté rgb, sans NaN) ; clé
    // `tuft:` DISTINCTE de l'appareillage `floor:` (l'herbe n'a AUCUN détail `floor:`).
    const tufts = list.filter((it) => it.kind === 'detail' && it.key.startsWith('tuft:'));
    expect(tufts.length).toBeGreaterThan(0);
    expect(list.some((it) => it.kind === 'detail' && it.key.startsWith('floor:'))).toBe(false);
    for (const it of tufts) {
      expect(it.path!.length).toBeGreaterThan(0);
      expect(it.path).not.toContain('NaN');
      expect(it.stroke).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    }
    // …et ces touffes restent au PREMIER PLAN : aucune au-delà de la bande proche (blocksT+fadeT ≈ 5,5).
    for (const it of tufts) expect(it.depth / cam.mpt).toBeLessThanOrEqual(6);
  });

  it('DÉTAIL SOL POV — terre : MOUCHETIS (galets) au premier plan (losanges remplis, clé `speckle:`)', () => {
    const s = scene();
    s.layers = [{ z: 0, tiles: new Array(12 * 12).fill('terre') }];
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N');
    const visible = new Set<string>();
    for (let y = 0; y <= 11; y++) for (let x = 3; x <= 9; x++) visible.add(`${x},${y},0`);
    const list = buildPovDrawList(s, cam, visible, LIGHT);
    const speckle = list.filter((it) => it.kind === 'detail' && it.key.startsWith('speckle:'));
    expect(speckle.length).toBeGreaterThan(0);
    for (const it of speckle) {
      expect(it.path!.length).toBeGreaterThan(0);
      expect(it.path).not.toContain('NaN');
      expect(it.fill).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
      expect(it.depth / cam.mpt).toBeLessThanOrEqual(6); // fondu par distance : rien au fond
    }
  });

  it('BLOC SOLIDE (mur, opaque) : ses faces prennent le seen/light du VOISIN ouvert, PAS de la tuile-bloc', () => {
    // Un mur est OPAQUE → jamais dans `visible` (ni éclairé, ni atteint par un rayon). Avant le fix, sa
    // tuile-bloc (non vue) forçait TOUTES ses faces en silhouette de brume (fogT=1) ou en noir (lv≈0).
    const s = emptyScene(12, 12);
    s.layers = [{ z: 0, tiles: new Array(144).fill('sol') }];
    s.layers[0].tiles[4 * 12 + 6] = 'mur'; // bloc plein à (6,4)
    const cam = makeCamera(s, { x: 6, y: 8 }, 'N'); // au sol, face au mur (regarde Nord, y↓)
    // Cases OUVERTES devant le mur EN VUE (y=5..8), mais PAS la tuile-bloc (6,4) ni au-delà (opaque).
    const visible = new Set<string>();
    for (let y = 5; y <= 8; y++) for (let x = 5; x <= 7; x++) visible.add(`${x},${y},0`);
    // Lumière : 1 sur les cases ouvertes, 0 SUR la tuile-bloc → une face qui lirait la tuile-bloc serait noire.
    const light = { at: (x: number, y: number) => (x === 6 && y === 4 ? 0 : 1) };
    const list = buildPovDrawList(s, cam, visible, light);
    const fogRgb = 'rgb(159,178,198)'; // brume pure (AMBIANCE.pov.fogOutdoor)
    // La face S du bloc borde (6,5) — VISIBLE + éclairée → rendue ÉCLAIRÉE (ni brume pure, ni noir).
    const murRisers = list.filter((it) => it.kind === 'riser' && it.key.startsWith('floor:6,4,0'));
    expect(murRisers.length).toBeGreaterThan(0);
    expect(murRisers.some((it) => it.fill !== fogRgb)).toBe(true); // ≥ la face vers le voisin ouvert vu
    // Le DESSUS du bloc est VU (au moins un voisin ouvert vu) → pas une silhouette de brume pâle au sommet.
    const murTop = list.find((it) => it.kind === 'floor' && it.key === 'floor:6,4,0');
    expect(murTop).toBeTruthy();
    expect(murTop!.fill).not.toBe(fogRgb);
    // Flanc PIERRE (bloc solide → matériau `pierre`) → appareillage d'assises comme un vrai mur (pas un aplat).
    expect(list.some((it) => it.kind === 'detail' && it.key.startsWith('floor:6,4,0'))).toBe(true);
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
