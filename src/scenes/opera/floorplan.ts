/**
 * Théâtre Staatsoper — la carte est GÉNÉRÉE DEPUIS L'ASCII (`floorplan.ascii.ts`, source ÉDITABLE) :
 * `parseWalledAscii` lit le sol + les murs cardinaux + les portes des deux étages ; le code ne rajoute
 * que ce que l'ASCII ne porte pas — l'ÉLÉVATION (cases `S` scène +0.4 / `s` fosse −0.4) et les 2 ESCALIERS
 * d'angle. Le puits central de l'étage est déjà du `vide` (espaces) dans l'ASCII. Éditer la carte =
 * éditer `floorplan.ascii.ts` (régénérable depuis l'ancienne géométrie via `scripts/qc/gen-opera-ascii.mts`).
 * NB : les diagonales VISUELLES de lissage de l'éventail ne sont pas (encore) ré-appliquées — l'éventail
 * suit les murs cardinaux de l'ASCII (en marches).
 */
import type { Scene, Terrain, WallSeg, Level } from '../../state/scene';
import { parseWalledAscii } from '../../state/asciiMap';
import { REZ_ASCII, ETAGE_ASCII } from './floorplan.ascii';

const W = 44, H = 60;
const AX = (W - 1) / 2;        // axe de symétrie (21.5)
const BX1 = W - 2;             // dernière colonne du bâti
const FACY = 58;              // seuil de façade (entrée principale)
const FOY0 = 45;             // 1re rangée du foyer (les escaliers montent ici)

/** Légende des cases de l'ASCII (cf. floorplan.ascii.ts). base = `vide` (espace = hors-bâtiment / puits). */
const LEGEND: Record<string, Terrain> = { ',': 'dalle', P: 'plancher', M: 'marbre', S: 'planches', s: 'planches' };

/** Découpe une chaîne ASCII (template) en lignes de grille, recomplétées à la largeur 2W+1 (les espaces
 *  de fin ont été retirés à la génération pour la lisibilité ; on les remet pour le parseur). */
function rowsOf(ascii: string): string[] {
  return ascii.split('\n').slice(1, -1).map((r) => r.padEnd(2 * W + 1, ' '));
}

/** Élévation dérivée des cases ASCII : `S` (scène) = +0.4, `s` (fosse) = −0.4, sinon 0. */
function elevFrom(rows: string[]): number[] {
  const elev = new Array(W * H).fill(0) as number[];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[2 * y + 1]?.[2 * x + 1];
      if (ch === 'S') elev[y * W + x] = 0.4;
      else if (ch === 's') elev[y * W + x] = -0.4;
    }
  return elev;
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

  const walls: WallSeg[] = [...rez.walls, ...etage.walls.map((w) => ({ ...w, z: 1 }))];

  // 2 ESCALIERS d'angle (8/9 du schéma) : cages 3 cases de large montant à l'étage, posées sur le foyer
  // (marbre au rez, galerie/plancher à l'étage → marchables aux deux niveaux). Seuls escaliers du schéma.
  const stairs: NonNullable<Scene['stairs']> = [];
  for (const sx of [7, 35]) for (let dx = -1; dx <= 1; dx++) stairs.push({ from: { x: sx + dx, y: FOY0 + 2, z: 0 }, to: { x: sx + dx, y: FOY0 + 2, z: 1 } });

  const levels: Level[] = [
    { z: 0, tiles: rez.tiles, elev: elevFrom(rezRows) },
    { z: 1, tiles: etage.tiles },
  ];
  return {
    id: 'opera-staatsoper',
    nom: 'Théâtre Staatsoper',
    description:
      'Opéra d’Altdorf — rez-de-chaussée (parterre en éventail, scène surélevée, fosse d’orchestre, salles latérales en colonnes subdivisées, foyer à escaliers d’angle) et premier étage (loges en anneau autour du puits central ovale, galerie, loge royale dans l’axe de la scène). GÉNÉRÉ depuis une carte ASCII éditable (floorplan.ascii.ts), reconstruite du schéma de murs officiel ; toutes les pièces sont reliées par des portes.',
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
    entryPoints: { 'entree-principale': { x: Math.round(AX), y: FACY }, 'entree-artistes': { x: BX1, y: 0 } },
  };
}
