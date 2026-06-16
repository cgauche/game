/**
 * GÉOMÉTRIE du Théâtre Staatsoper (« Une nuit à l'Opéra », NADJ) — RECONSTRUITE FIDÈLEMENT du plan
 * officiel (rez-de-chaussée p.40 + premier étage p.41), à l'échelle du plan. Grille 44×60 (le bâtiment
 * est nettement plus haut que large : ratio mesuré sur le plan ≈ 1.36). Repère : y=0 = le FOND
 * (coulisses, derrière la scène, en HAUT du plan) ; y croissant = vers le FOYER (façade, en BAS).
 * La SCÈNE regarde vers le bas ; le public la regarde vers le HAUT. Axe de symétrie x=21.5.
 *
 * MÉTHODE D'AUTORING (comparable au plan) : la carte est décrite par des TABLES DE DONNÉES lisibles —
 *   • bandes verticales (y) du centre : coulisses → scène → fosse → parterre → foyer → entrées ;
 *   • demi-largeurs du parterre PAR RANGÉE (l'éventail courbe du plan, interpolé) ;
 *   • pièces latérales GAUCHE et DROITE indépendantes (le plan n'est PAS symétrique : à gauche les
 *     grandes loges/vestiaires des chœurs, à droite les ateliers et réserves) — chacune = une plage de
 *     rangées [y0,y1] + numéro de légende ;
 *   • foyer (escaliers, commodités, vestiaire-billets, passages, portes d'entrée).
 * Le dump `scripts/qc/dump-opera-ascii.mts` ré-imprime cette géométrie en box-drawing pour la comparer
 * directement au plan.
 *
 * PUREMENT la géométrie (étages, murs sur arêtes, portes, élévation, vide central, escaliers) : ni
 * logique, ni casting, ni dialogues. Construit un `Scene` éditable — donnée, pas de scène codée en dur.
 *
 * Correspondance avec la LÉGENDE du plan (p.40/p.41) :
 *   REZ : 1 Porte des Dames · 2 Porte des Seigneurs · 3 Escalier principal · 4 Commodités des Dames ·
 *     5 Commodités des Seigneurs · 6 Vestiaire et vente des billets · 7 Salon (foyer) · 8 Escalier des
 *     Dames · 9 Escalier des Seigneurs · 10 Passage · 11 Vestiaires des chœurs (Masculin) · 12 Vestiaires
 *     des chœurs (Féminin) · 13 Vestiaire · 14 Salle verte · 15 Bureau du régisseur · 16 Coulisses ·
 *     17 Orchestre (parterre) · 18 Fosse d'orchestre · 19 Scène · 20 Stockage des décors · 21 Stockage
 *     des accessoires · 22 Bureau du concierge · 23 Bureau du gestionnaire des accessoires · 24
 *     Rangements des costumes · 25 Couturières · 26 Charpenterie et décors · 27 Réserve générale.
 *   ÉTAGE : 28 Loge · 29 Loge des nobles · 30 Loge royale (axe scène, fond) · 31 Antichambre ducale ·
 *     32 Balcons de gauche · 33 Balcons centraux · 34 Balcons de droite · 35/37 Galerie · 36 Bar des
 *     balcons · 38 Salon des Dames (coin gauche, escalier 8) · 39 Salon des Seigneurs (coin droit, escalier 9).
 */
import type { Scene, Terrain, WallSeg, Level } from '../../state/scene';

const W = 44, H = 60;
const AX = (W - 1) / 2; // axe de symétrie (21.5)
const idx = (x: number, y: number) => y * W + x;
const inGrid = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;

// ── Empreinte du bâtiment : x ∈ [BX0,BX1], y ∈ [BY0,BY1]. Le périmètre est mur ; la façade s'arrondit. ──
const BX0 = 1, BX1 = W - 2;   // colonnes du bâti (1..42)
const BY0 = 1, BY1 = H - 2;   // rangées du bâti (1..58)
const CLx = BX0 + 1;          // couloir/cloison intérieure gauche (les pièces commencent à CLx)
const CRx = BX1 - 1;          // couloir/cloison intérieure droite

// ── Bandes verticales (y) reportées du plan p.40 (mesurées : ~18 px/rangée sur le plan). ──
const COULY0 = 1, COULY1 = 4;       // 16 Coulisses : bande derrière la scène
const STAGEY0 = 5, STAGEY1 = 13;    // 19 Scène surélevée (+0.4) — large, ~9 rangées
const PITY0 = 14, PITY1 = 16;       // 18 Fosse d'orchestre en contrebas (−0.4), bande courbe
const PY0 = 17, PY1 = 44;           // 17 Parterre en éventail — 28 rangées
const FOYY = 45;                    // cloison foyer / auditorium
const FOY0 = 46, FOY1 = 52;         // 7 Salon (foyer) — marbre
const ENT0 = 53, ENT1 = 58;         // bande des entrées (3/4/5/6/8/9) + façade
const FACY = 58;                    // seuil de façade (portes 1/2), rangée courbe
// L'étage déborde sur le foyer jusqu'ici (galerie/bars/salons + arrivées d'escalier).
const GALY1 = 52;

// ── Éventail du parterre : demi-largeur par rangée (étroit près de la scène, large vers le foyer).
//    Interpolation linéaire sur toute la hauteur → courbe lisse. Mesuré sur le plan : ~half 6 en haut,
//    ~half 12 en bas (le parterre occupe la moitié centrale de la largeur du bâtiment). ──
const FAN_TOP_HALF = 6;
const FAN_BOT_HALF = 12;
const fanHalf = (y: number) => {
  const t = (y - PY0) / (PY1 - PY0);
  return Math.round(FAN_TOP_HALF + (FAN_BOT_HALF - FAN_TOP_HALF) * t);
};
const Lf = (y: number) => Math.round(AX - fanHalf(y)); // bord gauche du parterre
const Rf = (y: number) => Math.round(AX + fanHalf(y)); // bord droit du parterre

/** Cases de SIÈGE du parterre : éventail PLEIN, de bord à bord (Lf..Rf), un rang sur deux (allée de
 *  circulation entre les rangs), allée centrale de 2 cases (axe 21.5). Source UNIQUE de la géométrie des
 *  fauteuils → le scénario y pose un `siege` 1×1 par case (cf. 22-opera-plan). DENSE comme le plan p.40
 *  (≈14 rangs pleins), au lieu de quelques sièges épars avec un grand vide central. */
export function parterreSeatCells(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = PY0; y <= PY1; y += 2)
    for (let x = Lf(y); x <= Rf(y); x++) {
      if (x === 21 || x === 22) continue; // allée centrale
      out.push({ x, y });
    }
  return out;
}

// La scène est un peu plus large que le sommet de l'éventail (avant-scène). Mesuré cols ~11..32.
const STX0 = 11, STX1 = 32;

// ── Puits central ovale (étage) : demi-largeur par rangée (ellipse approchée), un cran plus large que
//    l'éventail au milieu (galbe vu d'en haut). Couvre fosse + parterre (sauf dernière rangée = galerie). ──
const OVAL_Y0 = PITY0, OVAL_Y1 = PY1 - 1;
const OVAL_MID = (OVAL_Y0 + OVAL_Y1) / 2;
const OVAL_RY = (OVAL_Y1 - OVAL_Y0) / 2;
const OVAL_HALF_MAX = FAN_BOT_HALF;
const ovalHalf = (y: number) => {
  const t = (y - OVAL_MID) / OVAL_RY; // [-1,1]
  const w = OVAL_HALF_MAX * Math.sqrt(Math.max(0, 1 - t * t));
  return Math.max(3, Math.round(w));
};

// ── PIÈCES LATÉRALES (rez) — plages de rangées [y0,y1] par côté, du fond vers le foyer. Le plan n'est
//    PAS symétrique : à GAUCHE les vestiaires/loges des chœurs et la salle verte ; à DROITE les ateliers,
//    stockages et réserves. Chaque pièce occupe la bande de sa plage entre le couloir (CLx/CRx) et le bord
//    de l'éventail. Les petits bureaux (22/23) sont des sous-pièces (coin haut/intérieur). ──
type Room = { y0: number; y1: number; n: number };
const LEFT_ROOMS: Room[] = [
  { y0: COULY0, y1: 12, n: 14 },   // Salle verte (grande, le long de scène+coulisses)
  { y0: 13, y1: 18, n: 13 },       // Vestiaire
  { y0: 19, y1: 30, n: 12 },       // Vestiaires des chœurs (Féminin) — grande
  { y0: 31, y1: 38, n: 11 },       // Vestiaires des chœurs (Masculin)
  { y0: 39, y1: 44, n: 10 },       // Passage
];
const RIGHT_ROOMS: Room[] = [
  { y0: COULY0, y1: 12, n: 20 },   // Stockage des décors (grande, haut)
  { y0: 13, y1: 19, n: 21 },       // Stockage des accessoires
  { y0: 20, y1: 29, n: 24 },       // Rangements des costumes
  { y0: 30, y1: 35, n: 25 },       // Couturières
  { y0: 36, y1: 42, n: 26 },       // Charpenterie et décors
  { y0: 43, y1: 50, n: 27 },       // Réserve générale
];

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
  // Empreinte du BÂTIMENT = dalle de base (les pièces la spécialisent ensuite).
  fill(tiles0, BX0, BY0, BX1, BY1, 'dalle');
  // SCÈNE SURÉLEVÉE (19) — planches, +0.4 (rend le relief et soulève le jeton).
  fill(tiles0, STX0, STAGEY0, STX1, STAGEY1, 'planches'); elevRect(STX0, STAGEY0, STX1, STAGEY1, 0.4);
  // FOSSE D'ORCHESTRE (18) EN CONTREBAS — planches, −0.4, bande courbe sous l'avant-scène.
  for (let y = PITY0; y <= PITY1; y++) {
    const half = FAN_TOP_HALF + 1 + (y - PITY0); // s'élargit vers le parterre
    fill(tiles0, Math.round(AX - half), y, Math.round(AX + half), y, 'planches');
    elevRect(Math.round(AX - half), y, Math.round(AX + half), y, -0.4);
  }
  // PARTERRE en éventail (17, parquet) — le reste de chaque rangée (dalle) = couloirs + salles latérales.
  for (let y = PY0; y <= PY1; y++) fill(tiles0, Lf(y), y, Rf(y), y, 'plancher');
  // FOYER (Salon 7) — marbre, sous le parterre.
  fill(tiles0, BX0, FOY0, BX1, FOY1, 'marbre');
  // Bande des entrées (3/4/5/6/8/9) — marbre aussi.
  fill(tiles0, BX0, ENT0, BX1, FACY, 'marbre');

  // ── Périmètre du bâtiment + entrées. ──
  wallRect(BX0, BY0, BX1, FACY, 0);
  wall(Math.round(AX - 5), FACY, 'S', 0, true);   // Porte des Dames (1)
  wall(Math.round(AX + 5), FACY, 'S', 0, true);   // Porte des Seigneurs (2)
  wall(BX1, COULY0, 'E', 0, true);                // Entrée des artistes (côté coulisses, est)
  // Façade : coins avant ARRONDIS (galbe du foyer) — vide + diagonale PUREMENT VISUELLE.
  for (let x = BX0; x <= BX0 + 3; x++) { tiles0[idx(x, FACY)] = 'vide'; diag(x, FACY, '/', 0); }
  for (let x = BX1 - 3; x <= BX1; x++) { tiles0[idx(x, FACY)] = 'vide'; diag(x, FACY, '\\', 0); }

  // ── COULISSES (16) derrière la scène : ouvertes vers la scène (passage central des artistes),
  //    desservies par les couloirs latéraux. ──
  for (let x = STX0; x <= STX1; x++) wall(x, STAGEY0, 'N', 0, x === Math.round(AX)); // coulisses↔scène
  wall(STX0 - 1, COULY1, 'S', 0); wall(STX1 + 1, COULY1, 'S', 0); // séparation coulisses/pièces du fond

  // ── Côtés de l'ÉVENTAIL : cloison BLOQUANTE parterre↔salles latérales (murs cardinaux W/E + fermeture
  //    des MARCHES par des murs N). Une PORTE par côté relie le parterre au couloir, à mi-hauteur. ──
  const doorRow = Math.floor((PY0 + PY1) / 2);
  for (let y = PY0; y <= PY1; y++) {
    wall(Lf(y), y, 'W', 0, y === doorRow);
    wall(Rf(y), y, 'E', 0, y === doorRow);
    if (y > PY0) {
      for (let x = Lf(y); x < Lf(y - 1); x++) wall(x, y, 'N', 0); // ferme la marche gauche
      for (let x = Rf(y - 1) + 1; x <= Rf(y); x++) wall(x, y, 'N', 0); // ferme la marche droite
    }
  }
  // Avant-scène : fond du parterre vers la fosse — mur plein, ouverture centrale.
  for (let x = Lf(PY0); x <= Rf(PY0); x++) wall(x, PY0, 'N', 0, x === Math.round(AX));
  // Bord de la fosse côté scène (avant-scène) — la scène domine la fosse.
  for (let x = STX0; x <= STX1; x++) wall(x, PITY0, 'N', 0);

  // ── PIÈCES LATÉRALES desservies par un COULOIR de service périphérique (x=BX0 gauche / BX1 droite) :
  //    chaque pièce ouvre par une PORTE sur le couloir ; le couloir débouche sur le foyer. Les cloisons
  //    intérieures sont en CLx / CRx (le couloir = la colonne du bord). ──
  const sideRoom = (rooms: Room[], left: boolean) => {
    const innerX = left ? CLx : CRx; // arête côté éventail (W à gauche, E à droite) avec porte
    const side: Side4 = left ? 'W' : 'E';
    for (const r of rooms) {
      // la porte de la pièce sur le couloir : à mi-hauteur, MAIS bornée à l'extent réel (≤ PY1) — une
      // pièce qui descend jusqu'au foyer (réserve 27) garde sa porte au-dessus de la cloison du foyer.
      const ylo = r.y0, yhi = Math.min(r.y1, PY1);
      const mid = Math.floor((ylo + yhi) / 2);
      for (let y = r.y0; y <= r.y1; y++) {
        // la pièce existe seulement là où il reste de la place entre le couloir et l'éventail/foyer central
        const edge = left ? Lf(y) - 1 : Rf(y) + 1;
        const hasRoom = left ? edge >= innerX : edge <= innerX;
        if (hasRoom) wall(innerX, y, side, 0, y === mid);
      }
      // refend (séparation avec la pièce suivante) : du couloir au bord de l'éventail.
      if (r.y1 < PY1) {
        const lo = left ? innerX : Rf(r.y1 + 1) + 1;
        const hi = left ? Lf(r.y1 + 1) - 1 : innerX;
        for (let x = lo; x <= hi; x++) wall(x, r.y1, 'S', 0);
      }
    }
  };
  sideRoom(LEFT_ROOMS, true);
  sideRoom(RIGHT_ROOMS, false);

  // Petits BUREAUX (22 concierge / 23 gestionnaire) : sous-pièces dans le coin du stockage droit, contre
  //   le couloir (porte sur le couloir), séparées du gros stockage par un refend. Cf. plan p.40 (NE).
  wallRect(CRx - 2, 13, CRx, 15, 0, { side: 'E' });    // 22 Bureau du concierge (haut)
  wallRect(CRx - 2, 20, CRx, 22, 0, { side: 'E' });    // 23 Bureau du gestionnaire des accessoires

  // Cloison FOYER / AUDITORIUM (rangée FOYY) : deux PORTES sous les bords de l'éventail. Les couloirs
  // périphériques restent OUVERTS sur le foyer.
  for (let x = CLx; x <= CRx; x++) wall(x, FOYY, 'N', 0, x === Lf(PY1) || x === Rf(PY1));

  // ── FOYER (7) → bande des ENTRÉES (rangées ENT0..FACY) : escalier principal au centre, escaliers des
  //    Dames/Seigneurs dans les coins, commodités encadrant le grand escalier, vestiaire-billets, passages. ──
  // 3 ESCALIER PRINCIPAL (grand escalier central, large) : volée au bas du foyer (rangées FOY1-1..FOY1),
  //   montant vers la galerie de l'étage. Les cases d'escalier doivent être marchables AUX DEUX niveaux →
  //   on les pose dans le foyer (marbre au rez, galerie/plancher à l'étage), pas dans la bande des entrées.
  const mainX0 = Math.round(AX - 5), mainX1 = Math.round(AX + 5);
  for (let x = mainX0; x <= mainX1; x++) stairs.push({ from: { x, y: FOY1, z: 0 }, to: { x, y: FOY1, z: 1 } });
  // 8 ESCALIER DES DAMES (coin gauche) / 9 ESCALIER DES SEIGNEURS (coin droit) : cages tournantes vers l'étage.
  const stairCornerX = [BX0 + 2, BX1 - 2] as const;
  for (const sx of stairCornerX) {
    wallRect(sx - 1, FOY1 - 2, sx + 1, FOY1, 0); // cage d'escalier (ouverte côté foyer par défaut : pas de porte)
    wall(sx, FOY1 - 2, 'N', 0, true); // accès depuis le foyer
    stairs.push({ from: { x: sx, y: FOY1, z: 0 }, to: { x: sx, y: FOY1, z: 1 } });
  }
  // 4 COMMODITÉS DES DAMES / 5 COMMODITÉS DES SEIGNEURS (bande des entrées, de part et d'autre du seuil).
  wallRect(mainX0 - 4, ENT0, mainX0 - 1, ENT0 + 2, 0, { side: 'N' });
  wallRect(mainX1 + 1, ENT0, mainX1 + 4, ENT0 + 2, 0, { side: 'N' });
  // 6 VESTIAIRE ET VENTE DES BILLETS (coins de la façade, sous les escaliers d'angle).
  wallRect(BX0 + 1, FACY - 2, BX0 + 3, FACY, 0, { side: 'N' });
  wallRect(BX1 - 3, FACY - 2, BX1 - 1, FACY, 0, { side: 'N' });

  // ───────────────────────── PREMIER ÉTAGE (z=1) ─────────────────────────
  // PUITS CENTRAL OVALE : intérieur VIDE (ouvert sur le rez). Anneau bâti autour : couloir de service
  // (mur extérieur), loges (sur le puits), galerie (foyer), loge royale (fond).
  fill(tiles1, BX0, COULY0, BX1, GALY1, 'plancher'); // anneau (fond → galerie sur le foyer)
  // Recreuser le PUITS OVALE en VIDE (un cran plus large que l'éventail du rez, vue plongeante).
  for (let y = OVAL_Y0; y <= OVAL_Y1; y++) {
    const half = ovalHalf(y);
    fill(tiles1, Math.round(AX - half), y, Math.round(AX + half), y, 'vide');
  }
  // LOGE ROYALE (30, marbre) dans l'axe de la scène, au FOND (rangées du fond), + ANTICHAMBRE (31).
  const RY0 = COULY0, RY1 = STAGEY0 - 1;
  fill(tiles1, Math.round(AX - 4), RY0, Math.round(AX + 4), RY1, 'marbre');

  // ── Murs de l'étage ──
  // 1) Périmètre extérieur du bâti (jusqu'à la galerie qui déborde sur le foyer).
  wallRect(BX0, COULY0, BX1, GALY1, 1);
  // 2) Couloirs de service derrière les loges (colonnes BX0/BX1) : mur intérieur (couloir↔loges) avec une
  //    PORTE par loge ; loges réparties sur la hauteur du puits.
  const LOGE_Y0 = OVAL_Y0 + 1, LOGE_Y1 = OVAL_Y1;
  for (let y = LOGE_Y0; y <= LOGE_Y1; y++) {
    wall(BX0 + 1, y, 'W', 1, (y - LOGE_Y0) % 4 === 1);
    wall(BX1 - 1, y, 'E', 1, (y - LOGE_Y0) % 4 === 1);
  }
  // 3) Refends entre loges (séparent les boxes), tous les 4 rangs.
  for (let y = LOGE_Y0 + 3; y <= LOGE_Y1; y += 4) {
    const lo = Math.round(AX - ovalHalf(y)), hi = Math.round(AX + ovalHalf(y));
    for (let x = BX0 + 1; x <= lo - 1; x++) wall(x, y, 'N', 1);
    for (let x = hi + 1; x <= BX1 - 1; x++) wall(x, y, 'N', 1);
  }
  // 4) Garde-corps des loges sur le PUITS (bord du vide) — visuel BLOQUANT (on ne tombe pas), pas de porte.
  for (let y = OVAL_Y0; y <= OVAL_Y1; y++) {
    const lo = Math.round(AX - ovalHalf(y)), hi = Math.round(AX + ovalHalf(y));
    if (lo - 1 >= BX0) wall(lo - 1, y, 'E', 1);
    if (hi + 1 <= BX1) wall(hi + 1, y, 'W', 1);
  }
  // 5) GALERIE (35/37) côté foyer (rangée PY1) : garde-corps PLEIN sur la largeur du puits au nord.
  {
    const lo = Math.round(AX - ovalHalf(OVAL_Y1)), hi = Math.round(AX + ovalHalf(OVAL_Y1));
    for (let x = lo; x <= hi; x++) wall(x, PY1, 'N', 1);
  }
  // 6) LOGE ROYALE / ANTICHAMBRE (fond) : cloisonnée (marbre), portes sur chaque couloir + accès balcon royal.
  wallRect(Math.round(AX - 4), RY0, Math.round(AX + 4), RY1, 1, { side: 'W' });
  wall(Math.round(AX + 4), RY1 - 1, 'E', 1, true);
  wall(Math.round(AX), RY1, 'S', 1, true);

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
    description: 'Opéra d’Altdorf — rez-de-chaussée (parterre en éventail, scène surélevée, fosse d’orchestre, salles latérales desservies par des couloirs de service, foyer à grand escalier central et escaliers d’angle) et premier étage (loges en anneau autour du puits central ovale, galerie, loge royale dans l’axe de la scène). Géométrie reconstruite du plan officiel p.40/p.41 ; toutes les pièces sont reliées par des portes.',
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
    entryPoints: { 'entree-principale': { x: Math.round(AX), y: FACY }, 'entree-artistes': { x: BX1, y: COULY0 } },
  };
}
