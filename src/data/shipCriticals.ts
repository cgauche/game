import shipCriticalsJson from './ship-criticals.json';
import riverCriticalsJson from './river-criticals.json';
import type { ShipLocation } from '../engine/combat';
import type { GameOp } from '../engine/ops';
import type { Difficulty } from '../engine/types';

/** Test encouru par l'ÉQUIPAGE sur un Critique de coque — compétence + difficulté en DONNÉE, conséquence
 *  d'échec en `GameOp` (langue unique). `skillId`/`difficulty` ABSENTS = dégâts AUTOMATIQUES (pas de Test —
 *  T2C « les échardes infligent +5 Dégâts aux rameurs »). `crewTarget` : `poste` (équipage d'un poste tiré
 *  au sort — MDG « Canon détaché », défaut) ou `deck` (toute personne exposée sur le pont — T2C
 *  gréement/superstructure « Toute personne présente sur le pont… »). Pas de valeur/règle codée en dur. */
export interface ShipCrewTest {
  skillId?: string;
  difficulty?: Difficulty;
  crewTarget?: 'poste' | 'deck';
  /** Appliqué à CHAQUE servant qui RATE le Test (ou à tous si aucun Test — ex. `[{op:'wounds', amount:12}]`). */
  onFail: GameOp[];
}

/**
 * Tables de Blessures critiques sur un NAVIRE — MDG ch.13 « Critiques sur un navire » (p.124),
 * transcrites verbatim. MÊME patron que `criticals.json` (LDB Traumatisme) : la DONNÉE vit dans
 * `ship-criticals.json` (éditable), ce module n'est que le TYPE + le chargement + le mapping des
 * Localisations sur `ShipLocation`.
 *
 * Un Critique de navire est tiré sur un d10 dans la table de la Localisation touchée (MDG ch.13 :
 * double sur un coup réussi, ou tout coup une fois le score de Blessures tombé à 0). Champs
 * MÉCANISABLES (réutilisent les briques existantes — pas de mécanique parallèle) :
 *  - `shrapnel` : Éclats (Indice) → un nb de membres d'équipage = Indice subissent 9 Dégâts ;
 *  - `leak`     : Voie d'eau (Indice) → cumul qui coule le navire à Endurance ;
 *  - `fire`     : nb d'États En flammes infligés à la Localisation ;
 *  - `hullCrits`: Critiques SUPPLÉMENTAIRES sur la Coque (notation de dés, ex. « 1d10 »).
 * `note` = effets LONG TERME / narratifs verbatim (réductions de Man/Mouvement, réparations, chutes
 * du gréement…), journalisés mais arbitrés/câblés au combat naval. L'Équipage touché suit les
 * Critiques de personnage EXISTANTS (LDB/AA) — aucune table dupliquée.
 */
export interface ShipCritEntry {
  min: number;
  max: number;
  /** id STABLE (slug) — toute réf croisée passe par lui, JAMAIS le `name` (label d'affichage). */
  id: string;
  name: string;
  /** Effets « État » immédiats AUTHORÉS en `GameOp` (En flammes / Voie d'eau via op `condition`) —
   *  langue UNIQUE, appliqués par `applyOps` (comme tout effet). */
  ops?: GameOp[];
  /** Éclats (Indice) — `shrapnel` membres d'équipage subissent 9 Dégâts (MDG ch.13). */
  shrapnel?: number;
  /** Critiques supplémentaires sur la Coque (notation de dés). */
  hullCrits?: string;
  /** « Canon détaché » (MDG ch.13 l.763-764) : l'équipage du poste tiré au sort encourt ce Test ; un échec
   *  applique `onFail` (le canon RESTE à bord — ≠ « Canon perdu » qui utilise l'op `removeShipPoste` dans `ops`). */
  crewTest?: ShipCrewTest;
  note: string;
}
export type ShipCritTable = ShipCritEntry[];

/** Localisations de navire dotées d'une table de Critiques (l'Équipage utilise les Critiques de
 *  personnage ; les Équipements n'ont pas d'enum de coque touchable hors leur propre table). */
export type ShipCritKey = Exclude<ShipLocation, 'equipage'>;

/** Effet des **Éclats** (MDG ch.13) infligé à CHAQUE marin touché — authoré UNE fois en `GameOp` (langue
 *  unique), plus aucun littéral « 9 Dégâts » en dur dans le moteur. Le NOMBRE de marins touchés = l'Indice
 *  `shrapnel` de l'entrée de Critique (per-entry) ; l'effet, lui, est partagé (per-règle). */
export const SHRAPNEL_HIT = shipCriticalsJson.shrapnelHit as GameOp[];

const T = shipCriticalsJson.tables as Record<ShipCritKey, ShipCritTable>;

/** Jeu MDG (mer) — ne couvre QUE ses 5 Localisations navales (pas gouvernail/superstructure, fluviales T2C).
 *  Type INFÉRÉ (5 clés) → assignable à `Partial<Record<ShipCritKey, …>>` du jeu, sans exiger les clés fluviales. */
export const SHIP_CRITICAL_TABLES = {
  cargaison: T.cargaison,
  greement: T.greement,
  coque: T.coque,
  avirons: T.avirons,
  equipements: T.equipements,
};

/** Jeu de tables de Critiques d'une coque : effet des Éclats (per-règle) + tables par Localisation
 *  (chaque jeu ne couvre QUE ses Localisations — MDG couvre cargaison/équipements, T2C gouvernail/
 *  superstructure ; la table de Localisation appariée ne produit jamais une clé absente du jeu). */
export interface ShipCritSet {
  shrapnelHit: GameOp[];
  tables: Partial<Record<ShipCritKey, ShipCritTable>>;
}

/** Jeu MDG (mer, ch.13) — Éclats 9 Dégâts. */
export const SHIP_CRIT_SET: ShipCritSet = { shrapnelHit: SHRAPNEL_HIT, tables: SHIP_CRITICAL_TABLES };

/** Jeu T2C (fleuve, ch.5) — Éclats +5 Dégâts, Localisations Gréement/Rames/Gouvernail/Coque/Superstructure. */
export const RIVER_CRIT_SET: ShipCritSet = {
  shrapnelHit: riverCriticalsJson.shrapnelHit as GameOp[],
  tables: riverCriticalsJson.tables as Partial<Record<ShipCritKey, ShipCritTable>>,
};

/** Résout le jeu de Critiques d'une coque par l'id de sa `criticalTable` (`hull.criticalTable`). Absent /
 *  inconnu → jeu MDG naval (défaut, comportement historique). */
export function shipCritSet(id?: string | null): ShipCritSet {
  return id === 'river-criticals' ? RIVER_CRIT_SET : SHIP_CRIT_SET;
}
