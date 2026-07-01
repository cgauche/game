/**
 * Théâtre Staatsoper — la carte est GÉNÉRÉE DEPUIS L'ASCII (`floorplan.ascii.ts`, source ÉDITABLE) :
 * `parseWalledAscii` lit le sol + les murs cardinaux + les portes des deux étages ; le code ne rajoute
 * que ce que l'ASCII ne porte pas — l'ÉLÉVATION MÉTRIQUE (scène `S` +1 m / fosse `s` −1 m) et les 2 RAMPES
 * d'angle (couche surélevée des loges à 4 m, rejointe par des cases de hauteur croissante — AUCUN escalier).
 * Le puits central de l'étage est déjà du `vide` (espaces) dans l'ASCII. Éditer la carte = éditer
 * `floorplan.ascii.ts` (régénérable depuis l'ancienne géométrie via `scripts/qc/gen-opera-ascii.mts`).
 * NB : les diagonales VISUELLES de lissage de l'éventail ne sont pas (encore) ré-appliquées — l'éventail
 * suit les murs cardinaux de l'ASCII (en marches).
 */
import type { Scene, Terrain, WallSeg, Layer } from '../../state/scene';
import { parseWalledAscii } from '../../state/asciiMap';
import { REZ_ASCII, ETAGE_ASCII } from './floorplan.ascii';

const W = 44, H = 60;
const AX = (W - 1) / 2;        // axe de symétrie (21.5)
const BX1 = W - 2;             // dernière colonne du bâti
const FACY = 58;              // seuil de façade (entrée principale)
const FOY0 = 45;             // 1re rangée du foyer (les rampes montent ici)

/** Hauteur métrique de l'ÉTAGE (loges/galeries) — un plein niveau (`METRES_PER_LEVEL`) : la couche 1 se
 *  rend ainsi soulevée d'exactement un `LEVEL_H` à l'écran (aspect d'origine), et les rampes la rejoignent. */
const ETAGE_M = 4;

/** Légende des cases de l'ASCII (cf. floorplan.ascii.ts). base = `vide` (espace = hors-bâtiment / puits). */
const LEGEND: Record<string, Terrain> = { ',': 'dalle', P: 'plancher', M: 'marbre', S: 'planches', s: 'planches' };

/** Découpe une chaîne ASCII (template) en lignes de grille, recomplétées à la largeur 2W+1 (les espaces
 *  de fin ont été retirés à la génération pour la lisibilité ; on les remet pour le parseur). */
function rowsOf(ascii: string): string[] {
  return ascii.split('\n').slice(1, -1).map((r) => r.padEnd(2 * W + 1, ' '));
}

const idx = (x: number, y: number) => y * W + x;

/** Colonnes des 2 CAGES DE RAMPE (angles du foyer, anciens escaliers du plan NADJ) : un puits 3 cases de
 *  large où la couche 1 (galerie) est PERCÉE et la couche 0 monte 0→4 m pour rejoindre la galerie. */
const RAMP_X: [number, number][] = [[6, 8], [35, 37]];
const inRampShaft = (x: number, y: number): boolean => y >= FOY0 && y <= FOY0 + 5 && RAMP_X.some(([a, b]) => x >= a && x <= b);

/** Élévation MÉTRIQUE de la couche 0, dérivée des cases ASCII : `S` (scène) = +1 m, `s` (fosse) = −1 m
 *  (Δ1 ⇒ rampe douce franchissable depuis le parterre). PLUS la RAMPE d'angle (rangées FOY0+1..FOY0+4
 *  montant 1→4 m) qui rejoint la galerie (couche 1, 4 m). */
function rezHeights(rows: string[]): number[] {
  const h = new Array(W * H).fill(0) as number[];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[2 * y + 1]?.[2 * x + 1];
      if (ch === 'S') h[idx(x, y)] = 1;        // scène surélevée +1 m
      else if (ch === 's') h[idx(x, y)] = -1;  // fosse d'orchestre −1 m
    }
  // Rampes : la rangée la plus proche de la galerie (FOY0+1) atteint 4 m, on descend de 1 m/rangée.
  for (const [a, b] of RAMP_X)
    for (let x = a; x <= b; x++)
      for (let dy = 1; dy <= 4; dy++) h[idx(x, FOY0 + dy)] = 5 - dy; // FOY0+1→4 m … FOY0+4→1 m
  return h;
}

/** Cases de SIÈGE du parterre, DÉRIVÉES de l'ASCII : toute case `plancher` (P), un rang sur deux (allée
 *  de circulation entre les rangs), fine allée centrale de 2 cases (axe 21.5). Source unique → le scénario
 *  pose un `siege` 1×1 par case (cf. 22-opera-plan). Éditer l'éventail dans l'ASCII met les sièges à jour. */
export function parterreSeatCells(): { x: number; y: number }[] {
  const rows = rowsOf(REZ_ASCII);
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++) {
    if (y % 2 !== 0) continue; // un rang sur deux
    for (let x = 0; x < W; x++) {
      if (x === 21 || x === 22) continue; // allée centrale
      if (rows[2 * y + 1]?.[2 * x + 1] === 'P') out.push({ x, y });
    }
  }
  return out;
}

/** Le Théâtre Staatsoper en DONNÉE, GÉNÉRÉ depuis l'ASCII (`floorplan.ascii.ts`). */
export function buildOperaFloorplan(): Scene {
  const rezRows = rowsOf(REZ_ASCII);
  const etageRows = rowsOf(ETAGE_ASCII);
  const rez = parseWalledAscii(rezRows, 'vide', LEGEND);
  const etage = parseWalledAscii(etageRows, 'vide', LEGEND);

  // Cages de RAMPE : on PERCE la galerie (couche 1) au-dessus du puits de rampe (rangées FOY0+1..FOY0+4 →
  // 'vide') et on FORCE un palier de galerie en FOY0 (le haut de la rampe, à 4 m, le rejoint) ; puis on
  // DÉGAGE les murs d'arête du puits (couches 0 ET 1) pour que la pente soit franchissable (plus d'escalier).
  const etageTiles = [...etage.tiles];
  for (const [a, b] of RAMP_X)
    for (let x = a; x <= b; x++) {
      for (let dy = 1; dy <= 4; dy++) etageTiles[idx(x, FOY0 + dy)] = 'vide'; // trémie de la rampe
      etageTiles[idx(x, FOY0)] = 'plancher'; // palier de galerie au sommet de la rampe
    }
  const walls: WallSeg[] = [...rez.walls, ...etage.walls.map((w) => ({ ...w, z: 1 }))]
    .filter((w) => !inRampShaft(w.x, w.y)); // le puits de rampe est dégagé sur les deux couches

  const layers: Layer[] = [
    { z: 0, tiles: rez.tiles, height: rezHeights(rezRows) },
    { z: 1, tiles: etageTiles, height: new Array(W * H).fill(ETAGE_M) },
  ];
  return {
    id: 'opera-staatsoper',
    nom: 'Théâtre Staatsoper',
    description:
      'Opéra d’Altdorf — rez-de-chaussée (parterre en éventail, scène surélevée +1 m, fosse d’orchestre −1 m, salles latérales en colonnes subdivisées, foyer à rampes d’angle) et premier étage (loges en anneau autour du puits central ovale, à 4 m, galerie, loge royale dans l’axe de la scène). GÉNÉRÉ depuis une carte ASCII éditable (floorplan.ascii.ts) ; l’étage se rejoint par deux RAMPES (cases de hauteur croissante, plus aucun escalier).',
    ambiance: 'interieur',
    dimensions: { w: W, h: H },
    layers,
    walls,
    entities: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
    entryPoints: { 'entree-principale': { x: Math.round(AX), y: FACY }, 'entree-artistes': { x: BX1, y: 0 } },
  };
}
