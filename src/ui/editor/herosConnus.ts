/**
 * HÉROS PROPOSABLES à l'assise, à l'échelle de la SESSION D'ÉDITION.
 *
 * Le schéma de Scène ne nomme AUCUN héros : `heroStart` est une case, pas une identité, et le seul
 * endroit où un id de héros apparaît dans un document est `seatAssignments` lui-même. Il n'existe
 * donc pas de source stable DANS le document — libérer la dernière place d'un héros efface son id du
 * document, et le champ (qui se démonte à chaque changement de sélection) le perdrait pour toujours.
 *
 * L'ensemble vit donc AU-DESSUS du champ : semé par le document chargé, ENRICHI par toute assignation
 * qui apparaît dans la scène, JAMAIS réduit par une libération. Monotone par construction.
 *
 * LIMITE DU SCHÉMA, assumée : un document qui n'assoit aucun héros n'en propose aucun au premier
 * montage. Tant que `Scene` ne porte pas d'identité de héros, il n'y a rien à proposer ; ce sera le
 * jour où le schéma en nommera un.
 */
import { useRef } from 'react';
import type { Scene } from '../../state/scene';
import { documentHeroIds } from '../../state/sceneEdit';

export function useHerosConnus(scene: Scene): ReadonlySet<string> {
  const connus = useRef<Set<string>>(new Set());
  // Accumulation MONOTONE et idempotente : recalculée à chaque rendu, elle n'observe que la scène et
  // ne produit aucun effet visible hors de l'ensemble lui-même (aucun rendu déclenché).
  for (const heroId of documentHeroIds(scene)) connus.current.add(heroId);
  return connus.current;
}
