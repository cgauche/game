/**
 * FRONTIÈRE des gestes VIVANTS du stage (hors store, hors sauvegarde) : le lacet libre (`stageYaw`),
 * le décalage manuel (`stagePan`) et la marche tenue (`stageWalk`). Un geste en cours appartient à la
 * scène où la main l'a commencé — jamais à la suivante.
 *
 * SOURCE UNIQUE de cette remise à zéro : une frontière neuve (entrée de scène, transition, tout futur
 * changement de carte) appelle CETTE fonction. Ajouter un 4ᵉ module vivant = une ligne ICI, jamais une
 * remise à zéro de plus recopiée sur chaque frontière — c'est l'oubli d'UNE ligne sur UNE frontière
 * qui laissait la marche tenue commettre des pas dans la scène d'arrivée.
 */
import { resetStageYaw } from './stageYaw';
import { resetStagePan } from './stagePan';
import { resetStageWalk } from './stageWalk';

export function resetStageGestes(): void {
  resetStageYaw();
  resetStagePan();
  resetStageWalk();
}
