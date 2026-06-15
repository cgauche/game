import { makePregens } from '../../data/pregens';
import { buildOperaFloorplan } from '../opera/floorplan';
import type { Scene, SceneEntity } from '../../state/scene';
import type { TestScenario } from './_shared';

/**
 * Le Théâtre Staatsoper RECONSTRUIT FIDÈLEMENT du plan officiel (NADJ p.40 rez / p.41 étage) —
 * géométrie reconstruite dans `opera/floorplan.ts` (parterre en éventail, scène surélevée + fosse en
 * contrebas, foyer courbe, puits central bordé de loges + loge royale, escaliers du moteur), et
 * désormais MEUBLÉ de ses props : parterre raké de fauteuils (allée centrale dégagée), rideau de scène,
 * fosse d'orchestre (pupitres), colonnes & statue sur les flancs, plantes du foyer, lustre central
 * au-dessus du puits, et à l'étage les loges (balustrade sur le puits + fauteuils + appliques) avec une
 * loge royale plus richement garnie. Tout est de la DONNÉE éditable dans l'éditeur de niveau ; la
 * LOGIQUE de la soirée (bombe, Glimbrin, Comtesse…) vit dans le scénario jouable « Opéra — Théâtre » (21).
 *
 * Repère du plan (cf. floorplan.ts) : y croissant = du FOND (scène, y bas) vers le FOYER (façade, y haut) ;
 * axe de symétrie x=21.5. Le public regarde la scène, vers le HAUT (y bas). Caméra par défaut : rot 0.
 *
 * NOTE d'orientation des sièges : le prop `rangee-sieges` est un sprite FIXE (le champ `facing` n'a
 * AUCUN effet visuel sur les props — seuls les bâtiments l'utilisent ; cf. IsoStage). On renseigne
 * `facing:'N'` comme INTENTION d'auteur (les fauteuils regardent la scène, au Nord = y bas) ; au rendu,
 * le sprite montre toujours l'avant des fauteuils côté caméra. Vérifié au rendu (scripts/qc/render-opera-furnished.mts).
 */

const ents: SceneEntity[] = [
  { id: 'start', kind: 'heroStart', pos: { x: 21, y: 50 } }, // entrée par le foyer (marbre, bas)

  // ───────────── SCÈNE (z=0, y bas) : rideau de scène en travers du fond, sur les planches surélevées.
  { id: 'rideau-1', kind: 'prop', ref: 'rideau-scene', pos: { x: 13, y: 3 }, facing: 'S', foot: { w: 3, h: 1 } },
  { id: 'rideau-2', kind: 'prop', ref: 'rideau-scene', pos: { x: 16, y: 3 }, facing: 'S', foot: { w: 3, h: 1 } },
  { id: 'rideau-3', kind: 'prop', ref: 'rideau-scene', pos: { x: 19, y: 3 }, facing: 'S', foot: { w: 3, h: 1 } },
  { id: 'rideau-4', kind: 'prop', ref: 'rideau-scene', pos: { x: 22, y: 3 }, facing: 'S', foot: { w: 3, h: 1 } },
  { id: 'rideau-5', kind: 'prop', ref: 'rideau-scene', pos: { x: 25, y: 3 }, facing: 'S', foot: { w: 3, h: 1 } },
  { id: 'rideau-6', kind: 'prop', ref: 'rideau-scene', pos: { x: 28, y: 3 }, facing: 'S', foot: { w: 3, h: 1 } },

  // ───────────── FOSSE D'ORCHESTRE (z=0, y=9-10, planches en contrebas) : pupitres du chef.
  { id: 'pupitre-1', kind: 'prop', ref: 'pupitre-chef', pos: { x: 16, y: 10 }, facing: 'S' },
  { id: 'pupitre-2', kind: 'prop', ref: 'pupitre-chef', pos: { x: 21, y: 9 }, facing: 'S' },
  { id: 'pupitre-3', kind: 'prop', ref: 'pupitre-chef', pos: { x: 26, y: 10 }, facing: 'S' },

  // ───────────── PARTERRE (z=0, éventail y=11..40) : rangées de fauteuils rakées, allée centrale
  //   (cols 20-22) dégagée. `facing:'N'` = regardent la scène (intention ; sprite fixe).
  { id: 'sg-L-13-16', kind: 'prop', ref: 'rangee-sieges', pos: { x: 16, y: 13 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-13-23', kind: 'prop', ref: 'rangee-sieges', pos: { x: 23, y: 13 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-13-26', kind: 'prop', ref: 'rangee-sieges', pos: { x: 26, y: 13 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-16-15', kind: 'prop', ref: 'rangee-sieges', pos: { x: 15, y: 16 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-16-23', kind: 'prop', ref: 'rangee-sieges', pos: { x: 23, y: 16 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-16-26', kind: 'prop', ref: 'rangee-sieges', pos: { x: 26, y: 16 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-19-14', kind: 'prop', ref: 'rangee-sieges', pos: { x: 14, y: 19 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-19-17', kind: 'prop', ref: 'rangee-sieges', pos: { x: 17, y: 19 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-19-23', kind: 'prop', ref: 'rangee-sieges', pos: { x: 23, y: 19 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-19-26', kind: 'prop', ref: 'rangee-sieges', pos: { x: 26, y: 19 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-22-13', kind: 'prop', ref: 'rangee-sieges', pos: { x: 13, y: 22 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-22-16', kind: 'prop', ref: 'rangee-sieges', pos: { x: 16, y: 22 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-22-23', kind: 'prop', ref: 'rangee-sieges', pos: { x: 23, y: 22 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-22-26', kind: 'prop', ref: 'rangee-sieges', pos: { x: 26, y: 22 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-22-29', kind: 'prop', ref: 'rangee-sieges', pos: { x: 29, y: 22 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-25-12', kind: 'prop', ref: 'rangee-sieges', pos: { x: 12, y: 25 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-25-15', kind: 'prop', ref: 'rangee-sieges', pos: { x: 15, y: 25 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-25-23', kind: 'prop', ref: 'rangee-sieges', pos: { x: 23, y: 25 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-25-26', kind: 'prop', ref: 'rangee-sieges', pos: { x: 26, y: 25 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-25-29', kind: 'prop', ref: 'rangee-sieges', pos: { x: 29, y: 25 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-28-11', kind: 'prop', ref: 'rangee-sieges', pos: { x: 11, y: 28 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-28-14', kind: 'prop', ref: 'rangee-sieges', pos: { x: 14, y: 28 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-28-17', kind: 'prop', ref: 'rangee-sieges', pos: { x: 17, y: 28 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-28-23', kind: 'prop', ref: 'rangee-sieges', pos: { x: 23, y: 28 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-28-26', kind: 'prop', ref: 'rangee-sieges', pos: { x: 26, y: 28 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-28-29', kind: 'prop', ref: 'rangee-sieges', pos: { x: 29, y: 28 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-31-9', kind: 'prop', ref: 'rangee-sieges', pos: { x: 9, y: 31 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-31-12', kind: 'prop', ref: 'rangee-sieges', pos: { x: 12, y: 31 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-31-15', kind: 'prop', ref: 'rangee-sieges', pos: { x: 15, y: 31 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-31-23', kind: 'prop', ref: 'rangee-sieges', pos: { x: 23, y: 31 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-31-26', kind: 'prop', ref: 'rangee-sieges', pos: { x: 26, y: 31 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-31-29', kind: 'prop', ref: 'rangee-sieges', pos: { x: 29, y: 31 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-31-32', kind: 'prop', ref: 'rangee-sieges', pos: { x: 32, y: 31 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-34-8', kind: 'prop', ref: 'rangee-sieges', pos: { x: 8, y: 34 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-34-11', kind: 'prop', ref: 'rangee-sieges', pos: { x: 11, y: 34 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-34-14', kind: 'prop', ref: 'rangee-sieges', pos: { x: 14, y: 34 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-34-17', kind: 'prop', ref: 'rangee-sieges', pos: { x: 17, y: 34 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-34-23', kind: 'prop', ref: 'rangee-sieges', pos: { x: 23, y: 34 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-34-26', kind: 'prop', ref: 'rangee-sieges', pos: { x: 26, y: 34 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-34-29', kind: 'prop', ref: 'rangee-sieges', pos: { x: 29, y: 34 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-34-32', kind: 'prop', ref: 'rangee-sieges', pos: { x: 32, y: 34 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-37-7', kind: 'prop', ref: 'rangee-sieges', pos: { x: 7, y: 37 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-37-10', kind: 'prop', ref: 'rangee-sieges', pos: { x: 10, y: 37 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-37-13', kind: 'prop', ref: 'rangee-sieges', pos: { x: 13, y: 37 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-L-37-16', kind: 'prop', ref: 'rangee-sieges', pos: { x: 16, y: 37 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-37-23', kind: 'prop', ref: 'rangee-sieges', pos: { x: 23, y: 37 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-37-26', kind: 'prop', ref: 'rangee-sieges', pos: { x: 26, y: 37 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-37-29', kind: 'prop', ref: 'rangee-sieges', pos: { x: 29, y: 37 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-37-32', kind: 'prop', ref: 'rangee-sieges', pos: { x: 32, y: 37 }, facing: 'N', foot: { w: 3, h: 1 } },
  { id: 'sg-R-37-35', kind: 'prop', ref: 'rangee-sieges', pos: { x: 35, y: 37 }, facing: 'N', foot: { w: 3, h: 1 } },

  // ───────────── FLANCS DE L'AUDITORIUM (z=0) : colonnes le long des bords de l'éventail + une statue.
  { id: 'col-L-15', kind: 'prop', ref: 'colonne-brisee', pos: { x: 16, y: 15 } },
  { id: 'col-R-15', kind: 'prop', ref: 'colonne-brisee', pos: { x: 28, y: 15 } },
  { id: 'col-L-24', kind: 'prop', ref: 'colonne-brisee', pos: { x: 13, y: 24 } },
  { id: 'col-R-24', kind: 'prop', ref: 'colonne-brisee', pos: { x: 31, y: 24 } },
  { id: 'col-L-33', kind: 'prop', ref: 'colonne-brisee', pos: { x: 10, y: 33 } },
  { id: 'col-R-33', kind: 'prop', ref: 'colonne-brisee', pos: { x: 34, y: 33 } },
  { id: 'statue-L', kind: 'prop', ref: 'statue', pos: { x: 8, y: 39 } },
  { id: 'statue-R', kind: 'prop', ref: 'statue', pos: { x: 37, y: 39 } },

  // ───────────── FOYER (z=0, marbre y=42..55) : quelques plantes en pot encadrant l'entrée. Sobre.
  { id: 'foy-plante-1', kind: 'prop', ref: 'plante-pot', pos: { x: 14, y: 44 } },
  { id: 'foy-plante-2', kind: 'prop', ref: 'plante-pot', pos: { x: 29, y: 44 } },
  { id: 'foy-plante-3', kind: 'prop', ref: 'plante-pot', pos: { x: 12, y: 52 } },
  { id: 'foy-plante-4', kind: 'prop', ref: 'plante-pot', pos: { x: 31, y: 52 } },

  // ───────────── LUSTRE central : suspendu au-dessus du puits (z=1 → flotte plus haut, sur le vide).
  { id: 'lustre', kind: 'prop', ref: 'lustre-opera', pos: { x: 21, y: 22 }, z: 1 },

  // ───────────── PREMIER ÉTAGE (z=1) : LOGES en anneau (balustrade sur le puits + fauteuils + applique).
  // Loge gauche y=14 (cols 2..8) — balustrade côté puits (E), fauteuils derrière, applique au mur.
  { id: 'lg-bal-14', kind: 'prop', ref: 'balustrade-loge', pos: { x: 7, y: 14 }, facing: 'E', z: 1, foot: { w: 3, h: 1 } },
  { id: 'lg-ft-14a', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 6, y: 14 }, z: 1 },
  { id: 'lg-ft-14b', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 6, y: 15 }, z: 1 },
  { id: 'lg-app-14', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 13 }, z: 1 },
  // Loge droite y=14 (cols 36..41) — balustrade côté puits (O), fauteuils derrière, applique au mur.
  { id: 'ld-bal-14', kind: 'prop', ref: 'balustrade-loge', pos: { x: 35, y: 14 }, facing: 'O', z: 1, foot: { w: 3, h: 1 } },
  { id: 'ld-ft-14a', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 38, y: 14 }, z: 1 },
  { id: 'ld-ft-14b', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 38, y: 15 }, z: 1 },
  { id: 'ld-app-14', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 13 }, z: 1 },
  // Loge gauche y=20 (cols 2..5) — balustrade côté puits (E), fauteuils derrière, applique au mur.
  { id: 'lg-bal-20', kind: 'prop', ref: 'balustrade-loge', pos: { x: 4, y: 20 }, facing: 'E', z: 1, foot: { w: 3, h: 1 } },
  { id: 'lg-ft-20a', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 3, y: 20 }, z: 1 },
  { id: 'lg-ft-20b', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 3, y: 21 }, z: 1 },
  { id: 'lg-app-20', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 19 }, z: 1 },
  // Loge droite y=20 (cols 39..41) — balustrade côté puits (O), fauteuils derrière, applique au mur.
  { id: 'ld-bal-20', kind: 'prop', ref: 'balustrade-loge', pos: { x: 38, y: 20 }, facing: 'O', z: 1, foot: { w: 3, h: 1 } },
  { id: 'ld-ft-20a', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 41, y: 20 }, z: 1 },
  { id: 'ld-ft-20b', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 41, y: 21 }, z: 1 },
  { id: 'ld-app-20', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 19 }, z: 1 },
  // Loge gauche y=26 (cols 2..4) — balustrade côté puits (E), fauteuils derrière, applique au mur.
  { id: 'lg-bal-26', kind: 'prop', ref: 'balustrade-loge', pos: { x: 3, y: 26 }, facing: 'E', z: 1, foot: { w: 3, h: 1 } },
  { id: 'lg-ft-26a', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 2, y: 26 }, z: 1 },
  { id: 'lg-ft-26b', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 2, y: 27 }, z: 1 },
  { id: 'lg-app-26', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 25 }, z: 1 },
  // Loge droite y=26 (cols 40..41) — balustrade côté puits (O), fauteuils derrière, applique au mur.
  { id: 'ld-bal-26', kind: 'prop', ref: 'balustrade-loge', pos: { x: 39, y: 26 }, facing: 'O', z: 1, foot: { w: 3, h: 1 } },
  { id: 'ld-ft-26a', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 41, y: 26 }, z: 1 },
  { id: 'ld-ft-26b', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 41, y: 27 }, z: 1 },
  { id: 'ld-app-26', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 25 }, z: 1 },
  // Loge gauche y=32 (cols 2..6) — balustrade côté puits (E), fauteuils derrière, applique au mur.
  { id: 'lg-bal-32', kind: 'prop', ref: 'balustrade-loge', pos: { x: 5, y: 32 }, facing: 'E', z: 1, foot: { w: 3, h: 1 } },
  { id: 'lg-ft-32a', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 4, y: 32 }, z: 1 },
  { id: 'lg-ft-32b', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 4, y: 33 }, z: 1 },
  { id: 'lg-app-32', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 31 }, z: 1 },
  // Loge droite y=32 (cols 38..41) — balustrade côté puits (O), fauteuils derrière, applique au mur.
  { id: 'ld-bal-32', kind: 'prop', ref: 'balustrade-loge', pos: { x: 37, y: 32 }, facing: 'O', z: 1, foot: { w: 3, h: 1 } },
  { id: 'ld-ft-32a', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 40, y: 32 }, z: 1 },
  { id: 'ld-ft-32b', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 40, y: 33 }, z: 1 },
  { id: 'ld-app-32', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 31 }, z: 1 },

  // ───────────── LOGE ROYALE (z=1, fond-centre, marbre y=1-2 cols 18-26, dans l'axe de la scène).
  //   Balustrade en travers du front sur le puits (S, vers la scène), fauteuils d'honneur, appliques.
  { id: 'royale-bal-g', kind: 'prop', ref: 'balustrade-loge', pos: { x: 18, y: 2 }, facing: 'S', z: 1, foot: { w: 3, h: 1 } },
  { id: 'royale-bal-d', kind: 'prop', ref: 'balustrade-loge', pos: { x: 22, y: 2 }, facing: 'S', z: 1, foot: { w: 3, h: 1 } },
  { id: 'royale-ft-g', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 20, y: 1 }, z: 1 },
  { id: 'royale-ft-c', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 21, y: 1 }, z: 1 },
  { id: 'royale-ft-d', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 22, y: 1 }, z: 1 },
  { id: 'royale-app-g', kind: 'prop', ref: 'applique-murale', pos: { x: 18, y: 1 }, z: 1 },
  { id: 'royale-app-d', kind: 'prop', ref: 'applique-murale', pos: { x: 24, y: 1 }, z: 1 },
];

export const scenarioEntities = ents;

const scene: Scene = {
  ...buildOperaFloorplan(),
  entities: ents,
  startMessage:
    'Le Théâtre Staatsoper, reconstitué d’après les plans : du foyer, le parterre en éventail s’élève vers la scène ; au-dessus, les loges cernent le vide central, dominées par la loge royale.',
};

export const scenario: TestScenario = {
  id: 'opera-plan',
  order: 22,
  icon: '🏛',
  title: 'Opéra — Plan fidèle',
  tests:
    'Théâtre Staatsoper reconstruit du plan officiel (p.40/41) : parterre en ÉVENTAIL (murs diagonaux), SCÈNE surélevée + FOSSE d’orchestre (élévation), foyer courbe ; puits central + loges + loge royale (multi-niveaux), escaliers jumeaux. Meublé : parterre raké de fauteuils (allée centrale) regardant la scène, rideau, fosse, colonnes/statue, lustre central, loges & loge royale garnies.',
  partyNote: 'Pré-tirés',
  makeParty: () => makePregens(),
  scene,
};
