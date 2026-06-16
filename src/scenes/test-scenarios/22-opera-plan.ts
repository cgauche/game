import { makePregens } from '../../data/pregens';
import { buildOperaFloorplan } from '../opera/floorplan';
import type { Scene, SceneEntity } from '../../state/scene';
import type { TestScenario } from './_shared';

/**
 * Le Théâtre Staatsoper MEUBLÉ FIDÈLEMENT d'après le plan officiel (NADJ p.40 rez / p.41 étage) —
 * géométrie dans `opera/floorplan.ts`. Le mobilier est posé PIÈCE PAR PIÈCE tel que le plan le dessine
 * (pas de remplissage aléatoire) : parterre raké de fauteuils en éventail, fosse d'orchestre garnie de
 * pupitres, scène & coulisses avec châssis de décor, loges/balcons tiérés autour du puits, loge royale
 * en canapés, foyer à grand escalier, et toutes les salles de service (salle verte, vestiaires des
 * chœurs, bureaux, stockages, ateliers de costumes, charpenterie, réserve) avec leurs meubles propres.
 * Tout est de la DONNÉE éditable ; la LOGIQUE de la soirée vit dans le scénario jouable « Opéra » (21).
 *
 * Repère (cf. floorplan.ts) : y croissant = du FOND (scène, y bas) vers le FOYER (façade, y haut) ;
 * axe x=21.5. Le public regarde la scène, vers le HAUT. `facing:'N'` = tourné vers la scène (y bas) ;
 * sur l'étage les sièges regardent le PUITS (centre). Les props 1×1 PIVOTENT avec la caméra (`project`).
 *
 * Bandes (rangées) : 16 Coulisses 1-4 · 19 Scène 5-13 (cols 11-32) · 18 Fosse 14-16 · 17 Parterre 17-44 ·
 * 7 Foyer 46-52 · entrées 53-58. Fan parterre : demi-largeur 6 (haut) → 12 (bas).
 */

/** Rangée de sièges 1×1 sur l'axe x de [x0..x1] à la rangée y, regardant `dir` (défaut Nord = scène). */
const seatRow = (id: string, y: number, x0: number, x1: number, dir: SceneEntity['facing'] = 'N', z = 0): SceneEntity[] => {
  const out: SceneEntity[] = [];
  for (let x = x0; x <= x1; x++) out.push({ id: `${id}-${x}`, kind: 'prop', ref: 'siege', pos: { x, y }, facing: dir, ...(z ? { z } : {}) });
  return out;
};
/** Colonne de sièges 1×1 sur l'axe y de [y0..y1] à la colonne x, regardant `dir`. */
const seatCol = (id: string, x: number, y0: number, y1: number, dir: SceneEntity['facing'], z = 0): SceneEntity[] => {
  const out: SceneEntity[] = [];
  for (let y = y0; y <= y1; y++) out.push({ id: `${id}-${y}`, kind: 'prop', ref: 'siege', pos: { x, y }, facing: dir, ...(z ? { z } : {}) });
  return out;
};

const ents: SceneEntity[] = [
  { id: 'start', kind: 'heroStart', pos: { x: 21, y: 54 } }, // entrée par le foyer (marbre, bas)

  // ═══════════════ SCÈNE (19, z=0, rangées 5-13, cols 11-32, planches surélevées) ═══════════════
  // Rideau de scène en travers du fond (côté coulisses, regarde le public au sud), sur toute la largeur.
  ...[11, 14, 17, 20, 23, 26, 29].map((x, i): SceneEntity => ({ id: `rideau-${i}`, kind: 'prop', ref: 'rideau-scene', pos: { x, y: 5 }, facing: 'S', foot: { w: 3, h: 1 } })),
  // Décors en place sur la scène (châssis peints + un praticable) — le plan montre des panneaux au sol.
  { id: 'scene-flat-1', kind: 'prop', ref: 'decor-flat', pos: { x: 14, y: 9 } },
  { id: 'scene-flat-2', kind: 'prop', ref: 'decor-flat', pos: { x: 29, y: 9 } },
  { id: 'scene-colonne', kind: 'prop', ref: 'colonne-brisee', pos: { x: 21, y: 8 } },

  // ═══════════════ COULISSES (16, z=0, rangées 1-4 derrière la scène) ═══════════════
  // Décors en attente, accessoires : châssis, mannequins de costumier, caisses, râtelier d'accessoires.
  { id: 'cl-flat-1', kind: 'prop', ref: 'decor-flat', pos: { x: 13, y: 2 } },
  { id: 'cl-mann-1', kind: 'prop', ref: 'mannequin', pos: { x: 16, y: 2 } },
  { id: 'cl-caisse-1', kind: 'prop', ref: 'caisse', pos: { x: 19, y: 3 } },
  { id: 'cl-rack', kind: 'prop', ref: 'rack-armes', pos: { x: 24, y: 2 } },
  { id: 'cl-caisse-2', kind: 'prop', ref: 'caisse', pos: { x: 27, y: 3 } },
  { id: 'cl-flat-2', kind: 'prop', ref: 'decor-flat', pos: { x: 30, y: 2 } },

  // ═══════════════ FOSSE D'ORCHESTRE (18, z=0, rangées 14-16, planches en contrebas) ═══════════════
  // Pupitres des musiciens disposés en arc face à la scène (le plan montre une rangée de pupitres + tabourets).
  ...[15, 18, 21, 24, 27].map((x, i): SceneEntity => ({ id: `pup-${i}`, kind: 'prop', ref: 'pupitre-chef', pos: { x, y: 15 }, facing: 'N' })),
  { id: 'pup-chef', kind: 'prop', ref: 'pupitre-chef', pos: { x: 21, y: 16 }, facing: 'N' },
  { id: 'orch-tab-1', kind: 'prop', ref: 'tabouret', pos: { x: 16, y: 16 } },
  { id: 'orch-tab-2', kind: 'prop', ref: 'tabouret', pos: { x: 26, y: 16 } },

  // ═══════════════ PARTERRE / ORCHESTRE (17, z=0, rangées 17-44, éventail) ═══════════════
  // Fauteuils rakés regardant la scène (`facing:'N'`), split L/R par l'allée centrale (cols 20-22 libres),
  // rangs tous les 3 rangs (les rangs intermédiaires = circulation), bornés par les bords de l'éventail.
  // Lf/Rf : y17-19 16..28 · y24 14..30 · y29 13..31 · y33 12..32 · y38 11..33 · y42 10..34.
  ...seatRow('pt-19L', 19, 16, 19), ...seatRow('pt-19R', 19, 23, 28),
  ...seatRow('pt-22L', 22, 15, 19), ...seatRow('pt-22R', 22, 23, 29),
  ...seatRow('pt-25L', 25, 14, 19), ...seatRow('pt-25R', 25, 23, 30),
  ...seatRow('pt-28L', 28, 14, 19), ...seatRow('pt-28R', 28, 23, 30),
  ...seatRow('pt-31L', 31, 13, 19), ...seatRow('pt-31R', 31, 23, 31),
  ...seatRow('pt-34L', 34, 12, 19), ...seatRow('pt-34R', 34, 23, 32),
  ...seatRow('pt-37L', 37, 12, 19), ...seatRow('pt-37R', 37, 23, 32),
  ...seatRow('pt-40L', 40, 11, 19), ...seatRow('pt-40R', 40, 23, 33),
  ...seatRow('pt-43L', 43, 10, 19), ...seatRow('pt-43R', 43, 23, 34),

  // ═══════════════ FOYER (7 Salon, z=0, marbre rangées 46-52) ═══════════════
  // Grand hall d'accueil sobre : statues d'honneur encadrant l'entrée du parterre, urnes, plantes, appliques.
  { id: 'foy-statue-g', kind: 'prop', ref: 'statue', pos: { x: 8, y: 47 } },
  { id: 'foy-statue-d', kind: 'prop', ref: 'statue', pos: { x: 35, y: 47 } },
  { id: 'foy-urne-g', kind: 'prop', ref: 'urne', pos: { x: 14, y: 47 } },
  { id: 'foy-urne-d', kind: 'prop', ref: 'urne', pos: { x: 29, y: 47 } },
  { id: 'foy-plante-1', kind: 'prop', ref: 'plante-pot', pos: { x: 11, y: 50 } },
  { id: 'foy-plante-2', kind: 'prop', ref: 'plante-pot', pos: { x: 32, y: 50 } },
  { id: 'foy-banc-g', kind: 'prop', ref: 'banc', pos: { x: 18, y: 51 } },
  { id: 'foy-banc-d', kind: 'prop', ref: 'banc', pos: { x: 25, y: 51 } },
  { id: 'foy-app-g', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 48 } },
  { id: 'foy-app-d', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 48 } },

  // 6 VESTIAIRE ET VENTE DES BILLETS (coins de la façade) : comptoir de billetterie.
  { id: 'billet-g', kind: 'prop', ref: 'comptoir', pos: { x: 3, y: 56 } },
  { id: 'billet-d', kind: 'prop', ref: 'comptoir', pos: { x: 40, y: 56 } },

  // LUSTRE central : suspendu au-dessus du puits (z=1 → flotte au-dessus du vide).
  { id: 'lustre', kind: 'prop', ref: 'lustre-opera', pos: { x: 21, y: 28 }, z: 1 },

  // ═══════════════ SALLES LATÉRALES GAUCHE (z=0) — meublées d'après le plan, pièce par pièce ═══════════════
  // 14 SALLE VERTE (rangées 1-12) : détente des artistes — longue table centrale, chaises, bancs aux murs.
  { id: 'sv-table', kind: 'prop', ref: 'table', pos: { x: 6, y: 5 }, foot: { w: 2, h: 1 } },
  { id: 'sv-chaise-1', kind: 'prop', ref: 'chaise', pos: { x: 5, y: 7 } },
  { id: 'sv-chaise-2', kind: 'prop', ref: 'chaise', pos: { x: 8, y: 7 } },
  { id: 'sv-banc-1', kind: 'prop', ref: 'banc', pos: { x: 4, y: 3 } },
  { id: 'sv-banc-2', kind: 'prop', ref: 'banc', pos: { x: 4, y: 10 } },
  { id: 'sv-etagere', kind: 'prop', ref: 'etagere', pos: { x: 9, y: 2 } },

  // 13 VESTIAIRE (rangées 13-18) : coiffeuse + chaise + paravent.
  { id: 'v13-coif', kind: 'prop', ref: 'coiffeuse', pos: { x: 4, y: 14 } },
  { id: 'v13-chaise', kind: 'prop', ref: 'chaise', pos: { x: 6, y: 16 } },
  { id: 'v13-parav', kind: 'prop', ref: 'paravent', pos: { x: 3, y: 17 } },

  // 12 VESTIAIRES DES CHŒURS (Féminin) (rangées 19-30, grande) : coiffeuses, bancs, paravent, armoire.
  { id: 'v12-coif-1', kind: 'prop', ref: 'coiffeuse', pos: { x: 4, y: 20 } },
  { id: 'v12-coif-2', kind: 'prop', ref: 'coiffeuse', pos: { x: 4, y: 24 } },
  { id: 'v12-banc', kind: 'prop', ref: 'banc', pos: { x: 7, y: 22 } },
  { id: 'v12-parav', kind: 'prop', ref: 'paravent', pos: { x: 3, y: 27 } },
  { id: 'v12-armoire', kind: 'prop', ref: 'armoire', pos: { x: 8, y: 29 } },

  // 11 VESTIAIRES DES CHŒURS (Masculin) (rangées 31-38) : coiffeuse, banc, paravent.
  { id: 'v11-coif', kind: 'prop', ref: 'coiffeuse', pos: { x: 4, y: 32 } },
  { id: 'v11-banc', kind: 'prop', ref: 'banc', pos: { x: 7, y: 34 } },
  { id: 'v11-parav', kind: 'prop', ref: 'paravent', pos: { x: 3, y: 37 } },

  // 10 PASSAGE (gauche, rangées 39-44) : couloir presque nu — un banc, une caisse oubliée.
  { id: 'p10-banc', kind: 'prop', ref: 'banc', pos: { x: 4, y: 41 } },
  { id: 'p10-caisse', kind: 'prop', ref: 'caisse', pos: { x: 6, y: 43 } },

  // 15 BUREAU DU RÉGISSEUR — le plan le place côté GAUCHE en bas (rangées du foyer) ; ici dans le passage 10.
  { id: 'reg15-bureau', kind: 'prop', ref: 'bureau', pos: { x: 4, y: 39 }, foot: { w: 2, h: 1 } },
  { id: 'reg15-chaise', kind: 'prop', ref: 'chaise', pos: { x: 7, y: 40 } },

  // ═══════════════ SALLES LATÉRALES DROITE (z=0) ═══════════════
  // 20 STOCKAGE DES DÉCORS (rangées 1-12, grande) : châssis peints alignés, charrette, caisses, mannequin.
  { id: 's20-flat-1', kind: 'prop', ref: 'decor-flat', pos: { x: 37, y: 3 } },
  { id: 's20-flat-2', kind: 'prop', ref: 'decor-flat', pos: { x: 40, y: 3 } },
  { id: 's20-flat-3', kind: 'prop', ref: 'decor-flat', pos: { x: 37, y: 6 } },
  { id: 's20-charrette', kind: 'prop', ref: 'charrette', pos: { x: 39, y: 9 } },
  { id: 's20-caisse', kind: 'prop', ref: 'caisse', pos: { x: 36, y: 10 } },
  { id: 's20-mann', kind: 'prop', ref: 'mannequin', pos: { x: 41, y: 11 } },

  // 22 BUREAU DU CONCIERGE (sous-pièce coin, rangées 13-15) : petit bureau + chaise.
  { id: 'b22-bureau', kind: 'prop', ref: 'bureau', pos: { x: 40, y: 14 }, foot: { w: 2, h: 1 } },
  { id: 'b22-chaise', kind: 'prop', ref: 'chaise', pos: { x: 39, y: 13 } },

  // 21 STOCKAGE DES ACCESSOIRES (rangées 13-19) : étagères chargées, caisses, tonneaux, coffre.
  { id: 's21-etag-1', kind: 'prop', ref: 'etagere', pos: { x: 35, y: 14 } },
  { id: 's21-etag-2', kind: 'prop', ref: 'etagere', pos: { x: 35, y: 18 } },
  { id: 's21-tonneaux', kind: 'prop', ref: 'tonneaux-pile', pos: { x: 37, y: 17 } },
  { id: 's21-coffre', kind: 'prop', ref: 'coffre', pos: { x: 38, y: 19 } },

  // 23 BUREAU DU GESTIONNAIRE DES ACCESSOIRES (sous-pièce, rangées 20-22) : bureau + étagère.
  { id: 'b23-bureau', kind: 'prop', ref: 'bureau', pos: { x: 40, y: 21 }, foot: { w: 2, h: 1 } },
  { id: 'b23-etag', kind: 'prop', ref: 'etagere', pos: { x: 39, y: 20 } },

  // 24 RANGEMENTS DES COSTUMES (rangées 20-29) : portants à costumes alignés, armoire, mannequins.
  { id: 'c24-portant-1', kind: 'prop', ref: 'portant-costumes', pos: { x: 35, y: 23 } },
  { id: 'c24-portant-2', kind: 'prop', ref: 'portant-costumes', pos: { x: 35, y: 26 } },
  { id: 'c24-armoire', kind: 'prop', ref: 'armoire', pos: { x: 38, y: 24 } },
  { id: 'c24-mann', kind: 'prop', ref: 'mannequin', pos: { x: 37, y: 28 } },

  // 25 COUTURIÈRES (rangées 30-35) : tables de coupe, portant, mannequin, tabouret.
  { id: 'c25-table-1', kind: 'prop', ref: 'table', pos: { x: 36, y: 31 }, foot: { w: 2, h: 1 } },
  { id: 'c25-portant', kind: 'prop', ref: 'portant-costumes', pos: { x: 39, y: 33 } },
  { id: 'c25-mann', kind: 'prop', ref: 'mannequin', pos: { x: 36, y: 34 } },
  { id: 'c25-tab', kind: 'prop', ref: 'tabouret', pos: { x: 38, y: 31 } },

  // 26 CHARPENTERIE ET DÉCORS (rangées 36-42) : établi, chevalet de sciage, bois (caisse), tonneau.
  { id: 'c26-etabli', kind: 'prop', ref: 'etabli', pos: { x: 36, y: 37 }, foot: { w: 2, h: 1 } },
  { id: 'c26-scie', kind: 'prop', ref: 'scie-chevalet', pos: { x: 39, y: 39 } },
  { id: 'c26-caisse', kind: 'prop', ref: 'caisse', pos: { x: 36, y: 41 } },
  { id: 'c26-flat', kind: 'prop', ref: 'decor-flat', pos: { x: 41, y: 37 } },

  // 27 RÉSERVE GÉNÉRALE (rangées 43-50, grande) : caisses, tonneaux empilés, étagère, coffre.
  { id: 'r27-tonneaux-1', kind: 'prop', ref: 'tonneaux-pile', pos: { x: 36, y: 44 } },
  { id: 'r27-tonneaux-2', kind: 'prop', ref: 'tonneaux-pile', pos: { x: 40, y: 47 } },
  { id: 'r27-caisse-1', kind: 'prop', ref: 'caisse', pos: { x: 38, y: 45 } },
  { id: 'r27-caisse-2', kind: 'prop', ref: 'caisse', pos: { x: 37, y: 49 } },
  { id: 'r27-etag', kind: 'prop', ref: 'etagere', pos: { x: 36, y: 47 } },
  { id: 'r27-coffre', kind: 'prop', ref: 'coffre', pos: { x: 40, y: 50 } },

  // ═══════════════ PREMIER ÉTAGE (z=1) — LOGES & BALCONS tiérés autour du puits ovale ═══════════════
  // Ring gauche (cols 2-8) : sièges face au PUITS (Est). Deux rangs tiérés par tranche de hauteur.
  ...seatCol('et-Lring1', 5, 17, 31, 'E', 1),
  ...seatCol('et-Lring2', 7, 18, 30, 'E', 1),
  // Ring droit (cols 36-41) : sièges face au PUITS (Ouest).
  ...seatCol('et-Rring1', 38, 17, 31, 'O', 1),
  ...seatCol('et-Rring2', 36, 18, 30, 'O', 1),
  // Balcons CENTRAUX bas (33/34/35, rangées 41-45, côté foyer) : rangs courbes face au puits (Nord).
  ...seatRow('et-balc-43', 43, 11, 19, 'N', 1), ...seatRow('et-balc-43b', 43, 23, 31, 'N', 1),
  ...seatRow('et-balc-45', 45, 9, 19, 'N', 1), ...seatRow('et-balc-45b', 45, 23, 33, 'N', 1),
  // Garde-corps + appliques des loges (le long du couloir de service).
  { id: 'et-app-Lg1', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 20 }, z: 1 },
  { id: 'et-app-Lg2', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 28 }, z: 1 },
  { id: 'et-app-Rg1', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 20 }, z: 1 },
  { id: 'et-app-Rg2', kind: 'prop', ref: 'applique-murale', pos: { x: 41, y: 28 }, z: 1 },

  // 30 LOGE ROYALE (fond-centre, marbre rangées 1-4, axe scène) : canapés d'honneur face au puits (Sud) +
  //   appliques. 31 ANTICHAMBRE DUCALE derrière.
  { id: 'royale-canape-g', kind: 'prop', ref: 'canape', pos: { x: 19, y: 3 }, facing: 'S', z: 1 },
  { id: 'royale-canape-d', kind: 'prop', ref: 'canape', pos: { x: 23, y: 3 }, facing: 'S', z: 1 },
  { id: 'royale-fauteuil', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 21, y: 2 }, facing: 'S', z: 1 },
  { id: 'royale-app-g', kind: 'prop', ref: 'applique-murale', pos: { x: 18, y: 1 }, z: 1 },
  { id: 'royale-app-d', kind: 'prop', ref: 'applique-murale', pos: { x: 24, y: 1 }, z: 1 },

  // 29 LOGE DES NOBLES (haut, de part et d'autre de la loge royale) : fauteuils face au puits.
  { id: 'noble-g-1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 15, y: 16 }, facing: 'S', z: 1 },
  { id: 'noble-g-2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 14, y: 17 }, facing: 'S', z: 1 },
  { id: 'noble-d-1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 28, y: 16 }, facing: 'S', z: 1 },
  { id: 'noble-d-2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 29, y: 17 }, facing: 'S', z: 1 },

  // ═══════════════ GALERIE / BARS / SALONS de l'étage (z=1, débordent sur le foyer rangées 46-52) ═══════════════
  // 38 SALON DES DAMES (coin gauche, arrivée escalier 8) : comptoir de bar, tables, fauteuils, plante.
  { id: 'salon-d-comptoir', kind: 'prop', ref: 'comptoir', pos: { x: 4, y: 48 }, z: 1 },
  { id: 'salon-d-table', kind: 'prop', ref: 'table', pos: { x: 6, y: 50 }, z: 1 },
  { id: 'salon-d-ft', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 5, y: 51 }, z: 1 },
  { id: 'salon-d-plante', kind: 'prop', ref: 'plante-pot', pos: { x: 3, y: 50 }, z: 1 },
  // 36 BAR DES BALCONS gauche : comptoir + tonneaux + étagère à bouteilles.
  { id: 'bar-g-comptoir', kind: 'prop', ref: 'comptoir', pos: { x: 9, y: 47 }, z: 1 },
  { id: 'bar-g-etag', kind: 'prop', ref: 'etagere', pos: { x: 7, y: 46 }, z: 1 },
  { id: 'bar-g-tonneau', kind: 'prop', ref: 'tonneau', pos: { x: 11, y: 46 }, z: 1 },

  // 39 SALON DES SEIGNEURS (coin droit, arrivée escalier 9) : comptoir, table, canapé, plante.
  { id: 'salon-s-comptoir', kind: 'prop', ref: 'comptoir', pos: { x: 39, y: 48 }, z: 1 },
  { id: 'salon-s-table', kind: 'prop', ref: 'table', pos: { x: 37, y: 50 }, z: 1 },
  { id: 'salon-s-canape', kind: 'prop', ref: 'canape', pos: { x: 38, y: 51 }, facing: 'N', z: 1 },
  { id: 'salon-s-plante', kind: 'prop', ref: 'plante-pot', pos: { x: 40, y: 50 }, z: 1 },
  // 36 BAR DES BALCONS droit : comptoir + étagère + tonneau.
  { id: 'bar-d-comptoir', kind: 'prop', ref: 'comptoir', pos: { x: 34, y: 47 }, z: 1 },
  { id: 'bar-d-etag', kind: 'prop', ref: 'etagere', pos: { x: 36, y: 46 }, z: 1 },
  { id: 'bar-d-tonneau', kind: 'prop', ref: 'tonneau', pos: { x: 32, y: 46 }, z: 1 },

  // Deux lustres du foyer (z=1, flottant au-dessus du foyer du rez).
  { id: 'foy-lustre-g', kind: 'prop', ref: 'lustre-opera', pos: { x: 14, y: 49 }, z: 1 },
  { id: 'foy-lustre-d', kind: 'prop', ref: 'lustre-opera', pos: { x: 29, y: 49 }, z: 1 },
];

export const scenarioEntities = ents;

const scene: Scene = {
  ...buildOperaFloorplan(),
  entities: ents,
  startMessage:
    'Le Théâtre Staatsoper, reconstitué d’après les plans : du foyer, le parterre en éventail s’élève vers la scène ; au-dessus, les loges et balcons cernent le vide central, dominés par la loge royale.',
};

export const scenario: TestScenario = {
  id: 'opera-plan',
  order: 22,
  icon: '🏛',
  title: 'Opéra — Plan fidèle',
  tests:
    'Théâtre Staatsoper reconstruit ET meublé du plan officiel (p.40/41) : parterre en ÉVENTAIL de fauteuils, SCÈNE surélevée (rideau + châssis de décor), FOSSE d’orchestre (pupitres) ; salles de service propres (salle verte, vestiaires des chœurs à coiffeuses/paravents, bureaux, stockages de décors/accessoires, rangements de costumes à portants, couturières, charpenterie, réserve) ; foyer à grand escalier ; étage : loges & balcons tiérés autour du puits, loge royale en canapés, bars & salons des balcons.',
  partyNote: 'Pré-tirés',
  makeParty: () => makePregens(),
  scene,
};
