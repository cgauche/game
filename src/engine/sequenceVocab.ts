/**
 * VOCABULAIRE DE SÉQUENCE — les FORMES DE DONNÉE qu'une entrée de catalogue peut déclarer pour se
 * faire jouer en manches (#1279). Elles vivent dans le MOTEUR parce que ce sont des données de
 * RÈGLE, lues des deux côtés de la frontière : par les catalogues du moteur (`tavernGame.ts` et son
 * `tavernGames.json`) et par le contrat d'orchestrateur du store (`state/sequenceContract.ts`), qui
 * les republie dans ses `SequenceParams`. Aucune logique ici : ce fichier ne fait que DIRE.
 */
import type { CharKey } from './types';
import type { GameOp } from './ops';

/** UNE LIGNE de table de score par PLAGE de DR — lue par `findTableEntry` (`engine/tables.ts`).
 *  Torchon trempé (NADAJ 16 l.111) : jambe 1 point, corps 2 points à partir de 3 DR, tête 3 points à
 *  partir de 6 DR. `label` est de l'AFFICHAGE (la logique lit `points`). */
export interface SequenceTableRow {
  min: number;
  max: number;
  points: number;
  label: string;
}

/** EFFETS PAR MANCHE, en DONNÉE : `winner` va au vainqueur de la manche ; `attrition` va à TOUS les
 *  participants toutes les `attritionEvery` manches — nombre fixe, ou Bonus de Caractéristique DU
 *  PORTEUR (Bras de fer NADAJ 16 l.35 : « Pour chaque Bonus d'Endurance tours qui passent sans que
 *  personne n'ait gagné, vous gagnez + 1 État *Exténué* »). */
export interface SequenceRoundOps {
  winner?: readonly GameOp[];
  attrition?: readonly GameOp[];
  attritionEvery?: number | { charBonus: CharKey };
}

/** PHASES d'une séquence (mi-temps, sets) : `count` phases de `rounds` manches chacune. Middenball
 *  NADAJ 16 l.121 : « Une partie dure deux mi-temps de trois tours chacune ». */
export interface SequencePhases {
  count: number;
  rounds: number;
}

/* ── FAMILLE (5) : MISE, POT, ABANDON, ÉLIMINATION ───────────────────────────────────────────────
 * Une séquence où l'on ne compte pas des DR mais de l'ARGENT : chaque joueur ALIMENTE un pot, un
 * tour de dés le fait grossir, se vider ou changer de mains, et un joueur peut en SORTIR (de son gré
 * ou contraint). Premier client : l'Al-zahr (`NADAJ 16 l.17`).
 *
 * FORME — directive utilisateur du 2026-08-13 (verbatim au ticket #1279) : « Comme les games iOS
 * [GameOps], rendre le vocabulaire le plus générique et parametrable possible ». D'où : aucun champ
 * ne nomme son premier client, chaque mécanisme est PARAMÉTRÉ (combien de dés, quelle plage de
 * cible, combien de mises déplace un effet, combien de manches par joueur), et l'EFFET d'une plage
 * est un NOM ENREGISTRÉ résolu par une fonction pure — exactement le patron `GameOp` : un verbe
 * générique + ses paramètres, jamais un cas d'usage figé au type. Un jeu à enchère N+1 dont les
 * mécanismes existent déjà est une entrée JSON, zéro ligne de TS. */

/** Les DÉS d'un tour : `count` dés de `faces` faces, totalisés. */
export interface SequenceDice {
  count: number;
  faces: number;
}

/** UNE PLAGE de résultat du tour et l'EFFET qu'elle déclenche — `effect` est le nom d'un effet
 *  ENREGISTRÉ (`registerSequencePotEffect`, `state/sequenceCore`), jamais un id de jeu, et `mises`
 *  le PARAMÈTRE que cet effet applique (combien de mises il déplace, défaut 1). `label` est de
 *  l'AFFICHAGE. */
export interface SequencePotRow {
  min: number;
  max: number;
  effect: string;
  /** Nombre de MISES que l'effet déplace (reprise dans le pot, remise à payer) — défaut 1. */
  mises?: number;
  label: string;
}

/** RÈGLES DE POT d'une séquence, en donnée. */
export interface SequencePotRules {
  dice: SequenceDice;
  /** Plage dans laquelle se choisit le NOMBRE CIBLE, quand la séquence en joue un. Absente : aucune
   *  cible n'est annoncée, et les effets qui la lisent ne se déclarent pas. */
  targetRange?: { min: number; max: number };
  /** Plages du tour, lues par `findTableEntry` sur le total des dés. */
  rows: readonly SequencePotRow[];
  /** Manches d'une partie PAR JOUEUR assis à la table (défaut 1 — chacun en ouvre une). */
  manchesPerPlayer?: number;
  /** TOURS qu'une manche peut prendre avant que l'anti-boucle du socle ne coupe la partie. Ce n'est
   *  PAS une règle : c'est l'unité de borne de cette famille — un tour n'y est qu'un lancer de dés,
   *  quand le socle, lui, compte des manches de Test opposé. La borne effective de la séquence s'en
   *  dérive (manches × ce nombre), sous le plafond absolu du contrat. */
  roundsPerManche?: number;
}

/** CE QUE VOIT un effet : le total des dés, la cible en cours, la mise unitaire, le pot, et le
 *  paramètre `mises` de SA plage — tout l'argent en sous de cuivre. PUR : un effet ne lit rien
 *  d'autre, et ne connaît ni joueur ni bourse. */
export interface SequencePotTurn {
  roll: number;
  target: number;
  ante: number;
  pot: number;
  mises: number;
}

/** CE QUE REND un effet — chaque champ est une CONSÉQUENCE possible d'un tour ; le réducteur du
 *  domaine les applique, l'effet ne mute rien. */
export interface SequencePotOutcome {
  /** Le joueur remporte la manche et empoche le pot. */
  wins?: boolean;
  /** Le joueur reprend ce montant (sous) du pot, la manche continue. */
  takes?: number;
  /** Le joueur quitte la manche. */
  out?: boolean;
  /** Le joueur doit trancher : payer `owes` pour rester, ou abandonner la manche. */
  choose?: boolean;
  /** Ce que coûte le maintien dans la manche (sous) — lu avec `choose`. */
  owes?: number;
  /** Nouvelle cible pour le joueur suivant. */
  target?: number;
}
