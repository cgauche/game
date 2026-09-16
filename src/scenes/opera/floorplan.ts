/**
 * Théâtre Staatsoper — carte MIGRÉE sur `buildScene(MapSpec)` (dernier îlot d'authoring unifié). La
 * géométrie des deux étages vit en BOX-DRAWING dans `floorplan.ascii.ts` (source ÉDITABLE, arêtes DANS
 * l'ASCII) et passe par `MapSpec.walled` : `buildScene` parse tuiles + murs + portes + PUITS de rampe
 * (déjà troués dans l'ASCII). Seule l'ÉLÉVATION MÉTRIQUE — non exprimable en 1 char — est déclarée en
 * `relief` : scène `S` +1 m, fosse `s` −1 m, la galerie (étage) un plein niveau au-dessus du point HAUT
 * du rez, et les 2 RAMPES d'angle (cases de hauteur croissante rejoignant la galerie, AUCUN escalier).
 * Le bâtiment lui-même est un CORPS (`architecture`) : c'est de lui que la toiture se dérive et par lui
 * que la loi de dégagement découvre l'espace du groupe. Éditer la carte = éditer l'ASCII (+ ce `relief`
 * si l'élévation change).
 */
import type { Scene, Terrain } from '../../state/scene';
import { buildScene, type MapSpec } from '../../state/mapSpec';
import { METRES_PER_LEVEL } from '../../state/relief';
import { REZ_ASCII, ETAGE_ASCII, REZ_ZONES_ASCII, ETAGE_ZONES_ASCII } from './floorplan.ascii';

const W = 44, H = 60;
const AX = (W - 1) / 2;        // axe de symétrie (21.5)
const BX1 = W - 2;             // dernière colonne du bâti
const FACY = 58;              // seuil de façade (entrée principale)
const FOY0 = 45;             // 1re rangée du foyer (les rampes montent ici)

/** Élévation de la SCÈNE au-dessus du parterre — le point HAUT du rez. */
const SCENE_M = 1;

/** Hauteur métrique de l'ÉTAGE (loges/galeries) : un plein niveau (`METRES_PER_LEVEL`) au-dessus du
 *  point HAUT du plancher qu'il coiffe — la scène, pas le parterre. C'est l'INVARIANT D'EMPILEMENT que
 *  `validateScene` (`state/validateScene.ts`, « un étage se pose sur le dessus de celui du dessous »)
 *  mesure case par case sous l'emprise de la masse. Les rampes la rejoignent. */
const ETAGE_M = SCENE_M + METRES_PER_LEVEL;

/** Pente des 2 RAMPES d'angle, en mètres gagnés PAR RANGÉE. C'est elle qui donne leur LONGUEUR : la cote
 *  de la galerie est une hauteur, le nombre de rangées une distance — les deux ne coïncident que tant que
 *  cette pente vaut 1. */
const PENTE_RAMPE_M = 1;

/** Longueur d'une rampe en RANGÉES : elle descend de `ETAGE_M` à 1 m par pas de `PENTE_RAMPE_M`. */
const RAMPE_RANGEES = (ETAGE_M - 1) / PENTE_RAMPE_M + 1;

/** Légende des cases de l'ASCII (cf. floorplan.ascii.ts). base = `vide` (espace = hors-bâtiment / puits). */
const LEGEND: Record<string, Terrain> = { ',': 'dalle', P: 'plancher', M: 'marbre', S: 'planches', s: 'planches' };

/** Découpe une chaîne ASCII (template) en lignes de grille, recomplétées à la largeur 2W+1 (les espaces
 *  de fin ont été retirés à la génération pour la lisibilité ; on les remet pour le scan). */
function rowsOf(ascii: string): string[] {
  return ascii.split('\n').slice(1, -1).map((r) => r.padEnd(2 * W + 1, ' '));
}

/** Colonnes des 2 PUITS de rampe (angles du foyer, anciens escaliers du plan NADJ) : la couche 0 y monte
 *  du foyer à la cote de la galerie (les cases sont déjà TROUÉES à l'étage dans l'ASCII). */
const RAMP_X: [number, number][] = [[6, 8], [35, 37]];

/** ÉLÉVATION MÉTRIQUE (`MapSpec.relief`), la seule donnée non portée par l'ASCII (1 char) :
 *  - scène `S` = +1 m (rect [13,5]→[30,14]) · fosse `s` = −1 m (rect [17,15]→[27,19]) ;
 *  - galerie (étage z1) = `ETAGE_M` sur toute la grille ;
 *  - 2 RAMPES d'angle : chaque colonne des puits descend de `ETAGE_M` à 1 m à raison de `PENTE_RAMPE_M`
 *    par rangée depuis la 1re du foyer — la pente que `surfaceLink` franchit, donc AUCUN escalier. À pente
 *    constante, une galerie plus haute allonge la rampe (`RAMPE_RANGEES`) au lieu de la redresser. */
function operaRelief(): NonNullable<MapSpec['relief']> {
  const relief: NonNullable<MapSpec['relief']> = [
    { rect: [13, 5, 30, 14], height: SCENE_M },   // scène surélevée
    { rect: [17, 15, 27, 19], height: -1 },  // fosse d'orchestre −1 m
    { rect: [0, 0, W - 1, H - 1], height: ETAGE_M, z: 1 }, // galerie (étage)
  ];
  for (const [a, b] of RAMP_X)
    for (let x = a; x <= b; x++) relief.push({ ramp: [x, FOY0 + 1, x, FOY0 + RAMPE_RANGEES], from: ETAGE_M, to: 1 });
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

/** Type d'une entrée de `MapSpec.zoneLegend` — une PIÈCE du plan. */
type Piece = NonNullable<MapSpec['zoneLegend']>[string] & { id: string };

/** LÉGENDE du plan officiel, char du calque → pièce. `label` VERBATIM de l'encart « LÉGENDE » du plan
 *  (NADJ 08 folio 39 — légende du plan (image)), le NUMÉRO de l'entrée en commentaire ; `id` kebab STABLE
 *  dérivé du libellé (la logique ne lit que lui, cf. doctrine ids stables). `interior` : ce sont des
 *  pièces INTÉRIEURES — leur nom se cuit au centre et se révèle en cutaway. */
export const ZONES_REZ: Record<string, Piece> = {
  A: { id: 'salle-verte', label: 'Salle verte', presentation: 'interior' },                                             // 14
  B: { id: 'vestiaire', label: 'Vestiaire', presentation: 'interior' },                                                 // 13
  C: { id: 'zone-de-stockage-des-decors', label: 'Zone de stockage des décors', presentation: 'interior' },             // 20
  D: { id: 'coulisses', label: 'Coulisses', presentation: 'interior' },                                                 // 16
  E: { id: 'scene', label: 'Scène', presentation: 'interior' },                                                         // 19
  F: { id: 'fosse-d-orchestre', label: 'Fosse d’orchestre', presentation: 'interior' },                                 // 18
  G: { id: 'orchestre', label: 'Orchestre', presentation: 'interior' },                                                 // 17
  H: { id: 'vestiaires-des-choeurs-feminin', label: 'Vestiaires des chœurs (Féminin)', presentation: 'interior' },      // 12
  I: { id: 'vestiaires-des-choeurs-masculin', label: 'Vestiaires des chœurs (Masculin)', presentation: 'interior' },    // 11
  J: { id: 'bureau-du-regisseur', label: 'Bureau du régisseur', presentation: 'interior' },                             // 15
  K: { id: 'passage', label: 'Passage', presentation: 'interior' },                                                     // 10
  L: { id: 'rangements-des-costumes', label: 'Rangements des costumes', presentation: 'interior' },                     // 24
  M: { id: 'couturieres', label: 'Couturières', presentation: 'interior' },                                             // 25
  N: { id: 'charpenterie-et-decors', label: 'Charpenterie et décors', presentation: 'interior' },                       // 26
  O: { id: 'reserve-generale', label: 'Réserve générale', presentation: 'interior' },                                   // 27
  P: { id: 'bureau-du-concierge', label: 'Bureau du concierge', presentation: 'interior' },                             // 22
  Q: { id: 'bureau-du-gestionnaire-des-accessoires', label: 'Bureau du gestionnaire des accessoires', presentation: 'interior' }, // 23
  R: { id: 'salon', label: 'Salon', presentation: 'interior' },                                                         // 7
  S: { id: 'escalier-des-dames', label: 'Escalier des Dames', presentation: 'interior' },                               // 8
  T: { id: 'escalier-des-seigneurs', label: 'Escalier des Seigneurs', presentation: 'interior' },                       // 9
  // 6 apparaît DEUX fois (un guichet par angle de façade) : même `label`, id suffixé par la position.
  X: { id: 'vestiaire-et-vente-des-billets-gauche', label: 'Vestiaire et vente des billets', presentation: 'interior' }, // 6
  Y: { id: 'vestiaire-et-vente-des-billets-droit', label: 'Vestiaire et vente des billets', presentation: 'interior' },  // 6
  U: { id: 'commodites-des-dames', label: 'Commodités des Dames', presentation: 'interior' },                           // 4
  V: { id: 'commodites-des-seigneurs', label: 'Commodités des Seigneurs', presentation: 'interior' },                   // 5
};

/** Légende de l'ÉTAGE — même contrat, chars DISJOINTS de ceux du rez : `zoneLegend` est indexé par le
 *  seul char (`mapSpec.ts` : `zoneLegend[b.char].id`), un char partagé donnerait la même pièce aux deux
 *  niveaux. Tenu par un test (`floorplan.test.ts`), pas par ce commentaire. */
export const ZONES_ETAGE: Record<string, Piece> = {
  Z: { id: 'loge-royale', label: 'Loge royale', presentation: 'interior' }, // 30
};

/** CORPS architectural du théâtre — la donnée SANS laquelle aucune masse n'est dérivée (`buildScene` §9
 *  n'itère que `scene.architecture`), donc sans laquelle la loi de dégagement (`clearedSpace`,
 *  `builders/roofs.ts`) ne trouve ni pièce ni emprise autour d'un allié posé au rez : un bâtiment à deux
 *  niveaux comme La Diligence, corps UNIQUE et NON BORNÉ (aucun `parts[].foot`) — tout le plancher réel
 *  des deux couches lui revient, la dérivation le coiffe d'un toit continu par composante 4-connexe.
 *  Aucun `style` : `src/data/buildings.json` ne porte pas de type théâtre/opéra, et un corps sans type
 *  n'émet aucun ornement d'identité (`scene.ts`, `architectureBodySchema.style`). */
const OPERA_BODY: NonNullable<MapSpec['architecture']>[number] = {
  id: 'opera-staatsoper',
  label: 'Théâtre Staatsoper',
  storeys: [
    { id: 'opera-z0', z: 0, parts: [], roomZoneIds: Object.values(ZONES_REZ).map((p) => p.id) },
    { id: 'opera-z1', z: 1, parts: [], roomZoneIds: Object.values(ZONES_ETAGE).map((p) => p.id) },
  ],
  facades: [],
  masses: [],
};

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
    architecture: [OPERA_BODY],
    zoneMap: { z0: REZ_ZONES_ASCII, z1: ETAGE_ZONES_ASCII },
    zoneLegend: { ...ZONES_REZ, ...ZONES_ETAGE },
    relief: operaRelief(),
    entryPoints: { 'entree-principale': [Math.round(AX), FACY], 'entree-artistes': [BX1, 0] },
  });
}
