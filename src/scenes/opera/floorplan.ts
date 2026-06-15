/**
 * GÉOMÉTRIE du Théâtre Staatsoper (« Une nuit à l'Opéra », NADJ) — RECONSTRUITE du plan officiel
 * (rez-de-chaussée p.40 + premier étage p.41) à l'ÉCHELLE du plan : grille DÉRIVÉE des proportions
 * réelles (bâtiment nettement plus haut que large, ratio ≈ 1:1.36 → 44×60), pas un gabarit arbitraire.
 * PUREMENT la géométrie (étages, murs, portes, élévation, vide, escaliers) : ni logique, ni casting,
 * ni dialogues (ceux-ci viendront en DONNÉE d'éditeur quand l'API Flow sera stabilisée). Construit un
 * `Scene` éditable — même esprit que le générateur d'arène (donnée, pas de scène codée en dur). S'appuie
 * sur tous les systèmes livrés : murs sur arêtes (cardinaux BLOQUANTS + portes franchissables) + quelques
 * diagonales PUREMENT VISUELLES pour la façade courbe, élévation (scène surélevée + fosse d'orchestre en
 * contrebas), multi-niveaux (parterre au sol, loges / galerie / loge royale à l'étage) + `vide` (puits
 * central ovale au-dessus du parterre) + escaliers.
 *
 * Repère : y=0 = le FOND (réserve de décors / coulisses, en haut) ; y croissant = vers le FOYER (façade,
 * en bas). La SCÈNE regarde vers le bas ; le public la regarde vers le HAUT. Symétrie autour de l'axe
 * x=21.5 (colonnes centrales 21/22).
 *
 * Correspondance avec la LÉGENDE du plan (p.40/p.41), une pièce par numéro là où elle tient :
 *   REZ : 16 Coulisses · 19 Scène · 18 Fosse d'orchestre · 17 Parterre (Orchestre) · 14 Salle verte ·
 *     15 Bureau régisseur · 11/12/13 Vestiaires des chœurs · 10 Passage · 20 Stockage décors ·
 *     21 Stockage accessoires · 22 Bureau concierge · 23 Bureau gestionnaire · 24 Rangements costumes ·
 *     25 Costumiers · 26 Charpenterie · 27 Réserve générale · 7 Salon (foyer) · 3 Escalier principal ·
 *     8/9 Escaliers · 4/5 Commodités · 6 Vestiaire/billets · 1 Porte des Dames · 2 Porte des Seigneurs ·
 *     entrée des artistes (côté coulisses).
 *   ÉTAGE : 28 Loge · 29 Loge des nobles · 30 Loge royale (axe scène, fond) · 31 Antichambre ducale ·
 *     32/34 Balcons gauche/droite · 33 Balcons centraux · 35/37 Galerie · 36/38 Bar des balcons ·
 *     39 Salon des Seigneurs.
 *
 * Toutes les pièces closes sont REJOIGNABLES : un couloir périphérique dessert les salles latérales du
 * rez et débouche sur le foyer ; le foyer ouvre sur l'auditorium ; à l'étage, un couloir de service
 * derrière les loges relie galerie → toutes les loges → loge royale & antichambre. Aucune pièce scellée.
 */
import type { Scene, Terrain, WallSeg, Level } from '../../state/scene';

const W = 44, H = 60;
const AX = (W - 1) / 2; // axe de symétrie (21.5)
const idx = (x: number, y: number) => y * W + x;
const inGrid = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;

// ── Empreinte du bâtiment : x ∈ [BX0,BX1], y ∈ [BY0,BY1] (le périmètre est mur ; la façade s'arrondit). ──
const BX0 = 1, BX1 = W - 2;   // colonnes du bâti (1..42)
const BY0 = 0, BY1 = H - 2;   // rangées du bâti (0..58), la rangée H-1 reste vide (marge de façade)

// ── Bandes verticales (y) reportées du plan p.40, du fond (scène) vers la façade (foyer). ──
const COULY0 = 1;                   // coulisses (16) derrière la scène (bande étroite y=1..STAGEY0-1)
const STAGEY0 = 3, STAGEY1 = 8;     // scène (19) surélevée — ~6 rangées
const PITY0 = 9, PITY1 = 10;        // fosse d'orchestre (18) en contrebas, bande courbe
const PY0 = 11, PY1 = 40;           // parterre (17) en éventail — 30 rangées
const FOYY = 41;                    // cloison foyer / auditorium
const FOY0 = 42, FOY1 = 55;         // foyer (7 Salon) — marbre
const FACY = 56;                    // seuil de façade (entrées), rangée courbe
const GALY1 = 47;                   // étage : la galerie (35/37) + bars + salon (39) débordent SUR le foyer
                                    //   jusqu'ici (les escaliers du foyer montent dans cette bande)

// ── Éventail du parterre : bords gauche/droit par rangée (étroit près de la scène, large vers le foyer).
//    Interpolation linéaire sur toute la hauteur du parterre → courbe lisse (30 marches). ──
const FAN_TOP_HALF = 5;   // demi-largeur près de la scène (axe ± 5 → 11 cases)
const FAN_BOT_HALF = 16;  // demi-largeur vers le foyer  (axe ± 16 → 33 cases)
const fanHalf = (y: number) => {
  const t = (y - PY0) / (PY1 - PY0);
  return Math.round(FAN_TOP_HALF + (FAN_BOT_HALF - FAN_TOP_HALF) * t);
};
const Lf = (y: number) => Math.round(AX - fanHalf(y)); // bord gauche du parterre
const Rf = (y: number) => Math.round(AX + fanHalf(y)); // bord droit du parterre

// ── Puits central ovale (étage) : demi-largeur par rangée (ellipse approchée), centré sur l'éventail
//    mais un cran plus large au milieu (galbe du vide vu d'en haut). ──
const OVAL_Y0 = PITY0, OVAL_Y1 = PY1 - 1; // le vide couvre fosse + parterre (sauf dernière rangée = galerie)
const OVAL_MID = (OVAL_Y0 + OVAL_Y1) / 2;
const OVAL_RY = (OVAL_Y1 - OVAL_Y0) / 2;
const OVAL_HALF_MAX = FAN_BOT_HALF; // demi-largeur max au milieu de l'ovale
const ovalHalf = (y: number) => {
  const t = (y - OVAL_MID) / OVAL_RY; // [-1,1]
  const w = OVAL_HALF_MAX * Math.sqrt(Math.max(0, 1 - t * t));
  return Math.max(3, Math.round(w));
};

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
  // SCÈNE SURÉLEVÉE (19) — planches, +0.4. L'élévation REND le relief ET soulève le jeton (liftAt dans
  // IsoStage soulève surlignages/profondeur AVEC, donc le jeton reste sur sa case).
  const STX0 = Math.round(AX - 9), STX1 = Math.round(AX + 9); // scène large au centre (cols 13..30)
  fill(tiles0, STX0, STAGEY0, STX1, STAGEY1, 'planches'); elevRect(STX0, STAGEY0, STX1, STAGEY1, 0.4);
  // FOSSE D'ORCHESTRE (18) EN CONTREBAS — planches, -0.4, bande courbe sous l'avant-scène.
  for (let y = PITY0; y <= PITY1; y++) {
    const half = FAN_TOP_HALF + 2 + (y - PITY0); // s'élargit vers le parterre
    fill(tiles0, Math.round(AX - half), y, Math.round(AX + half), y, 'planches');
    elevRect(Math.round(AX - half), y, Math.round(AX + half), y, -0.4);
  }
  // PARTERRE en éventail (17, parquet) — le reste de chaque rangée (dalle) = couloirs + salles latérales.
  for (let y = PY0; y <= PY1; y++) fill(tiles0, Lf(y), y, Rf(y), y, 'plancher');
  // FOYER (Salon 7) — marbre, sous le parterre + seuil d'entrée (façade).
  fill(tiles0, BX0, FOY0, BX1, FOY1, 'marbre');
  fill(tiles0, Math.round(AX - 12), FACY, Math.round(AX + 12), FACY, 'marbre');

  // ── Périmètre du bâtiment + entrées : PORTE DES DAMES (1) & PORTE DES SEIGNEURS (2) en façade,
  //    ENTRÉE DES ARTISTES (côté coulisses, à l'est). ──
  wallRect(BX0, BY0, BX1, FACY, 0);
  wall(Math.round(AX - 6), FACY, 'S', 0, true);  // Porte des Dames (1)
  wall(Math.round(AX + 6), FACY, 'S', 0, true);  // Porte des Seigneurs (2)
  wall(BX1, COULY0, 'E', 0, true);               // Entrée des artistes
  // Façade : coins avant ARRONDIS (galbe du foyer) — vide + diagonale PUREMENT VISUELLE.
  for (let x = BX0; x <= BX0 + 3; x++) { tiles0[idx(x, FACY)] = 'vide'; diag(x, FACY, '/', 0); }
  for (let x = BX1 - 3; x <= BX1; x++) { tiles0[idx(x, FACY)] = 'vide'; diag(x, FACY, '\\', 0); }

  // ── COULISSES (16) derrière la scène : ouvertes vers la scène (accès artistes), murées du reste. ──
  for (let x = STX0; x <= STX1; x++) wall(x, STAGEY0, 'N', 0, x === Math.round(AX)); // coulisses↔scène, passage central
  wall(STX0, COULY0, 'W', 0); wall(STX1, COULY0, 'E', 0, true); // ouverture latérale est = vers couloir de service

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
  for (let x = Lf(PY0); x <= Rf(PY0); x++) wall(x, PY0, 'N', 0, x === Math.round(AX));
  // Bord de la fosse côté scène (avant-scène) — la scène domine la fosse.
  for (let x = STX0; x <= STX1; x++) wall(x, PITY0, 'N', 0);

  // ── COULOIR de service PÉRIPHÉRIQUE (x=BX0 à gauche, x=BX1 à droite) desservant les SALLES LATÉRALES.
  //    Chaque salle ouvre par une PORTE sur le couloir ; le couloir débouche librement sur le foyer. ──
  const CL = BX0 + 1, CR = BX1 - 1; // murs intérieurs des salles (couloir = colonne BX0 / BX1)
  // Bandes de salles latérales par y (une pièce par numéro de légende, gauche puis droite).
  const bands = [
    [COULY0, STAGEY1],   // 14 Salle verte / 20 Stockage décors (haut, le long de la scène)
    [PITY0, PY0 + 4],    // 13 Vestiaire / 21 Stockage accessoires
    [PY0 + 5, PY0 + 11], // 12 Vestiaire / 22-23 Bureaux
    [PY0 + 12, PY0 + 18],// 11 Vestiaire / 24 Rangements costumes
    [PY0 + 19, PY0 + 24],// 10 Passage / 25 Costumiers
    [PY0 + 25, PY1],     // 15 Bureau régisseur / 26-27 Charpenterie & Réserve
  ] as const;
  for (const [y0, y1] of bands) {
    const mid = Math.floor((y0 + y1) / 2);
    // GAUCHE : pièce x=CL..Lf(y)-1, mur intérieur en x=CL (arête W) avec porte sur le couloir x=BX0.
    for (let y = y0; y <= y1; y++) if (Lf(y) - 1 >= CL) wall(CL, y, 'W', 0, y === mid);
    // DROITE : pièce x=Rf(y)+1..CR, mur intérieur en x=CR (arête E) avec porte sur le couloir x=BX1.
    for (let y = y0; y <= y1; y++) if (Rf(y) + 1 <= CR) wall(CR, y, 'E', 0, y === mid);
    // refends (séparation entre pièces consécutives) : du couloir au bord de l'éventail.
    if (y1 < PY1) {
      for (let x = CL; x <= Lf(y1 + 1) - 1; x++) wall(x, y1, 'S', 0);
      for (let x = Rf(y1 + 1) + 1; x <= CR; x++) wall(x, y1, 'S', 0);
    }
  }
  // Cloison FOYER / AUDITORIUM (rangée FOYY) : deux PORTES sous les bords de l'éventail. Les couloirs
  // périphériques (x=BX0 et x=BX1) restent OUVERTS sur le foyer (pas de mur là).
  for (let x = CL; x <= CR; x++) wall(x, FOYY, 'N', 0, x === Lf(PY1) || x === Rf(PY1));

  // ── FOYER (Salon 7) : COMMODITÉS (4) à gauche & VESTIAIRE des billets (6) à droite près de la façade ;
  //    deux ESCALIERS (3/8/9) montent à la galerie, posés sur des cases marchables aux DEUX niveaux. ──
  wallRect(BX0 + 1, FOY1 - 3, BX0 + 4, FOY1, 0, { side: 'N' });   // Commodités gauche (4)
  wallRect(BX1 - 4, FOY1 - 3, BX1 - 1, FOY1, 0, { side: 'N' });   // Vestiaire billets droite (6)
  // Cages d'escalier (3/8/9) : petites pièces ouvertes côté foyer, avec la volée à l'intérieur. La case
  // de la volée tombe dans la GALERIE de l'étage (qui déborde sur le foyer) → marchable aux 2 niveaux.
  const STAIRY = FOY0 + 1; // rangée de la volée (foyer au rez, galerie à l'étage)
  const stairX = [Math.round(AX - 8), Math.round(AX + 8)] as const;
  for (const sx of stairX) {
    wallRect(sx - 1, FOY0, sx + 1, FOY0 + 3, 0, { side: 'S' }); // cage d'escalier, porte côté foyer
    stairs.push({ from: { x: sx, y: STAIRY, z: 0 }, to: { x: sx, y: STAIRY, z: 1 } });
  }

  // ───────────────────────── PREMIER ÉTAGE (z=1) ─────────────────────────
  // PUITS CENTRAL OVALE : l'intérieur reste VIDE (ouvert sur le rez). On construit l'anneau bâti autour :
  //   couloir de service (mur extérieur), loges (sur le puits), galerie (foyer), loge royale (fond).
  // Plancher de l'étage : tout l'anneau bâti = plancher ; le PUITS (ovale) y est ensuite recreusé en vide.
  // La GALERIE (35/37) + le SALON DES SEIGNEURS (39) débordent sur le foyer (rangées PY1+1..GALY1) où
  // arrivent les escaliers — d'où l'extension jusqu'à GALY1.
  fill(tiles1, BX0, COULY0, BX1, GALY1, 'plancher'); // anneau (fond → galerie sur le foyer)
  // Recreuser le PUITS OVALE en VIDE (un cran plus large que l'éventail du rez, pour la vue plongeante).
  for (let y = OVAL_Y0; y <= OVAL_Y1; y++) {
    const half = ovalHalf(y);
    fill(tiles1, Math.round(AX - half), y, Math.round(AX + half), y, 'vide');
  }
  // GALERIE (35/37) + SALON DES SEIGNEURS (39) : tout le bas (sous le puits) = plancher continu déjà posé.
  // LOGE ROYALE (30, marbre) dans l'axe de la scène, au FOND (rangées COULY..STAGEY0), + ANTICHAMBRE (31).
  const RY0 = COULY0, RY1 = STAGEY0 - 1; // bandeau du fond, derrière le haut du puits
  fill(tiles1, Math.round(AX - 4), RY0, Math.round(AX + 4), RY1, 'marbre'); // loge royale + antichambre, axe

  // ── Murs de l'étage ──
  // 1) Périmètre extérieur du bâti (jusqu'à la galerie qui déborde sur le foyer).
  wallRect(BX0, COULY0, BX1, GALY1, 1);
  // 2) Couloirs de service derrière les loges : colonnes BX0 (gauche) & BX1 (droite). Mur intérieur
  //    (séparant couloir et loges) avec une PORTE par loge ; loges réparties sur la hauteur du puits.
  const LOGE_Y0 = OVAL_Y0 + 1, LOGE_Y1 = OVAL_Y1; // rangées où des loges bordent le puits
  for (let y = LOGE_Y0; y <= LOGE_Y1; y++) {
    wall(BX0 + 1, y, 'W', 1, (y - LOGE_Y0) % 4 === 1); // porte de loge ~1 rangée sur 4 (entrée du box)
    wall(BX1 - 1, y, 'E', 1, (y - LOGE_Y0) % 4 === 1);
  }
  // 3) Refends entre loges (séparent les boxes) : du couloir au bord du puits, tous les 4 rangs.
  for (let y = LOGE_Y0 + 3; y <= LOGE_Y1; y += 4) {
    const lo = Math.round(AX - ovalHalf(y)), hi = Math.round(AX + ovalHalf(y));
    for (let x = BX0 + 1; x <= lo - 1; x++) wall(x, y, 'N', 1);
    for (let x = hi + 1; x <= BX1 - 1; x++) wall(x, y, 'N', 1);
  }
  // 4) Garde-corps des loges sur le PUITS (bord du vide) — visuel BLOQUANT (on ne tombe pas), pas de porte.
  for (let y = OVAL_Y0; y <= OVAL_Y1; y++) {
    const lo = Math.round(AX - ovalHalf(y)), hi = Math.round(AX + ovalHalf(y));
    if (lo - 1 >= BX0) wall(lo - 1, y, 'E', 1); // front de loge gauche vers le vide
    if (hi + 1 <= BX1) wall(hi + 1, y, 'W', 1); // front de loge droite vers le vide
  }
  // 5) GALERIE (35/37) côté foyer (rangée PY1) : garde-corps PLEIN sur la largeur du puits au nord. Les
  //    couloirs de service débouchent librement dans la galerie (pas de mur là).
  {
    const lo = Math.round(AX - ovalHalf(OVAL_Y1)), hi = Math.round(AX + ovalHalf(OVAL_Y1));
    for (let x = lo; x <= hi; x++) wall(x, PY1, 'N', 1);
  }
  // 6) LOGE ROYALE / ANTICHAMBRE (fond) : cloisonnée (marbre), porte sur chaque couloir de service +
  //    accès au balcon royal (front sur le puits, rangée STAGEY0-1 ... le haut de l'ovale). Le bandeau
  //    du fond (rangées RY0..RY1) est plancher continu BX0..BX1 → la loge royale est déjà desservie par
  //    les deux couloirs ; on la cloisonne et on ouvre proprement deux portes.
  wallRect(Math.round(AX - 4), RY0, Math.round(AX + 4), RY1, 1, { side: 'W' }); // porte côté couloir gauche
  wall(Math.round(AX + 4), RY1 - 1, 'E', 1, true);                              // + porte côté couloir droit
  wall(Math.round(AX), RY1, 'S', 1, true);                                      // accès au balcon royal (puits)

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
    description: 'Opéra d’Altdorf — rez-de-chaussée (parterre en éventail, scène, fosse d’orchestre, salles latérales desservies par un couloir périphérique, foyer à deux escaliers) et premier étage (loges en anneau autour du puits central ovale, galerie, loge royale dans l’axe de la scène). Géométrie reconstruite du plan officiel à son échelle ; toutes les pièces sont reliées par des portes.',
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
