/**
 * Théâtre Staatsoper — carte MIGRÉE sur `buildScene(MapSpec)` (dernier îlot d'authoring unifié). La
 * géométrie des deux étages vit en BOX-DRAWING dans `floorplan.ascii.ts` (source ÉDITABLE, arêtes DANS
 * l'ASCII) et passe par `MapSpec.walled` : `buildScene` parse tuiles + murs + portes + PUITS de rampe
 * (déjà troués dans l'ASCII). Seule l'ÉLÉVATION MÉTRIQUE — non exprimable en 1 char — est déclarée en
 * `relief` : scène `S` +1 m, fosse `s` −1 m, la galerie (étage) à 4 m, et les 2 RAMPES d'angle (cases de
 * hauteur croissante 4→1 m rejoignant la galerie, AUCUN escalier). Éditer la carte = éditer l'ASCII (+
 * ce `relief` si l'élévation change).
 */
import type { Scene, Terrain } from '../../state/scene';
import { buildScene, type MapSpec } from '../../state/mapSpec';
import { REZ_ASCII, ETAGE_ASCII } from './floorplan.ascii';

const W = 44, H = 60;
const AX = (W - 1) / 2;        // axe de symétrie (21.5)
const BX1 = W - 2;             // dernière colonne du bâti
const FACY = 58;              // seuil de façade (entrée principale)
const FOY0 = 45;             // 1re rangée du foyer (les rampes montent ici)

/** Hauteur métrique de l'ÉTAGE (loges/galeries) — un plein niveau : la couche 1 se rend soulevée d'un
 *  `LEVEL_H` à l'écran (aspect d'origine), les rampes la rejoignent. */
const ETAGE_M = 4;

/** Légende des cases de l'ASCII (cf. floorplan.ascii.ts). base = `vide` (espace = hors-bâtiment / puits). */
const LEGEND: Record<string, Terrain> = { ',': 'dalle', P: 'plancher', M: 'marbre', S: 'planches', s: 'planches' };

/** Découpe une chaîne ASCII (template) en lignes de grille, recomplétées à la largeur 2W+1 (les espaces
 *  de fin ont été retirés à la génération pour la lisibilité ; on les remet pour le scan). */
function rowsOf(ascii: string): string[] {
  return ascii.split('\n').slice(1, -1).map((r) => r.padEnd(2 * W + 1, ' '));
}

/** Colonnes des 2 PUITS de rampe (angles du foyer, anciens escaliers du plan NADJ) : la couche 0 y monte
 *  0→4 m pour rejoindre la galerie (les cases sont déjà TROUÉES à l'étage dans l'ASCII). */
const RAMP_X: [number, number][] = [[6, 8], [35, 37]];

/** ÉLÉVATION MÉTRIQUE (`MapSpec.relief`), la seule donnée non portée par l'ASCII (1 char) :
 *  - scène `S` = +1 m (rect [13,5]→[30,14]) · fosse `s` = −1 m (rect [17,15]→[27,19]) ;
 *  - galerie (étage z1) = 4 m sur toute la grille ;
 *  - 2 RAMPES d'angle : chaque colonne des puits descend 4→1 m des rangées 46 à 49 (pente Δ1/rangée qui
 *    rejoint la galerie à 4 m — franchissable, aucun escalier). */
function operaRelief(): NonNullable<MapSpec['relief']> {
  const relief: NonNullable<MapSpec['relief']> = [
    { rect: [13, 5, 30, 14], height: 1 },   // scène surélevée +1 m
    { rect: [17, 15, 27, 19], height: -1 },  // fosse d'orchestre −1 m
    { rect: [0, 0, W - 1, H - 1], height: ETAGE_M, z: 1 }, // galerie (étage) à 4 m
  ];
  for (const [a, b] of RAMP_X)
    for (let x = a; x <= b; x++) relief.push({ ramp: [x, FOY0 + 1, x, FOY0 + 4], from: ETAGE_M, to: 1 }); // 46→4 m … 49→1 m
  return relief;
}

/** Cases de SIÈGE du parterre, DÉRIVÉES de l'ASCII : toute case `plancher` (P), un rang sur deux (allée
 *  de circulation entre les rangs), fine allée centrale de 2 cases (axe 21.5). Source unique → le scénario
 *  pose un `siege` 1×1 par case (cf. furnished.ts). Éditer l'éventail dans l'ASCII met les sièges à jour. */
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

/** Le Théâtre Staatsoper en DONNÉE, COMPILÉ depuis l'ASCII box-drawing par `buildScene` (`MapSpec.walled`
 *  + `relief`). Rez (z0) et étage (z1) = deux grilles box-drawing ; l'élévation = `relief`. */
export function buildOperaFloorplan(): Scene {
  return buildScene({
    id: 'opera-staatsoper',
    label: 'Théâtre Staatsoper',
    desc:
      'Opéra d’Altdorf — rez-de-chaussée (parterre en éventail, scène surélevée +1 m, fosse d’orchestre −1 m, salles latérales en colonnes subdivisées, foyer à rampes d’angle) et premier étage (loges en anneau autour du puits central ovale, à 4 m, galerie, loge royale dans l’axe de la scène). GÉNÉRÉ depuis une carte ASCII éditable (floorplan.ascii.ts) ; l’étage se rejoint par deux RAMPES (cases de hauteur croissante, plus aucun escalier).',
    ambiance: 'interieur',
    size: [W, H],
    terrain: 'vide', // base z0 = hors-bâtiment (espace ASCII), pas 'herbe' (intérieur)
    legend: LEGEND,
    walled: { z0: REZ_ASCII, z1: ETAGE_ASCII },
    relief: operaRelief(),
    entryPoints: { 'entree-principale': [Math.round(AX), FACY], 'entree-artistes': [BX1, 0] },
  });
}
