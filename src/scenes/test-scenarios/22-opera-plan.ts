import { makePregens } from '../../data/pregens';
import { buildOperaFloorplan, parterreSeatCells } from '../opera/floorplan';
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
 * Bandes (rangées, cf. floorplan.ts reconstruit du schéma de murs) : pièces du fond 1-4 · Scène 5-14
 * (cols 13-30) · Fosse 15-19 (cols 16-26) · Parterre en éventail 20-43 · Foyer 45-50 · entrées 51-58.
 * Fan parterre : demi-largeur 5 (haut, sous la scène) → 13 (bas, vers le foyer).
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

  // ═══════════════ SCÈNE (19, z=0, rangées 5-14, cols 13-30, planches surélevées) ═══════════════
  // Rideau de scène en travers du fond (côté coulisses, regarde le public au sud), sur toute la largeur.
  ...[13, 16, 19, 22, 25, 28].map((x, i): SceneEntity => ({ id: `rideau-${i}`, kind: 'prop', ref: 'rideau-scene', pos: { x, y: 5 }, facing: 'S', foot: { w: 3, h: 1 } })),
  // Décors en place sur la scène (châssis peints + un praticable) — le plan montre des panneaux au sol.
  { id: 'scene-flat-1', kind: 'prop', ref: 'decor-flat', pos: { x: 15, y: 10 } },
  { id: 'scene-flat-2', kind: 'prop', ref: 'decor-flat', pos: { x: 28, y: 10 } },
  { id: 'scene-colonne', kind: 'prop', ref: 'colonne-brisee', pos: { x: 21, y: 9 } },

  // ═══════════════ COULISSES (16, z=0, rangées 1-4 derrière la scène) ═══════════════
  // Décors en attente, accessoires : châssis, mannequins de costumier, caisses, râtelier d'accessoires.
  { id: 'cl-flat-1', kind: 'prop', ref: 'decor-flat', pos: { x: 13, y: 2 } },
  { id: 'cl-mann-1', kind: 'prop', ref: 'mannequin', pos: { x: 16, y: 2 } },
  { id: 'cl-caisse-1', kind: 'prop', ref: 'caisse', pos: { x: 19, y: 3 } },
  { id: 'cl-rack', kind: 'prop', ref: 'rack-armes', pos: { x: 24, y: 2 } },
  { id: 'cl-caisse-2', kind: 'prop', ref: 'caisse', pos: { x: 27, y: 3 } },
  { id: 'cl-flat-2', kind: 'prop', ref: 'decor-flat', pos: { x: 30, y: 2 } },

  // ═══════════════ FOSSE D'ORCHESTRE (18, z=0, rangées 15-19, gx 16-26, planches en contrebas) ═══════════
  // Pupitres des musiciens disposés en arc face à la scène (le plan montre une rangée de pupitres + tabourets).
  ...[17, 19, 21, 23, 25].map((x, i): SceneEntity => ({ id: `pup-${i}`, kind: 'prop', ref: 'pupitre-chef', pos: { x, y: 16 }, facing: 'N' })),
  { id: 'pup-chef', kind: 'prop', ref: 'pupitre-chef', pos: { x: 21, y: 18 }, facing: 'N' },
  { id: 'orch-tab-1', kind: 'prop', ref: 'tabouret', pos: { x: 18, y: 18 } },
  { id: 'orch-tab-2', kind: 'prop', ref: 'tabouret', pos: { x: 24, y: 18 } },

  // ═══════════════ PARTERRE / ORCHESTRE (17, z=0, rangées 17-44, éventail) ═══════════════
  // Fauteuils 1×1 remplissant TOUT l'éventail, de bord à bord (DENSE comme le plan p.40 : ≈14 rangs
  // pleins), un rang sur deux (circulation entre les rangs), fine allée centrale de 2 cases. Toute la
  // géométrie vient de `parterreSeatCells` (floorplan = source unique) ; ils regardent la scène (Nord).
  ...parterreSeatCells().map((c, i): SceneEntity => ({ id: `pt-${i}`, kind: 'prop', ref: 'siege', pos: c, facing: 'N' })),

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

  // ═══════════════ SALLES LATÉRALES GAUCHE (z=0) — DENSÉMENT meublées, pièce par pièce (plan p.40) ═══════
  // Géométrie (cf. floorplan.ts) : bande HAUTE gy 1-14 (refend vertical gx6) ; puis Vestiaires des chœurs
  //   Féminin gy 15-23, Masculin gy 24-33, Passage/Régisseur gy 34-43. Les pièces narrent vers le mur
  //   diagonal de l'éventail (gx1..Lf(y)) : on garnit la partie large, côté mur extérieur (gx1..~10).

  // 14 SALLE VERTE / 13 VESTIAIRE (bande haute gy 1-14, deux colonnes gx1-6 et gx6-13) : détente des
  //   artistes + coiffeuses. Colonne gx1-6 : coin repas + bancs ; colonne gx6-13 : loges/coiffeuses.
  { id: 'sv-table', kind: 'prop', ref: 'table', pos: { x: 3, y: 6 }, foot: { w: 2, h: 1 } },
  { id: 'sv-chaise-1', kind: 'prop', ref: 'chaise', pos: { x: 2, y: 8 } },
  { id: 'sv-chaise-2', kind: 'prop', ref: 'chaise', pos: { x: 5, y: 8 } },
  { id: 'sv-banc-1', kind: 'prop', ref: 'banc', pos: { x: 2, y: 3 } },
  { id: 'sv-banc-2', kind: 'prop', ref: 'banc', pos: { x: 2, y: 11 } },
  { id: 'sv-etagere', kind: 'prop', ref: 'etagere', pos: { x: 4, y: 2 } },
  { id: 'sv-canape', kind: 'prop', ref: 'canape', pos: { x: 2, y: 13 }, facing: 'E' },
  { id: 'sv-coif-1', kind: 'prop', ref: 'coiffeuse', pos: { x: 8, y: 2 } },
  { id: 'sv-coif-2', kind: 'prop', ref: 'coiffeuse', pos: { x: 11, y: 2 } },
  { id: 'sv-miroir-1', kind: 'prop', ref: 'miroir', pos: { x: 8, y: 6 } },
  { id: 'sv-chaise-3', kind: 'prop', ref: 'chaise', pos: { x: 10, y: 6 } },
  { id: 'sv-parav', kind: 'prop', ref: 'paravent', pos: { x: 12, y: 9 } },
  { id: 'sv-portant', kind: 'prop', ref: 'portant-costumes', pos: { x: 8, y: 11 } },
  { id: 'sv-mann', kind: 'prop', ref: 'mannequin', pos: { x: 11, y: 12 } },

  // 12 VESTIAIRES DES CHŒURS (Féminin) (gy 15-23, grande) : rangée de coiffeuses-miroirs + paravents,
  //   bancs, portants à robes, armoire — dense comme une loge collective.
  { id: 'v12-coif-1', kind: 'prop', ref: 'coiffeuse', pos: { x: 2, y: 16 } },
  { id: 'v12-coif-2', kind: 'prop', ref: 'coiffeuse', pos: { x: 5, y: 16 } },
  { id: 'v12-coif-3', kind: 'prop', ref: 'coiffeuse', pos: { x: 8, y: 16 } },
  { id: 'v12-miroir', kind: 'prop', ref: 'miroir', pos: { x: 11, y: 16 } },
  { id: 'v12-chaise-1', kind: 'prop', ref: 'chaise', pos: { x: 3, y: 18 } },
  { id: 'v12-chaise-2', kind: 'prop', ref: 'chaise', pos: { x: 6, y: 18 } },
  { id: 'v12-banc', kind: 'prop', ref: 'banc', pos: { x: 9, y: 19 } },
  { id: 'v12-portant', kind: 'prop', ref: 'portant-costumes', pos: { x: 2, y: 20 } },
  { id: 'v12-parav', kind: 'prop', ref: 'paravent', pos: { x: 5, y: 21 } },
  { id: 'v12-mann', kind: 'prop', ref: 'mannequin', pos: { x: 8, y: 21 } },
  { id: 'v12-armoire', kind: 'prop', ref: 'armoire', pos: { x: 2, y: 22 } },

  // 11 VESTIAIRES DES CHŒURS (Masculin) (gy 24-33) : coiffeuses, bancs, portants, miroir, armoire.
  { id: 'v11-coif-1', kind: 'prop', ref: 'coiffeuse', pos: { x: 2, y: 25 } },
  { id: 'v11-coif-2', kind: 'prop', ref: 'coiffeuse', pos: { x: 5, y: 25 } },
  { id: 'v11-miroir', kind: 'prop', ref: 'miroir', pos: { x: 8, y: 25 } },
  { id: 'v11-banc-1', kind: 'prop', ref: 'banc', pos: { x: 2, y: 27 } },
  { id: 'v11-banc-2', kind: 'prop', ref: 'banc', pos: { x: 6, y: 28 } },
  { id: 'v11-portant', kind: 'prop', ref: 'portant-costumes', pos: { x: 2, y: 30 } },
  { id: 'v11-parav', kind: 'prop', ref: 'paravent', pos: { x: 5, y: 31 } },
  { id: 'v11-armoire', kind: 'prop', ref: 'armoire', pos: { x: 2, y: 32 } },

  // 10 PASSAGE + 15 BUREAU DU RÉGISSEUR (gy 34-43) : bureau du régisseur (papiers, coffre) + bancs.
  { id: 'reg15-bureau', kind: 'prop', ref: 'bureau', pos: { x: 2, y: 35 }, foot: { w: 2, h: 1 } },
  { id: 'reg15-chaise', kind: 'prop', ref: 'chaise', pos: { x: 5, y: 35 } },
  { id: 'reg15-etag', kind: 'prop', ref: 'etagere', pos: { x: 2, y: 37 } },
  { id: 'reg15-coffre', kind: 'prop', ref: 'coffre', pos: { x: 5, y: 38 } },
  { id: 'p10-banc-1', kind: 'prop', ref: 'banc', pos: { x: 2, y: 40 } },
  { id: 'p10-caisse', kind: 'prop', ref: 'caisse', pos: { x: 4, y: 41 } },

  // ═══════════════ SALLES LATÉRALES DROITE (z=0) — DENSÉMENT meublées ═══════════════
  // Géométrie : bande HAUTE gy 1-14 (Stockage décors gx30-37 + petites pièces NE gx37-42) ; Rangements
  //   costumes gy 15-23, Couturières gy 24-30, Charpenterie/Réserve gy 31-43.

  // 20 STOCKAGE DES DÉCORS (bande haute, gx30-37) : châssis peints alignés serrés, charrette, caisses.
  { id: 's20-flat-1', kind: 'prop', ref: 'decor-flat', pos: { x: 31, y: 2 } },
  { id: 's20-flat-2', kind: 'prop', ref: 'decor-flat', pos: { x: 33, y: 2 } },
  { id: 's20-flat-3', kind: 'prop', ref: 'decor-flat', pos: { x: 35, y: 2 } },
  { id: 's20-flat-4', kind: 'prop', ref: 'decor-flat', pos: { x: 31, y: 5 } },
  { id: 's20-flat-5', kind: 'prop', ref: 'decor-flat', pos: { x: 33, y: 5 } },
  { id: 's20-charrette', kind: 'prop', ref: 'charrette', pos: { x: 35, y: 7 } },
  { id: 's20-caisse-1', kind: 'prop', ref: 'caisse', pos: { x: 31, y: 8 } },
  { id: 's20-caisse-2', kind: 'prop', ref: 'caisse', pos: { x: 33, y: 9 } },
  { id: 's20-tonneaux', kind: 'prop', ref: 'tonneaux-pile', pos: { x: 35, y: 10 } },
  { id: 's20-mann', kind: 'prop', ref: 'mannequin', pos: { x: 31, y: 12 } },
  { id: 's20-colonne', kind: 'prop', ref: 'colonne-brisee', pos: { x: 34, y: 12 } },

  // 22 BUREAU DU CONCIERGE / 23 GESTIONNAIRE (petites pièces NE gx37-42, empilées) : bureaux + étagères.
  { id: 'b22-bureau', kind: 'prop', ref: 'bureau', pos: { x: 39, y: 6 }, foot: { w: 2, h: 1 } },
  { id: 'b22-chaise', kind: 'prop', ref: 'chaise', pos: { x: 38, y: 7 } },
  { id: 'b23-bureau', kind: 'prop', ref: 'bureau', pos: { x: 39, y: 11 }, foot: { w: 2, h: 1 } },
  { id: 'b23-etag', kind: 'prop', ref: 'etagere', pos: { x: 38, y: 13 } },

  // 24 RANGEMENTS DES COSTUMES (gy 15-23) : portants à costumes serrés, armoires, mannequins, coffres.
  { id: 'c24-portant-1', kind: 'prop', ref: 'portant-costumes', pos: { x: 31, y: 16 } },
  { id: 'c24-portant-2', kind: 'prop', ref: 'portant-costumes', pos: { x: 34, y: 16 } },
  { id: 'c24-portant-3', kind: 'prop', ref: 'portant-costumes', pos: { x: 37, y: 16 } },
  { id: 'c24-armoire-1', kind: 'prop', ref: 'armoire', pos: { x: 40, y: 16 } },
  { id: 'c24-mann-1', kind: 'prop', ref: 'mannequin', pos: { x: 31, y: 19 } },
  { id: 'c24-mann-2', kind: 'prop', ref: 'mannequin', pos: { x: 34, y: 19 } },
  { id: 'c24-coffre', kind: 'prop', ref: 'coffre', pos: { x: 37, y: 20 } },
  { id: 'c24-portant-4', kind: 'prop', ref: 'portant-costumes', pos: { x: 40, y: 20 } },
  { id: 'c24-armoire-2', kind: 'prop', ref: 'armoire', pos: { x: 31, y: 22 } },

  // 25 COUTURIÈRES (gy 24-30) : tables de coupe, portants, mannequins, tabourets, étagère à étoffes.
  { id: 'c25-table-1', kind: 'prop', ref: 'table', pos: { x: 31, y: 25 }, foot: { w: 2, h: 1 } },
  { id: 'c25-tab-1', kind: 'prop', ref: 'tabouret', pos: { x: 34, y: 25 } },
  { id: 'c25-table-2', kind: 'prop', ref: 'table', pos: { x: 36, y: 25 }, foot: { w: 2, h: 1 } },
  { id: 'c25-mann-1', kind: 'prop', ref: 'mannequin', pos: { x: 39, y: 25 } },
  { id: 'c25-portant', kind: 'prop', ref: 'portant-costumes', pos: { x: 31, y: 28 } },
  { id: 'c25-mann-2', kind: 'prop', ref: 'mannequin', pos: { x: 34, y: 28 } },
  { id: 'c25-etag', kind: 'prop', ref: 'etagere', pos: { x: 37, y: 28 } },
  { id: 'c25-tab-2', kind: 'prop', ref: 'tabouret', pos: { x: 40, y: 28 } },

  // 26 CHARPENTERIE + 27 RÉSERVE GÉNÉRALE (gy 31-43, l'atelier DÉCROÎT vers l'éventail : on garnit le
  //   côté mur extérieur gx 34-42 où il reste de la place) : établis, scie, bois, tonneaux, caisses, coffres.
  { id: 'c26-etabli', kind: 'prop', ref: 'etabli', pos: { x: 34, y: 32 }, foot: { w: 2, h: 1 } },
  { id: 'c26-scie', kind: 'prop', ref: 'scie-chevalet', pos: { x: 37, y: 32 } },
  { id: 'c26-flat', kind: 'prop', ref: 'decor-flat', pos: { x: 40, y: 32 } },
  { id: 'c26-caisse-1', kind: 'prop', ref: 'caisse', pos: { x: 39, y: 34 } },
  { id: 'r27-tonneaux-1', kind: 'prop', ref: 'tonneaux-pile', pos: { x: 35, y: 35 } },
  { id: 'r27-caisse-2', kind: 'prop', ref: 'caisse', pos: { x: 37, y: 36 } },
  { id: 'r27-etag', kind: 'prop', ref: 'etagere', pos: { x: 40, y: 36 } },
  { id: 'r27-tonneaux-2', kind: 'prop', ref: 'tonneaux-pile', pos: { x: 36, y: 38 } },
  { id: 'r27-coffre', kind: 'prop', ref: 'coffre', pos: { x: 39, y: 39 } },
  { id: 'r27-caisse-3', kind: 'prop', ref: 'caisse', pos: { x: 38, y: 41 } },

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
  { id: 'noble-g-1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 16, y: 15 }, facing: 'S', z: 1 },
  { id: 'noble-g-2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 14, y: 16 }, facing: 'S', z: 1 },
  { id: 'noble-d-1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 26, y: 15 }, facing: 'S', z: 1 },
  { id: 'noble-d-2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 28, y: 16 }, facing: 'S', z: 1 },

  // ═══════════════ GALERIE / BARS / SALONS de l'étage (z=1, débordent sur le foyer rangées 46-52) ═══════════════
  // 38 SALON DES DAMES (coin gauche, arrivée escalier 8) : comptoir de bar, tables, fauteuils, plante.
  { id: 'salon-d-comptoir', kind: 'prop', ref: 'comptoir', pos: { x: 4, y: 48 }, z: 1 },
  { id: 'salon-d-table', kind: 'prop', ref: 'table', pos: { x: 6, y: 50 }, z: 1 },
  { id: 'salon-d-ft', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 5, y: 49 }, z: 1 },
  { id: 'salon-d-plante', kind: 'prop', ref: 'plante-pot', pos: { x: 3, y: 50 }, z: 1 },
  // 36 BAR DES BALCONS gauche : comptoir + tonneaux + étagère à bouteilles.
  { id: 'bar-g-comptoir', kind: 'prop', ref: 'comptoir', pos: { x: 9, y: 47 }, z: 1 },
  { id: 'bar-g-etag', kind: 'prop', ref: 'etagere', pos: { x: 7, y: 46 }, z: 1 },
  { id: 'bar-g-tonneau', kind: 'prop', ref: 'tonneau', pos: { x: 11, y: 46 }, z: 1 },

  // 39 SALON DES SEIGNEURS (coin droit, arrivée escalier 9) : comptoir, table, canapé, plante.
  { id: 'salon-s-comptoir', kind: 'prop', ref: 'comptoir', pos: { x: 39, y: 48 }, z: 1 },
  { id: 'salon-s-table', kind: 'prop', ref: 'table', pos: { x: 37, y: 50 }, z: 1 },
  { id: 'salon-s-canape', kind: 'prop', ref: 'canape', pos: { x: 38, y: 49 }, facing: 'N', z: 1 },
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
