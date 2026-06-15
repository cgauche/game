/**
 * GÉOMÉTRIE du Théâtre Staatsoper (« Une nuit à l'Opéra », NADJ) — RECONSTRUITE du plan officiel
 * (rez-de-chaussée p.40 + premier étage p.41). PUREMENT la géométrie (étages, murs, portes, élévation,
 * vide, escaliers) : ni logique, ni casting, ni dialogues (ceux-ci viendront en DONNÉE d'éditeur quand
 * l'API Flow sera stabilisée). Construit un `Scene` éditable — même esprit que le générateur d'arène
 * (donnée, pas de scène codée en dur). S'appuie sur tous les systèmes livrés : murs sur arêtes (cardinaux
 * BLOQUANTS + portes franchissables) + quelques diagonales PUREMENT VISUELLES pour la façade courbe,
 * élévation (scène surélevée + fosse d'orchestre en contrebas), multi-niveaux (parterre au sol, loges /
 * galerie / loge royale à l'étage) + `vide` (puits central au-dessus du parterre) + escaliers.
 *
 * Repère : y=0 = le FOND (réserve de décors / coulisses, en haut) ; y croissant = vers le FOYER (façade,
 * en bas). La SCÈNE regarde vers le bas ; le public la regarde vers le HAUT. Symétrie autour de x=11.
 *
 * Correspondance avec la LÉGENDE du plan (p.41), reportée pièce par pièce :
 *   16 Coulisses · 19 Scène · 18 Fosse d'orchestre · 17 parterre (Orchestre) · 14 Salle verte ·
 *   15 Bureau régisseur · 11/12/13 vestiaires des chœurs · 20 Stockage décors · 24 Rangements costumes ·
 *   21/22/23/25/27 réserves & loges de service · 7 Salon (foyer) · 10 Passage · 3 Escalier principal ·
 *   5/9 escaliers · 4 Commodités · 6 Vestiaire/billets · 1 Porte des Dames · 2 Porte des Seigneurs.
 *   Étage : 28/29 Loges · 30 Loge royale · 31 Antichambre ducale · 32/33/34 Balcons · 35/37 Galerie ·
 *   36/38 Bar des balcons · 39 Salon des Seigneurs.
 *
 * Toutes les pièces closes sont REJOIGNABLES : un couloir périphérique dessert les salles latérales du
 * rez et débouche sur le foyer ; le foyer ouvre sur l'auditorium ; à l'étage, un couloir de service
 * derrière les loges relie galerie → toutes les loges → loge royale & antichambre. Aucune pièce scellée.
 */
import type { Scene, Terrain, WallSeg, Level } from '../../state/scene';

const W = 23, H = 25;
const idx = (x: number, y: number) => y * W + x;
const inGrid = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;

// ── Éventail du parterre : bords gauche/droit par rangée (étroit près de la scène, large vers le fond du
//    parterre / le foyer). Reporté du plan : le parterre est un trapèze qui s'évase en descendant. ──
const PY0 = 6, PY1 = 17; // rangées du parterre (au-dessus = fosse/scène, en dessous = foyer)
const Lf = (y: number) => Math.round(7 - (y - PY0) / 3); // bord gauche : 7 → 3
const Rf = (y: number) => Math.round(15 + (y - PY0) / 3); // bord droit : 15 → 19

type Side4 = 'N' | 'E' | 'S' | 'W';

function build(): { tiles0: Terrain[]; elev0: number[]; tiles1: Terrain[]; walls: WallSeg[]; stairs: NonNullable<Scene['stairs']> } {
  const tiles0 = new Array(W * H).fill('vide') as Terrain[]; // hors-bâtiment = vide (pas de sol fantôme)
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
  /** Mur sur arête (N/E/S/W → canonique N/E), dédupliqué. `door` = franchissable. Une porte gagne
   *  toujours sur un mur plein déjà posé sur la même arête (on garde la version la plus permissive). */
  const wall = (x: number, y: number, side: Side4, z: number, door?: boolean) => {
    let cx = x, cy = y, cs: 'N' | 'E' = 'N';
    if (side === 'N') cs = 'N';
    else if (side === 'E') cs = 'E';
    else if (side === 'S') { cy = y + 1; cs = 'N'; }
    else { cx = x - 1; cs = 'E'; } // W
    const id = `${cx},${cy},${cs},${z}`;
    if (door) { // une porte gagne : retire un éventuel mur plein déjà posé sur cette arête
      if (seen.has(`${id},w`)) {
        seen.delete(`${id},w`);
        const k = walls.findIndex((w) => w.x === cx && w.y === cy && w.side === cs && (w.z ?? 0) === z && !w.door);
        if (k >= 0) walls.splice(k, 1);
      }
    } else if (seen.has(`${id},d`)) return; // ne pas reposer un mur plein là où il y a déjà une porte
    const key = `${id},${door ? 'd' : 'w'}`;
    if (seen.has(key)) return;
    seen.add(key);
    walls.push({ x: cx, y: cy, side: cs, ...(z ? { z } : {}), ...(door ? { door: true } : {}) });
  };
  const diag = (x: number, y: number, d: '\\' | '/', z: number) => walls.push({ x, y, side: d, ...(z ? { z } : {}) });
  /** Périmètre de cloisons autour d'un rect, avec une porte optionnelle (au milieu d'un côté, ou à
   *  l'index `at` le long du côté). */
  const wallRect = (x0: number, y0: number, x1: number, y1: number, z: number, door?: { side: Side4; at?: number }) => {
    const a = door?.at;
    const midX = a ?? Math.floor((x0 + x1) / 2), midY = a ?? Math.floor((y0 + y1) / 2);
    for (let x = x0; x <= x1; x++) { wall(x, y0, 'N', z, door?.side === 'N' && x === midX); wall(x, y1, 'S', z, door?.side === 'S' && x === midX); }
    for (let y = y0; y <= y1; y++) { wall(x0, y, 'W', z, door?.side === 'W' && y === midY); wall(x1, y, 'E', z, door?.side === 'E' && y === midY); }
  };

  // ───────────────────────── REZ-DE-CHAUSSÉE (z=0) ─────────────────────────
  // Empreinte du BÂTIMENT (x=1..21, y=0..23) = dalle de base (les pièces la spécialisent ensuite).
  fill(tiles0, 1, 0, 21, 23, 'dalle');
  // SCÈNE SURÉLEVÉE (19) — planches, +0.4. L'élévation REND le relief ET soulève le jeton (liftAt dans
  // IsoStage soulève surlignages/profondeur AVEC, donc le jeton reste sur sa case).
  fill(tiles0, 6, 2, 16, 4, 'planches'); elevRect(6, 2, 16, 4, 0.4);
  // FOSSE D'ORCHESTRE (18) EN CONTREBAS — planches, -0.4, bande courbe sous l'avant-scène (rangée 5).
  fill(tiles0, 7, 5, 15, 5, 'planches'); elevRect(7, 5, 15, 5, -0.4);
  // PARTERRE en éventail (17, parquet) — le reste de chaque rangée (dalle) = couloirs + salles latérales.
  for (let y = PY0; y <= PY1; y++) fill(tiles0, Lf(y), y, Rf(y), y, 'plancher');
  // FOYER (Salon 7) — marbre, sous le parterre (rangées 18-23) + seuil d'entrée (rangée 24, façade).
  fill(tiles0, 1, 18, 21, 23, 'marbre');
  fill(tiles0, 2, 24, 20, 24, 'marbre');

  // ── Périmètre du bâtiment + entrées : PORTE DES DAMES (1) & PORTE DES SEIGNEURS (2) en façade,
  //    ENTRÉE DES ARTISTES (côté coulisses, à l'est). ──
  wallRect(1, 0, 21, 24, 0);
  wall(8, 24, 'S', 0, true);  // Porte des Dames (1)
  wall(14, 24, 'S', 0, true); // Porte des Seigneurs (2)
  wall(21, 1, 'E', 0, true);  // Entrée des artistes
  // Façade : coins avant ARRONDIS (galbe du foyer) — vide + diagonale PUREMENT VISUELLE.
  for (const [cxn, d] of [[1, '/'], [21, '\\']] as const) { tiles0[idx(cxn, 24)] = 'vide'; diag(cxn, 24, d, 0); }

  // ── Côtés de l'ÉVENTAIL : cloison BLOQUANTE parterre↔salles latérales (murs cardinaux W/E + fermeture
  //    des MARCHES par des murs N ; PAS de diagonale, purement visuelle). Une PORTE par côté relie le
  //    parterre au couloir périphérique, au milieu de sa hauteur. ──
  const doorRow = Math.floor((PY0 + PY1) / 2);
  for (let y = PY0; y <= PY1; y++) {
    wall(Lf(y), y, 'W', 0, y === doorRow);
    wall(Rf(y), y, 'E', 0, y === doorRow);
    if (y > PY0) {
      for (let x = Lf(y); x < Lf(y - 1); x++) wall(x, y, 'N', 0); // ferme la marche gauche
      for (let x = Rf(y - 1) + 1; x <= Rf(y); x++) wall(x, y, 'N', 0); // ferme la marche droite
    }
  }
  // Avant-scène : fond du parterre vers la fosse — mur plein, ouverture centrale (accès des artistes).
  for (let x = Lf(PY0); x <= Rf(PY0); x++) wall(x, PY0, 'N', 0, x === 11);
  // Mur scène↔fosse et habillage des coulisses (la scène domine la fosse, accès par les coulisses).
  for (let x = 6; x <= 16; x++) wall(x, 5, 'N', 0); // avant-scène (bord de la fosse côté scène)

  // ── SALLES LATÉRALES (service) desservies par un COULOIR périphérique vertical (x=1 à gauche, x=21 à
  //    droite). Chaque pièce ouvre par une PORTE sur le couloir ; le couloir débouche sur le foyer. ──
  const bands = [[2, 4], [5, 7], [8, 10], [11, 13], [14, 17]] as const; // bandes de pièces (par y)
  for (const [y0, y1] of bands) {
    const mid = Math.floor((y0 + y1) / 2);
    // GAUCHE : pièce x=2..Lf(y)-1, mur intérieur en x=2 (arête W) avec porte sur le couloir x=1.
    for (let y = y0; y <= y1; y++) if (Lf(y) - 1 >= 2) wall(2, y, 'W', 0, y === mid);
    // DROITE : pièce x=Rf(y)+1..20, mur intérieur en x=20 (arête E) avec porte sur le couloir x=21.
    for (let y = y0; y <= y1; y++) if (Rf(y) + 1 <= 20) wall(20, y, 'E', 0, y === mid);
    // refends (séparation entre pièces) : du couloir au bord de l'éventail.
    if (y1 < 17) {
      for (let x = 2; x <= Lf(y1 + 1) - 1; x++) wall(x, y1, 'S', 0);
      for (let x = Rf(y1 + 1) + 1; x <= 20; x++) wall(x, y1, 'S', 0);
    }
  }
  // Cloison FOYER / AUDITORIUM (rangée 18) : deux PORTES sous les bords de l'éventail. Les couloirs
  // périphériques (x=1 et x=21) restent OUVERTS sur le foyer (pas de mur là).
  for (let x = 2; x <= 20; x++) wall(x, 18, 'N', 0, x === Lf(PY1) || x === Rf(PY1));

  // ── FOYER (Salon 7) : COMMODITÉS (4) à gauche, VESTIAIRE des billets (6) à droite — petites pièces au
  //    ras de la façade, porte au nord sur le marbre. Les deux ESCALIERS (5/9) montent à la galerie. ──
  wallRect(2, 21, 4, 23, 0, { side: 'N' });
  wallRect(18, 21, 20, 23, 0, { side: 'N' });

  // ───────────────────────── PREMIER ÉTAGE (z=1) ─────────────────────────
  // PUITS CENTRAL (oval) : l'intérieur du parterre reste VIDE (ouvert sur le rez). On construit autour :
  //   couloir de service (mur extérieur), loges (sur le puits), galerie (foyer), loge royale (fond).
  // Repères de colonnes du couloir de service derrière les loges (gauche/droite).
  const CL = 2, CR = 20; // couloirs de service (1 case), juste à l'intérieur du périmètre
  // Plancher de l'étage : tout l'anneau bâti (couloirs + loges + galerie + loge royale) = plancher ;
  // le PUITS (éventail) reste vide.
  fill(tiles1, CL, 3, CR, 20, 'plancher');
  // Re-creuser le PUITS (éventail) en VIDE + son habillage (un cran plus large que le rez pour la vue).
  for (let y = PY0 - 1; y <= PY1; y++) {
    const l = (y < PY0 ? Lf(PY0) : Lf(y)), r = (y < PY0 ? Rf(PY0) : Rf(y));
    fill(tiles1, l, y, r, y, 'vide');
  }
  // LOGE ROYALE (30, marbre) dans l'axe de la scène, balcon avancé au bord HAUT du puits + ANTICHAMBRE
  // DUCALE (31) derrière. Reportées au fond (rangées 3-5), face à la scène.
  fill(tiles1, 9, 5, 13, 5, 'marbre');   // balcon de la loge royale (sur le puits, face scène)
  fill(tiles1, 9, 3, 13, 4, 'marbre');   // loge royale + antichambre (marbre, prestige)

  // ── Murs de l'étage ──
  // 1) Périmètre extérieur du bâti (couloirs).
  wallRect(CL, 3, CR, 20, 1);
  // 2) Mur intérieur du couloir de service (sépare couloir et loges/puits) : porte par loge.
  //    GAUCHE : arête E de la colonne CL ; DROITE : arête W de la colonne CR.
  for (let y = PY0; y <= PY1; y++) {
    wall(CL, y, 'E', 1, (y - PY0) % 2 === 0); // une porte une rangée sur deux (entrée de chaque loge)
    wall(CR, y, 'W', 1, (y - PY0) % 2 === 0);
  }
  // 3) Refends entre loges (séparent les boxes) : du couloir au bord du puits.
  for (let y = PY0 + 1; y <= PY1; y += 2) {
    for (let x = CL + 1; x <= Lf(y) - 1; x++) wall(x, y, 'N', 1);
    for (let x = Rf(y) + 1; x <= CR - 1; x++) wall(x, y, 'N', 1);
  }
  // 4) Garde-corps des loges sur le PUITS (bord du vide) — visuel, on NE met PAS de porte (vue plongeante).
  for (let y = PY0; y <= PY1; y++) {
    wall(Lf(y) - 1, y, 'E', 1); // front de loge gauche vers le vide
    wall(Rf(y) + 1, y, 'W', 1); // front de loge droite vers le vide
  }
  // 5) GALERIE (35/37) côté foyer (rangées 18-20) : front sur le puits = garde-corps PLEIN sur la largeur
  //    du puits (x=Lf(PY1)..Rf(PY1)) au nord de la rangée 18. Les COULOIRS de service (x=CL et x=CR) NE
  //    sont PAS murés ici : ils débouchent librement dans la galerie (le visiteur monte par l'escalier,
  //    longe la galerie, gagne le couloir, puis chaque loge). Pas de porte sur le garde-corps (vue).
  for (let x = Lf(PY1); x <= Rf(PY1); x++) wall(x, 18, 'N', 1);
  // 6) ANTICHAMBRE / LOGE ROYALE (rangées 3-5) au fond : couloirs CL/CR la rejoignent par le haut
  //    (rangée 3, déjà plancher continu). Balcon royal (rangée 5) = garde-corps plein sur le puits.
  for (let x = 9; x <= 13; x++) wall(x, 5, 'N', 1); // dossier de la loge royale côté antichambre? non : front
  // Porte de l'antichambre vers le couloir (les deux extrémités du fond), pour rejoindre les loges.
  // (Le fond rangée 3 est un plancher continu CL..CR : la loge royale est donc déjà accessible des deux
  //  couloirs — on ouvre juste le passage du balcon royal rangée 5 vers la loge, au centre.)
  wall(11, 5, 'N', 1, true); // accès au balcon royal depuis la loge royale

  // ── ESCALIERS (5/9) : deux volées du FOYER (rez) vers la GALERIE (étage), sur des cases marchables aux
  //    DEUX niveaux (foyer marbre en bas, galerie plancher en haut) sinon la volée ne mène nulle part. ──
  for (const [sx, sy] of [[6, 19], [16, 19]] as const) stairs.push({ from: { x: sx, y: sy, z: 0 }, to: { x: sx, y: sy, z: 1 } });

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
    description: 'Opéra d’Altdorf — rez-de-chaussée (parterre en éventail, scène, fosse d’orchestre, salles latérales desservies par un couloir, foyer à deux escaliers) et premier étage (loges autour du puits central, galerie, loge royale dans l’axe de la scène). Géométrie reconstruite du plan officiel ; toutes les pièces sont reliées par des portes.',
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
    entryPoints: { 'entree-principale': { x: 11, y: 24 }, 'entree-artistes': { x: 21, y: 1 } },
  };
}
