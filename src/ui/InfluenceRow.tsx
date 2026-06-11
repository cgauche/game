import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { freeRerollOf } from '../engine/activeFlags';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Rangée « influencer le jet » PARTAGÉE (Chance · Relance gratuite · +1 DR · Pacte · Résilience) —
 * le bloc était copié/collé dans chaque modale à jet (Attaque, Défense, Incantation,
 * Désengagement…). L'acteur est passé UNE fois : sa Chance, sa relance gratuite (Bénédiction de
 * Chance, LDB 41) et sa Résilience en découlent — plus d'oubli de `freeReroll` par modale.
 * `children` : boutons contextuels supplémentaires (Détermination, actions de chirurgie…).
 */
export function InfluenceRow({
  actor,
  rerollable,
  onReroll,
  onBonusSL,
  darkPactable,
  onDarkPact,
  onForce,
  forceShow = false,
  children,
}: {
  /** Le héros qui jette (Chance/relance gratuite/Résilience lus dessus). Absent → rangée réduite. */
  actor: Combatant | null | undefined;
  rerollable: boolean;
  onReroll: () => void;
  /** Absent → Test binaire : pas de « +1 DR ». */
  onBonusSL?: () => void;
  darkPactable?: boolean;
  onDarkPact?: () => void;
  /** Absent → pas de Résilience sur ce flux. */
  onForce?: () => void;
  /** Montre la Résilience (condition d'échec propre au flux). */
  forceShow?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rm-influence">
      <ChanceButtons
        fortune={actor?.fortune ?? 0}
        rerollable={rerollable}
        onReroll={onReroll}
        freeReroll={freeRerollOf(actor)}
        onBonusSL={onBonusSL}
        darkPactable={darkPactable}
        onDarkPact={onDarkPact}
      />
      {onForce && <ResilienceButton resilience={actor?.resilience ?? 0} show={forceShow} onForce={onForce} />}
      {children}
    </div>
  );
}
