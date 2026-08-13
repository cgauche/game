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
