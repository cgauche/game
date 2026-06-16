/**
 * GÉOMÉTRIE du Théâtre Staatsoper (« Une nuit à l'Opéra », NADJ) — RECONSTRUITE FIDÈLEMENT du SCHÉMA DE
 * MURS autoritaire (`art-ref/opera/plan_walls_doors.png` : murs noirs, portes vertes, escaliers orange),
 * mesuré au pixel et reporté sur la grille 44×60 (le bâtiment est plus haut que large : ratio ≈ 1.36).
 * Repère : y=0 = le FOND (coulisses, derrière la scène, en HAUT du plan) ; y croissant = vers le FOYER
 * (façade, en BAS). La SCÈNE regarde vers le bas ; le public la regarde vers le HAUT. Axe x=21.5.
 *
 * STRUCTURE DU SCHÉMA (du haut vers le bas) :
 *   • périmètre rectangulaire, COINS AVANT (façade, bas) ARRONDIS (diagonales visuelles) ;
 *   • la SCÈNE = grand rectangle centré en haut (cols 13..30), surélevée (+0.4) ;
 *   • la FOSSE d'orchestre = petit rectangle centré sous la scène, en contrebas (−0.4) ;
 *   • l'AUDITORIUM (parterre) = TRAPÈZE borné par DEUX MURS DIAGONAUX LISSES (étroit en haut vers la
 *     scène, large en bas vers le foyer) — rendus par des diagonales VISUELLES `diag()` doublées d'une
 *     fermeture cardinale BLOQUANTE (marches) le long de chaque bord ;
 *   • de chaque côté une COLONNE de pièces subdivisée par des refends horizontaux (gauche = loges et
 *     vestiaires des chœurs, salle verte ; droite = ateliers, stockages, réserves + petites pièces en
 *     haut) — chaque pièce abute directement sur le mur diagonal de l'éventail ;
 *   • en bas le FOYER (Salon) avec DEUX ESCALIERS (orange) décalés vers l'intérieur + portes, puis la
 *     bande des entrées (commodités, billetterie) et la façade arrondie.
 * Les portes (vert au schéma) sont placées de façon PLAUSIBLE en GARANTISSANT la connexité (toute pièce
 * rejoignable depuis le foyer) — la position au pixel du vert n'est pas contraignante (cf. brief).
 *
 * PUREMENT la géométrie (étages, murs sur arêtes, portes, élévation, vide central, escaliers) : ni
 * logique, ni casting, ni dialogues. Construit un `Scene` éditable — donnée, pas de scène codée en dur.
 * Le QC `scripts/qc/opera-walls.mts` ré-imprime ces murs en vue du dessus schématique (style du plan).
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

// ── Bandes verticales (y) reportées du SCHÉMA (mesurées au pixel : ~21 px/rangée). ──
const TOPDIV = 4;                   // refend du fond : sépare la bande supérieure (gy≈4.5 sur le schéma)
const STAGEY0 = 5, STAGEY1 = 14;    // 19 Scène surélevée (+0.4), grand rectangle centré (gy 5..14)
const PITY0 = 15, PITY1 = 19;       // 18 Fosse d'orchestre en contrebas (−0.4), petit rect centré
const PY0 = 20, PY1 = 43;           // 17 Parterre en éventail — 24 rangées (gy 20..43)
const FOYY = 44;                    // cloison foyer / auditorium (gy≈43.6 du schéma)
const FOY0 = 45, FOY1 = 50;         // 7 Salon (foyer) — marbre (gy 45..50)
const ENT0 = 51, ENT1 = 58;         // bande des entrées (3/4/5/6/8/9) + façade
const FACY = 58;                    // seuil de façade (portes 1/2), rangée courbe
const GALY1 = 50;                   // l'étage déborde sur le foyer jusqu'ici (galerie/bars/salons)

// La SCÈNE est centrée, cols 13..30 (mesuré : bords px 373 / 836 → gx ≈ 13 / 30).
const STX0 = 13, STX1 = 30;

// ── Éventail du parterre : demi-largeur par rangée (étroit près de la scène, large vers le foyer).
//    Mesuré sur le schéma : half ≈ 6.5 en haut (gy 20), ≈ 13.5 en bas (gy 43). Interpolation linéaire
//    → deux murs DIAGONAUX LISSES (rendus diag() le long de chaque bord). ──
const FAN_TOP_HALF = 5;
const FAN_BOT_HALF = 13;
const fanHalf = (y: number) => {
  const t = (y - PY0) / (PY1 - PY0);
  return Math.round(FAN_TOP_HALF + (FAN_BOT_HALF - FAN_TOP_HALF) * t);
};
const Lf = (y: number) => Math.round(AX - fanHalf(y)); // bord gauche du parterre
const Rf = (y: number) => Math.round(AX + fanHalf(y)); // bord droit du parterre

/** Cases de SIÈGE du parterre : éventail PLEIN, de bord à bord (Lf..Rf), un rang sur deux (allée de
 *  circulation entre les rangs), allée centrale de 2 cases (axe 21.5). Source UNIQUE de la géométrie des
 *  fauteuils → le scénario y pose un `siege` 1×1 par case (cf. 22-opera-plan). DENSE comme le plan p.40. */
export function parterreSeatCells(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = PY0; y <= PY1; y += 2)
    for (let x = Lf(y); x <= Rf(y); x++) {
      if (x === 21 || x === 22) continue; // allée centrale
      out.push({ x, y });
    }
  return out;
}

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

// ── PIÈCES LATÉRALES (rez) — plages de rangées [y0,y1] par côté, du fond vers le foyer, reportées des
//    refends MESURÉS sur le schéma (gauche : refends gy≈20/24/34 ; droite : gy≈20/24/31). Le plan n'est
//    PAS symétrique. Chaque pièce occupe la bande de sa plage entre le bord du bâtiment (BX0/BX1) et le
//    mur diagonal de l'éventail. `n` = numéro de légende. `split` (optionnel) = colonne d'un refend
//    VERTICAL interne (sous-pièces de la BANDE DU HAUT, le long de la scène — cf. schéma). ──
type Room = { y0: number; y1: number; n: number; split?: number };
// Bande du HAUT (le long de la scène, gy 1..14) : à GAUCHE refend vertical gx≈6 (mesuré) → 2 colonnes
//   de pièces ; à DROITE refend vertical gx≈37 → pièce large + petites pièces NE (gérées à part).
const LEFT_ROOMS: Room[] = [
  { y0: BY0, y1: STAGEY1, n: 14, split: 6 }, // Salle verte / vestiaire (bande haute), refend vertical gx6
  { y0: PITY0, y1: 23, n: 12 },              // Vestiaires des chœurs (Féminin) — grande
  { y0: 24, y1: 33, n: 11 },                 // Vestiaires des chœurs (Masculin)
  { y0: 34, y1: PY1, n: 10 },                // Passage / Bureau du régisseur (15)
];
const RIGHT_ROOMS: Room[] = [
  { y0: BY0, y1: STAGEY1, n: 20, split: 37 }, // Stockage des décors (bande haute), refend vertical gx37
  { y0: PITY0, y1: 23, n: 24 },              // Rangements des costumes
  { y0: 24, y1: 30, n: 25 },                 // Couturières
  { y0: 31, y1: PY1, n: 26 },                // Charpenterie et décors (27 Réserve au foyer)
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
  // FOSSE D'ORCHESTRE (18) EN CONTREBAS — planches, −0.4, petit rectangle centré sous la scène.
  fill(tiles0, Math.round(AX - FAN_TOP_HALF), PITY0, Math.round(AX + FAN_TOP_HALF), PITY1, 'planches');
  elevRect(Math.round(AX - FAN_TOP_HALF), PITY0, Math.round(AX + FAN_TOP_HALF), PITY1, -0.4);
  // PARTERRE en éventail (17, parquet) — le reste de chaque rangée (dalle) = salles latérales.
  for (let y = PY0; y <= PY1; y++) fill(tiles0, Lf(y), y, Rf(y), y, 'plancher');
  // FOYER (Salon 7) — marbre, sous le parterre.
  fill(tiles0, BX0, FOY0, BX1, FOY1, 'marbre');
  // Bande des entrées (3/4/5/6/8/9) — marbre aussi.
  fill(tiles0, BX0, ENT0, BX1, FACY, 'marbre');

  // ── Périmètre du bâtiment + entrées. ──
  wallRect(BX0, BY0, BX1, FACY, 0);
  wall(Math.round(AX - 5), FACY, 'S', 0, true);   // Porte des Dames (1)
  wall(Math.round(AX + 5), FACY, 'S', 0, true);   // Porte des Seigneurs (2)
  wall(BX1, BY0, 'E', 0, true);                   // Entrée des artistes (côté fond, est)
  // Façade : coins avant ARRONDIS (galbe du foyer) — vide + diagonale PUREMENT VISUELLE.
  for (let x = BX0; x <= BX0 + 3; x++) { tiles0[idx(x, FACY)] = 'vide'; diag(x, FACY, '/', 0); }
  for (let x = BX1 - 3; x <= BX1; x++) { tiles0[idx(x, FACY)] = 'vide'; diag(x, FACY, '\\', 0); }

  // ── SCÈNE (19) : rectangle centré cloisonné. Bas de scène ouvert vers la fosse (passage central) ;
  //    portes vers les pièces latérales de part et d'autre (mesuré gy≈14.6 sur le schéma). ──
  for (let x = STX0; x <= STX1; x++) {
    wall(x, STAGEY0, 'N', 0);                       // fond de scène (vers la bande du fond)
    wall(x, STAGEY1, 'S', 0, x === STX0 + 2 || x === STX1 - 2); // bas de scène → pièces latérales (2 portes)
  }
  for (let y = STAGEY0; y <= STAGEY1; y++) { wall(STX0, y, 'W', 0); wall(STX1, y, 'E', 0); }
  wall(STX1, STAGEY0, 'E', 0, true);                // porte coin haut-droit de la scène (schéma)

  // ── ÉVENTAIL : deux MURS DIAGONAUX LISSES (diag visuelles) le long de chaque bord, DOUBLÉS d'une
  //    fermeture cardinale BLOQUANTE (murs W/E + fermeture des marches par murs N). Une PORTE par côté
  //    relie le parterre à la salle latérale, à mi-hauteur. ──
  const doorRow = Math.floor((PY0 + PY1) / 2);
  for (let y = PY0; y <= PY1; y++) {
    wall(Lf(y), y, 'W', 0, y === doorRow);
    wall(Rf(y), y, 'E', 0, y === doorRow);
    // diagonale VISUELLE lissant le bord (pose une oblique sur la case de bord)
    diag(Lf(y), y, '\\', 0);
    diag(Rf(y), y, '/', 0);
    if (y > PY0) {
      for (let x = Lf(y); x < Lf(y - 1); x++) wall(x, y, 'N', 0); // ferme la marche gauche
      for (let x = Rf(y - 1) + 1; x <= Rf(y); x++) wall(x, y, 'N', 0); // ferme la marche droite
    }
  }
  // Avant-scène : fond du parterre vers la fosse — mur plein, ouverture centrale.
  for (let x = Lf(PY0); x <= Rf(PY0); x++) wall(x, PY0, 'N', 0, x === Math.round(AX));
  // FOSSE D'ORCHESTRE : petit rectangle CLOS (le schéma le dessine ainsi), gx[AX±FAN_TOP_HALF],
  //   gy[PITY0..PITY1] — la scène le domine au nord, le parterre le regarde au sud (avant-scène).
  const pitL = Math.round(AX - FAN_TOP_HALF), pitR = Math.round(AX + FAN_TOP_HALF);
  for (let x = pitL; x <= pitR; x++) { wall(x, PITY0, 'N', 0); wall(x, PITY1, 'S', 0, x === Math.round(AX)); }
  for (let y = PITY0; y <= PITY1; y++) { wall(pitL, y, 'W', 0); wall(pitR, y, 'E', 0); }

  // ── PIÈCES LATÉRALES : chaque pièce abute sur le mur diagonal de l'éventail (pas de couloir de
  //    service). Refends horizontaux entre pièces ; refend vertical interne optionnel (`split`). Les
  //    portes forment une CHAÎNE VERTICALE (pièce ↔ pièce suivante) débouchant sur le foyer → connexité. ──
  const sideRoom = (rooms: Room[], left: boolean) => {
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      // refend bas (séparation avec la pièce suivante), du bord du bâtiment au bord de l'éventail —
      // avec une PORTE (chaîne verticale) sauf au dernier refend (qui donnera sur le foyer plus bas).
      if (r.y1 < PY1) {
        const yNext = r.y1 + 1;
        const lo = left ? BX0 : Rf(yNext) + 1;
        const hi = left ? Lf(yNext) - 1 : BX1;
        const door = left ? BX0 + 2 : BX1 - 2; // porte de chaîne près du mur extérieur
        for (let x = lo; x <= hi; x++) wall(x, r.y1, 'S', 0, x === door);
      }
      // refend VERTICAL interne (sous-pièces du fond) avec une porte.
      if (r.split !== undefined) {
        const sx = r.split;
        const mid = Math.floor((r.y0 + r.y1) / 2);
        for (let y = r.y0; y <= r.y1; y++) {
          const inRoom = left ? sx < Lf(Math.max(y, PY0)) : sx > Rf(Math.max(y, PY0));
          // dans la bande haute (au-dessus du parterre), la pièce s'étend jusqu'au bord de la scène/fond
          const inTop = y < PY0;
          if (inRoom || inTop) wall(sx, y, 'E', 0, y === mid);
        }
      }
    }
  };
  sideRoom(LEFT_ROOMS, true);
  sideRoom(RIGHT_ROOMS, false);

  // Petites PIÈCES en HAUT-GAUCHE / HAUT-DROITE (sous-pièces de la bande du fond, mesurées au schéma).
  // NW (gx 1..6) : refend horizontal gy≈4 → petite pièce du coin (porte vers la pièce du dessous).
  for (let x = BX0; x <= 5; x++) wall(x, TOPDIV, 'S', 0, x === BX0 + 2);
  // NE : la colonne gx 37..42 (séparée du stockage par le refend `split` gx37) porte 2 petites pièces
  //   empilées (22 Bureau du concierge / 23 gestionnaire) — refend horizontal gy≈9, portes vers gx37.
  const neDiv = STAGEY0 + 4; // gy≈9
  for (let x = 37; x <= BX1; x++) wall(x, neDiv, 'S', 0, x === 38);
  wall(37, STAGEY0 + 2, 'E', 0, true);  // porte de la petite pièce NE haute
  wall(37, neDiv + 3, 'E', 0, true);    // porte de la petite pièce NE basse

  // Cloison FOYER / AUDITORIUM (rangée FOYY) : portes sous les bords de l'éventail + sous les chaînes
  //   latérales → le foyer relie tout. Les salles latérales débouchent par leur dernier refend ici.
  for (let x = BX0; x <= BX1; x++) {
    const isFanEdge = x === Lf(PY1) || x === Rf(PY1);
    const isSideDoor = x === BX0 + 2 || x === BX1 - 2;
    wall(x, FOYY, 'N', 0, isFanEdge || isSideDoor);
  }
  // BLOC CENTRAL DU FOYER (mesuré gx≈13 / 30, verticaux forts dans tout le foyer) : le grand hall de
  //   marbre est borné par deux murs verticaux prolongeant le central block ; les zones d'escalier (8/9)
  //   sont à l'extérieur. Une PORTE par côté relie le hall central aux côtés (escaliers + sorties).
  const foyDoorY = FOY0 + 2;
  for (let y = FOY0; y <= FOY1; y++) {
    wall(STX0, y, 'W', 0, y === foyDoorY); // mur ouest du hall central (gx13)
    wall(STX1, y, 'E', 0, y === foyDoorY); // mur est du hall central (gx30)
  }

  // ── FOYER (7) : DEUX ESCALIERS (8/9, orange au schéma) décalés vers l'intérieur (mesuré gx≈7.5 / 34.5,
  //    gy≈47..50). Chaque escalier = cage 3 cases de large montant à l'étage, ouverte côté foyer (accès
  //    depuis le marbre). Ce sont les SEULS escaliers visibles du schéma (pas de grand escalier orange). ──
  const stairBoxX = [7, 35] as const; // colonne centrale de chaque cage (gauche / droite)
  for (const sx of stairBoxX) {
    wallRect(sx - 1, FOY0 + 1, sx + 1, FOY0 + 3, 0);   // cage (ouverte côté foyer : porte au nord)
    wall(sx, FOY0 + 1, 'N', 0, true);                  // accès depuis le foyer
    for (let dx = -1; dx <= 1; dx++)
      stairs.push({ from: { x: sx + dx, y: FOY0 + 2, z: 0 }, to: { x: sx + dx, y: FOY0 + 2, z: 1 } });
  }

  // 4 COMMODITÉS DES DAMES / 5 COMMODITÉS DES SEIGNEURS (bande des entrées, de part et d'autre du seuil).
  const cdL = Math.round(AX - 5), cdR = Math.round(AX + 5); // de part et d'autre du seuil central
  wallRect(cdL - 4, ENT0, cdL - 1, ENT0 + 2, 0, { side: 'N' });
  wallRect(cdR + 1, ENT0, cdR + 4, ENT0 + 2, 0, { side: 'N' });
  // 6 VESTIAIRE ET VENTE DES BILLETS (coins de la façade, sous les escaliers d'angle).
  wallRect(BX0 + 1, FACY - 2, BX0 + 3, FACY, 0, { side: 'N' });
  wallRect(BX1 - 3, FACY - 2, BX1 - 1, FACY, 0, { side: 'N' });

  // ───────────────────────── PREMIER ÉTAGE (z=1) ─────────────────────────
  // PUITS CENTRAL OVALE : intérieur VIDE (ouvert sur le rez). Anneau bâti autour : couloir de service
  // (mur extérieur), loges (sur le puits), galerie (foyer), loge royale (fond).
  fill(tiles1, BX0, BY0, BX1, GALY1, 'plancher'); // anneau (fond → galerie sur le foyer)
  // Recreuser le PUITS OVALE en VIDE (un cran plus large que l'éventail du rez, vue plongeante).
  for (let y = OVAL_Y0; y <= OVAL_Y1; y++) {
    const half = ovalHalf(y);
    fill(tiles1, Math.round(AX - half), y, Math.round(AX + half), y, 'vide');
  }
  // LOGE ROYALE (30, marbre) dans l'axe de la scène, au FOND (rangées du fond), + ANTICHAMBRE (31).
  const RY0 = BY0, RY1 = STAGEY0 - 1;
  fill(tiles1, Math.round(AX - 4), RY0, Math.round(AX + 4), RY1, 'marbre');

  // ── Murs de l'étage ──
  // 1) Périmètre extérieur du bâti (jusqu'à la galerie qui déborde sur le foyer).
  wallRect(BX0, BY0, BX1, GALY1, 1);
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
    description: 'Opéra d’Altdorf — rez-de-chaussée (parterre en éventail à murs diagonaux, scène surélevée, fosse d’orchestre, salles latérales en colonnes subdivisées, foyer à grand escalier central et escaliers d’angle) et premier étage (loges en anneau autour du puits central ovale, galerie, loge royale dans l’axe de la scène). Géométrie reconstruite du schéma de murs officiel ; toutes les pièces sont reliées par des portes.',
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
    entryPoints: { 'entree-principale': { x: Math.round(AX), y: FACY }, 'entree-artistes': { x: BX1, y: BY0 } },
  };
}
