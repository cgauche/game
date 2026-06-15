/**
 * GÉOMÉTRIE du Théâtre Staatsoper (« Une nuit à l'Opéra », NADJ) — RECONSTRUITE du plan officiel
 * (rez-de-chaussée p.40 + premier étage p.41). PUREMENT la géométrie (étages, murs, élévation, vide,
 * escaliers) : ni logique, ni casting, ni dialogues (ceux-ci viendront en DONNÉE d'éditeur quand l'API
 * Flow sera stabilisée). Construit un `Scene` éditable — même esprit que le générateur d'arène (donnée,
 * pas de scène codée en dur). S'appuie sur tous les systèmes livrés : murs sur arêtes + diagonales
 * (éventail / foyer courbe), élévation (scène surélevée + fosse d'orchestre), multi-niveaux (parterre au
 * sol, loges/galerie à l'étage) + `vide` (puits central au-dessus du parterre) + escaliers.
 *
 * Repère : y=0 = la SCÈNE (au fond, en haut) ; y croissant = vers le FOYER (façade, en bas). Le public
 * regarde vers le haut. Symétrie autour de la colonne centrale.
 */
import type { Scene, Terrain, WallSeg, Level } from '../../state/scene';

const W = 23, H = 25;
const idx = (x: number, y: number) => y * W + x;
const inGrid = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;

// ── Éventail du parterre : bords gauche/droit par rangée (étroit près de la scène, large au fond). ──
const PY0 = 6, PY1 = 18;
const Lf = (y: number) => Math.round(7 - (y - PY0) / 3);
const Rf = (y: number) => Math.round(15 + (y - PY0) / 3);

type Side4 = 'N' | 'E' | 'S' | 'W';

function build(): { tiles0: Terrain[]; elev0: number[]; tiles1: Terrain[]; walls: WallSeg[]; stairs: NonNullable<Scene['stairs']> } {
  const tiles0 = new Array(W * H).fill('dalle') as Terrain[];
  const elev0 = new Array(W * H).fill(0) as number[];
  const tiles1 = new Array(W * H).fill('vide') as Terrain[];
  const walls: WallSeg[] = [];
  const seen = new Set<string>();
  const stairs: NonNullable<Scene['stairs']> = [];

  const fill = (t: Terrain[], x0: number, y0: number, x1: number, y1: number, v: Terrain) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inGrid(x, y)) t[idx(x, y)] = v;
  };
  const elevRect = (x0: number, y0: number, x1: number, y1: number, v: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inGrid(x, y)) elev0[idx(x, y)] = v;
  };
  /** Mur sur arête (N/E/S/W → canonique N/E), dédupliqué. */
  const wall = (x: number, y: number, side: Side4, z: number, door?: boolean) => {
    let cx = x, cy = y, cs: 'N' | 'E' = 'N';
    if (side === 'N') cs = 'N';
    else if (side === 'E') cs = 'E';
    else if (side === 'S') { cy = y + 1; cs = 'N'; }
    else { cx = x - 1; cs = 'E'; } // W
    const key = `${cx},${cy},${cs},${z},${door ? 'd' : 'w'}`;
    if (seen.has(key)) return;
    seen.add(key);
    walls.push({ x: cx, y: cy, side: cs, ...(z ? { z } : {}), ...(door ? { door: true } : {}) });
  };
  const diag = (x: number, y: number, d: '\\' | '/', z: number) => walls.push({ x, y, side: d, ...(z ? { z } : {}) });
  /** Périmètre de cloisons autour d'un rect (avec une porte optionnelle au milieu d'un côté). */
  const wallRect = (x0: number, y0: number, x1: number, y1: number, z: number, door?: { side: Side4 }) => {
    const midX = Math.floor((x0 + x1) / 2), midY = Math.floor((y0 + y1) / 2);
    for (let x = x0; x <= x1; x++) { wall(x, y0, 'N', z, door?.side === 'N' && x === midX); wall(x, y1, 'S', z, door?.side === 'S' && x === midX); }
    for (let y = y0; y <= y1; y++) { wall(x0, y, 'W', z, door?.side === 'W' && y === midY); wall(x1, y, 'E', z, door?.side === 'E' && y === midY); }
  };

  // ───────────────────────── REZ-DE-CHAUSSÉE (z=0) ─────────────────────────
  // Réserve de décors au fond (derrière la scène).
  fill(tiles0, 1, 0, 21, 0, 'plancher');
  // SCÈNE surélevée (planches) + coulisses de part et d'autre.
  fill(tiles0, 5, 1, 17, 4, 'planches'); elevRect(5, 1, 17, 4, 0.55);
  fill(tiles0, 1, 1, 4, 4, 'dalle'); fill(tiles0, 18, 1, 21, 4, 'dalle'); // coulisses (wings)
  // FOSSE d'orchestre (planches en contrebas) sous l'avant-scène.
  fill(tiles0, 6, 5, 16, 5, 'planches'); elevRect(6, 5, 16, 5, -0.5);
  fill(tiles0, 1, 5, 5, 5, 'dalle'); fill(tiles0, 17, 5, 21, 5, 'dalle');
  // PARTERRE en éventail (parquet) + salles latérales (loges d'artistes, vestiaires).
  for (let y = PY0; y <= PY1; y++) {
    const l = Lf(y), r = Rf(y);
    fill(tiles0, l, y, r, y, 'plancher'); // parterre (parquet)
    fill(tiles0, 1, y, l - 1, y, 'dalle'); // salles latérales gauche (couloirs/loges d'artistes, pierre)
    fill(tiles0, r + 1, y, 21, y, 'dalle'); // salles latérales droite
  }
  // FOYER (marbre) sous le parterre.
  fill(tiles0, 1, 19, 21, 24, 'marbre');

  // Périmètre du bâtiment (rez) + porte d'honneur au sud, entrée des artistes à l'est.
  wallRect(1, 0, 21, 24, 0);
  wall(11, 24, 'S', 0, true); // entrée principale (façade)
  wall(21, 2, 'E', 0, true); // entrée des artistes (côté scène)
  // Foyer : coins avant ARRONDIS (façade courbe) — vide + diagonale.
  for (const [cxn, d] of [[1, '/'], [21, '\\']] as const) { tiles0[idx(cxn, 24)] = 'vide'; diag(cxn, 24, d, 0); }

  // Côtés de l'ÉVENTAIL : cloison entre parterre et salles latérales (verticale + diagonale aux décrochés).
  for (let y = PY0; y <= PY1; y++) {
    wall(Lf(y), y, 'W', 0); // mur ouest du parterre
    wall(Rf(y), y, 'E', 0); // mur est du parterre
    if (y > PY0 && Lf(y) < Lf(y - 1)) diag(Lf(y - 1), y, '\\', 0); // décroché gauche → pan oblique
    if (y > PY0 && Rf(y) > Rf(y - 1)) diag(Rf(y - 1), y, '/', 0); // décroché droit → pan oblique
  }
  // Refends des salles latérales (portes vers le couloir périphérique) — quelques pièces de service.
  for (const sy of [9, 13, 17]) { for (let x = 1; x <= 4; x++) wall(x, sy, 'S', 0); for (let x = 18; x <= 21; x++) wall(x, sy, 'S', 0); }
  // Séparation foyer / auditorium (mur du fond avec deux portes latérales).
  for (let x = 1; x <= 21; x++) wall(x, 19, 'N', 0, x === 4 || x === 18);

  // ───────────────────────── PREMIER ÉTAGE (z=1) ─────────────────────────
  // PUITS CENTRAL : l'intérieur du parterre reste VIDE (ouvert sur le rez), bordé de loges.
  // Bande de LOGES tout autour du puits (au-dessus des salles latérales + du fond).
  for (let y = PY0; y <= PY1; y++) {
    const l = Lf(y), r = Rf(y);
    fill(tiles1, l - 2, y, l - 1, y, 'plancher'); // loges gauche (2 de profondeur)
    fill(tiles1, r + 1, y, r + 2, y, 'plancher'); // loges droite
  }
  // Galerie au fond (côté façade) reliée aux loges latérales — surplombe le foyer.
  fill(tiles1, 3, 19, 19, 20, 'plancher');
  // LOGE ROYALE (marbre) + ANTICHAMBRE DUCALE au fond, dans l'axe de la scène.
  fill(tiles1, 9, 20, 13, 20, 'marbre'); // loge royale (face à la scène)
  fill(tiles1, 9, 21, 13, 22, 'plancher'); // antichambre ducale derrière
  // Loges sur l'avant-scène (au-dessus des coulisses).
  fill(tiles1, 3, 4, 6, 5, 'plancher'); fill(tiles1, 16, 4, 19, 5, 'plancher');

  // Murs de l'étage : pourtour des loges + refends (une cloison par loge) + garde-corps sur le puits.
  for (let y = PY0; y <= PY1; y++) {
    const l = Lf(y), r = Rf(y);
    wall(l - 1, y, 'E', 1); // garde-corps des loges gauche vers le puits
    wall(r + 1, y, 'W', 1); // garde-corps des loges droite
    wall(l - 2, y, 'W', 1); wall(r + 2, y, 'E', 1); // dos des loges
    if ((y - PY0) % 2 === 0) { wall(l - 2, y, 'N', 1); wall(r + 2, y, 'N', 1); } // refends (séparation des loges)
  }
  // Garde-corps de la galerie du fond + loge royale.
  for (let x = 3; x <= 19; x++) wall(x, 19, 'N', 1);
  wallRect(9, 20, 13, 22, 1, { side: 'S' }); // loge royale + antichambre (porte au sud)
  wall(11, 20, 'N', 1); // balustrade de la loge royale vers le puits (ouverte au centre = vue sur scène)

  // ESCALIERS : deux escaliers d'honneur du foyer (rez) vers la galerie (étage).
  for (const [sx, sy] of [[3, 21], [19, 21]] as const) stairs.push({ from: { x: sx, y: sy, z: 0 }, to: { x: sx, y: sy, z: 1 } });

  return { tiles0, elev0, tiles1, walls, stairs };
}

/** Le Théâtre Staatsoper en DONNÉE (géométrie seule), éditable dans l'éditeur de niveau. */
export function buildOperaFloorplan(): Scene {
  const { tiles0, elev0, tiles1, walls, stairs } = build();
  const levels: Level[] = [
    { z: 0, tiles: tiles0, elev: elev0 },
    { z: 1, tiles: tiles1 },
  ];
  return {
    id: 'opera-staatsoper',
    nom: 'Théâtre Staatsoper',
    description: 'Opéra d’Altdorf — rez-de-chaussée (parterre en éventail, scène, fosse, foyer) et premier étage (loges autour du puits central, loge royale). Géométrie reconstruite du plan officiel.',
    ambiance: 'interieur',
    dimensions: { w: W, h: H },
    levels,
    walls,
    stairs,
    entities: [],
    buildings: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
    entryPoints: { 'entree-principale': { x: 11, y: 24 }, 'entree-artistes': { x: 21, y: 2 } },
  };
}
