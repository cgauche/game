import { RollFlowShell } from './RollFlowShell';
import { useAttackJetProps } from './jetProps/useAttackJetProps';

/**
 * Modale d'attaque — coquille partagée `RollFlowShell` paramétrée par `useAttackJetProps` (métier
 * d'attaque : VsHeader, sélecteur d'arme/localisation, deux armes, tir dans le tas…). Ce MÊME
 * paramétrage rend l'étape-jet de la séquence de combat (`CascadeModal`), pour que le jet et ses
 * conséquences vivent dans UNE seule fenêtre. Aucune mécanique générique réécrite ici.
 */
export function RollModal() {
  const props = useAttackJetProps();
  if (!props) return null;
  return <RollFlowShell {...props} />;
}
